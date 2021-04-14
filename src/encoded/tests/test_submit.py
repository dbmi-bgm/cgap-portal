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
    PedigreeRow,
    PedigreeMetadata,
    SpreadsheetProcessing,
    map_fields,
    parse_exception,
    post_and_patch_all_items,
    row_generator,
    validate_all_items,
    validate_item,
    xls_to_json
)

pytestmark = [pytest.mark.working]


TEST_INGESTION_ID1 = '123456-1243-1234-123456abcdef'
TEST_INGESTION_ID2 = 'abcdef-1234-1234-abcdef123456'
WORKBOOK_FAMILY_ID1 = '/families/GAPFA59JKS1Y/'
WORKBOOK_FAMILY_ID2 = '/families/GAPFAYUV203P/'
WORKBOOK_FAMILY_ID3 = '/families/GAPFAZ3V21Q8/'


# TODO: Check if these work or not.  These tests seem to be working, but they may do posting
#       that could affect other tests, so I have marked this as requiring manual invocation until we
#       investigate that. -kmp 21-Feb-2021
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.manual]


@pytest.fixture
def row_dict():
    return {
        'individual id': '456',
        'family id': '333',
        'sex': 'M',
        'relation to proband': 'proband',
        'analysis id': '999',
        'report required': 'Y',
        'specimen id': '3464467',
        'specimen type': 'saliva',
        'workup type': 'WGS'
    }


@pytest.fixture
def row_dict_pedigree():
    return {
        'family id': '333',
        'individual id': '456',
        'mother id': '123',
        'father id': '789',
        'sex': 'M',
        'proband': 'Y',
        'hpo terms': 'HP:0000123, HP:0000999',
        'mondo terms': 'MONDO:0000555',
        'ancestry': 'European',
        'life status': 'alive and well',
        'deceased': 'N',
        'termination of pregnancy': 'N',
        'still birth': 'N',
        'pregnancy': 'N',
        'spontaneous abortion': 'N',
        'infertile': 'N',
        'no children by choice': 'Y'
    }


@pytest.fixture
def xls_list():
    book = xlrd.open_workbook('src/encoded/tests/data/documents/cgap_submit_test.xlsx')
    sheet, = book.sheets()
    row = row_generator(sheet)
    return list(row)


@pytest.fixture
def xls_list_pedigree():
    book = xlrd.open_workbook('src/encoded/tests/data/documents/pedigree_test_example.xlsx')
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
        'case': {'test-proj:case1': {
            'individual': 'test-proj:indiv1',
            'families': ['test-proj: fam1'],
            'ingestion_ids': [TEST_INGESTION_ID1]
        }},
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
    info['individual']['test-proj:indiv3'] = {'samples': ['test-proj:samp3']}
    info['sample']['test-proj:samp3'] = {'workup_type': 'WGS'}
    return info


@pytest.fixture
def post_data(project, institution):
    return {
        'post': {
            'family': [{
                'aliases': ['test-proj:fam1'],
                'family_id': 'fam1',
                'members': ['test-proj:indiv1'],
                'proband': 'test-proj:indiv1',
                'project': project['@id'],
                'institution': institution['@id']
            }],
            'individual': [{
                'aliases': ['test-proj:indiv1'],
                'individual_id': 'indiv1',
                'sex': 'F',
                'samples': ['test-proj:samp1'],
                'project': project['@id'],
                'institution': institution['@id']
            }],
            'sample': [{
                'aliases': ['test-proj:samp1'],
                'workup_type': 'WGS',
                'specimen_accession': 'samp1',
                'project': project['@id'],
                'institution': institution['@id']
            }]
        },
        'patch': {},
        'aliases': {}
    }


@pytest.fixture
def sample_info():
    return {
        'workup type': 'WES',
        'specimen id': '9034',
        'date collected': '2020-01-06'
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


@pytest.fixture
def case_with_ingestion_id1(testapp, project, institution, fam, sample_proc_fam):
    data = {
        'project': project['@id'],
        'institution': institution['@id'],
        'family': fam['@id'],
        'individual': 'GAPIDPROBAND',
        'sample_processing': sample_proc_fam['@id'],
        'ingestion_ids': [TEST_INGESTION_ID1]
    }
    res = testapp.post_json('/case', data).json['@graph'][0]
    return res

@pytest.fixture
def case_with_ingestion_id2(testapp, project, institution, fam, sample_proc_fam):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'family': fam['@id'],
        'individual': 'GAPIDPROBAND',
        'sample_processing': sample_proc_fam['@id'],
        'ingestion_ids': [TEST_INGESTION_ID2]
    }


