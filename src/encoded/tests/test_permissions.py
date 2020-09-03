import pytest
import webtest

from datetime import date
from urllib.parse import urlencode
from ..types.institution import Institution


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


# rewrite for CGAP - initially project based permissions with minimal roles - admin and project_member
@pytest.fixture
def STATI():
    return [
        # viewable by authenticated
        "shared",
        "obsolete",
        # viewable by project member
        "current",
        "inactive",
        "in review",
        # admin only
        "uploading",
        "uploaded",
        "upload failed",
        "to be uploaded by workflow",
        "deleted",
        # special case because redirect
        "replaced"
    ]


"""List of basic statuses for testing access to Items
    statuses in this list have a mapping to an ACL
    with the exception of 'uploaded' that acts as a standin for all non-ACL
    mapped statuses and defaults to the admin only ACL

    NOTE: 'public' applies to only certain Items - specified in status enum
    and give public access so is tested separately
"""
STATUSES = [
    # viewable by authenticated
    "shared",
    "obsolete",
    # viewable by project member
    "current",
    "inactive",
    "in review",
    # kind of special admin-only
    "deleted",
    # special file status case due to redirect
    "replaced"
]

# institution, project and user fixtures
@pytest.fixture
def institution(testapp):
    item = {
        'name': 'bwh',
        'title': 'Brigham and Womens Hospital',
        'status': 'current'
    }
    return testapp.post_json('/institution', item).json['@graph'][0]


@pytest.fixture
def core_project(testapp):
    item = {
        'name': 'core-project',
        'title': 'CGAP',
        'description': 'Project associated with most core shared items'
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def bgm_project(testapp):
    item = {
        'name': 'bgm-project',
        'title': 'BGM Project',
        'description': 'Brigham Genomic Medicine'
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def udn_project(testapp):
    item = {
        'name': 'udn-project',
        'title': 'UDN Project',
        'description': 'Undiagnosed Disease Network'
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def all_projects(core_project, bgm_project, udn_project):
    return [core_project, bgm_project, udn_project]


@pytest.fixture
def admin_user(testapp):
    item = {
        'first_name': 'CGAP',
        'last_name': 'Admin',
        'email': 'cgapadmin@example.org',
        'groups': ['admin'],
    }

    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def bgm_user(testapp, institution, bgm_project):
    item = {
        'first_name': 'BGM',
        'last_name': 'user',
        'email': 'bgmuser@example.org',
        'institution': institution['name'],
        'project_roles': [
            {
                'project': bgm_project['@id'],
                'role': 'project_member'  # XXX: you probably want this
            }
        ],
        'project': bgm_project['@id'],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def udn_user(testapp, institution, udn_project):
    item = {
        'first_name': 'UDN',
        'last_name': 'user',
        'email': 'udnuser@example.org',
        'institution': institution['name'],
        'project_roles': [{'project': udn_project['@id']}],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def multi_project_user(testapp, institution, bgm_project, udn_project):
    item = {
        'first_name': 'Multi Project',
        'last_name': 'user',
        'email': 'multiuser@example.org',
        'institution': institution['name'],
        'project_roles': [{'project': bgm_project['@id']}, {'project': udn_project['@id']}],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def no_project_user(testapp, institution, bgm_project, udn_project):
    item = {
        'first_name': 'No Project',
        'last_name': 'user',
        'email': 'noproject@example.org',
        'institution': institution['name'],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def deleted_user(testapp, institution, bgm_project):
    item = {
        'first_name': 'Deleted',
        'last_name': 'BGM User',
        'email': 'deleted_user@example.org',
        'status': 'deleted',
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


# testapp fixtures acting as different users
def remote_user_testapp(app, remote_user):
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': str(remote_user),
    }
    return webtest.TestApp(app, environ)


@pytest.fixture
def admin_testapp(admin_user, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, admin_user['uuid'])


@pytest.fixture
def bgm_user_testapp(bgm_user, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, bgm_user['uuid'])


@pytest.fixture
def udn_user_testapp(udn_user, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, udn_user['uuid'])


@pytest.fixture
def multi_project_user_testapp(multi_project_user, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, multi_project_user['uuid'])


@pytest.fixture
def no_project_user_testapp(no_project_user, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, no_project_user['uuid'])


@pytest.fixture
def deleted_user_testapp(deleted_user, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, deleted_user['uuid'])


@pytest.fixture
def indexer_testapp(app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, 'INDEXER')


# Item fixtures
@pytest.fixture
def simple_bgm_file_item(institution, bgm_project, file_formats):
    # using file as it has all the statuses
    return {
        'uuid': '3413218c-3d86-498b-a0a2-9a406638e777',
        'file_format': file_formats.get('fastq').get('@id'),
        'institution': institution['@id'],
        'project': bgm_project['@id'],
        'read_length': 50,
        'status': 'uploaded',  # avoid s3 upload codepath
    }


@pytest.fixture
def simple_doc_item(institution, bgm_project):
    # using file as it has all the statuses
    return {
        'institution': institution['@id'],
        'project': bgm_project['@id'],
        'description': 'test document'
    }


@pytest.fixture
def simple_bgm_file(testapp, simple_bgm_file_item):
    return testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]


# permission tests
@pytest.mark.parametrize('status', STATUSES)
def test_admin_can_view_item_all_stati(testapp, admin_testapp, simple_bgm_file, status):
    file_res = testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200).json['@graph'][0]
    assert admin_testapp.get(file_res['@id'], status=200)


@pytest.mark.parametrize('status', STATUSES)
def test_admin_can_post_item_all_stati(testapp, admin_testapp, simple_bgm_file_item, status):
    del simple_bgm_file_item['uuid']
    simple_bgm_file_item['status'] = status
    assert admin_testapp.post_json('/file_fastq', simple_bgm_file_item, status=201)


@pytest.mark.parametrize('status', STATUSES)
def test_admin_can_patch_item_all_stati(admin_testapp, simple_bgm_file, status):
    assert simple_bgm_file['status'] == 'uploaded'
    res = admin_testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200).json['@graph'][0]
    assert res['status'] == status


@pytest.mark.parametrize('status, expres', list(zip(STATUSES, [200, 200, 200, 200, 200, 403, 404])))
def test_bgm_user_can_access_ok_stati_but_not_others_for_bgm_project_item(
        testapp, bgm_user_testapp, simple_bgm_file, status, expres):
    testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200)
    res = bgm_user_testapp.get(simple_bgm_file['@id'], status=expres).json
    if expres == 200:
        assert res['status'] == status
    else:
        assert res['status'] == 'error'  # because get fails


def test_bgm_user_can_post_item(bgm_user_testapp, simple_doc_item):
    assert bgm_user_testapp.post_json('/document', simple_doc_item, status=201)


@pytest.mark.parametrize('status, expres', list(zip(STATUSES, [403, 403, 200, 403, 200, 403, 404])))
def test_bgm_user_can_only_patch_current_or_in_review_item(testapp, bgm_user_testapp, simple_bgm_file, status, expres):
    # want bgm user to only be able to patch items linked to their project with current status
    testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200)
    assert bgm_user_testapp.patch_json(simple_bgm_file['@id'], {'read_length': 100}, status=expres)


def test_udn_user_cannot_access_bgm_item_unless_shared(testapp, udn_user_testapp, simple_bgm_file, STATI):
    for status in STATI:
        testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200)
        if status in ['shared', 'obsolete']:
            assert udn_user_testapp.get(simple_bgm_file['@id'], status=200)
        elif status == 'replaced':
            assert udn_user_testapp.get(simple_bgm_file['@id'], status=404)
        else:
            assert udn_user_testapp.get(simple_bgm_file['@id'], status=403)


def test_udn_user_cannot_post_bgm_item(udn_user_testapp, simple_bgm_file_item):
    # see above - not really testing what we want to here
    del simple_bgm_file_item['uuid']  # users wouldn't generally post uuids
    del simple_bgm_file_item['status']  # this property also has import-items but is not required
    assert udn_user_testapp.post_json('/file_fastq', simple_bgm_file_item, status=403)


def test_udn_user_cannot_patch_bgm_item(testapp, udn_user_testapp, simple_bgm_file, STATI):
    # shouldn't be able to patch at all but this may chenge
    for status in STATI:
        testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200)
        if status == 'replaced':
            assert udn_user_testapp.patch_json(simple_bgm_file['@id'], {'read_length': 100}, status=404)
        else:
            assert udn_user_testapp.patch_json(simple_bgm_file['@id'], {'read_length': 100}, status=403)


