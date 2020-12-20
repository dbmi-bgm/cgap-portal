import json
import requests
import webtest

from dcicutils.qa_utils import raises_regexp, override_environ
from .test_access_key import basic_auth


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
    response = anontestapp.post_json("/IngestionSubmission", creation_post_data, headers=creation_post_headers, status=201)
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
