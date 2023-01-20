import json
import pytest

from dcicutils.misc_utils import ignorable
from .helpers import master_lookup, assure_related_items_for_testing


ignorable(json)  # sometimes used in debugging print statements


PERSONAS_PROJECT_NAME = 'cgap-personas-testing'
PERSONAS_INSTITUTION_NAME = 'cgap-personas'


@pytest.fixture
def personas_ecosystem():
    """
    This fixture is looked up from the inserts, but not posted. It looks like:
    {
      "User": [user1, user2, ...],
      "Institution": [institution],
      "Project": [project],
    }
    """
    ecosystem = {
        'User': master_lookup(item_type='User', last_name='Persona', multiple=True),
        'Institution': master_lookup(item_type='Institution', name=PERSONAS_INSTITUTION_NAME, multiple=True),
        'Project': master_lookup(item_type='Project', name=PERSONAS_PROJECT_NAME, multiple=True),
    }
    # print("personas_ecosystem =", json.dumps(ecosystem, indent=2))
    return ecosystem


@pytest.yield_fixture
def posted_personas_ecosystem(testapp, personas_ecosystem):
    """
    This fixture is looked up from the inserts, and then posted. It looks like:
    {
      "User": [user1, user2, ...],
      "Institution": [institution],
      "Project": [project],
    }
    """
    for item_type, items in personas_ecosystem.items():
        for item in items:
            uuid = item['uuid']
            # Assure none of these are pre-existing...
            testapp.get('/' + uuid, status=404)
    with assure_related_items_for_testing(testapp, personas_ecosystem):
        result = {}
        for item_type, items in personas_ecosystem.items():
            result[item_type] = gotten_items = []
            for item in items:
                uuid = item['uuid']
                res = testapp.get('/' + item_type.lower() + '/' + uuid).maybe_follow()
                gotten_items.append(res.json)
        yield result


@pytest.fixture
def personas(personas_ecosystem):
    """
    This fixture is looked up from the inserts, but not posted. It looks like:
    {
      "persona_name_1": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
      "persona_name_2": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
    }
    """
    return _make_personas_dictionary(personas_ecosystem)


@pytest.fixture
def posted_personas(posted_personas_ecosystem):
    """
    This fixture is looked up from the inserts, and then posted. It looks like:
    {
      "persona_name_1": {"first_name": "Persona_name_1", "last_name": "Persona", "@id": ..., ...other fields...},
      "persona_name_2": {"first_name": "Persona_name_1", "last_name": "Persona", "@id": ..., ...other fields...},
    }
    """
    return _make_personas_dictionary(posted_personas_ecosystem)


SPECIAL_IDENTIFIERS = ['institution', 'project']


@pytest.fixture
def personas_etc(personas_ecosystem):
    """
    This fixture is looked up from the inserts, but not posted. It looks like:
    {
      "institution": institution,  # <-- by special exception, this item is not a user
      "project": project,  # <-- by special exception, this item is not a user
      # All others are users items...
      "persona_name_1": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
      "persona_name_2": {"first_name": "Persona_name_1", "last_name": "Persona", ...other fields...},
    }
    """
    return _make_personas_dictionary(personas_ecosystem, include_special_identifiers=True)


@pytest.fixture
def posted_personas_etc(posted_personas_ecosystem):
    """
    This fixture is looked up from the inserts, and then posted. It looks like:
    {
      "institution": institution,  # <-- by special exception, this item is not a user
      "project": project,  # <-- by special exception, this item is not a user
      # All others are users items...
      "persona_name_1": {"first_name": "Persona_name_1", "last_name": "Persona", "@id": ..., ...other fields...},
      "persona_name_2": {"first_name": "Persona_name_1", "last_name": "Persona", "@id": ..., ...other fields...},
    }
    """
    return _make_personas_dictionary(posted_personas_ecosystem, include_special_identifiers=True)


def _make_personas_dictionary(ecosystem, include_special_identifiers=False):
    """
    Transforms a dictionary in 'personas ecosystem' format (a dictionary indexed by type)
    to one in 'named personas' format (indexed by entity name).

    {"User": [Persona1, Persona2, Persona3, ...], Type1: [Special1a], Type2: [Special2a], ...}
    => {persona_name_1: persona1, persona_name_2: persona2,, ... , special1: special1a, special2: special2a, ...}

    where a persona name is the lowercased 'first_name' of the persona (whose 'last_name' is 'Persona'),
    and the special name is just the downcased name of the type.
    """
    result = {}
    for persona in ecosystem['User']:
        result[persona['first_name'].lower()] = persona
    if include_special_identifiers:
        # By special case, the dictionary names 'project' and 'institution' return the related objects.
        special_keys = set()
        for k, v in ecosystem.items():
            if k != 'User':
                special_keys.add(k)
        assert {x.lower() for x in special_keys} == set(SPECIAL_IDENTIFIERS)
        for special_key in special_keys:
            [special] = ecosystem[special_key]
            result[special_key.lower()] = special
    return result


@pytest.fixture
def non_admin_persona(personas, posted_personas):
    """
    This fixture is intended to be an arbitrary choice among persona users that is NOT a group administrator.
    """
    for key, persona in personas.items():
        groups = persona.get("groups", [])
        if "admin" not in groups:
            return posted_personas[key]
    # We should have found and returned the proper result in the loop.
    raise AssertionError("No persona found that is NOT an admin.")


@pytest.fixture
def admin_persona(personas, posted_personas):
    """
    This fixture is intended to be an arbitrary choice among persona users that IS a group administrator.
    """
    for key, persona in personas.items():
        groups = persona.get("groups", [])
        if "admin" in groups:
            return posted_personas[key]
    # We should have found and returned the proper result in the loop.
    raise AssertionError("No persona found that IS an admin.")
