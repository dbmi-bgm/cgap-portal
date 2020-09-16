import pytest
import xlrd

from copy import deepcopy
from unittest import mock
from .. import submit
from ..submit import (
    compare_fields,
    digest_xls,
    MetadataItem,
    SubmissionRow,
    SubmissionMetadata,
    SpreadsheetProcessing,
    map_fields,
    parse_exception,
    row_generator,
    validate_all_items,
    validate_item,
    xls_to_json,
)


@pytest.fixture
def row_dict():
    return {
        'individual id': '456',
        'family id': '333',
        'sex': 'M',
        # 'age': '33',
        # 'birth year': '1986',
        'relation to proband': 'proband',
        'analysis id': '999',
        'report required': 'Y',
        'specimen id': '3464467',
        'specimen type': 'blood',
        'workup type': 'WGS'
    }


# @pytest.fixture
# def row_dict_nums(row_dict):
#     row_dict['age'] = 33
#     row_dict['birth year'] = 1986
#     return row_dict
#
#
# # @pytest.fixture
# # def row_dict_str(row_dict):
# #     row_dict['age'] = '33'
# #     row_dict['birth year'] = '1986'
# #     return row_dict
#
#
# @pytest.fixture
# def row_dict_text(row_dict):
#     row_dict['age'] = 'abc'
#     row_dict['birth year'] = 'def'
#     return row_dict


@pytest.fixture
def xls_list():
    book = xlrd.open_workbook('src/encoded/tests/data/documents/cgap_submit_test.xlsx')
    sheet, = book.sheets()
    row = row_generator(sheet)
    return list(row)


