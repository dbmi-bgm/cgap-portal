import json

from dcicutils.qa_utils import notice_pytest_fixtures
from .personas import personas, posted_personas, personas_ecosystem, posted_personas_ecosystem


notice_pytest_fixtures(personas)


def test_personas_fixture(personas):
    """
    Test that the 'personas' fixture returns a dictionary of the form
      {'institution': institution, 'project': project, 'persona_name_1: persona1, 'persona_name_2': persona2, ...}
    """
    found_institution = None
    found_project = None
    found_personas = []
    for k, v in personas.items():
        if k == 'project':
            found_project = v
        elif k == 'institution':
            found_institution = v
        else:
            assert v['last_name'] == 'Persona'
            assert v['first_name'].lower() == k
            assert not v.get('@id')  # We only get this when we post it.
            found_personas.append(k)
    print()
    print("Institution = {'name': %r, ...}" % found_institution['name'])
    print("Project = {'name': %r, ...}" % found_project['name'])
    print("Persona names =", found_personas)
    assert found_institution and found_project and found_personas


def test_posted_personas_fixture(posted_personas):
    """
    Test that the 'posted_personas' fixture returns a dictionary of the form
      {'institution': institution, 'project': project, 'persona_name_1: persona1, 'persona_name_2': persona2, ...}
    where each of the values is the information that comes back from actually posting these items,
    so reliably includes an @id, etc.
    """
    found_institution = None
    found_project = None
    found_personas = []
    for k, v in posted_personas.items():
        if k == 'project':
            found_project = v
        elif k == 'institution':
            found_institution = v
        else:
            assert v['last_name'] == 'Persona'
            assert v['first_name'].lower() == k
            assert v.get('@id')  # We get this when we post it.
            found_personas.append(k)
    print()
    print("Institution = {'name': %r, ...}" % found_institution['name'])
    print("Project = {'name': %r, ...}" % found_project['name'])
    print("Persona names =", found_personas)
    assert found_institution and found_project and found_personas


def test_personas_ecosystem_fixture(testapp, personas_ecosystem):

    users = personas_ecosystem['User']
    [institution] = personas_ecosystem['Institution']
    [project] = personas_ecosystem['Project']

    assert isinstance(users, list)
    assert all(isinstance(user, dict) for user in users)

    assert isinstance(institution, dict)
    assert isinstance(project, dict)


def test_posted_personas_ecosystem_fixture(testapp, posted_personas_ecosystem):

    [institution] = posted_personas_ecosystem['Institution']

    result = testapp.get('/institutions/' + institution['uuid']).maybe_follow().json
    assert result['@id'] == '/institutions/%s/' % institution['name']
    assert result['@id'] == institution['@id']

    [project] = posted_personas_ecosystem['Project']

    result = testapp.get('/projects/' + project['uuid']).maybe_follow().json
    assert result['@id'] == '/projects/%s/' % project['name']
    assert result['@id'] == project['@id']
