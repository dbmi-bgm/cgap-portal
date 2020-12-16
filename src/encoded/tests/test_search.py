import json
import pytest
import mock

from datetime import (datetime, timedelta)
from dcicutils.misc_utils import Retry
from pyramid.httpexceptions import HTTPBadRequest
from snovault import TYPES, COLLECTIONS
from snovault.elasticsearch import create_mapping
from ..search import lucene_builder
from ..search.lucene_builder import LuceneBuilder
from ..search.search_utils import find_nested_path
from snovault.elasticsearch.indexer_utils import get_namespaced_index
from snovault.util import add_default_embeds
from snovault.schema_utils import load_schema
from webtest import AppError


pytestmark = [pytest.mark.working, pytest.mark.schema, pytest.mark.search]


### IMPORTANT
# uses the inserts in ./data/workbook_inserts
# design your tests accordingly


# just a little helper function
def recursively_find_uuids(json, uuids):
    for key, val in json.items():
        if key == 'uuid':
            uuids.add(val)
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    uuids = recursively_find_uuids(item, uuids)
        elif isinstance(val, dict):
            uuids = recursively_find_uuids(val, uuids)
    return uuids


def test_search_view(workbook, es_testapp):
    """ Test basic things about search view """
    res = es_testapp.get('/search/?type=Item').json
    assert res['@type'] == ['ItemSearchResults', 'Search']
    assert res['@id'] == '/search/?type=Item'
    assert res['@context'] == '/terms/'
    assert res['notification'] == 'Success'
    assert res['title'] == 'Search'
    assert res['total'] > 0
    assert 'facets' in res
    assert 'filters' in res
    assert '@graph' in res


def test_search_with_no_query(workbook, es_testapp):
    """
    using /search/ (with no query) should default to /search/?type=Item
    thus, should satisfy same assertions as test_search_view
    """
    res = es_testapp.get('/search/').follow(status=200)
    assert res.json['@type'] == ['ItemSearchResults', 'Search']
    assert res.json['@id'] == '/search/?type=Item'
    assert res.json['@context'] == '/terms/'
    assert res.json['notification'] == 'Success'
    assert res.json['title'] == 'Search'
    assert res.json['total'] > 0
    assert 'facets' in res
    # test default facets (data type)
    default_facets = [facet['field'] for facet in res.json['facets']]
    assert 'type' in default_facets
    # assert 'status' in default_facets uncomment this if status is added back -Will 5/13/2020
    assert 'filters' in res
    assert '@graph' in res


def test_collections_redirect_to_search(workbook, es_testapp):
    """
    we removed the collections page and redirect to search of that type
    redirected_from is not used for search
    """
    res = es_testapp.get('/user/', status=301).follow(status=200)
    assert res.json['@type'] == ['UserSearchResults', 'ItemSearchResults', 'Search']
    assert res.json['@id'] == '/search/?type=User'
    assert 'redirected_from' not in res.json['@id']
    assert res.json['@context'] == '/terms/'
    assert res.json['notification'] == 'Success'
    assert res.json['title'] == 'Search'
    assert res.json['total'] > 0
    assert 'facets' in res
    assert 'filters' in res
    assert '@graph' in res


def test_search_with_embedding(workbook, es_testapp):
    """ Searches for a family and checks members.*, an embedded field, is properly resolved """
    res = es_testapp.get('/search/?type=Family&limit=all').json
    embed = res['@graph'][0]['members']
    assert embed[0]['father']['display_title'] == 'GAPID3PW26SK'  # all are same so order does not matter
    assert embed[0]['mother']['display_title'] == 'GAPIDISC7R73'
    assert embed[1]['father']['display_title'] == 'GAPID3PW26SK'
    assert embed[1]['mother']['display_title'] == 'GAPIDISC7R73'


def test_search_with_simple_query(workbook, es_testapp):
    """
    Tests simple query string searches on CGAP using type-based
    q= and generic q=
    """
    # run a simple query with type=Disorder and q=Dummy
    res = es_testapp.get('/search/?type=Disorder&q=Dummy').json
    assert len(res['@graph']) == 3
    # get the uuids from the results
    dummy_uuids = [org['uuid'] for org in res['@graph'] if 'uuid' in org]
    # run the same search with type=Item
    res = es_testapp.get('/search/?type=Item&q=Dummy').json
    assert len(res['@graph']) >= 3
    all_uuids = [item['uuid'] for item in res['@graph'] if 'uuid' in item]
    # make sure all uuids found in the first search are present in the second
    assert set(dummy_uuids).issubset(set(all_uuids))
    # run with q=Dum returns the same hits...
    res = es_testapp.get('/search/?type=Item&q=Dum').json
    dum_uuids = [item['uuid'] for item in res['@graph'] if 'uuid' in item]
    # make sure all uuids found in the first search are present in the second
    assert set(dummy_uuids).issubset(set(dum_uuids))
    # should eliminate first and third level disorders
    res = es_testapp.get('/search/?type=Disorder&q=Sub+-Second').json
    assert len(res['@graph']) == 1
    # include first level
    res = es_testapp.get('/search/?type=Disorder&q=(Sub+-Second) | oranges').follow().json
    assert len(res['@graph']) == 2
    # exclude all
    res = es_testapp.get('/search/?type=Disorder&q=(oranges)+(apples)+(bananas)', status=404)


def test_search_ngram(workbook, es_testapp):
    """
    Tests edge-ngram related behavior with simple query string
    """
    # test search beyond max-ngram, should still give one result
    res = es_testapp.get('/search/?type=Item&q=Second+Dummy+Sub+Disorder').json
    assert len(res['@graph']) == 1
    # run search with q=Du (should get nothing since max_ngram=3)
    es_testapp.get('/search/?type=Item&q=D', status=404)
    # run search with q=ummy (should get nothing since we are using edge ngrams)
    es_testapp.get('/search/?type=Item&q=ummy', status=404)
    # test ngram on upper bound
    res1 = es_testapp.get('/search/?type=Item&q=information').json
    assert len(res1['@graph']) > 0
    # should get same results
    res2 = es_testapp.get('/search/?type=Item&q=informatio').json
    # should have same results in res1
    assert len(res1['@graph']) == len(res2['@graph'])
    # should get nothing
    es_testapp.get('/search/?type=Item&q=informatix', status=404)
    # will get same results as res1 and res2
    res3 = es_testapp.get('/search/?type=Item&q=informatioabd').json
    assert len(res2['@graph']) == len(res3['@graph'])
    # search for part of uuid common, should get all 3
    res4 = es_testapp.get('/search/?type=Disorder&q=231111bc').json
    assert len(res4['@graph']) == 3
    # search for full uuid
    res5 = es_testapp.get('/search/?type=Disorder&q=231111bc-8535-4448-903e-854af460b25').json
    assert len(res4['@graph']) == 3
    # uuid difference beyond 10
    res6 = es_testapp.get('/search/?type=Disorder&q=231111bc-89').json
    assert len(res4['@graph']) == 3
    # uuid difference at 10 (should get no results)
    es_testapp.get('/search/?type=Disorder&q=231111bc-9', status=404)


