import pytest
pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def invalid_cohort_title():
    return {
        'title': 5,
        'project': 'encode-project',
        'institution': 'encode-institution'
    }


@pytest.fixture
def invalid_cohort_missing_field():
    return {
        'title': 'Test cohort',
        'project': 'encode-project'
    }


@pytest.fixture
def cohort():
    return {
        'title': 'Test Cohort',
        'project': 'encode-project',
        'institution': 'encode-institution'
    }


def test_post_invalid_cohort_title(testapp, project, institution, invalid_cohort_title):
    """ Tries to post an invalid cohort with type mismatch """
    testapp.post_json('/cohort', invalid_cohort_title, status=422)


def test_post_invalid_cohort_missing_field(testapp, project, institution, invalid_cohort_missing_field):
    """ Tries to post invalid cohort with missing field """
    testapp.post_json('/cohort', invalid_cohort_missing_field, status=422)


def test_post_valid_cohort(testapp, institution, project, cohort):
    """ Valid cohort post should succeed """
    res = testapp.post_json('/cohort', cohort, status=201)
    assert 'display_title' in res
    assert 'cohort_phenotypic_features' in res


def test_patch_nonexistant_project(testapp, institution, project, cohort):
    """ Tries to patch unknown project """
    res = testapp.post_json('/cohort', cohort, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'project': 'does not exist'}, status=422)


def test_patch_nonexistant_institution(testapp, institution, project, cohort):
    """ Tries to patch unknown institution """
    res = testapp.post_json('/cohort', cohort, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'institution': 'does not exist'}, status=422)
