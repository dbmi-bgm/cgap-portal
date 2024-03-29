import pytest

from dcicutils.misc_utils import TestApp
from .conftest_settings import ORDER


pytestmark = [pytest.mark.setone, pytest.mark.broken, pytest.mark.schema, pytest.mark.indexing, pytest.mark.sloppy]


@pytest.fixture(scope='session')
def minitestdata(app, conn):
    tx = conn.begin_nested()

    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    testapp = TestApp(app, environ)

    item = {
        'email': 'human@email.org',
        'first_name': 'Homo',
        'last_name': 'Sapien',
    }
    testapp.post_json('/user', item, status=201)

    yield
    tx.rollback()



@pytest.fixture(scope='session')
def minitestdata2(app, conn):
    tx = conn.begin_nested()

    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    testapp = TestApp(app, environ)

    item = {
        'email': 'human2@email.org',
        'first_name': 'Homo',
        'last_name': 'Erectus',
    }
    testapp.post_json('/user', item, status=201)

    yield
    tx.rollback()


@pytest.mark.usefixtures('minitestdata')
def test_fixtures1(testapp):
    """ This test is not really exhaustive.

    Still need to inspect the sql log to verify fixture correctness.
    """
    res = testapp.get('/user').maybe_follow()
    items = res.json['@graph']
    assert len(items) == 1

    # Trigger an error
    item = {'foo': 'bar'}
    res = testapp.post_json('/user', item, status=422)
    assert res.json['errors']

    res = testapp.get('/user').maybe_follow()
    items = res.json['@graph']
    assert len(items) == 1

    item = {
        'email': 'human3@email.org',
        'first_name': 'Homo',
        'last_name': 'Habilis',
    }
    testapp.post_json('/user', item, status=201)

    res = testapp.get('/user').maybe_follow()
    items = res.json['@graph']
    assert len(items) == 2

    # Trigger an error
    item = {'foo': 'bar'}
    res = testapp.post_json('/user', item, status=422)
    assert res.json['errors']

    res = testapp.get('/user').maybe_follow()
    items = res.json['@graph']
    assert len(items) == 2


def test_fixtures2(minitestdata2, testapp):
    # http://stackoverflow.com/questions/15775601/mutually-exclusive-fixtures
    res = testapp.get('/user').maybe_follow()
    items = res.json['@graph']
    assert len(items) == 1


def test_order_complete(app):
    order = ORDER + ['access_key']
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    testapp = TestApp(app, environ)
    master_types = []
    profiles = testapp.get('/profiles/?frame=raw').json
    for a_type in profiles:
        if profiles[a_type].get('id') and profiles[a_type]['isAbstract'] is False:
            schema_name = profiles[a_type]['id'].split('/')[-1][:-5]
            master_types.append(schema_name)
    print("order=", order)
    print(master_types)
    print("len(order)=", len(order))
    print("len(master_types)=", len(master_types))

    missing_types = [i for i in master_types if i not in order]
    extra_types = [i for i in order if i not in master_types]
    print("missing_types=", missing_types)
    print("extra_types=", extra_types)

    assert missing_types == []
    assert extra_types == []
