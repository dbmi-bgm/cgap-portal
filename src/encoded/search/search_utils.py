import structlog
from elasticsearch import (
    TransportError,
    RequestError,
    ConnectionTimeout
)
from pyramid.httpexceptions import HTTPBadRequest
from snovault import TYPES
from snovault.util import crawl_schema, find_collection_subtypes
from snovault.embed import make_subrequest
from snovault.elasticsearch.indexer_utils import get_namespaced_index
from ..util import deduplicate_list


log = structlog.getLogger(__name__)

# Constants

# from now on, use these constants when referring to elastic search
# query keywords when writing elastic search queries - Will 3-20-2020
QUERY = 'query'
FILTER = 'filter'
MUST = 'must'
MUST_NOT = 'must_not'
BOOL = 'bool'
MATCH = 'match'
SHOULD = 'should'
EXISTS = 'exists'
FIELD = 'field'
NESTED = 'nested'
PATH = 'path'
TERMS = 'terms'
RANGE = 'range'
AGGS = 'aggs'
REVERSE_NESTED = 'reverse_nested'
# just for book-keeping/readability but is 'unused' for now
# ie: it should be obvious when you are 'effectively' writing lucene
ELASTIC_SEARCH_QUERY_KEYWORDS = [
    QUERY, FILTER, MUST, MUST_NOT, BOOL, MATCH, SHOULD, EXISTS, FIELD, NESTED, PATH, TERMS, RANGE, AGGS, REVERSE_NESTED,
]


COMMON_EXCLUDED_URI_PARAMS = [
    'frame', 'format', 'limit', 'sort', 'from', 'field',
    'mode', 'redirected_from', 'datastore', 'referrer',
    'currentAction'
]


# Exception Classes


class SearchException(Exception):
    """ Base Search Exception - not meant to be used directly """
    def __init__(self, *, func, msg=None):
        if msg is None:
            msg = 'Exception occurred in search code at stage %s' % func
        super(SearchException, self).__init__(msg)
        self.func = func


class QueryConstructionException(SearchException):
    """
    Query construction exception - throw this if we should throw an exception in query building
    due to invalid query params
    """
    def __init__(self, query_type, func, msg=None):
        if msg is None:
            msg = 'Exception occurred during query building at query type %s in func %s' % (query_type, func)
        super(QueryConstructionException, self).__init__(func=func, msg=msg)
        self.query_type = query_type


# Functions


def convert_search_to_dictionary(search):
    """ Converts the given search to a dictionary. Useful in mocking queries from dictionaries in testing.

    :param search: elasticsearch_dsl object to convert
    :return: query in dictionary form
    """
    return search.to_dict()


def find_nested_path(field, es_mapping):
    """
    Returns path to 'highest' level nested field, in other words the first field mapped with type=nested
    found by traversing the given field from the *top* level.

    This function relies on information about the structure of the es_mapping to extract
    the *path to the object who's mapping is nested*. The comments within this function try to explain
    that structure. This information is needed to construct nested queries (it is the path).
    It returns None if the given (sub)field is not a member of a type=nested mapped field.

    :param field: the *full path* to the field we are filtering/aggregating on.
                        For example: "experiments_in_set.biosample.biosource.individual.organism.name"
    :param es_mapping: dictionary representation of the es_mapping of the type we are searching on
    :return: path for nested query or None
    """
    location = es_mapping
    path = []
    for cursor in field.split('.'):
        if cursor == 'raw':  # if we get to this point we're definitely at a leaf and should stop
            break
        if cursor not in location:  # its possible we are at a sub-embedded object boundary. Check if it has properties.
            if 'properties' not in location:  # if it doesn't have properties, there's nowhere to go, so return None.
                return None
            location = location['properties']  # else move location forward, but do not add it to the PATH
        if cursor not in location:  # if we still don't see our 'level', we are not a nested field
            break
        location = location[cursor]
        path.append(cursor)
        if location.get('type', None) == 'nested':
            return '.'.join(path)
    return None


def is_schema_field(field):
    """ Returns whether or not we should expect a schema to be found for the given field.
        Currently this only applies to validation_errors and aggregated_items.
        XXX: Consider regex?

    :param field: field name to check
    :return: False if this field doesn't a schema, True otherwise
    """
    if field.startswith('validation_errors') or field.startswith('aggregated_items'):  # note that trailing '.' is gone
        return False
    return True


def extract_field(field):
    """ Pre-processes 'field' from URL query params. Solely handles converting 'type' to '@type' and
        discarding the not (!) qualifier.

    :param field: field name to process
    :return: correct field_name to search on
    """
    use_field = '@type' if field == 'type' else field  # 'type' field is really '@type' in the schema
    return use_field[:-1] if use_field.endswith('!') else use_field


def schema_for_field(field, request, doc_types, should_log=False):
    """
    Find the schema for the given field (in embedded '.' format). Uses
    ff_utils.crawl_schema from snovault and logs any cases where there is an
    error finding the field from the schema. Caches results based off of field
    and doc types used

    :param field: embedded field path, separated by '.'
    :param request: current Request object
    :param doc_types (list): @types for the search
    :param should_log (bool): logging will only occur if set to True

    :returns: Dictionary schema for the field, or None if not found
    """
    types = request.registry[TYPES]
    schemas = [types[dt].schema for dt in doc_types]
    field_schema = None

    # We cannot hash dict by list (of doc_types) so we convert to unique ordered string
    doc_type_string = ','.join(sorted(doc_types))  # use default sort

    # Check cache, initializing if necessary
    cache = getattr(request, '_field_schema_cache', {})
    cache_key = (field, doc_type_string)
    if cache is None:
        request._field_schema_cache = cache = {}
    if cache_key in cache:
        return cache[cache_key]

    # for 'validation_errors.*' and 'aggregated_items.*',
    # schema will never be found and logging isn't helpful
    if schemas and is_schema_field(field):
        use_field = extract_field(field)
        for schema in schemas:
            try:
                field_schema = crawl_schema(types, use_field, schema)
            except Exception as exc:  # cannot find schema. Log and Return None
                if should_log:
                    log.warning('Cannot find schema in search.py. Type: %s. Field: %s'
                            % (doc_types[0], field), field=field, error=str(exc))
            else:
                if field_schema is not None:
                    break

    # Cache result, even if not found, for this request.
    cache[cache_key] = field_schema

    return field_schema


