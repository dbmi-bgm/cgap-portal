import datetime
import json
import mock
import pytest
import requests   # XXX: C4-211 this should NOT be necessary - there is a bug somewhere
import time

from dcicutils.qa_utils import ignored, notice_pytest_fixtures
from uuid import uuid4
from ..ingestion_listener import IngestionQueueManager, run, IngestionListener
from ..util import gunzip_content
from .variant_fixtures import gene_workbook, post_variant_consequence_items


pytestmark = [pytest.mark.working, pytest.mark.ingestion]
QUEUE_INGESTION_URL = '/queue_ingestion'
INGESTION_STATUS_URL = '/ingestion_status'
notice_pytest_fixtures(gene_workbook, post_variant_consequence_items)


def wait_for_queue_to_catch_up(queue_manager, n, initially=False):
    """ Wait until queue has done the things we told it to do. Right now this just sleeps for 10 seconds
        assuming most operations should complete within that amount of time.
    """
    ignored(queue_manager, n)
    if not initially:
        time.sleep(3)


class MockedEnv:

    MOCKED_ENV = 'fourfront-cgapother'
    _last_version = 0

    @classmethod
    def new_name(cls):
        cls._last_version = last_version = int(datetime.datetime.now().timestamp() * 1000000)
        return "%s%s" % (cls.MOCKED_ENV, last_version)


class IngestionQueueManagerForTesting(IngestionQueueManager):

    def __init__(self):

        mocked_env = MockedEnv.new_name()
        registry = MockedRegistry({
            'env.name': mocked_env
        })
        super().__init__(registry)

    def delete_queue(self):
        """ Deletes the queue, rendering this object unusable. You have to promise not to use it after this. """
        self.client.delete_queue(QueueUrl=self.queue_url)


@pytest.yield_fixture(scope='function', autouse=True)
def fresh_ingestion_queue_manager_for_testing():
    """ Yield fixture that initializes SQS and clears all messages after the each in this module. """
    queue_manager = IngestionQueueManagerForTesting()
    yield queue_manager
    queue_manager.delete_queue()  # reclaim the AWS resource


class MockedRegistry:
    """ Very simple mock with the single 'settings' field. """
    def __init__(self, settings):
        self.settings = settings


def test_ingestion_queue_manager_basic(fresh_ingestion_queue_manager_for_testing):
    """ Tests basic things about initializing the queue manager """
    queue_manager = fresh_ingestion_queue_manager_for_testing
    # The env name will start with a constant string and have a bunch of digits.
    assert queue_manager.env_name.startswith(MockedEnv.MOCKED_ENV)
    assert queue_manager.env_name[len(MockedEnv.MOCKED_ENV)].isdigit()
    # The queue name will have a suffix attached.
    assert queue_manager.queue_name == queue_manager.env_name + queue_manager.BUCKET_EXTENSION

    # This has to be done after the above, so that there's not a gap between fixture creation and testing its name.
    # This tests that each call gets a new name.
    assert MockedEnv.new_name() != MockedEnv.new_name()


def _expect_message_uuids(queue_manager, expected_uuids, max_tries=12):
    checklist = set(expected_uuids)
    n = len(expected_uuids)
    print("Expecting: %s" % expected_uuids)
    wait_for_queue_to_catch_up(queue_manager, 0, initially=True)
    try_count, expected_seen, strays_seen = 0, [], []
    while True:
        print(str(datetime.datetime.now()), "Try", try_count, "...")
        if try_count >= max_tries:
            print(str(datetime.datetime.now()), "Giving up")
            break
        _msgs = queue_manager.receive_messages(batch_size=1)  # should reduce flakiness
        _expected_messages = []
        _stray_messages = []
        for _msg in _msgs:
            print("Received: %r" % _msg['Body'])
            # Double-check that any message we received was ours.
            uuid = json.loads(_msg['Body'])['uuid']
            if uuid in expected_uuids:
                _expected_messages.append(_msg)
                checklist.remove(uuid)  # No longer waiting to see this
            else:
                _stray_messages.append(_msg)
                print("Unexpected message uuid: %r" % uuid)
        print(str(datetime.datetime.now()), "Received this try:", len(_msgs),
              "expected", _expected_messages, "stray", _stray_messages)
        expected_seen.extend(_expected_messages)
        strays_seen.extend(_stray_messages)
        if not checklist:  # Stop if we have nothing more to look for
            print(str(datetime.datetime.now()), "Got what we wanted")
            break
        wait_for_queue_to_catch_up(queue_manager, 0)
        try_count += 1
    print(str(datetime.datetime.now()), "Total expected messages seen:", len(expected_seen))
    print(str(datetime.datetime.now()), "Total stray messages seen:", len(strays_seen))
    # The receipt of stray messages does not void our success. Some other test is probably leaving junk around.
    # -kmp 12-Aug-2020
    assert len(expected_seen) == n
    assert not checklist  # empty set