@pytest.mark.skip # XXX: What is this really testing?
def test_search_facets_and_columns_order(workbook, es_testapp):
    # TODO: Adjust ordering of mixed-in facets, perhaps sort by lookup or something, in order to un-xfail.
    test_type = 'experiment_set_replicate'
    type_info = es_testapp.app.registry[TYPES].by_item_type[test_type]
    schema = type_info.schema
    schema_facets = [('type', {'title': 'Data Type'})]
    schema_facets.extend(schema['facets'].items())
    # the following facets are added after schema facets
    schema_facets.append(('status', {'title': 'Status'}))
    # remove any disabled facets
    schema_facets = [fct for fct in schema_facets if not fct[1].get('disabled', False)]
    sort_facets = sorted(schema_facets, key=lambda fct: fct[1].get('order', 0))
    res = es_testapp.get('/search/?type=ExperimentSetReplicate&limit=all').json
    for i,val in enumerate(sort_facets):
        assert res['facets'][i]['field'] == val[0]
    # assert order of columns when we officially upgrade to python 3.6 (ordered dicts)
    for key,val in schema.get('columns', {}).items():
        assert res['columns'][key]['title'] == val['title']


@pytest.fixture
def dd_dts(es_testapp, workbook):
    # returns a dictionary of strings of various date and datetimes
    # relative to the creation date of the mboI one object in test inserts
    enz = es_testapp.get('/search/?type=Disorder&disorder_name=Dummy+Disorder').json['@graph'][0]

    cdate = enz['date_created']
    _date, _time = cdate.split('T')
    yr, mo, day = [int(i) for i in _date.split('-')]
    hr, mi, _ = _time.split(':', 2)
    hr = int(hr)
    mi = int(mi)
    createdate = datetime(yr, mo, day, hr, mi)

    return {
        'creationdatetime': ':'.join(str(createdate).replace(' ', '+').split(':')[:-1]),
        'creationdate': str(createdate.date()) + '+00:00',
        'daybefore': ':'.join(str(createdate - timedelta(days=1)).replace(' ', '+').split(':')[:-1]),
        'dayafter': ':'.join(str(createdate + timedelta(days=1)).replace(' ', '+').split(':')[:-1]),
        'hourbefore': ':'.join(str(createdate - timedelta(hours=1)).replace(' ', '+').split(':')[:-1]),
        'hourafter': ':'.join(str(createdate + timedelta(hours=1)).replace(' ', '+').split(':')[:-1])
    }


def test_search_date_range_find_within(dd_dts, es_testapp, workbook):
    # the MboI enzyme should be returned with all the provided pairs
    gres = es_testapp.get('/search/?type=Disorder&disorder_name=Dummy+Disorder').json
    g_uuids = [item['uuid'] for item in gres['@graph'] if 'uuid' in item]
    dts = {k: v.replace(':', '%3A') for k, v in dd_dts.items()}
    datepairs = [
        (dts['daybefore'], dts['dayafter']),
        (dts['creationdatetime'], dts['dayafter']),
        (dts['daybefore'], dts['creationdatetime']),
        (dts['creationdate'], dts['dayafter']),
        (dts['hourbefore'], dts['hourafter'])
    ]

    for dp in datepairs:
        search = '/search/?type=Disorder&date_created.from=%s&date_created.to=%s' % dp
        sres = es_testapp.get(search).json
        s_uuids = [item['uuid'] for item in sres['@graph'] if 'uuid' in item]
        assert set(g_uuids).issubset(set(s_uuids))


@pytest.mark.skip # XXX: how to best port?
def test_search_with_nested_integer(es_testapp, workbook):
    search0 = '/search/?type=ExperimentHiC'
    s0res = es_testapp.get(search0).json
    s0_uuids = [item['uuid'] for item in s0res['@graph'] if 'uuid' in item]

    search1 = '/search/?type=ExperimentHiC&files.file_size.to=1500'
    s1res = es_testapp.get(search1).json
    s1_uuids = [item['uuid'] for item in s1res['@graph'] if 'uuid' in item]
    assert len(s1_uuids) > 0

    search2 = '/search/?type=ExperimentHiC&files.file_size.from=1501'
    s2res = es_testapp.get(search2).json
    s2_uuids = [item['uuid'] for item in s2res['@graph'] if 'uuid' in item]
    assert len(s2_uuids) > 0

    # make sure there is no intersection of the uuids
    assert not set(s1_uuids) & set(s2_uuids)
    assert set(s1_uuids) | set(s2_uuids) == set(s0_uuids)


def test_search_date_range_dontfind_without(dd_dts, es_testapp, workbook):
    # the MboI enzyme should be returned with all the provided pairs
    dts = {k: v.replace(':', '%3A') for k, v in dd_dts.items()}
    datepairs = [
        (dts['daybefore'], dts['creationdate']),
        (dts['hourafter'], dts['dayafter']),
        (dts['daybefore'], dts['hourbefore'])
    ]
    for dp in datepairs:
        search = '/search/?type=Disorder&date_created.from=%s&date_created.to=%s' % dp
        assert es_testapp.get(search, status=404)


def test_search_query_string_AND_NOT_cancel_out(workbook, es_testapp):
    """
    Tests if you use + and - with same field you should get no result
    """
    search = '/search/?q=cell+-cell&type=Family'
    assert es_testapp.get(search, status=404)


def test_search_query_string_with_booleans(workbook, es_testapp):
    """
    Tests some search queries involving booleans on users
    """
    search = '/search/?type=User&q=HMS'
    res_stem = es_testapp.get(search).json
    assert len(res_stem['@graph']) > 1
    uuids = [r['uuid'] for r in res_stem['@graph'] if 'uuid' in r]
    wrangler_uuid = "986b362f-4eb6-4a9c-8173-3ab267307e3b"
    tester_uuid = "986b362f-4eb6-4a9c-8173-3ab267307e4c"
    # assert induced_stem_uuid not in not_induced_uuids
    # now search for stem +induced (AND is now "+")
    search_and = '/search/?type=User&q=scientist+%2Bcurrent'
    res_both = es_testapp.get(search_and).json
    both_uuids = [r['uuid'] for r in res_both['@graph'] if 'uuid' in r]
    assert len(both_uuids) == 2
    assert wrangler_uuid in both_uuids
    assert tester_uuid in both_uuids
    # search with OR ("|")
    search_or = '/search/?type=User&q=scientist+%7Ctesting'
    res_or = es_testapp.get(search_or).json
    or_uuids = [r['uuid'] for r in res_or['@graph'] if 'uuid' in r]
    assert wrangler_uuid in or_uuids
    assert tester_uuid in or_uuids
    # search with NOT ("-")
    search_not = '/search/?type=User&q=scientist+-testing'
    res_not = es_testapp.get(search_not).json
    not_uuids = [r['uuid'] for r in res_not['@graph'] if 'uuid' in r]
    assert tester_uuid not in not_uuids


