import re
import math
import itertools
from pyramid.view import view_config
from webob.multidict import MultiDict
from functools import reduce
from snovault import (
    AbstractCollection,
    TYPES,
    COLLECTIONS
)
from snovault.embed import make_subrequest
from snovault.elasticsearch import ELASTIC_SEARCH
from snovault.elasticsearch.create_mapping import determine_if_is_date_field
from snovault.elasticsearch.indexer_utils import get_namespaced_index
from snovault.util import (
    find_collection_subtypes,
    crawl_schema,
    debug_log
)
from snovault.typeinfo import AbstractTypeInfo
from elasticsearch_dsl import Search, Nested
from elasticsearch_dsl.aggs import Terms
from elasticsearch import (
    TransportError,
    RequestError,
    ConnectionTimeout
)
from pyramid.httpexceptions import HTTPBadRequest
from urllib.parse import urlencode
from collections import OrderedDict
from copy import deepcopy
import uuid
import structlog

log = structlog.getLogger(__name__)


def includeme(config):
    config.add_route('search', '/search{slash:/?}')
    config.scan(__name__)

sanitize_search_string_re = re.compile(r'[\\\+\-\&\|\!\(\)\{\}\[\]\^\~\:\/\\\*\?]')


COMMON_EXCLUDED_URI_PARAMS = [
    'frame', 'format', 'limit', 'sort', 'from', 'field',
    'mode', 'redirected_from', 'datastore', 'referrer',
    'currentAction'
]


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


class SearchException(Exception):
    """ Base Search Exception - not meant to be used directly """
    def __init__(self, func, msg=None):
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
        super(QueryConstructionException, self).__init__(func, msg)
        self.query_type = query_type


@view_config(route_name='search', request_method='GET', permission='search')
@debug_log
def search(context, request, search_type=None, return_generator=False, forced_type='Search', custom_aggregations=None):
    """
    Search view connects to ElasticSearch and returns the results
    """
    types = request.registry[TYPES]
    # list of item types used from the query
    doc_types = set_doc_types(request, types, search_type)
    # calculate @type
    search_types = build_search_types(types, doc_types)
    search_types.append(forced_type)  # the old base search type
    # sets request.normalized_params
    search_base = normalize_query(request, types, doc_types)
    ### INITIALIZE RESULT.
    result = {
        '@context': request.route_path('jsonld_context'),
        '@id': '/' + forced_type.lower() + '/' + search_base,
        '@type': search_types,
        'title': forced_type,
        'filters': [],
        'facets': [],
        '@graph': [],
        'notification': '',
        'sort': {}
    }
    principals = request.effective_principals
    es = request.registry[ELASTIC_SEARCH]

    # Get static section (if applicable) when searching a single item type
    # Note: Because we rely on 'source', if the static_section hasn't been indexed
    # into Elasticsearch it will not be loaded
    add_search_header_if_needed(request, doc_types, result)

    from_, size = get_pagination(request)

    # get desired frame for this search
    search_frame = request.normalized_params.get('frame', 'embedded')

    ### PREPARE SEARCH TERM
    prepared_terms = prepare_search_term(request)

    schemas = [types[item_type].schema for item_type in doc_types]

    # set ES index based on doc_type (one type per index)
    # if doc_type is item, search all indexes by setting es_index to None
    # If multiple, search all specified
    es_index = get_es_index(request, doc_types)
    item_type_es_mapping = get_es_mapping(es, es_index)

    # establish elasticsearch_dsl class that will perform the search
    search = Search(using=es, index=es_index)

    # set up clear_filters path
    result['clear_filters'] = clear_filters_setup(request, doc_types, forced_type)

    ### SET TYPE FILTERS
    build_type_filters(result, request, doc_types, types)

    # get the fields that will be used as source for the search
    # currently, supports frame=raw/object but live faceting does not work
    # this is okay because the only non-embedded access will be programmatic
    source_fields = sorted(list_source_fields(request, doc_types, search_frame))

    ### GET FILTERED QUERY
    # Builds filtered query which supports multiple facet selection
    search, string_query = build_query(search, prepared_terms, source_fields)

    ### Set sort order
    search = set_sort_order(request, search, prepared_terms, types, doc_types, result)
    # TODO: implement BOOST here?

    ### Set filters
    search, query_filters = set_filters(request, search, result, principals, doc_types, item_type_es_mapping)

    ### Set starting facets
    facets = initialize_facets(request, doc_types, prepared_terms, schemas, item_type_es_mapping)

    ### Adding facets, plus any optional custom aggregations.
    ### Uses 'size' and 'from_' to conditionally skip (no facets if from > 0; no aggs if size > 0).
    search = set_facets(search, facets, query_filters, string_query, request, doc_types, custom_aggregations,
                        size, from_, item_type_es_mapping)

    ### Add preference from session, if available
    search_session_id = None
    if request.__parent__ is None and not return_generator and size != 'all': # Probably unnecessary, but skip for non-paged, sub-reqs, etc.
        search_session_id = request.cookies.get('searchSessionID', 'SESSION-' + str(uuid.uuid1()))
        search = search.params(preference=search_session_id)

    ### Execute the query
    if size == 'all':
        es_results = execute_search_for_all_results(search)
    else:
        size_search = search[from_:from_ + size]
        es_results = execute_search(size_search)

    ### Record total number of hits
    result['total'] = total = es_results['hits']['total']
    result['facets'] = format_facets(es_results, facets, total, search_frame)
    result['aggregations'] = format_extra_aggregations(es_results)

    # Add batch actions
    # TODO: figure out exactly what this does. Provide download URLs?
    # Implement later
    # result.update(search_result_actions(request, doc_types, es_results))

    ### Add all link for collections
    if size not in (None, 'all') and size < result['total']:
        params = [(k, v) for k, v in request.normalized_params.items() if k != 'limit']
        params.append(('limit', 'all'))
        if context:
            result['all'] = '%s?%s' % (request.resource_path(context), urlencode(params))

    # add actions (namely 'add')
    result['actions'] = get_collection_actions(request, types[doc_types[0]])

    if not result['total']:
        # http://googlewebmastercentral.blogspot.com/2014/02/faceted-navigation-best-and-5-of-worst.html
        request.response.status_code = 404
        result['notification'] = 'No results found'
        result['@graph'] = []
        return result if not return_generator else []

    columns = build_table_columns(request, schemas, doc_types)
    if columns:
        result['columns'] = columns

    result['notification'] = 'Success'

    ### Format results for JSON-LD
    graph = format_results(request, es_results['hits']['hits'], search_frame)

    if request.__parent__ is not None or return_generator:
        if return_generator:
            return graph
        else:
            result['@graph'] = list(graph)
            return result

    result['@graph'] = list(graph)
    if search_session_id: # Is 'None' if e.g. limit=all
        request.response.set_cookie('searchSessionID', search_session_id) # Save session ID for re-requests / subsequent pages.
    return result


@view_config(context=AbstractCollection, permission='list', request_method='GET')
@debug_log
def collection_view(context, request):
    """
    Simply use search results for collections views (e.g./biosamples/)
    This is a redirect directly to the search page
    """
    return search(context, request, context.type_info.name, False, forced_type='Search')


def build_search_types(types, doc_types):
    """ Builds search_types based on the given doc_types
    :param types: TypesTool from the registry
    :param doc_types: Type names we would like to search on
    :return: search_types, or a list of 'SearchResults' type candidates
    """
    search_types = []
    if len(doc_types) == 1:  # if we have one, add it and its base_type
        ti = types[doc_types[0]]
        search_types.append(ti.name + "SearchResults")
        if hasattr(ti, 'base_types'):
            for base_type in ti.base_types:
                search_types.append(base_type + "SearchResults")

    # If we have more than one, compute and add common ancestors to search_types
    # TODO: handle more than 2 common ancestors
    else:
        base_types = []
        for ti in doc_types:
            if hasattr(types[ti], 'base_types'):
                base_types.append(set(types[ti].base_types))
        common_ancestors = reduce(lambda x, y: x & y, base_types)
        if not common_ancestors:
            raise HTTPBadRequest("Tried to search on types with no common ancestor. This should never happen.")

        for ancestor in common_ancestors:
            if ancestor != "Item":
                search_types.append(ancestor + "SearchResults")
        search_types.append("ItemSearchResults")
    return search_types


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
    for level in field.split('.'):
        if level == 'raw':  # if we get to this point we're definitely at a leaf and should stop
            break
        if level not in location:  # its possible we are at a sub-embedded object boundary. Check if it has properties.
            if 'properties' not in location:  # if it doesn't have properties, there's nowhere to go, so return None.
                return None
            location = location['properties']  # else move location forward, but do not add it to the PATH
        if level not in location:  # if we still don't see our 'level', we are not a nested field
            break
        location = location[level]
        path.append(level)
        if location.get('type', None) == 'nested':
            return '.'.join(path)
    return None


