import pytest
import time
from uuid import uuid4
from ..ingestion_listener import IngestionQueueManager


QUEUE_INGESTION_URL = '/queue_ingestion'
INGESTION_STATUS_URL = '/ingestion_status'
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


@pytest.fixture
def vcf_file_format(testapp, project, institution):
    vcf_format = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': 'vcf_gz',
        'description': 'vcf, compressed',
        'standard_file_extension': 'vcf.gz',
        'valid_item_types': ['FileProcessed']
    }
    return testapp.post_json('/file_format', vcf_format, status=201).json


@pytest.fixture
def mocked_vcf_file(vcf_file_format, testapp, project, institution):
    """ Posts a processed VCF File """
    f = {
        'project': project['@id'],
        'institution': institution['@id'],
        'filename': 'GAPIDABCD123.vcf.gz',
        'file_format': 'vcf_gz'
    }
    return testapp.post_json('/file_processed', f, status=201).json


def test_posting_vcf_processed_file(testapp, mocked_vcf_file):
    """ Posts a dummy vcf file """
    pass


def test_ingestion_listener_run(testapp, mocked_vcf_file):
    """ Tests the 'run' method of ingestion listener """
    pass

