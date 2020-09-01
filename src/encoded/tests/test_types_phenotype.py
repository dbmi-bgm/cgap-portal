import pytest
pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def phenotype():
    return {
        'phenotype_name': 'Missing Finger',
        'hpo_id': "HP:0000433"
    }


@pytest.fixture
def invalid_phenotype():
    return {
        'phenotype_name': 'Missing Finger',
        'hpo_id': 23523
    }


def test_post_phenotype(testapp, phenotype):
    """ Tests posting a valid phenotype, check calculated property presence """
    res = testapp.post_json('/phenotype', phenotype, status=201)
    assert 'display_title' in res


def test_post_invalid_phenotype(testapp, invalid_phenotype):
    """ Tests posting a phenotype with a type mismatch in hpo_id """
    testapp.post_json('/phenotype', invalid_phenotype, status=422)


def test_patch_phenotype(testapp, phenotype):
    """ Tests updating hpo_id of phenotype """
    post_res = testapp.post_json('/phenotype', phenotype, status=201).json['@graph'][0]
    patch_res = testapp.patch_json(post_res['@id'], {'hpo_id': 'HP:0000432'}).json['@graph'][0]
    assert patch_res['hpo_id'] == 'HP:0000432'


def test_patch_invalid_name(testapp, phenotype):
    """ Tries to patch an invalid hpo_id type """
    post_res = testapp.post_json('/phenotype', phenotype, status=201).json['@graph'][0]
    testapp.patch_json(post_res['@id'], {'hpo_id': 47}, status=422)