# @pytest.mark.skip  # N/A?
# def test_metadata_tsv_view(workbook, htmltestapp):
#
#     FILE_ACCESSION_COL_INDEX = 3
#     FILE_DOWNLOAD_URL_COL_INDEX = 0
#
#     def check_tsv(result_rows, len_requested = None):
#         info_row = result_rows.pop(0)
#         header_row = result_rows.pop(0)
#
#         assert header_row[FILE_ACCESSION_COL_INDEX] == 'File Accession'
#         assert header_row.index('File Download URL') == FILE_DOWNLOAD_URL_COL_INDEX # Ensure we have this column
#         assert len(result_rows) > 0 # We at least have some rows.
#
#         for row_index in range(1):
#             assert len(result_rows[row_index][FILE_ACCESSION_COL_INDEX]) > 4 # We have a value for File Accession
#             assert 'http' in result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX] # Make sure it seems like a valid URL.
#             assert '/@@download/' in result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX]
#             assert result_rows[row_index][FILE_ACCESSION_COL_INDEX] in result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX] # That File Accession is also in File Download URL of same row.
#             assert len(result_rows[row_index][FILE_ACCESSION_COL_INDEX]) < len(result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX])
#
#         # Last some rows should be 'summary' rows. And have empty spaces for 'Download URL' / first column.
#         summary_start_row = None
#         for row_index, row in enumerate(result_rows):
#             if row[1] == 'Summary':
#                 summary_start_row = row_index - 1
#                 break
#
#         # Check that summary cells are present, in right place, with some correct-looking values
#         assert result_rows[summary_start_row + 1][1] == 'Summary'
#         assert result_rows[summary_start_row + 3][1] == 'Files Selected for Download:'
#         assert result_rows[summary_start_row + 4][1] == 'Total File Rows:'
#         assert result_rows[summary_start_row + 5][1] == 'Unique Downloadable Files:'
#         if len_requested:
#             assert int(result_rows[summary_start_row + 3][4]) == len_requested
#         assert int(result_rows[summary_start_row + 4][4]) == summary_start_row
#         assert int(result_rows[summary_start_row + 5][4]) <= summary_start_row
#
#
#     # run a simple GET query with type=ExperimentSetReplicate
#     res = htmltestapp.get('/metadata/type=ExperimentSetReplicate/metadata.tsv') # OLD URL FORMAT IS USED -- TESTING REDIRECT TO NEW URL
#     res = res.maybe_follow() # Follow redirect -- https://docs.pylonsproject.org/projects/webtest/en/latest/api.html#webtest.response.TestResponse.maybe_follow
#     assert 'text/tsv' in res.content_type
#     result_rows = [ row.rstrip(' \r').split('\t') for row in res.body.decode('utf-8').split('\n') ] # Strip out carriage returns and whatnot. Make a plain multi-dim array.
#
#     check_tsv(result_rows)
#
#     # Perform POST w/ accession triples (main case, for BrowseView downloads)
#     res2_post_data = { # N.B. '.post', not '.post_json' is used. This dict is converted to POST form values, with key values STRINGIFIED, not to POST JSON request.
#         "accession_triples" : [
#             ["4DNESAAAAAA1","4DNEXO67APU1","4DNFIO67APU1"],
#             ["4DNESAAAAAA1","4DNEXO67APU1","4DNFIO67APT1"],
#             ["4DNESAAAAAA1","4DNEXO67APT1","4DNFIO67APV1"],
#             ["4DNESAAAAAA1","4DNEXO67APT1","4DNFIO67APY1"],
#             ["4DNESAAAAAA1","4DNEXO67APV1","4DNFIO67APZ1"],
#             ["4DNESAAAAAA1","4DNEXO67APV1","4DNFIO67AZZ1"]
#         ],
#         'download_file_name' : 'metadata_TEST.tsv'
#     }
#
#     res2 = htmltestapp.post('/metadata/?type=ExperimentSetReplicate', { k : json.dumps(v) for k,v in res2_post_data.items() }) # NEWER URL FORMAT
#
#     assert 'text/tsv' in res2.content_type
#     result_rows = [ row.rstrip(' \r').split('\t') for row in res2.body.decode('utf-8').split('\n') ]
#
#     check_tsv(result_rows, len(res2_post_data['accession_triples']))


def test_default_schema_and_non_schema_facets(workbook, es_testapp):
    test_type = 'user'
    type_info = es_testapp.app.registry[TYPES].by_item_type[test_type]
    schema = type_info.schema
    embeds = add_default_embeds(test_type, es_testapp.app.registry[TYPES], type_info.embedded_list, schema)
    # we're looking for this specific facet, which is not in the schema
    assert 'institution.display_title' in embeds
    res = es_testapp.get('/search/?type=User&institution.display_title=HMS+DBMI').json
    assert 'facets' in res
    facet_fields = [ facet['field'] for facet in res['facets'] ]
    # assert 'type' in facet_fields uncomment this if we decide type should exist when searching on a single type
    # assert 'status' in facet_fields uncomment this if status is added back -Will 5/13/2020
    for facet in schema['facets'].keys():
        if not schema['facets'][facet].get('hide_from_view'):
            assert facet in facet_fields
    # now ensure that facets can also be created outside of the schema
    assert 'institution.display_title' in facet_fields


def test_search_query_string_no_longer_functional(workbook, es_testapp):
    # since we now use simple_query_string, cannot use field:value or range
    # expect 404s, since simple_query_string doesn't return exceptions
    search_field = '/search/?q=name%3Ahuman&type=Item'
    res_field = es_testapp.get(search_field, status=404)
    assert len(res_field.json['@graph']) == 0

    search_range = '/search/?q=date_created%3A>2018-01-01&type=Item'
    res_search = es_testapp.get(search_range, status=404)
    assert len(res_search.json['@graph']) == 0

def test_search_with_added_display_title(workbook, es_testapp):
    search = '/search/?type=Individual&father=GAPID3PW26SK'
    # 301 because search query is changed
    res_json = es_testapp.get(search, status=301).follow(status=200).json
    assert res_json['@id'] == '/search/?type=Individual&father.display_title=GAPID3PW26SK'
    added_facet = [fct for fct in res_json['facets'] if fct['field'] == 'father.display_title']
    # new facet uses the title from schema
    added_title = es_testapp.app.registry[TYPES]['Individual'].schema['properties']['father']['title']
    assert added_facet[0]['title'] == added_title
    indvs = [indv['uuid'] for indv in res_json['@graph']]

    # make sure the search result is the same for the explicit query
    res_json2 = es_testapp.get(res_json['@id']).json
    indvs2 = [indv['uuid'] for indv in res_json2['@graph']]
    assert set(indvs) == set(indvs2)

    # 'sort' also adds display_title for ascending and descending queries
    for use_sort in ['father', '-father']:
        search = '/search/?type=Individual&sort=%s' % use_sort
        res_json = es_testapp.get(search, status=301).follow(status=200).json
        assert res_json['@id'] == '/search/?type=Individual&sort=%s.display_title' % use_sort

    # regular sort queries remain unchanged
    search = '/search/?type=Individual&sort=uuid'
    res_json = es_testapp.get(search).json
    assert res_json['@id'] == '/search/?type=Individual&sort=uuid'

    # check to see that added facet doesn't conflict with existing facet title
    # query below will change to file_format.display_title=fastq
    search = '/search/?type=File&file_format=fastq'
    res_json = es_testapp.get(search, status=301).follow(status=200).json
    assert res_json['@id'] == '/search/?type=File&file_format.display_title=fastq'
    # find title from schema
    ff_title = es_testapp.app.registry[TYPES]['File'].schema['properties']['file_format']['title']
    existing_ff_facet = [fct for fct in res_json['facets'] if fct['field'] == 'file_format.file_format']
    assert existing_ff_facet[0]['title'] == ff_title
    added_ff_facet = [fct for fct in res_json['facets'] if fct['field'] == 'file_format.display_title']
    assert added_ff_facet[0]['title'] == ff_title + ' (Title)'


