import os
import pkg_resources
import pytest
import time
import traceback
import webtest

from snovault import DBSESSION
from snovault.elasticsearch import create_mapping
from snovault.elasticsearch.indexer_queue import QueueManager, log
from unittest import mock
from .. import main
from ..loadxl import load_all
from .conftest_settings import make_app_settings_dictionary


# this file was previously used to setup the test fixtures for the BDD tests.
# now, it holds the app_settings / app / workbook needed to test a full
# app with indexing, including elasticsearch and loaded workbook inserts

@pytest.fixture
def external_tx():
    pass


@pytest.fixture(scope='session')
def app_settings(wsgi_server_host_port, elasticsearch_server, postgresql_server, aws_auth):
    settings = make_app_settings_dictionary()
    settings['create_tables'] = True
    settings['persona.audiences'] = 'http://%s:%s' % wsgi_server_host_port
    settings['elasticsearch.server'] = elasticsearch_server
    settings['sqlalchemy.url'] = postgresql_server
    settings['collection_datastore'] = 'elasticsearch'
    settings['item_datastore'] = 'elasticsearch'
    settings['indexer'] = True
    settings['indexer.namespace'] = os.environ.get('TRAVIS_JOB_ID', '') # set namespace for tests

    # use aws auth to access elasticsearch
    if aws_auth:
        settings['elasticsearch.aws_auth'] = aws_auth
    return settings


PURGE_QUEUE_CALL_STACKS = []


def show_purge_queue_calls():
    for i, stack in enumerate(PURGE_QUEUE_CALL_STACKS, start=1):
        print("#"*10, "Stack for QueueManager.purge_queue call #%s" % i, "#"*10)
        print(stack)
        print("#"*40)


def alt_purge_queue(self):  # Patterned after QueueManager.purge_queue
    PURGE_QUEUE_CALL_STACKS.append("".join(traceback.format_list(traceback.extract_stack())))
    for queue_url in [self.queue_url, self.second_queue_url, self.dlq_url]:
        try:
            self.client.purge_queue(
                QueueUrl=queue_url
            )
        except self.client.exceptions.PurgeQueueInProgress as e:
            print("QUEUE ALREADY BEING PURGED:", e)
            show_purge_queue_calls()  # For debugging
            log.warning('\n___QUEUE IS ALREADY BEING PURGED: %s___\n' % queue_url,
                        queue_url=queue_url)
            time.sleep(2)  # allow a bit of time for the log to be updated before this process is blown away

QueueManager.purge_queue = alt_purge_queue

@pytest.yield_fixture(scope='session')
def app(app_settings, **kwargs):
    """
    Pass all kwargs onto create_mapping
    """

    app = main({}, **app_settings)
    create_mapping.run(app, **kwargs)

    # old_purge_queue = QueueManager.purge_queue
    # def instrumented_purge_queue(self):
    #     PURGE_QUEUE_CALL_STACKS.append(traceback.extract_stack())
    #     return old_purge_queue(self)

    yield app

    DBSession = app.registry[DBSESSION]
    # Dispose connections so postgres can tear down.
    DBSession.bind.pool.dispose()


@pytest.mark.fixture_cost(500)
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
