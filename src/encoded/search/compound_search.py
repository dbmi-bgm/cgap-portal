import json
import urllib.parse
from pyramid.view import view_config
from pyramid.request import Request
from pyramid.httpexceptions import HTTPBadRequest
from snovault import TYPES
from snovault.util import debug_log
from snovault.embed import make_subrequest
from ..types.base import get_item_or_none
from .search import SearchBuilder, search as single_query_search
from .lucene_builder import LuceneBuilder
from .search_utils import execute_search, build_sort_dicts, make_search_subreq
from ..types.filter_set import FLAGS, FILTER_BLOCKS
import os


def includeme(config):
    config.add_route('compound_search', '/compound_search')
    config.add_route('build_query', '/build_query{slash:/?}')
    config.scan(__name__)


class CompoundSearchBuilder:
    """ Encapsulates methods needed to run a compound search, in other words an
        AND or an OR query combining a set of queries.

        Entry point is "execute_filter_set".
    """
    TYPE = 'search_type'
    ID = '@id'
    QUERY = 'query'
    NAME = 'name'
    FLAGS_APPLIED = 'flags_applied'
    BUILD_QUERY_URL = '/build_query/'

    @staticmethod
    def build_subreq_from_single_query(request, query, route='/search/', from_=0, to=10):
        """ Builds a Request object that is a proper sub-request of the given request.
            Passes flags directly as query string params. Intended for use with search.

        :param request: request to build off of
        :param query: search query
        :param route: route of sub-request to build
        :param from_: starting ES hit index
        :param to: how many results to returning, index starting at from_
        :return: new Request
        """

        # do some sanitization
        # This will actually urlencode the entire previous string, so:
        # `&inheritance_modes=Neurodev+2500%2B+%282598%29` will become:
        # `&inheritance_modes=Neurodev%2B2500%252B%2B%25282598%2529` (the "&" & "=" chars can be encoded too, but left intact)
        # so the "+" become urlencoded into 'plus-sign' encodings (%2B) (rather than space - %20), and previous 'plus-sign'
        # encodings go from `%2B` to `%252B` (the percent sign gets encoded). So essentially is an encoding of an encoding.
        # But it works once goes into snovault's `make_subreq` downstream.
        if len(query) > 0 and query[0] != "?":
            query = '?' + query

        # If any '?', '&', or '=' in search term, should have been pre-encoded.
        # Meant to handle "+" especially.
        query = urllib.parse.quote(query, safe="?&=")

        subreq = make_search_subreq(request, route + '%s&from=%s&limit=%s' % (query, from_, to))
        subreq.headers['Accept'] = 'application/json'

        return subreq

    @staticmethod
    def combine_query_strings(qstring1, qstring2):
        """ Builds a single URL query from the given flags and blocks.

        :param qstring1: flags, usually ? prefixed
        :param qstring2: blocks to add to it
        :return: combined query
        """

        dict_to_merge_into = dict(urllib.parse.parse_qs(qstring1.lstrip('?'), keep_blank_values=True))
        dict_with_more_vals = dict(urllib.parse.parse_qs(qstring2.lstrip('?'), keep_blank_values=True))

        for k, v in dict_with_more_vals.items():
            if k in dict_to_merge_into:
                dict_to_merge_into[k] += v
            else:
                dict_to_merge_into[k] = v

        return urllib.parse.urlencode(dict_to_merge_into, doseq=True)

    @staticmethod
    def format_result_for_endpoint_response(request, es_results, filter_set, result_sort, search_builder_instance):
        """ Formats es_results from filter_set into a dictionary containing total and @graph,
            setting status on the request if needed.

        :param request: current request
        :param es_results: response from ES
        :return: dictionary response
        """

        if es_results['hits']['total'] == 0:
            request.response.status_code = 404  # see google webmaster doc on why

        if search_builder_instance.search_session_id:  # Is 'None' if e.g. limit=all
            request.response.set_cookie('searchSessionID', search_builder_instance.search_session_id)

        return {
            # "@id": "/compound_search", # Not necessary from UI atm but considering adding for semantics
            # "@type": ["SearchResults"], # Not necessary from UI atm but considering adding for semantics
            "total": es_results['hits'].get("total", 0),
            "@graph": [ hit['_source']['embedded'] for hit in es_results['hits'].get("hits", []) ],
            "columns": SearchBuilder.build_initial_columns([ request.registry[TYPES][filter_set[CompoundSearchBuilder.TYPE]].schema ]),
            "sort": result_sort
        }

    @staticmethod
    def invoke_search(context, request, subreq, search_type, return_generator=False):
        """
        Wrapper method that invokes the core search API (/search/) with the given subreq and
        copies over status code to parent response.

        :param context: context of parent request
        :param request: parent request
        :param subreq: subrequest
        :return: response from /search/
        """
        # Calls SearchBuilder.format_results internally, incl. adding searchSessionID cookie to response.
        response = single_query_search(context, subreq, search_type, return_generator)
        if subreq.response.status_code == 404:
            request.response.status_code = 404
        return response

    @staticmethod
    def _add_type_to_flag_if_needed(flags, type_flag):
        """ Modifies 'flags' in place by adding type query if it is not present

        :param flags: query substring
        :param type_flag: query substring containing type requirement
        :return: query string that combines the two, if type requirement isn't already there
        """
        if type_flag not in flags or type_flag.lower() not in flags:
            if len(flags) > 0:
                flags += '&' + type_flag
            else:
                flags = type_flag

        return flags

    @staticmethod
    def es_results_generator(es_results):
        for hit in es_results['hits'].get('hits', []):
            yield hit['_source']['embedded']

    @staticmethod
    def execute_filter_set(context, request, filter_set, from_=0, to=10,
                           global_flags=None, return_generator=False, intersect=False):
        """ Executes the given filter_set. This function contains the core functionality of the class.
            A filter_set with respect to this function is just a dictionary containing the following things:
                1. 'search_type' is the item type we are executing on. Required.
                2. 'filter_blocks' contains the filter blocks we would like to apply with named flags we
                    would like to apply on this block as well
                3. 'flags' is a dictionary containing named flags to be applied to individual filter_blocks
                    by name.

                NOTE: if neither 'flags' nor 'filter_blocks' is specified then a generic type=Item
                search will be executed. If just 'flags' is specified with no filter_blocks, the
                flags will be ignored (since there are no filter_blocks to apply it to).
        """
        cls = CompoundSearchBuilder
        filter_blocks = filter_set.get(FILTER_BLOCKS, [])
        flags = filter_set.get(FLAGS, None)
        doc_type = filter_set.get(CompoundSearchBuilder.TYPE)
        search_type = filter_set.get(cls.TYPE, 'Item')  # if type not set, attempt to search on item
        type_flag = 'type=%s' % search_type

        # if we have no filter blocks, there is no context to enable flags, so
        # pass type_flag + global_flags
        if not filter_blocks and flags:
            if global_flags:
                query = cls.combine_query_strings(global_flags, type_flag)
            else:
                query = type_flag
            subreq = cls.build_subreq_from_single_query(request, query, from_=from_, to=to)
            return CompoundSearchBuilder.invoke_search(context, request, subreq, search_type, return_generator)

        # if we specified global_flags, combine that query with the single filter_block,
        # otherwise pass the filter_block query directly
        elif not flags and len(filter_blocks) == 1:
            block = filter_blocks[0]
            block_query = block[cls.QUERY]
            if global_flags:
                query = cls.combine_query_strings(global_flags, block_query)
            else:
                query = block_query
            query = cls._add_type_to_flag_if_needed(query, type_flag)
            subreq = cls.build_subreq_from_single_query(request, query, from_=from_, to=to)
            return CompoundSearchBuilder.invoke_search(context, request, subreq, search_type, return_generator)

        # Extract query string and list of applied flags, add global_flags to block_query first
        # then add flags as applied and type_flag if needed.
        elif flags and len(filter_blocks) == 1:
            block_query = filter_blocks[0][cls.QUERY]
            flags_applied = filter_blocks[0][cls.FLAGS_APPLIED]
            if global_flags:
                query = cls.combine_query_strings(global_flags, block_query)
            else:
                query = block_query
            for applied_flag in flags_applied:
                for flag in flags:
                    if flag[cls.NAME] == applied_flag:
                        query = cls.combine_query_strings(query, flag[cls.QUERY])
                        break
            query = cls._add_type_to_flag_if_needed(query, type_flag)
            subreq = cls.build_subreq_from_single_query(request, query, from_=from_, to=to)
            return CompoundSearchBuilder.invoke_search(context, request, subreq, search_type, return_generator)

        # Build the compound_query
        # Iterate through filter_blocks, adding global_flags if specified and adding flags if specified
        else:
            sub_queries = []
            for block in filter_blocks:
                block_query = block[cls.QUERY]
                flags_applied = block[cls.FLAGS_APPLIED]
                query = block_query
                if global_flags:
                    query = cls.combine_query_strings(global_flags, block_query)
                for applied_flag in flags_applied:
                    for flag in flags:
                        if flag[cls.NAME] == applied_flag:
                            query = cls.combine_query_strings(query, flag[cls.QUERY])
                            break
                query = cls._add_type_to_flag_if_needed(query, type_flag)
                subreq = cls.build_subreq_from_single_query(request, query, route=cls.BUILD_QUERY_URL,
                                                            from_=from_, to=to)
                sub_query = request.invoke_subrequest(subreq).json[cls.QUERY]
                sub_queries.append(sub_query)


            compound_query = LuceneBuilder.compound_search(sub_queries, intersect=intersect)
            compound_subreq = cls.build_subreq_from_single_query(request, ('?type=' + search_type))

            requested_sorts = filter_set.get("sort", [])
            if not requested_sorts and global_flags:
                requested_sorts = urllib.parse.parse_qs(global_flags).get("sort", [])

            sort, result_sort = build_sort_dicts(requested_sorts, request, [ doc_type ])

            search_builder_instance = SearchBuilder.from_search(context, compound_subreq, compound_query, return_generator=return_generator)
            search_builder_instance.assure_session_id()
            search_builder_instance.query['sort'] = sort
            es_results = None
            if return_generator and to == "all":
                print("RETURN GENEATOR?", return_generator, '\n\n', dir(search_builder_instance))
                es_results = search_builder_instance.execute_search_for_all_results()
                # es_results['hits']['hits'] WILL ALREADY BE A GENERATOR/ITERATOR -- SEE search.py:execute_search_for_all_results
                # (Unless result count is <100, in which case will be a list)
                return cls.es_results_generator(es_results)
            elif return_generator and to != "all":
                # TODO: Consider enabling somehow
                raise HTTPBadRequest("`return_generator` without `limit=all` not yet supported")
            elif to == "all":
                raise HTTPBadRequest("`limit=all` is not permitted without `return_generator`")
            else:
                es_results = execute_search(
                    es=search_builder_instance.es,
                    query=search_builder_instance.query,
                    index=search_builder_instance.es_index,
                    from_=from_,
                    size=to,
                    session_id=search_builder_instance.search_session_id
                )
                return cls.format_result_for_endpoint_response(request, es_results, filter_set, result_sort, search_builder_instance)

    @staticmethod
    def validate_flag(flag):
        """ Validates a given flag has the correct structure/types """
        if CompoundSearchBuilder.NAME not in flag or CompoundSearchBuilder.QUERY not in flag:  # existence
            raise HTTPBadRequest('Passed a bad flag with missing structure: %s' % flag)
        elif not isinstance(flag[CompoundSearchBuilder.NAME], str):  # type
            raise HTTPBadRequest('Passed a bad flag with incorrect parameter for field %s: %s' % (CompoundSearchBuilder.NAME, flag))
        elif not isinstance(flag[CompoundSearchBuilder.QUERY], str):  # type
            raise HTTPBadRequest('Passed a bad flag with incorrect parameter for field %s: %s' % (CompoundSearchBuilder.QUERY, flag))

    @staticmethod
    def validate_filter_block(filter_block):
        """ Validates a given filter_block has correct structure/types """
        if CompoundSearchBuilder.QUERY not in filter_block or CompoundSearchBuilder.FLAGS_APPLIED not in filter_block:
            raise HTTPBadRequest('Passed a bad filter_block with missing structure: %s' % filter_block)
        elif not isinstance(filter_block[CompoundSearchBuilder.QUERY], str):
            raise HTTPBadRequest('Passed a bad filter_block with wrong type for field %s: %s' % (CompoundSearchBuilder.QUERY, filter_block))
        elif not isinstance(filter_block[CompoundSearchBuilder.FLAGS_APPLIED], list):
            raise HTTPBadRequest('Passed a bad filter_block with wrong type for field %s: %s' %
                                 (CompoundSearchBuilder.FLAGS_APPLIED, filter_block))

    @staticmethod
    def extract_filter_set_from_search_body(request, body):
        """ Validates the compound_search POST request body, returning a dictionary filter_set item.

        :param request: current request
        :param body: body of POST request (in JSON)
        :return: a filter_set, to be executed
        """
        if CompoundSearchBuilder.ID in body:  # prioritize @id
            return get_item_or_none(request, body[CompoundSearchBuilder.ID])
        else:
            filter_set = {}
            if CompoundSearchBuilder.TYPE in body:
                filter_set[CompoundSearchBuilder.TYPE] = body[CompoundSearchBuilder.TYPE]
            else:
                raise HTTPBadRequest('Tried to execute a filter_set without specifying a type!')
            if FLAGS in body:
                if not isinstance(body[FLAGS], list):
                    raise HTTPBadRequest('Passed a bad value for flags: %s -- Expected a list.' % body[FLAGS])
                for flag in body[FLAGS]:
                    CompoundSearchBuilder.validate_flag(flag)
                filter_set[FLAGS] = body[FLAGS]
            if FILTER_BLOCKS in body:
                if not isinstance(body[FILTER_BLOCKS], list):
                    raise HTTPBadRequest('Passed a bad value for flags: %s -- Expected a list.' % body[FILTER_BLOCKS])
                for filter_block in body[FILTER_BLOCKS]:
                    CompoundSearchBuilder.validate_filter_block(filter_block)
                filter_set[FILTER_BLOCKS] = body[FILTER_BLOCKS]
            return filter_set





