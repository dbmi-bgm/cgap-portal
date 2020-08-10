import pytest
import requests   # XXX: C4-211 this should NOT be necessary - there is a bug somewhere
import time
import mock
import datetime
from uuid import uuid4
from dcicutils.qa_utils import ignored, notice_pytest_fixtures
from ..ingestion_listener import IngestionQueueManager, run, IngestionListener
from ..util import gunzip_content
from .variant_fixtures import gene_workbook, post_variant_consequence_items


pytestmark = [pytest.mark.working, pytest.mark.ingestion]
QUEUE_INGESTION_URL = '/queue_ingestion'
INGESTION_STATUS_URL = '/ingestion_status'
MOCKED_ENV = 'fourfront-cgapother'
notice_pytest_fixtures(gene_workbook, post_variant_consequence_items)


def wait_for_queue_to_catch_up(n):
    """ Wait until queue has done the things we told it to do. Right now this just sleeps for 10 seconds
        assuming most operations should complete within that amount of time.
    """
    time.sleep(10)


@pytest.yield_fixture(scope='function', autouse=True)
def setup_and_teardown_sqs_state():
    """ Yield fixture that initializes SQS and clears all messages after the each in this module. """
    registry = MockedRegistry({
        'env.name': MOCKED_ENV
    })
    queue_manager = IngestionQueueManager(registry)
    yield queue_manager
    queue_manager.clear_queue()  # clean up messages


class MockedRegistry:
    """ Very simple mock with the single 'settings' field. """
    def __init__(self, settings):
        self.settings = settings


def test_ingestion_queue_manager_basic(setup_and_teardown_sqs_state):
    """ Tests basic things about initializing the queue manager """
    queue_manager = setup_and_teardown_sqs_state
    assert queue_manager.env_name == MOCKED_ENV
    assert queue_manager.queue_name == MOCKED_ENV + queue_manager.BUCKET_EXTENSION


def test_ingestion_queue_add_and_receive(setup_and_teardown_sqs_state):
    """ Tests adding/receiving some uuids """
    queue_manager = setup_and_teardown_sqs_state
    queue_manager.add_uuids([
        str(uuid4()), str(uuid4())
    ])
    wait_for_queue_to_catch_up(0)
    tries, msgs = 10, []
    while len(msgs) < 2:
        if tries < 0:
            break
        _msgs = queue_manager.receive_messages(batch_size=1)  # should reduce flakiness
        msgs.extend(_msgs)
        wait_for_queue_to_catch_up(0)
        tries -= 1
    assert len(msgs) == 2


def test_ingestion_queue_add_via_route(setup_and_teardown_sqs_state, testapp):
    """ Tests adding uuids to the queue via /queue_ingestion """
    queue_manager = setup_and_teardown_sqs_state
    request_body = {
        'uuids': [str(uuid4()), str(uuid4())],
        'override_name': MOCKED_ENV + queue_manager.BUCKET_EXTENSION
    }
    response = testapp.post_json(QUEUE_INGESTION_URL, request_body).json
    assert response['notification'] == 'Success'
    assert response['number_queued'] == 2
    wait_for_queue_to_catch_up(0)
    msgs = queue_manager.receive_messages()
    assert len(msgs) >= 2


def test_ingestion_queue_delete(setup_and_teardown_sqs_state, testapp):
    """ Tests deleting messages from SQS results in no messages being there. """
    queue_manager = setup_and_teardown_sqs_state
    request_body = {
        'uuids': [str(uuid4()), str(uuid4())],
        'override_name': MOCKED_ENV + queue_manager.BUCKET_EXTENSION
    }
    testapp.post_json(QUEUE_INGESTION_URL, request_body, status=200)
    msgs = queue_manager.receive_messages()
    failed = queue_manager.delete_messages(msgs)
    assert failed == []
    wait_for_queue_to_catch_up(0)


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
        'uuid': 'cd679bdc-8691-4352-a25b-1c5f48407e9b',
        'accession': 'GAPFIPYY5V7Y',
        'project': project['@id'],
        'institution': institution['@id'],
        'filename': 'GAPFIPYY5V7Y.vcf.gz',
        'file_format': 'vcf_gz'
    }
    return testapp.post_json('/file_processed', f, status=201).json


@pytest.mark.integrated  # uses s3
def test_posting_vcf_processed_file(testapp, mocked_vcf_file):
    """ Posts a dummy vcf file """
    file_meta = mocked_vcf_file['@graph'][0]
    file_location = testapp.get(file_meta['href']).location  # if you .follow() this you get 404 erroneously
    content = requests.get(file_location).content
    raw_vcf_file = gunzip_content(content)
    assert "##fileformat=VCFv4.2" in raw_vcf_file


def test_ingestion_listener_should_remain_online(setup_and_teardown_sqs_state):
    """ Tests that the 'should_remain_online' method works """
    _await = lambda: time.sleep(3)
    before = datetime.datetime.utcnow()
    end_delta = datetime.timedelta(seconds=2)  # this diff should not occur if _await is not executed
    IngestionListener.should_remain_online(override=_await)
    after = datetime.datetime.utcnow()
    assert after > (before + end_delta)


def test_ingestion_listener_run(testapp, mocked_vcf_file, gene_workbook, setup_and_teardown_sqs_state,
                                post_variant_consequence_items):
    """ Tests the 'run' method of ingestion listener, which will pull down and ingest a vcf file
        from the SQS queue.
    """
    file_meta = mocked_vcf_file['@graph'][0]
    uuid = file_meta['uuid']
    queue_manager = setup_and_teardown_sqs_state
    queue_manager.add_uuids([uuid])
    wait_for_queue_to_catch_up(0)

    # configure run for 10 seconds
    start_time = datetime.datetime.utcnow()
    end_delta = datetime.timedelta(seconds=10)

    def mocked_should_remain_online(override=None):
        ignored(override)
        current_time = datetime.datetime.utcnow()
        return current_time < (start_time + end_delta)

    # XXX: This is a really hard thing to test, but take my word for it that this is doing "something" -Will
    #      If you do not get ValueError here, it means the VCF wasn't processed in the run method or a different
    #      error occurred.
    with mock.patch('encoded.ingestion_listener.IngestionListener.should_remain_online',
                    new=mocked_should_remain_online):
        with pytest.raises(ValueError):
            run(testapp, _queue_manager=queue_manager)  # expected in this test since the source VCF is malformed
