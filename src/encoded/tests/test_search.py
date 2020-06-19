import json
import pytest
import mock

from datetime import (datetime, timedelta)
from pyramid.httpexceptions import HTTPBadRequest
from snovault import TYPES, COLLECTIONS
from snovault.elasticsearch import create_mapping
from snovault.elasticsearch.create_mapping import MAX_NGRAM
from encoded.search import verify_search_has_permissions
from snovault.elasticsearch.indexer_utils import get_namespaced_index
from snovault.util import add_default_embeds
from ..commands.run_upgrader_on_inserts import get_inserts
# Use workbook fixture from BDD tests (including elasticsearch)
from .workbook_fixtures import app_settings, app, workbook


pytestmark = [pytest.mark.working, pytest.mark.schema, pytest.mark.indexing]


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


def test_search_view(workbook, testapp):
    """ Test basic things about search view """
    res = testapp.get('/search/?type=Item').json
    assert res['@type'] == ['ItemSearchResults', 'Search']
    assert res['@id'] == '/search/?type=Item'
    assert res['@context'] == '/terms/'
    assert res['notification'] == 'Success'
    assert res['title'] == 'Search'
    assert res['total'] > 0
    assert 'facets' in res
    assert 'filters' in res
    assert '@graph' in res


def test_search_with_no_query(workbook, testapp):
    """
    using /search/ (with no query) should default to /search/?type=Item
    thus, should satisfy same assertions as test_search_view
    """
    res = testapp.get('/search/').follow(status=200)
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


def test_collections_redirect_to_search(workbook, testapp):
    """
    we removed the collections page and redirect to search of that type
    redirected_from is not used for search
    """
    res = testapp.get('/user/', status=301).follow(status=200)
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


def test_search_with_embedding(workbook, testapp):
    """ Searches for a cohort and checks some embedded items are properly resolved """
    res = testapp.get('/search/?type=Cohort&limit=all').json
    res_json = [dis for dis in res['@graph'] if dis['uuid'] == 'cc7d83a2-6886-4ca0-9402-7c49734cf3c4']
    assert len(res_json) == 1
    test_json = res_json[0]
    assert test_json['display_title'] == 'People with Blue Thumbs'
    assert test_json['project']['display_title'] == 'Test Project'
    assert test_json['families'][0]['original_pedigree']['uuid'] == 'dcf15d5e-40aa-43bc-b81c-32c70c9afc50'


def test_search_with_simple_query(workbook, testapp):
    """
    Tests simple query string searches on CGAP using type-based
    q= and generic q=
    """
    # run a simple query with type=Disorder and q=Dummy
    res = testapp.get('/search/?type=Disorder&q=Dummy').json
    assert len(res['@graph']) == 3
    # get the uuids from the results
    dummy_uuids = [org['uuid'] for org in res['@graph'] if 'uuid' in org]
    # run the same search with type=Item
    res = testapp.get('/search/?type=Item&q=Dummy').json
    assert len(res['@graph']) >= 3
    all_uuids = [item['uuid'] for item in res['@graph'] if 'uuid' in item]
    # make sure all uuids found in the first search are present in the second
    assert set(dummy_uuids).issubset(set(all_uuids))
    # run with q=Dum returns the same hits...
    res = testapp.get('/search/?type=Item&q=Dum').json
    dum_uuids = [item['uuid'] for item in res['@graph'] if 'uuid' in item]
    # make sure all uuids found in the first search are present in the second
    assert set(dummy_uuids).issubset(set(dum_uuids))
    # should eliminate first and third level disorders
    res = testapp.get('/search/?type=Disorder&q=Sub+-Second').json
    assert len(res['@graph']) == 1
    # include first level
    res = testapp.get('/search/?type=Disorder&q=(Sub+-Second) | oranges').follow().json
    assert len(res['@graph']) == 2
    # exclude all
    res = testapp.get('/search/?type=Disorder&q=(oranges)+(apples)+(bananas)', status=404)


