import pytest
import webtest

from datetime import date
from urllib.parse import urlencode
from ..types.institution import Institution


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


"""Set up  of basic statuses for testing access to Items
    statuses in this list have a mapping to an ACL
    with the exception of 'upload failed' that acts as a standin for all non-ACL
    mapped statuses and defaults to the admin only ACL

    NOTE: 'public' applies to only certain Items - specified in status enum
    and give public access so is tested separately
"""
# viewable by authenticated
SHARED = "shared"
OBSOLETE = "obsolete"
# viewable by project member
CURRENT = "current"
INACTIVE = "inactive"
IN_REVIEW = "in review"
# kind of special admin-only
DELETED = "deleted"
# special file status case due to redirect
REPLACED = "replaced"
# no staus_acl mapping so default to admin only
UPLOAD_FAILED = "upload failed"
STATUSES = [SHARED, OBSOLETE, CURRENT, INACTIVE, IN_REVIEW, DELETED, REPLACED, UPLOAD_FAILED]

# institution, project and user fixtures
@pytest.fixture
def bwh_institution(testapp):
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
def udn_project(testapp):
    item = {
        'name': 'udn-project',
        'title': 'UDN Project',
        'description': 'Undiagnosed Disease Network'
    }
    return testapp.post_json('/project', item).json['@graph'][0]


BGM_PROJECT = 'bgm-project'
CORE_PROJECT = 'core-project'
UDN_PROJECT = 'udn-project'
TEST_PROJECT_NAMES = [BGM_PROJECT, CORE_PROJECT, UDN_PROJECT]


@pytest.fixture
def projects_by_name(core_project, bgm_project, udn_project):
    proj_by_name = {
        core_project.get('name'): core_project,
        bgm_project.get('name'): bgm_project,
        udn_project.get('name'): udn_project
    }
    # test to make sure all names in fixtures are as expected
    assert all([name in TEST_PROJECT_NAMES for name in proj_by_name])
    return proj_by_name


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
def udn_user(testapp, bwh_institution, udn_project):
    item = {
        'first_name': 'UDN',
        'last_name': 'user',
        'email': 'udnuser@example.org',
        'institution': bwh_institution['name'],
        'project_roles': [{'project': udn_project['@id']}],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def multi_project_user(testapp, bwh_institution, bgm_project, udn_project):
    item = {
        'first_name': 'Multi Project',
        'last_name': 'user',
        'email': 'multiuser@example.org',
        'institution': bwh_institution['name'],
        'project_roles': [{'project': bgm_project['@id']}, {'project': udn_project['@id']}],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def no_project_user(testapp, bwh_institution, bgm_project, udn_project):
    item = {
        'first_name': 'No Project',
        'last_name': 'user',
        'email': 'noproject@example.org',
        'institution': bwh_institution['name'],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def deleted_user(testapp, bwh_institution, bgm_project):
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


@pytest.fixture
def all_testapps(admin_testapp, bgm_user_testapp, udn_user_testapp,
                 multi_project_user_testapp, no_project_user_testapp, anontestapp):
    return [admin_testapp, bgm_user_testapp, udn_user_testapp,
            multi_project_user_testapp, no_project_user_testapp, anontestapp]


# Item fixtures
@pytest.fixture
def simple_bgm_file_item(bwh_institution, bgm_project, file_formats):
    # using file as it has all the statuses
    return {
        'uuid': '3413218c-3d86-498b-a0a2-9a406638e777',
        'file_format': file_formats.get('fastq').get('@id'),
        'institution': bwh_institution['@id'],
        'project': bgm_project['@id'],
        'read_length': 50,
        'status': 'uploaded',  # avoid s3 upload codepath
    }


@pytest.fixture
def simple_doc_item(bwh_institution, bgm_project):
    # using file as it has all the statuses
    return {
        'institution': bwh_institution['@id'],
        'project': bgm_project['@id'],
        'description': 'test document'
    }


def status_map_items(status2resp):
    statuses = set(STATUSES)
    to_test = set(status2resp.keys())
    assert statuses == to_test, ("Mismatch between statuses expected {} and those in the test {}".format(statuses, to_test))
    return status2resp.items()


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


@pytest.mark.parametrize('status, expres', status_map_items(
    {
        SHARED: 200, OBSOLETE: 200, CURRENT: 200, INACTIVE: 200, IN_REVIEW: 200,
        DELETED: 403, REPLACED: 404, UPLOAD_FAILED: 403
    }
))
def test_bgm_user_can_access_ok_stati_but_not_others_for_bgm_project_item(
        testapp, bgm_user_testapp, simple_bgm_file, status, expres):
    testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200)
    res = bgm_user_testapp.get(simple_bgm_file['@id'], status=expres).json
    if expres == 200:
        assert res['status'] == status
    else:
        assert res['status'] == 'error'  # because get fails


# Testing project-based posting - non-admin users can only post items that are attributed to the projects that
# they are part of


def test_bgm_user_can_post_bgm_item(bgm_user_testapp, simple_doc_item):
    assert bgm_user_testapp.post_json('/document', simple_doc_item, status=201)


def test_bgm_user_can_post_bgm_file(bgm_user_testapp, simple_bgm_file_item):
    del simple_bgm_file_item['uuid']  # users wouldn't generally post uuids
    del simple_bgm_file_item['status']  # this property also has restricted-fields and is not required
    assert bgm_user_testapp.post_json('/file_fastq', simple_bgm_file_item, status=201)


def test_udn_user_cannot_post_bgm_item(udn_user_testapp, simple_doc_item):
    assert udn_user_testapp.post_json('/document', simple_doc_item, status=403)


def test_udn_user_can_post_udn_item(udn_user_testapp, udn_project, simple_doc_item):
    simple_doc_item['project'] = udn_project['@id']
    assert udn_user_testapp.post_json('/document', simple_doc_item, status=201)


@pytest.mark.parametrize('status, expres', status_map_items(
    {
        SHARED: 403, OBSOLETE: 403, CURRENT: 200, INACTIVE: 403, IN_REVIEW: 200,
        DELETED: 403, REPLACED: 404, UPLOAD_FAILED: 403
    }
))
def test_bgm_user_can_only_patch_current_or_in_review_item(testapp, bgm_user_testapp, simple_bgm_file, status, expres):
    # want bgm user to only be able to patch items linked to their project with current status
    testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200)
    assert bgm_user_testapp.patch_json(simple_bgm_file['@id'], {'read_length': 100}, status=expres)


@pytest.mark.parametrize('status, expres', status_map_items(
    {
        SHARED: 200, OBSOLETE: 200, CURRENT: 403, INACTIVE: 403, IN_REVIEW: 403,
        DELETED: 403, REPLACED: 404, UPLOAD_FAILED: 403
    }
))
def test_udn_user_cannot_access_bgm_item_unless_shared(testapp, udn_user_testapp, simple_bgm_file, status, expres):
    testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200)
    assert udn_user_testapp.get(simple_bgm_file['@id'], status=expres)


