import boto3
import botocore.exceptions
import contextlib
import datetime as datetime_module
import json
import os
import pytest
import pytz
import webtest

from dcicutils import qa_utils
from dcicutils.misc_utils import constantly, file_contents
from dcicutils.qa_utils import ignored, ControlledTime, MockBotoS3Client, MockUUIDModule
from unittest import mock
from .data import TEST_PROJECT, DBMI_INSTITUTION, METADATA_BUNDLE_PATH
from .. import ingestion_listener as ingestion_listener_module
from ..types import ingestion as ingestion_module


# TODO: These auth parts of this are adequately tested in test_submit_metadata_bundle.
#       There are other tests here of the data pipeline itself that need to be updated.
#       -kmp 25-Feb-2021
pytestmark = [pytest.mark.setone, pytest.mark.broken]


SUBMIT_FOR_INGESTION = "/submit_for_ingestion"


def expect_unreachable_in_mock(function_name):
    def fn(*args, **kwargs):
        ignored(args, kwargs)
        raise AssertionError("The function %s should not have been called. Its caller should have been mocked."
                             % function_name)
    return fn


class MockQueueManager:

    def __init__(self, expected_ingestion_type):
        self.expected_ingestion_type = expected_ingestion_type
        self.uuids = []

    def add_uuids(self, uuids, ingestion_type):
        assert ingestion_type == self.expected_ingestion_type
        self.uuids += uuids
        return uuids, []


class MockSubmissionFolioClass:

    EXPECTED_INGESTION_TYPE = 'metadata_bundle'
    EXPECTED_INSTITUTION = DBMI_INSTITUTION
    EXPECTED_PROJECT = TEST_PROJECT

    def __init__(self):
        self.guid_factory = MockUUIDModule()
        self.items_created = []

    def create_item(self, request, ingestion_type, institution, project):
        # This is ordinarily a class method, but an instance of this class will be used as a class stand-in
        # so this is an instance method.
        ignored(request)
        assert ingestion_type == self.EXPECTED_INGESTION_TYPE
        assert institution == self.EXPECTED_INSTITUTION
        assert project == self.EXPECTED_PROJECT
        guid = self.guid_factory.uuid4()
        self.items_created.append(guid)
        return guid

    @classmethod
    def make_submission_uri(cls, submission_id):
        return "/ingestion-submissions/" + submission_id


# For the old protocol, this should now be tested in test_submit_metadata_bundle.py by:
#   * test_old_protocol_content_type
#     - Shows you get a 415 if you contact /submit_for_ingestion anonymously without proper content type.
#   * test_old_protocl_404
#     - Shows you get a 404 if you contact /submit_for_ingestion anonymously or logged-in, assuming proper content type.
#
# The new protocol asks you to make a /IngestionSubmission request.
#   * test_post_ingestion_submission
#     - Shows you get a 201 if you give the right credentials.
#     - Shows you get a 403 if you are missing credentials.
#     - Shows you get a 401 if you give bad credentials.
#
# This test has been repaired to check for a 404, but it isn't really the right test any more.
# I think I will just delete it because it's redundant with other tests. No point in maintaining clutter.
#
# def test_obsolete_submit_for_ingestion_anon_rejected(anontestapp):
#
#     post_files = [("datafile", METADATA_BUNDLE_PATH)]
#
#     post_data = {
#         'ingestion_type': 'metadata_bundle',
#         'institution': DBMI_INSTITUTION,
#         'project': TEST_PROJECT,
#         'validate_only': True,
#     }
#
#     response = anontestapp.post_json(
#         SUBMIT_FOR_INGESTION,
#         post_data,
#         upload_files=post_files,
#         content_type='multipart/form-data',
#         status=404  # Once upon a time, this got a 403. Now it gets a 404 because it's the wrong protocol.
#     )
#
#     assert response.status_code == 404


@contextlib.contextmanager
def authorized_ingestion_simulation(mocked_queue_manager, mocked_s3_client, test_pseudoenv, fake_tester_email, dt):

    def mocked_get_trusted_email(request, context, raise_errors):
        assert context is "Submission"
        assert raise_errors is False
        if request.remote_user == 'TEST':
            return fake_tester_email
        else:
            return None

    with mock.patch.object(ingestion_listener_module, "get_trusted_email", mocked_get_trusted_email):
        with mock.patch.object(datetime_module, "datetime", dt):
            with mock.patch.object(ingestion_listener_module, "beanstalk_env_from_request",
                                   return_value=test_pseudoenv):
                with mock.patch.object(qa_utils, "FILE_SYSTEM_VERBOSE", False):  # This should be a parameter but isn't
                    mock_submission_folio_class = MockSubmissionFolioClass()
                    with mock.patch.object(ingestion_listener_module, "SubmissionFolio", mock_submission_folio_class):
                        with mock.patch.object(boto3, "client", constantly(mocked_s3_client)):
                            with mock.patch.object(ingestion_listener_module, "get_queue_manager",
                                                   constantly(mocked_queue_manager)):
                                with mock.patch.object(ingestion_module, "subrequest_item_creation",
                                                       expect_unreachable_in_mock("subrequest_item_creation")):

                                    yield mock_submission_folio_class


