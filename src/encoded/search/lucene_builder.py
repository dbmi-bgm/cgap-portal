import re
import structlog
from copy import deepcopy
from collections import OrderedDict
from pyramid.httpexceptions import HTTPBadRequest
from urllib.parse import urlencode
from snovault import TYPES
from snovault.elasticsearch.create_mapping import determine_if_is_date_field
from .search_utils import (
    find_nested_path,  # convert_search_to_dictionary,
    QueryConstructionException,
    COMMON_EXCLUDED_URI_PARAMS, QUERY, FILTER, MUST, MUST_NOT, BOOL, MATCH, SHOULD,
    EXISTS, FIELD, NESTED, PATH, TERMS, RANGE, AGGS,  # REVERSE_NESTED,
    STATS,
    schema_for_field, get_query_field, search_log, MAX_FACET_COUNTS,
)


log = structlog.getLogger(__name__)


class LuceneBuilder:
    """ Collection of methods for working with Lucene queries. These operations can be used
        independently of the SearchBuilder state. See SearchBuilder for how these are used.

        Main points of entry:
            1. build_filters (construct the search query itself)
            2. build_facets (construct aggregations on search)
            3. verify_search_has_permissions (to be sure we did not strip permissions while building search)

        All other methods in this class are helper methods. Static methods are "leaf" operations that do
        not require additional function calls. Class methods call other methods within the class but could
        be "entry-point" methods as well.
    """
    to_from_pattern = re.compile("^(.*)[.](to|from)$")
    RANGE_DIRECTIONS = ['gt', 'gte', 'lt', 'lte']
    SMALLEST_NONZERO_IEEE_32 = 1.1754e-38  # smallest epsilon > 0 (estimate)
    SMALLEST_NEGATIVE_IEEE_32 = -3.4028e38
    # ref: http://www.cs.uwm.edu/classes/cs315/Bacon/Lecture/HTML/ch04s17.html
    # 1.00000000000000000000001 x 2^-127 = 1.1754e-38

    @staticmethod
    def apply_range_filters(range_filters, must_filters, es_mapping):
        """
        Applies the range filters to the 'must' subquery
        Tuple format is required to handle nested fields that are non-range (it is discarded in this case)
        Nested range fields must also be separated from other nested sub queries - see comment in handle_nested_filters
        Modifies must_filters in place

        :param range_filters: intermediary range_filter format to be converted to valid lucene
        :param must_filters: must_filters from build_sub_queries, this is where range filters are applied
        :param es_mapping: mapping of the item we searching on, as the range filter could be on a nested field
        """

        # tuple format is required to handle nested fields that are non-range (it is discarded in this case)
        # nested range fields must also be separated from other nested sub queries - see comment in 'handle_nested_filters'
        for range_field, range_def in range_filters.items():
            nested_path = find_nested_path(range_field, es_mapping)
            range_query = {RANGE: {range_field: range_def}}
            if 'add_no_value' in range_def:
                del range_def['add_no_value']
                range_query = {
                    BOOL: {
                        SHOULD: [
                            range_query,
                            {BOOL: {MUST_NOT: {EXISTS: {FIELD: range_field}}}}
                        ]
                    }
                }
            if nested_path:
                # look for existing nested sub query - must add to it if it exists
                found = False
                for query_part in must_filters:
                    nested_queries = query_part.get(BOOL, {}).get(MUST, {})
                    for query in nested_queries:
                        if NESTED in query and query[NESTED][PATH] == nested_path:
                            query[NESTED][QUERY][BOOL][MUST].append(range_query)
                            found = True
                            break  # if we found a valid path, add it here and continue
                # if we never found a path, this is the only nested query on that path, so just add it as is
                if not found:
                    new_nested_query = {
                        NESTED: {
                            PATH: nested_path,
                            QUERY: range_query
                        }
                    }
                    must_filters.append(new_nested_query)
            else:
                must_filters.append(range_query)

    @staticmethod
    def handle_should_query(field_name, options):
        """
        Builds a lucene 'should' subquery for every option for the given field

        :param field_name: full path to field
        :param options: list of options for that field
            ex: field_name='embedded.files.file_size.raw', options=[20, 30, 40]

        :return: dsl-subquery that is effectively an OR of all options on the field. See SHOULD.
        """
        should_query = {BOOL: {SHOULD: {TERMS: {field_name: options}}}}
        return should_query

    @classmethod
    def build_sub_queries(cls, field_filters, es_mapping):
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
            nested_path = find_nested_path(query_field, es_mapping)
            if nested_path is not None:
                query_field = query_field.replace('.properties', '')
                strip_raw = query_field.replace('.raw', '')

                # if we are searching on the nested field itself, we must do something "special"
                if nested_path == strip_raw:
                    query_field = strip_raw

                    # if searching on 'No Value' on a nested field, the query has to be written
                    # slightly differently - note that you cannot combine a 'No value' search with
                    # anything else on this field path
                    if filters['add_no_value'] is True:
                        should_arr = [{EXISTS: {FIELD: query_field}}]
                        must_not_filters_nested.append((query_field, should_arr))
                        continue

                # Build must/must_not sub-queries
                # Example:
                # {'bool': {'must': {'bool':
                #   {'should': [{'match': {'embedded.hg19.hg19_hgvsg.raw': 'NC_000001.11:g.12185956del'}},
                #               {'match': {'embedded.hg19.hg19_hgvsg.raw': 'NC_000001.11:g.11901816A>T'}}
                #               ]}}}}
                # This is a "normal" query that we must convert to a "nested" sub-query on nested_path
                must_terms = cls.construct_nested_sub_queries(query_field, filters, key='must_terms')
                must_not_terms = cls.construct_nested_sub_queries(query_field, filters, key='must_not_terms')

                # XXX: In ES6, MUST -> MUST_NOT EXISTS does not work - have to use EXISTS under MUST_NOT
                # This means you cannot search on field=value or field DNE
                if filters['add_no_value'] is True:  # when searching on 'No Value'
                    should_arr = [must_not_terms] if must_not_terms else []
                    should_arr.append({BOOL: {MUST: {EXISTS: {FIELD: query_field}}}})  # field=value OR field DNE
                    must_not_filters_nested.append((query_field, should_arr))
                    if must_terms:
                        must_filters_nested.append((query_field, must_terms))
                else:  # when not searching on 'No Value'
                    should_arr = [must_terms] if must_terms else []
                    should_arr.append({EXISTS: {FIELD: query_field}})   # field=value OR field EXISTS
                    must_filters_nested.append((query_field, should_arr))
                    if must_not_terms:
                        must_not_filters_nested.append((query_field, must_not_terms))

            # if we are not nested, handle this with 'terms' query like usual
            else:
                must_terms = {TERMS: {query_field: filters['must_terms']}} if filters['must_terms'] else {}
                must_not_terms = {TERMS: {query_field: filters['must_not_terms']}} if filters['must_not_terms'] else {}
                if filters['add_no_value'] is True:
                    # add to must_not in an OR case, which is equivalent to filtering on 'No value'
                    should_arr = [must_terms] if must_terms else []
                    should_arr.append({BOOL: {MUST_NOT: {EXISTS: {FIELD: query_field}}}})  # field=value OR field DNE
                    must_filters.append((query_field, {BOOL: {SHOULD: should_arr}}))
                elif filters['add_no_value'] is False:
                    # add to must_not in an OR case, which is equivalent to filtering on '! No value'
                    should_arr = [must_terms] if must_terms else []
                    should_arr.append({EXISTS: {FIELD: query_field}})  # field=value OR field EXISTS
                    must_filters.append((query_field, {BOOL: {SHOULD: should_arr}}))
                elif must_terms:  # no filtering on 'No value'
                    must_filters.append((query_field, must_terms))
                if must_not_terms:
                    must_not_filters.append((query_field, must_not_terms))

        return must_filters, must_not_filters, must_filters_nested, must_not_filters_nested

    @staticmethod
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
        my_filters = filters.get(key, [])
        if len(my_filters) == 0:
            return {}
        elif len(my_filters) == 1:  # see standard bool/match query
            return {MATCH: {query_field: my_filters[0]}}
        else:
            sub_queries = {BOOL: {SHOULD: []}}  # combine all options under SHOULD
            for option in my_filters:
                sub_queries[BOOL][SHOULD].append({MATCH: {query_field: option}})
            return sub_queries

    @classmethod
    def extract_field_from_to(cls, query_part):
        """ Neat helper method provided by Kent to clean up a step in 'handle_range_filters'.
            Extracts the field_name and whether it is a 'from' or 'to' query

        :param query_part: query part to parse, such as "field.a.from" or "field.to". See the regexp.
        :return: 3-tuple consisting of whether or not there was a match, the first grouping and the second grouping
                 ie: (True, field.name, 'from')
        """
        match = cls.to_from_pattern.match(query_part)
        if match is not None:
            return bool(match), match.group(1), match.group(2)
        return False, None, None

    @classmethod
    def canonicalize_bounds(cls, range_filter):
        """ Canonicalizes the bounds of the range filter such that they are
            inclusive on the lower bound and exclusive on the upper bound.
        """
        lower, upper = -1e38, 1e38  # very large numbers that should never be in range
        for direction, pivot in range_filter.items():
            pivot = float(pivot)
            if direction == 'lte':
                upper = pivot + cls.SMALLEST_NONZERO_IEEE_32
            elif direction == 'lt':
                upper = pivot
            elif direction == 'gte':
                lower = pivot
            elif direction == 'gt':
                lower = pivot - cls.SMALLEST_NONZERO_IEEE_32
        return lower, upper

    @classmethod
    def range_includes_zero(cls, range_filter):
        """ Returns True if the given range_filter includes the value 0. """
        lower, upper = cls.canonicalize_bounds(range_filter)
        return lower <= 0 <= upper

    @classmethod
    def handle_range_filters(cls, request, result, field_filters, doc_types):
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
            field_schema = {}
            if field == 'q' or field in COMMON_EXCLUDED_URI_PARAMS:
                continue
            elif field == 'type' and term != 'Item':
                continue
            elif term == 'No value':
                exists_field = True

            # Check for date or numerical range filters
            is_range, f_field, which = cls.extract_field_from_to(field)
            if is_range:
                if which == 'to':
                    range_direction = 'lte'
                else:
                    range_direction = 'gte'

                # If schema for field is not found (and range_type thus not set),
                # then treated as ordinary term filter (likely will get 0 results)
                field_schema = schema_for_field(f_field, request, doc_types)
                if field_schema:
                    range_type = 'date' if determine_if_is_date_field(f_field, field_schema) else 'numerical'

            # Add filter to result
            qs = urlencode([
                (k.encode('utf-8'), v.encode('utf-8'))
                for k, v in request.normalized_params.items()
                if k != "limit" and k != "from" and not (k == field and v == term)
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

                if range_direction in cls.RANGE_DIRECTIONS:
                    if range_type == "date" and len(term) == 10:  # TODO: refactor to use regex -Will 06/24/2020
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

                # Check if schema requests no value
                if 'items' in field_schema:  # we are searching on an array of numerics
                    field_schema = field_schema['items']
                if field_schema.get('add_no_value', False) and cls.range_includes_zero(range_filters[query_field]):
                    range_filters[query_field]['add_no_value'] = True

            # add these to field_filters directly, handle later with build_sub_queries
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

    @staticmethod
    def initialize_field_filters(request, principals, doc_types):
        """ Helper function for build_filters
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

    @staticmethod
    def build_nested_query(nested_path, query):
        """ Takes the given query and converts it into a nested query on the
            given path.
        """
        return {
            NESTED: {
                PATH: nested_path,
                QUERY: query
            }
        }

    @classmethod
    def handle_nested_filters_v2(cls, must_nested_filters, must_not_nested_filters, es_mapping):
        """ This function implements nested query construction.

            When building a nested query, unlike with traditional queries, selections on the same
            field must occur in the same nested sub-query in order to be applied as an intersect
            condition on the object field. Previously we would create separate nested sub-queries
            per field selection, which causes them to be OR'd.

            :param must_nested_filters: conditions filtered on in the affirmative
            :param must_not_nested_filters: conditions filtered on in the negative
            :param es_mapping: the ES mapping of the type we are searching on
            :returns: a nested sub-query that can be added directly to the parent query
        """
        # Build base query structure
        # always use MUST + sub queries for MUST_NOT
        nested_query = {
            BOOL: {
                MUST: [],
                MUST_NOT: [],
            }
        }

        # Maps a nested path to a 2-tuple of it's key (must/must_not) and index
        nested_path_to_index_map = {}

        # Build array of key, (field, query) so we can process the filters in a single pass
        # note that MUST queries are always processed first
        filters_to_work_on = []
        if must_nested_filters:
            filters_to_work_on += zip([MUST] * len(must_nested_filters), must_nested_filters)
        if must_not_nested_filters:
            filters_to_work_on += zip([MUST_NOT] * len(must_not_nested_filters), must_not_nested_filters)

        # Process key (must/must_not), field (target of search), query (condition)
        # iteratively building nested_query
        for key, (field, query) in filters_to_work_on:
            nested_path = find_nested_path(field, es_mapping)

            # if we've never seen this path before, bootstrap a sub-query for it
            if nested_path not in nested_path_to_index_map:

                # set in tracking, note it is order dependent
                new_index = len(nested_query[BOOL][key])
                nested_path_to_index_map[nested_path] = (key, new_index)

                # this nested path could have more filters (under differing keys)
                # bootstrap an entire sub-query for this path
                combined_query = {
                    BOOL: {
                        MUST: [],
                        MUST_NOT: []
                    }
                }
                for sub_query in query:
                    # Special case for EXISTS, since we cannot construct these like normal
                    # queries - add DOES NOT EXIST queries to MUST branches, as these are
                    # automatically added to MUST_NOT branch
                    if EXISTS in sub_query and key == MUST_NOT:
                        combined_query[BOOL][MUST].append(sub_query)
                    elif sub_query.get(BOOL, {}).get(MUST, {}).get(EXISTS, None):
                        combined_query[BOOL][MUST].append(sub_query)
                    else:
                        combined_query[BOOL][key].append(sub_query)

                # add the combined_query for this nested path to the global nested query
                nested_query[BOOL][key].append(cls.build_nested_query(nested_path, combined_query))

            # We have seen this nested_path before, so in order to achieve proper intersect
            # behavior all conditions must be present on the same nested sub-query
            else:

                # extract the location of the nested query we would like to add to
                # note that the key under which the previous query was added could differ
                # from the key we are seeing now ie: EXIST (must) combined with != (must_not)
                prev_key, path_index = nested_path_to_index_map[nested_path]
                leaf_query = nested_query[BOOL][prev_key][path_index][NESTED][QUERY][BOOL][key]

                # leaf_query is the sub-query we want to build off of
                # its possible our current query contains multiple conditions
                if isinstance(query, list):
                    leaf_query += query
                elif isinstance(query, dict):
                    leaf_query.append(query)
                else:
                    raise QueryConstructionException(
                        query_type='nested',
                        func='handle_nested_filters_v2',
                        msg='passed a query with a bad type: %s' % query
                    )

        return nested_query

    @classmethod
    def build_filters(cls, request, query, result, principals, doc_types, es_mapping):
        """
        This function builds the Elasticsearch query based on the request. The structure of the query
        is approximately represented below. 'Approximate' because you could not copy-paste directly into
        Lucene, but should illustrate enough so it is comprehensible. Note the 'nested' nature of the query.

        QUERY HIERARCHY ('approximate' lucene syntax):
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
        :param query: Current search query body
        :param result: Response to be returned from the view ('/search')
        :param principals: Active user roles
        :param doc_types: Document type we are searching on
        :param es_mapping: Elasticsearch mapping of the document type we're searching on
        :returns: 2-tuple containing the updated search based on the request parameters and
                  information on the filters used in the query.
        """

        # these next two dictionaries should each have keys equal to query_field
        # and values: must_terms: [<list of terms>], must_not_terms: [<list of terms>], add_no_value: True/False/None
        field_filters = cls.initialize_field_filters(request, principals, doc_types)
        range_filters = cls.handle_range_filters(request, result, field_filters, doc_types)

        # construct queries
        must_filters, must_not_filters, \
        must_filters_nested, must_not_filters_nested = cls.build_sub_queries(field_filters, es_mapping)

        # initialize filter hierarchy
        final_filters = {BOOL: {MUST: [f for _, f in must_filters], MUST_NOT: [f for _, f in must_not_filters]}}

        # Build nested queries
        final_nested_query = cls.handle_nested_filters_v2(must_filters_nested, must_not_filters_nested, es_mapping)
        final_filters[BOOL][MUST].append(final_nested_query)

        # add range filters after (so nested ranges can be applied with existing nested queries)
        cls.apply_range_filters(range_filters, final_filters[BOOL][MUST], es_mapping)

        # at this point, final_filters is valid lucene and can be dropped into the query directly
        query[QUERY][BOOL][FILTER] = final_filters
        return query, final_filters

    @staticmethod
    def _check_and_remove(compare_field, facet_filters, active_filter, query_field, filter_type):
        """ Does the actual 'check and removal' since this code is duplicated throughout. """
        if compare_field == query_field:
            facet_filters[filter_type].remove(active_filter)
            return True
        return False

    @classmethod
    def _check_and_remove_terms(cls, facet_filters, active_filter, query_field, filter_type):
        """ Helper function for _remove_from_active_filters that handles filter removal for terms query """
        # there should only be one key here
        for compare_field in active_filter[TERMS].keys():
            # remove filter for a given field for that facet
            # skip this for type facet (field = 'type')
            # since we always want to include that filter.
            if (query_field != 'embedded.@type.raw' and  # this evaluation order MUST be preserved!
                    cls._check_and_remove(compare_field, facet_filters, active_filter, query_field, filter_type)):
                break

    @classmethod
    def _check_and_remove_range(cls, facet_filters, active_filter, query_field, filter_type):
        """ Helper function for _remove_from_active_filters that handles filter removal for terms query """
        for compare_field in active_filter[RANGE].keys():
            if cls._check_and_remove(compare_field, facet_filters, active_filter, query_field, filter_type):
                break

    @classmethod
    def _check_and_remove_bool_should(cls, facet_filters, active_filter, query_field, filter_type):
        """ Helper function for _remove_from_active_filters that handles filter removal for boolean queries that
            have multiple options (inner SHOULD query)
        """
        # handle No value case
        inner_bool = None
        inner_should = active_filter.get(BOOL).get(SHOULD, [])
        for or_term in inner_should:
            # this may be naive, but assume first non-terms
            # filter is the No value query
            if TERMS in or_term or RANGE in or_term:
                continue
            else:
                inner_bool = or_term
                break
        if EXISTS in inner_bool:
            compare_field = inner_bool[EXISTS].get(FIELD)
        else:
            # attempt to get the field from the alternative No value syntax
            compare_field = inner_bool.get(BOOL, {}).get(MUST_NOT, {}).get(EXISTS, {}).get(FIELD)
        if query_field != 'embedded.@type.raw':
            cls._check_and_remove(compare_field, facet_filters, active_filter, query_field, filter_type)

    @classmethod
    def _check_and_remove_match_from_should(cls, query_options, facet_filters, active_filter, query_field,
                                            filter_type):
        """ Helper function that searches a MATCH query for the given query_field, removing the
            active filter if found.
        """
        for inner_query in query_options:
            if MATCH in inner_query:
                for field in inner_query.get(MATCH, {}).keys():  # should be only one per block
                    if cls._check_and_remove(field, facet_filters, active_filter, query_field,
                                             filter_type):
                        return
            else:
                search_log(log_handler=log, msg='Encountered a unexpected nested structure in '
                                                'query: %s' % inner_query)

    @classmethod
    def _check_and_remove_nested(cls, facet_filters, active_filter, query_field, filter_type):
        """ Helper function for _remove_from_active_filters that handles filter removal for nested query
            Reminder that this code is responsible for constructing the aggregation filter, hence the desire
            to omit selections on the field we are aggregating on.
        """
        nested_sub_query = active_filter[NESTED][QUERY]

        # For No value searches
        if EXISTS in nested_sub_query:
            field = nested_sub_query.get(EXISTS, {}).get(FIELD)
            cls._check_and_remove(field, facet_filters, active_filter, query_field, filter_type)

        # For all other searches
        elif BOOL in nested_sub_query:
            for inner_filter_type in [MUST, MUST_NOT]:
                for nested_option in nested_sub_query[BOOL].get(inner_filter_type, []):
                    if isinstance(nested_option, dict):

                        # For structure like this:
                        #   {'bool': {'must': [{'match': {'embedded.hg19.hg19_hgvsg.raw': 'NC_000001.11:g.12185956del'}]
                        if MATCH in nested_option:
                            for field in nested_option.get(MATCH, {}).keys():  # should only be one per block
                                if cls._check_and_remove(field, facet_filters, active_filter, query_field, filter_type):
                                    break

                        # For structure like this:
                        # {'bool': {'should':
                        # [{'match': {'embedded.variant.genes.genes_most_severe_consequence.coding_effect.raw':
                        #       'Missense'}},
                        # {'match': {'embedded.variant.genes.genes_most_severe_consequence.coding_effect.raw':
                        #       'Synonymous'}}]}}
                        elif BOOL in nested_option:
                            inner_inner_bool = nested_option[BOOL]
                            if SHOULD in inner_inner_bool:
                                cls._check_and_remove_match_from_should(inner_inner_bool[SHOULD], facet_filters,
                                                                        active_filter,
                                                                        query_field, filter_type)

                    # For structure like this:
                    #   {'bool': {'must': {'bool': {'should':
                    #       [{'match': {'embedded.hg19.hg19_hgvsg.raw': 'NC_000001.11:g.12185956del'}},
                    #       {'match': {'embedded.hg19.hg19_hgvsg.raw': 'NC_000001.11:g.11901816A>T'}}]}}}}
                    elif isinstance(nested_option, str):
                        inner_bool = nested_sub_query[BOOL].get(inner_filter_type, {})
                        if SHOULD in inner_bool:
                            cls._check_and_remove_match_from_should(inner_bool[SHOULD], facet_filters, active_filter,
                                                                    query_field, filter_type)

                        # For structure like this:
                        # {'bool': {'should': [
                        #    {'match': {'embedded.variant.genes.genes_most_severe_consequence.impact.raw': 'MODIFIER'}},
                        #    {'match': {'embedded.variant.genes.genes_most_severe_consequence.impact.raw': 'LOW'}}]}}
                        elif BOOL in inner_bool:
                            inner_inner_bool = inner_bool[BOOL]
                            if SHOULD in inner_inner_bool:
                                cls._check_and_remove_match_from_should(inner_inner_bool[SHOULD], facet_filters, active_filter,
                                                                        query_field, filter_type)

                    else:
                        search_log(log_handler=log, msg='Encountered a unexpected nested structure at top level: %s'
                                                        % nested_sub_query[BOOL])

    @classmethod
    def _remove_from_active_filters(cls, facet_filters, query_field, active_filter, filter_type):
        """ Helper function for generate_filters_for_terms_agg_from_search_filters
            Modifies facet_filters in place to remove the active_filter if it matches
            the given query field.
            This function is intended to be called on every "sub part" of the base query
            for every aggregation.

            TODO: Optimize this - it is inefficient application side regardless of the dominating ES cost

            :param facet_filters: intended filter block to be used on the aggregation
            :param query_field: field that we are aggregating on
            :param active_filter: which "sub part" of the facet filters we are examining
            :param filter_type: one of MUST or MUST_NOT
        """
        if BOOL in active_filter and SHOULD in active_filter[BOOL]:
            cls._check_and_remove_bool_should(facet_filters, active_filter, query_field, filter_type)
        elif TERMS in active_filter:
            cls._check_and_remove_terms(facet_filters, active_filter, query_field, filter_type)
        elif RANGE in active_filter:
            cls._check_and_remove_range(facet_filters, active_filter, query_field, filter_type)
        elif NESTED in active_filter:
            cls._check_and_remove_nested(facet_filters, active_filter, query_field, filter_type)

    @classmethod
    def generate_filters_for_terms_agg_from_search_filters(cls, query_field, search_filters, string_query):
        """
        We add a copy of our filters to each facet, minus that of
        facet's field itself so that we can get term counts for other terms filters.
        And be able to filter w/ it.
        Remove filters from fields they apply to.
        For example, the 'biosource_type' aggs should not have any
        biosource_type filter in place.
        Handle 'must' and 'must_not' filters separately

        :param query_field: field terms agg is on
        :param search_filters: intermediary format prior to any valid lucene representing the search_filters
                               from the front-end
        :param string_query: query string if provided
        :return: Copy of search_filters, minus filter for current query_field (if one set).
        """
        if not search_filters or BOOL not in search_filters:  # a sane default if this happens -Will 11/17/20
            log.error('Encountered an unexpected query format: %s' % search_filters)
            return {BOOL: {MUST: [{TERMS: {'principals_allowed.view': ['system.Everyone']}}]}}

        facet_filters = deepcopy(search_filters[BOOL])

        for filter_type in [MUST, MUST_NOT]:
            # active_filter => e.g. { 'terms' : { 'embedded.@type.raw': ['ExperimentSetReplicate'] } }
            for active_filter in search_filters[BOOL][filter_type]:
                cls._remove_from_active_filters(facet_filters, query_field, active_filter, filter_type)

        # add the string_query, if present, to the bool term with facet_filters
        if string_query and string_query[MUST]:
            # combine statements within 'must' for each
            facet_filters[MUST].append(string_query[MUST])

        return {BOOL: facet_filters}

    @staticmethod
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

    @staticmethod
    def _build_nested_aggregation(sub_query, nested_path, requested=None):
        """ Builds a nested aggregation.

            :param sub_query: query to use as the 'primary_agg'
            :param nested_path: path to nested object we are searching on
            :param requested: requested agg, if any
            :returns: the nested form of sub_query
        """
        if requested:
            return {
                NESTED: {
                    PATH: nested_path
                },
                AGGS: {
                    'primary_agg': sub_query,
                    'requested_agg': requested
                }
            }
        else:
            return {
                NESTED: {
                    PATH: nested_path
                },
                AGGS: {
                    'primary_agg': sub_query
                }
            }

    @classmethod
    def _add_stats_aggregation(cls, field, facet, field_schema, query_field, search_filters, string_query,
                               nested_path, aggs, agg_name):
        """ Builds a stats aggregation, adding it to the given aggs.

            :param field: raw field name we are searching on (ex: AF)
            :param facet: facet metadata
            :param field_schema: schema for the field we are searching on
            :param query_field: ES document field we are searching on (ex: embedded.AF)
            :param search_filters: filters we are searching on
            :param string_query: simple query string if specified
            :param nested_path: path to nested object we are aggregating on
            :param aggs: the aggregation object we are building
            :param agg_name: name of the aggregation we are building
        """
        is_date_field = field_schema and determine_if_is_date_field(field, field_schema)
        is_numerical_field = field_schema and field_schema['type'] in ("integer", "float", "number")
        if is_date_field:
            facet['field_type'] = 'date'
        elif is_numerical_field:
            facet["field_type"] = field_schema['type'] or "number"
            if "number_step" not in facet:
                if "number_step" in field_schema:
                    facet["number_step"] = field_schema['number_step']
                elif facet["field_type"] == "integer":
                    facet["number_step"] = 1
                else:  # Default
                    facet["number_step"] = "any"
        facet_filters = cls.generate_filters_for_terms_agg_from_search_filters(query_field, search_filters,
                                                                               string_query)
        # stats aggregations could be nested too
        stats_agg = {
            STATS: {
                'field': query_field
            }
        }
        if nested_path:
            facet['aggregation_type'] = 'nested:stats'
            aggs[facet['aggregation_type'] + ':' + agg_name] = {
                AGGS: {
                    'primary_agg': cls._build_nested_aggregation(stats_agg, nested_path)
                },
                FILTER: facet_filters
            }

        else:
            aggs[facet['aggregation_type'] + ":" + agg_name] = {
                AGGS: {
                    'primary_agg': stats_agg
                },
                FILTER: facet_filters
            }

    @classmethod
    def _build_range_aggregation(cls, query_field, ranges):
        """ Builds a range aggregation.
            Detects when 0-0 range is specified and replaces 'to' with the
            smallest IEEE 32 value such that the bucket effectively only captures
            the value 0.
        """
        for r in ranges:
            if 'from' in r and 'to' in r:
                if r['from'] == 0 and r['to'] == 0:
                    r['to'] = cls.SMALLEST_NONZERO_IEEE_32
            if 'to' in r and r['to'] != cls.SMALLEST_NONZERO_IEEE_32:
                r['to'] += cls.SMALLEST_NONZERO_IEEE_32
        return {
            RANGE: {
                FIELD: query_field,
                'ranges': ranges
            }
        }

    @classmethod
    def _add_range_aggregation(cls, facet, query_field, search_filters, string_query, nested_path, aggs, agg_name):
        """ Builds a range aggregation utilizing the ranges defined on schema facet, adding it to the given aggs.

            :param facet: facet metadata
            :param query_field: field we are searching on.
            :param search_filters: filters we are searching on
            :param string_query: simple query string if specified
            :param nested_path: path to nested object we are aggregating on
            :param aggs: the aggregation object we are building
            :param agg_name: name of the aggregation we are building
        """
        facet_filters = cls.generate_filters_for_terms_agg_from_search_filters(query_field, search_filters,
                                                                               string_query)
        ranges = [{k: v for k, v in r.items() if k in ['from', 'to']} for r in facet['ranges']]
        range_agg = cls._build_range_aggregation(query_field, ranges)
        if nested_path:
            facet['aggregation_type'] = 'nested:range'
            field = facet['aggregation_type'] + ':' + agg_name
            range_agg = cls._build_nested_aggregation(range_agg, nested_path)
        else:
            facet['aggregation_type'] = RANGE
            field = facet['aggregation_type'] + ':' + agg_name
        aggs[field] = {
            AGGS: {
                'primary_agg': range_agg
            },
            FILTER: facet_filters
        }

    @staticmethod
    def _build_terms_aggregation(query_field, facet, requested_values=None, nested=False):
        """ Builds a terms aggregation, specifically requesting counts for any selected values. """
        agg = {
            TERMS: {
                'size': MAX_FACET_COUNTS,
                'field': query_field,
                'missing': facet.get('missing_value_replacement', 'No value')
            }
        }
        if requested_values:  # getall returns [], not None
            agg[TERMS]['include'] = requested_values
        if nested:
            agg[AGGS] = {
                'primary_agg_reverse_nested': {
                    'reverse_nested': {}
                }
            }
        return agg

    @classmethod
    def _add_terms_aggregation(cls, facet, query_field, search_filters, string_query, nested_path, aggs, agg_name,
                               requested_values):
        """ Builds a standard terms aggregation, setting a nested identifier to be repaired later
            by elasticsearch_dsl, adding it to the given aggs.

            :param facet: facet metadata
            :param query_field: field we are searching on.
            :param search_filters: filters we are searching on
            :param string_query: simple query string if specified
            :param nested_path: path to nested object we are aggregating on
            :param aggs: the aggregation object we are building
            :param agg_name: name of the aggregation we are building
            :param requested_values: values for this terms agg we requested (to be explicitly included)
        """
        is_nested = nested_path is not None
        if is_nested:
            facet['aggregation_type'] = NESTED  # special in that it is used to identify (broken) facets - Will 11/17/20
        else:
            facet['aggregation_type'] = TERMS

        facet_filters = cls.generate_filters_for_terms_agg_from_search_filters(query_field, search_filters,
                                                                               string_query)
        terms_aggregation = cls._build_terms_aggregation(query_field, facet, None, is_nested)

        # NOTE: if we requested values for this field, we must expand to do two aggregations
        # Unfortunately when you pass "include" to a terms aggregation it acts as a hard filter,
        # not a "force bucket", which makes implementing this very tricky. To get around this we
        # expand to 2 aggregations - one for the requested field and one for the remaining top fields
        if requested_values:
            terms_aggregation_requested = cls._build_terms_aggregation(query_field, facet, requested_values,
                                                                       is_nested)
            if nested_path:
                aggs[facet['aggregation_type'] + ":" + agg_name] = {
                    AGGS: {'primary_agg':
                               cls._build_nested_aggregation(terms_aggregation, nested_path,
                                                             terms_aggregation_requested),
                    },
                    FILTER: facet_filters,
                }
            else:
                aggs[facet['aggregation_type'] + ":" + agg_name] = {
                    AGGS: {
                        'primary_agg': terms_aggregation_requested,
                        'requested_agg': terms_aggregation
                    },
                    FILTER: facet_filters,
                }

        else:
            if nested_path:
                aggs[facet['aggregation_type'] + ":" + agg_name] = {
                    AGGS: {'primary_agg':
                               cls._build_nested_aggregation(terms_aggregation, nested_path),
                    },
                    FILTER: facet_filters,
                }
            else:
                aggs[facet['aggregation_type'] + ":" + agg_name] = {
                    AGGS: {
                        'primary_agg': terms_aggregation
                    },
                    FILTER: facet_filters,
                }

    @classmethod
    def build_facets(cls, query, facets, search_filters, string_query, request, doc_types,
                     custom_aggregations=None, size=25, from_=0, es_mapping=None):
        """
        Sets facets in the query as ElasticSearch aggregations, with each aggregation to be
        filtered by search_filters minus filter affecting facet field in order to get counts
        for other facet term options.
        ES5 - simply sets aggs by calling update_from_dict after adding them in
            :param facets:         Facet field (0) in object dot notation, and a dict or OrderedDict with title property (1).
            :type  facets:         List of tuples.
            :param search_filters: Dict of filters which are set for the ES query in build_filters
            :param string_query:   Dict holding the query_string used in the search
        """
        if from_ != 0:
            return query

        aggs = OrderedDict()
        for field, facet in facets:  # E.g. 'type','experimentset_type','experiments_in_set.award.project', ...
            field_schema = schema_for_field(field, request, doc_types, should_log=True)
            query_field = get_query_field(field, facet)
            nested_path = find_nested_path(query_field, es_mapping)
            requested_values = request.params.getall(field)

            # Build the aggregation based on its type (by side-effect) - stats, range or terms
            agg_name = field.replace('.', '-')
            facet_type = facet.get('aggregation_type')
            if facet_type in ['stats', 'nested:stats']:
                cls._add_stats_aggregation(field, facet, field_schema, query_field, search_filters, string_query,
                                           nested_path, aggs, agg_name)
            elif facet_type in ['range', 'nested:range']:
                cls._add_range_aggregation(facet, query_field, search_filters, string_query, nested_path,
                                           aggs, agg_name)
            else:  # assume terms
                cls._add_terms_aggregation(facet, query_field, search_filters, string_query, nested_path,
                                           aggs, agg_name, requested_values)

            # Update facet with title, description from field_schema, if missing.
            if facet.get('title') is None and field_schema and 'title' in field_schema:
                facet['title'] = field_schema['title']
            if facet.get('description') is None and field_schema and 'description' in field_schema:
                facet['description'] = field_schema['description']

        # to achieve OR behavior within facets, search among GLOBAL results,
        # not just returned ones. to do this, wrap aggs in ['all_items']
        # and add "global": {} to top level aggs query
        # see elasticsearch global aggs for documentation (should be ES5 compliant)
        query['aggs'] = {
            'all_items': {
                'global': {},
                'aggs': aggs
            }
        }

        if size == 0:
            # Only perform aggs if size==0 requested, to improve performance for search page queries.
            # We do currently have (hidden) monthly date histogram facets which may yet to be utilized for common size!=0 agg use cases.
            cls.set_additional_aggregations(query, request, doc_types, custom_aggregations)

        return query

    @staticmethod
    def verify_search_has_permissions(request, query):
        """
        Inspects the search object to ensure permissions are still present on the query
        This method depends on the query structure defined in 'build_filters'.

        :param request: the current request
        :param query: search query object to inspect
        :raises: HTTPBadRequest if permissions not present
        """
        effective_principals_on_query = None
        found = False  # set to True if we found valid 'principals_allowed.view'
        try:
            for boolean_clause in [query['query']['bool']['filter']]:  # should always be present
                if 'bool' in boolean_clause and 'must' in boolean_clause['bool']:  # principals_allowed.view is on 'must'
                    possible_permission_block = boolean_clause['bool']['must']
                    for entry in possible_permission_block:
                        if 'terms' in entry:
                            if 'principals_allowed.view' in entry['terms']:
                                effective_principals_on_query = entry['terms']['principals_allowed.view']
                                if effective_principals_on_query != request.effective_principals:
                                    raise QueryConstructionException(
                                        query_type='principals',
                                        func='verify_search_has_permissions',
                                        msg='principals_allowed was modified - see application logs')
                                else:
                                    found = True
                                    break
        except QueryConstructionException:
            search_log(log_handler=log, msg='Detected URL query param manipulation, principals_allowed.view was'
                                            ' modified from %s to %s' % (request.effective_principals,
                                                                         effective_principals_on_query))
            raise HTTPBadRequest('The search failed - the DCIC team has been notified.')
        except KeyError:
            search_log(log_handler=log, msg='Malformed query detected while checking for principals_allowed')
            raise HTTPBadRequest('The search failed - the DCIC team has been notified.')
        if not found:
            search_log(log_handler=log, msg='Did not locate principals_allowed.view on search query body: %s'
                                            % query)
            raise HTTPBadRequest('The search failed - the DCIC team has been notified.')

    @classmethod
    def compound_search(cls, sub_queries, intersect=False):
        """  Takes an array of sub-queries and merges them into one query

        :param sub_queries: list of query to be combined, typically starting with "bool"
        :param intersect: whether or not to intersect the sub-queries
        :return: lucene query combining the sub_queries with OR
        """
        if not intersect:
            key = SHOULD
        else:
            key = MUST

        query = {
            'query': {
                'bool': {
                    key: []
                }
            }
        }
        for q in sub_queries:
            query['query']['bool'][key].append(q)
        return query
