"""py.test fixtures for Pyramid.

http://pyramid.readthedocs.org/en/latest/narr/testing.html
"""
import logging
import pytest
import webtest

from dcicutils.qa_utils import notice_pytest_fixtures
from pyramid.request import apply_request_extensions
from pyramid.testing import DummyRequest
from pyramid.threadlocal import get_current_registry, manager as threadlocal_manager
from snovault import DBSESSION, ROOT, UPGRADER
from snovault.elasticsearch import ELASTIC_SEARCH, create_mapping
from snovault.util import generate_indexer_namespace_for_testing
from .conftest_settings import make_app_settings_dictionary
from .data_caches import PersonasCache, WorkbookCache
from .. import main


"""
README:
    * This file contains application level fixtures and hooks in the server/data fixtures present in
      other files. 
    * There are "app" based fixtures that rely only on postgres, "es_app" fixtures that 
      use both postgres and ES (for search/ES related testing)
"""


@pytest.fixture(autouse=True)
def autouse_external_tx(external_tx):
    notice_pytest_fixtures(external_tx)
    pass


@pytest.fixture(scope='session')
def app_settings(request, wsgi_server_host_port, conn, DBSession):  # noQA - choice of name DBSession wasn't made here
    notice_pytest_fixtures(request, wsgi_server_host_port, conn, DBSession)

    settings = make_app_settings_dictionary()
    settings['auth0.audiences'] = 'http://%s:%s' % wsgi_server_host_port
    # add some here for file testing
    settings[DBSESSION] = DBSession
    return settings


INDEXER_NAMESPACE_FOR_TESTING = generate_indexer_namespace_for_testing('cgap')


@pytest.fixture(scope='session')
def es_app_settings(wsgi_server_host_port, elasticsearch_server, postgresql_server, aws_auth):
    settings = make_app_settings_dictionary()
    settings['create_tables'] = True
    settings['persona.audiences'] = 'http://%s:%s' % wsgi_server_host_port  # 2-tuple such as: ('localhost', '5000')
    settings['elasticsearch.server'] = elasticsearch_server
    settings['sqlalchemy.url'] = postgresql_server
    settings['collection_datastore'] = 'elasticsearch'
    settings['item_datastore'] = 'elasticsearch'
    settings['indexer'] = True
    settings['indexer.namespace'] = INDEXER_NAMESPACE_FOR_TESTING

    # use aws auth to access elasticsearch
    if aws_auth:
        settings['elasticsearch.aws_auth'] = aws_auth
    return settings


def pytest_configure():
    logging.basicConfig(format='%(message)s')
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

    class Shorten(logging.Filter):
        max_len = 500

        def filter(self, record):
            if record.msg == '%r':
                record.msg = record.msg % record.args
                record.args = ()
            if len(record.msg) > self.max_len:
                record.msg = record.msg[:self.max_len] + '...'
            return True

    logging.getLogger('sqlalchemy.engine.base.Engine').addFilter(Shorten())


@pytest.yield_fixture
def threadlocals(request, dummy_request, registry):
    notice_pytest_fixtures(request, dummy_request, registry)

    threadlocal_manager.push({'request': dummy_request, 'registry': registry})
    yield dummy_request
    threadlocal_manager.pop()


class MyDummyRequest(DummyRequest):
    def remove_conditional_headers(self):
        pass

    def _get_registry(self):
        if self._registry is None:
            return get_current_registry()
        return self._registry

    def _set_registry(self, registry):
        self.__dict__['registry'] = registry

    def _del_registry(self):
        self._registry = None

    registry = property(_get_registry, _set_registry, _del_registry)


@pytest.fixture
def dummy_request(root, registry, app):
    request = app.request_factory.blank('/dummy')
    request.root = root
    request.registry = registry
    request._stats = {}
    request.invoke_subrequest = app.invoke_subrequest
    apply_request_extensions(request)
    return request


@pytest.fixture(scope='session')
def app(app_settings):
    """ WSGI application level functional testing. """
    return main({}, **app_settings)


@pytest.fixture(scope='session')
def es_app(es_app_settings, **kwargs):
    """
    App that uses both Postgres and ES - pass this as "app" argument to TestApp.
    Pass all kwargs onto create_mapping
    """
    app = main({}, **es_app_settings)
    create_mapping.run(app, **kwargs)

    return app


@pytest.fixture
def registry(app):
    return app.registry


@pytest.fixture
def elasticsearch(registry):
    return registry[ELASTIC_SEARCH]


@pytest.fixture
def upgrader(registry):
    return registry[UPGRADER]


@pytest.fixture
def root(registry):
    return registry[ROOT]


# TODO: Reconsider naming to have some underscores interspersed for better readability.
#       e.g., html_testapp rather than htmltestapp, and especially anon_html_test_app rather than anonhtmltestapp.
#       -kmp 03-Feb-2020

