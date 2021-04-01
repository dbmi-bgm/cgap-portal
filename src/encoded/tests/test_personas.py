from dcicutils.qa_utils import notice_pytest_fixtures
from .personas import personas, posted_personas, personas_ecosystem, posted_personas_ecosystem


notice_pytest_fixtures(personas)


def test_personas_fixture(testapp, personas_ecosystem):

    users = personas_ecosystem['User']
    [institution] = personas_ecosystem['Institution']
    [project] = personas_ecosystem['Project']

    assert isinstance(users, list)
    assert all(isinstance(user, dict) for user in users)

    assert isinstance(institution, dict)
    assert isinstance(project, dict)


def test_posted_personas_fixture(testapp, posted_personas_ecosystem):

    [institution] = posted_personas_ecosystem['Institution']

    result = testapp.get('/institutions/' + institution['uuid']).maybe_follow().json
    assert result['@id'] == '/institutions/%s/' % institution['name']
    assert result['@id'] == institution['@id']

    [project] = posted_personas_ecosystem['Project']

    result = testapp.get('/projects/' + project['uuid']).maybe_follow().json
    assert result['@id'] == '/projects/%s/' % project['name']
    assert result['@id'] == project['@id']