@pytest.mark.parametrize('status', STATUSES)
def test_udn_user_cannot_patch_bgm_item(testapp, udn_user_testapp, simple_bgm_file, status):
    # shouldn't be able to patch at all but this may change
    expres = 403
    fitem = testapp.patch_json(simple_bgm_file['@id'], {'status': status}, status=200).json['@graph'][0]
    assert fitem.get('status') == status
    assert udn_user_testapp.patch_json(fitem['@id'], {'read_length': 100}, status=expres)


@pytest.mark.parametrize('project_name, status, expres', [
    (CORE_PROJECT, SHARED, 200),
    (CORE_PROJECT, OBSOLETE, 200),
    (CORE_PROJECT, CURRENT, 403),
    (CORE_PROJECT, INACTIVE, 403),
    (CORE_PROJECT, IN_REVIEW, 403),
    (CORE_PROJECT, DELETED, 403),
    (CORE_PROJECT, REPLACED, 403),
    (CORE_PROJECT, UPLOAD_FAILED, 403),
    (BGM_PROJECT, SHARED, 200),
    (BGM_PROJECT, OBSOLETE, 200),
    (BGM_PROJECT, CURRENT, 200),
    (BGM_PROJECT, INACTIVE, 200),
    (BGM_PROJECT, IN_REVIEW, 200),
    (BGM_PROJECT, DELETED, 403),
    (BGM_PROJECT, REPLACED, 403),
    (BGM_PROJECT, UPLOAD_FAILED, 403),
    (UDN_PROJECT, SHARED, 200),
    (UDN_PROJECT, OBSOLETE, 200),
    (UDN_PROJECT, CURRENT, 200),
    (UDN_PROJECT, INACTIVE, 200),
    (UDN_PROJECT, IN_REVIEW, 200),
    (UDN_PROJECT, DELETED, 403),
    (UDN_PROJECT, REPLACED, 403),
    (UDN_PROJECT, UPLOAD_FAILED, 403)
])
def test_multi_proj_user_can_access_items_w_ok_status_from_multi_projects(
        testapp, multi_project_user_testapp, simple_bgm_file_item,
        projects_by_name, project_name, status, expres):
    del simple_bgm_file_item['uuid']
    simple_bgm_file_item['project'] = projects_by_name.get(project_name).get('@id')
    simple_bgm_file_item['status'] = status
    fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
    assert multi_project_user_testapp.get(fitem['@id'], status=expres)


@pytest.mark.parametrize('project_name', [CORE_PROJECT, BGM_PROJECT, UDN_PROJECT])
def test_project_users_can_access_shared_items_from_any_project(
        testapp, bgm_user_testapp, simple_bgm_file, projects_by_name, project_name):
    testapp.patch_json(
        simple_bgm_file['@id'], {'status': SHARED, 'project': projects_by_name.get(project_name).get('@id')}, status=200)
    assert bgm_user_testapp.get(simple_bgm_file['@id'], status=200)