def test_multi_proj_user_can_access_items_w_ok_status_from_multi_projects(
        testapp, multi_project_user_testapp, simple_bgm_file_item, all_projects, STATI):
    # NOTE: replaced status is giving 403 on get even if user in theory should be redirected
    # not sure this is as expexted?
    corename = 'core-project'
    del simple_bgm_file_item['uuid']
    for project in all_projects:
        pname = project.get('name')
        if pname == corename:
            ok_stati = STATI[:2]
        else:
            ok_stati = STATI[:5]
        simple_bgm_file_item['project'] = project['@id']
        for status in STATI:
            simple_bgm_file_item['status'] = status
            fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
            if status in ok_stati:
                assert multi_project_user_testapp.get(fitem['@id'], status=200)
            else:
                assert multi_project_user_testapp.get(fitem['@id'], status=403)


def test_project_users_can_access_shared_items_from_any_project(
        testapp, bgm_user_testapp, simple_bgm_file, all_projects):
    testapp.patch_json(simple_bgm_file['@id'], {'status': 'shared'}, status=200)
    for project in all_projects:
        testapp.patch_json(simple_bgm_file['@id'], {'project': project['@id']}, status=200)
        assert bgm_user_testapp.get(simple_bgm_file['@id'], status=200)


def test_authenticated_user_wo_project_can_only_see_shared(
        testapp, no_project_user_testapp, simple_bgm_file_item, STATI, all_projects):
    del simple_bgm_file_item['uuid']
    for project in all_projects:
        simple_bgm_file_item['project'] = project['@id']
        for status in STATI:
            simple_bgm_file_item['status'] = status
            fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
            if status in ['shared', 'obsolete']:
                assert no_project_user_testapp.get(fitem['@id'], status=200)
            else:
                assert no_project_user_testapp.get(fitem['@id'], status=403)


def test_deleted_user_has_no_access(
        testapp, deleted_user_testapp, simple_bgm_file_item, STATI, all_projects):
    del simple_bgm_file_item['uuid']
    for project in all_projects:
        simple_bgm_file_item['project'] = project['@id']
        for status in STATI:
            simple_bgm_file_item['status'] = status
            fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
            assert deleted_user_testapp.get(fitem['@id'], status=403)


def test_anonymous_user_has_no_access(
        testapp, anontestapp, simple_bgm_file_item, STATI, all_projects):
    del simple_bgm_file_item['uuid']
    for project in all_projects:
        simple_bgm_file_item['project'] = project['@id']
        for status in STATI:
            simple_bgm_file_item['status'] = status
            fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
            assert anontestapp.get(fitem['@id'], status=403)
