import pkg_resources
import pytest
import webtest

from snovault import DBSESSION
from snovault.elasticsearch import create_mapping
from .. import main
from ..loadxl import load_all


# this file was previously used to setup the test fixtures for the BDD tests.
# now, it holds the app_settings / app / workbook needed to test a full
# app with indexing, including elasticsearch and loaded workbook inserts

@pytest.fixture
def external_tx():
    pass


@pytest.yield_fixture(scope='session')
def app(es_app_settings, **kwargs):
    """
    Pass all kwargs onto create_mapping
    """
    app = main({}, **es_app_settings)
    create_mapping.run(app, **kwargs)

    yield app

    DBSession = app.registry[DBSESSION]
    # Dispose connections so postgres can tear down.
    DBSession.bind.pool.dispose()


@pytest.mark.fixture_cost(500)  # XXX: this does nothing...? -will
@pytest.yield_fixture(scope='session')
def workbook(app):
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    testapp = webtest.TestApp(app, environ)

    # just load the workbook inserts
    load_res = load_all(testapp, pkg_resources.resource_filename('encoded', 'tests/data/workbook-inserts/'), [])
    if load_res:
        raise(load_res)

    testapp.post_json('/index', {})
    yield
    # XXX cleanup
