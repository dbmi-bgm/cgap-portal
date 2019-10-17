import pytest
pytestmark = [pytest.mark.work, pytest.mark.schema]


@pytest.fixture
def invalid_institution_type():
    return {
        'name': 17,
        'title': 'Blah'
    }


@pytest.fixture
def invalid_institution_missing_title():
    return {
        'name': 'A Valid Name',
        'status': 'current'
    }


@pytest.fixture
def invalid_institution_status():
    return {
        'name': 'A Valid Name',
        'title': 'A Valid title',
        'status': 'blah'
    }


def test_post_invalid_institution_type(testapp, invalid_institution_type):
    """ Tries to post an institution with type mismatch """
    testapp.post_json('/institution', invalid_institution_type, status=422)


def test_post_invalid_institution_missing_title(testapp, invalid_institution_missing_title):
    """ Tries to post an institution with no title """
    testapp.post_json('/institution', invalid_institution_missing_title, status=422)


def test_post_invalid_insttution_status(testapp, invalid_institution_status):
    """ Tries to post an institution with an invalid status """
    testapp.post_json('/institution', invalid_institution_status, status=422)


def test_patch_invalid_status(testapp, institution):
    """ Tries to patch invalid status to otherwise valid institution """
    testapp.patch_json(institution['@id'], {'status': '00f'}, status=422)


def test_patch_invalid_name(testapp, institution):
    """ Tries to patch type mismatch into name """
    testapp.patch_json(institution['@id'], {'name': 47}, status=422)