def test_ingestion_queue_add_and_receive(fresh_ingestion_queue_manager_for_testing):
    """ Tests adding/receiving some uuids """
    queue_manager = fresh_ingestion_queue_manager_for_testing
    test_uuids = [str(uuid4()), str(uuid4())]
    print(str(datetime.datetime.now()), "test_uuids =", test_uuids)
    print(str(datetime.datetime.now()), "queue_manager.queue_name =", queue_manager.queue_name)
    queue_manager.add_uuids(test_uuids)
    _expect_message_uuids(queue_manager, test_uuids)


def test_ingestion_queue_add_via_route(fresh_ingestion_queue_manager_for_testing, testapp):
    """ Tests adding uuids to the queue via /queue_ingestion """
    queue_manager = fresh_ingestion_queue_manager_for_testing
    test_uuids = [str(uuid4()), str(uuid4())]
    print(str(datetime.datetime.now()), "test_uuids =", test_uuids)
    print(str(datetime.datetime.now()), "queue_manager.queue_name =", queue_manager.queue_name)
    request_body = {
        'uuids': test_uuids,
        'override_name': queue_manager.queue_name
    }
    response = testapp.post_json(QUEUE_INGESTION_URL, request_body).json
    print(json.dumps(response, indent=2))
    assert response['notification'] == 'Success'
    assert response['number_queued'] == 2
    _expect_message_uuids(queue_manager, test_uuids)


def test_ingestion_queue_delete(fresh_ingestion_queue_manager_for_testing, testapp):
    """ Tests deleting messages from SQS results in no messages being there. """
    queue_manager = fresh_ingestion_queue_manager_for_testing
    request_body = {
        'uuids': [str(uuid4()), str(uuid4())],
        'override_name': queue_manager.queue_name
    }
    testapp.post_json(QUEUE_INGESTION_URL, request_body, status=200)
    msgs = queue_manager.receive_messages()
    failed = queue_manager.delete_messages(msgs)
    assert failed == []
    wait_for_queue_to_catch_up(queue_manager, 0)


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


def test_ingestion_listener_should_remain_online(fresh_ingestion_queue_manager_for_testing):
    """ Tests that the 'should_remain_online' method works """
    _await = lambda: time.sleep(3)
    before = datetime.datetime.utcnow()
    end_delta = datetime.timedelta(seconds=2)  # this diff should not occur if _await is not executed
    IngestionListener.should_remain_online(override=_await)
    after = datetime.datetime.utcnow()
    assert after > (before + end_delta)


def test_ingestion_listener_run(testapp, mocked_vcf_file, gene_workbook, fresh_ingestion_queue_manager_for_testing,
                                post_variant_consequence_items):
    """ Tests the 'run' method of ingestion listener, which will pull down and ingest a vcf file
        from the SQS queue.
    """
    file_meta = mocked_vcf_file['@graph'][0]
    uuid = file_meta['uuid']
    queue_manager = fresh_ingestion_queue_manager_for_testing
    queue_manager.add_uuids([uuid])
    wait_for_queue_to_catch_up(queue_manager, 0)

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
    with mock.patch.object(IngestionListener, 'should_remain_online', new=mocked_should_remain_online):
        with pytest.raises(ValueError):
            run(testapp, _queue_manager=queue_manager)  # expected in this test since the source VCF is malformed


def test_test_port():

    from snovault.tests.test_postgresql_fixture import SNOVAULT_DB_TEST_PORT
    assert SNOVAULT_DB_TEST_PORT == 5440
