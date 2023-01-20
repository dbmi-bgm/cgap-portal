import json

from dcicutils.lang_utils import string_pluralize
from .personas import _make_personas_dictionary, SPECIAL_IDENTIFIERS


POSTED_FIELDS = ['@id', 'principals_allowed']


def check_unposted_persona(persona, key=None):
    assert persona['last_name'] == 'Persona'
    if key:
        # If key is given, expect it to be (lowercase) "joe" for entry {"first_name": "Joe", "last_name": "Persona"}
        assert persona['first_name'].lower() == key
    assert persona['uuid']  # just make sure it has one
    # These are NOT expected to be present. They are added later by posting.
    for posted_field in POSTED_FIELDS:
        assert posted_field not in persona


def test_personas(personas):
    """
    Test that the 'personas' fixture returns a dictionary of the form
      {'institution': institution, 'project': project, 'persona_name_1: persona1, 'persona_name_2': persona2, ...}
    """
    for k, v in personas.items():
        check_unposted_persona(key=k, persona=v)


def check_posted_persona(persona, key=None):
    assert persona['last_name'] == 'Persona'
    if key:
        # If key is given, expect it to be (lowercase) "joe" for entry {"first_name": "Joe", "last_name": "Persona"}
        assert persona['first_name'].lower() == key
    assert persona['uuid']  # just make sure it has one
    assert '@' in persona['email']  # minimal test that an email is there.
    # These ARE expected to be present. They were added by posting.
    for posted_field in ['@id', 'principals_allowed']:
        assert posted_field in persona


def test_posted_personas(posted_personas):
    """
    Test that the 'personas' fixture returns a dictionary of the form
      {'institution': institution, 'project': project, 'persona_name_1: persona1, 'persona_name_2': persona2, ...}
    """
    for k, v in posted_personas.items():
        check_posted_persona(key=k, persona=v)


def test_personas_etc(personas_etc):
    """
    Test that the 'personas_etc' fixture returns a dictionary of the form
      {'institution': institution, 'project': project, 'persona_name_1: persona1, 'persona_name_2': persona2, ...}
    """
    found_specials = set()
    found_personas = []
    for k, v in personas_etc.items():
        if k in SPECIAL_IDENTIFIERS:
            found_specials.add(k)
        else:
            check_unposted_persona(key=k, persona=v)
            found_personas.append(k)
    print()
    print("Specials=", found_specials)
    print("Personas=", found_personas)
    assert found_specials == set(SPECIAL_IDENTIFIERS)
    assert found_personas


def test_posted_personas_etc(posted_personas_etc):
    """
    Test that the 'posted_personas_etc' fixture returns a dictionary of the form
      {'institution': institution, 'project': project, 'persona_name_1: persona1, 'persona_name_2': persona2, ...}
    where each of the values is the information that comes back from actually posting these items,
    so reliably includes an @id, etc.
    """
    found_specials = set()
    found_personas = []
    for k, v in posted_personas_etc.items():
        if k in SPECIAL_IDENTIFIERS:
            found_specials.add(k)
        else:
            check_posted_persona(key=k, persona=v)
            found_personas.append(k)
    print()
    print("Specials=", found_specials)
    print("Personas=", found_personas)
    assert found_specials == set(SPECIAL_IDENTIFIERS)
    assert found_personas


def test_personas_ecosystem(testapp, personas_ecosystem):
    for item_type, items in personas_ecosystem.items():
        item_type_lower = item_type.lower()
        if item_type_lower in SPECIAL_IDENTIFIERS:
            [special] = items
            assert 'name' in special
            assert 'uuid' in special
        else:
            assert item_type == 'User'
            for persona in items:
                check_unposted_persona(persona)


def test_posted_personas_ecosystem(testapp, posted_personas_ecosystem):
    for item_type, items in posted_personas_ecosystem.items():
        item_type_lower = item_type.lower()
        if item_type_lower in SPECIAL_IDENTIFIERS:
            [special] = items
            items_type = string_pluralize(item_type_lower)
            result = testapp.get('/%s/%s/' % (items_type, special['uuid'])).maybe_follow().json
            assert result['@id'] == '/%s/%s/' % (items_type, special['name'])
        else:
            assert item_type == 'User'
            for persona in items:
                check_posted_persona(persona)


def test_admin_persona(admin_persona):
    print("admin_user=", json.dumps(admin_persona, indent=2))
    assert "groups" in admin_persona
    assert "admin" in admin_persona["groups"]


def test_non_admin_persona(non_admin_persona):
    print("non_admin_user=", json.dumps(non_admin_persona, indent=2))
    assert "admin" not in non_admin_persona.get("groups", [])


# Testing of fixture support follows ...

def test_make_personas_dictionary():

    butcher = {"first_name": "Butcher", "last_name": "Persona"}
    baker = {"first_name": "Baker", "last_name": "Persona"}
    candlestick_maker = {"first_name": "Candy", "last_name": "Persona"}

    # Special entities...
    institution = {"some": "company"}
    project = {"some": "project"}

    ecosystem = {
        "User": [butcher, baker, candlestick_maker],
        "Institution": [institution],
        "Project": [project],
    }

    # Without special identifiers...
    expected = {
        "butcher": butcher,          # key is butcher['first_name'].lower()
        "baker": baker,              # key is baker['first_name'].lower()
        "candy": candlestick_maker,  # key is candlestick_maker['first_name'].lower()
    }

    actual = _make_personas_dictionary(ecosystem, include_special_identifiers=False)
    assert actual == expected

    actual = _make_personas_dictionary(ecosystem)
    assert actual == expected

    # With special identifiers...
    expected = {
        "butcher": butcher,          # key is butcher['first_name'].lower()
        "baker": baker,              # key is baker['first_name'].lower()
        "candy": candlestick_maker,  # key is candlestick_maker['first_name'].lower()
        "institution": institution,
        "project": project,
    }

    actual = _make_personas_dictionary(ecosystem, include_special_identifiers=True)
    assert actual == expected
