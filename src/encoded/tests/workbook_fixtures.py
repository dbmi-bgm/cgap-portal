import pkg_resources
import pytest
import webtest


from ..loadxl import load_all


# this file was previously used to setup the test fixtures for the BDD tests.
# now, it holds the app_settings / app / workbook needed to test a full
# app with indexing, including elasticsearch and loaded workbook inserts

@pytest.fixture
def external_tx():
    pass


class WorkbookCache:
    """ Caches whether or not we have already provisioned the workbook. """
    done = None

    @classmethod
    def initialize_if_needed(cls, es_app):
        if not cls.done:
            cls.done = cls.make_fresh_workbook(es_app)

    @classmethod
    def make_fresh_workbook(cls, es_app):
        environ = {
            'HTTP_ACCEPT': 'application/json',
            'REMOTE_USER': 'TEST',
        }
        testapp = webtest.TestApp(es_app, environ)

        # just load the workbook inserts
        load_res = load_all(testapp, pkg_resources.resource_filename('encoded', 'tests/data/workbook-inserts/'), [])
        if load_res:
            raise (load_res)

        testapp.post_json('/index', {})
        return True


@pytest.yield_fixture(scope='session')
def workbook(es_app):
    WorkbookCache.initialize_if_needed(es_app)
    yield


@pytest.fixture(scope='session')
def testapp(es_app):
    """ TestApp with ES + Postgres. Must be imported where it is needed. """
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    return webtest.TestApp(es_app, environ)