@pytest.mark.parametrize('project_name, status, expres', [
    (CORE_PROJECT, SHARED, 200),
    (CORE_PROJECT, OBSOLETE, 200),
    (CORE_PROJECT, CURRENT, 403),
    (CORE_PROJECT, INACTIVE, 403),
    (CORE_PROJECT, IN_REVIEW, 403),
    (CORE_PROJECT, DELETED, 403),
    (CORE_PROJECT, REPLACED, 403),
    (CORE_PROJECT, UPLOAD_FAILED, 403),
    (BGM_PROJECT, SHARED, 200),
    (BGM_PROJECT, OBSOLETE, 200),
    (BGM_PROJECT, CURRENT, 403),
    (BGM_PROJECT, INACTIVE, 403),
    (BGM_PROJECT, IN_REVIEW, 403),
    (BGM_PROJECT, DELETED, 403),
    (BGM_PROJECT, REPLACED, 403),
    (BGM_PROJECT, UPLOAD_FAILED, 403),
    (UDN_PROJECT, SHARED, 200),
    (UDN_PROJECT, OBSOLETE, 200),
    (UDN_PROJECT, CURRENT, 403),
    (UDN_PROJECT, INACTIVE, 403),
    (UDN_PROJECT, IN_REVIEW, 403),
    (UDN_PROJECT, DELETED, 403),
    (UDN_PROJECT, REPLACED, 403),
    (UDN_PROJECT, UPLOAD_FAILED, 403)
])
def test_authenticated_user_wo_project_can_only_see_shared(
        testapp, no_project_user_testapp, simple_bgm_file_item, projects_by_name,
        project_name, status, expres):
    del simple_bgm_file_item['uuid']
    simple_bgm_file_item['project'] = projects_by_name.get(project_name).get('@id')
    simple_bgm_file_item['status'] = status
    fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
    assert no_project_user_testapp.get(fitem['@id'], status=expres)


def project_status_params():
    # returns a list of tuples with all pairing combinations of test project names and status
    # used to parameterize permission tests that all have the same expected response
    return list(zip(TEST_PROJECT_NAMES * len(STATUSES), STATUSES * len(TEST_PROJECT_NAMES)))


@pytest.mark.parametrize('project_name, status', project_status_params())
def test_deleted_user_has_no_access(
        testapp, deleted_user_testapp, simple_bgm_file_item, projects_by_name,
        project_name, status):
    expres = 403
    del simple_bgm_file_item['uuid']
    simple_bgm_file_item['status'] = status
    fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
    assert deleted_user_testapp.get(fitem['@id'], status=expres)


@pytest.mark.parametrize('project_name, status', project_status_params())
def test_anonymous_user_has_no_access(
        testapp, anontestapp, simple_bgm_file_item, projects_by_name,
        project_name, status):
    expres = 403
    del simple_bgm_file_item['uuid']
    simple_bgm_file_item['status'] = status
    fitem = testapp.post_json('/file_fastq', simple_bgm_file_item, status=201).json['@graph'][0]
    assert anontestapp.get(fitem['@id'], status=expres)


@pytest.fixture
def public_static_section(testapp):
    ss = {'status': 'public', 'name': 'test section', 'section_type': 'Page Section', 'body': 'test section'}
    return testapp.post_json('/static_section', ss, status=201).json['@graph'][0]


def test_public_item_can_be_seen_by_anyone(all_testapps, public_static_section):
    for app in all_testapps:
        assert app.get(public_static_section['@id'], status=200)


def test_public_item_wo_project_can_be_patched_by_admin(admin_testapp, public_static_section):
    name2patch = 'patch name'
    res = admin_testapp.patch_json(public_static_section['@id'], {'name': name2patch}, status=200).json['@graph'][0]
    assert res.get('name') == name2patch


def test_public_item_wo_project_cannot_be_patched_by_project_member(bgm_user_testapp, public_static_section):
    name2patch = 'patch name'
    assert bgm_user_testapp.patch_json(public_static_section['@id'], {'name': name2patch}, status=403)


def test_public_item_w_project_cannot_be_patched_by_project_member(testapp, bgm_user_testapp, bgm_project, public_static_section):
    testapp.patch_json(public_static_section['@id'], {'project': bgm_project['@id']}, status=200)
    name2patch = 'patch name'
    assert bgm_user_testapp.patch_json(public_static_section['@id'], {'name': name2patch}, status=403)


def test_public_item_wo_project_can_be_posted_by_project_member(bgm_user_testapp, public_static_section):
    fields2post = ['body', 'section_type']
    res = bgm_user_testapp.get(public_static_section['@id'], status=200).json
    to_post = {k: v for k, v in res.items() if k in fields2post}
    # need to have a uniquename
    to_post['name'] = 'another section name'
    bgm_user_testapp.post_json('/static_section', to_post, status=201)