def test_search_ngram(workbook, testapp):
    """
    Tests edge-ngram related behavior with simple query string
    """
    # test search beyond max-ngram, should still give one result
    res = testapp.get('/search/?type=Item&q=Second+Dummy+Sub+Disorder').json
    assert len(res['@graph']) == 1
    # run search with q=Du (should get nothing since max_ngram=3)
    testapp.get('/search/?type=Item&q=D', status=404)
    # run search with q=ummy (should get nothing since we are using edge ngrams)
    testapp.get('/search/?type=Item&q=ummy', status=404)
    # test ngram on upper bound
    res1 = testapp.get('/search/?type=Item&q=information').json
    assert len(res1['@graph']) > 0
    # should get same results
    res2 = testapp.get('/search/?type=Item&q=informatio').json
    # should have same results in res1
    assert len(res1['@graph']) == len(res2['@graph'])
    # should get nothing
    testapp.get('/search/?type=Item&q=informatix', status=404)
    # will get same results as res1 and res2
    res3 = testapp.get('/search/?type=Item&q=informatioabd').json
    assert len(res2['@graph']) == len(res3['@graph'])
    # search for part of uuid common, should get all 3
    res4 = testapp.get('/search/?type=Disorder&q=231111bc').json
    assert len(res4['@graph']) == 3
    # search for full uuid
    res5 = testapp.get('/search/?type=Disorder&q=231111bc-8535-4448-903e-854af460b25').json
    assert len(res4['@graph']) == 3
    # uuid difference beyond 10
    res6 = testapp.get('/search/?type=Disorder&q=231111bc-89').json
    assert len(res4['@graph']) == 3
    # uuid difference at 10 (should get no results)
    testapp.get('/search/?type=Disorder&q=231111bc-9', status=404)


@pytest.mark.skip # XXX: What is this really testing?
def test_search_facets_and_columns_order(workbook, testapp, registry):
    # TODO: Adjust ordering of mixed-in facets, perhaps sort by lookup or something, in order to un-xfail.
    test_type = 'experiment_set_replicate'
    type_info = registry[TYPES].by_item_type[test_type]
    schema = type_info.schema
    schema_facets = [('type', {'title': 'Data Type'})]
    schema_facets.extend(schema['facets'].items())
    # the following facets are added after schema facets
    schema_facets.append(('status', {'title': 'Status'}))
    # remove any disabled facets
    schema_facets = [fct for fct in schema_facets if not fct[1].get('disabled', False)]
    sort_facets = sorted(schema_facets, key=lambda fct: fct[1].get('order', 0))
    res = testapp.get('/search/?type=ExperimentSetReplicate&limit=all').json
    for i,val in enumerate(sort_facets):
        assert res['facets'][i]['field'] == val[0]
    # assert order of columns when we officially upgrade to python 3.6 (ordered dicts)
    for key,val in schema.get('columns', {}).items():
        assert res['columns'][key]['title'] == val['title']


@pytest.mark.skip # XXX: Not clear how to best port
def test_search_embedded_file_by_accession(workbook, testapp):
    res = testapp.get('/search/?type=Cohort&families.original_pedigree.uuid=dcf15d5e-40aa-43bc-b81c-32c70c9afc50').json
    assert len(res['@graph']) > 0
    item_uuids = [item['uuid'] for item in res['@graph'] if 'uuid' in item]
    for item_uuid in item_uuids:
        item_res = testapp.get('/experiments-hi-c/%s/' % item_uuid, status=301)
        exp = item_res.follow().json
        file_uuids = [f['uuid'] for f in exp['files']]
        assert '46e82a90-49e5-4c33-afab-9ec90d65faa0' in file_uuids


@pytest.fixture
def dd_dts(testapp, workbook):
    # returns a dictionary of strings of various date and datetimes
    # relative to the creation date of the mboI one object in test inserts
    enz = testapp.get('/search/?type=Disorder&disorder_name=Dummy+Disorder').json['@graph'][0]

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


def test_search_date_range_find_within(dd_dts, testapp, workbook):
    # the MboI enzyme should be returned with all the provided pairs
    gres = testapp.get('/search/?type=Disorder&disorder_name=Dummy+Disorder').json
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
        sres = testapp.get(search).json
        s_uuids = [item['uuid'] for item in sres['@graph'] if 'uuid' in item]
        assert set(g_uuids).issubset(set(s_uuids))


@pytest.mark.skip # XXX: how to best port?
def test_search_with_nested_integer(testapp, workbook):
    search0 = '/search/?type=ExperimentHiC'
    s0res = testapp.get(search0).json
    s0_uuids = [item['uuid'] for item in s0res['@graph'] if 'uuid' in item]

    search1 = '/search/?type=ExperimentHiC&files.file_size.to=1500'
    s1res = testapp.get(search1).json
    s1_uuids = [item['uuid'] for item in s1res['@graph'] if 'uuid' in item]
    assert len(s1_uuids) > 0

    search2 = '/search/?type=ExperimentHiC&files.file_size.from=1501'
    s2res = testapp.get(search2).json
    s2_uuids = [item['uuid'] for item in s2res['@graph'] if 'uuid' in item]
    assert len(s2_uuids) > 0

    # make sure there is no intersection of the uuids
    assert not set(s1_uuids) & set(s2_uuids)
    assert set(s1_uuids) | set(s2_uuids) == set(s0_uuids)