def test_search_with_no_value(workbook, es_testapp):
    search = '/search/?comment=No+value&comment=This+comment+is+to+test+oranges&type=Disorder'
    res_json = es_testapp.get(search).json
    # grab some random results
    for item in res_json['@graph']:
        maybe_null = item.get('comment')
        assert( maybe_null is None or maybe_null == 'This comment is to test oranges')
    res_ids = [r['uuid'] for r in res_json['@graph'] if 'uuid' in r]
    search2 = '/search/?comment=This+comment+is+to+test+apples&type=Disorder'
    res_json2 = es_testapp.get(search2).json
    # just do 1 res here
    check_item = res_json2['@graph'][0]
    assert(check_item.get('comment') == 'This comment is to test apples')
    res_ids2 = [r['uuid'] for r in res_json2['@graph'] if 'uuid' in r]
    assert(set(res_ids2) != set(res_ids))


def test_search_with_static_header(workbook, es_testapp, indexer_testapp):
    """ Performs a search which should be accompanied by a search header """
    indexer_testapp.post_json('/index', {'record': False})  # try to ensure static_sections are indexed

    # No items, just checking header
    search = '/search/?type=Workflow'
    res_json = es_testapp.get(search, status=404).json
    assert 'search_header' in res_json
    assert 'content' in res_json['search_header']
    assert res_json['search_header']['title'] == 'Workflow Information'

    # Check snake_case type resolution (should redirect to CamelCase)
    search = '/search/?type=workflow'
    res_json = es_testapp.get(search, status=404).json
    assert 'search_header' in res_json
    assert 'content' in res_json['search_header']
    assert res_json['search_header']['title'] == 'Workflow Information'


def test_search_multiple_types(workbook, es_testapp):
    """ Note that the behavior now is in '@type' will be the highest common ancestor if searched on multiple types """
    search = '/search/?type=Individual&type=Workflow'
    res = es_testapp.get(search).json
    assert res['@type'] == ['ItemSearchResults', 'Search']


#########################################
## Tests for collections (search 301s) ##
#########################################

def test_collection_limit(workbook, es_testapp):
    res = es_testapp.get('/user/?limit=1', status=301)
    assert len(res.follow().json['@graph']) == 1


def test_collection_actions_filtered_by_permission(workbook, es_testapp, anon_es_testapp):
    res = es_testapp.get('/user/')
    assert any(action for action in res.follow().json.get('actions', []) if action['name'] == 'add')

    # users not visible
    res = anon_es_testapp.get('/user/', status=404)
    assert len(res.json['@graph']) == 0


@Retry.retry_allowed('test_index_data_workbook.check', wait_seconds=1, retries_allowed=5)
def check_item_type(client, item_type):
    # This might get a 404 if not enough time has elapsed, so try a few times before giving up.
    return client.get('/%s?limit=all' % item_type, status=[200, 301]).follow()


def test_index_data_workbook(workbook, es_testapp, html_es_testapp):
    es = es_testapp.app.registry['elasticsearch']
    # we need to reindex the collections to make sure numbers are correct
    create_mapping.run(es_testapp.app, sync_index=True)
    # check counts and ensure they're equal
    es_testapp_counts = es_testapp.get('/counts')
    # e.g., {"db_es_total": "DB: 748 ES: 748 ", ...}
    db_es_total = es_testapp_counts.json['db_es_total']
    split_counts = db_es_total.split()
    db_total = int(split_counts[1])
    es_total = int(split_counts[3])
    assert(db_total == es_total)  # 2nd is db, 4th is es
    # e.g., {..., "db_es_compare": {"AnalysisStep": "DB: 26 ES: 26 ", ...}, ...}
    for item_name, item_counts in es_testapp_counts.json['db_es_compare'].items():
        print("item_name=", item_name, "item_counts=", item_counts)
        # make sure counts for each item match ES counts
        split_item_counts = item_counts.split()
        db_item_count = int(split_item_counts[1])
        es_item_count = int(split_item_counts[3])
        assert db_item_count == es_item_count

        # check ES counts directly. Must skip abstract collections
        # must change counts result ("ItemName") to item_type format
        item_type = es_testapp.app.registry[COLLECTIONS][item_name].type_info.item_type
        namespaced_index = get_namespaced_index(es_testapp.app, item_type)

        es_direct_count = es.count(index=namespaced_index, doc_type=item_type).get('count')
        assert es_item_count == es_direct_count

        if es_item_count == 0:
            continue

        # check items in search result individually
        search_url = '/%s?limit=all' % item_type
        print("search_url=", search_url)
        res = check_item_type(client=es_testapp, item_type=item_type)
        for item_res in res.json.get('@graph', []):
            index_view_res = es.get(index=namespaced_index, doc_type=item_type,
                                    id=item_res['uuid'])['_source']
            # make sure that the linked_uuids match the embedded data
            assert 'linked_uuids_embedded' in index_view_res
            assert 'embedded' in index_view_res
            found_uuids = recursively_find_uuids(index_view_res['embedded'], set())
            # all found uuids must be within the linked_uuids
            assert found_uuids <= set([link['uuid'] for link in index_view_res['linked_uuids_embedded']])
            # if uuids_rev_linking to me, make sure they show up in @@links
            if len(index_view_res.get('uuids_rev_linked_to_me', [])) > 0:
                links_res = es_testapp.get('/' + item_res['uuid'] + '/@@links', status=200)
                link_uuids = [lnk['uuid'] for lnk in links_res.json.get('uuids_linking_to')]
                assert set(index_view_res['uuids_rev_linked_to_me']) <= set(link_uuids)
            # previously test_html_pages
            try:
                html_res = html_es_testapp.get(item_res['@id'])
                assert html_res.body.startswith(b'<!DOCTYPE html>')
            except Exception as e:
                pass


class MockedRequest(object):
    """ Test object intended to be used to mock certain aspects of requests. Takes kwargs which
        will be passed as named fields to MockedRequest. More arguments could be added if other
        use is seen.
    """
    def __init__(self, **kwargs):
        if 'principals_allowed' not in kwargs:
            self.effective_principals = ['system.Everyone']
        else:
            self.effective_principals = kwargs['principals_allowed']  # note this is not exactly what the field is


@pytest.fixture
def hacked_query():
    """ This is valid lucene that will have 'principals_allowed.view' that differs from what is on the request.
        Our helper method should detect such change and throw an error. """
    return {'query': {'bool': {'filter': [{'bool': {'must': [{'terms':
                     {'principals_allowed.view': ['system.Everyone', 'group.PERMISSION_YOU_DONT_HAVE']}}]}}]}}}


def test_search_with_hacked_query(workbook, anon_es_testapp, hacked_query):
    """ Attempts to execute what is considered a 'bad query' in a MockedRequest context. Our
        verification function should throw an exception if there is any delta in the permissions object
        we explicitly attach to every search query.
    """
    with mock.patch.object(lucene_builder, 'convert_search_to_dictionary', return_value=hacked_query):
        mocked_request_with_least_permissive_permissions = MockedRequest()
        with pytest.raises(HTTPBadRequest):
            LuceneBuilder.verify_search_has_permissions(mocked_request_with_least_permissive_permissions, None)
        mocked_request_with_same_permissions = MockedRequest(principals_allowed=['system.Everyone',
                                                                                 'group.PERMISSION_YOU_DONT_HAVE'])
        LuceneBuilder.verify_search_has_permissions(mocked_request_with_same_permissions, None)


