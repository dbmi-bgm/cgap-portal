import pytest
from encoded.submit import *
import json
# from pyramid.paster import get_app
# from dcicutils.misc_utils import VirtualApp


@pytest.fixture
def row_dict():
    return {
        'patient id': '456',
        'family id': '333',
        'sex': 'M',
        'relation to proband': 'proband',
        'report required': 'Y',
        'specimen id': '3464467',
        'specimen type': 'blood',
        'workup type': 'WGS'
    }


@pytest.fixture
def empty_items():
    return {'individual': {}, 'family': {}, 'sample': {}, 'sample_processing': {}}


@pytest.fixture
def submission_info():
    return {
        'family': {'test-proj:fam1': {
            'members': ['test-proj:indiv1'],
            'proband': 'test-proj:indiv1'
        }},
        'individual': {'test-proj:indiv1': {'samples': ['test-proj:samp1']}},
        'sample': {'test-proj:samp1': {'workup_type': 'WGS'}},
        'sample_processing': {}
    }


@pytest.fixture
def submission_info2(submission_info):
    submission_info['family']['test-proj:fam1']['members'].append('test-proj:indiv2')
    submission_info['individual']['test-proj:indiv2'] = {'samples': ['test-proj:samp2']}
    submission_info['sample']['test-proj:samp2'] = {'workup_type': 'WGS'}
    return submission_info


@pytest.fixture
def submission_info3(submission_info2):
    info = submission_info2.copy()
    info['family']['test-proj:fam1']['members'].append('test-proj:indiv3')
    info['family']['test-proj:fam1']['mother'] = 'test-proj:indiv2'
    # submission_info['family']['test-proj:fam1']['father'] = 'test-proj:indiv3'
    info['individual']['test-proj:indiv3'] = {'samples': ['test-proj:samp3']}
    info['sample']['test-proj:samp3'] = {'workup_type': 'WGS'}
    return info


def test_fetch_individual_metadata_new(row_dict, empty_items):
    items_out = fetch_individual_metadata(row_dict, empty_items, 'test-proj:indiv1')
    assert items_out['individual']['test-proj:indiv1']['aliases'] == ['test-proj:indiv1']
    assert items_out['individual']['test-proj:indiv1']['individual_id'] == '456'


def test_fetch_individual_metadata_old(row_dict):
    items = empty_items.copy()
    items['individual'] = {'test-proj:indiv1': {
        'individual_id': '456',
        'age': 46,
        'aliases': ['test-proj:indiv1']
    }}
    items_out = fetch_individual_metadata(row_dict, items, 'test-proj:indiv1')
    assert len(items['individual']) == len(items_out['individual'])
    assert 'sex' in items_out['individual']['test-proj:indiv1']
    assert 'age' in items_out['individual']['test-proj:indiv1']


def test_fetch_family_metadata_new(row_dict, empty_items):
    items_out = fetch_family_metadata(row_dict, empty_items, 'test-proj:indiv1', 'test-proj:fam1')
    assert items_out['family']['test-proj:fam1']['members'] == ['test-proj:indiv1']
    assert items_out['family']['test-proj:fam1']['proband'] == 'test-proj:indiv1'


def test_fetch_family_metadata_old(row_dict):
    items = empty_items.copy()
    items['family'] = {'test-proj:fam1': {
        'aliases': ['test-proj:fam1'],
        'family_id': '333',
        'members': ['test-proj:indiv2'],
        'mother': 'test-proj:indiv2'
    }}
    items_out = fetch_family_metadata(row_dict, items, 'test-proj:indiv1', 'test-proj:fam1')
    assert items_out['family']['test-proj:fam1']['members'] == ['test-proj:indiv2', 'test-proj:indiv1']
    assert items_out['family']['test-proj:fam1']['proband'] == 'test-proj:indiv1'
    assert items_out['family']['test-proj:fam1']['mother'] == 'test-proj:indiv2'


def test_fetch_sample_metadata_sp(row_dict):
    items = empty_items.copy()
    items['individual'] = {'test-proj:indiv1': {}}
    items_out = fetch_sample_metadata(row_dict, items, 'test-proj:indiv1', 'test-proj:samp1', 'test-proj:sp1')
    assert items_out['sample']['test-proj:samp1']['specimen_accession'] == row_dict['specimen id']
    assert items_out['sample_processing']['test-proj:sp1']['samples'] == ['test-proj:samp1']
    assert items_out['individual']['test-proj:indiv1']['samples'] == ['test-proj:samp1']


def test_fetch_sample_metadata_no_sp(row_dict):
    items = empty_items.copy()
    items['individual'] = {'test-proj:indiv1': {}}
    row_dict['report required'] = 'N'
    items_out = fetch_sample_metadata(row_dict, items, 'test-proj:indiv1', 'test-proj:samp1', 'test-proj:sp1')
    assert items_out['sample']['test-proj:samp1']['specimen_accession'] == row_dict['specimen id']
    assert not items_out['sample_processing']


def test_create_sample_processing_groups_grp(submission_info2):
    items_out = create_sample_processing_groups(submission_info2, 'test-proj:sp-multi')
    assert items_out['sample_processing']['test-proj:sp-multi']['analysis_type'] == 'WGS-Group'
    assert len(items_out['sample_processing']['test-proj:sp-multi']['samples']) == 2


def test_create_sample_processing_groups_one(submission_info):
    items_out = create_sample_processing_groups(submission_info, 'test-proj:sp-single')
    assert not items_out['sample_processing']


def test_create_sample_processing_groups_trio(submission_info3):
    items_out = create_sample_processing_groups(submission_info3, 'test-proj:sp-multi')
    assert items_out['sample_processing']['test-proj:sp-multi']['analysis_type'] == 'WGS-Group'
    submission_info3['family']['test-proj:fam1']['father'] = 'test-proj:indiv3'
    items_out = create_sample_processing_groups(submission_info3, 'test-proj:sp-multi')
    assert items_out['sample_processing']['test-proj:sp-multi']['analysis_type'] == 'WGS-Trio'


def test_xls_to_json(project, institution):
    json_out = xls_to_json('src/encoded/tests/data/documents/cgap_submit_test.xlsx', project, institution)
    assert len(json_out['family']) == 1
    assert len(json_out['individual']) == 3
    assert all(['encode-project:individual-' + x in json_out['individual'] for x in ['123', '456', '789']])


def test_validate_item_post_valid(testapp, a_case):
    result = validate_item(testapp, a_case, 'post', 'case')
    assert not result


def test_validate_item_post_invalid(testapp, a_case):
    a_case['project'] = '/projects/invalid-project/'
    result = validate_item(testapp, a_case, 'post', 'case')
    assert 'not found' in result[0]


def test_validate_item_patch_valid(testapp, mother, grandpa):
    patch_dict = {'mother': mother['aliases'][0]}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', atid=grandpa['@id'])
    assert not result


def test_validate_item_patch_invalid(testapp, grandpa):
    patch_dict = {'mother': 'non-existant-alias'}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', atid=grandpa['@id'])
    assert 'not found' in result[0]