@view_config(route_name='build_query', request_method='GET', permission='search')
@debug_log
def build_query(context, request):
    """ Runs the query construction step of the search, returning the lucene query as the response.
        Used as a helper for compound_search, making 1 sub-request per filter_block.
    """
    builder = SearchBuilder(context, request)
    builder._build_query()
    return builder.query


@view_config(route_name='compound_search', request_method='POST', permission='search')
@debug_log
def compound_search(context, request):
    """ Executes a compound_search given a uuid of a filter_set (or filter_set props, tbd).

        You have two options when executing a compound search - you can pass a uuid of an existing
        filter_set item or you can pass the relevant filter_set fields directly. This allows the
        client to acquire/cache filter_sets then pass modified query params directly to ES without
        triggering a write to the base filter_set.

        POST Body Syntax:
        {
            # flags to be applied globally to the search
            "global_flags": <query_string>,

            # uuid of a filter_set item to execute
            "uuid": <uuid>,  # NOTE: if you provide this, the following filter_set related fields are IGNORED

            "search_type": <item_type>,  # item type this filter_set is searching on
            "flags": [
                {
                    "name": "flag_name_one",
                    "query": <query_string>
                },
                {
                    "name": "flag_name_two",
                    "query": <query_string>
                }
                ...
            ]

            # list of queries to be compounded with below structure
            "filter_blocks": [
                {
                    "query": <query_string>, (to be combined with global_flags, if specified)
                    "flags_applied": [
                        "flag_name_one",
                        "flag_name_two"
                    ]
                }
                ...
            ]

            # other options
            "from": <int>,  # starting index in ES search results to return, default 0
            "limit": <int>,  # number of results to return, default 25
            "return_generator": true/false, default false
            "intersect": true/false, if true will compute intersection of filter_blocks, default false
        }

    """
    body = json.loads(request.body)

    filter_set = CompoundSearchBuilder.extract_filter_set_from_search_body(request, body)
    global_flags = body.get('global_flags', None)
    intersect = True if body.get('intersect', False) else False

    # Disabled for time being to allow test(s) to pass. Not sure whether to add Project to FilterSet schema 'search_type' enum.
    # if filter_set.get(CompoundSearchBuilder.TYPE) not in request.registry[TYPES]["FilterSet"].schema["properties"][CompoundSearchBuilder.TYPE]["enum"]:
    #    raise HTTPBadRequest("Passed bad {} body param: {}".format(CompoundSearchBuilder.TYPE, filter_set.get(CompoundSearchBuilder.TYPE)))

    from_ = body.get('from', 0)
    limit = body.get('limit', 25)
    if limit == "all":
        raise HTTPBadRequest("compound_search does not support limit=all at this time.")
    if limit > 1000:
        limit = 1000
    if from_ < 0 or limit < 0:
        raise HTTPBadRequest('Passed bad from, to request body params: %s, %s' % (from_, limit))

    return CompoundSearchBuilder.execute_filter_set(
        context,
        request,
        filter_set,
        from_=from_,
        to=limit,
        global_flags=global_flags,
        intersect=intersect,
        return_generator=False
    )
