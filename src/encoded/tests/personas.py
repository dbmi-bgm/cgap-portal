import json
import pytest

from .helpers import master_lookup, assure_related_items_for_testing


PERSONAS_PROJECT = 'cgap-unit-testing-project'
PERSONAS_INSTITUTION = 'cgap-backend-team'


# The personas_ecosystem fixture is looked up from the inserts, but not posted. It looks like:
#
# {
#     "User": [user1, user2, ...],
#     "Institution": [institution],
#     "Project": [project],
# }

@pytest.fixture
def personas_ecosystem():
    ecosystem = {
        'User': master_lookup(item_type='User', last_name='Persona', multiple=True),
        'Institution': master_lookup(item_type='Institution', name=PERSONAS_INSTITUTION, multiple=True),
        'Project': master_lookup(item_type='Project', name=PERSONAS_PROJECT, multiple=True),
    }
    print("personas_ecosystem =", json.dumps(ecosystem, indent=2))
    return ecosystem


# The posted_personas_ecosystem fixture is looked up from the inserts, and then posted. It looks like:
#
# {
#     "User": [user1, user2, ...],
#     "Institution": [institution],
#     "Project": [project],
# }

@pytest.yield_fixture
def posted_personas_ecosystem(testapp, personas_ecosystem):
    for item_type, items in personas_ecosystem.items():
        for item in items:
            uuid = item['uuid']
            res = testapp.get('/' + uuid, status=(200, 404))
            if res.status_code == 200:
                pass
    with assure_related_items_for_testing(testapp, personas_ecosystem) as posted:
        yield posted


# The personas fixture is looked up from the inserts, but not posted. It looks like:
#
# {
#     "institution": institution,  # <-- by special exception, this item is not a user
#     "project": project,  # <-- by special exception, this item is not a user
#     # All others are users items...
#     "persona_name_1": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
#     "persona_name_2": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
# }
#

@pytest.fixture
def personas(personas_ecosystem):
    return _make_personas_dictionary(personas_ecosystem)


# The personas fixture is looked up from the inserts, and then posted. It looks like:
#
# {
#     "institution": institution,  # <-- by special exception, this item is not a user
#     "project": project,  # <-- by special exception, this item is not a user
#     # All others are users items...
#     "persona_name_1": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
#     "persona_name_2": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
# }
#

@pytest.fixture
def posted_personas(posted_personas_ecosystem):
    return _make_personas_dictionary(posted_personas_ecosystem)


def _make_personas_dictionary(ecosystem):
    result = {}
    for persona in ecosystem['User']:
        result[persona['first_name'].lower()] = persona
    # By special case, the dictionary names 'project' and 'institution' return the related objects.
    assert not result.get('institution')
    [institution] = ecosystem['Institution']
    result['institution'] = institution
    assert not result.get('project')
    [project] = ecosystem['Project']
    result['project'] = project
    return result


# This fixture is intended to be an arbitrary choice among persona users that is NOT a group administrator.

@pytest.fixture
def non_admin_user(posted_personas):
    result = posted_personas['developer']
    # Really we probably only care that "admin" not in result.get("groups", [])
    # but for now we have users that are clean of groups, so look for the stronger
    # constraint just to be sure we don't have a user with any special perms.
    # We could actually even search for a user with the cleanest set of perms,
    # but it doesn't change often and this should suffice for now. -kmp 2-Apr-2021
    assert not result.get("groups", [])