@pytest.fixture
def example_rows():
    return [
        {'individual id': '456', 'sex': 'F', 'analysis id': '1111', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WGS', 'specimen id': '1'},
        {'individual id': '123', 'sex': 'F', 'analysis id': '1111', 'relation to proband': 'mother',
         'report required': 'N', 'workup type': 'WGS', 'specimen id': '2'},
        {'individual id': '789', 'sex': 'M', 'analysis id': '1111', 'relation to proband': 'father',
         'report required': 'N', 'workup type': 'WGS', 'specimen id': '3'},
        {'individual id': '456', 'sex': 'F', 'analysis id': '2222', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WGS', 'specimen id': '1'},
        {'individual id': '456', 'sex': 'F', 'analysis id': '4444', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WES', 'specimen id': '7'},
        {'individual id': '555', 'sex': 'M', 'analysis id': '3333', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WES', 'specimen id': '5'},
        {'individual id': '546', 'sex': 'F', 'analysis id': '3333', 'relation to proband': 'mother',
         'report required': 'N', 'workup type': 'WES', 'specimen id': '6'}
    ]


@pytest.fixture
def big_family_rows():
    return [
        {'individual id': '456', 'sex': 'M', 'analysis id': '1111', 'relation to proband': 'proband',
         'report required': 'Y', 'workup type': 'WGS', 'specimen id': '1'},
        {'individual id': '123', 'sex': 'F', 'analysis id': '1111', 'relation to proband': 'mother',
         'report required': 'N', 'workup type': 'WGS', 'specimen id': '2'},
        {'individual id': '789', 'sex': 'M', 'analysis id': '1111', 'relation to proband': 'father',
         'report required': 'N', 'workup type': 'WGS', 'specimen id': '3'},
        {'individual id': '546', 'sex': 'F', 'analysis id': '1111', 'relation to proband': 'sister',
         'report required': 'Y', 'workup type': 'WGS', 'specimen id': '4'},
        {'individual id': '555', 'sex': 'M', 'analysis id': '1111', 'relation to proband': 'full brother 1',
         'report required': 'Y', 'workup type': 'WGS', 'specimen id': '5'}
    ]


@pytest.fixture
def example_rows_obj(example_rows, project, institution):
    return SubmissionMetadata(example_rows, project, institution, TEST_INGESTION_ID1)


@pytest.fixture
def example_rows_pedigree():
    return [
        {'family id': '0101', 'individual id': '456', 'mother id': '123', 'father id': '789',
         'sex': 'F', 'proband': 'Y', 'hpo terms': 'HP:0000001, HP:0099994', 'mondo terms': 'MONDO:0012345'},
        {'family id': '0101', 'individual id': '123', 'mother id': '223', 'father id': '323',
         'sex': 'F', 'proband': 'N', 'hpo terms': 'HP:0099994', 'mondo terms': ''},
        {'family id': '0101', 'individual id': '789', 'mother id': '', 'father id': '',
         'sex': 'M', 'proband': 'N', 'hpo terms': '', 'mondo terms': ''},
        {'family id': '0101', 'individual id': '423', 'mother id': '223', 'father id': '323',
         'sex': 'M', 'proband': 'N', 'hpo terms': '', 'mondo terms': ''},
        {'family id': '0101', 'individual id': '223', 'mother id': '', 'father id': '',
         'sex': 'F', 'proband': 'N', 'hpo terms': 'HP:0099994, HP:0012345', 'mondo terms': ''},
        {'family id': '0101', 'individual id': '323', 'mother id': '', 'father id': '',
         'sex': 'F', 'proband': 'N', 'hpo terms': '', 'mondo terms': 'MONDO:0045732, MONDO:0043872'},
        {'family id': '0101', 'individual id': '156', 'mother id': '456', 'father id': '',
         'sex': 'F', 'proband': 'N', 'hpo terms': '', 'mondo terms': '',
         'pregnancy': 'y', 'gestational age': '25', 'gestational age units': 'week'}
    ]

@pytest.fixture
def example_rows_pedigree_obj(testapp, example_rows_pedigree, project, institution):
    return PedigreeMetadata(testapp, example_rows_pedigree, project, institution, TEST_INGESTION_ID1)

@pytest.fixture
def first_family():
    return {'@graph': [{
        'aliases': ['encode-project:family-456'],
        'proband': 'encode-project:individual-456',
        'members': ['encode-project:individual-456']
    }]}

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


def test_map_fields(sample_info):
    # tests spreadsheet fields are mapped to correct cgap property
    result = map_fields(sample_info, {}, ['workup_type'], 'sample')
    assert result['workup_type'] == 'WES'
    assert result['specimen_accession'] == '9034'
    assert result['specimen_collection_date'] == '2020-01-06'
    assert not result.get('sequencing_lab')


class TestSubmissionRow:

    def test_extract_individual_metadata(self, row_dict, project, institution):
        obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert obj.indiv_alias == 'encode-project:individual-456'
        assert obj.individual.metadata['aliases'] == [obj.indiv_alias]
        assert obj.individual.metadata['individual_id'] == row_dict['individual id']

    @pytest.mark.parametrize('age, birth_year, val_type', [
        ('33', '1986', int),
        ('abc', 'def', str)
    ])
    def test_extract_individual_metadata_nums(self, row_dict, age, birth_year, val_type, project, institution):
        """
        numerical values for age and birth year are expected
        text values for age and birth year should be passed on without errors to eventually fail validation
        """
        row_dict['age'] = age
        row_dict['birth year'] = birth_year
        obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert isinstance(obj.individual.metadata['age'], val_type)
        assert not obj.errors

    @pytest.mark.parametrize('relation, error', [
        ('proband', False),
        ('grandmother', True)
    ])
    def test_extract_family_metadata_new(self, row_dict, project, institution, relation, error):
        """
        Currently without pedigree processing, can only parse proband/mother/father/sibling relationships.
        Other relationships like 'grandmother' should result in an error message, but in the future may
        be permitted with a pedigree file.
        """
        row_dict['relation to proband'] = relation
        obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert obj.family.alias == 'test-proj:fam1'
        assert obj.family.metadata['members'] == ['encode-project:individual-456']
        if relation == 'proband':
            assert obj.family.metadata['proband'] == 'encode-project:individual-456'
        assert not obj.errors == (not error)  # check presence of errors
        # check for correct error message
        assert ('Row 1 - Invalid relation' in ''.join(obj.errors)) == error

    def test_extract_sample_metadata(self, row_dict, project, institution):
        """
        Some fields are formatted differently in spreadsheets vs in DB -
        ex.
        'Yes' --> 'Accepted' / 'No' --> 'Rejected' for requisition accepted field
        'Y' --> 'Yes' / 'N' --> 'No' for specimen accepted field
        """
        row_dict['req accepted y/n'] = 'Yes'
        row_dict['specimen accepted by ref lab'] = "n"
        obj = SubmissionRow(row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert obj.sample.metadata['specimen_accession'] == row_dict['specimen id']
        assert obj.sample.metadata['specimen_accepted'] == 'No'
        assert obj.sample.metadata['requisition_acceptance']['accepted_rejected'] == 'Accepted'
        assert obj.analysis.metadata['samples'] == [obj.sample.alias]
        assert obj.individual.metadata['samples'] == [obj.sample.alias]

    def test_extract_file_metadata_valid(self, row_dict, project, institution):
        """expected file extensions in spreadsheet"""
        row_dict['files'] = 'f1.fastq.gz, f2.cram, f3.vcf.gz'
        files = [f.strip() for f in row_dict['files'].split(',')]
        obj = SubmissionRow(row_dict, 1, 'fam1', project['name'], institution['name'])
        assert files[0] in obj.files_fastq[0].alias
        assert obj.files_fastq[0].metadata['file_format'] == '/file-formats/fastq/'
        assert obj.files_fastq[0].metadata['file_type'] == 'reads'
        assert obj.files_processed[0].alias == 'encode-project:f2.cram'
        assert files[2] in obj.files_processed[1].alias
        assert not obj.errors

    def test_extract_file_metadata_uncompressed(self, row_dict, project, institution):
        """filenames indicating uncompressed fastqs/vcfs should lead to errors"""
        row_dict['files'] = 'f1.fastq, f2.cram, f3.vcf'
        files = [f.strip() for f in row_dict['files'].split(',')]
        obj = SubmissionRow(row_dict, 1, 'fam1', project['name'], institution['name'])
        assert not obj.files_fastq
        assert obj.files_processed[0].alias == 'encode-project:f2.cram'
        assert files[2] not in ''.join([f.alias for f in obj.files_processed])
        assert all('File must be compressed' in error for error in obj.errors)

    def test_extract_file_metadata_invalid(self, row_dict, project, institution):
        """# file extensions other than fastq.gz,.cram, .vcf.gz should generate an error"""
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
    def test_found_missing_values(self, row_dict, project, institution, field, error):
        """some columns are required for spreadsheet submission, others are optional."""
        row_dict[field] = None
        obj = SubmissionRow(row_dict, 1, 'fam1', project['name'], institution['name'])
        assert (len(obj.errors) > 0) == error
        assert ('Row 1 - missing required field(s) {}. This row cannot be processed.'
                ''.format(field) in obj.errors) == error

    @pytest.mark.parametrize('num, val', [(0, 1), (1, 2), (2, 1), (3, 2), (4, 1), (5, 2)])
    def test_get_paired_end_value(self, num, val):
        assert SubmissionRow.get_paired_end_value(num) == val


class TestSubmissionMetadata:

    def test_init_families(self, example_rows_obj, project):
        """test family aliases are named after proband individual ids"""
        proj_name = project['name'] + ':'
        fams = example_rows_obj.family_dict
        assert sorted(list(fams.keys())) == ['1111', '2222', '3333', '4444']
        assert fams['1111'] == proj_name + 'family-456'
        assert fams['2222'] == proj_name + 'family-456'
        assert fams['3333'] == proj_name + 'family-555'

    def test_get_analysis_types(self, example_rows_obj, example_rows, project, institution):
        """analysis type should be none if workup types in samples don't match"""
        a_types = example_rows_obj.analysis_types
        assert a_types['1111'] == 'WGS-Trio'
        assert a_types['2222'] == 'WGS'
        assert a_types['3333'] == 'WES-Group'
        example_rows[1]['workup type'] = 'WES'
        new_obj = SubmissionMetadata(example_rows, project, institution, TEST_INGESTION_ID1)
        new_a_types = new_obj.analysis_types
        assert new_a_types['1111'] is None

    def test_add_metadata_single_item(self, example_rows, project, institution):
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
        submission = SubmissionMetadata(data, project, institution, TEST_INGESTION_ID1)
        assert len(submission.individuals) == 2
        assert len(submission.samples) == 2
        assert 'specimen_accepted' in list(submission.samples.values())[1]

    @pytest.mark.parametrize('last_relation, error', [
        ('brother', False),  # not a duplicate relation
        ('mother', True),  # error if two members of family have same parental relation
        ('sister', False)  # two siblings can have same relation
    ])
    def test_add_family_metadata(self, big_family_rows, project, institution, last_relation, error):
        """
        tests handling of duplicate relations for parents vs siblings.
        before modification, fixture contains proband, mother, father, sister.
        """
        big_family_rows[4]['relation to proband'] = last_relation
        submission = SubmissionMetadata(big_family_rows, project, institution, TEST_INGESTION_ID1)
        assert len(submission.families) == 1
        fam = list(submission.families.values())[0]
        assert len(fam['members']) == 5
        assert (len(submission.errors) > 0) == error
        assert ('Multiple values for relation' in ''.join(submission.errors)) == error

    def test_add_sample_processing(self, example_rows, project, institution):
        """tests metadata creation for sample_processing item from a set of rows"""
        example_rows[5]['workup type'] = 'WGS'  # analysis 3333 will have mismatched workup type values
        submission = SubmissionMetadata(example_rows, project, institution, TEST_INGESTION_ID1)
        sps = submission.sample_processings
        assert sps['encode-project:analysis-1111']['analysis_type'] == 'WGS-Trio'
        assert sps['encode-project:analysis-2222']['analysis_type'] == 'WGS'
        assert sps['encode-project:analysis-1111']['samples'] == [
            'encode-project:sample-1', 'encode-project:sample-2', 'encode-project:sample-3'
        ]
        assert sps['encode-project:analysis-2222']['samples'] == ['encode-project:sample-1']
        assert not sps['encode-project:analysis-3333']['analysis_type']
        assert '3333 contain mis-matched or invalid workup type values' in ''.join(submission.errors)

    @pytest.mark.parametrize('case_id, report', [(None, True), ('Case123', True), ('Case123', False)])
    def test_create_case_metadata(self, row_dict, case_id, report, project, institution):
        """tests case and report item creation after all rows processed"""
        if not report:
            row_dict['report required'] = 'N'
        row_dict['unique analysis id'] = case_id
        submission = SubmissionMetadata([row_dict], project, institution, TEST_INGESTION_ID1)
        case = list(submission.cases.values())[0]
        assert row_dict['individual id'] in case['individual']
        assert case['ingestion_ids'] == [TEST_INGESTION_ID1]
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
    def test_add_case_info(self, row_dict, case_id, project, institution):
        """tests that case ID from row gets added to proper dictionary attribute"""
        row_dict['unique analysis id'] = case_id
        submission = SubmissionMetadata([row_dict], project, institution, TEST_INGESTION_ID1)
        key = '{}-{}'.format(row_dict['analysis id'], row_dict['specimen id'])
        assert submission.case_info.get(key)['case id'] == case_id

    def test_add_individual_relations(self, big_family_rows, project, institution):
        """
        tests that correct proband mother and father get added to individual item metadata
        after all rows are processed
        """
        obj = SubmissionMetadata(big_family_rows, project, institution, TEST_INGESTION_ID1)
        proband = obj.individuals['encode-project:individual-456']
        sister = obj.individuals['encode-project:individual-546']
        brother = obj.individuals['encode-project:individual-555']
        parent = obj.individuals['encode-project:individual-789']
        assert all(field in proband for field in ['mother', 'father'])
        assert all(field not in parent for field in ['mother', 'father'])
        assert proband['mother'] == sister['mother'] == brother['mother']
        assert proband['father'] == sister['father'] == brother['father']
        assert not any(field in obj.families['encode-project:family-456']
                       for field in ['mother', 'father', 'sister', 'brother'])

    def test_process_rows(self, example_rows_obj, project, institution):
        """tests that all rows get processed and create desired number and type of json items"""
        assert example_rows_obj.json_out
        assert len(example_rows_obj.individuals) == 5
        assert len(example_rows_obj.families) == 2
        assert len(example_rows_obj.samples) == 6
        assert len(example_rows_obj.sample_processings) == 4
        assert len(example_rows_obj.cases) == 7
        assert len(example_rows_obj.reports) == 4
        assert len(example_rows_obj.individuals['encode-project:individual-456']['samples']) == 2

    def test_create_json_out(self, example_rows_obj, project, institution):
        """tests that all expected items are present in final json as well as
        project and institution fields"""
        assert all(key in example_rows_obj.json_out for key in
                   ['individual', 'family', 'sample', 'sample_processing', 'case', 'report'])
        for key, val in example_rows_obj.json_out.items():
            if key != 'errors':
                for val2 in val.values():
                    assert val2['project']
                    assert val2['institution']
                    assert all(val3  for val3 in val2.values())  # test all None values are removed


class TestPedigreeRow:

    def test_extract_individual_metadata(self, row_dict_pedigree, project, institution):
        """tests that individual metadata gets created properly during pedigree file parsing"""
        obj = PedigreeRow(row_dict_pedigree, 1, project['name'], institution['name'])
        assert obj.indiv_alias == 'encode-project:individual-456'
        assert obj.individual.metadata['aliases'] == [obj.indiv_alias]
        assert obj.individual.metadata['individual_id'] == row_dict_pedigree['individual id']
        assert all([':individual-' in obj.individual.metadata[item] for item in['mother', 'father']])
        for item in ['family_id', 'sex', 'phenotypic_features', 'disorders', 'ancestry',
                     'life_status', 'is_deceased', 'is_termination_of_pregnancy',
                     'is_still_birth', 'is_pregnancy', 'is_spontaneous_abortion',
                     'is_infertile', 'is_no_children_by_choice']:
            assert item in obj.individual.metadata

    @pytest.mark.parametrize('field, error', [
        ('individual id', True),
        ('family id', True),
        ('sex', True),
        ('ancestry', False),
        ('mother id', False),
        ('father id', False),
        ('hpo terms', False)
    ])
    def test_found_missing_values(self, row_dict_pedigree, project, institution, field, error):
        """some columns are required for spreadsheet submission, others are optional."""
        row_dict_pedigree[field] = None
        obj = PedigreeRow(row_dict_pedigree, 1, project['name'], institution['name'])
        assert (len(obj.errors) > 0) == error
        assert ('Row 1 - missing required field(s) {}. This row cannot be processed.'
                ''.format(field) in obj.errors) == error

    @pytest.mark.parametrize('feat_list, length', [
        ('', 0),
        ('HPO:000001', 1),
        ('HPO:094732, HPO:239843, HPO:000001', 3)
    ])
    def test_reformat_phenotypic_features(self, row_dict_pedigree, project, institution, feat_list, length):
        row_dict_pedigree['hpo terms'] = feat_list
        obj = PedigreeRow(row_dict_pedigree, 1, project['name'], institution['name'])
        result = obj.individual.metadata['phenotypic_features']
        assert len(result) == length
        for item in result:
            assert isinstance(item, dict)
            assert list(item.keys()) == ['phenotypic_feature']

    @pytest.mark.parametrize('proband_val, result', [
        ('Y', True),
        ('N', False),
        ('U', False)
    ])
    def test_is_proband(self, row_dict_pedigree, project, institution, proband_val, result):
        row_dict_pedigree['proband'] = proband_val
        obj = PedigreeRow(row_dict_pedigree, 1, project['name'], institution['name'])
        assert obj.proband == result

    @pytest.mark.parametrize('key, val, is_error', [
        ('hpo terms', 'HP:123456', True),
        ('hpo terms', 'HP:0000137', False),
        ('hpo terms', 'ataxia', True),
        ('mondo terms', 'mondo:0001230', False),
        ('mondo terms', 'MONDO:99900', True),
        ('mondo terms', 'MONDO_0001256', False)
    ])
    def test_format_atid(self, row_dict_pedigree, project, institution, key, val, is_error):
        row_dict_pedigree[key] = val
        obj = PedigreeRow(row_dict_pedigree, 2, project['name'], institution['name'])
        assert (obj.errors != []) == is_error
        if obj.errors:
            text = ('Row 2 - term {} does not match the format for an '
                    'HPO or MONDO ontology term.'.format(val))
            assert text in ''.join(obj.errors)



class TestPedigreeMetadata:

    def test_add_individual_metadata(self, testapp, example_rows_pedigree, project, institution):
        """
        if json for an item was already created in a previous row, any new fields for that
        item in the current row should be added to the existing json.
        if the current row has less information than the previous json item, the fields in
        the previous json item won't get overwritten.
        """
        for rowidx in (1, 2):
            data = [
                {k: v for k, v in example_rows_pedigree[0].items()},
                # 2 rows have same sample
                {k: v for k, v in example_rows_pedigree[6].items()},
                {k: v for k, v in example_rows_pedigree[6].items()}
            ]
            submission = PedigreeMetadata(testapp, data, project, institution, TEST_INGESTION_ID1)
            assert len(submission.individuals) == 4  # row 0, row 6, + 2 parents of row[0]
            # assert len(submission.families) == 1
            assert 'is_pregnancy' in list(submission.individuals.values())[1]
            assert list(submission.individuals.values())[1]['is_pregnancy'] == True

    def test_add_family_metadata(self, testapp, example_rows_pedigree, example_rows_pedigree_obj,
                                 project, institution):
        assert len(example_rows_pedigree_obj.families) == 1
        fam = list(example_rows_pedigree_obj.families.values())[0]
        assert fam['proband'] == 'encode-project:individual-456'
        assert len(fam['members']) == len(example_rows_pedigree)

    def test_add_family_metadata_db_single(self, workbook, es_testapp, example_rows_pedigree,
                                           project, institution):
        """Tests that if a family ID is already in the database, the atid is used as an identifier instead
        of the new alias. Additionally, if the proband designation is missing from the family history rows,
        the PedigreeMetadata object still gets created without error messages when the family is in the DB already.
        """
        example_rows_pedigree[0]['proband'] == 'N'
        submission = PedigreeMetadata(es_testapp, example_rows_pedigree, project, institution, TEST_INGESTION_ID1)
        assert len(submission.families) == 1
        fam = list(submission.families.values())[0]
        assert 'hms-dbmi:0101' in fam['aliases']
        assert list(submission.families.keys())[0] == WORKBOOK_FAMILY_ID1
        assert len(fam['members']) == len(example_rows_pedigree)
        assert len(submission.errors) == 0

    def test_add_family_metadata_db_multi(self, workbook, es_testapp, example_rows_pedigree, project, institution):
        """Tests that if 2 items are in the DB with same familyID, that both of these are reflected in the
        PedigreeMetadata object. Checks that both items have all members and proband of each isn't changed."""
        for row in example_rows_pedigree:
            row['family id'] = '0102'
        submission = PedigreeMetadata(es_testapp, example_rows_pedigree, project, institution, TEST_INGESTION_ID1)
        assert len(submission.families) == 2
        assert sorted(list(submission.families.keys())) == sorted([WORKBOOK_FAMILY_ID2, WORKBOOK_FAMILY_ID3])
        for fam in submission.families.values():
            assert len(fam['members']) == len(example_rows_pedigree)
            assert 'proband' not in fam

    def test_add_family_metadata_no_proband(self, testapp, example_rows_pedigree, project, institution):
        del example_rows_pedigree[0]['proband']
        submission = PedigreeMetadata(testapp, example_rows_pedigree, project, institution, TEST_INGESTION_ID1)
        assert len(submission.errors) > 0
        assert 'No proband indicated for family 0101. Please edit and resubmit' in ''.join(submission.errors)
        print(submission.errors)

    def test_process_rows(self, example_rows_pedigree_obj):
        assert len(example_rows_pedigree_obj.families) == 1
        assert len(example_rows_pedigree_obj.individuals) == 7
        assert not example_rows_pedigree_obj.errors

    def test_json_out(self, example_rows_pedigree_obj):
        assert sorted(list(example_rows_pedigree_obj.json_out.keys())) == ['errors', 'family', 'individual']
        assert not example_rows_pedigree_obj.json_out['errors']
        assert len(example_rows_pedigree_obj.json_out['family']) == 1
        assert len(example_rows_pedigree_obj.json_out['individual']) == 7

    def test_check_individuals(self, testapp, example_rows_pedigree, project, institution):
        submission = PedigreeMetadata(testapp, [example_rows_pedigree[0]], project, institution,
                                      TEST_INGESTION_ID1)
        assert sorted(list(submission.json_out.keys())) == ['errors', 'family', 'individual']
        assert not submission.json_out['errors']
        assert len(submission.json_out['family']) == 1
        assert len(submission.json_out['individual']) == 3


class TestSpreadsheetProcessing:

    @pytest.mark.parametrize('remove_row, success_bool', [
        (0, True),  # super header missing should work ok (e.g. 'Patient Information' row)
        (1, False),  # main header missing should cause a caught error
        (2, True)  # missing comment row should work ok
    ])
    def test_header_found(self, testapp, project, institution, xls_list, remove_row, success_bool):
        """tests that proper header is found when present"""
        data = iter(xls_list[0:remove_row] + xls_list[(remove_row) + 1:])
        obj = SpreadsheetProcessing(testapp, data, project, institution, TEST_INGESTION_ID1)
        assert obj.passing == success_bool
        assert (len(obj.errors) == 0) == success_bool
        assert ('Column headers not detected in spreadsheet!' in ''.join(obj.errors)) == (not success_bool)

    def test_create_row_dict(self, testapp, xls_list, project, institution):
        """tests that dictionary of colname: field value is created for each row"""
        obj = SpreadsheetProcessing(testapp, iter(xls_list), project, institution, TEST_INGESTION_ID1)
        assert obj.keys
        assert len(obj.rows) == 3
        for row in obj.rows:
            assert all(key in row for key in obj.keys)

    def test_create_row_dict_missing_col(self, testapp, xls_list, project, institution):
        """tests that correct error is returned when a required column header is not in spreadsheet"""
        idx = xls_list[1].index('Specimen ID')
        rows = (row[0:idx] + row[idx+1:] for row in xls_list)
        obj = SpreadsheetProcessing(testapp, rows, project, institution, TEST_INGESTION_ID1)
        assert not obj.passing
        assert 'Column(s) "specimen id" not found in spreadsheet!' in ''.join(obj.errors)

    @pytest.mark.parametrize('remove_row, success_bool', [
        (0, False),  # main header missing should cause a caught error
        (8, True),  # last data row missing shouldn't cause issues
    ])
    def test_header_found_pedigree(self, testapp, project, institution,
                                   xls_list_pedigree, remove_row, success_bool):
        """tests that proper header is found when present"""
        data = iter(xls_list_pedigree[0:remove_row] + xls_list_pedigree[(remove_row) + 1:])
        obj = SpreadsheetProcessing(testapp, data, project, institution, TEST_INGESTION_ID1,
                                    submission_type='pedigree')
        assert obj.passing == success_bool
        assert (len(obj.errors) == 0) == success_bool
        assert ('Column headers not detected in spreadsheet!' in ''.join(obj.errors)) == (not success_bool)

    def test_create_row_dict_pedigree(self, testapp, xls_list_pedigree, project, institution):
        """tests that dictionary of colname: field value is created for each row"""
        obj = SpreadsheetProcessing(testapp, iter(xls_list_pedigree), project, institution,
                                    TEST_INGESTION_ID1, submission_type='pedigree')
        assert obj.keys
        assert len(obj.rows) == 8
        for row in obj.rows:
            assert all(key in row for key in obj.keys)

    @pytest.mark.parametrize('col, success_bool', [
        ('Sex', False),  # required column
        ('Family ID:', False),  # required column
        ('HPO terms', True)  # not required
    ])
    def test_create_row_dict_pedigree_missing_col(self, testapp, xls_list_pedigree,
                                                  project, institution, col, success_bool):
        """tests that correct error is returned when a required column header is not in spreadsheet"""
        idx = xls_list_pedigree[0].index(col)
        rows = (row[0:idx] + row[idx+1:] for row in xls_list_pedigree)
        obj = SpreadsheetProcessing(testapp, rows, project, institution, TEST_INGESTION_ID1,
                                    submission_type='pedigree')
        assert obj.passing == success_bool
        if not success_bool:
            assert 'Column(s) "{}" not found in spreadsheet!'.format(col.lower().strip(':')) in ''.join(obj.errors)


def test_xls_to_json_accessioning(testapp, project, institution):
    """tests that xls_to_json returns expected output when a spreadsheet is formatted correctly"""
    rows = digest_xls('src/encoded/tests/data/documents/cgap_submit_test.xlsx')
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'accessioning')
    assert success
    assert len(json_out['family']) == 1
    assert 'encode-project:family-456' in json_out['family']
    assert len(json_out['individual']) == 3
    assert all(['encode-project:individual-' + x in json_out['individual'] for x in ['123', '456', '789']])

def test_xls_to_json_pedigree(testapp, project, institution):
    """tests that xls_to_json returns expected output when a spreadsheet is formatted correctly"""
    rows = digest_xls('src/encoded/tests/data/documents/pedigree_test_example.xlsx')
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'pedigree')
    assert success
    assert len(json_out['family']) == 1
    assert 'encode-project:family-IND201' in json_out['family']
    assert len(json_out['individual']) == 8
    assert all(['encode-project:individual-' + x in json_out['individual'] for x in [
        'IND201', 'IND202', 'IND203', 'IND204', 'IND205', 'IND206', 'IND207', 'IND208'
    ]])


def test_xls_to_json_accessioning_errors(testapp, project, institution):
    """tests for expected output when spreadsheet is not formatted correctly"""
    rows = digest_xls('src/encoded/tests/data/documents/cgap_submit_test_with_errors.xlsx')
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'accessioning')
    assert 'Row 4' in ''.join(json_out['errors'])  # row counting info correct
    assert success  # still able to proceed to validation step


def test_xls_to_json_pedigree_errors(testapp, project, institution):
    """tests for expected output when spreadsheet is not formatted correctly"""
    rows = digest_xls('src/encoded/tests/data/documents/pedigree_test_example_errors.xlsx')
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'pedigree')
    assert 'Row 5 - term HP:00000821 does not match the format' in ''.join(json_out['errors'])
    assert 'Row 9 - missing required field(s) family id.' in ''.join(json_out['errors'])
    assert success


def test_xls_to_json_invalid_workup(testapp, project, institution, xls_list):
    """
    tests that an invalid workup type is caught as an error -
    tested via xls_to_json to ensure that errors generated in child objects are passed
    all the way up to parent function that calls them
    """
    idx = xls_list[1].index('Workup Type')
    xls_list[4] = xls_list[4][0:idx] + ['Other'] + xls_list[4][idx+1:]
    rows = iter(xls_list)
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'accessioning')
    assert json_out['errors']
    assert success
    assert ('Row 5 - Samples with analysis ID 55432 contain mis-matched '
            'or invalid workup type values.') in ''.join(json_out['errors'])

