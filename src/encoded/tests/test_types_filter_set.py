import pytest
import webtest
from .workbook_fixtures import app


pytestmark = [pytest.mark.working, pytest.mark.schema]
FILTER_SET_URL = '/filter_set'


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


@pytest.fixture()
def setup_for_filter_sets(elasticsearch_testapp, project, institution):
    """ Bundles the elasticsearch_testapp with the project/institution necessary for testing
        Returns the elasticsearch_testapp.
    """
    return elasticsearch_testapp


@pytest.fixture
def barebones_filter_set():
    """ A filter set with only the flag that designates the type """
    return {
        'type': 'Cohort',
        'flags': '?type=Cohort',
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
        'project': 'encode-project',
        'institution': 'encode-institution'
    }


def test_filter_set_barebones(setup_for_filter_sets, barebones_filter_set, simple_filter_set):
    """ Tests posting a filter set """
    testapp = setup_for_filter_sets
    res1 = testapp.post_json(FILTER_SET_URL, barebones_filter_set, status=201).json
    res2 = testapp.post_json(FILTER_SET_URL, simple_filter_set, status=201).json
    # XXX: implement execute, then test
