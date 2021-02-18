# import io
import json
import os
import pytest
import webtest

# from dcicutils.misc_utils import file_contents, check_true, VirtualApp, constantly
from dcicutils.qa_utils import (
    raises_regexp, override_environ
    # , MockFileSystem
)
# from unittest import mock
# from .personas import (
#     PERSONA_INSTITUTION, PERSONA_PROJECT,
#     name_matcher, any_name_matcher,
#     lookup_inserts_for_testing,
#     post_inserts_for_testing,
# )
from .personas import personas
from .test_access_key import basic_auth
# from ..ingestion_listener import process_submission
from ..util import (
    ENCODED_ROOT_DIR
    # , find_associations
)


def test_old_protocol_404(testapp):
    """We used to have an endpoint that is gone now. SubmitCGAP expects a 404 in that case, not (for example) a 403."""
    with raises_regexp(webtest.AppError, "404.*not found"):
        testapp.post("/submit_for_ingestion")


def test_post_ingestion_submission(anontestapp, bgm_user, bgm_project, bgm_access_key, institution):
    creation_post_data = {
        "ingestion_type": "metadata_bundle",
        "institution": institution['name'],
        "project": bgm_project['name'],
        "processing_status": {
            "state": "submitted"
        }
    }
    creation_post_headers = {
        'Content-type': 'application/json',
        'Accept':  'application/json',
        'Authorization': basic_auth(bgm_access_key['access_key_id'], bgm_access_key['secret_access_key']),
    }
    response = anontestapp.post_json("/IngestionSubmission",
                                     creation_post_data, headers=creation_post_headers, status=201)
    [submission] = response.json['@graph']
    assert submission.get('@id')


def test_post_ingestion_submission_other_project(anontestapp, non_bgm_user, non_bgm_project, non_bgm_access_key,
                                                 institution):
    creation_post_data = {
        "ingestion_type": "metadata_bundle",
        "institution": institution['name'],
        "project": non_bgm_project['name'],
        "processing_status": {
            "state": "submitted"
        }
    }
    creation_post_headers = {
        'Content-type': 'application/json',
        'Accept':  'application/json',
        'Authorization': basic_auth(non_bgm_access_key['access_key_id'], non_bgm_access_key['secret_access_key']),
    }
    response = anontestapp.post_json("/IngestionSubmission", creation_post_data, headers=creation_post_headers, status=201)
    [submission] = response.json['@graph']
    assert submission.get('@id')


def test_post_ingestion_submission_wrong_project(anontestapp, institution,
                                                 bgm_user,
                                                 bgm_project,
                                                 bgm_access_key,
                                                 non_bgm_user,
                                                 non_bgm_project,
                                                 non_bgm_access_key
                                                 ):
    with override_environ(REMOTE_USER=None):
        creation_post_data = {
            "ingestion_type": "metadata_bundle",
            "institution": institution['name'],
            "project": non_bgm_project['name'],
            "processing_status": {
                "state": "submitted"
            }
        }
        keypair = (bgm_access_key['access_key_id'], bgm_access_key['secret_access_key'])
        creation_post_headers = {
            'Content-type': 'application/json',
            'Accept':  'application/json',
            'Authorization': basic_auth(*keypair),
        }
        def dbg(label, x, *props):
            if not props:
                print("%s: %s" % (label, json.dumps(x, indent=2, default=str)))
            else:
                for prop in props:
                    print("%s[%r]: %s"
                          % (label, prop, json.dumps(x.get(prop, "<MISSING>"), indent=2, default=str)))
        dbg("bgm_user", bgm_user, '@id', 'user_institution', 'project_roles')
        dbg("non_bgm_user", non_bgm_user, '@id', 'user_institution', 'project_roles')
        dbg("bgm_project", bgm_project, '@id', 'uuid', 'name')
        dbg("non_bgm_project", non_bgm_project, '@id', 'uuid', 'name')
        dbg("bgm_access_key", bgm_access_key, 'access_key_id', 'secret_access_key')
        dbg("non_bgm_access_key", non_bgm_access_key, 'access_key_id', 'secret_access_key')
        dbg("post data", creation_post_data)
        dbg("post headers", creation_post_headers)
        print("posting /IngestionSubmission, expecting 403, with keypair", keypair)
        response = anontestapp.post_json("/IngestionSubmission", creation_post_data, headers=creation_post_headers,
                                         status=403)
        # response = requests.post("/IngestionSubmission", creation_post_data, headers=creation_post_headers)
        # dbg("response.status_code", response.status_code)
        # dbg("response.json", response.json)
        # assert response.status_code == 403


