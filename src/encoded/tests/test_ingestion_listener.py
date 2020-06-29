import pytest
from dcicutils.env_utils import CGAP_ENV_WEBPROD
from ..ingestion_listener import IngestionQueueManager


class MockedRegistry:
    def __init__(self, settings):
        self.settings = settings


def test_ingestion_queue_manager_basic():
    """ Tests basic things about initializing the queue manager """
    registry = MockedRegistry({
        'env.name': CGAP_ENV_WEBPROD
    })
    queue_manager = IngestionQueueManager(registry)
    assert queue_manager.env_name == CGAP_ENV_WEBPROD
    assert queue_manager.queue_name == CGAP_ENV_WEBPROD + '-vcfs'