def get_query_field(field, facet, es_mapping):
    """
    Converts a field from its generic field name to a more specific field name referencing its embedded nature

    :param field: generic field name, such as 'files.accession'
    :param facet: facet on this field
    :return: full path to field on ES mapping
    """
    if field == 'type':
        return 'embedded.@type.raw'
    elif not is_schema_field(field):
        return field + '.raw'
    elif facet.get('aggregation_type') in ('stats', 'date_histogram', 'histogram', 'range'):
        return 'embedded.' + field
    else:
        return 'embedded.' + field + '.raw'


def find_index_by_doc_types(request, doc_types, ignore):
    """
    Find the correct index(es) to be search given a list of doc_types.
    The types in doc_types are the item class names, formatted like
    'Experiment HiC' and index names are the item types, formatted like
    'experiment_hi_c'.
    Ignore any collection names provided in the ignore param, an array.
    Formats output indexes as a string usable by elasticsearch
    """
    indexes = []
    for doc_type in doc_types:
        if doc_type in ignore:
            continue
        else:
            result = find_collection_subtypes(request.registry, doc_type)
            namespaced_results = map(lambda t: get_namespaced_index(request, t), result)
            indexes.extend(namespaced_results)
    indexes = deduplicate_list(indexes)
    index_string = ','.join(indexes)
    return index_string


def get_es_index(request, doc_types):
    """
    Gets ES index based on doc_type (one type per index)
    if doc_type is item, search all indexes by setting es_index to None
    If multiple, search all specified

    :param request: current request, to be passed
    :param doc_types: item types we are searching on
    :return: index name
    """
    if 'Item' in doc_types:
        return get_namespaced_index(request, '*')
    else:
        return find_index_by_doc_types(request, doc_types, ['Item'])


def get_es_mapping(es, es_index):
    """
    Get es mapping for given doc type (so we can handle type=nested)
    Note this is the mechanism by which we "enable" the ability to do nested searches
    ie: only enabled on single index searches. You could feasibly add more criteria.

    :param es: elasticsearch client
    :param es_index: index to get mapping from
    :return: the mapping for this item type or {} if we are not doing a single index search
    """
    if '*' in es_index or ',' in es_index:  # no type=nested searches can be done on * or multi-index
        return {}
    else:
        item_type = list(es.indices.get(es_index)[es_index]['mappings'].keys())[0]  # no other way to get it
        return es.indices.get(es_index)[es_index]['mappings'][item_type]['properties']


def get_search_fields(request, doc_types):
    """
    Returns set of columns that are being searched and highlights
    XXX: Unused
    """
    fields = {'uuid'}
    highlights = {}
    types = request.registry[TYPES]
    for doc_type in doc_types:
        type_info = types[doc_type]
        for value in type_info.schema.get('boost_values', ()):
            fields.add('embedded.' + value)
            highlights['embedded.' + value] = {}
    return fields, highlights


def is_linkto_or_object_array_root_field(field, types, doc_types):
    """
    Not used currently.

    :param field: field to check
    :param types: registry types
    :param doc_types: types we are searching on
    :return: infer whether or not this field is mapped with type=nested based on the schema alone
    """
    schema = types[doc_types[0]].schema
    field_root = field.split('.')[0]
    fr_schema = (schema and schema.get('properties', {}).get(field_root, None)) or None
    if fr_schema and fr_schema['type'] == 'array' and (fr_schema['items'].get('linkTo') is not None or fr_schema['items']['type'] == 'object'):
        return True
    return False


def execute_search(request, search):
    """
    Execute the given Elasticsearch-dsl search. Raise HTTPBadRequest for any
    exceptions that arise.

    :param search: the Elasticsearch-dsl prepared in the search() function
    :returns: Dictionary search results
    """
    err_exp = None
    es_results = None
    try:
        es_results = search.execute().to_dict()
    except ConnectionTimeout:
        err_exp = 'The search failed due to a timeout. Please try a different query.'
    except RequestError as exc:
        # try to get a specific error message. May fail in some cases
        try:
            err_detail = str(exc.info['error']['root_cause'][0]['reason'])
        except Exception:
            err_detail = str(exc)
        err_exp = 'The search failed due to a request error: ' + err_detail
    except TransportError as exc:
        # most general exception
        exc_status = getattr(exc, 'status_code')
        if exc_status == 'TIMEOUT':
            err_exp = 'The search failed due to a timeout. Please try a different query.'
        else:
            err_exp = 'The search failed due to a transport error: ' + str(exc)
    except Exception as exc:
        err_exp = str(exc)  # XXX: We should revisit if we think this is always safe... -Will 4-23-2020
    if err_exp:
        raise HTTPBadRequest(explanation=err_exp)
    return es_results


def make_search_subreq(request, path):
    subreq = make_subrequest(request, path)
    if hasattr(request, "_stats"):
        subreq._stats = request._stats
    subreq.registry = request.registry
    if hasattr(request, "context"):
        subreq.context = request.context
    else:
        subreq.context = None
    subreq.headers['Accept'] = 'application/json'
    return subreq