def test_search_date_range_dontfind_without(dd_dts, testapp, workbook):
    # the MboI enzyme should be returned with all the provided pairs
    dts = {k: v.replace(':', '%3A') for k, v in dd_dts.items()}
    datepairs = [
        (dts['daybefore'], dts['creationdate']),
        (dts['hourafter'], dts['dayafter']),
        (dts['daybefore'], dts['hourbefore'])
    ]
    for dp in datepairs:
        search = '/search/?type=Disorder&date_created.from=%s&date_created.to=%s' % dp
        assert testapp.get(search, status=404)


def test_search_query_string_AND_NOT_cancel_out(workbook, testapp):
    # if you use + and - with same field you should get no result
    search = '/search/?q=cell+-cell&type=Cohort'
    assert testapp.get(search, status=404)


def test_search_query_string_with_booleans(workbook, testapp):
    """
    Tests some search queries involving booleans on users
    """
    search = '/search/?type=User&q=hms-dbmi'
    res_stem = testapp.get(search).json
    assert len(res_stem['@graph']) > 1
    uuids = [r['uuid'] for r in res_stem['@graph'] if 'uuid' in r]
    wrangler_uuid = "986b362f-4eb6-4a9c-8173-3ab267307e3b"
    tester_uuid = "986b362f-4eb6-4a9c-8173-3ab267307e4c"
    # assert induced_stem_uuid not in not_induced_uuids
    # now search for stem +induced (AND is now "+")
    search_and = '/search/?type=User&q=scientist+%2Bcurrent'
    res_both = testapp.get(search_and).json
    both_uuids = [r['uuid'] for r in res_both['@graph'] if 'uuid' in r]
    assert len(both_uuids) == 2
    assert wrangler_uuid in both_uuids
    assert tester_uuid in both_uuids
    # search with OR ("|")
    search_or = '/search/?type=User&q=Scientist+%7Ctesting'
    res_or = testapp.get(search_or).json
    or_uuids = [r['uuid'] for r in res_or['@graph'] if 'uuid' in r]
    assert wrangler_uuid in or_uuids
    assert tester_uuid in or_uuids
    # search with NOT ("-")
    search_not = '/search/?type=User&q=Scientist+-testing'
    res_not = testapp.get(search_not).json
    not_uuids = [r['uuid'] for r in res_not['@graph'] if 'uuid' in r]
    assert tester_uuid not in not_uuids