# def test_xls_to_json_errors_pedigree(testapp, project, institution):
#     """tests for expected output when spreadsheet is not formatted correctly"""
#     rows = digest_xls('src/encoded/tests/data/documents/pedigree_test_example_errors.xlsx')
#     json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'pedigree')
#     assert 'Row 4' in ''.join(json_out['errors'])  # row counting info correct
#     assert success  # still able to proceed to validation step

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
    """tests that compare_fields returns None when json item has no new info compared to db item"""
    profile = testapp.get('/profiles/family.json').json
    result = compare_fields(profile, [], new_family, fam)
    assert not result


def test_compare_fields_same_seo(testapp, file_fastq, file_fastq2, project, institution):
    """tests that sub-embedded objects that are the same are recognized as the same in compare_fields"""
    db_relation = {'related_files': [{'relationship_type': 'paired with', 'file': file_fastq2['@id']}]}
    [file1] = testapp.patch_json(file_fastq['@id'], db_relation).json['@graph']
    profile = testapp.get('/profiles/file_fastq.json').json
    json_data = {
        'file_format': '/file-formats/fastq/',
        'institution': institution['@id'],
        'project': project['@id'],
        'status': 'uploaded',
        'related_files': [{'relationship_type': 'paired with', 'file': 'test-project:file2'}]
    }
    result = compare_fields(profile, {'test-project:file2': file_fastq2['@id']}, json_data, file1)
    assert not result