def test_search_with_principals_allowed_fails(workbook, anon_es_testapp):
    """ Tests query with a query string parameter for principals_allowed.view, which will be AND'd with what's
        on the request.

        XXX IMPORTANT: Since we do permissions in a restrictive way, this works - if our permissions structure is
        modified, it is possible this behavior will need to be revisited -Will 4-24-2020
    """
    with pytest.raises(AppError):
        anon_es_testapp.get('/search/?type=Item&principals_allowed.view=group.PERMISSION_YOU_DONT_HAVE')
    with pytest.raises(AppError):
        anon_es_testapp.get('/search/?type=Family'
                        '&proband.display_title=GAPID8J9B9CR'
                        '&principals_allowed.view=group.PERMISSION_YOU_DONT_HAVE')
    with pytest.raises(AppError):
        anon_es_testapp.get('/search/?type=Gene'
                        '&principals_allowed.view=group.PERMISSION_YOU_DONT_HAVE')


def test_search_debug_parameter(workbook, es_testapp, anon_es_testapp, authenticated_es_testapp):
    """ Tests that utilizing the query debug parameter works correctly with admin only. """
    resp_with_debug = es_testapp.get('/search/?type=Family&debug=true', status=200).json
    assert 'query' in resp_with_debug
    # no results should still show query
    resp_with_debug = es_testapp.get('/search/?type=Gene&debug=true', status=404).json
    assert 'query' in resp_with_debug
    # doesn't matter what you pass
    resp_with_debug = es_testapp.get('/search/?type=Gene&debug=blah', status=404).json
    assert 'query' in resp_with_debug
    # no results, no admin, no query
    resp_without_debug = anon_es_testapp.get('/search/?type=Family&debug=true', status=404).json
    assert 'query' not in resp_without_debug
    # authenticated but no admin, no query
    resp_without_debug = authenticated_es_testapp.get('/search/?type=Family&debug=true', status=200).json
    assert 'query' not in resp_without_debug


@pytest.fixture
def sample_processing_mapping():
    return load_schema('encoded:tests/data/sample_processing_mapping.json')


@pytest.mark.parametrize('field, nested_path', [
    ('bad_field', None),
    ('embedded.@id', None),
    ('embedded.date_created', None),
    ('embedded.cases', 'embedded.cases'),  # not meaningful but should still work
    ('embedded.cases.@id', 'embedded.cases'),
    ('embedded.cases.principals_allowed.edit', 'embedded.cases'),
    ('embedded.families.display_title', 'embedded.families'),
    ('embedded.samples.processed_files.display_title', 'embedded.samples.processed_files')
])
def test_find_nested_path(sample_processing_mapping, field, nested_path):
    """ Tests that we can correctly resolve nested paths in a few different field scenarios given a
        non-trivial mapping.
    """
    es_mapping = sample_processing_mapping['sample_processing']['mappings']['sample_processing']
    assert find_nested_path(field, es_mapping) == nested_path