@pytest.fixture
def empty_items():
    return {
        'individual': {}, 'family': {}, 'file_fastq': {},
        'file_processed': {}, 'sample': {}, 'sample_processing': {},
        'case': {}, 'report': {}, 'reports': [], 'errors': []
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
        'sample_processing': {},
        'errors': []
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
        {'individual id': '456', 'analysis id': '1111', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WGS', 'specimen id': '1'},
        {'individual id': '123', 'analysis id': '1111', 'relation to proband': 'mother',
         'report required': 'N', 'workup type': 'WGS', 'specimen id': '2'},
        {'individual id': '789', 'analysis id': '1111', 'relation to proband': 'father',
         'report required': 'N', 'workup type': 'WGS', 'specimen id': '3'},
        {'individual id': '456', 'analysis id': '2222', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WGS', 'specimen id': '1'},
        {'individual id': '555', 'analysis id': '3333', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WES', 'specimen id': '5'},
        {'individual id': '546', 'analysis id': '3333', 'relation to proband': 'mother',
         'report required': 'N', 'workup type': 'WES', 'specimen id': '6'}
    ]


@pytest.fixture
def example_rows_obj(example_rows, project, institution):
    return SubmissionMetadata(example_rows, project, institution)


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


def test_init_families(example_rows_obj, project):
    # test family aliases are named after proband individual ids
    proj_name = project['name'] + ':'
    fams = example_rows_obj.family_dict
    assert sorted(list(fams.keys())) == ['1111', '2222', '3333']
    assert fams['1111'] == proj_name + 'family-456'
    assert fams['2222'] == proj_name + 'family-456'
    assert fams['3333'] == proj_name + 'family-555'


def test_get_analysis_types(example_rows_obj, example_rows, project, institution):
    a_types = example_rows_obj.analysis_types
    assert a_types['1111'] == 'WGS-Trio'
    assert a_types['2222'] == 'WGS'
    assert a_types['3333'] == 'WES-Group'
    example_rows[1]['workup type'] = 'WES'
    # analysis type should be none if workup types in samples don't match
    new_obj = SubmissionMetadata(example_rows, project, institution)
    new_a_types = new_obj.analysis_types
    assert new_a_types['1111'] is None


def test_extract_individual_metadata(row_dict, project, institution):
    obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
    assert obj.indiv_alias == 'encode-project:individual-456'
    assert obj.individual.metadata['aliases'] == [obj.indiv_alias]
    assert obj.individual.metadata['individual_id'] == row_dict['individual id']


def test_add_metadata_single_item(example_rows, project, institution):
    """
    if json for an item was already created in a previous row, any new fields for that
    item in the current row should be added to the existing json.
    if the current row has less information than the previous json item, the fields in
    the previous json item won't get overwritten.
    """
    for rowidx in (1, 2):
        data = [
            {k: v for k, v in example_rows[0].items()},
            # 2 rows have same sample
            {k: v for k, v in example_rows[1].items()},
            {k: v for k, v in example_rows[1].items()}
        ]
        data[rowidx]['specimen accepted by ref lab'] = 'Y'
        submission = SubmissionMetadata(data, project, institution)
        assert len(submission.individuals) == 2
        assert len(submission.samples) == 2
        assert 'specimen_accepted' in list(submission.samples.values())[1]


@pytest.mark.parametrize('age, birth_year, val_type', [
    ('33', '1986', int),
    # text values for age and birth year should be passed on without errors to eventually fail validation
    ('abc', 'def', str)
])
def test_extract_individual_metadata_nums(row_dict, age, birth_year, val_type, project, institution):
    row_dict['age'] = age
    row_dict['birth year'] = birth_year
    obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
    assert isinstance(obj.individual.metadata['age'], val_type)
    assert not obj.errors


@pytest.mark.parametrize('relation, error', [
    ('proband', False),
    ('grandmother', True)
])
def test_extract_family_metadata_new(row_dict, project, institution, relation, error):
    row_dict['relation to proband'] = relation
    obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
    assert obj.family.alias == 'test-proj:fam1'
    assert obj.family.metadata['members'] == ['encode-project:individual-456']
    if relation == 'proband':
        assert obj.family.metadata['proband'] == 'encode-project:individual-456'
    assert not obj.errors == (not error)  # check presence of errors
    # check for correct error message
    assert ('Row 1 - Invalid relation' in ''.join(obj.errors)) == error


@pytest.mark.parametrize('relation2, relation3, error', [
    ('mother', 'father', False),
    ('mother', 'mother', True)
])
def test_add_family_metadata(example_rows, project, institution, relation2, relation3, error):
    data = example_rows[:3]
    data[1]['relation to proband'] = relation2
    data[2]['relation to proband'] = relation3
    submission = SubmissionMetadata(data, project, institution)
    assert len(submission.families) == 1
    fam = list(submission.families.values())[0]
    assert len(fam['members']) == 3
    assert (len(submission.errors) > 0) == error
    assert ('Multiple values for relation' in ''.join(submission.errors)) == error


def test_extract_sample_metadata(row_dict, project, institution):
    row_dict['req accepted y/n'] = 'Yes'
    row_dict['specimen accepted by ref lab'] = "n"
    obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
    assert obj.sample.metadata['specimen_accession'] == row_dict['specimen id']
    assert obj.sample.metadata['specimen_accepted'] == 'No'
    assert obj.sample.metadata['requisition_acceptance']['accepted_rejected'] == 'Accepted'
    assert obj.analysis.metadata['samples'] == [obj.sample.alias]
    assert obj.individual.metadata['samples'] == [obj.sample.alias]


def test_extract_file_metadata_valid(row_dict, project, institution):
    row_dict['files'] = 'f1.fastq.gz, f2.cram, f3.vcf.gz'
    files = [f.strip() for f in row_dict['files'].split(',')]
    obj = SubmissionRow(row_dict, 1, 'fam1', project['name'], institution['name'])
    assert files[0] in obj.files_fastq[0].alias
    assert obj.files_fastq[0].metadata['file_format'] == '/file-formats/fastq/'
    assert obj.files_fastq[0].metadata['file_type'] == 'reads'
    assert obj.files_processed[0].alias == 'encode-project:f2.cram'
    assert files[2] in obj.files_processed[1].alias
    assert not obj.errors


# filenames indicating uncompressed fastqs/vcfs should lead to errors
def test_extract_file_metadata_uncompressed(row_dict, project, institution):
    row_dict['files'] = 'f1.fastq, f2.cram, f3.vcf'
    files = [f.strip() for f in row_dict['files'].split(',')]
    obj = SubmissionRow(row_dict, 1, 'fam1', project['name'], institution['name'])
    assert not obj.files_fastq
    assert obj.files_processed[0].alias == 'encode-project:f2.cram'
    assert files[2] not in ''.join([f.alias for f in obj.files_processed])
    assert all('File must be compressed' in error for error in obj.errors)


# file extensions other than fastq.gz,.cram, .vcf.gz should generate an error
def test_extract_file_metadata_invalid(row_dict, project, institution):
    row_dict['files'] = 'f3.gvcf.gz'
    files = [f.strip() for f in row_dict['files'].split(',')]
    obj = SubmissionRow(row_dict, 1, 'fam1', project['name'], institution['name'])
    assert not obj.files_processed
    assert 'File extension on f3.gvcf.gz not supported - ' in ''.join(obj.errors)


@pytest.mark.parametrize('field, error', [
    ('workup type', False),
    ('specimen id', True),
    ('individual id', True),
    ('family id', False),
    ('relation to proband', True),
    ('analysis id', True),
    ('report required', True),
    ('specimen type', False),
    ('alsdkjfdk', False)
])
def test_found_missing_values(row_dict, project, institution, field, error):
    row_dict[field] = None
    obj = SubmissionRow(row_dict, 1, 'fam1', project['name'], institution['name'])
    assert (len(obj.errors) > 0) == error
    assert ('Row 1 - missing required field(s) {}. This row cannot be processed.'
            ''.format(field) in obj.errors) == error


@pytest.mark.parametrize('num, val', [(0, 1), (1, 2), (2, 1), (3, 2), (4, 1), (5, 2)])
def test_get_paired_end_value(num, val):
    assert SubmissionRow.get_paired_end_value(num) == val

# add sample processing


@pytest.mark.parametrize('case_id, report', [(None, True), ('Case123', True), ('Case123', False)])
def test_create_case_metadata(row_dict, case_id, report, project, institution):
    if not report:
        row_dict['report required'] = 'N'
    row_dict['unique analysis id'] = case_id
    submission = SubmissionMetadata([row_dict], project, institution)
    case = list(submission.cases.values())[0]
    assert row_dict['individual id'] in case['individual']
    assert case['family'] == list(submission.families.keys())[0]
    assert (len(submission.reports) > 0) == report
    case_alias = list(submission.cases.keys())[0]
    if case_id:
        assert case_id in case_alias
    else:
        assert '{}-{}'.format(row_dict['analysis id'], row_dict['specimen id']) in case_alias
    if report:
        assert case['report']


@pytest.mark.parametrize('case_id', [(None), ('Case123')])
def test_add_case_info(row_dict, case_id, project, institution):
    row_dict['unique analysis id'] = case_id
    submission = SubmissionMetadata([row_dict], project, institution)
    key = '{}-{}'.format(row_dict['analysis id'], row_dict['specimen id'])
    assert submission.case_names.get(key)[0] == case_id


def test_add_individual_relations(example_rows, project, institution):
    submission = SubmissionMetadata(example_rows, project, institution)
    assert all(field in submission.individuals['encode-project:individual-456'] for field in ['mother', 'father'])
    assert not any(field in submission.families['encode-project:family-456'] for field in ['mother', 'father'])


def test_process_rows(example_rows, project, institution):
    submission = SubmissionMetadata(example_rows, project, institution)
    assert submission.json_out
    assert len(submission.individuals) == 5
    assert len(submission.families) == 2
    assert len(submission.samples) == 5
    assert len(submission.sample_processings) == 3
    assert len(submission.cases) == 6
    assert len(submission.reports) == 3


def test_create_json_out(example_rows, project, institution):
    submission = SubmissionMetadata(example_rows, project, institution)
    assert all(submission.json_out[key] for key in ['individual', 'family', 'sample', 'sample_processing', 'case', 'report'])
    for key, val in submission.json_out.items():
        if key != 'errors':
            for val2 in val.values():
                assert val2['project']
                assert val2['institution']


def test_xls_to_json(project, institution):
    rows = digest_xls('src/encoded/tests/data/documents/cgap_submit_test.xlsx')
    json_out, success = xls_to_json(rows, project, institution)
    assert len(json_out['family']) == 1
    assert 'encode-project:family-456' in json_out['family']
    assert len(json_out['individual']) == 3
    assert all(['encode-project:individual-' + x in json_out['individual'] for x in ['123', '456', '789']])


def test_xls_to_json_no_header(project, institution, xls_list):
    no_top_header = iter(xls_list[1:])  # top header missing should work ok (e.g. 'Patient Information', etc)
    no_main_header = iter([xls_list[0]] + xls_list[2:])  # main header missing should cause a caught error
    no_comments = iter(xls_list[0:2] + xls_list[3:])
    json_out, success = xls_to_json(no_top_header, project, institution)
    assert success
    json_out, success = xls_to_json(no_main_header, project, institution)
    assert not success
    json_out, success = xls_to_json(no_comments, project, institution)
    assert success


def test_xls_to_json_missing_req_col(project, institution, xls_list):
    # test error is caught when a required column in missing from excel file
    idx = xls_list[1].index('Specimen ID')
    rows = (row[0:idx] + row[idx+1:] for row in xls_list)
    json_out, success = xls_to_json(rows, project, institution)
    assert not success


def test_xls_to_json_missing_req_val(project, institution, xls_list):
    # test error is caught when a required column is present but value is missing in a row
    idx = xls_list[1].index('Specimen ID')
    xls_list[4] = xls_list[4][0:idx] + [''] + xls_list[4][idx+1:]
    rows = iter(xls_list)
    json_out, success = xls_to_json(rows, project, institution)
    assert json_out['errors']
    assert success


def test_xls_to_json_invalid_workup(project, institution, xls_list):
    # invalid workup type is caught as an error
    idx = xls_list[1].index('Workup Type')
    xls_list[4] = xls_list[4][0:idx] + ['Other'] + xls_list[4][idx+1:]
    rows = iter(xls_list)
    json_out, success = xls_to_json(rows, project, institution)
    assert json_out['errors']
    assert success
    assert ('Row 5 - Samples with analysis ID 55432 contain mis-matched '
            'or invalid workup type values.') in ''.join(json_out['errors'])


def test_xls_to_json_mixed_workup(project, institution, xls_list):
    # mixed workup types per analysis caught as an error
    idx = xls_list[1].index('Workup Type')
    xls_list[3] = xls_list[3][0:idx] + ['WES'] + xls_list[3][idx+1:]
    one_row = xls_list[:4]
    rows = iter(xls_list)
    json_out, success = xls_to_json(rows, project, institution)
    assert json_out['errors']
    assert success
    assert ('Row 5 - Samples with analysis ID 55432 contain mis-matched '
            'or invalid workup type values.') in ''.join(json_out['errors'])
    single_row = iter(one_row)
    one_json_out, one_success = xls_to_json(single_row, project, institution)
    assert not one_json_out['errors']


def test_parse_exception_invalid_alias(testapp, a_case):
    a_case['invalid_field'] = 'value'
    a_case['project'] = '/projects/invalid-project/'
    errors = []
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


def test_validate_item_post_invalid_yn(testapp, sample_info):
    sample_info['req accepted y/n'] = 'not sure'
    sample_info['specimen accepted by ref lab'] = "I don't know"
    sample_item = map_fields(sample_info, {}, ['workup_type'], 'sample')
    req_info = map_fields(sample_info, {}, ['date sent', 'date completed'], 'requisition')
    sample_item['requisition_acceptance'] = req_info
    result = validate_item(testapp, sample_item, 'post', 'sample', [])
    assert len(result) == 2
    assert all("is not one of ['Y', 'N']" in error for error in result)


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
    data_out, result, success = validate_all_items(testapp, items)
    assert not data_out
    assert not success
    assert len(result) > 1
    errors = ' '.join(result)
    assert "'test-proj:invalid-project-alias' not found" in errors
    assert "'test-proj:invalid-institution-alias' not found" in errors
    assert mother['aliases'][0] not in errors