def check_submit_for_ingestion_authorized(testapp, mocked_s3_client, expected_status=200):

    class ControlledTimeWithFix(ControlledTime):

        def just_utcnow(self):
            return self.just_now().astimezone(pytz.UTC).replace(tzinfo=None)

    dt = ControlledTimeWithFix()

    mocked_queue_manager = MockQueueManager(expected_ingestion_type='metadata_bundle')

    test_pseudoenv = "fourfront-cgaplocal-test"

    fake_tester_email = "test@cgap.hms.harvard.edu"

    with authorized_ingestion_simulation(mocked_queue_manager=mocked_queue_manager,
                                         mocked_s3_client=mocked_s3_client,
                                         dt=dt,
                                         test_pseudoenv=test_pseudoenv,
                                         fake_tester_email=fake_tester_email) as mock_submission_folio_class:

        ingestion_type = 'metadata_bundle'

        post_files = [("datafile", METADATA_BUNDLE_PATH)]

        post_data = {
            'ingestion_type': ingestion_type,
            'institution': DBMI_INSTITUTION,
            'project': TEST_PROJECT,
            'validate_only': True,
        }

        response = testapp.post(SUBMIT_FOR_INGESTION, post_data, upload_files=post_files,
                                content_type='multipart/form-data', status=expected_status)

        assert response.status_code == expected_status, (
            "Expected response status %s but got %s."
            % (expected_status, response.status_code)
        )

        # The mocked guid facility makes ids sequentially, so we can predict we'll get
        # one guid added to our mock queue. This test doesn't test the queue processing,
        # only that something ends up passed off to the queue.
        expected_guid = '00000000-0000-0000-0000-000000000001'

        assert mocked_queue_manager.uuids == [expected_guid]

        assert mock_submission_folio_class.items_created == [expected_guid]

        s3_file_system = mocked_s3_client.s3_files.files

        expected_bucket = "elasticbeanstalk-fourfront-cgaplocal-test-metadata-bundles"

        datafile_short_name = "datafile.xlsx"
        manifest_short_name = "manifest.json"

        datafile_key = os.path.join(expected_guid, datafile_short_name)
        manifest_key = os.path.join(expected_guid, manifest_short_name)

        datafile_name = os.path.join(expected_bucket, datafile_key)
        manifest_name = os.path.join(expected_bucket, manifest_key)

        assert set(s3_file_system.keys()) == {datafile_name, manifest_name}

        assert s3_file_system[datafile_name] == file_contents(METADATA_BUNDLE_PATH,
                                                              binary=True)

        assert json.loads(s3_file_system[manifest_name].decode('utf-8')) == {
            "filename": METADATA_BUNDLE_PATH,
            "object_name": datafile_key,
            "submission_id": expected_guid,
            "submission_uri": "/ingestion-submissions/" + expected_guid,
            "beanstalk_env_is_prd": False,
            "beanstalk_env": test_pseudoenv,
            "bucket": expected_bucket,
            "authenticated_userid": "remoteuser.TEST",
            "email": fake_tester_email,
            "success": True,
            "message": "Uploaded successfully.",

            "upload_time": dt.just_utcnow().isoformat(),
            "parameters": {
                "ingestion_type": ingestion_type,
                "institution": DBMI_INSTITUTION,
                "project": TEST_PROJECT,
                "validate_only": "True",
                "datafile": METADATA_BUNDLE_PATH,
            },
        }

        # Make sure we report success from the endpoint
        assert response.status_code == 200


# This runs the standard test pretty much as expected.
def test_submit_for_ingestion_authorized(testapp):

    check_submit_for_ingestion_authorized(testapp, MockBotoS3Client())


# The next couple of tests are small variations in which the first or second interaction with S3 fails

class MockBuggyBotoS3Client(MockBotoS3Client):

    def __init__(self, allowed_ok=0):
        self.counter = 0
        self.allowed_ok = allowed_ok
        super().__init__()

    def upload_fileobj(self, input_file_stream, Bucket, Key):  # noqa - AWS decided args were uppercase
        self.counter += 1
        if self.counter <= self.allowed_ok:
            return super().upload_fileobj(input_file_stream, Bucket=Bucket, Key=Key)
        else:
            raise botocore.exceptions.ClientError({'Error': {'Code': 400, 'Message': "Simulated error."}},
                                                  'upload_fileobj')


def test_submit_for_ingestion_authorized_but_failed_first_s3_interaction(testapp):

    try:
        check_submit_for_ingestion_authorized(testapp, MockBuggyBotoS3Client(), expected_status=400)
    except webtest.AppError as e:
        assert str(e) == ('Bad response: 500 Internal Server Error (not 400)\n'
                          'b\'{"@type": ["SubmissionFailure", "Error"],'
                          ' "status": "error",'
                          ' "code": 500,'
                          ' "title": "Internal Server Error",'
                          ' "description": "",'
                          ' "detail": "botocore.exceptions.ClientError:'
                          ' An error occurred (400) when calling the upload_fileobj operation: Simulated error."}\'')
    else:
        raise AssertionError("An expected webtest.AppError was not raised.")


def test_submit_for_ingestion_authorized_but_failed_second_s3_interaction(testapp):

    try:
        check_submit_for_ingestion_authorized(testapp, MockBuggyBotoS3Client(allowed_ok=1), expected_status=400)
    except webtest.AppError as e:
        assert str(e) == ('Bad response: 500 Internal Server Error (not 400)\n'
                          'b\'{"@type": ["SubmissionFailure", "Error"],'
                          ' "status": "error",'
                          ' "code": 500,'
                          ' "title": "Internal Server Error",'
                          ' "description": "",'
                          ' "detail": "botocore.exceptions.ClientError (while uploading metadata):'
                          ' An error occurred (400) when calling the upload_fileobj operation: Simulated error."}\'')
    else:
        raise AssertionError("An expected webtest.AppError was not raised.")