def add_search_header_if_needed(request, doc_types, result):
    """
    Get static section (if applicable) when searching a single item type
    Note: Because we rely on 'source', if the static_section hasn't been indexed
    into Elasticsearch it will not be loaded

    :param request: current request
    :param doc_types: item type(s) we are searching on
    :param result: the final result to populate search header info with
    :return: Nothing, modifies result in place
    """
    if (len(doc_types) == 1) and 'Item' not in doc_types:
        search_term = 'search-info-header.' + doc_types[0]
        static_section = request.registry['collections']['StaticSection'].get(search_term)
        if static_section and hasattr(static_section.model, 'source'):
            item = static_section.model.source['object']
            result['search_header'] = {}
            result['search_header']['content'] = item['content']
            result['search_header']['title'] = item.get('title', item['display_title'])
            result['search_header']['filetype'] = item['filetype']


def get_collection_actions(request, type_info):
    """
    Use this method to see actions available on an item type (collection) in the request context

    :param request: current request
    :param type_info: snovault type_info object for the requested type
    :return: actions available for this collection at this time
    """
    collection = request.registry[COLLECTIONS].get(type_info.name)
    if hasattr(collection, 'actions'):
        return collection.actions(request)
    else:
        return None


def get_pagination(request):
    """
    Fill from_ and size parameters for search if given in the query string
    """
    from_ = request.normalized_params.get('from', 0)
    size = request.normalized_params.get('limit', 25)
    if size in ('all', ''):
       size = "all"
    else:
        try:
            size = int(size)
        except ValueError:
            size = 25
        try:
            from_ = int(from_)
        except ValueError:
            size = 0
    return from_, size


def get_all_subsequent_results(initial_search_result, search, extra_requests_needed_count, size_increment):
    """ Generator method used to paginate. """
    from_ = 0
    while extra_requests_needed_count > 0:
        #print(str(extra_requests_needed_count) + " requests left to get all results.")
        from_ = from_ + size_increment
        subsequent_search = search[from_:from_ + size_increment]
        subsequent_search_result = execute_search(subsequent_search)
        extra_requests_needed_count -= 1
        for hit in subsequent_search_result['hits'].get('hits', []):
            yield hit

def execute_search_for_all_results(search):
    """
    Uses the above function to automatically paginate all results.
    Note: in the future, we should the approach here

    :param search: elasticsearch_dsl search object to execute (no more configuration is done at this point)
    :return: all es_results that matched the given query
    """
    size_increment = 100  # Decrease this to like 5 or 10 to test.

    first_search = search[0:size_increment]  # get aggregations from here
    es_result = execute_search(first_search)

    total_results_expected = es_result['hits'].get('total', 0)
    extra_requests_needed_count = int(math.ceil(total_results_expected / size_increment)) - 1  # Decrease by 1 (first es_result already happened)

    if extra_requests_needed_count > 0:
        es_result['hits']['hits'] = itertools.chain(es_result['hits']['hits'], get_all_subsequent_results(es_result, search, extra_requests_needed_count, size_increment))
    return es_result


def normalize_query(request, types, doc_types):
    """
    Normalize the query by calculating and setting request.normalized_params
    (a webob MultiDict) that is derived from custom query rules and also
    the list of doc_types specified by set_doc_types(). The normalize_param
    helper function finds field_schema for each query parameter and enforces
    a set of rules (see below). If the query item types differ from doc_types,
    override with doc_types

    :param request: the current Request
    :param types: registry[TYPES]
    :param doc_types: item_types to use for the search

    :returns: query string built from normalized params
    """
    def normalize_param(key, val):
        """
        Process each key/val in the original query param. As part of this,
        obtain the field schema for each parameter. Changes the query string
        to redirect the search to the normalized parameters
        Current rules:
        - for 'type', get name from types (from the registry)
        - append '.display_title' to any terminal linkTo query field
        - append '.display_title' to sorts on linkTo fields
        """
        # type param is a special case. use the name from TypeInfo
        if key == 'type' and val in types:
            return (key, types[val].name)

        # if key is sort, pass val as the key to this function
        # if it appends display title we know its a linkTo and
        # should be treated as such
        if key == 'sort':
            # do not use '-' if present
            sort_val = val[1:] if val.startswith('-') else val
            new_val, _ = normalize_param(sort_val, None)
            if new_val != sort_val:
                val = val.replace(sort_val, new_val)
            return (key, val)

        # find schema for field parameter and drill down into arrays/subobjects
        field_schema = schema_for_field(key, request, doc_types)
        while field_schema and ('items' in field_schema or 'properties' in field_schema):
            try:
                field_schema = field_schema['items']
            except KeyError:
                pass
            try:
                field_schema = field_schema['properties']
            except KeyError:
                pass
        if field_schema and 'linkTo' in field_schema:
            # add display_title to terminal linkTo query fields
            if key.endswith('!'): # handle NOT
                return (key[:-1] + '.display_title!', val)
            return (key + '.display_title', val)
        else:
            return (key, val)

    normalized_params = (
        normalize_param(k, v)
        for k, v in request.params.items()
    )
    # use a MultiDict to emulate request.params
    normalized_params = MultiDict(normalized_params)
    # overwrite 'type' if not equal to doc_types
    if set(normalized_params.getall('type')) != set(doc_types):
        if 'type' in normalized_params:
            del normalized_params['type']
        for dtype in doc_types:
            normalized_params.add('type', dtype)
    # add the normalized params to the request
    # these will be used in place of request.params for the rest of search
    setattr(request, 'normalized_params', normalized_params)
    # the query string of the normalized search
    qs = '?' + urlencode([
        (k.encode('utf-8'), v.encode('utf-8'))
        for k, v in request.normalized_params.items()
    ])
    return qs


def clear_filters_setup(request, doc_types, forced_type):
    """
    Clear Filters URI path

    Make a URI path that clears all non-datatype filters
    and leaves in `q` (search query) params, if present.
    Also preserves currentAction=selection, if is set.

    :returns: A URL path
    """
    seach_query_specs = request.normalized_params.getall('q')
    seach_query_url = urlencode([("q", seach_query) for seach_query in seach_query_specs])
    # types_url will always be present (always >=1 doc_type)
    types_url = urlencode([("type", typ) for typ in doc_types])
    current_action = request.normalized_params.get('currentAction')

    clear_qs = types_url or ''
    if seach_query_url:
        clear_qs += '&' + seach_query_url
    if current_action == 'selection':
        clear_qs += '&currentAction=selection'
    current_search_sort = request.normalized_params.getall('sort')
    current_search_sort_url = urlencode([("sort", s) for s in current_search_sort])
    if current_search_sort_url:
        clear_qs += '&' + current_search_sort_url
    return request.route_path(forced_type.lower(), slash='/') + (('?' + clear_qs) if clear_qs else '')


def build_type_filters(result, request, doc_types, types):
    """
    Set the type filters for the search. If no doc_types, default to Item

    :param result: result to add filter intermediary format to
    :param request: current request
    :param doc_types: item types we are searching on, or None, in which case all params are discarded
    :param types: registry types
    """
    if not doc_types:
        doc_types = ['Item']
    else:
        for item_type in doc_types:
            ti = types[item_type]
            qs = urlencode([
                (k.encode('utf-8'), v.encode('utf-8'))
                for k, v in request.normalized_params.items() if not (k == 'type' and types.all.get('Item' if v == '*' else v) is ti)
            ])
            result['filters'].append({
                'field': 'type',
                'term': ti.name,
                'remove': '{}?{}'.format(request.path, qs)
            })


def prepare_search_term(request):
    """
    Prepares search terms by making a dictionary where the keys are fields and the values are arrays
    of query strings. This is an intermediary format  which will be modified when constructing the
    actual search query.

    Ignore certain keywords, such as type, format, and field

    :param request: current request
    :return: dictionary mapping field --> query strings
    """
    prepared_terms = {}
    for field, val in request.normalized_params.iteritems():
        if field.startswith('validation_errors') or field.startswith('aggregated_items'):
            continue
        elif field == 'q':  # searched string has field 'q'
            # people shouldn't provide multiple queries, but if they do,
            # combine them with AND logic
            if 'q' in prepared_terms:
                join_list = [prepared_terms['q'], val]
                prepared_terms['q'] = ' AND '.join(join_list)
            else:
                prepared_terms['q'] = val
        elif field not in COMMON_EXCLUDED_URI_PARAMS + ['type']:
            if 'embedded.' + field not in prepared_terms.keys():
                prepared_terms['embedded.' + field] = []
            prepared_terms['embedded.' + field].append(val)
    return prepared_terms