@pytest.mark.skip # N/A?
def test_metadata_tsv_view(workbook, htmltestapp):

    FILE_ACCESSION_COL_INDEX = 3
    FILE_DOWNLOAD_URL_COL_INDEX = 0

    def check_tsv(result_rows, len_requested = None):
        info_row = result_rows.pop(0)
        header_row = result_rows.pop(0)

        assert header_row[FILE_ACCESSION_COL_INDEX] == 'File Accession'
        assert header_row.index('File Download URL') == FILE_DOWNLOAD_URL_COL_INDEX # Ensure we have this column
        assert len(result_rows) > 0 # We at least have some rows.

        for row_index in range(1):
            assert len(result_rows[row_index][FILE_ACCESSION_COL_INDEX]) > 4 # We have a value for File Accession
            assert 'http' in result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX] # Make sure it seems like a valid URL.
            assert '/@@download/' in result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX]
            assert result_rows[row_index][FILE_ACCESSION_COL_INDEX] in result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX] # That File Accession is also in File Download URL of same row.
            assert len(result_rows[row_index][FILE_ACCESSION_COL_INDEX]) < len(result_rows[row_index][FILE_DOWNLOAD_URL_COL_INDEX])

        # Last some rows should be 'summary' rows. And have empty spaces for 'Download URL' / first column.
        summary_start_row = None
        for row_index, row in enumerate(result_rows):
            if row[1] == 'Summary':
                summary_start_row = row_index - 1
                break

        # Check that summary cells are present, in right place, with some correct-looking values
        assert result_rows[summary_start_row + 1][1] == 'Summary'
        assert result_rows[summary_start_row + 3][1] == 'Files Selected for Download:'
        assert result_rows[summary_start_row + 4][1] == 'Total File Rows:'
        assert result_rows[summary_start_row + 5][1] == 'Unique Downloadable Files:'
        if len_requested:
            assert int(result_rows[summary_start_row + 3][4]) == len_requested
        assert int(result_rows[summary_start_row + 4][4]) == summary_start_row
        assert int(result_rows[summary_start_row + 5][4]) <= summary_start_row


    # run a simple GET query with type=ExperimentSetReplicate
    res = htmltestapp.get('/metadata/type=ExperimentSetReplicate/metadata.tsv') # OLD URL FORMAT IS USED -- TESTING REDIRECT TO NEW URL
    res = res.maybe_follow() # Follow redirect -- https://docs.pylonsproject.org/projects/webtest/en/latest/api.html#webtest.response.TestResponse.maybe_follow
    assert 'text/tsv' in res.content_type
    result_rows = [ row.rstrip(' \r').split('\t') for row in res.body.decode('utf-8').split('\n') ] # Strip out carriage returns and whatnot. Make a plain multi-dim array.

    check_tsv(result_rows)

    # Perform POST w/ accession triples (main case, for BrowseView downloads)
    res2_post_data = { # N.B. '.post', not '.post_json' is used. This dict is converted to POST form values, with key values STRINGIFIED, not to POST JSON request.
        "accession_triples" : [
            ["4DNESAAAAAA1","4DNEXO67APU1","4DNFIO67APU1"],
            ["4DNESAAAAAA1","4DNEXO67APU1","4DNFIO67APT1"],
            ["4DNESAAAAAA1","4DNEXO67APT1","4DNFIO67APV1"],
            ["4DNESAAAAAA1","4DNEXO67APT1","4DNFIO67APY1"],
            ["4DNESAAAAAA1","4DNEXO67APV1","4DNFIO67APZ1"],
            ["4DNESAAAAAA1","4DNEXO67APV1","4DNFIO67AZZ1"]
        ],
        'download_file_name' : 'metadata_TEST.tsv'
    }

    res2 = htmltestapp.post('/metadata/?type=ExperimentSetReplicate', { k : json.dumps(v) for k,v in res2_post_data.items() }) # NEWER URL FORMAT

    assert 'text/tsv' in res2.content_type
    result_rows = [ row.rstrip(' \r').split('\t') for row in res2.body.decode('utf-8').split('\n') ]

    check_tsv(result_rows, len(res2_post_data['accession_triples']))


def test_default_schema_and_non_schema_facets(workbook, testapp, registry):
    test_type = 'user'
    type_info = registry[TYPES].by_item_type[test_type]
    schema = type_info.schema
    embeds = add_default_embeds(test_type, registry[TYPES], type_info.embedded_list, schema)
    # we're looking for this specific facet, which is not in the schema
    assert 'institution.display_title' in embeds
    res = testapp.get('/search/?type=User&institution.display_title=HMS+DBMI').json
    assert 'facets' in res
    facet_fields = [ facet['field'] for facet in res['facets'] ]
    # assert 'type' in facet_fields uncomment this if we decide type should exist when searching on a single type
    # assert 'status' in facet_fields uncomment this if status is added back -Will 5/13/2020
    for facet in schema['facets'].keys():
        if not schema['facets'][facet].get('hide_from_view'):
            assert facet in facet_fields
    # now ensure that facets can also be created outside of the schema
    assert 'institution.display_title' in facet_fields


def test_search_query_string_no_longer_functional(workbook, testapp):
    # since we now use simple_query_string, cannot use field:value or range
    # expect 404s, since simple_query_string doesn't return exceptions
    search_field = '/search/?q=name%3Ahuman&type=Item'
    res_field = testapp.get(search_field, status=404)
    assert len(res_field.json['@graph']) == 0

    search_range = '/search/?q=date_created%3A>2018-01-01&type=Item'
    res_search = testapp.get(search_range, status=404)
    assert len(res_search.json['@graph']) == 0

