import pytest
import webtest

from datetime import date
from urllib.parse import urlencode
from ..types.institution import Institution


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


# XXX: There are a lot of testing holes here. New datafixtures will need to be
# developed to adequately test the permissions.

@pytest.fixture
def remc_institution(testapp):
    item = {
        'name': 'remc-institution',
        'title': 'REMC institution',
        'status': 'current'
    }
    return testapp.post_json('/institution', item).json['@graph'][0]


@pytest.fixture
def someinstitution_w_shared_project(testapp, project):
    item = {
        'name': 'some-institution',
        'title': 'SOME institution',
        'status': 'current',
        'projects': [project['@id']]
    }
    return testapp.post_json('/institution', item).json['@graph'][0]


@pytest.fixture
def remc_project(testapp):
    item = {
        'name': 'remc-project',
        'title': 'REMC Project',
        'description': 'REMC test project',
        'viewing_group': 'Not 4DN',
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def nofic_project(testapp):
    item = {
        'name': 'NOFIC-project',
        'description': 'NOFIC test project',
        'viewing_group': 'NOFIC',
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def wrangler(testapp):
    item = {
        'first_name': 'Wrangler',
        'last_name': 'Admin',
        'email': 'wrangler@example.org',
        'groups': ['admin'],
    }

    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def institution_viewer(testapp, institution, project):
    item = {
        'first_name': 'ENCODE',
        'last_name': 'institution viewer',
        'email': 'encode_viewer@example.org',
        'institution': institution['name'],
        'status': 'current',
        'viewing_groups': [project['viewing_group']]
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def project_viewer(testapp, someinstitution_w_shared_project):
    item = {
        'first_name': 'SOME',
        'last_name': 'project viewer',
        'email': 'projectee@example.org',
        'institution': someinstitution_w_shared_project['@id'],
        'status': 'current',
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


# this user has the 4DN viewing group
@pytest.fixture
def viewing_group_member(testapp, project):
    item = {
        'first_name': 'Viewing',
        'last_name': 'Group',
        'email': 'viewing_group_member@example.org',
        'viewing_groups': [project['viewing_group']],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


# this user has the NOFIC viewing group
@pytest.fixture
def nofic_group_member(testapp, nofic_project):
    item = {
        'first_name': 'NOFIC',
        'last_name': 'Group',
        'email': 'viewing_group_member@example.org',
        'viewing_groups': [nofic_project['viewing_group']],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def multi_viewing_group_member(testapp, project, nofic_project):
    item = {
        'first_name': 'Viewing',
        'last_name': 'Group',
        'email': 'viewing_group_member@example.org',
        'viewing_groups': [project['viewing_group'], nofic_project['viewing_group']],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def remc_submitter(testapp, remc_institution, remc_project):
    item = {
        'first_name': 'REMC',
        'last_name': 'Submitter',
        'email': 'remc_submitter@example.org',
        'submits_for': [remc_institution['@id']],
        'viewing_groups': [remc_project['viewing_group']],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


def remote_user_testapp(app, remote_user):
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': str(remote_user),
    }
    return webtest.TestApp(app, environ)


@pytest.fixture
def revoked_user(testapp, institution, project):
    item = {
        'first_name': 'ENCODE',
        'last_name': 'Submitter',
        'email': 'no_login_submitter@example.org',
        'submits_for': [institution['@id']],
        'status': 'revoked',
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def other_institution(testapp):
    item = {
        'title': 'Other institution',
        'name': 'other-institution',
    }
    return testapp.post_json('/institution', item, status=201).json['@graph'][0]


@pytest.fixture
def simple_file(testapp, institution, project, file_formats):
    item = {
        'uuid': '3413218c-3d86-498b-a0a2-9a406638e777',
        'file_format': file_formats.get('fastq').get('@id'),
        'paired_end': '1',
        'institution': institution['@id'],
        'project': project['@id'],
        'status': 'uploaded',  # avoid s3 upload codepath
    }
    return testapp.post_json('/file_fastq', item).json['@graph'][0]


@pytest.fixture
def step_run(testapp, institution, project):
    software = {
        'name': 'do-thing',
        'description': 'It does the thing',
        'title': 'THING_DOER',
        'version': '1.0',
        'software_type': "normalizer",
        'project': project['@id'],
        'institution': institution['@id']
    }
    sw = testapp.post_json('/software', software, status=201).json['@graph'][0]

    analysis_step = {
        'name': 'do-thing-step',
        'version': 1,
        'software_used': sw['@id']
    }
    return testapp.post_json('/analysis-steps', analysis_step, status=201).json['@graph'][0]


@pytest.fixture
def expt_w_cont_institution_item(institution, remc_institution, project, human_biosample, exp_types):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'biosample': human_biosample['@id'],
        'experiment_type': exp_types['microc']['@id'],
        'contributing_institutions': [remc_institution['@id']]
    }


@pytest.fixture
def wrangler_testapp(wrangler, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, wrangler['uuid'])


@pytest.fixture
def remc_member_testapp(remc_submitter, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, remc_submitter['uuid'])


@pytest.fixture
def submitter_testapp(submitter, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, submitter['uuid'])


@pytest.fixture
def institution_viewer_testapp(institution_viewer, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, institution_viewer['uuid'])


@pytest.fixture
def project_viewer_testapp(project_viewer, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, project_viewer['uuid'])


@pytest.fixture
def viewing_group_member_testapp(viewing_group_member, app, external_tx, zsa_savepoints):
    # app for 4DN viewing group member
    return remote_user_testapp(app, viewing_group_member['uuid'])


@pytest.fixture
def multi_viewing_group_member_testapp(multi_viewing_group_member, app, external_tx, zsa_savepoints):
    # app with both 4DN and NOFIC viewing group
    return remote_user_testapp(app, multi_viewing_group_member['uuid'])


@pytest.fixture
def nofic_group_member_testapp(nofic_group_member, app, external_tx, zsa_savepoints):
    # app for 4DN viewing group member
    return remote_user_testapp(app, nofic_group_member['uuid'])


@pytest.fixture
def indexer_testapp(app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, 'INDEXER')


def test_wrangler_post_non_institution_collection(wrangler_testapp):
    item = {
        'first_name': 'Hi, my',
        'last_name': 'name is',
        'email': 'what@mynameis.what'
    }
    return wrangler_testapp.post_json('/user', item, status=201)


def test_submitter_cant_post_non_institution_collection(submitter_testapp):
    item = {
        'first_name': 'Hi, my',
        'last_name': 'name is',
        'email': 'what@mynameis.what'
    }
    return submitter_testapp.post_json('/user', item, status=403)


def test_user_view_details_admin(submitter, access_key, testapp):
    res = testapp.get(submitter['@id'])
    assert 'email' in res.json


def test_users_view_details_self(submitter, access_key, submitter_testapp):
    res = submitter_testapp.get(submitter['@id'])
    assert 'email' in res.json


def test_users_patch_self(submitter, access_key, submitter_testapp):
    submitter_testapp.patch_json(submitter['@id'], {})


def test_users_post_disallowed(submitter, access_key, submitter_testapp):
    item = {
        'first_name': 'ENCODE',
        'last_name': 'Submitter2',
        'email': 'encode_submitter2@example.org',
    }
    submitter_testapp.post_json('/user', item, status=403)


def test_users_cannot_view_other_users_info_with_basic_authenticated(submitter, authenticated_testapp):
    authenticated_testapp.get(submitter['@id'], status=403)


def test_users_can_see_their_own_user_info(submitter, submitter_testapp):
    res = submitter_testapp.get(submitter['@id'])
    assert 'title' in res.json
    assert 'email' in res.json


def test_users_view_basic_anon(submitter, anontestapp):
    anontestapp.get(submitter['@id'], status=403)


def test_users_view_basic_indexer(submitter, indexer_testapp):
    res = indexer_testapp.get(submitter['@id'])
    assert 'title' in res.json
    assert 'email' not in res.json
    assert 'access_keys' not in res.json


def test_submitter_patch_institution_disallowed(submitter, other_institution, submitter_testapp):
    res = submitter_testapp.get(submitter['@id'])
    institution = {'institution': other_institution['@id']}
    submitter_testapp.patch_json(res.json['@id'], institution, status=422)  # is that the right status?


def test_wrangler_patch_institution_allowed(submitter, other_institution, wrangler_testapp):
    res = wrangler_testapp.get(submitter['@id'])
    institution = {'institution': other_institution['@id']}
    wrangler_testapp.patch_json(res.json['@id'], institution, status=200)


def test_submitter_patch_submits_for_disallowed(submitter, other_institution, submitter_testapp):
    res = submitter_testapp.get(submitter['@id'])
    submits_for = {'submits_for': [res.json['submits_for'][0]['@id']] + [other_institution['@id']]}
    submitter_testapp.patch_json(res.json['@id'], submits_for, status=422)


def test_wrangler_patch_submits_for_allowed(submitter, other_institution, wrangler_testapp):
    res = wrangler_testapp.get(submitter['@id'])
    submits_for = {'submits_for': [res.json['submits_for'][0]['@id']] + [other_institution['@id']]}
    wrangler_testapp.patch_json(res.json['@id'], submits_for, status=200)


def test_submitter_patch_groups_disallowed(submitter, submitter_testapp):
    res = submitter_testapp.get(submitter['@id'])
    groups = {'groups': res.json.get('groups', []) + ['admin']}
    submitter_testapp.patch_json(res.json['@id'], groups, status=422)


def test_wrangler_patch_groups_allowed(submitter, other_institution, wrangler_testapp):
    res = wrangler_testapp.get(submitter['@id'])
    groups = {'groups': res.json.get('groups', []) + ['admin']}
    wrangler_testapp.patch_json(res.json['@id'], groups, status=200)


@pytest.mark.xfail # XXX: Bug?
def test_submitter_patch_viewing_groups_disallowed(submitter, other_institution, submitter_testapp):
    res = submitter_testapp.get(submitter['@id'])
    vgroups = {'viewing_groups': res.json['viewing_groups'] + ['GGR']}
    submitter_testapp.patch_json(res.json['@id'], vgroups, status=422)


def test_wrangler_patch_viewing_groups_allowed(submitter, wrangler_testapp):
    res = wrangler_testapp.get(submitter['@id'])
    vgroups = {'viewing_groups': res.json['viewing_groups'] + ['Not 4DN']}
    wrangler_testapp.patch_json(res.json['@id'], vgroups, status=200)


def test_institutions_view_wrangler(wrangler_testapp, other_institution):
    institutions = wrangler_testapp.get('/institutions/', status=200)
    assert(len(institutions.json['@graph']) == 1)


##############################################
# Permission tests based on different statuses
# Submitter created item and wants to view
@pytest.fixture
def ind_human_item(human, project, institution):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'organism': human['@id']
    }


@pytest.fixture
def file_item(project, institution, file_formats):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('fastq').get('@id'),
        'paired_end': '1'
    }


@pytest.fixture
def institution_item(institution):
    return {
        'name': 'test-institution',
        'title': 'test institution',
    }


@pytest.mark.xfail # XXX: Bug? Appears to auto deny
def test_everyone_can_view_institution_item(institution_item, submitter_testapp, wrangler_testapp, remc_member_testapp):
    statuses = ['current', 'inactive']
    apps = [submitter_testapp, wrangler_testapp, remc_member_testapp]
    res = wrangler_testapp.post_json('/institution', institution_item, status=201)
    for status in statuses:
        wrangler_testapp.patch_json(res.json['@graph'][0]['@id'], {"status": status}, status=200)
        for app in apps:
            app.get(res.json['@graph'][0]['@id'], status=200)


def test_noone_can_view_deleted_institution_item(institution_item, submitter_testapp, wrangler_testapp, remc_member_testapp):
    institution_item['status'] = 'deleted'
    viewing_apps = [submitter_testapp, remc_member_testapp]
    res = wrangler_testapp.post_json('/institution', institution_item, status=201)
    for app in viewing_apps:
        app.get(res.json['@graph'][0]['@id'], status=403)


def test_institution_submitter_can_edit_institution(institution, submitter_testapp, wrangler_testapp):
    res = submitter_testapp.get(institution['@id'])
    wrangler_testapp.patch_json(res.json['@id'], {'status': 'current'}, status=200)
    submitter_testapp.patch_json(res.json['@id'], {'city': 'My fair city'}, status=200)


def test_statuses_that_institution_submitter_cannot_edit_institution(institution, submitter_testapp, wrangler_testapp):
    statuses = ['deleted', 'inactive']
    res = submitter_testapp.get(institution['@id'])
    for status in statuses:
        wrangler_testapp.patch_json(res.json['@id'], {'status': status}, status=200)
        submitter_testapp.patch_json(res.json['@id'], {'city': 'My fair city'}, status=403)


def test_institution_submitter_cannot_edit_institution_name_or_title(institution, submitter_testapp, wrangler_testapp):
    res = submitter_testapp.get(institution['@id'])
    wrangler_testapp.patch_json(res.json['@id'], {'status': 'current'}, status=200)
    submitter_testapp.patch_json(res.json['@id'], {'title': 'Test Lab, HMS'}, status=422)
    submitter_testapp.patch_json(res.json['@id'], {'name': 'test-institution'}, status=422)


def test_wrangler_can_edit_institution_name_or_title(institution, submitter_testapp, wrangler_testapp):
    statuses = ['deleted', 'inactive', 'current']
    new_name = 'test-institution'
    new_id = '/institutions/test-institution/'
    res = submitter_testapp.get(institution['@id'])
    original_id = res.json['@id']
    original_name = res.json['name']
    for status in statuses:
        wrangler_testapp.patch_json(original_id, {'status': status}, status=200)
        wrangler_testapp.patch_json(original_id, {'title': 'Test Lab, HMS'}, status=200)
        wrangler_testapp.patch_json(original_id, {'name': new_name}, status=200)
        wrangler_testapp.patch_json(new_id, {'name': original_name}, status=200)


def test_ac_local_roles_for_institution(registry):
    institution_data = {
        'status': 'in review',
        'project': 'b0b9c607-bbbb-4f02-93f4-9895baa1334b',
        'uuid': '828cd4fe-aaaa-4b36-a94a-d2e3a36aa989'
    }
    test_institution = Institution.create(registry, None, institution_data)
    institution_ac_locals = test_institution.__ac_local_roles__()
    assert('role.institution_submitter' in institution_ac_locals.values())
    assert('role.institution_member' in institution_ac_locals.values())


### These aren't strictly permissions tests but putting them here so we don't need to
###    move around wrangler and submitter testapps and associated fixtures


@pytest.fixture
def planned_experiment_set_data(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'description': 'test experiment set',
        'experimentset_type': 'custom',
    }


@pytest.fixture
def status2date():
    return {
        'released': 'public_release',
        'released to project': 'project_release'
    }




def test_update_of_item_without_release_dates_mixin(wrangler_testapp, project):
    assert project['status'] == 'current'
    datefields = ['public_release', 'project_release']
    for field in datefields:
        assert field not in project



@pytest.fixture
def replicate_experiment_set_data(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'description': 'test replicate experiment set',
        'experimentset_type': 'replicate',
    }


@pytest.fixture
def static_section_item():
    return {
        'name': 'static-section.test_ss',
        'title': 'Test Static Section',
        'body': 'This is a test section'
    }


def test_static_section_with_institution_view_by_institution_member(
        wrangler_testapp, institution_viewer_testapp, institution, static_section_item):
    static_section_item['institution'] = institution['@id']
    static_section_item['status'] = 'released to institution'
    res = wrangler_testapp.post_json('/static_section', static_section_item).json['@graph'][0]
    institution_viewer_testapp.get(res['@id'], status=200)