def test_compare_fields_different(testapp, aunt, fam, new_family):
    """tests that compare_fields finds differences between json item and db item  when present"""
    new_family['members'].append(aunt['@id'])
    new_family['title'] = 'Smythe family'
    profile = testapp.get('/profiles/family.json').json
    result = compare_fields(profile, [], new_family, fam)
    assert len(result) == 2
    assert 'title' in result
    assert len(result['members']) == len(fam['members']) + 1


def test_compare_fields_array_of_string(testapp, case_with_ingestion_id1, case_with_ingestion_id2):
    """
    tests that compare_fields finds differences between json item and db item when present -
    in this case checks that when the 2 items have a different array, the db array gets extended
    rather than replaced
    """
    profile = testapp.get('/profiles/case.json').json
    result = compare_fields(profile, [], case_with_ingestion_id2, case_with_ingestion_id1)
    assert 'ingestion_ids' in result
    assert len(result['ingestion_ids']) == 2


def test_validate_item_post_valid(testapp, a_case):
    """tests that no errors are returned when item passes validation"""
    result = validate_item(testapp, a_case, 'post', 'case', [])
    assert not result


def test_validate_item_post_invalid(testapp, a_case):
    """tests for expected error when item fails validation"""
    a_case['project'] = '/projects/invalid-project/'
    result = validate_item(testapp, a_case, 'post', 'case', [])
    assert 'not found' in result[0]