def test_search_with_added_display_title(workbook, testapp, registry):
    search = '/search/?type=Individual&father=GAPID3PW26SK'
    # 301 because search query is changed
    res_json = testapp.get(search, status=301).follow(status=200).json
    assert res_json['@id'] == '/search/?type=Individual&father.display_title=GAPID3PW26SK'
    added_facet = [fct for fct in res_json['facets'] if fct['field'] == 'father.display_title']
    # new facet uses the title from schema
    added_title = registry[TYPES]['Individual'].schema['properties']['father']['title']
    assert added_facet[0]['title'] == added_title
    indvs = [indv['uuid'] for indv in res_json['@graph']]

    # make sure the search result is the same for the explicit query
    res_json2 = testapp.get(res_json['@id']).json
    indvs2 = [indv['uuid'] for indv in res_json2['@graph']]
    assert set(indvs) == set(indvs2)

    # 'sort' also adds display_title for ascending and descending queries
    for use_sort in ['father', '-father']:
        search = '/search/?type=Individual&sort=%s' % use_sort
        res_json = testapp.get(search, status=301).follow(status=200).json
        assert res_json['@id'] == '/search/?type=Individual&sort=%s.display_title' % use_sort

    # regular sort queries remain unchanged
    search = '/search/?type=Individual&sort=uuid'
    res_json = testapp.get(search).json
    assert res_json['@id'] == '/search/?type=Individual&sort=uuid'

    # check to see that added facet doesn't conflict with existing facet title
    # query below will change to file_format.display_title=fastq
    search = '/search/?type=File&file_format=fastq'
    res_json = testapp.get(search, status=301).follow(status=200).json
    assert res_json['@id'] == '/search/?type=File&file_format.display_title=fastq'
    # find title from schema
    ff_title = registry[TYPES]['File'].schema['properties']['file_format']['title']
    existing_ff_facet = [fct for fct in res_json['facets'] if fct['field'] == 'file_format.file_format']
    assert existing_ff_facet[0]['title'] == ff_title
    added_ff_facet = [fct for fct in res_json['facets'] if fct['field'] == 'file_format.display_title']
    assert added_ff_facet[0]['title'] == ff_title + ' (Title)'


def test_search_with_no_value(workbook, testapp):
    search = '/search/?comment=No+value&comment=This+comment+is+to+test+oranges&type=Disorder'
    res_json = testapp.get(search).json
    # grab some random results
    for item in res_json['@graph']:
        maybe_null = item.get('comment')
        assert( maybe_null is None or maybe_null == 'This comment is to test oranges')
    res_ids = [r['uuid'] for r in res_json['@graph'] if 'uuid' in r]
    search2 = '/search/?comment=This+comment+is+to+test+apples&type=Disorder'
    res_json2 = testapp.get(search2).json
    # just do 1 res here
    check_item = res_json2['@graph'][0]
    assert(check_item.get('comment') == 'This comment is to test apples')
    res_ids2 = [r['uuid'] for r in res_json2['@graph'] if 'uuid' in r]
    assert(set(res_ids2) != set(res_ids))


def test_search_with_static_header(workbook, testapp):
    """ Performs a search which should be accompanied by a search header """
    search = '/search/?type=Workflow'
    res_json = testapp.get(search, status=404).json # no items, just checking hdr
    assert 'search_header' in res_json
    assert 'content' in res_json['search_header']
    assert res_json['search_header']['title'] == 'Workflow Information'
    search = '/search/?type=workflow' # check type resolution
    res_json = testapp.get(search, status=404).json
    assert 'search_header' in res_json
    assert 'content' in res_json['search_header']
    assert res_json['search_header']['title'] == 'Workflow Information'


def test_search_multiple_types(workbook, testapp):
    """ Note that the behavior now is in '@type' will be the highest common ancestor if searched on multiple types """
    search = '/search/?type=Individual&type=Workflow'
    res = testapp.get(search).json
    assert res['@type'] == ['ItemSearchResults', 'Search']


#########################################
## Tests for collections (search 301s) ##
#########################################

def test_collection_limit(workbook, testapp):
    res = testapp.get('/user/?limit=1', status=301)
    assert len(res.follow().json['@graph']) == 1


def test_collection_actions_filtered_by_permission(workbook, testapp, anontestapp):
    res = testapp.get('/user/')
    assert any(action for action in res.follow().json.get('actions', []) if action['name'] == 'add')

    # users not visible
    res = anontestapp.get('/user/', status=404)
    assert len(res.json['@graph']) == 0


