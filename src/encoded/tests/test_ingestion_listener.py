import pytest
import time
from uuid import uuid4
from ..ingestion_listener import IngestionQueueManager


QUEUE_INGESTION_URL = '/queue_ingestion'
MOCKED_ENV = 'fourfront-cgapother'


@pytest.yield_fixture(scope='function', autouse=True)
def setup_and_teardown_sqs_state():
    registry = MockedRegistry({
        'env.name': MOCKED_ENV
    })
    queue_manager = IngestionQueueManager(registry)
    yield queue_manager
    queue_manager.clear_queue()  # clean up messages


class MockedRegistry:
    def __init__(self, settings):
        self.settings = settings


def test_ingestion_queue_manager_basic(setup_and_teardown_sqs_state):
    """ Tests basic things about initializing the queue manager """
    queue_manager = setup_and_teardown_sqs_state
    assert queue_manager.env_name == MOCKED_ENV
    assert queue_manager.queue_name == MOCKED_ENV + '-vcfs'


def test_ingestion_queue_add_and_receive(setup_and_teardown_sqs_state):
    """ Tests adding/receiving some uuids """
    queue_manager = setup_and_teardown_sqs_state
    queue_manager.add_uuids([
        str(uuid4()), str(uuid4())
    ])
    time.sleep(10)
    msgs = queue_manager.receive_messages()
    assert len(msgs) == 2


def test_ingestion_queue_add_via_route(setup_and_teardown_sqs_state, testapp):
    """ Tests adding uuids to the queue via /queue_ingestion """
    queue_manager = setup_and_teardown_sqs_state
    request_body = {
        'uuids': [str(uuid4()), str(uuid4())],
        'override_name': MOCKED_ENV + '-vcfs'
    }
    response = testapp.post_json(QUEUE_INGESTION_URL, request_body).json
    assert response['notification'] == 'Success'
    assert response['number_queued'] == 2
    time.sleep(10)
    msgs = queue_manager.receive_messages()
    assert len(msgs) >= 2
