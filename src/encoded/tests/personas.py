import io
import json
import os
import pytest

from dcicutils.misc_utils import constantly, check_true
from ..util import ENCODED_ROOT_DIR, find_associations


PERSONA_INSTITUTION = 'cgap-unit-testing-institution'
PERSONA_PROJECT = 'cgap-unit-testing-project'


def name_matcher(name):
    """
    Given a string name, returns a predicate that returns True if given that name (in any case), and False otherwise.
    """
    return lambda n: n.lower() == name


def any_name_matcher(*names):
    """
    Given a list of string names, returns a predicate that matches those names. Given no names, it matches any name.
    The matcher returned is incase-sensitive.
    """
    if names:
        canonical_names = [name.lower() for name in names]
        return lambda name: name.lower() in canonical_names
    else:
        return constantly(True)


def lookup_inserts_for_testing(*, kind, inserts_folder=None, inserts_file=None, **attrs):
    if inserts_folder is None:
        inserts_folder = 'master-inserts'
    if inserts_file is None:
        inserts_file = kind.lower()
    with io.open(os.path.join(ENCODED_ROOT_DIR, "tests/data/%s/%s.json"
                                                % (inserts_folder, inserts_file))) as fp:
        inserts = json.load(fp)
    return find_associations(inserts, **attrs)


def post_inserts_for_testing(testapp, *, kind: str, override_url=None, inserts):
    check_true("/" not in kind, "A kind may not contain a slash in its name: %s" % kind)
    url = override_url or "/" + kind
    posted = []
    for item in inserts:
        print("in post_inserts_for_testing, posting", url, json.dumps(item, indent=2))
        res = testapp.post_json(url, item, content_type='application/json', status=201)
        [item] = res.json['@graph']
        posted.append(item)
    # In case the app has ES, make sure ES is up-to-date
    testapp.post_json("/index", {}, status=[200, 404])
    return posted


def lookup_and_post_inserts_for_testing(testapp, *, kind, override_url=None, inserts_folder=None, inserts_file=None, **attrs):
    inserts = lookup_inserts_for_testing(kind=kind, inserts_folder=inserts_folder, inserts_file=inserts_file, **attrs)
    if not inserts:
        return []  # nothing to post
    else:
        posted = post_inserts_for_testing(testapp, kind=kind, override_url=override_url, inserts=inserts)
        return posted


def lookup_personas_for_testing(*personas):
    any_persona_name_matcher = any_name_matcher(*personas)
    [institution] = lookup_inserts_for_testing(kind='Institution', name=PERSONA_INSTITUTION)
    [project] = lookup_inserts_for_testing(kind='Project', name=PERSONA_PROJECT)
    users = lookup_inserts_for_testing(kind='User',
                                       project=project['uuid'],
                                       user_institution=institution['uuid'],
                                       first_name=any_persona_name_matcher,
                                       last_name=name_matcher('persona'))
    return {
        'institution': institution,
        'project': project,
        'users': {user['first_name'].lower(): user
                  for user in users}
    }


def lookup_and_post_personas_for_testing(testapp, *personas):
    info = lookup_personas_for_testing(*personas)
    institution = info['institution']
    post_inserts_for_testing(testapp, kind='Institution', inserts=[institution])
    project = info['project']
    post_inserts_for_testing(testapp, kind='Project', inserts=[project])
    print("info['users']=", json.dumps(info['users'], indent=2))
    users = list(info['users'].values())
    print("users=", json.dumps(users, indent=2))
    users = post_inserts_for_testing(testapp, kind='User', inserts=users)
    return {
        'institution': institution,
        'project': project,
        'users': {user['first_name'].lower(): user
                  for user in users}
    }


@pytest.fixture()
def personas(testapp):
    return lookup_personas_for_testing()
