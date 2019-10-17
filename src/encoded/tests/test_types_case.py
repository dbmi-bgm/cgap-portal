import pytest
pytestmark = [pytest.mark.work, pytest.mark.schema]


@pytest.fixture
def invalid_case_title():
    return {
        'title': 5,
        'project': 'encode-project',
        'institution': 'encode-institution'
    }


@pytest.fixture
def invalid_case_missing_field():
    return {
        'title': 'Test case',
        'project': 'encode-project'
    }


@pytest.fixture
def case():
    return {
        'title': 'Test Case',
        'project': 'encode-project',
        'institution': 'encode-institution'
    }

def test_post_invalid_case_title(testapp, project, institution, invalid_case_title):
    """ Tries to post an invalid case with type mismatch """
    testapp.post_json('/case', invalid_case_title, status=422)


def test_post_invalid_case_missing_field(testapp, project, institution, invalid_case_missing_field):
    """ Tries to post invalid case with missing field """
    testapp.post_json('/case', invalid_case_missing_field, status=422)


def test_post_valid_case(testapp, institution, project, case):
    """ Valid case post should succeed """
    res = testapp.post_json('/case', case, status=201)
    assert 'display_title' in res
    assert 'case_phenotypic_features' in res


def test_patch_nonexistant_project(testapp, institution, project, case):
    """ Tries to patch unknown project """
    res = testapp.post_json('/case', case, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'project': 'does not exist'}, status=422)


def test_patch_nonexistant_institution(testapp, institution, project, case):
    """ Tries to patch unknown institution """
    res = testapp.post_json('/case', case, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'institution': 'does not exist'}, status=422)