@pytest.fixture()
def ingested_item(testapp):

    project = '/projects/hms-dbmi/'
    institution = '/institutions/hms-dbmi/'

    sample_bundle_filename = os.path.join(ENCODED_ROOT_DIR, "tests/data/documents/simulated_bundle.json")

    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    ingestion_type = 'simulated_bundle'
    json_data = {
        'ingestion_type': ingestion_type,
        'institution': institution,
        'project': project,
        "processing_status": {
            "state": "submitted"
        }
    }
    print("json_data=", json_data)

    res = testapp.post_json('/IngestionSubmission', json_data, headers=headers,
                            status=201)
    [submitted_item] = res.json['@graph']
    submission_id = submitted_item['uuid']

    res = testapp.post("/ingestion-submissions/%s/submit_for_ingestion" % submission_id,
                       {
                           "ingestion_type": ingestion_type,
                           # "institution": institution,
                           # "project": project,
                           "validate_only": False
                       },
                       content_type='multipart/form-data',
                       status=200,
                       upload_files=[("datafile", sample_bundle_filename)])

    print("res.json=", json.dumps(res.json, indent=2))
    assert res.json == {
        "filename": "/Users/kentpitman/py/cgap-portal9/src/encoded/tests/data/documents/simulated_bundle.json",
        "object_name": "0cf030ca-d1d1-46b2-be91-39616cefd11a/datafile.json",
        "submission_id": "0cf030ca-d1d1-46b2-be91-39616cefd11a",
        "submission_uri": "/ingestion-submissions/0cf030ca-d1d1-46b2-be91-39616cefd11a",
        "beanstalk_env_is_prd": False,
        "beanstalk_env": None,
        "bucket": "elasticbeanstalk-fourfront-cgaplocal-test-metadata-bundles",
        "authenticated_userid": "remoteuser.TEST",
        "email": None,  # <-- This needs to get fixed.
        "success": True,
        "message": "Uploaded successfully.",
        "upload_time": "2021-02-04T17:33:59.203039",
        "parameters": {
            "ingestion_type": "simulated_bundle",
            "validate_only": "False",
            "datafile": "/Users/kentpitman/py/cgap-portal9/src/encoded/tests/data/documents/simulated_bundle.json",
            "institution": "/institutions/encode-institution/",
            "project": "/projects/encode-project/"
        }
    }


def test_process_ingestion(es_testapp, personas):
    print("personas info=", json.dumps(personas, indent=2))
    personas = personas['users']
    print('personas dict=', json.dumps(personas, indent=2))
    assert list(personas.keys()) == ['developer']


def xtest_process_ingestion(testapp, project, institution):

    project = project['name']
    institution = institution['name']

    sample_bundle_filename = os.path.join(ENCODED_ROOT_DIR, "tests/data/documents/simulated_bundle.json")

    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    ingestion_type = 'simulated_bundle'
    json_data = {
        'ingestion_type': ingestion_type,
        'institution': institution,
        'project': project,
        "processing_status": {
            "state": "submitted"
        }
    }
    print("json_data=", json_data)

    res = testapp.post_json('/IngestionSubmission', json_data, headers=headers,
                            status=201)
    [submitted_item] = res.json['@graph']
    submission_id = submitted_item['uuid']

    res = testapp.post("/ingestion-submissions/%s/submit_for_ingestion" % submission_id,
                       {
                           "ingestion_type": ingestion_type,
                           # "institution": institution,
                           # "project": project,
                           "validate_only": False
                       },
                       content_type='multipart/form-data',
                       status=200,
                       upload_files=[("datafile", sample_bundle_filename)])

    print("res.json=", json.dumps(res.json, indent=2))
    # TODO: JUST FOR DEBUGGING. THIS MUST NOT GET CHECKED IN
    assert res.json == {
        "filename": "/Users/kentpitman/py/cgap-portal9/src/encoded/tests/data/documents/simulated_bundle.json",
        "object_name": "0cf030ca-d1d1-46b2-be91-39616cefd11a/datafile.json",
        "submission_id": "0cf030ca-d1d1-46b2-be91-39616cefd11a",
        "submission_uri": "/ingestion-submissions/0cf030ca-d1d1-46b2-be91-39616cefd11a",
        "beanstalk_env_is_prd": False,
        "beanstalk_env": None,
        "bucket": "elasticbeanstalk-fourfront-cgaplocal-test-metadata-bundles",
        "authenticated_userid": "remoteuser.TEST",
        "email": None,  # <-- This needs to get fixed.
        "success": True,
        "message": "Uploaded successfully.",
        "upload_time": "2021-02-04T17:33:59.203039",
        "parameters": {
            "ingestion_type": "simulated_bundle",
            "validate_only": "False",
            "datafile": "/Users/kentpitman/py/cgap-portal9/src/encoded/tests/data/documents/simulated_bundle.json",
            "institution": "/institutions/encode-institution/",
            "project": "/projects/encode-project/"
        }
    }



        # post_files = [("datafile", METADATA_BUNDLE_PATH)]
        #
        # post_data = {
        #     'ingestion_type': ingestion_type,
        #     'institution': DBMI_INSTITUTION,
        #     'project': TEST_PROJECT,
        #     'validate_only': True,
        # }
        #
        # response = testapp.post(SUBMIT_FOR_INGESTION, post_data, upload_files=post_files,
        #                         content_type='multipart/form-data', status=expected_status)

            #
            #
            #
            # print("submission_id=", submission_id)
            #
            # json_data.update(submission_id=submission_id)
            #
            # res = process_submission(submission_id=submission_id,
            #                          ingestion_type=ingestion_type,
            #                          app=testapp.app)
            #
            # print("res=", json.dumps(res, indent=2, default=str))
            # assert res == {
            #     "result": True,
            #     "ingestion_type": 'foo1',
            #     "submission_id": 'foo2',
            #     "email": 'foo3',
            # }


            # res = testapp.post_json('/ingestion-submissions/%s/process_ingestion' % submission_id,
            #                         json_data,
            #                         headers=headers,
            #                         status=200)
            # print("res.json=", json.dumps(res.json, indent=2, default=str))
            # assert res.json == {
            #     "result": True,
            #     "ingestion_type": 'foo1',
            #     "submission_id": 'foo2',
            #     "email": 'foo3',
            # }