def test_validate_item_post_invalid_yn(testapp, sample_info, project, institution):
    """
    tests expected error message is generated for fields in which
    spreadsheet value is expected to have a Y/N value but doesn't
    """
    sample_info['req accepted y/n'] = 'not sure'
    sample_info['specimen accepted by ref lab'] = "I don't know"
    sample_item = map_fields(sample_info, {}, ['workup_type'], 'sample')
    req_info = map_fields(sample_info, {}, ['date sent', 'date completed'], 'requisition')
    sample_item['requisition_acceptance'] = req_info
    sample_item['project'] = project['@id']
    sample_item['institution'] = institution['@id']
    result = validate_item(testapp, sample_item, 'post', 'sample', [])
    assert len(result) == 2
    assert all("is not one of ['Y', 'N']" in error for error in result)


def test_validate_item_patch_valid(testapp, mother, grandpa):
    """tests that patch info passes validation when expected and generates no errors"""
    patch_dict = {'mother': mother['aliases'][0]}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', [], atid=grandpa['@id'])
    assert not result


def test_validate_item_patch_invalid(testapp, grandpa):
    """tests that patch info fails validation when expected and generates error"""
    patch_dict = {'mother': 'non-existant-alias'}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', [], atid=grandpa['@id'])
    assert 'not found' in result[0]