class TestNestedSearch(object):
    """ This class encapsulates all helper methods and tests needed to test out nested searches """

    @staticmethod
    def assert_length_is_expected(result, expected):
        assert len(result['@graph']) == expected

    @staticmethod
    def verify_facet(facets, name, count):
        """ Checks that a given facet name has the correct number of terms """
        for facet in facets:
            if facet['field'] == name:
                assert len(facet['terms']) == count
                return

    def test_search_on_single_nested_field(self, workbook, es_testapp):
        """ One match for variant with hg19.hg19_pos=12185955 """
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_pos=12185955').json
        self.assert_length_is_expected(res, 1)
        assert res['@graph'][0]['uuid'] == 'f6aef055-4c88-4a3e-a306-d37a71535d8b'

    def test_or_search_on_same_nested_field(self, workbook, es_testapp):
        """ Should match 2 since OR on this field """
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_hgvsg=NC_000001.11:g.12185956del'
                          '&hg19.hg19_hgvsg=NC_000001.11:g.11901816A>T').follow().json
        self.assert_length_is_expected(res, 2)
        for variant in res['@graph']:
            assert variant['uuid'] in ['f6aef055-4c88-4a3e-a306-d37a71535d8b', '852bb349-203e-437d-974a-e8d6cb56810a']

    def test_and_search_on_nested_field_that_does_not_match(self, workbook, es_testapp):
        """ This has a chrom value that does not match the position, so will give no results """
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=12185955'
                    '&hg19.hg19_chrom=chr3', status=404)

    def test_and_search_on_nested_field_that_matches_one(self, workbook, es_testapp):
        """ This has the correct 'hg19_chrom', so should match one """
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_pos=12185955'
                          '&hg19.hg19_chrom=chr1').json
        self.assert_length_is_expected(res, 1)
        assert res['@graph'][0]['uuid'] == 'f6aef055-4c88-4a3e-a306-d37a71535d8b'

    def test_or_search_on_nested_hg_19_multiple_match(self, workbook, es_testapp):
        """ Do an OR search on hg19.hg19_chrom, matching three variants """
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_chrom=chr1').json
        self.assert_length_is_expected(res, 3)
        for variant in res['@graph']:
            assert variant['uuid'] in [
                'f6aef055-4c88-4a3e-a306-d37a71535d8b',
                '852bb349-203e-437d-974a-e8d6cb56810a',
                '842b1b54-32fb-4ff3-bfd1-c5b51bc35d7f'
            ]

    def test_negative_search_on_clinic_notes(self, workbook, es_testapp):
        """ Do an OR search with hg19_post with a negative, should eliminate a variant """
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_chrom=chr1'
                          '&hg19.hg19_pos!=12185955').follow().json
        self.assert_length_is_expected(res, 2)
        for variant in res['@graph']:
            assert variant['uuid'] in [
                '852bb349-203e-437d-974a-e8d6cb56810a',
                '842b1b54-32fb-4ff3-bfd1-c5b51bc35d7f'
            ]

    def test_and_search_that_matches_one(self, workbook, es_testapp):
        """ Check three properties that occur in the same sub-embedded object in 1 variant """
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_chrom=chr1'
                          '&hg19.hg19_pos=12185955'
                          '&hg19.hg19_hgvsg=NC_000001.11:g.12185956del').follow().json
        self.assert_length_is_expected(res, 1)
        assert res['@graph'][0]['uuid'] == 'f6aef055-4c88-4a3e-a306-d37a71535d8b'
        es_testapp.get('/search/?type=Variant'  # should give no results
                    '&hg19.hg19_chrom=chr2'  # change should be sufficient for no results
                    '&hg19.hg19_pos=12185955'
                    '&hg19.hg19_hgvsg=NC_000001.11:g.12185956del', status=404)

    @pytest.mark.skip  # re-enable once workbook inserts are built out more
    def test_and_search_that_matches_multiple(self, workbook, es_testapp):
        """ Check two properties that occur in the same sub-embedded object in 3 variants """
        res = es_testapp.get('/search/?type=Variant'
                          '&families.members.mother.display_title=GAPIDISC7R73'
                          '&families.members.father.display_title=GAPID3PW26SK').json
        self.assert_length_is_expected(res, 3)

    def test_and_search_on_three_fields(self, workbook, es_testapp):
        """ OR search that will match all variants with these fields"""
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_chrom=chr1'
                          '&hg19.hg19_pos=12185955'
                          '&hg19.hg19_pos=11901816'
                          '&hg19.hg19_pos=11780388'
                          '&hg19.hg19_hgvsg=NC_000001.11:g.12185956del'
                          '&hg19.hg19_hgvsg=NC_000001.11:g.11901816A>T'
                          '&hg19.hg19_hgvsg=NC_000001.11:g.11780388G>A').follow().json
        self.assert_length_is_expected(res, 3)
        for variant in res['@graph']:
            assert variant['uuid'] in [
                'f6aef055-4c88-4a3e-a306-d37a71535d8b',
                '852bb349-203e-437d-974a-e8d6cb56810a',
                '842b1b54-32fb-4ff3-bfd1-c5b51bc35d7f'
            ]

    def test_search_with_non_existant_combinations(self, workbook, es_testapp):
        """ Test that swapping around fields that would match across different sub-embedded objects
            does not actually do so (ie: returns no results). """
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=12185955'
                    '&hg19.hg19_hgvsg=NC_000001.11:g.11901816A>T', status=404)
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=11901816'
                    '&hg19.hg19_hgvsg=NC_000001.11:g.11780388G>A', status=404)
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=11780388'
                    '&hg19.hg19_hgvsg=NC_000001.11:g.12185956del', status=404)

    def test_nested_search_with_no_value(self, workbook, es_testapp):
        """ Tests searching on 'No value' alone on a nested field """
        res = es_testapp.get('/search/?type=Variant'
                          '&hg19.hg19_chrom!=No+value').follow().json
        self.assert_length_is_expected(res, 3)

    def test_nested_search_with_no_value_combined(self, workbook, es_testapp):
        """ Tests searching on 'No value' combined with another nested field, in this case
            should give no results (no matter the ordering) """
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=No+value'
                    '&hg19.hg19_hgvsg=NC_000001.11:g.12185956del', status=404)
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=No+value'
                    '&hg19.hg19_hgvsg=NC_000001.11:g.11780388G>A', status=404)
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=No+value'
                    '&hg19.hg19_hgvsg=NC_000001.11:g.12185956del', status=404)
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos=11780388'
                    '&hg19.hg19_hgvsg=No+value', status=404)

    def test_search_nested_with_non_nested_fields(self, workbook, es_testapp):
        """ Tests that combining a nested search with a non-nested one works in any order
            NOTE: this test used to be broken due to incorrect behavior with No+value.
            It is assumed that if you are selecting on a facet positively or negatively that
            you only want to consider items that have the field defined. Previously we would not enforce
            this and have queries like this match variants that do not have an hg19 field.
        """
        es_testapp.get('/search/?type=Variant'
                    '&hg19.hg19_pos!=11720331'
                    '&POS=88832', status=404)
        es_testapp.get('/search/?type=Variant'
                    '&POS=88832&hg19.hg19_pos!=11720331', status=404)
        res = es_testapp.get('/search/?type=Variant'
                          '&POS=88832&hg19.hg19_pos!=11720331&hg19.hg19_pos=No+value').follow().json
        self.assert_length_is_expected(res, 1)
        assert res['@graph'][0]['uuid'] == 'cedff838-99af-4936-a0ae-4dfc63ba8bf4'

    def test_search_nested_no_value_with_multiple_other_fields(self, workbook, es_testapp):
        """ Tests that combining a 'No value' search with another nested search and a different non-nested
            field works correctly """
        res = es_testapp.get('/search/?type=Variant'
                          '&POS=88832'
                          '&REF=A').json
        self.assert_length_is_expected(res, 1)
        assert res['@graph'][0]['uuid'] == 'cedff838-99af-4936-a0ae-4dfc63ba8bf4'
        es_testapp.get('/search/?type=Variant'
                    '&POS=88832'
                    '&hg19.hg19_pos=No+value'
                    '&REF=G', status=404)  # REF should disqualify

    def test_search_nested_facets_are_correct(self, workbook, es_testapp):
        """ Tests that nested facets are properly rendered both on a normal search and when selecting on
            nested facets. When examining the aggregations on a field we are searching on, we should see
            the cardinality of the field.
            When examining the aggregations on a field we are not searching on, it possible/likely that
            the set of possible results has been reduced by the search.
        """
        facets = es_testapp.get('/search/?type=Variant').json['facets']
        self.verify_facet(facets, 'hg19.hg19_chrom', 1)  # 1 option for chrom
        self.verify_facet(facets, 'hg19.hg19_pos', 3)  # 3 options for pos, hgvsg
        self.verify_facet(facets, 'hg19.hg19_hgvsg', 3)

        # selecting a facet in search does not affect the cardinality of the aggregation on that facet (alone)
        facets_that_should_show_all_options = es_testapp.get(
            '/search/?type=Variant&hg19.hg19_hgvsg=NC_000001.11:g.12185956del').follow().json['facets']
        self.verify_facet(facets_that_should_show_all_options, 'hg19.hg19_hgvsg', 3)  # still 3 options

        # selecting two facets has the same behavior
        facets_that_should_show_all_options = es_testapp.get(
            '/search/?type=Variant&hg19.hg19_hgvsg=NC_000001.11:g.12185956del'
            '&hg19.hg19_hgvsg=NC_000001.11:g.11780388G>A').follow().json['facets']
        self.verify_facet(facets_that_should_show_all_options, 'hg19.hg19_hgvsg', 3)  # still 3 options

        # selecting a different facet can affect the aggregation if it just so happens to eliminate
        # possibilities in other fields - this has always been the case
        facets_that_shows_limited_options = es_testapp.get(
            '/search/?type=Variant&hg19.hg19_pos=11780388').json['facets']
        self.verify_facet(facets_that_shows_limited_options, 'hg19.hg19_hgvsg', 1)  # reduced to only 1 option

    def test_search_nested_exists_query(self, workbook, es_testapp):
        """ Tests doing a !=No+value search on a nested sub-field. """
        es_testapp.get('/search/?type=SampleProcessing&samples.uuid!=No+value', status=404)

    def test_search_nested_field_no_value(self, workbook, es_testapp):
        """ Tests that we can do item.sub_embedded_object=No+value and get correct results
            Note that there is 1 variant with no hg19 sub embedded object and 3 variants that
            have the annotation.
        """
        res = es_testapp.get('/search/?type=Variant&hg19=No+value').json
        self.assert_length_is_expected(res, 1)
        res = es_testapp.get('/search/?type=Variant&hg19!=No+value').follow().json
        self.assert_length_is_expected(res, 3)


@pytest.fixture(scope='session')
def hidden_facet_data_one():
    """ Sample TestingHiddenFacets object we are going to facet on """
    return {
        'first_name': 'John',
        'last_name': 'Doe',
        'sid': 1,
        'unfaceted_string': 'hello',
        'unfaceted_integer': 123,
        'disabled_string': 'orange',
        'disabled_integer': 789,
        'unfaceted_object': {
            'mother': 'Anne',
            'father': 'Bob'
        },
        'unfaceted_array_of_objects': [
            {
                'fruit': 'orange',
                'color': 'orange',
                'uid': 1
            },
            {
                'fruit': 'banana',
                'color': 'yellow',
                'uid': 2
            },
        ]
    }


