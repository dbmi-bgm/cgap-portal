import pytest
pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def malformed_project():
    return {
        'name': 'encode-project',
        'title': 17
    }


def test_post_invalid_project(testapp, malformed_project):
    """ Tries to post a project with a type mismatch for title """
    testapp.post_json('/project', malformed_project, status=422)


def test_patch_project_status(testapp, project):
    """ Patches project status """
    res = testapp.patch_json(project['@id'], {'status': 'current'}).json['@graph'][0]
    assert res['status'] == 'current'


def test_patch_project_invalid_status(testapp, project):
    """ Patches project status with invalid status """
    testapp.patch_json(project['@id'], {'status': 'blah'}, status=422)


def test_patch_project_invalid_name(testapp, project):
    """ Tries to patch project name with integer """
    testapp.patch_json(project['@id'], {'name': 47}, status=422)


@pytest.mark.parametrize(
    "property_name,expected_error",
    [
        ("", True),
        ("something", False),
        ("ignore", True),
        ("ignore_something", False),
    ]
)
def test_project_lifecycle_policy_properties(
    testapp, project, property_name, expected_error
):
    """"""
    status = 200
    if expected_error:
        status = 422
    lifecycle_policy_properties = {property_name: {"expire_after": 10}}
    patch_body = {"lifecycle_policy": lifecycle_policy_properties}
    response = testapp.patch_json(project["@id"], patch_body, status=status)
    assert response
