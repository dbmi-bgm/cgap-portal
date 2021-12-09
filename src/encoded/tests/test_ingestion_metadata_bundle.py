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
from dcicutils.qa_utils import ignored, ControlledTime, MockBotoS3Client
from unittest import mock
from .data import DBMI_PROJECT_ID, DBMI_PROJECT, DBMI_INSTITUTION_ID, DBMI_INSTITUTION, METADATA_BUNDLE_PATH, DBMI_PI
from .. import ingestion_listener as ingestion_listener_module
from .. import util as util_module
from .helpers import assure_related_items_for_testing


pytestmark = [pytest.mark.indexing, pytest.mark.working]


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
                    with mock.patch.object(boto3, "client", constantly(mocked_s3_client)):
                        with mock.patch.object(ingestion_listener_module, "get_queue_manager",
                                               constantly(mocked_queue_manager)):
                            with mock.patch.object(util_module, "subrequest_item_creation",
                                                   expect_unreachable_in_mock("subrequest_item_creation")):
                                yield


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
                                         fake_tester_email=fake_tester_email):

        ingestion_type = 'metadata_bundle'

        post_files = [("datafile", METADATA_BUNDLE_PATH)]

        creation_post_data = {
            'ingestion_type': ingestion_type,
            'institution': DBMI_INSTITUTION_ID,
            'project': DBMI_PROJECT_ID,
            "processing_status": {
                "state": "submitted"
            }
        }

        submission_post_data = {
            'validate_only': True,
        }

        creation_response = testapp.post_json("/IngestionSubmission", creation_post_data,
                                              status=201).maybe_follow().json
        [submission] = creation_response['@graph']
        uuid = submission['uuid']

        response = testapp.post("/ingestion-submissions/%s/submit_for_ingestion" % uuid,
                                submission_post_data, upload_files=post_files,
                                content_type='multipart/form-data', status=expected_status)

        assert response.status_code == expected_status, (
            "Expected response status %s but got %s."
            % (expected_status, response.status_code)
        )

        [submission_guid] = mocked_queue_manager.uuids

        s3_file_system = mocked_s3_client.s3_files.files

        expected_bucket = "elasticbeanstalk-fourfront-cgaplocal-test-metadata-bundles"

        datafile_short_name = "datafile.xlsx"
        manifest_short_name = "manifest.json"

        datafile_key = os.path.join(submission_guid, datafile_short_name)
        manifest_key = os.path.join(submission_guid, manifest_short_name)

        datafile_name = os.path.join(expected_bucket, datafile_key)
        manifest_name = os.path.join(expected_bucket, manifest_key)

        assert set(s3_file_system.keys()) == {datafile_name, manifest_name}

        assert s3_file_system[datafile_name] == file_contents(METADATA_BUNDLE_PATH,
                                                              binary=True)

        assert json.loads(s3_file_system[manifest_name].decode('utf-8')) == {
            "filename": METADATA_BUNDLE_PATH,
            "object_name": datafile_key,
            "submission_id": submission_guid,
            "submission_uri": "/ingestion-submissions/" + submission_guid,
            "beanstalk_env_is_prd": False,
            "beanstalk_env": test_pseudoenv,
            "bucket": expected_bucket,
            "authenticated_userid": "remoteuser.TEST",
            "email": fake_tester_email,
            "success": True,
            "message": "Uploaded successfully.",
            "s3_encrypt_key_id": None,
            "upload_time": dt.just_utcnow().isoformat(),
            "parameters": {
                "ingestion_type": ingestion_type,
                "institution": DBMI_INSTITUTION_ID,
                "project": DBMI_PROJECT_ID,
                "validate_only": "True",
                "datafile": METADATA_BUNDLE_PATH,
            },
        }

        # Make sure we report success from the endpoint
        assert response.status_code == 200


DBMI_COMMUNITY = {
    'Project': [DBMI_PROJECT],
    'Institution': [DBMI_INSTITUTION],
    'User': [DBMI_PI]
}


# This runs the standard test pretty much as expected.
def test_submit_for_ingestion_authorized(es_testapp):
    with assure_related_items_for_testing(testapp=es_testapp, item_dict=DBMI_COMMUNITY):
        check_submit_for_ingestion_authorized(es_testapp, MockBotoS3Client())


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
            error_info = {'Error': {'Code': 400, 'Message': "Simulated error."}}
            raise botocore.exceptions.ClientError(error_info, 'upload_fileobj')  # NoQA - PyCharm worries needlessly


def test_submit_for_ingestion_authorized_but_failed_first_s3_interaction(es_testapp):
    with assure_related_items_for_testing(testapp=es_testapp, item_dict=DBMI_COMMUNITY):
        try:
            check_submit_for_ingestion_authorized(es_testapp, MockBuggyBotoS3Client(), expected_status=400)
        except webtest.AppError as e:
            assert str(e) == ('Bad response: 500 Internal Server Error (not 400)\n'
                              'b\'{"@type": ["SubmissionFailure", "Error"],'
                              ' "status": "error",'
                              ' "code": 500,'
                              ' "title": "Internal Server Error",'
                              ' "description": "",'
                              ' "detail": "botocore.exceptions.ClientError:'
                              ' An error occurred (400) when calling the upload_fileobj operation:'
                              ' Simulated error. (no SSEKMSKeyId)"}\'')
        else:
            raise AssertionError("An expected webtest.AppError was not raised.")


def test_submit_for_ingestion_authorized_but_failed_second_s3_interaction(es_testapp):
    with assure_related_items_for_testing(testapp=es_testapp, item_dict=DBMI_COMMUNITY):
        try:
            check_submit_for_ingestion_authorized(es_testapp, MockBuggyBotoS3Client(allowed_ok=1), expected_status=400)
        except webtest.AppError as e:
            assert str(e) == ('Bad response: 500 Internal Server Error (not 400)\n'
                              'b\'{"@type": ["SubmissionFailure", "Error"],'
                              ' "status": "error",'
                              ' "code": 500,'
                              ' "title": "Internal Server Error",'
                              ' "description": "",'
                              ' "detail": "botocore.exceptions.ClientError (while uploading metadata):'
                              ' An error occurred (400) when calling the upload_fileobj operation:'
                              ' Simulated error. (no SSEKMSKeyId)"}\'')
        else:
            raise AssertionError("An expected webtest.AppError was not raised.")
