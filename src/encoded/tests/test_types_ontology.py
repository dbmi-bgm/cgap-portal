import pytest
pytestmark = [pytest.mark.work, pytest.mark.schema]


@pytest.fixture
def ontology():
    return {
        'ontology_name': "UBERON-0101"
    }


@pytest.fixture
def invalid_ontology():
    return {
        'ontologyname': "UBERON-0101"
    }


def test_post_valid_ontology(testapp, ontology):
    """ Posts a valid ontology, verifies calculated properties exist """
    res = testapp.post_json('/ontology', ontology, status=201)
    assert 'display_title' in res


def test_post_invalid_ontology(testapp, invalid_ontology):
    """ Posts an ontology with a typo in 'ontology_name' """
    testapp.post_json('/ontology', invalid_ontology, status=422)