def set_doc_types(request, types, search_type):
    """
    Set the type of documents resulting from the search; order and check for
    invalid types as well. If a forced search_type is enforced, use that;
    otherwise, set types from the query params. Default to Item if none set.

    :param request: the current Request
    :param types: registry[TYPES]
    :param search_type: forced search item type

    :returns: list: the string item types to use for the search
    :raises: HTTPBadRequest: if an invalid item type is supplied
    """
    doc_types = []
    if search_type is None:
        doc_types = request.params.getall('type')
        if '*' in doc_types:
            doc_types = ['Item']
    else:
        doc_types = [search_type]
    # Normalize to item_type
    try:
        doc_types = sorted({types[name].name for name in doc_types})
    except KeyError:
        # Check for invalid types
        bad_types = [t for t in doc_types if t not in types]
        msg = "Invalid type: {}".format(', '.join(bad_types))
        raise HTTPBadRequest(explanation=msg)
    if len(doc_types) == 0:
        doc_types = ['Item']
    return doc_types


def get_search_fields(request, doc_types):
    """
    Returns set of columns that are being searched and highlights
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


def list_source_fields(request, doc_types, frame):
    """
    Returns set of fields that are requested by user or default fields.
    These fields are used to further limit the results from the search.
    Note that you must provide the full fieldname with embeds, such as:
    'field=biosample.biosource.individual.organism.name' and not just
    'field=name'
    """
    fields_requested = request.normalized_params.getall('field')
    if fields_requested:
        fields = ['embedded.@id', 'embedded.@type']
        for field in fields_requested:
            fields.append('embedded.' + field)
    elif frame in ['embedded', 'object', 'raw']:
        if frame != 'embedded':
            # frame=raw corresponds to 'properties' in ES
            if frame == 'raw':
                frame = 'properties'
            # let embedded be searched as well (for faceting)
            fields = ['embedded.*', frame + '.*']
        else:
            fields = [frame + '.*']
    else:
        fields = ['embedded.*']
    return fields


def build_query(search, prepared_terms, source_fields):
    """
    Prepare the query within the Search object.
    """
    query_info = {}
    string_query = None
    # set _source fields for the search
    search = search.source(list(source_fields))
    # prepare the query from prepared_terms
    for field, value in prepared_terms.items():
        if field == 'q':
            query_info['query'] = value
            query_info['lenient'] = True
            query_info['default_operator'] = 'AND'
            query_info['fields'] = ['_all']
            break
    if query_info != {}:
        string_query = {'must': {'simple_query_string': query_info}}
        query_dict = {'query': {'bool': string_query}}
    else:
        query_dict = {'query': {'bool':{}}}
    search.update_from_dict(query_dict)
    return search, string_query


def set_sort_order(request, search, search_term, types, doc_types, result):
    """
    sets sort order for elasticsearch results
    example: /search/?type=Biosource&sort=display_title
    will sort by display_title in ascending order. To set descending order,
    use the "-" flag: sort_by=-date_created.
    Sorting is done alphatbetically, case sensitive by default.

    ES5: simply pass in the sort OrderedDict into search.sort
    """
    sort = OrderedDict()
    result_sort = OrderedDict()
    if len(doc_types) == 1:
        type_schema = types[doc_types[0]].schema
    else:
        type_schema = None

    def add_to_sort_dict(requested_sort):
        if requested_sort.startswith('-'):
            name = requested_sort[1:]
            order = 'desc'
        else:
            name = requested_sort
            order = 'asc'
        sort_schema = schema_for_field(name, request, doc_types)

        if sort_schema:
            sort_type = sort_schema.get('type')
        else:
            sort_type = 'string'

        # ES type != schema types
        if sort_type == 'integer':
            sort['embedded.' + name] = result_sort[name] = {
                'order': order,
                'unmapped_type': 'long',
                'missing': '_last'
            }
        elif sort_type == 'number':
            sort['embedded.' + name] = result_sort[name] = {
                'order': order,
                'unmapped_type': 'float',
                'missing': '_last'
            }
        elif sort_schema and determine_if_is_date_field(name, sort_schema):
            sort['embedded.' + name + '.raw'] = result_sort[name] = {
                'order': order,
                'unmapped_type': 'date',
                'missing': '_last'
            }
        else:
            # fallback case, applies to all string type:string fields
            sort['embedded.' + name + '.lower_case_sort'] = result_sort[name] = {
                'order': order,
                'unmapped_type': 'keyword',
                'missing': '_last'
            }

    # Prefer sort order specified in request, if any
    requested_sorts = request.normalized_params.getall('sort')
    if requested_sorts:
        for rs in requested_sorts:
            add_to_sort_dict(rs)

    text_search = search_term.get('q')

    # Otherwise we use a default sort only when there's no text search to be ranked
    if not sort and (text_search == '*' or not text_search):
        # If searching for a single type, look for sort options in its schema
        if type_schema:
            if 'sort_by' in type_schema:
                for k, v in type_schema['sort_by'].items():
                    # Should always sort on raw field rather than analyzed field
                    # OR search on lower_case_sort for case insensitive results
                    sort['embedded.' + k + '.lower_case_sort'] = result_sort[k] = v
        # Default is most recent first, then alphabetical by label
        if not sort:
            sort['embedded.date_created.raw'] = result_sort['date_created'] = {
                'order': 'desc',
                'unmapped_type': 'keyword',
            }
            sort['embedded.label.raw'] = result_sort['label'] = {
                'order': 'asc',
                'missing': '_last',
                'unmapped_type': 'keyword',
            }
    elif not sort and text_search and text_search != '*':
        search = search.sort(                   # Multi-level sort. See http://www.elastic.co/guide/en/elasticsearch/guide/current/_sorting.html#_multilevel_sorting & https://stackoverflow.com/questions/46458803/python-elasticsearch-dsl-sorting-with-multiple-fields
            { '_score' : { "order": "desc" } },
            { 'embedded.date_created.raw' : { 'order': 'desc', 'unmapped_type': 'keyword' }, 'embedded.label.raw' : { 'order': 'asc',  'unmapped_type': 'keyword', 'missing': '_last' } },
            { '_uid' : { 'order': 'asc' } }     # 'embedded.uuid.raw' (instd of _uid) sometimes results in 400 bad request : 'org.elasticsearch.index.query.QueryShardException: No mapping found for [embedded.uuid.raw] in order to sort on'
        )
        result['sort'] = result_sort = { '_score' : { "order" : "desc" } }
        return search

    if sort and result_sort:
        result['sort'] = result_sort
        search = search.sort(sort)
    return search


def initialize_field_filters(request, principals, doc_types):
    """ Helper function for set_filters
        Initializes field filters with filters that exist on all searches, does some basic updates
    """
    field_filters = {
        'principals_allowed.view': {
            'must_terms': principals,
            'must_not_terms': [],
            'add_no_value': None
        },
        'embedded.@type.raw': {
            'must_terms': doc_types,
            'must_not_terms': [],
            'add_no_value': None
        },
        'embedded.status.raw': {
            'must_terms': [],
            'must_not_terms': [],
            'add_no_value': None
        }
    }

    # Exclude status=deleted Items unless explicitly requested/filtered-in.
    if 'deleted' not in request.normalized_params.getall('status'):
        field_filters['embedded.status.raw']['must_not_terms'].append('deleted')
    if 'replaced' not in request.normalized_params.getall('status'):
        field_filters['embedded.status.raw']['must_not_terms'].append('replaced')

    # Exclude type=TrackingItem and type=OntologyTerm from results unless are explictly specified
    if 'TrackingItem' not in doc_types:
        field_filters['embedded.@type.raw']['must_not_terms'].append('TrackingItem')
    if 'OntologyTerm' not in doc_types:
        field_filters['embedded.@type.raw']['must_not_terms'].append('OntologyTerm')

    return field_filters


def handle_range_filters(request, result, field_filters, doc_types):
    """
    Constructs range_filters based on the given filters as part of the MUST sub-query

    :param request: current request
    :param result: result to modify in place
    :param field_filters: filters to look at
    :param doc_types: types we are searching on
    :return: constructed range_filters
    """
    range_filters = {}

    for field, term in request.normalized_params.items():
        not_field = False  # keep track if query is NOT (!)
        exists_field = False  # keep track of null values
        range_type = False  # If we determine is a range request (field.to, field.from), will be populated with string 'date' or 'numerical'
        range_direction = None
        if field in COMMON_EXCLUDED_URI_PARAMS + ['q']:
            continue
        elif field == 'type' and term != 'Item':
            continue
        elif term == 'No value':
            exists_field = True

        # Check for date or numerical range filters
        if (len(field) > 3 and field[-3:] == '.to') or (len(field) > 5 and field[-5:] == '.from'):
            if field[-3:] == '.to':
                f_field = field[:-3]
                range_direction = "lte"
            else:
                f_field = field[:-5]
                range_direction = "gte"

            # If schema for field is not found (and range_type thus not set),
            # then treated as ordinary term filter (likely will get 0 results)
            field_schema = schema_for_field(f_field, request, doc_types)
            if field_schema:
                range_type = 'date' if determine_if_is_date_field(f_field, field_schema) else 'numerical'

        # Add filter to result
        qs = urlencode([
            (k.encode('utf-8'), v.encode('utf-8'))
            for k, v in request.normalized_params.items()
            if (k != field or v != term)
        ])
        remove_path = '{}?{}'.format(request.path, qs)

        # default to searching type=Item rather than empty filter path
        if remove_path[-1] == '?':
            remove_path += 'type=Item'

        result['filters'].append({
            'field': field,
            'term': term,
            'remove': remove_path
        })

        # handle NOT
        if field.endswith('!'):
            field = field[:-1]
            not_field = True

        # Add filter to query
        if range_type and f_field and range_type in ('date', 'numerical'):
            query_field = 'embedded.' + f_field
        elif field.startswith('validation_errors') or field.startswith('aggregated_items'):
            query_field = field + '.raw'
        elif field == 'type':
            query_field = 'embedded.@type.raw'
        else:
            query_field = 'embedded.' + field + '.raw'

        if range_type:
            if query_field not in range_filters:
                range_filters[query_field] = {}
                if range_type == 'date':
                    range_filters[query_field]['format'] = 'yyyy-MM-dd HH:mm'

            if range_direction in ('gt', 'gte', 'lt', 'lte'):
                if range_type == "date" and len(term) == 10:
                    # Correct term to have hours, e.g. 00:00 or 23:59, if not otherwise supplied.
                    if range_direction == 'gt' or range_direction == 'lte':
                        term += ' 23:59'
                    elif range_direction == 'gte' or range_direction == 'lt':
                        term += ' 00:00'

                if range_filters[query_field].get(range_direction) is None:
                    range_filters[query_field][range_direction] = term
                else:
                    # If have a value already (e.g. multiple ranges selected), choose the widening option.
                    if range_direction == 'gt' or range_direction == 'gte':
                        if term < range_filters[query_field][range_direction]:
                            range_filters[query_field][range_direction] = term
                    elif range_direction == 'lt' or range_direction == 'lte':
                        if term > range_filters[query_field][range_direction]:
                            range_filters[query_field][range_direction] = term
        else:
            if query_field not in field_filters:
                field_filters[query_field] = {
                    'must_terms': [],
                    'must_not_terms': [],
                    'add_no_value': None
                }

            # handle case of filtering for null values
            if exists_field:
                # the value below is True when we want to include 'No value' as a filter
                field_filters[query_field]['add_no_value'] = False if not_field else True
                continue

            if not_field:
                field_filters[query_field]['must_not_terms'].append(term)
            else:
                field_filters[query_field]['must_terms'].append(term)

    return range_filters


def construct_nested_sub_queries(query_field, filters, key='must_terms'):
    """
     Helper for build_sub_queries that constructs the base layer of sub-queries
     Note that due to the query structure, 'must' is always needed in the base level query,
     since at this point we have already split into 'must' or 'must_not'.

    :param query_field: field that we are querying
    :param filters: all filters
    :param key: one of 'must' or 'must_not'
    :return: a lucene sub-query filtering the query field based on the given filters
    :raises: QueryConstructionException if bad params make it here
    """
    if key not in ['must_terms', 'must_not_terms']:
        raise QueryConstructionException(
            query_type='nested',
            func='construct_nested_sub_queries',
            msg='Tried to handle nested filter with key other than must/must_not: %s' % key
        )

    # handle length 0, 1 and n cases
    try:
        my_filters = filters[key]
    except KeyError:
        return {}  # just in case, we want this to be recoverable if for some reason it happens
    if len(my_filters) == 0:
        return {}
    elif len(my_filters) == 1:  # see standard bool/match query
        return {BOOL: {MUST: [{MATCH: {query_field: my_filters[0]}}]}}
    else:
        sub_queries = {BOOL: {MUST: {BOOL: {SHOULD: []}}}}
        for option in my_filters:  # see how to combine queries on the same field
            sub_queries[BOOL][MUST][BOOL][SHOULD].append({MATCH: {query_field: option}})
        return sub_queries


def build_sub_queries(field_filters, es_mapping):
    """
    Builds queries based on several things:
        - What the query field is
        - If that field is nested
        - If we would like to see items who do not have a value for this field. These items will have 'No value'
          for the relevant field.
        - If it is a positive (must) or negative (must_not) query. This is the level by which these are separated.

    :param field_filters: Intermediary format to be converted to valid lucene based on the es_mapping
    :param es_mapping: mapping of the item we are searching on
    :return: 4 tuple consisting of (must_filters, must_not_filters, must_filters_nested, must_not_filters_nested)
    """
    must_filters = []
    must_not_filters = []
    must_filters_nested = []
    must_not_filters_nested = []

    for query_field, filters in field_filters.items():
        # if we are nested, we must construct the query differently than normal
        if find_nested_path(query_field, es_mapping):
            query_field = query_field.replace('.properties', '')

            # Build must/must_not sub-queries
            must_terms = construct_nested_sub_queries(query_field, filters, key='must_terms')
            must_not_terms = construct_nested_sub_queries(query_field, filters, key='must_not_terms')

            if filters['add_no_value'] is True:  # when searching on 'No Value'
                should_arr = [must_terms] if must_terms else []
                should_arr.append({BOOL: {MUST_NOT: {EXISTS: {FIELD: query_field}}}})
                must_filters_nested.append((query_field, should_arr))
            elif filters['add_no_value'] is False:  # when not searching on 'No Value'
                should_arr = [must_terms] if must_terms else []
                should_arr.append({EXISTS: {FIELD: query_field}})
                must_filters_nested.append((query_field, should_arr))
            else:
                if must_terms: must_filters_nested.append((query_field, must_terms))
            if must_not_terms: must_not_filters_nested.append((query_field, must_not_terms))

        # if we are not nested, handle this with 'terms' query like usual
        else:
            must_terms = {TERMS: {query_field: filters['must_terms']}} if filters['must_terms'] else {}
            must_not_terms = {TERMS: {query_field: filters['must_not_terms']}} if filters['must_not_terms'] else {}
            if filters['add_no_value'] is True:
                # add to must_not in an OR case, which is equivalent to filtering on 'No value'
                should_arr = [must_terms] if must_terms else []
                should_arr.append({BOOL: {MUST_NOT: {EXISTS: {FIELD: query_field}}}})
                must_filters.append((query_field, {BOOL: {SHOULD: should_arr}}))
            elif filters['add_no_value'] is False:
                # add to must_not in an OR case, which is equivalent to filtering on '! No value'
                should_arr = [must_terms] if must_terms else []
                should_arr.append({EXISTS: {FIELD: query_field}})
                must_filters.append((query_field, {BOOL: {SHOULD: should_arr}}))
            else:  # no filtering on 'No value'
                if must_terms: must_filters.append((query_field, must_terms))
            if must_not_terms: must_not_filters.append((query_field, must_not_terms))

    return must_filters, must_not_filters, must_filters_nested, must_not_filters_nested


def apply_range_filters(range_filters, must_filters, es_mapping):
    """
    Applies the range filters to the 'must' subquery
    Tuple format is required to handle nested fields that are non-range (it is discarded in this case)
    Nested range fields must also be separated from other nested sub queries - see comment in handle_nested_filters

    :param range_filters: intermediary range_filter format to be converted to valid lucene
    :param must_filters: must_filters from build_sub_queries, this is where range filters are applied
    :param es_mapping: mapping of the item we searching on, as the range filter could be on a nested field
    """

    # tuple format is required to handle nested fields that are non-range (it is discarded in this case)
    # nested range fields must also be separated from other nested sub queries - see comment in 'handle_nested_filters'
    for range_field, range_def in range_filters.items():
        nested_path = find_nested_path(range_field, es_mapping)
        if nested_path:
            must_filters.append(('range', {
                NESTED: {
                    PATH: nested_path,
                    QUERY: {
                        RANGE: {range_field: range_def}
                    }
                }
            }))
        else:
            must_filters.append(('range', {
                RANGE: {range_field: range_def}
            }))


def extract_nested_path_from_field(field):
    """
    Extracts the nested path from the field by splicing the field from start:second_idx_of_('.').
    This seems to work in general but feels fragile... It is specific to how we map things.
    It's likely this can be factored out. - Will
        ex: 'embedded.files.accession.raw' --> 'embedded.files' is the nested path

    :param field: full field path at the most, nested path at the least
    :return: nested
    """
    return field[:field.index('.', field.index('.') + 1)]


def handle_should_query(field_name, options):
    """
    Builds a lucene 'should' subquery for every option for the given field

    :param field_name: full path to field
    :param options: list of options for that field
        ex: field_name='embedded.files.file_size.raw', options=[20, 30, 40]

    :return: dsl-subquery that is effectively an OR of all options on the field. See SHOULD.
    """
    should_query = {BOOL: {SHOULD: {TERMS: {field_name: []}}}}
    for option in options:
        should_query[BOOL][SHOULD][TERMS][field_name].append(option)
    return should_query


def handle_nested_filters(nested_filters, final_filters, key='must'):
    """
    Helper function for set_filters that collapses nested filters together into a single lucene sub-query
    and attaching it to final_filters (modifying in place).

    :param nested_filters: All nested fields that we would like to search on
    :param final_filters: Collection of filters formatted in lucene, to be extended with nested filters
    :param key: 'must' or 'must_not'
    """
    key_map = {MUST: MUST_NOT, MUST_NOT: MUST}
    if key not in key_map:
        raise QueryConstructionException(
            query_type='nested',
            func='handle_nested_filters',
            msg='Tried to handle nested filter with key other than must/must_not: %s' % key
        )

    # iterate through all nested filters
    for field, query in nested_filters:

        # iterate through all sub_query parts - note that this is modified in place hence the need
        # to re-iterate after every nested filer is applied
        nested_path = extract_nested_path_from_field(field)
        sub_queries = final_filters['bool'][key]
        found = False
        for _q in sub_queries:

            # Try to add to an existing 'nested' sub-query if possible
            if _q.get(NESTED, None):
                if _q[NESTED][PATH] == nested_path:
                    try:
                        # check if this field has multiple options
                        options = query[BOOL][key][0][MATCH][field].split(',')
                        if len(options) > 1:

                            # construct SHOULD sub-query for all options
                            sub_query = handle_should_query(field, options)
                            _q[NESTED][QUERY][BOOL][key].append(sub_query)

                        # if we don't have options, our original 'query' is what we need
                        else:
                            insertion_point = _q[NESTED][QUERY][BOOL]
                            if key not in insertion_point:  # this can happen if we are combining with 'No value'
                                _q[NESTED][QUERY][BOOL][key] = query[BOOL][key][0]
                            else:
                                _q[NESTED][QUERY][BOOL][key].append(query[BOOL][key][0])

                        found = True  # break is not sufficient, see below
                        break
                    except:       # Why? We found a 'range' nested query and must add this one separately
                        continue  # This behavior is absurd. Somehow it knows to combine separate nested range
                                  # queries with AND, but of course not regular queries and of course you cannot
                                  # combine the range query here due to syntax  - Will
        if not found:

            # It's possible we're looking at a sub-query that's wrapped in a (length 1) list
            if type(query) == list:
                if len(query) == 1:
                    query = query[0]
                else:
                    raise QueryConstructionException(
                        query_type='nested',
                        func='handle_nested_filters',
                        msg='Malformed entry on query field: %s' % query
                    )

            # Check that key is in the sub-query first, it's possible that it in fact uses it's opposite
            # This can happen when adding no value, the opposite 'key' can occur in the sub-query
            opposite_key = None
            if key not in query[BOOL]:
                opposite_key = key_map[key]
                outer_query = query[BOOL][opposite_key]
            else:
                outer_query = query[BOOL][key]

            # It's possible we have multiple options for the same field (OR). Take those in place.
            if BOOL in outer_query:
                if SHOULD in outer_query[BOOL]:
                    sub_query = query
                else:
                    raise QueryConstructionException(
                        query_type='bool',
                        func='handle_nested_filters',
                        msg='BOOL container in parent query requires SHOULD component in sub-query, got: %s' % query
                    )

            # Otherwise, we have a standard 'match' and must repeat 'options' work here since its
            # possible we are the first nested field on the given path
            else:
                if opposite_key:  # in case we are in an 'opposite scenario', pass query directly
                    options = []
                else:
                    options = query[BOOL][key][0][MATCH][field].split(',')

                if len(options) > 1:
                    sub_query = handle_should_query(field, options)
                else:
                    sub_query = query

            # add the 'nested' sub query to the main query for this path
            # all remaining nested filters on this path will be part of this object unless they are of type 'range'
            # in which case they will get their own NESTED sub-query
            final_filters[BOOL][key].append({
                    NESTED: {PATH: nested_path,
                             QUERY: sub_query}
            })


def set_filters(request, search, result, principals, doc_types, es_mapping):
    """
    This function builds the Elasticsearch query based on the request. The structure of the query
    is approximately represented below. 'Approximate' because you could not copy-paste directly into
    Lucene, but should illustrate enough so it is comprehensible. Note the 'nested' nature of the query.

    QUERY HEIRARCHY ('approximate' lucene syntax):
        {
            'query': {
                'bool': {
                    'filter': {
                        'bool': {
                            'must': {
                                <positive+range sub-queries>
                                +
                                'bool': {
                                    'should': { option1, option2 ... }
                                }
                            },
                            'must_not': {
                                <negative sub-queries>
                                +
                                'bool': {
                                    'should': { option1, option2 ...
                            }}}}}
        }
    There are several different sub-queries, but most of them are built using 'bool' -> 'must'.
    A brief overview follows.
        * nested data type sub-queries have a special format. See 'handle_nested_filters'.
        * range filter sub-queries also have their own special format. See 'apply_range_filters'. Note that
            the format is extra special when you're applying a range filter to a nested data type.
        * 'terms' filters are what we 'normally' use.

    :param request: Current request
    :param search: Current search
    :param result: Response to be returned from the view ('/search')
    :param principals: Active user roles
    :param doc_types: Document type we are searching on
    :param es_mapping: Elasticsearch mapping of the document type we're searching on
    :returns: 2-tuple containing the updated search based on the request parameters and
              information on the filters used in the query.
    """

    # these next two dictionaries should each have keys equal to query_field
    # and values: must_terms: [<list of terms>], must_not_terms: [<list of terms>], add_no_value: True/False/None
    field_filters = initialize_field_filters(request, principals, doc_types)
    range_filters = handle_range_filters(request, result, field_filters, doc_types)

    # construct queries
    must_filters, must_not_filters, \
    must_filters_nested, must_not_filters_nested = build_sub_queries(field_filters, es_mapping)

    # add range limits to filters if given
    apply_range_filters(range_filters, must_filters, es_mapping)

    # To modify filters of elasticsearch_dsl Search, must call to_dict(),
    # modify that, then update from the new dict
    prev_search = search.to_dict()

    # initialize filter hierarchy
    final_filters = {BOOL: {MUST: [f for _, f in must_filters], MUST_NOT: [f for _, f in must_not_filters]}}
    handle_nested_filters(must_filters_nested, final_filters, key=MUST)
    handle_nested_filters(must_not_filters_nested, final_filters, key=MUST_NOT)

    # at this point, final_filters is valid lucene and can be dropped into the query directly
    prev_search[QUERY][BOOL][FILTER] = final_filters
    search.update_from_dict(prev_search)
    return search, final_filters


def initialize_facets(request, doc_types, prepared_terms, schemas, es_mapping):
    """
    Initialize the facets used for the search. If searching across multiple
    doc_types, only use the default 'Data Type' and 'Status' facets.
    Add facets for custom url filters whether or not they're in the schema.
    TODO: clean up this method

    :param doc_types: Item types (@type) for which we are performing a search for.
    :param prepared_terms: terms to match in ES, keyed by ES field name.
    :param schemas: List of OrderedDicts of schemas for doc_types.

    :returns: list: tuples containing (0) ElasticSearch-formatted field name (e.g. `embedded.status`)
                    and (1) list of terms for it.
    """

    facets = [
        # More facets will be appended to this list from item schema plus from any currently-active filters (as requested in URI params).
        ('type', {'title': 'Data Type'})
    ]
    append_facets = [
        # Facets which will be appended after those which are in & added to `facets`
        ('status', {'title': 'Status'}),

        # TODO: Re-enable below line if/when 'range' URI param queries for date & numerical fields are implemented.
        # ('date_created', {'title': 'Date Created', 'hide_from_view' : True, 'aggregation_type' : 'date_histogram' })
    ]
    validation_error_facets = [
        ('validation_errors.name', {'title': 'Validation Errors', 'order': 999})
    ]

    # hold disabled facets from schema; we also want to remove these from the prepared_terms facets
    disabled_facets = []

    # Add facets from schema if one Item type is defined.
    # Also, conditionally add extra appendable facets if relevant for type from schema.
    if len(doc_types) == 1 and doc_types[0] != 'Item':
        current_type_schema = request.registry[TYPES][doc_types[0]].schema
        if 'facets' in current_type_schema:
            schema_facets = OrderedDict(current_type_schema['facets'])
            for schema_facet in schema_facets.items():
                if schema_facet[1].get('disabled', False):
                    disabled_facets.append(schema_facet[0])
                    continue # Skip disabled facets.
                facets.append(schema_facet)

    ## Add facets for any non-schema ?field=value filters requested in the search (unless already set)
    used_facets = [ facet[0] for facet in facets + append_facets ]
    used_facet_titles = [
        facet[1]['title'] for facet in facets + append_facets
        if 'title' in facet[1]
    ]

    for field in prepared_terms:
        if field.startswith('embedded'):
            split_field = field.strip().split('.') # Will become, e.g. ['embedded', 'experiments_in_set', 'files', 'file_size', 'from']
            use_field = '.'.join(split_field[1:])

            # 'terms' is the default per-term bucket aggregation for all non-schema facets
            if es_mapping and find_nested_path(field, es_mapping):
                aggregation_type = 'nested'
            else:
                aggregation_type = 'terms'

            # Use the last part of the split field to get the field title
            title_field = split_field[-1]

            # workaround: if query has a '!=' condition, title_field ends with '!'. This prevents to find the proper display title.
            # TODO: instead of workaround, '!' could be excluded while generating query results
            if title_field.endswith('!'):
                title_field = title_field[:-1]

            # if searching for a display_title, use the title of parent object
            # use `is_object_title` to keep track of this
            if title_field == 'display_title' and len(split_field) > 1:
                title_field = split_field[-2]
                is_object_title = True
            else:
                is_object_title = False

            if title_field in used_facets or title_field in disabled_facets:
                # Cancel if already in facets or is disabled
                continue
            used_facets.append(title_field)

            # If we have a range filter in the URL, strip out the ".to" and ".from"
            if title_field == 'from' or title_field == 'to':
                if len(split_field) >= 3:
                    f_field = ".".join(split_field[1:-1])
                    field_schema = schema_for_field(f_field, request, doc_types)

                    if field_schema:
                        is_date_field = determine_if_is_date_field(field, field_schema)
                        is_numerical_field = field_schema['type'] in ("integer", "float", "number")

                        if is_date_field or is_numerical_field:
                            title_field = field_schema.get("title", f_field)
                            use_field = f_field
                            aggregation_type = 'stats'

            for schema in schemas:
                if title_field in schema['properties']:
                    title_field = schema['properties'][title_field].get('title', title_field)
                    # see if the title field conflicts for is_object_title facets
                    if is_object_title and title_field in used_facet_titles:
                        title_field += ' (Title)'
                    break

            facet_tuple = (use_field, {'title': title_field, 'aggregation_type' : aggregation_type})

            # At moment is equivalent to `if aggregation_type == 'stats'`` until/unless more agg types are added for _facets_.
            if aggregation_type != 'terms':
                # Remove completely if duplicate (e.g. .from and .to both present)
                if use_field in used_facets:
                    continue
                #facet_tuple[1]['hide_from_view'] = True # Temporary until we handle these better on front-end.
                # Facet would be otherwise added twice if both `.from` and `.to` are requested.

            facets.append(facet_tuple)


    # Append additional facets (status, validation_errors, ...) at the end of
    # list unless were already added via schemas, etc.
    used_facets = [ facet[0] for facet in facets ] # Reset this var
    for ap_facet in append_facets + validation_error_facets:
        if ap_facet[0] not in used_facets:
            facets.append(ap_facet)
        else: # Update with better title if not already defined from e.g. requested filters.
            existing_facet_index = used_facets.index(ap_facet[0])
            if facets[existing_facet_index][1].get('title') in (None, facets[existing_facet_index][0]):
                facets[existing_facet_index][1]['title'] = ap_facet[1]['title']

    return facets


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

    # We cannot hash dict by list (of doc_types) so we convert to unique ordered string
    doc_type_string = ','.join(doc_types)

    cache = getattr(request, '_field_schema_cache', {})
    if (field, doc_type_string) in cache:
        return cache[(field, doc_type_string)]

    field_schema = None

    # for 'validation_errors.*' and 'aggregated_items.*',
    # schema will never be found and logging isn't helpful
    if (schemas and not field.startswith('validation_errors.') and
        not field.startswith('aggregated_items.')):
        # 'type' field is really '@type' in the schema
        use_field = '@type' if field == 'type' else field
        # eliminate '!' from not fields
        use_field = use_field[:-1] if use_field.endswith('!') else use_field
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
    cache[(field, doc_type_string)] = field_schema
    if not hasattr(request, '_field_schema_cache'):
        setattr(request, '_field_schema_cache', cache)

    return field_schema


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


def generate_filters_for_terms_agg_from_search_filters(query_field, search_filters, string_query):
    """
    We add a copy of our filters to each facet, minus that of
    facet's field itself so that we can get term counts for other terms filters.
    And be able to filter w/ it.
    Remove filters from fields they apply to.
    For example, the 'biosource_type' aggs should not have any
    biosource_type filter in place.
    Handle 'must' and 'must_not' filters separately

    Note: At this point no nested work has been done, so formatting into this intermediary state is okay
          and is in fact necessary for later work to handle nested to function correctly.

    :param query_field: field terms agg is on
    :param search_filters: intermediary format prior to any valid lucene representing the search_filters
                           from the front-end
    :param string_query: query string if provided
    :return: Copy of search_filters, minus filter for current query_field (if one set).
    """
    facet_filters = deepcopy(search_filters['bool'])

    for filter_type in ['must', 'must_not']:
        if search_filters['bool'][filter_type] == []:
            continue
        for active_filter in search_filters['bool'][filter_type]:  # active_filter => e.g. { 'terms' : { 'embedded.@type.raw': ['ExperimentSetReplicate'] } }

            if 'bool' in active_filter and 'should' in active_filter['bool']:
                # handle No value case
                inner_bool = None
                inner_should = active_filter.get('bool').get('should', [])
                for or_term in inner_should:
                    # this may be naive, but assume first non-terms
                    # filter is the No value quqery
                    if 'terms' in or_term:
                        continue
                    else:
                        inner_bool = or_term
                        break
                if 'exists' in inner_bool:
                    compare_field = inner_bool['exists'].get('field')
                else:
                    # attempt to get the field from the alternative No value syntax
                    compare_field = inner_bool.get('bool', {}).get('must_not', {}).get('exists', {}).get('field')
                if compare_field == query_field and query_field != 'embedded.@type.raw':
                    facet_filters[filter_type].remove(active_filter)

            if 'terms' in active_filter:
                # there should only be one key here
                for compare_field in active_filter['terms'].keys():
                    # remove filter for a given field for that facet
                    # skip this for type facet (field = 'type')
                    # since we always want to include that filter.
                    if compare_field == query_field and query_field != 'embedded.@type.raw':
                        facet_filters[filter_type].remove(active_filter)

            elif 'range' in active_filter:
                for compare_field in active_filter['range'].keys():
                    # Do same as for terms
                    if compare_field == query_field:
                        facet_filters[filter_type].remove(active_filter)

    # add the string_query, if present, to the bool term with facet_filters
    if string_query and string_query['must']:
        # combine statements within 'must' for each
        facet_filters['must'].append(string_query['must'])

    return facet_filters


def fix_nested_aggregations(search, es_mapping):
    """
    Unfortunately, elasticsearch_dsl will not update_from_dict with a nested aggregation (bug?), so we must
    update the search manually after processing all the "terms". This method handles that update in place.
    It does this in 3 steps: first by overwriting the current 'agg bucket' with a empty new one, recreating the
    'primary_agg' and adding a REVERSE_NESTED bucket called 'primary_agg_reverse_nested', which will contain the
    doc count wrt the item we are searching on.

    :param search: search object
    :param es_mapping: mapping of this item
    """
    aggs_ptr = search.aggs['all_items']
    for agg in aggs_ptr:
        if NESTED in agg:
            search.aggs['all_items'] \
                  .bucket(agg, 'nested', path=find_nested_path(aggs_ptr.aggs[agg]['primary_agg'].field, es_mapping)) \
                  .bucket('primary_agg',
                          Terms(field=aggs_ptr.aggs[agg]['primary_agg'].field, size=100, missing='No value')) \
                  .bucket('primary_agg_reverse_nested', REVERSE_NESTED)


def get_query_field(field, facet):
    """
    Converts a field from its generic field name to a more specific field name referencing it's embedded nature

    :param field: generic field name, such as 'files.accession'
    :param facet: facet on this field
    :return: full path to field on ES mapping
    """
    if field == 'type':
        return 'embedded.@type.raw'
    elif field.startswith('validation_errors') or field.startswith('aggregated_items'):
        return field + '.raw'
    elif facet.get('aggregation_type') in ('stats', 'date_histogram', 'histogram', 'range'):
        return 'embedded.' + field
    else:
        return 'embedded.' + field + '.raw'


def set_facets(search, facets, search_filters, string_query, request, doc_types,
               custom_aggregations=None, size=25, from_=0, es_mapping=None):
    """
    Sets facets in the query as ElasticSearch aggregations, with each aggregation to be
    filtered by search_filters minus filter affecting facet field in order to get counts
    for other facet term options.
    ES5 - simply sets aggs by calling update_from_dict after adding them in
        :param facets:         Facet field (0) in object dot notation, and a dict or OrderedDict with title property (1).
        :type  facets:         List of tuples.
        :param search_filters: Dict of filters which are set for the ES query in set_filters
        :param string_query:   Dict holding the query_string used in the search
    """
    if from_ != 0:
        return search

    aggs = OrderedDict()
    for field, facet in facets: # E.g. 'type','experimentset_type','experiments_in_set.award.project', ...
        field_schema = schema_for_field(field, request, doc_types, should_log=True)
        is_date_field = field_schema and determine_if_is_date_field(field, field_schema)
        is_numerical_field = field_schema and field_schema['type'] in ("integer", "float", "number")
        query_field = get_query_field(field, facet)
        nested_path = find_nested_path(query_field, es_mapping)

        ## Create the aggregation itself, extend facet with info to pass down to front-end
        agg_name = field.replace('.', '-')
        if facet.get('aggregation_type') == 'stats':

            if is_date_field:
                facet['field_type'] = 'date'
            elif is_numerical_field:
                facet['field_type'] = field_schema['type'] or "number"

            aggs[facet['aggregation_type'] + ":" + agg_name] = {
                AGGS: {
                    'primary_agg': {
                        'stats': {
                            'field': query_field
                        }
                    }
                },
                FILTER: {BOOL: facet_filters}
            }

        else:
            if nested_path:
                facet['aggregation_type'] = NESTED
            else:
                facet['aggregation_type'] = TERMS

            facet_filters = generate_filters_for_terms_agg_from_search_filters(query_field, search_filters, string_query)
            term_aggregation = {
                TERMS: {
                    'size': 100,  # Maximum terms returned (default=10); see https://github.com/10up/ElasticPress/wiki/Working-with-Aggregations
                    'field': query_field,
                    'missing': facet.get("missing_value_replacement", "No value")
                }
            }
            aggs[facet['aggregation_type'] + ":" + agg_name] = {
                AGGS: {
                    'primary_agg': term_aggregation
                },
                FILTER: {BOOL: facet_filters},
            }

        # Update facet with title, description from field_schema, if missing.
        if facet.get('title') is None and field_schema and 'title' in field_schema:
            facet['title'] = field_schema['title']
        if facet.get('description') is None and field_schema and 'description' in field_schema:
            facet['description'] = field_schema['description']

    # to achieve OR behavior within facets, search among GLOBAL results,
    # not just returned ones. to do this, wrap aggs in ['all_items']
    # and add "global": {} to top level aggs query
    # see elasticsearch global aggs for documentation (should be ES5 compliant)
    search_as_dict = search.to_dict()
    search_as_dict['aggs'] = {
        'all_items': {
            'global': {},
            'aggs': aggs
        }
    }

    if size == 0:
        # Only perform aggs if size==0 requested, to improve performance for search page queries.
        # We do currently have (hidden) monthly date histogram facets which may yet to be utilized for common size!=0 agg use cases.
        set_additional_aggregations(search_as_dict, request, doc_types, custom_aggregations)

    # update with all terms aggregations
    search.update_from_dict(search_as_dict)

    # update with correct nested aggregations, see docstring
    fix_nested_aggregations(search, es_mapping)
    return search


def set_additional_aggregations(search_as_dict, request, doc_types, extra_aggregations=None):
    """
    Per-type aggregations may be defined in schemas. Apply them OUTSIDE of globals so they act on our
    current search filters. Warning: `search_as_dict` is modified IN PLACE.

    :param search_as_dict: elasticsearch_dsl object converted to_dict()
    :param request: current request
    :param doc_types: types we are searching on
    :param extra_aggregations: aggregations to add
    :return: search_as_dict, same as originally passed in, but modified in this function
    """

    types = request.registry[TYPES]
    schema = types[doc_types[0]].schema

    if schema.get('aggregations'):
        for schema_agg_name in schema['aggregations'].keys():
            if schema_agg_name == 'all_items':
                raise QueryConstructionException(
                    query_type='aggregations',
                    func='set_additional_aggregations',
                    msg='all_items is a reserved agg name and not allowed as an extra aggregation name.')
            search_as_dict['aggs'][schema_agg_name] = schema['aggregations'][schema_agg_name]

    if extra_aggregations:
        for extra_agg_name in extra_aggregations.keys():
            if extra_agg_name == 'all_items':
                raise QueryConstructionException(
                    query_type='extra_aggregations',
                    func='set_additional_aggregations',
                    msg='all_items is a reserved agg name and not allowed as an extra aggregation name.')
            search_as_dict['aggs'][extra_agg_name] = extra_aggregations[extra_agg_name]

    return search_as_dict


def execute_search(search):
    """
    Execute the given Elasticsearch-dsl search. Raise HTTPBadRequest for any
    exceptions that arise.

    :param search: the Elasticsearch-dsl prepared in the search() function
    :returns: Dictionary search results
    """
    err_exp = None
    try:
        es_results = search.execute().to_dict()
    except ConnectionTimeout as exc:
        err_exp = 'The search failed due to a timeout. Please try a different query.'
    except RequestError as exc:
        # try to get a specific error message. May fail in some cases
        try:
            err_detail = str(exc.info['error']['root_cause'][0]['reason'])
        except:
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
        err_exp = str(exc)
    if err_exp:
        raise HTTPBadRequest(explanation=err_exp)
    return es_results


def fix_and_replace_nested_doc_count(result_facet, aggregations, full_agg_name):
    """
    3 things must happen here (all occur in place):
        1. front-end does not care about 'nested', only what the inner thing is, so lets pretend (so it doesn't break)
        2. We must overwrite the "second level" doc_count with the "third level" because the "third level"
           is the 'root' level doc_count, which is what we care about, NOT the nested doc count
         3. We must then re-sort the aggregations so they show up in from greatest to least doc_count wrt the root
            level count instead of the "old" nested doc count.

    :param result_facet: facet to be created - 'aggregation_type' is overwritten as 'terms'
    :param aggregations: handle to all aggregations that we can access based on name
    :param full_agg_name: full name of the aggregation
    """
    result_facet['aggregation_type'] = 'terms'
    buckets = aggregations[full_agg_name]['primary_agg']['buckets']
    for bucket in buckets:
        if 'primary_agg_reverse_nested' in bucket:
            bucket['doc_count'] = bucket['primary_agg_reverse_nested']['doc_count']
    aggregations[full_agg_name]['primary_agg']['buckets'] = \
        sorted(buckets, key=lambda d: d['primary_agg_reverse_nested']['doc_count'], reverse=True)


def format_facets(es_results, facets, total, search_frame='embedded'):
    """
    Format the facets for the final results based on the es results.
    Sort based off of the 'order' of the facets
    These are stored within 'aggregations' of the result.

    If the frame for the search != embedded, return no facets
    """
    result = []
    if search_frame != 'embedded':
        return result

    # Loading facets in to the results
    if 'aggregations' not in es_results:
        return result

    aggregations = es_results['aggregations']['all_items']
    used_facets = set()

    # Sort facets by order (ascending).
    # If no order is provided, assume 0 to
    # retain order of non-explicitly ordered facets
    for field, facet in sorted(facets, key=lambda fct: fct[1].get('order', 0)):
        result_facet = {
            'field' : field,
            'title' : facet.get('title', field),
            'total' : 0
            # To be added depending on facet['aggregation_type']: 'terms', 'min', 'max', 'min_as_string', 'max_as_string', ...
        }

        result_facet.update({ k:v for k,v in facet.items() if k not in result_facet.keys() })
        used_facets.add(field)
        field_agg_name = field.replace('.', '-')
        full_agg_name = facet['aggregation_type'] + ':' + field_agg_name

        if full_agg_name in aggregations:
            if facet['aggregation_type'] == 'stats':
                result_facet['total'] = aggregations[full_agg_name]['doc_count']
                # Used for fields on which can do range filter on, to provide min + max bounds
                for k in aggregations[full_agg_name]["primary_agg"].keys():
                    result_facet[k] = aggregations[full_agg_name]["primary_agg"][k]
            else: # 'terms' assumed.

                # XXX: This needs to be done in case we 'continue' below, unclear why needed in that case
                # but tests will fail if its not there when expected.
                result_facet['terms'] = aggregations[full_agg_name]["primary_agg"]["buckets"]

                # Choosing to show facets with one term for summary info on search it provides
                # XXX: The above comment is misleading - this drops all facets with no buckets
                # we apparently want this for non-nested fields based on the tests, but should be
                # investigated as having to do this doesn't really make sense.
                if len(result_facet.get('terms', [])) < 1 and not facet['aggregation_type'] == 'nested':
                    continue

                # if we are nested, apply fix + replace
                if facet['aggregation_type'] == 'nested':
                    fix_and_replace_nested_doc_count(result_facet, aggregations, full_agg_name)

                # Re-add buckets under 'terms' AFTER we have fixed the doc_counts
                result_facet['terms'] = aggregations[full_agg_name]["primary_agg"]["buckets"]


                # Default - terms, range, or histogram buckets. Buckets may not be present
                result_facet['terms'] = aggregations[full_agg_name]["primary_agg"]["buckets"]
                # Choosing to show facets with one term for summary info on search it provides
                if len(result_facet.get('terms', [])) < 1:
                    continue

            if len(aggregations[full_agg_name].keys()) > 2:
                result_facet['extra_aggs'] = { k:v for k,v in aggregations[field_agg_name].items() if k not in ('doc_count', "primary_agg") }

        result.append(result_facet)

    return result

def format_extra_aggregations(es_results):
    """
    Extracts any extra aggregations results returned from elasticsearch

    :param es_results: dictionary response from es
    :return: dictionary mapping field -> agg_value, varies based on type of aggregation
    """
    if 'aggregations' not in es_results:
        return {}
    return {k: v for k, v in es_results['aggregations'].items() if k != 'all_items'}


def format_results(request, hits, search_frame):
    """
    Loads results to pass onto UI
    Will retrieve the desired frame from the search hits and automatically
    add 'validation_errors' and 'aggregated_items' frames if they are present
    """
    fields_requested = request.normalized_params.getall('field')
    if fields_requested:
        frame = 'embedded'
    elif search_frame:
        frame = search_frame
    else:
        frame = 'embedded'

    if frame in ['embedded', 'object', 'raw']:
        # transform 'raw' to 'properties', which is what is stored in ES
        if frame == 'raw':
            frame = 'properties'
        for hit in hits:
            frame_result = hit['_source'][frame]
            if 'validation_errors' in hit['_source'] and 'validation_errors' not in frame_result:
                frame_result['validation_errors'] = hit['_source']['validation_errors']
            if 'aggregated_items' in hit['_source'] and 'aggregated_items' not in frame_result:
                frame_result['aggregated_items'] = hit['_source']['aggregated_items']
            yield frame_result
        return


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
    # remove any duplicates
    indexes = list(set(indexes))
    index_string = ','.join(indexes)
    return index_string


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


def get_iterable_search_results(request, search_path='/search/', param_lists=None, **kwargs):
    '''
    Loops through search results, returns 100 (or search_results_chunk_row_size) results at a time. Pass it through itertools.chain.from_iterable to get one big iterable of results.
    TODO: Maybe make 'limit=all', and instead of calling invoke_subrequest(subrequest), instead call iter_search_results!

    :param request: Only needed to pass to do_subreq to make a subrequest with.
    :param search_path: Root path to call, defaults to /search/.
    :param param_lists: Dictionary of param:lists_of_vals which is converted to URL query.
    :param search_results_chunk_row_size: Amount of results to get per chunk. Default should be fine.
    '''
    param_lists = deepcopy(param_lists)
    param_lists['limit'] = ['all']
    param_lists['from'] = [0]
    param_lists['sort'] = param_lists.get('sort','uuid')
    subreq = make_search_subreq(request, '{}?{}'.format(search_path, urlencode(param_lists, True)) )
    return iter_search_results(None, subreq, **kwargs)


# Update? used in ./batch_download.py
def iter_search_results(context, request, **kwargs):
    return search(context, request, return_generator=True, **kwargs)

def build_table_columns(request, schemas, doc_types):

    any_abstract_types = 'Item' in doc_types
    if not any_abstract_types: # Check explictly-defined types to see if any are abstract.
        type_infos = [ request.registry[TYPES][type] for type in doc_types if type != 'Item' ]
        for ti in type_infos:
            # We use `type` instead of `isinstance` since we don't want to catch subclasses.
            if type(ti) == AbstractTypeInfo:
                any_abstract_types = True
                break

    columns = OrderedDict()

    # Add title column, at beginning always
    columns['display_title'] = {
        "title" : "Title",
        "order" : -100
    }

    # Add type column if any abstract types in search
    if any_abstract_types and request.normalized_params.get('currentAction') != 'selection':
        columns['@type'] = {
            "title" : "Item Type",
            "colTitle" : "Type",
            "order" : -80,
            "description" : "Type or category of Item",
            # Alternative below, if we want type column to be available but hidden by default in selection mode:
            # "default_hidden": request.normalized_params.get('currentAction') == 'selection'
        }

    for schema in schemas:
        if 'columns' in schema:
            schema_columns = OrderedDict(schema['columns'])
            # Add all columns defined in schema
            for name, obj in schema_columns.items():
                if name not in columns:
                    columns[name] = obj
                else:
                    # If @type or display_title etc. column defined in schema, then override defaults.
                    for prop in schema_columns[name]:
                        columns[name][prop] = schema_columns[name][prop]
                # Add description from field schema, if none otherwise.
                if not columns[name].get('description'):
                    field_schema = schema_for_field(name, request, doc_types)
                    if field_schema:
                        if field_schema.get('description') is not None:
                            columns[name]['description'] = field_schema['description']

    # Add status column, if not present, at end.
    if 'status' not in columns:
        columns['status'] = {
            "title"             : "Status",
            "default_hidden"    : True,
            "order"             : 501
        }
    # Add date column, if not present, at end.
    if 'date_created' not in columns:
        columns['date_created'] = {
            "title"             : "Date Created",
            "colTitle"          : "Created",
            "default_hidden"    : True,
            "order"             : 510
        }
    return columns

_ASSEMBLY_MAPPER = {
    'GRCh38-minimal': 'hg38',
    'GRCh38': 'hg38',
    'GRCh37': 'hg19',
    'GRCm38': 'mm10',
    'GRCm37': 'mm9',
    'BDGP6': 'dm4',
    'BDGP5': 'dm3',
    'WBcel235': 'WBcel235'
}

hgConnect = ''.join([
    'http://genome.ucsc.edu/cgi-bin/hgTracks',
    '?hubClear=',
])
