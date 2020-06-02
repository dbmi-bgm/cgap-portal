import pytest


pytestmark = [pytest.mark.working, pytest.mark.schema]
FILTER_SET_URL = '/filter_set'


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


def test_filter_set_barebones(testapp, project, institution, barebones_filter_set, simple_filter_set):
    """ Tests posting a filter set """
    testapp.post_json(FILTER_SET_URL, barebones_filter_set, status=201)
    testapp.post_json(FILTER_SET_URL, simple_filter_set, status=201)
    # XXX: implement execute, then test