@pytest.fixture(scope='session')
def hidden_facet_data_two():
    """ A second sample TestingHiddenFacets object we are going to facet on """
    return {
        'first_name': 'Boston',
        'last_name': 'Bruins',
        'sid': 2,
        'unfaceted_string': 'world',
        'unfaceted_integer': 456,
        'disabled_string': 'apple',
        'disabled_integer': 101112,
        'unfaceted_object': {
            'mother': 'Candice',
            'father': 'Doug'
        },
        'unfaceted_array_of_objects': [
            {
                'fruit': 'blueberry',
                'color': 'blue',
                'uid': 3
            },
            {
                'fruit': 'mango',
                'color': 'yellow',
                'uid': 4
            },
        ]
    }


@pytest.fixture(scope='session')  # XXX: consider scope further - Will 11/5/2020
def hidden_facet_test_data(workbook, es_testapp, hidden_facet_data_one, hidden_facet_data_two):
    es_testapp.post_json('/TestingHiddenFacets', hidden_facet_data_one, status=201)
    es_testapp.post_json('/TestingHiddenFacets', hidden_facet_data_two, status=201)
    es_testapp.post_json('/index', {'record': False})


class TestSearchHiddenAndAdditionalFacets:
    """ Encapsulates tests meant for testing behavior associated with default_hidden, hidden
        and additional_facets
    """
    DEFAULT_FACETS = ['first_name', 'validation_errors.name']
    DEFAULT_HIDDEN_FACETS = ['last_name', 'sid']
    ADDITIONAL_FACETS = ['unfaceted_string', 'unfaceted_integer']
    DISABLED_FACETS = ['disabled_string', 'disabled_integer']

    @staticmethod
    def check_and_verify_result(facets, desired_facet, number_expected):
        """ Helper method for later tests that checks terms count and average. """
        for facet in facets:
            field = facet['field']
            if field == desired_facet and 'terms' in facet:
                assert len(facet['terms']) == number_expected
            elif field == facet and 'avg' in facet:
                assert facet['avg'] == number_expected
            else:
                continue
            break

    @staticmethod
    def assert_facet_set_equal(expected, facets):
        """ Takes list of expect results and raw facet response and checks that they
            are identical. """
        assert sorted(expected) == sorted([facet['field'] for facet in facets])

    def test_search_default_hidden_facets_dont_show(self, workbook, es_testapp, hidden_facet_test_data):
        facets = es_testapp.get('/search/?type=TestingHiddenFacets').json['facets']
        self.assert_facet_set_equal(self.DEFAULT_FACETS, facets)

    @pytest.mark.parametrize('facet', ADDITIONAL_FACETS)
    def test_search_one_additional_facet(self, workbook, es_testapp, hidden_facet_test_data, facet):
        """ Tests that specifying each of the 'additional' facets works correctly """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets&additional_facet=%s' % facet).json['facets']
        expected = self.DEFAULT_FACETS + [facet]
        self.assert_facet_set_equal(expected, facets)

    def test_search_multiple_additional_facets(self, workbook, es_testapp, hidden_facet_test_data):
        """ Tests that enabling multiple additional facets works """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets'
                             '&additional_facet=unfaceted_string'
                             '&additional_facet=unfaceted_integer').json['facets']
        expected = self.DEFAULT_FACETS + self.ADDITIONAL_FACETS
        self.assert_facet_set_equal(expected, facets)
        for facet in facets:  # verify facet type
            if facet['field'] == 'unfaceted_integer':
                assert facet['aggregation_type'] == 'stats'
            else:  # facet['field'] == 'unfaceted_string'
                assert facet['aggregation_type'] == 'terms'

    @pytest.mark.parametrize('facet', DEFAULT_HIDDEN_FACETS)
    def test_search_one_additional_default_hidden_facet(self, workbook, es_testapp, hidden_facet_test_data, facet):
        """ Tests that passing default_hidden facets to additional_facets works correctly """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets&additional_facet=%s' % facet).json['facets']
        expected = self.DEFAULT_FACETS + [facet]
        self.assert_facet_set_equal(expected, facets)

    def test_search_multiple_additional_default_hidden_facets(self, workbook, es_testapp, hidden_facet_test_data):
        """ Tests that passing multiple hidden_facets as additionals works correctly """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets'
                             '&additional_facet=last_name'
                             '&additional_facet=sid').json['facets']
        expected = self.DEFAULT_FACETS + self.DEFAULT_HIDDEN_FACETS
        self.assert_facet_set_equal(expected, facets)
        for facet in facets:
            if facet['field'] == 'sid':
                assert facet['aggregation_type'] == 'stats'
            else:
                assert facet['aggregation_type'] == 'terms'

    @pytest.mark.parametrize('_facets', [
        ['last_name', 'unfaceted_integer'],  # second slot holds number field
        ['unfaceted_string', 'sid']
    ])
    def test_search_mixing_additional_and_default_hidden(self, workbook, es_testapp, hidden_facet_test_data, _facets):
        """ Tests that we can mix additional_facets with those both on and off schema """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets'
                             '&additional_facet=%s'
                             '&additional_facet=%s' % (_facets[0], _facets[1])).json['facets']
        expected = self.DEFAULT_FACETS + _facets
        self.assert_facet_set_equal(expected, facets)
        for facet in facets:
            if facet['field'] == _facets[1]:  # second slot holds number field
                assert facet['aggregation_type'] == 'stats'
            else:
                assert facet['aggregation_type'] == 'terms'

    @pytest.mark.parametrize('_facet', DISABLED_FACETS)
    def test_search_disabled_overrides_additional(self, workbook, es_testapp, hidden_facet_test_data, _facet):
        """ Hidden facets should NEVER be faceted on """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets&additional_facet=%s' % _facet).json['facets']
        field_names = [facet['field'] for facet in facets]
        assert _facet not in field_names  # always hidden should not be here, even if specified

    @pytest.mark.parametrize('_facets', [
        ('last_name', 'unfaceted_integer', 'disabled_integer'),  # default_hidden second
        ('sid', 'unfaceted_string', 'disabled_string')  # disabled always last
    ])
    def test_search_additional_mixing_disabled_default_hidden(self, workbook, es_testapp, hidden_facet_test_data, _facets):
        """ Tests that supplying multiple additional facets combined with hidden still respects the
            hidden restriction. """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets'
                             '&additional_facet=%s'
                             '&additional_facet=%s' 
                             '&additional_facet=%s' % (_facets[0], _facets[1], _facets[2])).json['facets']
        expected = self.DEFAULT_FACETS + [_facets[0], _facets[1]]  # first two should show
        self.assert_facet_set_equal(expected, facets)

    @pytest.mark.parametrize('_facet', [
        'unfaceted_object.mother',
        'unfaceted_object.father'
    ])
    def test_search_additional_object_facets(self, workbook, es_testapp, hidden_facet_test_data, _facet):
        """ Tests that specifying an object field as an additional_facet works correctly """
        facets = es_testapp.get('/search/?type=TestingHiddenFacets'
                             '&additional_facet=%s' % _facet).json['facets']
        expected = self.DEFAULT_FACETS + [_facet]
        self.assert_facet_set_equal(expected, facets)

    @pytest.mark.parametrize('_facet, n_expected', [
        ('unfaceted_array_of_objects.fruit', 4),
        ('unfaceted_array_of_objects.color', 3),
        ('unfaceted_array_of_objects.uid', 2.5)  # stats avg
    ])
    def test_search_additional_nested_facets(self, workbook, es_testapp, hidden_facet_test_data, _facet, n_expected):
        """ Tests that specifying an array of object field mapped with nested as an additional_facet
            works correctly. """
        [desired_facet] = [facet for facet in es_testapp.get('/search/?type=TestingHiddenFacets'
                                                          '&additional_facet=%s' % _facet).json['facets']
                           if facet['field'] == _facet]
        if 'terms' in desired_facet:
            assert len(desired_facet['terms']) == n_expected
        else:
            assert desired_facet['avg'] == n_expected

    @pytest.fixture
    def many_non_nested_facets(self, workbook, es_testapp, hidden_facet_test_data):
        return es_testapp.get('/search/?type=TestingHiddenFacets'  
                           '&additional_facet=non_nested_array_of_objects.fruit'
                           '&additional_facet=non_nested_array_of_objects.color'
                           '&additional_facet=non_nested_array_of_objects.uid').json['facets']

    @pytest.mark.parametrize('_facet, n_expected', [
        ('unfaceted_array_of_objects.fruit', 4),
        ('unfaceted_array_of_objects.color', 3),
        ('unfaceted_array_of_objects.uid', 2.5)  # stats avg
    ])
    def test_search_additional_non_nested_facets(self, many_non_nested_facets, _facet, n_expected):
        """ Tests trying to facet on an array of objects field that is not nested, requesting
            all at the same time.
        """
        self.check_and_verify_result(many_non_nested_facets, _facet, n_expected)

    @pytest.mark.parametrize('_facet, n_expected', [
        ('hg19.hg19_pos', 11956053.0),  # avg of positions, not meaningful
        ('hg19.hg19_chrom', 1),
        ('hg19.hg19_hgvsg', 3),
        ('REF', 3)
    ])
    def test_search_additional_facets_workbook(self, workbook, es_testapp, _facet, n_expected):
        """ Tests using additional facets with workbook inserts (using Variant) """
        variant_facets = es_testapp.get('/search/?type=Variant&additional_facet=%s' % _facet).json['facets']
        self.check_and_verify_result(variant_facets, _facet, n_expected)

    @pytest.fixture(scope='module')
    def variant_facets(self, workbook, es_testapp):
        return es_testapp.get('/search/?type=Variant'
                           '&additional_facet=hg19.hg19_pos'
                           '&additional_facet=hg19.hg19_chrom'
                           '&additional_facet=hg19.hg19_hgvsg'
                           '&additional_facet=REF').json['facets']

    @pytest.mark.parametrize('_facet, n_expected', [
        ('hg19.hg19_pos', 11956053.0),  # avg of positions, not meaningful
        ('hg19.hg19_chrom', 1),
        ('hg19.hg19_hgvsg', 3),
        ('REF', 3)
    ])
    def test_search_additional_facets_workbook_multiple(self, workbook, es_testapp, _facet, n_expected):
        """ Does all 4 extra aggregations above, checking the resulting facets for correctness """
        res = es_testapp.get('/search/?type=Variant'
                           '&additional_facet=hg19.hg19_pos'
                           '&additional_facet=hg19.hg19_chrom'
                           '&additional_facet=hg19.hg19_hgvsg'
                           '&additional_facet=REF').json['facets']
        self.check_and_verify_result(res, _facet, n_expected)


