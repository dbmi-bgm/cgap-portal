import datetime
import json
import mock
import pytest
import time

from dcicutils.qa_utils import ignored
from uuid import uuid4
from pyramid.testing import DummyRequest
from ..ingestion_listener import (
    IngestionQueueManager, run, IngestionListener, verify_vcf_file_status_is_not_ingested,
    IngestionError, IngestionReport,
)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]
QUEUE_INGESTION_URL = '/queue_ingestion'
INGESTION_STATUS_URL = '/ingestion_status'
INGESTED_ACCESSION = 'GAPFIZ123456'
NA_ACCESSION = 'GAPFIZ654321'


def wait_for_queue_to_catch_up(queue_manager, n, initially=False):
    """ Wait until queue has done the things we told it to do. Right now this just sleeps for 10 seconds
        assuming most operations should complete within that amount of time.
    """
    ignored(queue_manager, n)
    if not initially:
        time.sleep(3)


class MockedEnv:

    MOCKED_ENV_PREFIX = 'fourfront-cgapother'
    _last_version = 0

    @classmethod
    def new_name(cls):
        cls._last_version = last_version = int(datetime.datetime.now().timestamp() * 1000000)
        return "%s%s" % (cls.MOCKED_ENV_PREFIX, last_version)


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
    assert queue_manager.env_name.startswith(MockedEnv.MOCKED_ENV_PREFIX)
    assert queue_manager.env_name[len(MockedEnv.MOCKED_ENV_PREFIX)].isdigit()
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


def test_ingestion_queue_add_via_route(fresh_ingestion_queue_manager_for_testing, workbook, es_testapp):
    """ Tests adding uuids to the queue via /queue_ingestion """
    queue_manager = fresh_ingestion_queue_manager_for_testing
    test_uuids = [str(uuid4()), str(uuid4())]
    print(str(datetime.datetime.now()), "test_uuids =", test_uuids)
    print(str(datetime.datetime.now()), "queue_manager.queue_name =", queue_manager.queue_name)
    request_body = {
        'uuids': test_uuids,
        'override_name': queue_manager.queue_name
    }
    response = es_testapp.post_json(QUEUE_INGESTION_URL, request_body).json
    print(json.dumps(response, indent=2))
    assert response['notification'] == 'Success'
    assert response['number_queued'] == 2
    _expect_message_uuids(queue_manager, test_uuids)


def test_ingestion_queue_delete(fresh_ingestion_queue_manager_for_testing, workbook, es_testapp):
    """ Tests deleting messages from SQS results in no messages being there. """
    queue_manager = fresh_ingestion_queue_manager_for_testing
    request_body = {
        'uuids': [str(uuid4()), str(uuid4())],
        'override_name': queue_manager.queue_name
    }
    es_testapp.post_json(QUEUE_INGESTION_URL, request_body, status=200)
    msgs = queue_manager.receive_messages()
    failed = queue_manager.delete_messages(msgs)
    assert failed == []
    wait_for_queue_to_catch_up(queue_manager, 0)


def test_ingestion_listener_should_remain_online(fresh_ingestion_queue_manager_for_testing):
    """ Tests that the 'should_remain_online' method works """
    def _await():
        time.sleep(3)
    before = datetime.datetime.utcnow()
    end_delta = datetime.timedelta(seconds=2)  # this diff should not occur if _await is not executed
    IngestionListener.should_remain_online(override=_await)
    after = datetime.datetime.utcnow()
    assert after > (before + end_delta)


@pytest.fixture
def mocked_familial_relations():
    return [{'samples_pedigree': [
                {
                    'sample_name': 'sample_one',
                    'relationship': 'mother',
                    'sex': 'F'
                },
                {
                    'sample_name': 'sample_two',
                    'relationship': 'father',
                    'sex': 'M'
                },
                {
                    'sample_name': 'sample_three',
                    'relationship': 'proband',
                    'sex': 'M'
                }
    ]}]


def test_ingestion_listener_build_familial_relations(workbook, es_testapp, mocked_familial_relations):
    """ Tests that we correctly extract familial relations from a mocked object that has the correct structure """
    with mock.patch.object(IngestionListener, 'search_for_sample_relations',
                           new=lambda x, y: mocked_familial_relations):
        listener = IngestionListener(es_testapp)
        relations = listener.extract_sample_relations('dummy')
        assert relations['sample_one']['samplegeno_role'] == 'mother'
        assert relations['sample_two']['samplegeno_role'] == 'father'
        assert relations['sample_three']['samplegeno_role'] == 'proband'
        assert relations['sample_one']['samplegeno_sex'] == 'F'
        assert relations['sample_two']['samplegeno_sex'] == 'M'
        assert relations['sample_three']['samplegeno_sex'] == 'M'


def test_ingestion_listener_verify_vcf_status_is_not_ingested(workbook, es_testapp):
    """ Posts a minimal processed file to be checked """
    request = DummyRequest(environ={'REMOTE_USER': 'TEST'})
    request.invoke_subrequest = es_testapp.app.invoke_subrequest
    assert verify_vcf_file_status_is_not_ingested(request, INGESTED_ACCESSION) is False
    assert verify_vcf_file_status_is_not_ingested(request, NA_ACCESSION) is True


def test_ingestion_listener_run(workbook, es_testapp, fresh_ingestion_queue_manager_for_testing):
    """ Tests the 'run' method of ingestion listener, which will pull down and ingest a vcf file
        from the SQS queue.
    """
    uuid = 'cd679bdc-8691-4352-a25b-1c5f48407e9b'
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
            run(es_testapp, _queue_manager=queue_manager)  # expected in this test since the source VCF is malformed


def test_test_port():

    from snovault.tests.test_postgresql_fixture import SNOVAULT_DB_TEST_PORT
    assert SNOVAULT_DB_TEST_PORT == 5440


@pytest.mark.parametrize('body, row', [
    ({'foo': 'bar'}, 1),
    ('Success', 2)
])
def test_ingestion_error_basic(body, row):
    """ Tests basic functionality of the error class """
    test_error = IngestionError(body, row)
    test_error_dict = test_error.to_dict()
    assert test_error_dict['body'] == str(body)
    assert test_error_dict['row'] == row


@pytest.mark.parametrize('success', [5, 10])
def test_ingestion_report_basic(success):
    """ Tests basic functionality of the Report class, which is just a collection of errors """
    report = IngestionReport()
    for _ in range(success):
        report.mark_success()
    report.mark_failure(body={'hello': 'world'}, row=1)
    assert report.grand_total == success + 1
    assert report.total_successful() == success
    assert report.total_errors() == 1
