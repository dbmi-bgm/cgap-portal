"""py.test fixtures for Pyramid.

http://pyramid.readthedocs.org/en/latest/narr/testing.html
"""
import logging
import pytest
import webtest
import pkg_resources

from pyramid.request import apply_request_extensions
from pyramid.testing import DummyRequest, setUp, tearDown
from pyramid.threadlocal import get_current_registry, manager as threadlocal_manager
from snovault import DBSESSION, ROOT, UPGRADER
from snovault.elasticsearch import ELASTIC_SEARCH, create_mapping
from snovault.util import generate_indexer_namespace_for_testing
from snovault.storage import Base
from snovault.app import configure_engine
from .conftest_settings import make_app_settings_dictionary
from .. import main
from ..loadxl import load_all


"""
README:
    * This file contains application level fixtures and hooks in the server/data fixtures present in
      other files. 
    * There are "app" based fixtures that rely only on postgres, "es_app" fixtures that 
      use both postgres and ES (for search/ES related testing)
"""


@pytest.yield_fixture(scope='session')
def docker_db_conn():
    """ Equiavlent to 'conn' fixture in snovault, but with Docker url instead. """
    engine_settings = {
        'sqlalchemy.url': 'postgres://postgres:postgres@db:5432/postgres',  # for local deployment, use default postgres
    }
    engine = configure_engine(engine_settings)
    conn = engine.connect()
    tx = conn.begin()
    try:
        Base.metadata.create_all(bind=conn)
        yield conn
    finally:
        tx.rollback()
        conn.close()
        engine.dispose()


@pytest.yield_fixture(scope='session')
def external_tx(request, docker_db_conn):
    """ Taken from snovault to use Docker conn """
    notice_pytest_fixtures(request)
    tx = docker_db_conn.begin_nested()
    yield tx
    tx.rollback()


@pytest.fixture(autouse=True)
def autouse_external_tx(external_tx):
    pass


@pytest.yield_fixture(scope='session')
def zsa_savepoints(docker_db_conn):
    """ Place a savepoint at the start of the zope transaction
    This means failed requests rollback to the db state when they began rather
    than that at the start of the test.

    Taken from snovault, refactored to replace local 'conn' with Docker
    """
    notice_pytest_fixtures(docker_db_conn)
    @implementer(ISynchronizer)
    class Savepoints(object):
        def __init__(self, conn):
            self.conn = conn
            self.sp = None
            self.state = None

        def beforeCompletion(self, transaction):
            pass

        def afterCompletion(self, transaction):
            # txn be aborted a second time in manager.begin()
            if self.sp is None:
                return
            if self.state == 'commit':
                self.state = 'completion'
                self.sp.commit()
            else:
                self.state = 'abort'
                self.sp.rollback()
            self.sp = None
            self.state = 'done'

        def newTransaction(self, transaction):
            self.state = 'new'
            self.sp = self.conn.begin_nested()
            self.state = 'begun'
            transaction.addBeforeCommitHook(self._registerCommit)

        def _registerCommit(self):
            self.state = 'commit'

    zsa_savepoints = Savepoints(conn)

    transaction_management.manager.registerSynch(zsa_savepoints)

    yield zsa_savepoints
    transaction_management.manager.unregisterSynch(zsa_savepoints)


@pytest.fixture(scope='session')
def _DBSession(docker_db_conn):
    """ taken from snovault, replace conn with Docker """
    notice_pytest_fixtures(docker_db_conn)
    # ``server`` thread must be in same scope
    DBSession = sqlalchemy.orm.scoped_session(sqlalchemy.orm.sessionmaker(bind=docker_db_conn), scopefunc=lambda: 0)
    zope.sqlalchemy.register(DBSession)
    return DBSession


@pytest.fixture(scope='session')
def DBSession(_DBSession, zsa_savepoints, check_constraints):
    """ taken directly from snovault """
    return _DBSession