def test_validate_item_patch_alias(testapp, grandpa):
    """tests that linkTo passes validation if item linked hasn't been posted yet"""
    patch_dict = {'mother': 'existing-alias'}
    result = validate_item(testapp, patch_dict, 'patch', 'individual', ['existing-alias'], atid=grandpa['@id'])
    assert not result


def test_validate_all_items_errors(testapp, mother, empty_items):
    """tests that validation error messages get passed up to parent validate_all_items function result"""
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


def test_post_and_patch_all_items(testapp, post_data):
    output, success, file_info = post_and_patch_all_items(testapp, post_data)
    assert success
    for itemtype in post_data['post']:
        assert f'{itemtype}: 1 item created (with POST); 0 items failed creation' in output
        if post_data['patch'].get(itemtype):
            assert f'{itemtype}: attributes of 1 item updated (with PATCH); 0 items failed updating' in output

def test_post_and_patch_all_items_error(testapp, post_data):
    """
    additional property introduced into 'family' item json  -
    designed to test appropriate error message produced in 'output' when item fails to post
    """
    post_data['post']['family'][0]['extra_field'] = 'extra field value'
    output, success, file_info = post_and_patch_all_items(testapp, post_data)
    assert not success
    assert 'family: 0 items created (with POST); 1 item failed creation' in output