@pytest.fixture
def anonhtmltestapp(app):
    environ = {
        'HTTP_ACCEPT': 'text/html'
    }
    test_app = webtest.TestApp(app, environ)
    # original_get = test_app.get
    # # Emulate client acting as a browser when making requests to this (unless other header supplied)
    # def new_get_request(url, params=None, headers=None, **kwargs):
    #     new_headers = { "Accept" : "text/html" }
    #     new_headers.update(headers or {})
    #     return original_get(url, params=params, headers=new_headers, **kwargs)
    # setattr(test_app, "get", new_get_request)
    return test_app


@pytest.fixture
def anon_html_es_testapp(es_app):
    environ = {
        'HTTP_ACCEPT': 'text/html'
    }
    return webtest.TestApp(es_app, environ)


@pytest.fixture
def htmltestapp(app):
    environ = {
        'HTTP_ACCEPT': 'text/html',
        'REMOTE_USER': 'TEST',
    }
    test_app = webtest.TestApp(app, environ)
    # original_get = test_app.get
    # # Emulate client acting as a browser when making requests to this (unless other header supplied)
    # def new_get_request(url, params=None, headers=None, **kwargs):
    #     new_headers = { "Accept" : "text/html" }
    #     new_headers.update(headers or {})
    #     return original_get(url, params=params, headers=new_headers, **kwargs)
    # setattr(test_app, "get", new_get_request)
    return test_app


@pytest.fixture
def html_es_testapp(es_app):
    """ HTML testapp that uses ES """
    environ = {
        'HTTP_ACCEPT': 'text/html',
        'REMOTE_USER': 'TEST',
    }
    return webtest.TestApp(es_app, environ)


@pytest.fixture(scope="session")
def testapp(app):
    """TestApp with JSON accept header.
    """
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    return webtest.TestApp(app, environ)


@pytest.fixture(scope='session')
def es_testapp(es_app):
    """ TestApp with ES + Postgres. Must be imported where it is needed. """
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    return webtest.TestApp(es_app, environ)


@pytest.fixture
def anontestapp(app):
    """TestApp for anonymous user (i.e., no user specified), accepting JSON data."""
    environ = {
        'HTTP_ACCEPT': 'application/json',
    }
    return webtest.TestApp(app, environ)


@pytest.fixture
def anon_es_testapp(es_app):
    """ TestApp simulating a bare Request entering the application (with ES enabled) """
    environ = {
        'HTTP_ACCEPT': 'application/json',
    }
    return webtest.TestApp(es_app, environ)


@pytest.fixture
def authenticated_testapp(app):
    """TestApp for an authenticated, non-admin user (TEST_AUTHENTICATED), accepting JSON data."""
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST_AUTHENTICATED',
    }
    return webtest.TestApp(app, environ)


@pytest.fixture
def authenticated_es_testapp(es_app):
    """ TestApp for authenticated non-admin user with ES """
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST_AUTHENTICATED',
    }
    return webtest.TestApp(es_app, environ)


@pytest.fixture
def submitter_testapp(app):
    """TestApp for a non-admin user (TEST_SUBMITTER), accepting JSON data."""
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST_SUBMITTER',
    }
    return webtest.TestApp(app, environ)


@pytest.fixture
def indexer_testapp(es_app):
    """ Indexer testapp, meant for manually triggering indexing runs by posting to /index.
        Always uses the ES app (obviously, but not so obvious previously) """
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'INDEXER',
    }
    return webtest.TestApp(es_app, environ)


@pytest.fixture
def embed_testapp(app):
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'EMBED',
    }
    return webtest.TestApp(app, environ)


@pytest.fixture
def wsgi_app(wsgi_server):
    return webtest.TestApp(wsgi_server)


@pytest.fixture(scope='session')
def indexer_namespace(es_app_settings):
    return es_app_settings['indexer.namespace']


@pytest.fixture(scope='session')
def obsolete_workbook(es_testapp, elasticsearch_server_dir, indexer_namespace):
    """ Loads a bunch of data (tests/data/workbook-inserts) into the system on first run
        (session scope doesn't work). """
    WorkbookCache.assure_data_once_loaded(es_testapp,
                                          datadir=elasticsearch_server_dir,
                                          indexer_namespace=indexer_namespace)


@pytest.fixture(scope='session')
def obsolete_personas(es_testapp, elasticsearch_server_dir, indexer_namespace):
    """ Loads a bunch of data (tests/data/workbook-inserts) into the system on first run
        (session scope doesn't work). """
    PersonasCache.assure_data_once_loaded(es_testapp,
                                          datadir=elasticsearch_server_dir,
                                          indexer_namespace=indexer_namespace)


@pytest.fixture()
def workbook(es_testapp, elasticsearch_server_dir, indexer_namespace):
    WorkbookCache.assure_data_loaded(es_testapp,
                                     datadir=elasticsearch_server_dir,
                                     indexer_namespace=indexer_namespace)


@pytest.fixture()
def personas(es_testapp, elasticsearch_server_dir, indexer_namespace):
    PersonasCache.assure_data_loaded(es_testapp,
                                     datadir=elasticsearch_server_dir,
                                     indexer_namespace=indexer_namespace)