def test_index_data_workbook(app, workbook, testapp, indexer_testapp, htmltestapp):
    es = app.registry['elasticsearch']
    # we need to reindex the collections to make sure numbers are correct
    create_mapping.run(app, sync_index=True)
    # check counts and ensure they're equal
    testapp_counts = testapp.get('/counts')
    # e.g., {"db_es_total": "DB: 748 ES: 748 ", ...}
    db_es_total = testapp_counts.json['db_es_total']
    split_counts = db_es_total.split()
    db_total = int(split_counts[1])
    es_total = int(split_counts[3])
    assert(db_total == es_total)  # 2nd is db, 4th is es
    # e.g., {..., "db_es_compare": {"AnalysisStep": "DB: 26 ES: 26 ", ...}, ...}
    for item_name, item_counts in testapp_counts.json['db_es_compare'].items():
        print("item_name=", item_name, "item_counts=", item_counts)
        # make sure counts for each item match ES counts
        split_item_counts = item_counts.split()
        db_item_count = int(split_item_counts[1])
        es_item_count = int(split_item_counts[3])
        assert db_item_count == es_item_count

        # check ES counts directly. Must skip abstract collections
        # must change counts result ("ItemName") to item_type format
        item_type = app.registry[COLLECTIONS][item_name].type_info.item_type
        namespaced_index = get_namespaced_index(app, item_type)

        es_direct_count = es.count(index=namespaced_index, doc_type=item_type).get('count')
        assert es_item_count == es_direct_count

        if es_item_count == 0:
            continue

        # check items in search result individually
        search_url = '/%s?limit=all' % item_type
        print("search_url=", search_url)
        res = testapp.get(search_url, status=[200, 301]).follow()
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
                links_res = testapp.get('/' + item_res['uuid'] + '/@@links', status=200)
                link_uuids = [lnk['uuid'] for lnk in links_res.json.get('uuids_linking_to')]
                assert set(index_view_res['uuids_rev_linked_to_me']) <= set(link_uuids)
            # previously test_html_pages
            try:
                html_res = htmltestapp.get(item_res['@id'])
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


def test_search_with_hacked_query(anontestapp, hacked_query):
    """ Attempts to execute what is considered a 'bad query' in a MockedRequest context. Our
        verification function should throw an exception if there is any delta in the permissions object
        we explicitly attach to every search query.
    """
    with mock.patch('encoded.search.convert_search_to_dictionary', return_value=hacked_query):
        mocked_request_with_least_permissive_permissions = MockedRequest()
        with pytest.raises(HTTPBadRequest):
            verify_search_has_permissions(mocked_request_with_least_permissive_permissions, None)
        mocked_request_with_same_permissions = MockedRequest(principals_allowed=['system.Everyone',
                                                                                 'group.PERMISSION_YOU_DONT_HAVE'])
        verify_search_has_permissions(mocked_request_with_same_permissions, None)


def test_search_with_principals_allowed_fails(workbook, anontestapp):
    """ Tests query with a query string parameter for principals_allowed.view, which will be AND'd with what's
        on the request.

        XXX IMPORTANT: Since we do permissions in a restrictive way, this works - if our permissions structure is
        modified, it is possible this behavior will need to be revisited -Will 4-24-2020
    """
    from webtest import AppError
    with pytest.raises(AppError):
        anontestapp.get('/search/?type=Item&principals_allowed.view=group.PERMISSION_YOU_DONT_HAVE')
    with pytest.raises(AppError):
        anontestapp.get('/search/?type=Cohort'
                        '&families.proband.display_title=GAPID8J9B9CR'
                        '&principals_allowed.view=group.PERMISSION_YOU_DONT_HAVE')
    with pytest.raises(AppError):
        anontestapp.get('/search/?type=Cohort'
                        '&families.proband.display_title=GAPID5HBSLG6'
                        '&families.clinic_notes=testing'
                        '&principals_allowed.view=group.PERMISSION_YOU_DONT_HAVE')


