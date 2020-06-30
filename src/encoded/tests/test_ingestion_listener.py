import pytest
import time
from uuid import uuid4
from ..ingestion_listener import IngestionQueueManager


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
