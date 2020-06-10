import time
import pytest
import webtest
from .workbook_fixtures import app, workbook


pytestmark = [pytest.mark.working, pytest.mark.schema]
FILTER_SET_URL = '/filter_set'
COHORT_URL = '/cohort'
VARIANT_URL = '/variant'


@pytest.yield_fixture(scope='module')
def elasticsearch_testapp(app):
    """ A testapp that includes the elasticsearch layer without the workbook inserts.

        NOTE: this fixture is 'function' scope!
    """
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    testapp = webtest.TestApp(app, environ)
    yield testapp

    # XXX: Cleanup


@pytest.fixture
def setup_for_filter_sets(elasticsearch_testapp, project, institution):
    """ Bundles the elasticsearch_testapp with the project/institution necessary for testing
        Returns the elasticsearch_testapp.
    """
    return elasticsearch_testapp


@pytest.fixture
def dummy_variant():
    return {
        'project': 'encode-project',
        'institution': 'encode-institution',
        'CHROM': "1",
        'POS': 88832,
        'REF': 'A',
        'ALT': 'G',
        'uuid': 'cedff838-99af-4936-a0ae-4dfc63ba8bf4'
    }


@pytest.fixture
def post_dummy_variant(setup_for_filter_sets, dummy_variant):
    elasticsearch_testapp = setup_for_filter_sets
    elasticsearch_testapp.post_json('/variant', dummy_variant, status=201)


@pytest.fixture
def barebones_filter_set():
    """ A filter set with only the flag that designates the type """
    return {
        'type': 'Variant',
        'flags': '?type=Variant',
        'project': 'encode-project',
        'institution': 'encode-institution'
    }


@pytest.fixture
def simple_filter_set():
    """ A filter set with only the flag that designates the type """
    return {
        'type': 'Cohort',
        'filter_blocks': [
            {
                'query': 'families.proband=GAPID5HBSLG6',
                'flag_applied': True
            }
        ],
        'flags': '?type=Cohort',
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


@pytest.fixture
def standard_filter_set():
    """ A filter set with two filter blocks and a flag """
    return {
        'type': 'Cohort',
        'filter_blocks': [
            {
                'query': 'families.proband=GAPID8J9B9CR',
                'flag_applied': True
            },
            {
                'query': 'families.clinic_notes=xyz',
                'flag_applied': True
            }
        ],
        'flags': '?type=Cohort',
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


def test_filter_set_barebones(setup_for_filter_sets, post_dummy_variant, barebones_filter_set):
    """ Tests posting a filter set and executing it through the /compound_search route """
    testapp = setup_for_filter_sets
    res = testapp.post_json(FILTER_SET_URL, barebones_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']
    testapp.post_json('/index', {})

    # execute given the @id of a filter_set
    compound_search_res = testapp.post_json('/compound_search', {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 1

    # execute given flags only
    compound_search_res = testapp.post_json('/compound_search', {
        'flags': '?type=project',
        'type': 'Project'  # NOTE: will work since we are not actually validating this
    }).json['@graph']
    assert len(compound_search_res) == 1

    # do it again, this time with a type that will return 404
    testapp.post_json('/compound_search', {
        'flags': '?type=gene',
        'type': 'Gene'
    }, status=404)


def test_filter_set_simple(workbook, testapp, simple_filter_set, dummy_variant):
    """ Test posting a non-trivial (but simple) filter set """
    #testapp.post_json(VARIANT_URL, dummy_variant, status=201)
    res = testapp.post_json(FILTER_SET_URL, simple_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']
    testapp.post_json('/index', {})

    # execute given filter_blocks only
    compound_search_res = testapp.post_json('/compound_search', {
                                                'filter_blocks': [{
                                                    'query': 'type=variant&CHROM=1',
                                                    'flag_applied': True
                                                }],
                                                'type': 'Variant'
                                            }).json['@graph']
    assert len(compound_search_res) == 1

    # execute given flags only
    compound_search_res = testapp.post_json('/compound_search', {
        'flags': '?type=project',
        'type': 'Project'
    }).json['@graph']
    assert len(compound_search_res) == 2

    # execute the same search using filter_blocks and flags
    compound_search_res = testapp.post_json('/compound_search', {
        'filter_blocks': [{
            'query': 'CHROM=1',
            'flag_applied': True
        }],
        'flags': 'type=variant',
        'type': 'Variant'
    }).json['@graph']
    assert len(compound_search_res) == 1

    # do similar search with @id
    compound_search_res = testapp.post_json('/compound_search', {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 3


def test_filter_set_complete(workbook, testapp, standard_filter_set):
    """ Executes a filter set with multiple filter blocks """
    res = testapp.post_json(FILTER_SET_URL, standard_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']

    # execute the more complicated filter_set by @id
    compound_search_res = testapp.post_json('/compound_search', {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 2  # will be the correct answer
