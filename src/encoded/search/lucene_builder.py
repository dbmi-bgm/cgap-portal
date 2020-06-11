import structlog
from copy import deepcopy
from collections import OrderedDict
from elasticsearch_dsl.aggs import Terms
from pyramid.httpexceptions import HTTPBadRequest
from urllib.parse import urlencode
from snovault import (
    TYPES,
)
from snovault.elasticsearch.create_mapping import determine_if_is_date_field
from encoded.search.search_utils import (find_nested_path,
                                         convert_search_to_dictionary,
                                         QueryConstructionException,
                                         COMMON_EXCLUDED_URI_PARAMS,
                                         QUERY, FILTER, MUST, MUST_NOT, BOOL, MATCH, SHOULD,
                                         EXISTS, FIELD, NESTED, PATH, TERMS, RANGE, AGGS, REVERSE_NESTED,
                                         schema_for_field, get_query_field)


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

    @staticmethod
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
            if find_nested_path(query_field, es_mapping):
                query_field = query_field.replace('.properties', '')

                # Build must/must_not sub-queries
                must_terms = cls.construct_nested_sub_queries(query_field, filters, key='must_terms')
                must_not_terms = cls.construct_nested_sub_queries(query_field, filters, key='must_not_terms')

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

    @classmethod
    def handle_nested_filters(cls, nested_filters, final_filters, es_mapping, key='must'):
        """
        Helper function for build_filters that collapses nested filters together into a single lucene sub-query
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
            nested_path = find_nested_path(field, es_mapping)
            sub_queries = final_filters['bool'][key]
            found = False
            for _q in sub_queries:

                # Try to add to an existing 'nested' sub-query if possible
                if _q.get(NESTED, None):
                    if _q[NESTED][PATH] == nested_path:
                        try:
                            if isinstance(query, list):  # reject list structure, if present
                                query = query[0]

                            if key not in query[BOOL]:  # we are combining a different type of query on this nested path
                                opposite_key = key_map[key]
                                if opposite_key in query[BOOL]:
                                    _q[NESTED][QUERY][BOOL][opposite_key] = query[BOOL][opposite_key]
                                    found = True
                                    break
                            else:

                                # check if this field has multiple options
                                options = query[BOOL][key][0][MATCH][field].split(',')
                                if len(options) > 1:

                                    # construct SHOULD sub-query for all options
                                    sub_query = cls.handle_should_query(field, options)
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
                        except:  # Why? We found a 'range' nested query and must add this one separately
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

                # if there is no boolean clause in this sub-query, add it directly to final_filters
                # otherwise continue logic below
                if BOOL not in query:
                    final_filters[BOOL][MUST].append({
                        NESTED: {PATH: nested_path,
                                 QUERY: query}
                    })
                    continue

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
                        sub_query = cls.handle_should_query(field, options)
                    else:
                        sub_query = query

                # add the 'nested' sub query to the main query for this path
                # all remaining nested filters on this path will be part of this object unless they are of type 'range'
                # in which case they will get their own NESTED sub-query
                final_filters[BOOL][key].append({
                    NESTED: {PATH: nested_path,
                             QUERY: sub_query}
                })

    @staticmethod
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
            f_field = None
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

    @classmethod
    def build_filters(cls, request, search, result, principals, doc_types, es_mapping):
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
        field_filters = cls.initialize_field_filters(request, principals, doc_types)
        range_filters = cls.handle_range_filters(request, result, field_filters, doc_types)

        # construct queries
        must_filters, must_not_filters, \
        must_filters_nested, must_not_filters_nested = cls.build_sub_queries(field_filters, es_mapping)

        # add range limits to filters if given
        cls.apply_range_filters(range_filters, must_filters, es_mapping)

        # To modify filters of elasticsearch_dsl Search, must call to_dict(),
        # modify that, then update from the new dict
        prev_search = search.to_dict()

        # initialize filter hierarchy
        final_filters = {BOOL: {MUST: [f for _, f in must_filters], MUST_NOT: [f for _, f in must_not_filters]}}
        cls.handle_nested_filters(must_filters_nested, final_filters, es_mapping, key=MUST)
        cls.handle_nested_filters(must_not_filters_nested, final_filters, es_mapping, key=MUST_NOT)

        # at this point, final_filters is valid lucene and can be dropped into the query directly
        prev_search[QUERY][BOOL][FILTER] = final_filters
        try:
            search.update_from_dict(prev_search)
        except Exception as e:  # not ideal, but important to catch at this stage no matter what it is
            log.error('SEARCH: exception encountered when converting raw lucene params to elasticsearch_dsl,'
                      'search: %s\n error: %s' % (prev_search, str(e)))
            raise HTTPBadRequest('The search failed - the DCIC team has been notified.')
        return search, final_filters

    @staticmethod
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
            for active_filter in search_filters['bool'][
                filter_type]:  # active_filter => e.g. { 'terms' : { 'embedded.@type.raw': ['ExperimentSetReplicate'] } }

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
                (search.aggs['all_items'][agg]  # create a sub-bucket, preserving the boolean qualifiers
                 .bucket('primary_agg',
                         'nested', path=find_nested_path(aggs_ptr.aggs[agg]['primary_agg'].field, es_mapping))
                 .bucket('primary_agg',
                         Terms(field=aggs_ptr.aggs[agg]['primary_agg'].field, size=100, missing='No value'))
                 .bucket('primary_agg_reverse_nested', REVERSE_NESTED))

    @classmethod
    def build_facets(cls, search, facets, search_filters, string_query, request, doc_types,
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
            return search

        aggs = OrderedDict()
        for field, facet in facets:  # E.g. 'type','experimentset_type','experiments_in_set.award.project', ...
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

                facet_filters = cls.generate_filters_for_terms_agg_from_search_filters(query_field, search_filters,
                                                                                       string_query)
                term_aggregation = {
                    TERMS: {
                        'size': 100,
                        # Maximum terms returned (default=10); see https://github.com/10up/ElasticPress/wiki/Working-with-Aggregations
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
            cls.set_additional_aggregations(search_as_dict, request, doc_types, custom_aggregations)

        # update with all terms aggregations
        search.update_from_dict(search_as_dict)

        # update with correct nested aggregations, see docstring
        cls.fix_nested_aggregations(search, es_mapping)
        return search

    @staticmethod
    def verify_search_has_permissions(request, search):
        """
        Inspects the search object to ensure permissions are still present on the query
        This method depends on the query structure defined in 'build_filters'.

        :param request: the current request
        :param search: search object to inspect
        :raises: HTTPBadRequest if permissions not present
        """
        search_dict = convert_search_to_dictionary(search)
        effective_principals_on_query = None
        found = False  # set to True if we found valid 'principals_allowed.view'
        try:
            for boolean_clause in search_dict['query']['bool']['filter']:  # should always be present
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
            log.error('SEARCH: Detected URL query param manipulation, principals_allowed.view was'
                      'modified from %s to %s' % (request.effective_principals,
                                                  effective_principals_on_query))
            raise HTTPBadRequest('The search failed - the DCIC team has been notified.')
        except KeyError:
            log.error('SEARCH: Malformed query detected while checking for principals_allowed')
            raise HTTPBadRequest('The search failed - the DCIC team has been notified.')
        if not found:
            log.error('SEARCH: Did not locate principals_allowed.view on search query body: %s' % search_dict)
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
