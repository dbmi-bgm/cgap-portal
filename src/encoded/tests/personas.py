import json
import pytest

from dcicutils.misc_utils import constantly
from dcicutils.lang_utils import string_pluralize
from .helpers import master_lookup, assure_related_items_for_testing


# def name_matcher(name):
#     """
#     Given a string name, returns a predicate that returns True if given that name (in any case), and False otherwise.
#     """
#     return lambda n: n.lower() == name
#
#
# def any_name_matcher(*names):
#     """
#     Given a list of string names, returns a predicate that matches those names. Given no names, it matches any name.
#     The matcher returned is incase-sensitive.
#     """
#     if names:
#         canonical_names = [name.lower() for name in names]
#         return lambda name: name.lower() in canonical_names
#     else:
#         return constantly(True)


PERSONAS_PROJECT = 'cgap-unit-testing-project'
PERSONAS_INSTITUTION = 'cgap-backend-team'

@pytest.fixture
def personas_ecosystem():
    return {
        'User': master_lookup(item_type='User', last_name='Persona', multiple=True),
        'Institution': master_lookup(item_type='Institution', name=PERSONAS_INSTITUTION, multiple=True),
        'Project': master_lookup(item_type='Project', name=PERSONAS_PROJECT, multiple=True),
    }

@pytest.yield_fixture
def posted_personas_ecosystem(testapp, personas_ecosystem):
    for item_type, items in personas_ecosystem.items():
        for item in items:
            uuid = item['uuid']
            res = testapp.get('/' + uuid, status=(200, 404))
            if res.status_code == 200:
                pass
                import pdb; pdb.set_trace()
    with assure_related_items_for_testing(testapp, personas_ecosystem) as posted:
        yield posted


@pytest.fixture
def personas(personas_ecosystem):
    return _make_personas_dictionary(personas_ecosystem)


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
