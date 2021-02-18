import io
import json
import os
import pytest
import time
import uuid

from dcicutils.misc_utils import ignored
from dcicutils.lang_utils import string_pluralize
from ..util import get_item_or_none, ENCODED_ROOT_DIR
from unittest import mock
from .personas import (
    PERSONA_PROJECT, PERSONA_INSTITUTION,
    name_matcher, any_name_matcher,
    lookup_inserts_for_testing, post_inserts_for_testing, lookup_and_post_inserts_for_testing,
    lookup_personas_for_testing, lookup_and_post_personas_for_testing,
    personas
)


def test_name_matcher():

    assert name_matcher('persona')('PERSONA')
    assert name_matcher('persona')('persona')
    assert name_matcher('persona')('Persona')


def test_any_name_matcher():

    assert any_name_matcher('foo', 'bar')('foo')
    assert any_name_matcher('foo', 'bar')('bar')
    assert any_name_matcher('foo', 'bar')('baz') is False

    assert any_name_matcher('foo')('foo')
    assert any_name_matcher('foo')('bar') is False
    assert any_name_matcher('foo')('baz') is False

    # If no items are specified, this matches everything, not nothing.
    assert any_name_matcher()('foo')
    assert any_name_matcher()('bar')
    assert any_name_matcher()('baz')


def test_lookup_inserts_for_testing():

    def non_admin_groups(groups):
        return 'admin' not in (groups or [])

    two_kents = lookup_inserts_for_testing(kind='User', first_name="Kent", groups=non_admin_groups)
    two_last_names = sorted(map(lambda x: x['last_name'], two_kents))
    assert two_last_names == ['Pitman-One', 'Pitman-Two']


def make_sample_item(kind, n, guid=None):
    return {
        'name': "sample-%s-%s" % (kind.lower(), n),
        'title': "Sample %s %s" % (kind, n),
        'uuid': guid or str(uuid.uuid4()),
    }


@pytest.fixture()
def sample_insert_info():
    count = 4
    kind = 'Institution'
    # inserts will be [{'name': 'sample-institution-0', 'title': "Sample Institution 0", 'uuid': ...}, ...]
    inserts = [make_sample_item(kind, i) for i in range(count)]
    guids = [insert['uuid'] for insert in inserts]
    group_prefix = '/' + string_pluralize(kind.lower()) + '/'
    return {
        'count': count,
        'kind': kind,
        'inserts': inserts,
        'guids': guids,
        'post_url': '/' + kind,
        'search_url': group_prefix,
        'get_urls': [group_prefix + guid for guid in guids]
    }


def test_post_inserts_for_testing_with_kind_and_testapp(testapp, sample_insert_info):
    _test_post_inserts_for_testing_with_kind(testapp, sample_insert_info)


def test_post_inserts_for_testing_with_kind_and_es_testapp(es_testapp, sample_insert_info, use_search=True):
    _test_post_inserts_for_testing_with_kind(es_testapp, sample_insert_info, use_search=True)


def _test_post_inserts_for_testing_with_kind(app, sample_insert_info, use_search=False):

    count = sample_insert_info['count']
    kind = sample_insert_info['kind']
    inserts = sample_insert_info['inserts']
    guids = sample_insert_info['guids']
    search_url = sample_insert_info['search_url']
    get_urls = sample_insert_info['get_urls']

    post_inserts_for_testing(app, kind=kind, inserts=inserts)

    for i in range(count):
        found = app.get(get_urls[i], status=[301]).follow().json
        expected = make_sample_item(kind, i, guid=guids[i])
        for expected_key in ['name', 'title', 'uuid']:
            assert found[expected_key] == expected[expected_key]

    if use_search:
        res = app.get(search_url, status=[200, 301])
        if res.status_code == 301:
            res = res.follow()
        all = sorted(res.json['@graph'], key=lambda x: x['name'])
        n = len(all)
        assert n == len(inserts)
        for i in range(n):
            found = all[i]
            expected = inserts[i]
            for expected_key in ['name', 'title', 'uuid']:
                assert found[expected_key] == expected[expected_key]





def test_post_inserts_for_testing_with_override_url(testapp, sample_insert_info):

    count = sample_insert_info['count']
    kind = sample_insert_info['kind']
    inserts = sample_insert_info['inserts']
    guids = sample_insert_info['guids']
    post_url = sample_insert_info['post_url']
    get_urls = sample_insert_info['get_urls']

    # It happens to be that the kind is only used to generate the url, so if override_url is offered,
    # that's all we need for testing this.  (This could be needed if the url violated standard convention
    # of just prepending '/' to url.)
    post_inserts_for_testing(testapp, kind='ignored-' + kind, override_url=post_url, inserts=inserts)

    for i in range(count):
        found = testapp.get(get_urls[i], status=[301]).follow().json
        expected = make_sample_item(kind, i, guid=guids[i])
        for expected_key in ['name', 'title', 'uuid']:
            assert found[expected_key] == expected[expected_key]


def test_lookup_and_post_inserts_for_testing_with_testapp(testapp):
    _test_lookup_and_post_inserts_for_testing(testapp)


def test_lookup_and_post_inserts_for_testing_with_es_testapp(es_testapp):
    _test_lookup_and_post_inserts_for_testing(es_testapp, use_search=True)


def _test_lookup_and_post_inserts_for_testing(app, use_search=False):

    [institution] = lookup_inserts_for_testing(kind='Institution', name=PERSONA_INSTITUTION)

    res = app.get('/institutions/', status=[200, 301, 404])
    if res.status_code == 301:
        res = res.follow()
    any_found = res.json['@graph']

    assert not any_found

    lookup_and_post_inserts_for_testing(app, kind='Institution', name=PERSONA_INSTITUTION)

    def test_it(found):

        print(json.dumps(found, indent=2))

        for expected_key in ['name', 'title', 'uuid']:
            assert found[expected_key] == institution[expected_key]

    res = app.get('/institutions/' + institution['uuid'], status=[200, 301])
    if res.status_code == 301:
        res = res.follow()

    test_it(res.json)

    if use_search:
        [found] = app.get('/institutions/', status=[301]).follow().json['@graph']
        test_it(found)


def test_lookup_personas_for_testing():

    info = lookup_personas_for_testing('developer')
    persona_institution = info['institution']
    persona_project = info['project']
    users = info['users']

    dev = users['developer']
    # We tolerate case variation in names
    assert dev['first_name'].lower() == 'developer'
    assert dev['last_name'].lower() == 'persona'
    assert dev['user_institution'] == persona_institution['uuid']
    assert dev['project'] == persona_project['uuid']
    assert any(project_role['role'] == 'developer' and project_role['project'] == dev['project']
               for project_role in dev['project_roles'])
    assert dev['project_roles'][0]['role'] == 'developer'


def test_lookup_and_post_personas_for_testing(testapp):

    declared_dev = lookup_and_post_personas_for_testing(testapp, 'developer')['users']['developer']

    resp = testapp.get('/users/' + declared_dev['uuid'], status=[200, 301])
    if resp.status_code == 301:
        resp = resp.follow()
    result = resp.json
    assert all(result[key] == declared_dev[key]
               for key in ['uuid', 'first_name', 'last_name', 'email'])


def test_personas():
    pass  # TBD