@pytest.fixture(scope='session')
def bucket_range_data_raw():
    """ 10 objects with a numerical field we will bucket on.
            'special_integer' has i in it.
            'special_object_that_holds_integer' holds a single integer field with i as well
            'array_of_objects_that_holds_integer' holds 2 objects that are mirrors of one another
    """
    return [{
        'special_integer': i,
        'special_object_that_holds_integer': {
            'embedded_integer': i
        },
        'array_of_objects_that_holds_integer': [
            {
                'embedded_identifier': 'forward',
                'embedded_integer': 0 if i < 5 else 9
            },
            {
                'embedded_identifier': 'reverse',
                'embedded_integer': 9 if i < 5 else 0
            },
        ]
    } for i in range(10)]


@pytest.fixture(scope='session')  # XXX: consider scope further - Will 11/5/2020
def bucket_range_data(workbook, es_testapp, bucket_range_data_raw):
    for entry in bucket_range_data_raw:
        es_testapp.post_json('/TestingBucketRangeFacets', entry, status=201)
    es_testapp.post_json('/index', {'record': False})


class TestSearchBucketRangeFacets:
    """ Class that encapsulates tests for BucketRanges """

    @staticmethod
    def verify_facet_counts(facets, expected_fields, expected_cardinality, expected_count):
        """ Checks for given expected facets, checking bucket cardinality and document count
            Note that the actual range properties are trivial (we are not testing elasticsearch)
        """
        for facet in facets:
            if facet['field'] in expected_fields:
                assert len(facet['ranges']) == expected_cardinality
                for bucket in facet['ranges']:
                    assert bucket['doc_count'] == expected_count

    @staticmethod
    def select_facet(facets, facet_name):
        result = None
        for facet in facets:
            if facet['field'] == facet_name:
                result = facet
                break
        return result

    @pytest.mark.parametrize('expected_fields, expected_counts', [
        (['special_integer', 'special_object_that_holds_integer.embedded_integer'], 5),
        (['array_of_objects_that_holds_integer.embedded_integer'], 10)
    ])
    def test_search_bucket_range_simple(self, workbook, es_testapp, bucket_range_data, expected_fields, expected_counts):
        """ Tests searching a collection of documents with varying integer field types that
            have the same distribution - all of which should give the same results. """
        res = es_testapp.get('/search/?type=TestingBucketRangeFacets').json['facets']
        self.verify_facet_counts(res, expected_fields, 2, expected_counts)

    # XXX: The following 2 tests don't function correctly because the facet doesn't utilize reverse_nested
    @pytest.mark.parametrize('identifier', [
        'reverse', 'forward'
    ])
    def test_search_bucket_range_nested_qualifier(self, workbook, es_testapp, bucket_range_data, identifier):
        """ Tests aggregating on a nested field while selecting for a field within the nested object. """
        res = es_testapp.get('/search/?type=TestingBucketRangeFacets'
                          '&array_of_objects_that_holds_integer.embedded_identifier=%s' % identifier).json['facets']
        self.verify_facet_counts(res, ['array_of_objects_that_holds_integer.embedded_integer'],
                                 2, 10)

    @pytest.mark.parametrize('identifier', [
        'reverse', 'forward'
    ])
    def test_search_bucket_range_nested_qualifier_multiple(self, workbook, es_testapp, bucket_range_data, identifier):
        """ Tests aggregating on a nested field while selecting for a field within the nested object (no change). """
        res = es_testapp.get('/search/?type=TestingBucketRangeFacets'
                          '&array_of_objects_that_holds_integer.embedded_integer.from=6'
                          '&array_of_objects_that_holds_integer.embedded_identifier=%s' % identifier).json['facets']
        self.verify_facet_counts(res, ['array_of_objects_that_holds_integer.embedded_integer'],
                                 2, 10)
        facet_with_labels = self.select_facet(res, 'array_of_objects_that_holds_integer.embedded_integer')
        for r in facet_with_labels['ranges']:
            assert 'label' in r
            assert r['label'] in ['Low', 'High']

    def test_search_bucket_range_workbook(self, es_testapp, workbook):
        # TODO: write me once some bucket-range aggregations are defined on schemas for workbook inserts
        pass