class TestNestedSearch(object):
    """ This class encapsulates all helper methods and tests needed to test out nested searches """

    @staticmethod
    def assert_length_is_expected(result, expected):
        assert len(result['@graph']) == expected

    @staticmethod
    def is_blue_thumbs(result):
        """ Checks that this result is the 'People with Blue Thumbs' cohort """
        return 'Blue' in result['title']

    @staticmethod
    def is_red_feet(result):
        """ Checks that this result is the 'People with Red Feet' cohort """
        return 'Red' in result['title']

    @staticmethod
    def is_swollen_ears(result):
        """ Checks that this result is the 'People with Swollen Ears' cohort """
        return 'Swollen' in result['title']

    @staticmethod
    def result_contains_two(result, f1, f2):
        compound = True
        for res in result:
            compound = compound and (f1(res) or f2(res))
        return compound

    @staticmethod
    def result_contains_all(result, f1, f2, f3):
        compound = True
        for res in result:
            compound = compound and (f1(res) or f2(res) or f3(res))
        return compound

    @staticmethod
    def verify_facet(facets, name, count):
        """ Checks that a given facet name has the correct number of terms """
        for facet in facets:
            if facet['field'] == name:
                assert len(facet['terms']) == count
                return

    def test_search_on_single_nested_field(self, workbook, testapp):
        """ Should match only once since one has a family with a proband with display_title GAPID8J9B9CR """
        res = testapp.get('/search/?type=Cohort'
                          '&families.proband.display_title=GAPID8J9B9CR').json
        self.assert_length_is_expected(res, 1)
        assert self.is_blue_thumbs(res['@graph'][0])

    def test_or_search_on_same_nested_field(self, workbook, testapp):
        """ Should match all 3 since this is interpreted as an OR search on this field """
        res = testapp.get('/search/?type=Cohort'
                          '&families.proband.display_title=GAPID8J9B9CR'
                          '&families.proband.display_title=GAPID5HBSLG6').json
        self.assert_length_is_expected(res, 3)
        assert self.result_contains_all(res['@graph'], self.is_blue_thumbs, self.is_red_feet, self.is_swollen_ears)

    def test_and_search_on_nested_field_that_does_not_match(self, workbook, testapp):
        """ This has clinic notes that do not match with any proband object, so will give no results """
        testapp.get('/search/?type=Cohort'
                    '&families.proband.display_title=GAPID8J9B9CR'
                    '&families.clinic_notes=gnitset', status=404)

    def test_and_search_on_nested_field_that_matches_one(self, workbook, testapp):
        """ This has the correct 'clinic_notes', so should match """
        res = testapp.get('/search/?type=Cohort'
                          '&families.proband.display_title=GAPID5HBSLG6'
                          '&families.clinic_notes=testing').json
        self.assert_length_is_expected(res, 1)
        assert self.is_blue_thumbs(res['@graph'][0])

    def test_or_search_on_nested_clinic_notes_that_matches_two(self, workbook, testapp):
        """ Do an OR search on clinic_notes, matching two cohorts """
        res = testapp.get('/search/?type=Cohort'
                          '&families.proband.display_title=GAPID5HBSLG6'
                          '&families.clinic_notes=xyz'
                          '&families.clinic_notes=testing').json
        self.assert_length_is_expected(res, 2)
        assert self.result_contains_two(res['@graph'], self.is_blue_thumbs, self.is_red_feet)

    def test_negative_search_on_clinic_notes(self, workbook, testapp):
        """ Do an OR search with clinic_notes with a negative, should eliminate red_feet and match swollen_ears """
        res = testapp.get('/search/?type=Cohort'
                          '&families.proband.display_title=GAPID5HBSLG6'
                          '&families.clinic_notes!=xyz').follow().json
        self.assert_length_is_expected(res, 2)
        assert self.result_contains_two(res['@graph'], self.is_blue_thumbs, self.is_swollen_ears)

    def test_and_search_that_matches_one(self, workbook, testapp):
        """ Check two properties that occur in the same sub-embedded object in 1 cohort """
        res = testapp.get('/search/?type=Cohort'
                          '&families.members.mother.display_title=GAPID6ZUDPO2'
                          '&families.members.father.display_title=GAPIDRU2NWFO').json
        self.assert_length_is_expected(res, 1)
        assert self.is_blue_thumbs(res['@graph'][0])

    def test_and_search_that_matches_multiple(self, workbook, testapp):
        """ Check two properties that occur in the same sub-embedded object in 3 cohorts """
        res = testapp.get('/search/?type=Cohort'
                          '&families.members.mother.display_title=GAPIDISC7R73'
                          '&families.members.father.display_title=GAPID3PW26SK').json
        self.assert_length_is_expected(res, 3)
        assert self.result_contains_all(res['@graph'], self.is_blue_thumbs, self.is_red_feet, self.is_swollen_ears)

    def test_and_search_with_disqualifier(self, workbook, testapp):
        """ Check three properties - two of which occur in the same sub-embedded object in
           2 cohorts with an additional property that removes both """
        testapp.get('/search/?type=Cohort'
                    '&families.members.mother.display_title=GAPIDISC7R73'
                    '&families.members.father.display_title=GAPID3PW26SK'
                    '&families.proband.display_title=GAPID8J9B9CR', status=404)

    def test_and_search_on_three_fields(self, workbook, testapp):
        """ Search for 3 properties that all occur in the cohorts """
        res = testapp.get('/search/?type=Cohort'
                          '&families.members.mother.display_title=GAPIDISC7R73'
                          '&families.members.father.display_title=GAPID3PW26SK'
                          '&families.proband.display_title=GAPID5HBSLG6').json
        self.assert_length_is_expected(res, 3)
        assert self.result_contains_all(res['@graph'], self.is_blue_thumbs, self.is_red_feet, self.is_swollen_ears)

    def test_and_search_on_three_fields_that_matches_one(self, workbook, testapp):
        """ Change the parents such that only one cohort matches now """
        res = testapp.get('/search/?type=Cohort'
                          '&families.members.mother.display_title=GAPID6ZUDPO2'
                          '&families.members.father.display_title=GAPIDRU2NWFO'
                          '&families.proband.display_title=GAPID8J9B9CR').json
        self.assert_length_is_expected(res, 1)
        assert self.is_blue_thumbs(res['@graph'][0])

    def test_search_with_non_existant_combinations(self, workbook, testapp):
        """ Test that swapping around fields that would match across different sub-embedded objects
            does not actually do so (ie: returns no results). """
        testapp.get('/search/?type=Cohort'  # Swap the parents
                    '&families.members.mother.display_title=GAPID3PW26SK'
                    '&families.members.father.display_title=GAPIDISC7R73', status=404)
        testapp.get('/search/?type=Cohort'  # Swap just the father
                    '&families.members.mother.display_title=GAPIDISC7R73'
                    '&families.members.father.display_title=GAPIDRU2NWFO', status=404)
        testapp.get('/search/?type=Cohort'  # Swap just the mother
                    '&families.members.mother.display_title=GAPID6ZUDPO2'
                    '&families.members.father.display_title=GAPIDISC7R73', status=404)

    def test_nested_search_with_no_value(self, workbook, testapp):
        """ Tests searching on 'No value' alone on a nested field  """
        res = testapp.get('/search/?type=Cohort'
                          '&families.clinic_notes=No+value').json
        self.assert_length_is_expected(res, 1)
        assert self.is_swollen_ears(res['@graph'][0])

    def test_nested_search_with_no_value_combined(self, workbook, testapp):
        """ Tests searching on 'No value' combined with another nested field, in this case
            should give no results (no matter the ordering) """
        testapp.get('/search/?type=Cohort'
                    '&families.clinic_notes=No+value'
                    '&families.proband.display_title=GAPID8J9B9CR', status=404)
        testapp.get('/search/?type=Cohort'
                    '&families.proband.display_title=GAPID8J9B9CR'
                    '&families.clinic_notes=No+value', status=404)
        testapp.get('/search/?type=Cohort'
                    '&families.clinic_notes=No+value'
                    '&families.proband.display_title=GAPIDISC7R74', status=404)
        testapp.get('/search/?type=Cohort'
                    '&families.proband.display_title=GAPIDISC7R74'
                    '&families.clinic_notes=No+value', status=404)

    def test_search_nested_with_non_nested_fields(self, workbook, testapp):
        """ Tests that combining a nested search with a non-nested one works in any order """
        res = testapp.get('/search/?type=Cohort'
                          '&families.clinic_notes=No+value'
                          '&title=People+with+Swollen+Ears').json
        self.assert_length_is_expected(res, 1)
        assert self.is_swollen_ears(res['@graph'][0])
        res = testapp.get('/search/?type=Cohort'
                          '&title=People+with+Swollen+Ears'
                          '&families.clinic_notes=No+value').json
        self.assert_length_is_expected(res, 1)
        assert self.is_swollen_ears(res['@graph'][0])

    def test_search_nested_no_value_with_multiple_other_fields(self, workbook, testapp):
        """ Tests that combining a 'No value' search with another nested search and a different non-nested
            field works correctly """
        res = testapp.get('/search/?type=Cohort'
                          '&title=People+with+Swollen+Ears'
                          '&families.clinic_notes=No+value'
                          '&families.proband=GAPID5HBSLG6').follow().json
        self.assert_length_is_expected(res, 1)
        assert self.is_swollen_ears(res['@graph'][0])
        testapp.get('/search/?type=Cohort'
                    '&title=People+with+Swollen+Ears'
                    '&families.clinic_notes=No+value'
                    '&families.proband=GAPIDISC7R74', status=404)  # proband should disqualify

    def test_search_nested_facets_are_correct(self, workbook, testapp):
        """ Tests that nested facets are properly rendered """
        facets = testapp.get('/search/?type=Cohort').json['facets']
        self.verify_facet(facets, 'families.proband.display_title', 3)
        facets = testapp.get('/search/?type=Cohort'
                             '&families.proband.display_title=GAPID8J9B9CR').json['facets']
        self.verify_facet(facets, 'families.proband.display_title', 2)

    def test_search_nested_exists_query(self, testapp):
        """ Tests doing a !=No+value search on a nested sub-field. """
        testapp.get('/search/?type=SampleProcessing&samples.uuid!=No+value', status=404)