@pytest.fixture
def transaction(request, external_tx, zsa_savepoints, check_constraints):
    """ taken directly from snovault """
    notice_pytest_fixtures(request, external_tx, zsa_savepoints, check_constraints)
    transaction_management.begin()
    request.addfinalizer(transaction_management.abort)
    return transaction_management


@pytest.fixture
def session(transaction, DBSession):
    """ Returns a setup session
    Depends on transaction as storage relies on some interaction there.

    Taken directly from snovault
    """
    notice_pytest_fixtures(transaction, DBSession)
    return DBSession()


@pytest.yield_fixture(scope='session')
def check_constraints(docker_db_conn, _DBSession):
    """
    Check deferred constraints on zope transaction commit.
    Deferred foreign key constraints are only checked at the outer transaction
    boundary, not at a savepoint. With the Pyramid transaction bound to a
    subtransaction check them manually.

    Taken from snovault and dropped in docker conn
    """
    notice_pytest_fixtures(_DBSession)

    @implementer(ISynchronizer)
    class CheckConstraints(object):
        def __init__(self, conn):
            self.conn = conn
            self.state = None

        def beforeCompletion(self, transaction):
            pass

        def afterCompletion(self, transaction):
            pass

        def newTransaction(self, transaction):

            @transaction.addBeforeCommitHook
            def set_constraints():
                self.state = 'checking'
                session = _DBSession()
                session.flush()
                sp = self.conn.begin_nested()
                try:
                    self.conn.execute('SET CONSTRAINTS ALL IMMEDIATE')
                except:
                    sp.rollback()
                    raise
                else:
                    self.conn.execute('SET CONSTRAINTS ALL DEFERRED')
                finally:
                    sp.commit()
                    self.state = None

    check_constraints = CheckConstraints(docker_db_conn)

    transaction_management.manager.registerSynch(check_constraints)

    yield check_constraints

    transaction_management.manager.unregisterSynch(check_constraints)


@pytest.fixture(scope='session')
def app_settings(request, wsgi_server_host_port, docker_db_conn):

    settings = make_app_settings_dictionary()
    settings['auth0.audiences'] = 'http://%s:%s' % wsgi_server_host_port
    settings['sqlalchemy.url'] = 'postgres://postgres:postgres@db:5432/postgres'
    settings[DBSESSION] = docker_db_conn  # set DB connection to Docker
    return settings


INDEXER_NAMESPACE_FOR_TESTING = generate_indexer_namespace_for_testing('cgap')


@pytest.fixture(scope='session')
def es_app_settings(wsgi_server_host_port, aws_auth):
    settings = make_app_settings_dictionary()
    settings['create_tables'] = True
    settings['persona.audiences'] = 'http://%s:%s' % wsgi_server_host_port  # 2-tuple such as: ('localhost', '5000')
    settings['elasticsearch.server'] = 'search-cgap-testing-6-8-vo4mdkmkshvmyddc65ux7dtaou.us-east-1.es.amazonaws.com:443'
    settings['sqlalchemy.url'] = 'postgres://postgres:postgres@db:5432/postgres'
    settings['collection_datastore'] = 'elasticsearch'
    settings['item_datastore'] = 'elasticsearch'
    settings['indexer'] = True
    settings['indexer.namespace'] = INDEXER_NAMESPACE_FOR_TESTING

    # use aws auth to access elasticsearch
    settings['elasticsearch.aws_auth'] = True
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

        # Just load the workbook inserts
        # Note that load_all returns None for success or an Exception on failure.
        load_res = load_all(testapp, pkg_resources.resource_filename('encoded', 'tests/data/workbook-inserts/'), [])

        if isinstance(load_res, Exception):
            raise load_res
        elif load_res:
            raise RuntimeError("load_all returned a true value that was not an exception.")

        testapp.post_json('/index', {})
        return True


@pytest.fixture(scope='session')
def workbook(es_app):
    """ Loads a bunch of data (tests/data/workbook-inserts) into the system on first run
        (session scope doesn't work). """
    WorkbookCache.initialize_if_needed(es_app)
