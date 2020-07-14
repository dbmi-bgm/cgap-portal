import pytest
from encoded.submit import *
import json


@pytest.fixture
def row_dict():
    return {
        'individual id': '456',
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
    return {
        'individual': {}, 'family': {}, 'sample': {}, 'sample_processing': {},
        'case': {}, 'report': {}, 'reports': []
    }


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


@pytest.fixture
def sample_info():
    return {
        'workup type': 'WES',
        'specimen id': '9034',
        'date collected': '2020-01-06'
    }


@pytest.fixture
def example_rows():
    return [
        {'individual id': '456', 'analysis id': '1111', 'relation to proband': 'proband', 'workup type': 'WGS'},
        {'individual id': '123', 'analysis id': '1111', 'relation to proband': 'mother', 'workup type': 'WGS'},
        {'individual id': '789', 'analysis id': '1111', 'relation to proband': 'father', 'workup type': 'WGS'},
        {'individual id': '456', 'analysis id': '2222', 'relation to proband': 'proband', 'workup type': 'WGS'},
        {'individual id': '555', 'analysis id': '3333', 'relation to proband': 'proband', 'workup type': 'WES'},
        {'individual id': '546', 'analysis id': '3333', 'relation to proband': 'mother', 'workup type': 'WES'}
    ]


@pytest.fixture
def new_family(child, mother, father):
    return {
        "title": "Smith family",
        "proband": child['@id'],
        "members": [
            child['@id'],
            mother['@id'],
            father['@id']
        ]
    }


@pytest.fixture
def aunt(testapp, project, institution):
    item = {
        "accession": "GAPIDAUNT001",
        "age": 35,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "F"
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


def test_map_fields(sample_info):
    result = map_fields(sample_info, {}, ['workup_type'], 'sample')
    assert result['workup_type'] == 'WES'
    assert result['specimen_accession'] == '9034'
    assert result['specimen_collection_date'] == '2020-01-06'
    assert not result.get('sequencing_lab')


def test_create_families(example_rows):
    fams = create_families(example_rows)
    assert sorted(list(fams.keys())) == ['1111', '2222', '3333']
    assert fams['1111'] == 'family-456'
    assert fams['2222'] == 'family-456'
    assert fams['3333'] == 'family-555'


def test_get_analysis_types(example_rows):
    a_types = get_analysis_types(example_rows)
    assert a_types['1111'] == 'WGS-Trio'
    assert a_types['2222'] == 'WGS'
    assert a_types['3333'] == 'WES-Group'
    example_rows[1]['workup type'] = 'WES'
    new_a_types = get_analysis_types(example_rows)
    assert new_a_types['1111'] is None


def test_fetch_individual_metadata_new(row_dict, empty_items):
    items_out = fetch_individual_metadata(row_dict, empty_items, 'test-proj:indiv1', 'hms-dbmi')
    assert items_out['individual']['test-proj:indiv1']['aliases'] == ['test-proj:indiv1']
    assert items_out['individual']['test-proj:indiv1']['individual_id'] == '456'


def test_fetch_individual_metadata_old(row_dict, empty_items):
    items = empty_items.copy()
    items['individual'] = {'test-proj:indiv1': {
        'individual_id': '456',
        'age': 46,
        'aliases': ['test-proj:indiv1']
    }}
    items_out = fetch_individual_metadata(row_dict, items, 'test-proj:indiv1', 'hms-dbmi')
    assert len(items['individual']) == len(items_out['individual'])
    assert 'sex' in items_out['individual']['test-proj:indiv1']
    assert 'age' in items_out['individual']['test-proj:indiv1']


def test_fetch_family_metadata_new(row_dict, empty_items):
    items_out = fetch_family_metadata(row_dict, empty_items, 'test-proj:indiv1', 'test-proj:fam1')
    assert items_out['family']['test-proj:fam1']['members'] == ['test-proj:indiv1']
    assert items_out['family']['test-proj:fam1']['proband'] == 'test-proj:indiv1'


def test_fetch_family_metadata_old(row_dict, empty_items):
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


def test_fetch_sample_metadata_sp(row_dict, empty_items):
    items = empty_items.copy()
    items['individual'] = {'test-proj:indiv1': {}}
    items_out = fetch_sample_metadata(
        row_dict, items, 'test-proj:indiv1', 'test-proj:samp1', 'test-proj:sp1', 'test-proj:fam1', 'test-proj'
    )
    assert items_out['sample']['test-proj:samp1']['specimen_accession'] == row_dict['specimen id']
    assert items_out['sample_processing']['test-proj:sp1']['samples'] == ['test-proj:samp1']
    assert items_out['individual']['test-proj:indiv1']['samples'] == ['test-proj:samp1']


def test_xls_to_json(project, institution):
    json_out = xls_to_json('src/encoded/tests/data/documents/cgap_submit_test.xlsx', project, institution)
    assert len(json_out['family']) == 1
    assert 'encode-project:family-456' in json_out['family']
    assert len(json_out['individual']) == 3
    assert all(['encode-project:individual-' + x in json_out['individual'] for x in ['123', '456', '789']])


def test_parse_exception_invalid_alias(testapp, a_case):
    a_case['invalid_field'] = 'value'
    a_case['project'] = '/projects/invalid-project/'
    try:
        testapp.post_json('/case', a_case)
    except Exception as e:
        errors = parse_exception(e, ['/projects/other-project/'])
    assert len(errors) == 2
    assert 'Additional properties are not allowed' in ''.join(errors)
    assert 'not found' in ''.join(errors)


def test_parse_exception_with_alias(testapp, a_case):
    a_case['project'] = '/projects/invalid-project/'
    errors = None
    try:
        testapp.post_json('/case', a_case)
    except Exception as e:
        errors = parse_exception(e, ['/projects/invalid-project/'])
    assert errors == []


def test_compare_fields_same(testapp, fam, new_family):
    profile = testapp.get('/profiles/family.json').json
    result = compare_fields(profile, [], new_family, fam)
    assert not result


def test_compare_fields_different(testapp, aunt, fam, new_family):
    new_family['members'].append(aunt['@id'])
    new_family['title'] = 'Smythe family'
    profile = testapp.get('/profiles/family.json').json
    result = compare_fields(profile, [], new_family, fam)
    assert len(result) == 2
    assert 'title' in result
    assert len(result['members']) == len(fam['members']) + 1


def test_validate_item_post_valid(testapp, a_case):
    result = validate_item(testapp, a_case, 'post', 'case', [])
    assert not result


def test_validate_item_post_invalid(testapp, a_case):
    a_case['project'] = '/projects/invalid-project/'
    result = validate_item(testapp, a_case, 'post', 'case', [])
    assert 'not found' in result[0]


def test_validate_item_patch_valid(testapp, mother, grandpa):
    patch_dict = {'mother': mother['aliases'][0]}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', [], atid=grandpa['@id'])
    assert not result


def test_validate_item_patch_invalid(testapp, grandpa):
    patch_dict = {'mother': 'non-existant-alias'}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', [], atid=grandpa['@id'])
    assert 'not found' in result[0]


def test_validate_item_patch_alias(testapp, grandpa):
    patch_dict = {'mother': 'existing-alias'}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', ['existing-alias'], atid=grandpa['@id'])
    assert not result


def test_validate_all_items_errors(testapp, mother, empty_items):
    new_individual = {
        'aliases': ['test-proj:new-individual-alias'],
        'individual_id': '1234',
        'sex': 'F',
        'mother': mother['aliases'][0],
        'project': 'test-proj:invalid-project-alias',
        'institution': 'test-proj:invalid-institution-alias'
    }
    items = empty_items
    items['individual']['new-individual-alias'] = new_individual
    data_out, result = validate_all_items(testapp, items)
    assert not data_out
    assert len(result) > 1
    errors = ' '.join(result)
    assert "'test-proj:invalid-project-alias' not found" in errors
    assert "'test-proj:invalid-institution-alias' not found" in errors
    assert mother['aliases'][0] not in errors
