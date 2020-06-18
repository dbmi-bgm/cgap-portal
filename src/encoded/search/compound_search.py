import json
from pyramid.view import view_config
from pyramid.request import Request
from pyramid.httpexceptions import HTTPBadRequest
from snovault.util import debug_log
from ..types.base import get_item_or_none
from .search import SearchBuilder
from .lucene_builder import LuceneBuilder
from .search_utils import execute_search
from ..types.filter_set import FLAGS, FILTER_BLOCKS


def includeme(config):
    config.add_route('compound_search', '/compound_search')
    config.add_route('build_query', '/build_query{slash:/?}')
    config.scan(__name__)


class CompoundSearchBuilder:
    """ Encapsulates methods needed to run a compound search, in other words an
        AND or an OR query combining a set of queries.

        Entry point is "execute_filter_set".
    """
    TYPE = 'type'
    ID = '@id'
    QUERY = 'query'
    FLAG_APPLIED = 'flag_applied'
    DEFAULT_SEARCH = '?type=Item'
    BUILD_QUERY_URL = '/build_query/'

    @staticmethod
    def transfer_request_permissions(parent_request, sub_request):
        """ Copies over the REMOTE_USER field from the parent request to the sub_request. This is a critical
            action that must be done to properly execute the sub_request with permissions. It is possible more
            things need to be done.

        :param parent_request: parent_request who possesses permissions
        :param sub_request: request who requires the permissions of the parent request
        """
        sub_request.environ['REMOTE_USER'] = parent_request.environ['REMOTE_USER']
        sub_request.__parent__ = None  # XXX: set parent request (is None *always* correct?) -Will
        sub_request.registry = parent_request.registry  # transfer registry as well

    @classmethod
    def build_subreq_from_single_query(cls, request, query, route='/search/', from_=0, to=10):
        """ Builds a Request object that is a proper sub-request of the given request.
            Passes flags directly as query string params. Intended for use with search.

        :param request: request to build off of
        :param query: search query
        :param route: route of sub-request to build
        :param from_: starting ES hit index
        :param to: how many results to returning, index starting at from_
        :return: new Request
        """
        if '?' not in query:  # do some sanitization
            query = '?' + query
        subreq = Request.blank(route + '%s&from=%s&limit=%s' % (query, from_, to))
        cls.transfer_request_permissions(request, subreq)  # VERY IMPORTANT - Will
        return subreq

    @staticmethod
    def combine_flags_and_block(flags, block):
        """ Builds a single URL query from the given flags and blocks.

        :param flags: flags, usually ? prefixed
        :param block: blocks to add to it
        :return: combined query
        """
        if '?' in flags:
            return '&'.join([flags, block])
        elif '?' in block:
            return '&'.join([block, flags])
        else:
            return '?' + '&'.join([flags, block])

    @staticmethod
    def format_filter_set_results(request, es_results, return_generator=False):
        """ Formats es_results from filter_set into a dictionary containing total and @graph,
            setting status on the request if needed.

        :param request: current request
        :param es_results: response from ES
        :param return_generator: whether or not we are returning a generator or a response
        :return: dictionary response
        """
        # if this is a subrequest/gen request, return '@graph' directly
        if request.__parent__ is not None or return_generator:
            return es_results['hits']['hits']

        elif es_results['hits']['total'] == 0:
            request.response.status_code = 404
            return {
                'total': 0,
                '@graph': []
            }
        else:
            return {
                'total': es_results['hits']['total'],
                '@graph': es_results['hits']['hits']
            }

    @staticmethod
    def invoke_search(context, request, subreq, return_generator=False):
        """ Wrapper method that invokes the core search API (/search/) with the given subreq and
            propagates the response to the "parent" request.

        :param context: context of parent request
        :param request: parent request
        :param subreq: subrequest
        :param return_generator: whether or not to return a generator
        :return: response from /search/
        """
        search_builder = SearchBuilder(context, subreq, None, return_generator)
        response = search_builder._search()
        if subreq.response.status_code == 404:
            request.response.status_code = 404
        return response

    @classmethod
    def execute_filter_set(cls, context, request, filter_set, from_=0, to=10, return_generator=False, intersect=False):
        """ Executes the given filter_set. This function contains the core functionality of the class.
            A filter_set with respect to this function is just a dictionary containing the following things:
                1. 'type' is the item type we are executing on. Required.
                2. 'filter_blocks' contains the filter blocks we would like to apply
                3. 'flags' contains the query to be combined with all filter_blocks

                NOTE: if neither 'flags' nor 'filter_blocks' is specified then a generic type=Item
                search will be executed.
        """
        filter_blocks = filter_set.get(FILTER_BLOCKS, [])
        flags = filter_set.get(FLAGS, None)
        t = filter_set.get(cls.TYPE, 'Item')  # if type not set, attempt to search on item

        # XXX: handle capitalization? ie: type=gene vs. type=Gene

        # if we have no filter blocks, pass flags alone to search
        if not filter_blocks and flags:
            if t not in flags:
                flags += '&type=%s' % t
            subreq = cls.build_subreq_from_single_query(request, flags, from_=from_, to=to)
            return cls.invoke_search(context, request, subreq, return_generator=return_generator)

        # if we have only a single filter block with no flags, pass single filter_block to search
        elif not flags and len(filter_blocks) == 1:
            block = filter_blocks[0]
            if block['flag_applied']:
                subreq = cls.build_subreq_from_single_query(request, block['query'], from_=from_, to=to)
            else:
                subreq = cls.build_subreq_from_single_query(request, cls.DEFAULT_SEARCH, from_=from_, to=to)
            return cls.invoke_search(context, request, subreq, return_generator=return_generator)

        # if given flags and single filter block, combine and pass
        elif flags and len(filter_blocks) == 1:
            block = filter_blocks[0]
            if block['flag_applied']:
                combined_query = cls.combine_flags_and_block(flags, block['query'])
                subreq = cls.build_subreq_from_single_query(request, combined_query, from_=from_, to=to)
            else:
                subreq = cls.build_subreq_from_single_query(request, flags, from_=from_, to=to)
            return cls.invoke_search(context, request, subreq, return_generator=return_generator)

        # Build the compound_query
        else:
            sub_queries = []
            for block in filter_blocks:
                if block[cls.FLAG_APPLIED]:  # only build sub_query if this block is applied
                    if flags:
                        combined_query = cls.combine_flags_and_block(flags, block[cls.QUERY])
                        subreq = cls.build_subreq_from_single_query(request, combined_query, route=cls.BUILD_QUERY_URL,
                                                                    from_=from_, to=to)
                    else:
                        subreq = cls.build_subreq_from_single_query(request, block[cls.QUERY],
                                                                    route=cls.BUILD_QUERY_URL, from_=from_, to=to)
                    sub_query = request.invoke_subrequest(subreq).json[cls.QUERY]
                    sub_queries.append(sub_query)
                else:
                    continue

            if len(sub_queries) == 0:  # if all blocks are disabled, just execute the flags
                if not flags:
                    flags = cls.DEFAULT_SEARCH
                elif t not in flags:
                    flags += '&type=%s' % t
                subreq = cls.build_subreq_from_single_query(request, flags, from_=from_, to=to)
                return cls.invoke_search(context, request, subreq, return_generator=return_generator)

            else:  # build, execute compound query and return a response with @graph containing results
                compound_query = LuceneBuilder.compound_search(sub_queries, intersect=intersect)
                subreq = cls.build_subreq_from_single_query(request, ('?type=' + t))
                search = SearchBuilder.from_search(context, subreq, compound_query, from_=from_, size=to)
                es_results = execute_search(subreq, search.search)
                return cls.format_filter_set_results(request, es_results, return_generator)

    @classmethod
    def extract_filter_set_from_search_body(cls, request, body):
        """ Validates the compound_search POST request body, returning a dictionary filter_set item.
            XXX: Test (and should HTTPBadRequest be thrown here?)

        :param request: current request
        :param body: body of POST request (in JSON)
        :return: a filter_set, to be executed
        """
        if cls.ID in body:  # prioritize @id
            return get_item_or_none(request, body[cls.ID])
        else:
            filter_set = {}
            if cls.TYPE in body:
                filter_set[cls.TYPE] = body[cls.TYPE]
            else:
                raise HTTPBadRequest('Tried to execute a filter_set without specifying a type!')
            if FLAGS in body:
                if not isinstance(body[FLAGS], str):
                    raise HTTPBadRequest('Passed a bad value for flags: %s -- Expected a string.' % body[FLAGS])
                filter_set[FLAGS] = body[FLAGS]
            if FILTER_BLOCKS in body:
                if not isinstance(body[FILTER_BLOCKS], list):
                    raise HTTPBadRequest('Passed a bad value for flags: %s -- Expected a list.' % body[FILTER_BLOCKS])
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
    return builder.search.to_dict()


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
            # uuid of a filter_set item to execute
            "uuid": <uuid>,  # NOTE: if you provide this, the following filter_set related fields are IGNORED

            "type": <item_type>,  # item type this filter_set is searching on
            "flags": <query_string>,  # flags to be applied globally to the search
            "filter_blocks": [  # list of objects with below structure
                {
                    "query": <query_string>,
                    "flag_applied": true/false
                }
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
    intersect = True if body.get('intersect', False) else False
    _from = body.get('from', 0)
    limit = body.get('limit', 25)
    return_generator = body.get('return_generator', False)
    if _from < 0 or limit < 0:
        raise HTTPBadRequest('Passed bad from, to request body params: %s, %s' % (_from, limit))
    return CompoundSearchBuilder.execute_filter_set(context, request, filter_set, from_=_from, to=limit,
                                                    return_generator=return_generator, intersect=intersect)
