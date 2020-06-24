import re
import math
import itertools
import uuid
import structlog
from pyramid.view import view_config
from webob.multidict import MultiDict
from functools import reduce
from elasticsearch_dsl import Search
from pyramid.httpexceptions import HTTPBadRequest
from urllib.parse import urlencode
from collections import OrderedDict
from copy import deepcopy
from snovault import (
    AbstractCollection,
    TYPES,
    COLLECTIONS,
)
from snovault.elasticsearch import ELASTIC_SEARCH
from snovault.elasticsearch.create_mapping import determine_if_is_date_field
from snovault.util import (
    debug_log,
)
from snovault.typeinfo import AbstractTypeInfo
from .lucene_builder import LuceneBuilder
from .search_utils import (find_nested_path, schema_for_field, get_es_index, get_es_mapping,
                           execute_search, make_search_subreq, NESTED, COMMON_EXCLUDED_URI_PARAMS,
)


log = structlog.getLogger(__name__)


def includeme(config):
    config.add_route('search', '/search{slash:/?}')
    config.scan(__name__)


sanitize_search_string_re = re.compile(r'[\\\+\-\&\|\!\(\)\{\}\[\]\^\~\:\/\\\*\?]')


class SearchBuilder:
    """ A monolithic object that encapsulates information needed to perform searches.
        The purpose of this class is to organize state + methods used for bootstrapping
        the search.

        Static methods in this class serve on of two purposes:
            1. Take state and use it to generate new state in the initializer.
            2. Functions that operate at the "leaf" and do not require state.

        The point is to split apart logic needed for query construction with logic needed for the
        API itself. Search is by far our most complicated API, thus there is a lot of state.
    """
    DEFAULT_SEARCH_FRAME = 'embedded'

    def __init__(self, context, request, search_type=None, return_generator=False, forced_type='Search',
                 custom_aggregations=None, skip_bootstrap=False):
        self.context = context  # request context
        self.request = request  # request who requested a search
        self.response = {}

        # setup needed regardless of whether we are building from a base query or building a new one
        # from params
        self.types = self.request.registry[TYPES]  # all types in the system
        self.doc_types = self.set_doc_types(self.request, self.types, search_type)  # doc_types for this search
        self.es = self.request.registry[ELASTIC_SEARCH]  # handle to remote ES
        self.es_index = get_es_index(self.request, self.doc_types)  # what index we are searching on
        self.search = Search(using=self.es, index=self.es_index)

        # skip setup needed for building the query, if desired
        if not skip_bootstrap:
            self._bootstrap_query(search_type, return_generator, forced_type, custom_aggregations)

        # To be computed later, initialized to None here
        self.result = None
        self.from_ = None
        self.size = None
        self.facets = None
        self.search_session_id = None
        self.string_query = None

    def _bootstrap_query(self, search_type=None, return_generator=False, forced_type='Search',
                         custom_aggregations=None):
        """ Helper method that will bootstrap metadata necessary for building a search query. """
        self.return_generator = return_generator  # whether or not this search should return a generator
        self.custom_aggregations = custom_aggregations  # any custom aggregations on this search
        self.forced_type = forced_type  # (mostly deprecated) search type
        self.principals = self.request.effective_principals  # permissions to apply to this search

        # Initialized via outside function call
        self.schemas = [self.types[item_type].schema for item_type in self.doc_types]  # schemas for doc_types
        self.search_types = self.build_search_types(self.types, self.doc_types) + [
            self.forced_type]  # item_type hierarchy we are searching on
        self.search_base = self.normalize_query(self.request, self.types, self.doc_types)
        self.search_frame = self.request.normalized_params.get('frame', self.DEFAULT_SEARCH_FRAME)  # embedded
        self.prepared_terms = self.prepare_search_term(self.request)

        # Outside API Calls
        self.item_type_es_mapping = get_es_mapping(self.es, self.es_index)  # mapping for the item type we are searching

    @property
    def forced_type_token(self):
        """ Do any processing needed to be applied to self.forced_type """
        return self.forced_type.lower()

    @classmethod
    def from_search(cls, context, request, search, from_=0, size=10):
        """ Builds a SearchBuilder object with a pre-built search by skipping the bootstrap
            initialization and setting self.search directly.

        :param search: search object to update
        :param from_: start index of search
        :param size: number of documents to return
        :return:
        """
        result = cls(context, request, skip_bootstrap=True)  # bypass bootstrap
        result.from_ = from_
        result.to = size  # execute_search will apply pagination
        result.search.update_from_dict(search)  # parse compound query
        return result

    @staticmethod
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

    @staticmethod
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

        # TODO: Optimize method structure here, see C4-71 PR comments -Will 6/24/2020
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
                if key.endswith('!'):  # handle NOT
                    return (key[:-1] + '.display_title!', val)
                return (key + '.display_title', val)
            else:
                return (key, val)

        # use a MultiDict to emulate request.params
        # TODO: Evaluate whether or not MultiDict is really useful here -Will 6/24/2020
        normalized_params = MultiDict(
            normalize_param(k, v)
            for k, v in request.params.items()
        )
        # overwrite 'type' if not equal to doc_types to ensure consistency
        if set(normalized_params.getall('type')) != set(doc_types):
            if 'type' in normalized_params:
                del normalized_params['type']
            for dtype in doc_types:
                normalized_params.add('type', dtype)
        # add the normalized params to the request
        # these will be used in place of request.params for the rest of search
        setattr(request, 'normalized_params', normalized_params)
        # the query string of the normalized search
        qs = '?' + urlencode([  # XXX: do we actually need to encode k,v  individually? -Will 6/24/2020
            (k.encode('utf-8'), v.encode('utf-8'))
            for k, v in request.normalized_params.items()
        ])
        return qs

    @staticmethod
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
        for field, val in request.normalized_params.items():
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

    @staticmethod
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

    def add_search_header_if_needed(self):
        """
        Get static section (if applicable) when searching a single item type
        Note: Because we rely on 'source', if the static_section hasn't been indexed
        into Elasticsearch it will not be loaded
        """
        if (len(self.doc_types) == 1) and 'Item' not in self.doc_types:
            search_term = 'search-info-header.' + self.doc_types[0]
            static_section = self.request.registry['collections']['StaticSection'].get(search_term)
            if static_section and hasattr(static_section.model, 'source'):
                item = static_section.model.source['object']
                self.response['search_header'] = {}
                self.response['search_header']['content'] = item['content']
                self.response['search_header']['title'] = item.get('title', item['display_title'])
                self.response['search_header']['filetype'] = item['filetype']

    def set_pagination(self):
        """
        Fill from_ and size parameters for search if given in the query string
        """
        from_ = self.request.normalized_params.get('from', 0)
        size = self.request.normalized_params.get('limit', 25)
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
                from_ = 0
        self.from_, self.size = from_, size

    def build_type_filters(self):
        """
        Set the type filters for the search. If no doc_types, default to Item.
        """
        if not self.doc_types:
            doc_types = ['Item']
        else:
            for item_type in self.doc_types:
                ti = self.types[item_type]
                qs = urlencode([
                    (k.encode('utf-8'), v.encode('utf-8'))
                    for k, v in self.request.normalized_params.items() if
                    not (k == 'type' and self.types.all.get('Item' if v == '*' else v) is ti)
                ])
                self.response['filters'].append({
                    'field': 'type',
                    'term': ti.name,
                    'remove': '{}?{}'.format(self.request.path, qs)
                })

    def clear_filters_setup(self):
        """
        Clear Filters URI path

        Make a URI path that clears all non-datatype filters
        and leaves in `q` (search query) params, if present.
        Also preserves currentAction=selection, if is set.

        :returns: A URL path
        """
        seach_query_specs = self.request.normalized_params.getall('q')
        seach_query_url = urlencode([("q", seach_query) for seach_query in seach_query_specs])
        # types_url will always be present (always >=1 doc_type)
        types_url = urlencode([("type", typ) for typ in self.doc_types])
        current_action = self.request.normalized_params.get('currentAction')

        clear_qs = types_url or ''
        if seach_query_url:
            clear_qs += '&' + seach_query_url
        if current_action == 'selection':
            clear_qs += '&currentAction=selection'
        current_search_sort = self.request.normalized_params.getall('sort')
        current_search_sort_url = urlencode([("sort", s) for s in current_search_sort])
        if current_search_sort_url:
            clear_qs += '&' + current_search_sort_url
        return self.request.route_path(self.forced_type_token, slash='/') + (('?' + clear_qs) if clear_qs else '')

    def initialize_search_response(self):
        """ Initializes the search response """
        self.response = {
            '@context': self.request.route_path('jsonld_context'),
            '@id': '/' + self.forced_type_token + '/' + self.search_base,
            '@type': self.search_types,
            'title': self.forced_type,
            'filters': [],
            'facets': [],
            '@graph': [],
            'notification': '',
            'sort': {},
            'clear_filters': self.clear_filters_setup()
        }
        self.add_search_header_if_needed()
        self.set_pagination()
        self.build_type_filters()

    def list_source_fields(self):
        """
        Returns set of fields that are requested by user or default fields.
        These fields are used to further limit the results from the search.
        Note that you must provide the full fieldname with embeds, such as:
        'field=biosample.biosource.individual.organism.name' and not just
        'field=name'
        """
        fields_requested = self.request.normalized_params.getall('field')
        if fields_requested:
            fields = ['embedded.@id', 'embedded.@type']
            for field in fields_requested:
                fields.append('embedded.' + field)
        elif self.search_frame == 'embedded':
            fields = [self.search_frame + '.*']
        elif self.search_frame in ['object', 'raw']:
            # frame=raw corresponds to 'properties' in ES
            if self.search_frame == 'raw':
                frame = 'properties'
            else:
                frame = self.search_frame
            # let embedded be searched as well (for faceting)
            fields = ['embedded.*', frame + '.*']
        else:
            fields = ['embedded.*']
        return fields

    def build_query(self):
        """
        Bootstraps our query format, building the q= part of the query if one is specified.
        If multiple are specified the first one that occurs in the URL will be used.
        """
        query_info = {}
        string_query = None
        query_dict = {'query': {'bool': {}}}
        # locate for 'q' query, if any
        for field, value in self.prepared_terms.items():
            if field == 'q':
                query_info['query'] = value
                query_info['lenient'] = True
                query_info['default_operator'] = 'AND'
                query_info['fields'] = ['_all']
                string_query = {'must': {'simple_query_string': query_info}}
                query_dict = {'query': {'bool': string_query}}
                break
        self.search.update_from_dict(query_dict)
        self.string_query = string_query

    def set_sort_order(self):
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
        if len(self.doc_types) == 1:
            type_schema = self.types[self.doc_types[0]].schema
        else:
            type_schema = None

        def add_to_sort_dict(requested_sort):
            if requested_sort.startswith('-'):
                name = requested_sort[1:]
                order = 'desc'
            else:
                name = requested_sort
                order = 'asc'
            sort_schema = schema_for_field(name, self.request, self.doc_types)

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
        requested_sorts = self.request.normalized_params.getall('sort')
        if requested_sorts:
            for rs in requested_sorts:
                add_to_sort_dict(rs)

        text_search = self.prepared_terms.get('q')

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
            self.search = self.search.sort(
                # Multi-level sort. See http://www.elastic.co/guide/en/elasticsearch/guide/current/_sorting.html#_multilevel_sorting & https://stackoverflow.com/questions/46458803/python-elasticsearch-dsl-sorting-with-multiple-fields
                {'_score': {"order": "desc"}},
                {'embedded.date_created.raw': {'order': 'desc', 'unmapped_type': 'keyword'},
                 'embedded.label.raw': {'order': 'asc', 'unmapped_type': 'keyword', 'missing': '_last'}},
                {'_uid': {'order': 'asc'}}
                # 'embedded.uuid.raw' (instd of _uid) sometimes results in 400 bad request : 'org.elasticsearch.index.query.QueryShardException: No mapping found for [embedded.uuid.raw] in order to sort on'
            )
            self.response['sort'] = result_sort = {'_score': {"order": "desc"}}

        if sort and result_sort:
            self.response['sort'] = result_sort
            self.search = self.search.sort(sort)

    def initialize_facets(self):
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
        if len(self.doc_types) > 1:  # only provide this if we are searching on more than one type
            facets = [
                # More facets will be appended to this list from item schema plus from any currently-active filters (as requested in URI params).
                ('type', {'title': 'Data Type'})
            ]
        else:
            facets = []

        append_facets = [
            # Facets which will be appended after those which are in & added to `facets`
            # ('status', {'title': 'Status'}), XXX: uncomment this if you want status facet

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
        if len(self.doc_types) == 1 and self.doc_types[0] != 'Item':
            current_type_schema = self.request.registry[TYPES][self.doc_types[0]].schema
            if 'facets' in current_type_schema:
                schema_facets = OrderedDict(current_type_schema['facets'])
                for schema_facet in schema_facets.items():
                    if schema_facet[1].get('disabled', False):
                        disabled_facets.append(schema_facet[0])
                        continue  # Skip disabled facets.
                    facets.append(schema_facet)

        # Add facets for any non-schema ?field=value filters requested in the search (unless already set)
        # TODO: this use is confusing and should be refactored -Will 6/24/2020
        used_facets = [facet[0] for facet in facets + append_facets]
        used_facet_titles = [
            facet[1]['title'] for facet in facets + append_facets
            if 'title' in facet[1]
        ]

        for field in self.prepared_terms:
            if field.startswith('embedded'):
                split_field = field.strip().split(
                    '.')  # Will become, e.g. ['embedded', 'experiments_in_set', 'files', 'file_size', 'from']
                use_field = '.'.join(split_field[1:])

                # 'terms' is the default per-term bucket aggregation for all non-schema facets
                if self.item_type_es_mapping and find_nested_path(field, self.item_type_es_mapping):
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
                        field_schema = schema_for_field(f_field, self.request, self.doc_types)

                        if field_schema:
                            is_date_field = determine_if_is_date_field(field, field_schema)
                            is_numerical_field = field_schema['type'] in ("integer", "float", "number")

                            if is_date_field or is_numerical_field:
                                title_field = field_schema.get("title", f_field)
                                use_field = f_field
                                aggregation_type = 'stats'

                for schema in self.schemas:
                    if title_field in schema['properties']:
                        title_field = schema['properties'][title_field].get('title', title_field)
                        # see if the title field conflicts for is_object_title facets
                        if is_object_title and title_field in used_facet_titles:
                            title_field += ' (Title)'
                        break

                facet_tuple = (use_field, {'title': title_field, 'aggregation_type': aggregation_type})

                # At moment is equivalent to `if aggregation_type == 'stats'`` until/unless more agg types are added for _facets_.
                if aggregation_type != 'terms':
                    # Remove completely if duplicate (e.g. .from and .to both present)
                    if use_field in used_facets:
                        continue
                    # facet_tuple[1]['hide_from_view'] = True # Temporary until we handle these better on front-end.
                    # Facet would be otherwise added twice if both `.from` and `.to` are requested.

                facets.append(facet_tuple)

        # Append additional facets (status, validation_errors, ...) at the end of
        # list unless were already added via schemas, etc.
        used_facets = [facet[0] for facet in facets]  # Reset this var
        for ap_facet in append_facets + validation_error_facets:
            if ap_facet[0] not in used_facets:
                facets.append(ap_facet)
            else:  # Update with better title if not already defined from e.g. requested filters.
                existing_facet_index = used_facets.index(ap_facet[0])
                if facets[existing_facet_index][1].get('title') in (None, facets[existing_facet_index][0]):
                    facets[existing_facet_index][1]['title'] = ap_facet[1]['title']

        return facets

    def build_search_query(self):
        """ Builds the search query utilizing a combination of helper methods within this class
            to build intermediary structures and LuceneBuilder function calls to handle building
            the actual Elasticsearch query.
        """
        self.build_query()
        self.set_sort_order()

        # Transform into filtered search
        self.search, query_filters = LuceneBuilder.build_filters(self.request, self.search, self.response,
                                                                 self.principals, self.doc_types,
                                                                 self.item_type_es_mapping)
        # Prepare facets in intermediary structure
        self.facets = self.initialize_facets()

        # Transform filter search into filter + faceted search
        self.search = LuceneBuilder.build_facets(self.search, self.facets, query_filters, self.string_query,
                                                 self.request, self.doc_types, self.custom_aggregations, self.size,
                                                 self.from_, self.item_type_es_mapping)

        # Add preference from session, if available
        if (self.request.__parent__ is None and
                  not self.return_generator and
                  self.size != 'all'):  # Probably unnecessary, but skip for non-paged, sub-reqs, etc.
            self.search_session_id = self.request.cookies.get('searchSessionID', 'SESSION-' + str(uuid.uuid1()))
            self.search = self.search.params(preference=self.search_session_id)

    @staticmethod
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
        buckets = aggregations[full_agg_name]['primary_agg']['primary_agg']['buckets']
        for bucket in buckets:
            if 'primary_agg_reverse_nested' in bucket:
                bucket['doc_count'] = bucket['primary_agg_reverse_nested']['doc_count']
        aggregations[full_agg_name]['primary_agg']['buckets'] = \
            sorted(buckets, key=lambda d: d['primary_agg_reverse_nested']['doc_count'], reverse=True)

    def format_facets(self, es_results):
        """
        Format the facets for the final results based on the es results.
        Sort based off of the 'order' of the facets
        These are stored within 'aggregations' of the result.

        If the frame for the search != embedded, return no facets
        TODO: refactor this method. -will 05/01/2020
        """
        result = []
        if self.search_frame != 'embedded':
            return result

        # Loading facets in to the results
        if 'aggregations' not in es_results:
            return result

        aggregations = es_results['aggregations']['all_items']
        used_facets = set()

        # Sort facets by order (ascending).
        # If no order is provided, assume 0 to
        # retain order of non-explicitly ordered facets
        for field, facet in sorted(self.facets, key=lambda fct: fct[1].get('order', 10000)):
            result_facet = {
                'field': field,
                'title': facet.get('title', field),
                'total': 0
                # To be added depending on facet['aggregation_type']: 'terms', 'min', 'max', 'min_as_string', 'max_as_string', ...
            }

            result_facet.update({k: v for k, v in facet.items() if k not in result_facet.keys()})
            used_facets.add(field)
            field_agg_name = field.replace('.', '-')
            full_agg_name = facet['aggregation_type'] + ':' + field_agg_name

            if full_agg_name in aggregations:
                if facet['aggregation_type'] == 'stats':
                    result_facet['total'] = aggregations[full_agg_name]['doc_count']
                    # Used for fields on which can do range filter on, to provide min + max bounds
                    for k in aggregations[full_agg_name]['primary_agg'].keys():
                        result_facet[k] = aggregations[full_agg_name]['primary_agg'][k]
                else:  # 'terms' assumed.

                    # Shift the bucket location
                    bucket_location = aggregations[full_agg_name]['primary_agg']
                    if 'buckets' not in bucket_location:  # account for nested structure
                        bucket_location = bucket_location['primary_agg']
                    result_facet['terms'] = bucket_location['buckets']

                    # Choosing to show facets with one term for summary info on search it provides
                    # XXX: The above comment is misleading - this drops all facets with no buckets
                    # we apparently want this for non-nested fields based on the tests, but should be
                    # investigated as having to do this doesn't really make sense.
                    if len(result_facet.get('terms', [])) < 1 and not facet['aggregation_type'] == NESTED:
                        continue

                    # if we are nested, apply fix + replace
                    if facet['aggregation_type'] == NESTED:
                        self.fix_and_replace_nested_doc_count(result_facet, aggregations, full_agg_name)

                    # Re-add buckets under 'terms' AFTER we have fixed the doc_counts
                    result_facet['terms'] = aggregations[full_agg_name]["primary_agg"]["buckets"]

                    # Default - terms, range, or histogram buckets. Buckets may not be present
                    result_facet['terms'] = aggregations[full_agg_name]["primary_agg"]["buckets"]
                    # Choosing to show facets with one term for summary info on search it provides
                    if len(result_facet.get('terms', [])) < 1:
                        continue

                if len(aggregations[full_agg_name].keys()) > 2:
                    result_facet['extra_aggs'] = {k: v for k, v in aggregations[field_agg_name].items() if
                                                  k not in ('doc_count', "primary_agg")}

            result.append(result_facet)

        return result

    @staticmethod
    def format_extra_aggregations(es_results):
        """
        Extracts any extra aggregations results returned from elasticsearch

        :param es_results: dictionary response from es
        :return: dictionary mapping field -> agg_value, varies based on type of aggregation
        """
        if 'aggregations' not in es_results:
            return {}
        return {k: v for k, v in es_results['aggregations'].items() if k != 'all_items'}

    def get_collection_actions(self):
        """
        Use this method to see actions available on an item type (collection) in the request context

        :return: actions available for this collection at this time
        """
        type_info = self.types[self.doc_types[0]]
        collection = self.request.registry[COLLECTIONS].get(type_info.name)
        if hasattr(collection, 'actions'):
            return collection.actions(self.request)
        else:
            return None

    def build_table_columns(self):
        """ Constructs an ordered dictionary of column information to be rendered by
            the front-end. If this functionality is needed outside of general search, this
            method should be moved to search_utils.py.
        """
        any_abstract_types = 'Item' in self.doc_types
        if not any_abstract_types:  # Check explictly-defined types to see if any are abstract.
            type_infos = [self.request.registry[TYPES][t] for t in self.doc_types if t != 'Item']
            for ti in type_infos:
                # We use `type` instead of `isinstance` since we don't want to catch subclasses.
                if type(ti) == AbstractTypeInfo:
                    any_abstract_types = True
                    break

        columns = OrderedDict()

        # Add title column, at beginning always
        columns['display_title'] = {
            "title": "Title",
            "order": -1000
        }

        # Add type column if any abstract types in search
        if any_abstract_types and self.request.normalized_params.get('currentAction') != 'selection':
            columns['@type'] = {
                "title": "Item Type",
                "colTitle": "Type",
                "order": -980,
                "description": "Type or category of Item",
                # Alternative below, if we want type column to be available but hidden by default in selection mode:
                # "default_hidden": request.normalized_params.get('currentAction') == 'selection'
            }

        for schema in self.schemas:
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
                        field_schema = schema_for_field(name, self.request, self.doc_types)
                        if field_schema:
                            if field_schema.get('description') is not None:
                                columns[name]['description'] = field_schema['description']

        # Add status column, if not present, at end.
        if 'status' not in columns:
            columns['status'] = {
                "title": "Status",
                "default_hidden": True,
                "order": 980
            }
        # Add date column, if not present, at end.
        if 'date_created' not in columns:
            columns['date_created'] = {
                "title": "Date Created",
                "colTitle": "Created",
                "default_hidden": True,
                "order": 1000
            }
        return columns

    def _format_results(self, hits):
        """
        Loads results to pass onto UI
        Will retrieve the desired frame from the search hits and automatically
        add 'validation_errors' and 'aggregated_items' frames if they are present
        """
        fields_requested = self.request.normalized_params.getall('field')
        if fields_requested:
            frame = 'embedded'
        elif self.search_frame:
            frame = self.search_frame
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

    @staticmethod
    def get_all_subsequent_results(request, initial_search_result, search, extra_requests_needed_count, size_increment):
        """ Generator method used to paginate. """
        from_ = 0
        while extra_requests_needed_count > 0:
            # print(str(extra_requests_needed_count) + " requests left to get all results.")
            from_ = from_ + size_increment
            subsequent_search = search[from_:from_ + size_increment]
            subsequent_search_result = execute_search(request, subsequent_search)
            extra_requests_needed_count -= 1
            for hit in subsequent_search_result['hits'].get('hits', []):
                yield hit

    def execute_search_for_all_results(self):
        """
        Uses the above function to automatically paginate all results.

        :return: all es_results that matched the given query
        """
        size_increment = 100  # Decrease this to like 5 or 10 to test.

        first_search = self.search[0:size_increment]  # get aggregations from here
        es_result = execute_search(self.request, first_search)

        total_results_expected = es_result['hits'].get('total', 0)
        extra_requests_needed_count = int(
            math.ceil(total_results_expected / size_increment)) - 1  # Decrease by 1 (first es_result already happened)

        if extra_requests_needed_count > 0:
            es_result['hits']['hits'] = itertools.chain(es_result['hits']['hits'],
                                                        self.get_all_subsequent_results(self.request, es_result,
                                                                                        self.search,
                                                                                        extra_requests_needed_count,
                                                                                        size_increment))
        return es_result

    def execute_search(self):
        """ Executes the search, accounting for size if necessary """
        LuceneBuilder.verify_search_has_permissions(self.request, self.search)
        if self.size == 'all':
            es_results = self.execute_search_for_all_results()
        else:
            size_search = self.search[self.from_:self.from_ + self.size]
            es_results = execute_search(self.request, size_search)
        return es_results

    def format_results(self, es_results):
        """ Takes es_results from Elasticsearch and populates a response object based on
            on the given results.

        :param es_results: search results (from elasticsearch-dsl)
        """
        # Response formatting
        self.response['notification'] = 'Success'
        self.response['total'] = es_results['hits']['total']
        self.response['facets'] = self.format_facets(es_results)
        self.response['aggregations'] = self.format_extra_aggregations(es_results)
        self.response['actions'] = self.get_collection_actions()
        columns = self.build_table_columns()
        if columns:
            self.response['columns'] = columns

        if self.size not in (None, 'all') and self.size < self.response['total']:
            params = [(k, v) for k, v in self.request.normalized_params.items() if k != 'limit']
            params.append(('limit', 'all'))
            if self.context:
                self.response['all'] = '%s?%s' % (self.request.resource_path(self.context), urlencode(params))

        # Format results, handle "child" requests special
        graph = self._format_results(es_results['hits']['hits'])
        if self.request.__parent__ is not None or self.return_generator:
            if not self.return_generator:
                self.response['@graph'] = list(graph)

        # Set @graph, save session ID for re-requests / subsequent pages.
        self.response['@graph'] = list(graph)
        if self.search_session_id:  # Is 'None' if e.g. limit=all
            self.request.response.set_cookie('searchSessionID',
                                             self.search_session_id)

    def get_response(self):
        """ Gets the response for this search, setting 404 status if necessary. """
        if not self.response:
            return {}  # XXX: rather than raise exception? -Will

        # If we got no results, return 404 or []
        if not self.response['total']:
            # http://googlewebmastercentral.blogspot.com/2014/02/faceted-navigation-best-and-5-of-worst.html
            self.request.response.status_code = 404
            self.response['notification'] = 'No results found'
            self.response['@graph'] = []
            return self.response if not self.return_generator else []

        # if this is a subrequest/gen request, return '@graph' directly
        if self.request.__parent__ is not None or self.return_generator:
            if self.return_generator:
                return self.response['@graph']

        # otherwise just hand off response
        return self.response

    def _build_query(self):
        """ Builds the query, setting self.search """
        self.initialize_search_response()
        self.build_search_query()

    def get_query(self):
        """ Grabs the search object """
        return self.search

    def _search(self):
        """ Executes the end-to-end search.

        :returns: a search response (based on the __init__ parameters)
        """
        self._build_query()
        es_results = self.execute_search()
        self.format_results(es_results)
        return self.get_response()


@view_config(route_name='search', request_method='GET', permission='search')
@debug_log
def search(context, request, search_type=None, return_generator=False, forced_type='Search', custom_aggregations=None):
    """ Search view connects to ElasticSearch and returns the results """
    search_builder = SearchBuilder(context, request, search_type, return_generator, forced_type, custom_aggregations)
    return search_builder._search()


@view_config(context=AbstractCollection, permission='list', request_method='GET')
@debug_log
def collection_view(context, request):
    """
    Simply use search results for collections views (e.g./biosamples/)
    This is a redirect directly to the search page
    """
    return search(context, request, context.type_info.name, False, forced_type='Search')


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
