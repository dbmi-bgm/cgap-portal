import json
import pytest
import re
import webtest

from dcicutils.qa_utils import raises_regexp, override_environ
from .test_access_key import basic_auth


# These tests will work but may leave garbage around from stray submissions.
# If that causes a problem, we'll need to write some cleanup code. -kmp 21-Feb-2021
pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_old_protocol_content_type(testapp, bgm_access_key):
    """
    We used to have an endpoint that is gone now.
    Except by special exception, all our endpoints need to deal in application/json content.
    """
    with raises_regexp(webtest.AppError, "415.*[Uu]nsupported [Mm]edia [Tt]ype"):
        testapp.post("/submit_for_ingestion")


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
    response = anontestapp.post_json("/IngestionSubmission", creation_post_data, headers=creation_post_headers, status=201)
    [submission] = response.json['@graph']
    assert submission.get('@id')

    # Test that if we're missing credentials, we get rejected.

    creation_post_headers_with_missing_auth = {
        'Content-type': 'application/json',
        'Accept':  'application/json',
    }
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
                    print("%s[%r]: %s" % (label, prop, json.dumps(x.get(prop, "<MISSING>"), indent=2, default=str)))
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
