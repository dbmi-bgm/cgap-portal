import json
import os
import pytest
import re
import webtest

from dcicutils.qa_utils import raises_regexp, override_environ
from ..util import make_vapp_for_email
from .test_access_key import basic_auth
from ..util import ENCODED_ROOT_DIR


# These tests will work but may leave garbage around from stray submissions.
# If that causes a problem, we'll need to write some cleanup code. -kmp 21-Feb-2021
pytestmark = [pytest.mark.setone, pytest.mark.working]


@pytest.mark.unit
def test_old_protocol_content_type(testapp, bgm_access_key):
    """
    We used to have an endpoint that is gone now.
    Except by special exception, all our endpoints need to deal in application/json content.
    """
    with raises_regexp(webtest.AppError, "415.*[Uu]nsupported [Mm]edia [Tt]ype"):
        testapp.post("/submit_for_ingestion")


@pytest.mark.unit
def test_old_protocol_404(testapp, anontestapp):
    """We used to have an endpoint that is gone now. SubmitCGAP expects a 404 in that case, not (for example) a 403."""

    # If post_json is used, it arranges a Content-Type header. So we get a 404, with or without auth.
    # If we hadn't set up Content-Type properly, we'd have gotten a 415.
    with raises_regexp(webtest.AppError, "404.*[Nn]ot [Ff]ound"):
        testapp.post_json("/submit_for_ingestion")

    with raises_regexp(webtest.AppError, "404.*[Nn]ot [Ff]ound"):
        anontestapp.post_json("/submit_for_ingestion")

    # Here we set the header up manually and get a 404 that way, too, with or without auth.
    with raises_regexp(webtest.AppError, "404.*[Nn]ot [Ff]ound"):
        headers = {
            'Content-type': 'application/json',
            'Accept':  'application/json',
        }
        testapp.post("/submit_for_ingestion", {}, headers=headers)

    with raises_regexp(webtest.AppError, "404.*[Nn]ot [Ff]ound"):
        headers = {
            'Content-type': 'application/json',
            'Accept':  'application/json',
        }
        anontestapp.post("/submit_for_ingestion", {}, headers=headers)


@pytest.mark.sloppy
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
    # NOTE: The headers contain credentials. Using anontestapp makes sure we rely on those credentials to get in.
    response = anontestapp.post_json("/IngestionSubmission", creation_post_data, headers=creation_post_headers,
                                     status=201)
    [submission] = response.json['@graph']
    assert submission.get('@id')

    # Test that if we're missing credentials, we get rejected.

    creation_post_headers_with_missing_auth = {
        'Content-type': 'application/json',
        'Accept':  'application/json',
    }
    # NOTE: The headers LACK credentials. Using anontestapp means we'll need some, so will get a 403 rejection.
    response = anontestapp.post_json("/IngestionSubmission", creation_post_data,
                                     headers=creation_post_headers_with_missing_auth, status=403)
    assert response.status_code == 403
    assert response.json['title'] == 'Forbidden'
    assert response.json['description'].startswith("Access was denied")

    # Test that if we have junk credentials, we get rejected.

    creation_post_headers_with_bad_password = {
        'Content-type': 'application/json',
        'Accept':  'application/json',
        'Authorization': basic_auth(bgm_access_key['access_key_id'], 'hopefully this will not work'),
    }
    # NOTE: The headers have WRONG credentials. Using anontestapp means we'll need some, so will get a 403 rejection.
    response = anontestapp.post_json("/IngestionSubmission", creation_post_data,
                                     headers=creation_post_headers_with_bad_password, status=401)
    assert response.status_code == 401
    assert response.json['title'] == 'No Access'
    assert response.json['description'].startswith('This server could not verify that you are authorized')


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


def test_process_ingestion(testapp, posted_personas):

    project = posted_personas['project']
    project_name = project['name']
    institution = posted_personas['institution']
    institution_name = institution['name']
    developer = posted_personas['developer']
    email = developer['email']
    developer_testapp = make_vapp_for_email(email=email, app=testapp.app)

    sample_bundle_filename = os.path.join(ENCODED_ROOT_DIR, "tests/data/documents/simulated_bundle.json")

    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    ingestion_type = 'simulated_bundle'
    json_data = {
        'ingestion_type': ingestion_type,
        'institution': institution_name,
        'project': project_name,
        "processing_status": {
            "state": "submitted"
        }
    }
    print("json_data=", json_data)

    res = developer_testapp.post_json('/IngestionSubmission', json_data, headers=headers, status=201)
    [submitted_item] = res.json['@graph']
    submission_id = submitted_item['uuid']

    res = developer_testapp.post("/ingestion-submissions/%s/submit_for_ingestion" % submission_id,
                       {
                           "ingestion_type": ingestion_type,
                           # "institution": institution_name,
                           # "project": project_name,
                           "validate_only": False
                       },
                       content_type='multipart/form-data',
                       status=200,
                       upload_files=[("datafile", sample_bundle_filename)],
    )

    submission_uri = '/ingestion-submissions/' + submission_id

    assert res.json['success'] is True
    assert res.json['message'] == "Uploaded successfully."
    assert res.json['filename'] == sample_bundle_filename
    assert re.match("elasticbeanstalk-.*-metadata-bundles", res.json['bucket'])
    assert res.json['object_name'] == submission_id + "/datafile.json"
    assert res.json['submission_id'] == submission_id
    assert res.json['authenticated_userid'] == "remoteuser." + email
    assert res.json['email'] == email
    assert res.json['submission_uri'] == submission_uri
    # These next two are artifacts of our test env's incomplete nature:
    assert res.json['beanstalk_env_is_prd'] is False
    assert res.json['beanstalk_env'] is None
    assert re.match("[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]"
                    "T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]"
                    "[.][0-9][0-9][0-9][0-9][0-9][0-9]", res.json['upload_time'])
    assert res.json['parameters'] == {
        "ingestion_type": "simulated_bundle",
        "validate_only": "False",
        "datafile": sample_bundle_filename,
        "institution": '/institutions/%s/' % institution_name,
        "project": '/projects/%s/' % project_name,
    }
    # Processing has not yet begun
    assert not res.json.get('additional_data')
    assert not res.json.get('processing_status')


    submission = developer_testapp.get(submission_uri).maybe_follow().json
    assert submission.get('processing_status') == {
        'outcome': 'unknown',
        'progress': 'unavailable',
        'state': 'submitted'
    }
