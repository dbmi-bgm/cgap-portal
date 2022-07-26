import copy
from unittest import mock

import openpyxl
import pytest

from ..submit import (
    HPO_TERM_ID_PATTERN,
    MONDO_TERM_ID_PATTERN,
    compare_fields,
    digest_xlsx,
    format_ontology_term_with_colon,
    AccessionRow,
    AccessionMetadata,
    SubmittedFilesParser,
    PedigreeRow,
    PedigreeMetadata,
    SpreadsheetProcessing,
    AccessionProcessing,
    PedigreeProcessing,
    MetadataItem,
    map_fields,
    parse_exception,
    post_and_patch_all_items,
    row_generator,
    validate_all_items,
    validate_item,
    xls_to_json
)


TEST_INGESTION_ID1 = '123456-1243-1234-123456abcdef'
TEST_INGESTION_ID2 = 'abcdef-1234-1234-abcdef123456'
WORKBOOK_FAMILY_ID1 = '/families/GAPFA59JKS1Y/'
WORKBOOK_FAMILY_ID2 = '/families/GAPFAYUV203P/'
WORKBOOK_FAMILY_ID3 = '/families/GAPFAZ3V21Q8/'

TEST_WORKBOOK = 'src/encoded/tests/data/documents/cgap_submit_test.xlsx'
TEST_WORKBOOK_WITH_ERRORS = 'src/encoded/tests/data/documents/cgap_submit_test_with_errors.xlsx'
TEST_WORKBOOK_PEDIGREE = 'src/encoded/tests/data/documents/pedigree_test_example.xlsx'
TEST_PEDIGREE_WITH_ERRORS = 'src/encoded/tests/data/documents/pedigree_test_example_errors.xlsx'

PROJECT_NAME = "hms-dbmi"  # Project name of wb_project fixture
GENOME_BUILD = "GRCh38"
FILE_NAME_NOT_ACCEPTED = "foo_bar.foo.bar"
VCF_FILE_NAME = "foo_bar.vcf.gz"
VCF_FILE_PATH = "/path/to/" + VCF_FILE_NAME
VCF_FILE_ALIAS = "%s:%s" % (PROJECT_NAME, VCF_FILE_NAME)
VCF_FILE_ITEM = {
    "aliases": [VCF_FILE_ALIAS],
    "file_format": "/file-formats/vcf_gz/",
    "filename": VCF_FILE_PATH,
}
VCF_FILE_ITEM_WITH_GENOME_BUILD = copy.copy(VCF_FILE_ITEM)
VCF_FILE_ITEM_WITH_GENOME_BUILD.update({"genome_assembly": GENOME_BUILD})
VCF_ALIAS_TO_FILE_ITEM = {VCF_FILE_ALIAS: VCF_FILE_ITEM}
VCF_ALIAS_TO_FILE_ITEM_GENOME_BUILD = {VCF_FILE_ALIAS: VCF_FILE_ITEM_WITH_GENOME_BUILD}
VCF_EXTRA_FILE_1 = "foo_bar.vcf.gz.tbi"
VCF_EXTRA_FILE_2 = "foo_bar.vcf.gz.tbj"
VCF_GZ_TBI_FILE_FORMAT = "/file-formats/vcf_gz_tbi/"
VCF_FILE_ITEM_WITH_EXTRA_FILE_1 = copy.copy(VCF_FILE_ITEM)
VCF_FILE_ITEM_WITH_EXTRA_FILE_1.update(
    {
        "extra_files": [
            {"filename": VCF_EXTRA_FILE_1, "file_format": VCF_GZ_TBI_FILE_FORMAT},
        ]
    }
)
VCF_FILE_ITEM_WITH_EXTRA_FILE_2 = copy.copy(VCF_FILE_ITEM)
VCF_FILE_ITEM_WITH_EXTRA_FILE_2.update(
    {
        "extra_files": [
            {"filename": VCF_EXTRA_FILE_2, "file_format": VCF_GZ_TBI_FILE_FORMAT},
        ]
    }
)
FASTQ_FILE_NAME_1_R1 = "file_1_R1.fastq.gz"
FASTQ_FILE_NAME_1_R2 = "file_1_R2.fastq.gz"
FASTQ_FILE_NAME_UNMATCHED = "file_2_R1.fastq.gz"
FASTQ_FILE_NAME_BAD_FORMAT = "file_2.fastq.gz"
FASTQ_FILE_NAME_1_R1_ALIAS = "%s:%s" % (PROJECT_NAME, FASTQ_FILE_NAME_1_R1)
FASTQ_FILE_NAME_1_R2_ALIAS = "%s:%s" % (PROJECT_NAME, FASTQ_FILE_NAME_1_R2)
FASTQ_FILE_NAME_UNMATCHED_ALIAS = "%s:%s" % (PROJECT_NAME, FASTQ_FILE_NAME_UNMATCHED)
FASTQ_FILE_NAME_BAD_FORMAT_ALIAS = "%s:%s" % (PROJECT_NAME, FASTQ_FILE_NAME_BAD_FORMAT)
FASTQ_FILE_NAMES_NO_ERRORS = ", ".join([FASTQ_FILE_NAME_1_R1, FASTQ_FILE_NAME_1_R2])
FASTQ_FILE_NAMES_ERRORS = ", ".join(
    [FASTQ_FILE_NAME_1_R1, FASTQ_FILE_NAME_1_R2, FASTQ_FILE_NAME_UNMATCHED,
        FASTQ_FILE_NAME_BAD_FORMAT]
)
FILE_FORMAT_FASTQ = "/file-formats/fastq/"
FASTQ_FILE_ITEMS_NO_ERRORS = [
    {
        "aliases": [FASTQ_FILE_NAME_1_R1_ALIAS],
        "file_format": FILE_FORMAT_FASTQ,
        "filename": FASTQ_FILE_NAME_1_R1,
        "related_files": [
            {"relationship_type": "paired with", "file": FASTQ_FILE_NAME_1_R2_ALIAS},
        ],
    },
    {
        "aliases": [FASTQ_FILE_NAME_1_R2_ALIAS],
        "file_format": FILE_FORMAT_FASTQ,
        "filename": FASTQ_FILE_NAME_1_R2,
    },
]
FASTQ_ALIASES_NO_ERRORS = [FASTQ_FILE_NAME_1_R1_ALIAS, FASTQ_FILE_NAME_1_R2_ALIAS]
FASTQ_FILE_ITEMS_ERRORS = FASTQ_FILE_ITEMS_NO_ERRORS + [
    {
        "aliases": [FASTQ_FILE_NAME_UNMATCHED_ALIAS],
        "file_format": FILE_FORMAT_FASTQ,
        "filename": FASTQ_FILE_NAME_UNMATCHED,
    },
    {
        "aliases": [FASTQ_FILE_NAME_BAD_FORMAT_ALIAS],
        "file_format": FILE_FORMAT_FASTQ,
        "filename": FASTQ_FILE_NAME_BAD_FORMAT,
    },
]
FASTQ_ALIASES_ERRORS = FASTQ_ALIASES_NO_ERRORS + [
    FASTQ_FILE_NAME_UNMATCHED_ALIAS, FASTQ_FILE_NAME_BAD_FORMAT_ALIAS
]
FASTQ_ALIAS_TO_FILE_ITEMS_NO_ERRORS = {
    item["aliases"][0]: item for item in FASTQ_FILE_ITEMS_NO_ERRORS
}
FASTQ_ALIAS_TO_FILE_ITEMS_ERRORS = {
    item["aliases"][0]: item for item in FASTQ_FILE_ITEMS_ERRORS
}
VCF_FASTQ_ALIAS_TO_FILE_ITEMS_NO_ERRORS = copy.copy(VCF_ALIAS_TO_FILE_ITEM)
VCF_FASTQ_ALIAS_TO_FILE_ITEMS_NO_ERRORS.update(FASTQ_ALIAS_TO_FILE_ITEMS_NO_ERRORS)
PROBAND_BAM_SAMPLE_ID = "3464467-WGS-2"
UNCLE_BAM_SAMPLE_ID = "3464460-WGS-1"


def make_file_format_properties(
    file_format, standard_file_extension, other_allowed_extensions=None,
    extra_file_formats=None,
):
    """Make FileFormat properties for testing."""
    properties = {
        "@id": f"/file-formats/{file_format}/",
        "file_format": file_format,
        "standard_file_extension": standard_file_extension,
    }
    if other_allowed_extensions:
        if isinstance(other_allowed_extensions, str):
            other_allowed_extensions = [other_allowed_extensions]
        properties["other_allowed_extensions"] = other_allowed_extensions
    if extra_file_formats:
        if isinstance(extra_file_formats, str):
            extra_file_formats = [extra_file_formats]
        extra_file_format_atids = []
        for extra_file_format in extra_file_formats:
            at_id = f"/file-formats/{extra_file_format}/"
            extra_file_format_atids.append(
                {"@id": at_id}
            )
        properties["extra_file_formats"] = extra_file_format_atids
    return properties


FASTQ_FILE_FORMAT = make_file_format_properties(
    "fastq", "fastq.gz", other_allowed_extensions=".fq"
)
BAM_FILE_FORMAT = make_file_format_properties(
    "bam", "bam", extra_file_formats=["bai", "fai"])
BAI_FILE_FORMAT = make_file_format_properties("bai", "bai")
FAI_FILE_FORMAT = make_file_format_properties(
    "fai", "fai", other_allowed_extensions=["fam", "fan"]
)
FILE_FORMATS = [FASTQ_FILE_FORMAT, BAM_FILE_FORMAT]
EXTRA_FILE_FORMATS = [BAI_FILE_FORMAT, FAI_FILE_FORMAT]
FILE_FORMAT_ATIDS_TO_ITEMS = {
    item["@id"]: item for item in FILE_FORMATS
}
EXTRA_FILE_FORMAT_ATIDS_TO_ITEMS = {
    item["@id"]: item for item in EXTRA_FILE_FORMATS
}
PRIMARY_TO_EXTRA_FILE_FORMATS = {
    item["@id"]: [
        extra_file_format["@id"] for extra_file_format in item.get("extra_file_formats")
    ]
    for item in FILE_FORMATS if item.get("extra_file_formats")
}
FILES_TO_CHECK_EXTRA_FILES = {
    "foo.bar": ([FAI_FILE_FORMAT["@id"]], "bar"),
    "some_bam.bam": ([BAI_FILE_FORMAT["@id"], FAI_FILE_FORMAT["@id"]], "bam"),
}
FILE_NAMES_TO_ITEMS = {
    "foo.bar": {"filename": "foo.bar"},
    "some_bam.bam": {"filename": "some_bam.bam"},
    "some_bam.fan": {"filename": "some_bam.fan"},
}
FILES_WITHOUT_FILE_FORMAT = {
    "foo.fai": "foo.fai",
    "foo.fan": "foo.fan",
    "some_bam.bai": "some_bam.bai",
}
EXPECTED_FILE_NAMES_TO_ITEMS = {
    "foo.bar": {
        "filename": "foo.bar",
        "extra_files": [
            {"filename": "foo.fai", "file_format": FAI_FILE_FORMAT["@id"]},
        ]
    },
    "some_bam.bam": {
        "filename": "some_bam.bam",
        "extra_files": [
            {"filename": "some_bam.bai", "file_format": BAI_FILE_FORMAT["@id"]},
            {"filename": "some_bam.fan", "file_format": FAI_FILE_FORMAT["@id"]},
        ],
    },
}
EXPECTED_FILES_WITHOUT_FILE_FORMAT = {"foo.fan": "foo.fan"}


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
        'specimen type': 'Peripheral_Blood',
        'test requested': 'WGS',
        'test number': '2'
    }


@pytest.fixture
def row_dict_uncle():
    return {
        'individual id': '455',
        'family id': '333',
        'sex': 'M',
        'relation to proband': 'uncle',
        'analysis id': '999',
        'report required': 'N',
        'specimen id': '3464460',
        'specimen type': 'Peripheral_Blood',
        'test requested': 'WGS',
        'test number': '1'
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
        'no children by choice': 'Y',
        "primary diagnosis": "MONDO:0000111",
        "diagnosis age of onset": "100",
        "diagnostic confidence": "Definite",
    }


@pytest.fixture
def xls_list():
    book = openpyxl.load_workbook(TEST_WORKBOOK)
    sheet = book.worksheets[0]
    rows = row_generator(sheet)
    return list(rows)


@pytest.fixture
def xls_list_pedigree():
    book = openpyxl.load_workbook(TEST_WORKBOOK_PEDIGREE)
    sheet = book.worksheets[0]
    rows = row_generator(sheet)
    return list(rows)


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
                'bam_sample_id': 'samp1-WGS',
                'workup_type': 'WGS',
                'specimen_accession': 'samp1',
                "files": [
                    "test-proj:file_name_R1.fastq.gz",
                    "test-proj:file_name_R2.fastq.gz",
                ],
                'project': project['@id'],
                'institution': institution['@id']
            }],
            "sample_processing": [
                {
                    "project": project["@id"],
                    "institution": institution["@id"],
                    "aliases": ["test-proj:sample-processing-1"],
                    "samples": ["test-proj:samp1"],
                    "families": ["test-proj:fam1"],
                    "files": ["test-proj:file_name.vcf.gz"],
                },
            ],
            "file_submitted": [
                {
                    "project": project["@id"],
                    "institution": institution["@id"],
                    "aliases": ["test-proj:file_name_R1.fastq.gz"],
                    "file_format": "fastq",
                    "related_files": [
                        {
                            "file": "test-proj:file_name_R1.fastq.gz",
                            "relationship_type": "paired with",
                        },
                    ],
                },
                {
                    "project": project["@id"],
                    "institution": institution["@id"],
                    "aliases": ["test-proj:file_name_R2.fastq.gz"],
                    "file_format": "fastq",
                },
                {
                    "project": project["@id"],
                    "institution": institution["@id"],
                    "aliases": ["test-proj:file_name.vcf.gz"],
                    "file_format": "vcf_gz",
                },
            ]
        },
        'patch': {},
        'aliases': {}
    }


@pytest.fixture
def sample_info():
    return {
        'test requested': 'WES',
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
def example_rows_with_test_number(example_rows):
    example_rows[0]['test number'] = '1'
    example_rows[3]['test number'] = '2'
    return example_rows


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
def example_rows_obj(testapp, example_rows, project, institution):
    return AccessionMetadata(testapp, example_rows, project, institution, TEST_INGESTION_ID1)


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


@pytest.fixture
def pedigree_row(row_dict_pedigree, project, institution):
    """A PedigreeRow without errors."""
    result = PedigreeRow(row_dict_pedigree, 1, project["name"], institution["name"])
    assert not result.errors
    return result


@pytest.fixture
def accession_row(row_dict, testapp, project, institution):
    """An AccessionRow without errors."""
    result = AccessionRow(
        testapp, row_dict, 1, "test-proj:fam1", project["name"], institution["name"]
    )
    assert not result.errors
    return result


@pytest.fixture
def file_parser(testapp):
    """A SubmittedFilesParser without errors and without ES."""
    result = SubmittedFilesParser(testapp, "some_project_name")
    assert not result.errors
    return result


@pytest.fixture
def file_parser_with_search(es_testapp, wb_project):
    """A SubmittedFilesParser without errors and with ES."""
    result = SubmittedFilesParser(es_testapp, wb_project["name"])
    assert not result.errors
    return result


@pytest.fixture
def accession_row_with_file_parser_and_search(
    es_testapp, file_parser_with_search, wb_project, wb_institution
):
    """An AccessionRow without errors and with a file parser with
    search.

    Useful for testing integration of file parsing with row parsing.
    """
    result = AccessionRow(
        es_testapp, row_dict, 1, "test-proj:fam1", wb_project["name"], wb_institution["name"],
        file_parser=file_parser_with_search
    )
    assert not result.errors
    return result


def test_hp_term_id_pattern():
    assert HPO_TERM_ID_PATTERN.match("HP:1234567")
    assert not HPO_TERM_ID_PATTERN.match("HP_1234567")
    assert not HPO_TERM_ID_PATTERN.match("HP:12345678")
    assert not HPO_TERM_ID_PATTERN.match("HP:123456X")
    assert not HPO_TERM_ID_PATTERN.match("HPO:1234567")


def test_mondo_term_id_pattern():
    assert MONDO_TERM_ID_PATTERN.match("MONDO:1234567")
    assert not MONDO_TERM_ID_PATTERN.match("MONDO_1234567")
    assert not MONDO_TERM_ID_PATTERN.match("MONDO:12345678")
    assert not MONDO_TERM_ID_PATTERN.match("MONDO:123456X")
    assert not MONDO_TERM_ID_PATTERN.match("MO:1234567")


def test_map_fields(sample_info):
    # tests spreadsheet fields are mapped to correct cgap property
    result = map_fields(sample_info, {}, [], 'sample')
    assert result['workup_type'] == 'WES'
    assert result['specimen_accession'] == '9034'
    assert result['specimen_collection_date'] == '2020-01-06'
    assert not result.get('sequencing_lab')


@pytest.mark.parametrize('term, result', [
    ('hp_12345', 'HP:12345'),
    ('mOndO_765432', 'MONDO:765432'),
    ('mondo:123', 'MONDO:123'),
    ('hpo12345', 'HPO12345')
])
def test_format_ontology_term_with_colon(term, result):
    assert format_ontology_term_with_colon(term) == result


class TestAccessionRow:

    @pytest.mark.parametrize('col, val, sample_alias', [
        (None, None, 'encode-project:sample-3464467-WGS-2'),
        ('test requested', 'WES', 'encode-project:sample-3464467-WES-2'),
        ('test number', '1', 'encode-project:sample-3464467-WGS-1'),
        ('test number', None, 'encode-project:sample-3464467-WGS')
    ])
    def test_row_sample_aliases(self, testapp, row_dict, col, val, sample_alias, project, institution):
        if col:
            row_dict[col] = val
        obj = AccessionRow(testapp, row_dict, 1, 'test-proj:fam', project['name'], institution['name'])
        assert obj.sample_alias == sample_alias

    def test_extract_individual_metadata(self, testapp, row_dict, project, institution):
        obj = AccessionRow(testapp, row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert obj.indiv_alias == 'encode-project:individual-456'
        assert obj.individual.metadata['aliases'] == [obj.indiv_alias]
        assert obj.individual.metadata['individual_id'] == row_dict['individual id']

    @pytest.mark.parametrize('age, birth_year, val_type', [
        ('33', '1986', int),
        ('abc', 'def', str)
    ])
    def test_extract_individual_metadata_nums(self, testapp, row_dict, age, birth_year, val_type, project, institution):
        """
        numerical values for age and birth year are expected
        text values for age and birth year should be passed on without errors to eventually fail validation
        """
        row_dict['age'] = age
        row_dict['birth year'] = birth_year
        obj = AccessionRow(testapp, row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert isinstance(obj.individual.metadata['age'], val_type)
        assert not obj.errors

    @pytest.mark.parametrize('relation, error', [
        ('proband', False),
        ('grandmother', True)
    ])
    def test_extract_family_metadata_new(self, testapp, row_dict, project, institution, relation, error):
        """
        Currently without pedigree processing, can only parse proband/mother/father/sibling relationships.
        Other relationships like 'grandmother' should result in an error message, but in the future may
        be permitted with a pedigree file.
        """
        row_dict['relation to proband'] = relation
        obj = AccessionRow(testapp, row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert obj.family.alias == 'test-proj:fam1'
        assert obj.family.metadata['members'] == ['encode-project:individual-456']
        if relation == 'proband':
            assert obj.family.metadata['proband'] == 'encode-project:individual-456'
        assert not obj.errors == (not error)  # check presence of errors
        # check for correct error message
        assert ('Row 1 - Invalid relation' in ''.join(obj.errors)) == error

    def test_extract_family_metadata_extended_fail(self, testapp, row_dict_uncle,
                                                   project, institution):
        """
        Currently without pedigree processing, can only parse proband/mother/father/sibling
        relationships without pedigree file (but may pass if pedigree file has already been
        uploaded with the relevant individual). This tests that a relationship like "uncle"
        fails if pedigree hasn't been submitted first.
        """
        obj = AccessionRow(testapp, row_dict_uncle, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert obj.family.alias == 'test-proj:fam1'
        assert obj.family.metadata['members'] == ['encode-project:individual-455']
        assert len(obj.errors) > 0  # check presence of errors
        # check for correct error message
        assert 'Row 1 - Invalid relation' in ''.join(obj.errors)
        assert 'please submit family history first' in ''.join(obj.errors)

    @pytest.mark.workbook
    def test_extract_family_metadata_extended_pass(self, workbook, es_testapp, row_dict_uncle):
        """
        Currently without pedigree processing, can only parse proband/mother/father/sibling
        relationships without pedigree file (but may pass if pedigree file has already been
        uploaded with the relevant individual). This tests that a relationship like "uncle"
        passes if pedigree has been submitted first.
        """
        obj = AccessionRow(es_testapp, row_dict_uncle, 1, 'hms-dbmi:family-456', 'hms-dbmi', 'hms-dbmi')
        assert obj.family.metadata['members'] == ['hms-dbmi:individual-455']
        assert not obj.errors

    def test_extract_sample_metadata(self, testapp, row_dict, project, institution):
        """
        Some fields are formatted differently in spreadsheets vs in DB -
        ex.
        'Yes' --> 'Accepted' / 'No' --> 'Rejected' for requisition accepted field
        'Y' --> 'Yes' / 'N' --> 'No' for specimen accepted field
        """
        row_dict['req accepted y/n'] = 'Yes'
        row_dict['specimen accepted by ref lab'] = "n"
        obj = AccessionRow(testapp, row_dict, 1, 'test-proj:fam1', project['name'], institution['name'])
        assert obj.sample.metadata['specimen_accession'] == row_dict['specimen id']
        assert obj.sample.metadata['specimen_accepted'] == 'No'
        assert obj.sample.metadata['specimen_type'] == 'peripheral blood'
        assert obj.sample.metadata['requisition_acceptance']['accepted_rejected'] == 'Accepted'
        assert obj.analysis.metadata['samples'] == [obj.sample.alias]
        assert obj.individual.metadata['samples'] == [obj.sample.alias]

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
    def test_found_missing_values(self, testapp, row_dict, project, institution, field, error):
        """some columns are required for spreadsheet submission, others are optional."""
        row_dict[field] = None
        obj = AccessionRow(testapp, row_dict, 1, 'fam1', project['name'], institution['name'])
        assert (len(obj.errors) > 0) == error
        assert ('Row 1 - missing required field(s) {}. This row cannot be processed.'
                ''.format(field) in obj.errors) == error

    @pytest.mark.parametrize(
        "sample,expected_calls",
        [
            ({}, 0),
            ({"genome_build": None, "files": None, "case_files": None}, 0),
            ({"genome_build": "", "files": "", "case_files": ""}, 0),
            ({"genome_build": "foo", "files": "", "case_files": ""}, 0),
            ({"genome_build": "foo", "files": "bar.vcf.gz", "case_files": ""}, 1),
            ({"genome_build": "foo", "files": "bar.vcf.gz", "case_files": "bar.vcf.gz"}, 2),
        ]
    )
    def test_process_and_add_file_metadata(self, accession_row, sample, expected_calls):
        """Test spreadsheet fields removed from Sample and
        Sample/SampleProcessing updated based on fields present.
        """
        sample_processing = {}
        expected_dropped_keys = ["genome_build", "files", "case_files"]
        with mock.patch(
            "encoded.submit.AccessionRow.update_item_files"
        ) as mocked_update_item_files:
            accession_row.process_and_add_file_metadata(sample, sample_processing)
            for key in expected_dropped_keys:
                assert key not in sample
            assert len(mocked_update_item_files.call_args_list) == expected_calls

    @pytest.mark.parametrize(
        "file_items,file_aliases,file_errors",
        [
            ([], [], []),
            ([{"foo": "bar"}], ["some_alias"], ["some_error"]),
        ]
    )
    def test_update_item_files(
        self, accession_row, file_items, file_aliases, file_errors
    ):
        """Test output of file parsing handled appropriately: aliases
        added to items, errors reported, and files added.
        """
        item = {}
        with mock.patch.object(accession_row, "file_parser") as mocked_file_parser:
            mocked_file_parser.extract_file_metadata.return_value = (
                file_items, file_aliases, file_errors
            )
            accession_row.update_item_files(item, "some_file_names", None)
            assert len(accession_row.files) == len(file_items)
            for index, file_item in enumerate(accession_row.files):
                assert isinstance(file_item, MetadataItem)
                assert file_item.metadata == file_items[index]
            if file_aliases:
                assert item["files"] == file_aliases
            else:
                assert "files" not in item
            assert accession_row.errors == file_errors

    @pytest.mark.parametrize(
        "genome_build,expected_errors,expected",
        [
            (None, 0, None),
            ("", 0, None),
            ("foo", 1, None),
            ("GRCh37", 0, "GRCh37"),
            ("grch37", 0, "GRCh37"),
            ("hg19", 0, "hg19"),
            ("19", 0, "hg19"),
            ("GRCh38", 0, "GRCh38"),
            ("hg38", 0, "GRCh38"),
            ("38", 0, "GRCh38"),
        ],
    )
    def test_validate_genome_build(
        self, accession_row, genome_build, expected_errors, expected
    ):
        """Test submitted genome build converted to appropriate value
        if valid.
        """
        result = accession_row.validate_genome_build(genome_build)
        assert result == expected
        assert len(accession_row.errors) == expected_errors


class TestAccessionMetadata:

    def test_init_families(self, example_rows_obj, project):
        """test family aliases are named after proband individual ids"""
        proj_name = project['name'] + ':'
        fams = example_rows_obj.family_dict
        assert sorted(list(fams.keys())) == ['1111', '2222', '3333', '4444']
        assert fams['1111'] == proj_name + 'family-456'
        assert fams['2222'] == proj_name + 'family-456'
        assert fams['3333'] == proj_name + 'family-555'

    def test_get_analysis_types(self, testapp, example_rows_obj, example_rows, project, institution):
        """analysis type should be none if workup types in samples don't match"""
        a_types = example_rows_obj.analysis_types
        assert a_types['1111'] == 'WGS-Trio'
        assert a_types['2222'] == 'WGS'
        assert a_types['3333'] == 'WES-Group'
        example_rows[1]['test requested'] = 'WES'
        new_obj = AccessionMetadata(testapp, example_rows, project, institution, TEST_INGESTION_ID1)
        new_a_types = new_obj.analysis_types
        assert new_a_types['1111'] is None

    def test_add_metadata_single_item(self, testapp, example_rows, project, institution):
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
        submission = AccessionMetadata(testapp, data, project, institution, TEST_INGESTION_ID1)
        assert len(submission.individuals) == 2
        assert len(submission.samples) == 2
        assert 'specimen_accepted' in list(submission.samples.values())[1]

    def test_add_metadata_single_item_same_sample_accession(self, testapp, example_rows_with_test_number,
                                                            project, institution):
        """
        if samples have the same specimen_accession but different test number, the bam_sample_id
        should be unique but the specimen_accession should stay the same.
        """
        submission = AccessionMetadata(testapp, example_rows_with_test_number,
                                        project, institution, TEST_INGESTION_ID1)
        accession1 = [item for item in submission.samples.values() if item['specimen_accession'] == '1']
        assert accession1[0]['specimen_accession'] == accession1[1]['specimen_accession']
        assert accession1[0]['bam_sample_id'] != accession1[1]['bam_sample_id']

    @pytest.mark.parametrize('last_relation, error', [
        ('brother', False),  # not a duplicate relation
        ('mother', True),  # error if two members of family have same parental relation
        ('sister', False)  # two siblings can have same relation
    ])
    def test_add_family_metadata(self, testapp, big_family_rows, project, institution, last_relation, error):
        """
        tests handling of duplicate relations for parents vs siblings.
        before modification, fixture contains proband, mother, father, sister.
        """
        big_family_rows[4]['relation to proband'] = last_relation
        submission = AccessionMetadata(testapp, big_family_rows, project, institution, TEST_INGESTION_ID1)
        assert len(submission.families) == 1
        fam = list(submission.families.values())[0]
        assert len(fam['members']) == 5
        assert (len(submission.errors) > 0) == error
        assert ('Multiple values for relation' in ''.join(submission.errors)) == error

    def test_add_sample_processing(self, testapp, example_rows, project, institution):
        """tests metadata creation for sample_processing item from a set of rows"""
        example_rows[6]['test requested'] = 'WGS'  # analysis 3333 will have mismatched workup type values
        submission = AccessionMetadata(testapp, example_rows, project, institution, TEST_INGESTION_ID1)
        sps = submission.sample_processings
        assert sps['encode-project:analysis-1111']['analysis_type'] == 'WGS-Trio'
        assert sps['encode-project:analysis-2222']['analysis_type'] == 'WGS'
        assert sps['encode-project:analysis-1111']['samples'] == [
            'encode-project:sample-1-WGS', 'encode-project:sample-2-WGS', 'encode-project:sample-3-WGS'
        ]
        assert sps['encode-project:analysis-2222']['samples'] == ['encode-project:sample-1-WGS']
        assert not sps['encode-project:analysis-3333']['analysis_type']
        assert '3333 contain mis-matched or invalid workup type values' in ''.join(submission.errors)

    @pytest.mark.parametrize('case_id, report', [(None, True), ('Case123', True), ('Case123', False)])
    def test_create_case_metadata(self, testapp, row_dict, case_id, report, project, institution):
        """tests case and report item creation after all rows processed"""
        if not report:
            row_dict['report required'] = 'N'
        row_dict['unique analysis id'] = case_id
        submission = AccessionMetadata(testapp, [row_dict], project, institution, TEST_INGESTION_ID1)
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
    def test_add_case_info(self, testapp, row_dict, case_id, project, institution):
        """tests that case ID from row gets added to proper dictionary attribute"""
        row_dict['unique analysis id'] = case_id
        submission = AccessionMetadata(testapp, [row_dict], project, institution, TEST_INGESTION_ID1)
        key = '{}-{}'.format(row_dict['analysis id'], row_dict['specimen id'])
        assert submission.case_info.get(key)['case id'] == case_id

    def test_add_individual_relations(self, testapp, big_family_rows, project, institution):
        """
        tests that correct proband mother and father get added to individual item metadata
        after all rows are processed
        """
        obj = AccessionMetadata(testapp, big_family_rows, project, institution, TEST_INGESTION_ID1)
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
                    assert all(val3 for val3 in val2.values())  # test all None values are removed

    @pytest.mark.workbook
    @pytest.mark.parametrize(
        (
            "proband_files,proband_case_files,uncle_files,uncle_case_files,"
            "genome_build,expected_files,expected_errors"
        ),
        [
            (None, None, None, None, None, {}, 0),
            ("", "", "", "", None, {}, 0),
            (FILE_NAME_NOT_ACCEPTED, None, None, None, None, {}, 2),
            (None, FILE_NAME_NOT_ACCEPTED, None, None, None, {}, 2),
            (FASTQ_FILE_NAMES_ERRORS, None, None, None, None,
                FASTQ_ALIAS_TO_FILE_ITEMS_ERRORS, 2),
            (None, None, FASTQ_FILE_NAMES_NO_ERRORS, None, None,
                FASTQ_ALIAS_TO_FILE_ITEMS_NO_ERRORS, 0),
            (None, VCF_FILE_PATH, None, None, None, VCF_ALIAS_TO_FILE_ITEM, 0),
            (None, VCF_FILE_PATH, None, VCF_FILE_NAME, None, VCF_ALIAS_TO_FILE_ITEM, 0),
            (None, VCF_FILE_PATH, None, VCF_FILE_NAME, "hg38",
                VCF_ALIAS_TO_FILE_ITEM_GENOME_BUILD, 0),
            (None, VCF_FILE_PATH, None, VCF_FILE_NAME, "foo",
                VCF_ALIAS_TO_FILE_ITEM, 1),
            (
                None,
                VCF_FILE_PATH,
                None,
                FASTQ_FILE_NAMES_NO_ERRORS,
                None,
                VCF_FASTQ_ALIAS_TO_FILE_ITEMS_NO_ERRORS,
                0,
            ),
        ]
    )
    def test_integrated_with_files(
        self,
        es_testapp,
        wb_project,
        wb_institution,
        row_dict,
        row_dict_uncle,
        proband_files,
        proband_case_files,
        uncle_files,
        uncle_case_files,
        genome_build,
        expected_files,
        expected_errors
    ):
        """Test integration of SubmittedFilesParser with
        AccessionMetadata.

        Ensure expected errors reported correctly, files placed on
        appropriate items, and file properties created.
        """
        row_dict["files"] = proband_files
        row_dict["case files"] = proband_case_files
        row_dict_uncle["files"] = uncle_files
        row_dict_uncle["case files"] = uncle_case_files
        row_dict["genome build"] = genome_build
        row_dict_uncle["genome_build"] = genome_build
        rows = [row_dict, row_dict_uncle]
        accession_metadata = AccessionMetadata(
            es_testapp, rows, wb_project, wb_institution, "some_ingestion_id"
        )
        accession_metadata_files = accession_metadata.files
        for file_alias, file_item in accession_metadata_files.items():
            assert file_item.get("row")
            del file_item["row"]
        assert accession_metadata_files == expected_files
        assert len(accession_metadata.errors) == expected_errors
        if expected_files:
            expected_aliases = set(expected_files.keys())
            for sample in accession_metadata.samples.values():
                bam_sample_id = sample.get("bam_sample_id")
                if bam_sample_id == PROBAND_BAM_SAMPLE_ID:
                    proband_sample = sample
                elif bam_sample_id == UNCLE_BAM_SAMPLE_ID:
                    uncle_sample = sample
            if proband_files:
                assert set(proband_sample.get("files", [])) == expected_aliases
            elif uncle_files:
                assert set(uncle_sample.get("files", [])) == expected_aliases
            else:
                sample_processing = next(
                    iter(accession_metadata.sample_processings.values())
                )
                assert set(sample_processing.get("files", [])) == expected_aliases


class TestSubmittedFilesParser:

    def assert_lists_equal(self, list_1, list_2):
        """Simple helper to compare lists of dicts."""
        assert len(list_1) == len(list_2)
        for item in list_1:
            assert item in list_2
        for item in list_2:
            assert item in list_1

    @pytest.mark.parametrize(
        "extensions_to_formats,expected_errors",
        [
            ({}, 0),
            ({"foo": ["file_format_1"], "bar": []}, 0),
            ({"foo": ["file_format_1"], "bar": ["file_format_1", "file_format_2"]}, 1),
        ],
    )
    def test_check_for_multiple_file_formats(
        self, file_parser, extensions_to_formats, expected_errors
    ):
        """Test multiple file formats for a given extension produce an
        error that is reported.
        """
        file_parser.file_extensions_to_file_formats = extensions_to_formats
        file_parser.check_for_multiple_file_formats()
        assert len(file_parser.errors) == expected_errors

    @pytest.mark.workbook
    @pytest.mark.parametrize(
        (
            "submitted_file_names,genome_build,expected_general_errors,expected_items,"
            "expected_aliases,expected_row_errors"
        ),
        [
            ("", None, 0, [], [], 0),
            ("foo.bar", None, 1, [], [], 1),
            (VCF_FILE_PATH, None, 0, [VCF_FILE_ITEM], [VCF_FILE_ALIAS], 0),
            (
                "foo.bar, " + VCF_FILE_PATH,
                None,
                1,
                [VCF_FILE_ITEM],
                [VCF_FILE_ALIAS],
                1,
            ),
            (
                VCF_FILE_PATH,
                GENOME_BUILD,
                0,
                [VCF_FILE_ITEM_WITH_GENOME_BUILD],
                [VCF_FILE_ALIAS],
                0,
            ),
            (
                FASTQ_FILE_NAMES_NO_ERRORS,
                None,
                0,
                FASTQ_FILE_ITEMS_NO_ERRORS,
                FASTQ_ALIASES_NO_ERRORS,
                0,
            ),
            (
                FASTQ_FILE_NAMES_ERRORS,
                None,
                0,
                FASTQ_FILE_ITEMS_ERRORS,
                FASTQ_ALIASES_ERRORS,
                2,
            ),
            (
                ",".join([VCF_FILE_PATH, VCF_EXTRA_FILE_1]),
                None,
                0,
                [VCF_FILE_ITEM_WITH_EXTRA_FILE_1],
                [VCF_FILE_ALIAS],
                0,
            ),
            (
                ",".join([VCF_FILE_PATH, VCF_EXTRA_FILE_2]),
                None,
                0,
                [VCF_FILE_ITEM_WITH_EXTRA_FILE_2],
                [VCF_FILE_ALIAS],
                0,
            ),
            (
                ",".join([VCF_FILE_PATH, VCF_EXTRA_FILE_1, VCF_EXTRA_FILE_2]),
                None,
                1,
                [VCF_FILE_ITEM_WITH_EXTRA_FILE_1],
                [VCF_FILE_ALIAS],
                1,
            ),
        ],
    )
    def test_extract_file_metadata(
        self,
        file_parser_with_search,
        submitted_file_names,
        genome_build,
        expected_general_errors,
        expected_items,
        expected_aliases,
        expected_row_errors,
    ):
        """Test submitted file names parsing, File alias/property
        creation, and error reporting.

        NOTE: Essentially an integrated test of the class, so check
        helper functions if failing.
        """
        (
            result_items,
            result_aliases,
            result_row_errors,
        ) = file_parser_with_search.extract_file_metadata(
            submitted_file_names, genome_build=genome_build, row_index=1
        )
        assert len(file_parser_with_search.errors) == expected_general_errors
        assert len(result_row_errors) == expected_row_errors
        self.assert_lists_equal(result_items, expected_items)
        self.assert_lists_equal(result_aliases, expected_aliases)

    @pytest.mark.parametrize(
        "submitted_file_names,expected",
        [
            (None, []),
            ("", []),
            ("foo,foo,bar,", ["foo", "bar"]),
            ("foo,  foo , bar ,", ["foo", "bar"]),
        ]
    )
    def test_parse_file_names(self, file_parser, submitted_file_names, expected):
        """Test parsing submitted file names."""
        result = file_parser.parse_file_names(submitted_file_names)
        assert result == set(expected)

    @pytest.mark.parametrize(
        "accepted_file_formats,expected",
        [
            ({}, []),
            (
                {
                    "/file-formats/foo_bar/": {
                        "standard_file_extension": "foo.bar"
                    },
                    "/file-formats/bar/": {
                        "standard_file_extension": "bar",
                        "other_allowed_extensions": ["foo", "bar", "foo.bar"],
                    },
                },
                ["bar", "foo", "foo.bar"],
            ),
        ],
    )
    def test_get_accepted_file_extensions(
        self, file_parser, accepted_file_formats, expected
    ):
        """Test accumulating acceptable file extensions from mocked
        search results for FileFormats.
        """
        with mock.patch(
            "encoded.submit.SubmittedFilesParser.get_accepted_file_formats",
            return_value=accepted_file_formats,
        ) as mocked_file_formats:
            result = file_parser.get_accepted_file_extensions()
            mocked_file_formats.assert_called_once()
            assert result == expected

    @pytest.mark.workbook
    def test_get_accepted_file_formats(self, file_parser_with_search):
        """Test retrieval of accepted FileFormats via search."""
        result_file_formats = []
        expected_file_formats = ["fastq", "vcf_gz"]
        result = file_parser_with_search.get_accepted_file_formats()
        assert len(result) == 2
        for item in result.values():
            result_file_formats.append(item.get("file_format"))
        assert sorted(result_file_formats) == sorted(expected_file_formats)

    @pytest.mark.parametrize(
        "file_suffixes,return_values,expected_calls,expected",
        [
            ([], [], [], (None, None, None)),
            (
                [".foo"],
                [[]],
                ["foo"],
                (None, None, None),
            ),
            (
                [".foo", ".bar"],
                [[], [{"@id": "atid_1"}]],
                ["foo.bar", "bar"],
                ("atid_1", ["extra_file_atid_1", "extra_file_atid_2"], "bar"),
            ),
            (
                [".foo", ".bar"],
                [[{"@id": "atid_1"}]],
                ["foo.bar"],
                ("atid_1", ["extra_file_atid_1", "extra_file_atid_2"], "foo.bar"),
            ),
            (
                [".foo", ".bar"],
                [[{"@id": "atid_1"}, {"@id": "atid_2"}], []],
                ["foo.bar"],
                (None, None, None),
            ),
        ],
    )
    def test_identify_file_format(
        self,
        file_parser,
        file_suffixes,
        return_values,
        expected_calls,
        expected,
    ):
        """Test iteratively matching file extensions to FileFormats with
        mocked search results.
        """
        file_parser.primary_to_extra_file_formats = {
            "atid_1": ["extra_file_atid_1", "extra_file_atid_2"]
        }
        with mock.patch(
            "encoded.submit.SubmittedFilesParser.search_file_format_for_suffix",
            side_effect=return_values,
        ) as mocked_search:
            result = file_parser.identify_file_format(file_suffixes)
            assert result == expected
            for expected_call in expected_calls:
                mocked_search.assert_any_call(expected_call)

    @pytest.mark.workbook
    @pytest.mark.parametrize(
        "suffix,expected",
        [
            ("", []),
            ("foo.bar", []),
            ("fastq.gz", ["fastq"]),
            ("fq.gz", ["fastq"]),
        ],
    )
    def test_search_file_format_for_suffix(
        self, file_parser_with_search, suffix, expected
    ):
        """Test matching of file extension to FileFormat(s) via search
        results.
        """
        result = file_parser_with_search.search_file_format_for_suffix(suffix)
        assert len(result) == len(expected)
        result_file_formats = [item["file_format"] for item in result]
        for file_format in result_file_formats:
            assert file_format in expected

    @pytest.mark.workbook
    @pytest.mark.parametrize(
        "query,expected_length",
        [
            ("", 0),
            ("/search/?type=FooBar", 0),
            ("/search/?type=FileFormat&file_format=fastq", 1),
        ],
    )
    def test_search_query(self, file_parser_with_search, query, expected_length):
        """Test search results retrieved and returned as list of
        items found.
        """
        result = file_parser_with_search.search_query(query)
        assert isinstance(result, list)
        assert len(result) == expected_length

    @pytest.mark.workbook
    def test_make_get_request(self, es_testapp, file_parser_with_search, wb_project):
        """Test GET request made with appropriate response following
        and error handling.
        """
        wb_project_atid = wb_project["@id"]

        get_result = file_parser_with_search.make_get_request(wb_project_atid)
        for key, value in wb_project.items():
            result_value = get_result.get(key)
            assert result_value == value

        query_params = "frame=object"
        get_result = file_parser_with_search.make_get_request(
            wb_project_atid, query_string=query_params
        )
        expected_result = es_testapp.get(wb_project_atid, params=query_params).json
        assert get_result == expected_result

        url = "/search/?type=Project&uuid=" + wb_project["uuid"]
        get_result = file_parser_with_search.make_get_request(url)
        assert get_result["@graph"][0] == wb_project

        url = "/search/?type=Project&uuid!=No value"  # 301 follow
        get_result = file_parser_with_search.make_get_request(url)
        assert get_result["@graph"]

        url = "/search/?type=FooBar"
        get_result = file_parser_with_search.make_get_request(url)
        assert not get_result

    def make_file_dicts_for_names(file_names):
        """Helper function to create simple File item with alias
        property for all given file names.
        """
        result = {}
        for file_name in file_names:
            result[file_name] = {SubmittedFilesParser.ALIASES: ["alias-" + file_name]}
        return result

    @pytest.mark.parametrize(
        "fastqs,expected_unknown_paired_end,expected_unpaired_fastqs",
        [
            (make_file_dicts_for_names(["foo.fastq.gz"]), ["foo.fastq.gz"], []),
            (make_file_dicts_for_names(["foo_R1.fastq.gz"]), [], ["foo_R1.fastq.gz"]),
            (make_file_dicts_for_names(["foo_R1.fastq.gz", "foo_R2.fastq.gz"]), [], []),
            (
                make_file_dicts_for_names(["foo_R1.fastq.gz", "foo_r2.fastq.gz"]),
                [],
                ["foo_R1.fastq.gz", "foo_r2.fastq.gz"],
            ),
            (
                make_file_dicts_for_names(
                    ["foo_R1.fastq.gz", "bar_R1.fastq.gz", "foo_R2.fastq.gz"]
                ),
                [],
                ["bar_R1.fastq.gz"],
            ),
        ],
    )
    def test_validate_and_pair_fastqs(
        self, file_parser, fastqs, expected_unknown_paired_end, expected_unpaired_fastqs
    ):
        """Test paired-end identification and subsequent file pairing
        of FASTQs.
        """
        (
            result_unknown_paired_end,
            result_unpaired_fastqs,
        ) = file_parser.validate_and_pair_fastqs(fastqs)
        assert result_unknown_paired_end == expected_unknown_paired_end
        assert result_unpaired_fastqs == expected_unpaired_fastqs

    @pytest.mark.parametrize(
        "file_name,expected",
        [
            ("", None),
            ("foo bar", None),
            ("fastq_fileR1.fastq.gz", None),
            ("fastq_filer1.fastq.gz", None),
            ("fastq_file_R1.fastq.gz", 1),
            ("fastq_file_r1.fastq.gz", 1),
            ("fastq_file_R1_001.fastq.gz", 1),
            ("fastq_file_r1_001.fastq.gz", 1),
            ("fastq_file_R2.fastq.gz", 2),
            ("fastq_file_r2.fastq.gz", 2),
            ("fastq_file_R2_001.fastq.gz", 2),
            ("fastq_file_r2_001.fastq.gz", 2),
            ("fastq_file_r2_001_r1.fastq.gz", None),
            ("fastq_file_R1_001_R2.fastq.gz", None),
        ],
    )
    def test_get_paired_end_from_name(self, file_parser, file_name, expected):
        """Test paired-end identification from FASTQ file name."""
        result = file_parser.get_paired_end_from_name(file_name)
        assert result == expected

    @pytest.mark.parametrize(
        "fastq_paired_end_1,fastq_paired_end_2,expected_matches,expected_unmatched",
        [
            ({}, {}, [], []),
            ({"foo": {}}, {"bar": {}}, [], ["foo", "bar"]),
            (
                {"fastq_r1_001.gz": {}},
                {"fastq_r2.gz": {"aliases": ["fastq_r2_alias"]}},
                [],
                ["fastq_r1_001.gz", "fastq_r2.gz"],
            ),
            (
                {"fastq_r1.gz": {}},
                {"fastq_r2.gz": {"aliases": ["fastq_r2_alias"]}},
                [("fastq_r1.gz", "fastq_r2.gz")],
                [],
            ),
            (
                {"fastq_r1_001.gz": {}, "fastq_r1.gz": {}},
                {"fastq_r2.gz": {"aliases": ["fastq_r2_alias"]}},
                [("fastq_r1.gz", "fastq_r2.gz")],
                ["fastq_r1_001.gz"],
            ),
            (
                {"fastq_r1_001.gz": {}, "fastq_r1.gz": {}},
                {
                    "fastq_r2.gz": {"aliases": ["fastq_r2_alias"]},
                    "fastq_r2_001.gz": {"aliases": ["fastq_r2_001_alias"]},
                },
                [
                    ("fastq_r1.gz", "fastq_r2.gz"),
                    ("fastq_r1_001.gz", "fastq_r2_001.gz"),
                ],
                [],
            ),
        ],
    )
    def test_pair_fastqs_by_name(
        self,
        file_parser,
        fastq_paired_end_1,
        fastq_paired_end_2,
        expected_matches,
        expected_unmatched,
    ):
        """Test pairing of FASTQ files by name, with file properties
        updated and unpaired file names returned.
        """
        unmatched = file_parser.pair_fastqs_by_name(
            fastq_paired_end_1, fastq_paired_end_2
        )
        assert unmatched == expected_unmatched
        for paired_end_1_file_name, paired_end_2_file_name in expected_matches:
            paired_end_1_item = fastq_paired_end_1.get(paired_end_1_file_name)
            paired_end_2_item = fastq_paired_end_2.get(paired_end_2_file_name)
            assert paired_end_1_item and paired_end_2_item
            paired_end_1_match = paired_end_1_item[file_parser.RELATED_FILES][0][
                file_parser.FILE
            ]
            assert paired_end_1_match == paired_end_2_item[file_parser.ALIASES][0]

    @pytest.mark.parametrize(
        "file_name,expected",
        [
            ("", ""),
            ("foo bar", "foo bar"),
            ("fastq_fileR1.fastq.gz", "fastq_fileR1.fastq.gz"),
            ("fastq_file_R1.fastq.gz", "fastq_file_R2.fastq.gz"),
            ("fastq_file_R1_L001.fastq.gz", "fastq_file_R2_L001.fastq.gz"),
            ("fastq_file_R1_L001_R1.fastq.gz", "fastq_file_R2_L001_R2.fastq.gz"),
        ],
    )
    def test_make_expected_paired_end_2_name(self, file_parser, file_name, expected):
        """Test making paired-end 2 name from paired-end 1 FASTQ file
        name.
        """
        result = file_parser.make_expected_paired_end_2_name(file_name)
        assert result == expected

    @pytest.mark.parametrize(
        (
            "files_to_check_extra_files,file_names_to_items,files_without_file_format,"
            "expected_file_names_to_items,expected_files_without_file_format"
        ),
        [
            ({}, {}, {}, {}, {}),
            (
                FILES_TO_CHECK_EXTRA_FILES,
                copy.deepcopy(FILE_NAMES_TO_ITEMS),
                copy.deepcopy(FILES_WITHOUT_FILE_FORMAT),
                EXPECTED_FILE_NAMES_TO_ITEMS,
                EXPECTED_FILES_WITHOUT_FILE_FORMAT
            ),
        ]
    )
    def test_associate_extra_files(
        self, file_parser, files_to_check_extra_files, file_names_to_items,
        files_without_file_format, expected_file_names_to_items,
        expected_files_without_file_format
    ):
        """Test associating "primary" to extra file FileFormats."""
        file_parser.extra_file_formats = EXTRA_FILE_FORMAT_ATIDS_TO_ITEMS
        file_parser.associate_extra_files(
            files_to_check_extra_files, file_names_to_items, files_without_file_format
        )
        assert file_names_to_items == expected_file_names_to_items
        assert files_without_file_format == expected_files_without_file_format

    @pytest.mark.parametrize(
        (
            "file_item,existing_item_properties,extra_file_name,extra_file_format_atid,"
            "expected_extra_files"
        ),
        [
            (
                {},
                None,
                "foo.bar",
                "some_atid",
                [{"file_format": "some_atid", "filename": "foo.bar"}],
            ),
            (
                {"extra_files": [{}]},
                None,
                "foo.bar",
                "some_atid",
                [{}, {"file_format": "some_atid", "filename": "foo.bar"}],
            ),
            (
                {},
                {"extra_files": [{"file_format": "some_atid"}]},
                "foo.bar",
                "some_atid",
                None,
            ),
            (
                {},
                {"extra_files": [{"file_format": "some_atid"}]},
                "foo.bar",
                "some_other_atid",
                [{"file_format": "some_other_atid", "filename": "foo.bar"}],
            ),
        ]
    )
    def test_associate_file_with_extra_file(
        self,
        file_parser,
        file_item,
        existing_item_properties,
        extra_file_name,
        extra_file_format_atid,
        expected_extra_files
    ):
        """Test adding extra file metadata to file properties"""
        with mock.patch(
            "encoded.submit.SubmittedFilesParser.make_get_request",
            return_value=existing_item_properties,
        ) as mock_make_get_request:
            file_parser.associate_file_with_extra_file(
                file_item, extra_file_name, extra_file_format_atid
            )
            assert file_item.get("extra_files") == expected_extra_files
            mock_make_get_request.assert_called_once()

    @pytest.mark.parametrize(
        "extra_file_formats,file_name,file_suffix,file_format_atids,expected",
        [
            ({}, "", "", [], []),
            (
                EXTRA_FILE_FORMAT_ATIDS_TO_ITEMS,
                "some_fastq.fastq.gz",
                "fastq.gz",
                [FASTQ_FILE_FORMAT["@id"]],
                [],
            ),
            (
                EXTRA_FILE_FORMAT_ATIDS_TO_ITEMS,
                "some_bam.bam",
                "bam",
                [BAM_FILE_FORMAT["@id"]],
                [],
            ),
            (
                EXTRA_FILE_FORMAT_ATIDS_TO_ITEMS,
                "some_bam.bam",
                "bam",
                [BAI_FILE_FORMAT["@id"], FAI_FILE_FORMAT["@id"]],
                [
                    (["some_bam.bai"], BAI_FILE_FORMAT["@id"]),
                    (["some_bam.fai", "some_bam.fam", "some_bam.fan"], FAI_FILE_FORMAT["@id"]),
                ],
            ),
            (
                EXTRA_FILE_FORMAT_ATIDS_TO_ITEMS,
                "some_bam.something.bam",
                "bam",
                [BAI_FILE_FORMAT["@id"], FAI_FILE_FORMAT["@id"]],
                [
                    (["some_bam.something.bai"], BAI_FILE_FORMAT["@id"]),
                    (
                        [
                            "some_bam.something.fai",
                            "some_bam.something.fam",
                            "some_bam.something.fan",
                        ],
                        FAI_FILE_FORMAT["@id"]
                    ),
                ],
            ),
        ]
    )
    def test_generate_extra_file_names_with_formats(
        self, file_parser, extra_file_formats,
        file_name, file_suffix, file_format_atids, expected
    ):
        """Test making possible extra file names from a given file
        name and FileFormat.
        """
        file_parser.extra_file_formats = extra_file_formats
        result = file_parser.generate_extra_file_names_with_formats(
            file_name, file_suffix, file_format_atids
        )
        assert result == expected

    @pytest.mark.parametrize(
        "file_name,suffix,expected",
        [
            ("", "", ""),
            ("foo.bar", "", "foo.bar"),
            ("foo.bar", "bar", "foo"),
            ("foo.bar", ".bar", "foo"),
            ("foo.bar.bar", "bar", "foo.bar"),
            ("foo.bar.bar", "bar.bar", "foo"),
        ]
    )
    def test_get_file_name_without_suffix(self, file_parser, file_name, suffix, expected):
        """Test removing given suffix from file name."""
        result = file_parser.get_file_name_without_suffix(file_name, suffix)
        assert result == expected

    @pytest.mark.parametrize(
        "file_name,extension,expected",
        [
            ("", "", "."),
            ("foo", "", "foo."),
            ("", "bar", ".bar"),
            ("foo", "bar", "foo.bar"),
            ("foo.", "bar", "foo.bar"),
            ("foo", ".bar", "foo.bar"),
            ("foo.", ".bar", "foo.bar"),
            ("fu.foo", "bar", "fu.foo.bar"),
        ]
    )
    def test_make_file_name_for_extension(self, file_parser, file_name, extension, expected):
        """Test make new file name from given name and extension."""
        result = file_parser.make_file_name_for_extension(file_name, extension)
        assert result == expected



class TestPedigreeRow:

    def assert_lists_identical(self, list_1, list_2):
        """Assert equality for unsorted lists."""
        assert len(list_1) == len(list_2)
        for item in list_1:
            assert item in list_2

    def test_extract_individual_metadata(self, pedigree_row, row_dict_pedigree):
        """tests that individual metadata gets created properly during pedigree file parsing"""
        assert not pedigree_row.errors
        assert pedigree_row.indiv_alias == "encode-project:individual-456"
        assert pedigree_row.individual.metadata["aliases"] == [pedigree_row.indiv_alias]
        assert (
            pedigree_row.individual.metadata["individual_id"]
            == row_dict_pedigree["individual id"]
        )
        assert all(
            [
                ":individual-" in pedigree_row.individual.metadata[item]
                for item in ["mother", "father"]
            ]
        )
        for item in [
            "family_id",
            "sex",
            "phenotypic_features",
            "disorders",
            "ancestry",
            "life_status",
            "is_deceased",
            "is_termination_of_pregnancy",
            "is_still_birth",
            "is_pregnancy",
            "is_spontaneous_abortion",
            "is_infertile",
            "is_no_children_by_choice",
        ]:
            assert item in pedigree_row.individual.metadata

    @pytest.mark.parametrize(
        "field, error",
        [
            ("individual id", True),
            ("family id", True),
            ("sex", True),
            ("ancestry", False),
            ("mother id", False),
            ("father id", False),
            ("hpo terms", False),
        ],
    )
    def test_found_missing_values(
        self, row_dict_pedigree, project, institution, field, error
    ):
        """some columns are required for spreadsheet submission, others are optional."""
        row_dict_pedigree[field] = None
        obj = PedigreeRow(row_dict_pedigree, 1, project["name"], institution["name"])
        assert (len(obj.errors) > 0) == error
        assert (
            "Row 1 - missing required field(s) {}. This row cannot be processed."
            "".format(field) in obj.errors
        ) == error

    @pytest.mark.parametrize(
        "proband_val, result", [("Y", True), ("N", False), ("U", False)]
    )
    def test_is_proband(
        self, row_dict_pedigree, project, institution, proband_val, result
    ):
        row_dict_pedigree["proband"] = proband_val
        obj = PedigreeRow(row_dict_pedigree, 1, project["name"], institution["name"])
        assert obj.proband == result

    @pytest.mark.parametrize(
        "ontology_terms,match_pattern,expected_valid,expected_invalid",
        [
            ("", HPO_TERM_ID_PATTERN, [], []),
            ("HP:0000001", HPO_TERM_ID_PATTERN, ["HP:0000001"], []),
            ("foo, bar", HPO_TERM_ID_PATTERN, [], ["foo", "bar"]),
            ("foo, bar, foo", HPO_TERM_ID_PATTERN, [], ["foo", "bar"]),
            (
                "foo, HP:0000001, bar",
                HPO_TERM_ID_PATTERN,
                ["HP:0000001"],
                ["foo", "bar"],
            ),
        ],
    )
    def test_validate_ontology_terms(
        self,
        pedigree_row,
        ontology_terms,
        match_pattern,
        expected_valid,
        expected_invalid,
    ):
        """Test identification of valid/invalid ontology terms based on
        given term regex.
        """
        result_valid, result_invalid = pedigree_row.validate_ontology_terms(
            ontology_terms, match_pattern
        )
        assert result_valid == set(expected_valid)
        assert result_invalid == set(expected_invalid)

    @pytest.mark.parametrize(
        "individual_metadata,expected",
        [
            ({}, {}),
            ({"foo": "bar"}, {"foo": "bar"}),
            ({"phenotypic_features": "foo, bar"}, {}),
            ({"foo": "bar", "phenotypic_features": "foo, bar"}, {"foo": "bar"}),
            (
                {"phenotypic_features": "HP:0001111"},
                {"phenotypic_features": [{"phenotypic_feature": "/phenotypes/HP:0001111/"}]},
            ),
            (
                {"foo": "bar", "phenotypic_features": "HP:0001111"},
                {
                    "foo": "bar",
                    "phenotypic_features": [{"phenotypic_feature": "/phenotypes/HP:0001111/"}],
                },
            ),
        ],
    )
    def test_update_phenotypes(self, pedigree_row, individual_metadata, expected):
        """Test phenotypes from spreadsheet properly reformatted or
        removed from metadata appropriately.
        """
        pedigree_row.update_phenotypes(individual_metadata)
        assert individual_metadata == expected

    @pytest.mark.parametrize(
        "phenotypes,error,expected",
        [
            ("", False, []),
            ("HP:001", True, []),
            ("Ataxia", False, []),
            ("HP:0000001", False, [{"phenotypic_feature": "/phenotypes/HP:0000001/"}]),
            (
                "HP:1094732, HP:2349843",
                False,
                [
                    {"phenotypic_feature": "/phenotypes/HP:1094732/"},
                    {"phenotypic_feature": "/phenotypes/HP:2349843/"},
                ],
            ),
        ],
    )
    def test_get_phenotypes(self, pedigree_row, phenotypes, error, expected):
        """Test spreadsheet HPO term input properly parsed and
        validated.
        """
        result = pedigree_row.get_phenotypes(phenotypes)
        self.assert_lists_identical(result, expected)
        if error:
            assert pedigree_row.errors

    @pytest.mark.parametrize(
        "individual_metadata,expected",
        [
            ({}, {}),
            ({"foo": "bar"}, {"foo": "bar"}),
            ({"primary_diagnosis": "foo, bar"}, {}),
            ({"disorders": "foo, bar"}, {}),
            (
                {"primary_diagnosis": "MONDO:0001111"},
                {
                    "disorders": [
                        {"disorder": "/disorders/MONDO:0001111/", "is_primary_diagnosis": True}
                    ]
                },
            ),
            (
                {"disorders": "MONDO:0001111"},
                {"disorders": [{"disorder": "/disorders/MONDO:0001111/"}]},
            ),
            (
                {
                    "primary_diagnosis": "MONDO:0001111",
                    "disorders": "MONDO:0002222",
                },
                {
                    "disorders": [
                        {"disorder": "/disorders/MONDO:0001111/", "is_primary_diagnosis": True},
                        {"disorder": "/disorders/MONDO:0002222/"},
                    ],
                },
            ),
            (
                {
                    "primary_diagnosis": "foo, bar",
                    "diagnosis_onset_age": "10",
                    "diagnosis_onset_age_units": "year",
                    "diagnostic_confidence": "probable",
                },
                {},
            ),
            (
                {
                    "diagnosis_onset_age": "10",
                    "diagnosis_onset_age_units": "year",
                    "diagnostic_confidence": "probable",
                },
                {},
            ),
            (
                {
                    "primary_diagnosis": "MONDO:0001111",
                    "diagnosis_onset_age": "10",
                    "diagnosis_onset_age_units": "year",
                    "diagnostic_confidence": "probable",
                },
                {
                    "disorders": [
                        {
                            "disorder": "/disorders/MONDO:0001111/",
                            "onset_age": 10,
                            "onset_age_units": "year",
                            "diagnostic_confidence": "probable",
                            "is_primary_diagnosis": True,
                        },
                    ]
                },
            ),
        ],
    )
    def test_update_disorders(self, pedigree_row, individual_metadata, expected):
        """Test disorder information from spreadsheet properly
        processed and reformatted or removed from Individual metadata.
        """
        pedigree_row.update_disorders(individual_metadata)
        assert individual_metadata == expected

    @pytest.mark.parametrize(
        (
            "primary_disorder,onset_age,onset_age_units,diagnostic_confidence,error"
            ",expected"
        ),
        [
            ("", None, None, None, False, []),
            ("MONDO:foo", None, None, None, True, []),
            (
                "MONDO:0001111",
                None,
                None,
                None,
                False,
                [{"disorder": "/disorders/MONDO:0001111/", "is_primary_diagnosis": True}],
            ),
            (
                "MONDO:0001111, MONDO:0001111",
                None,
                None,
                None,
                False,
                [{"disorder": "/disorders/MONDO:0001111/", "is_primary_diagnosis": True}],
            ),
            ("MONDO:0001111, MONDO:0001112", None, None, None, True, []),
            (
                "MONDO:0001111, MONDO:foo",
                None,
                None,
                None,
                True,
                [{"disorder": "/disorders/MONDO:0001111/", "is_primary_diagnosis": True}],
            ),
            (
                "MONDO:0001111",
                "10",
                None,
                None,
                False,
                [
                    {
                        "disorder": "/disorders/MONDO:0001111/",
                        "onset_age": 10,
                        "onset_age_units": "year",
                        "is_primary_diagnosis": True,
                    }
                ],
            ),
            (
                "MONDO:0001111",
                "10",
                "month",
                None,
                False,
                [
                    {
                        "disorder": "/disorders/MONDO:0001111/",
                        "onset_age": 10,
                        "onset_age_units": "month",
                        "is_primary_diagnosis": True,
                    }
                ],
            ),
            (
                "MONDO:0001111",
                None,
                None,
                "probable",
                False,
                [
                    {
                        "disorder": "/disorders/MONDO:0001111/",
                        "diagnostic_confidence": "probable",
                        "is_primary_diagnosis": True,
                    }
                ],
            ),
        ],
    )
    def test_get_primary_disorder(
        self,
        pedigree_row,
        primary_disorder,
        onset_age,
        onset_age_units,
        diagnostic_confidence,
        error,
        expected,
    ):
        """Test primary disorder MONDO terms and associated columns from
        spreadsheet interpretated, validated, and formatted.
        """
        result = pedigree_row.get_primary_disorder(
            primary_disorder, onset_age, onset_age_units, diagnostic_confidence
        )
        assert result == expected
        if error:
            assert pedigree_row.errors

    @pytest.mark.parametrize(
        "disorders,error,expected",
        [
            ("", False, []),
            ("MONDO:0001", True, []),
            ("MONDO:0007947", False, [{"disorder": "/disorders/MONDO:0007947/"}]),
            ("Foo, MONDO:0007947, MONDO:001", True, [{"disorder": "/disorders/MONDO:0007947/"}]),
            (
                "MONDO:0007947, MONDO:0001111",
                False,
                [
                    {"disorder": "/disorders/MONDO:0007947/"},
                    {"disorder": "/disorders/MONDO:0001111/"},
                ],
            ),
        ],
    )
    def test_get_secondary_disorders(self, pedigree_row, disorders, error, expected):
        """Test secondary MONDO terms without additional metadata
        validated and formatted.
        """
        result = pedigree_row.get_secondary_disorders(disorders)
        self.assert_lists_identical(result, expected)
        if error:
            assert pedigree_row.errors


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

    @pytest.mark.workbook
    def test_add_family_metadata_db_single(self, workbook, es_testapp, example_rows_pedigree,
                                           wb_project, wb_institution):
        """Tests that if a family ID is already in the database, the atid is used as an identifier instead
        of the new alias. Additionally, if the proband designation is missing from the family history rows,
        the PedigreeMetadata object still gets created without error messages when the family is in the DB already.
        """
        example_rows_pedigree[0]['proband'] == 'N'
        submission = PedigreeMetadata(es_testapp, example_rows_pedigree, wb_project, wb_institution, TEST_INGESTION_ID1)
        assert len(submission.families) == 1
        fam = list(submission.families.values())[0]
        assert list(submission.families.keys())[0] == WORKBOOK_FAMILY_ID1
        assert len(fam['members']) == len(example_rows_pedigree)
        assert len(submission.errors) == 0

    @pytest.mark.workbook
    def test_add_family_metadata_db_multi(self, workbook, es_testapp, example_rows_pedigree, wb_project, wb_institution):
        """Tests that if 2 items are in the DB with same familyID, that both of these are reflected in the
        PedigreeMetadata object. Checks that both items have all members and proband of each isn't changed."""
        for row in example_rows_pedigree:
            row['family id'] = '0102'
        submission = PedigreeMetadata(es_testapp, example_rows_pedigree, wb_project, wb_institution, TEST_INGESTION_ID1)
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
        obj = AccessionProcessing(testapp, data, project, institution, TEST_INGESTION_ID1)
        assert obj.passing == success_bool
        assert (len(obj.errors) == 0) == success_bool
        assert ('Column headers not detected in spreadsheet!' in ''.join(obj.errors)) == (not success_bool)

    def test_create_row_dict(self, testapp, xls_list, project, institution):
        """tests that dictionary of colname: field value is created for each row"""
        obj = AccessionProcessing(testapp, iter(xls_list), project, institution, TEST_INGESTION_ID1)
        assert obj.keys
        assert len(obj.rows) == 3
        for row in obj.rows:
            assert all(key in row for key in obj.keys)

    def test_create_row_dict_missing_col(self, testapp, xls_list, project, institution):
        """tests that correct error is returned when a required column header is not in spreadsheet"""
        idx = xls_list[1].index('Specimen ID')
        rows = (row[0:idx] + row[idx+1:] for row in xls_list)
        obj = AccessionProcessing(testapp, rows, project, institution, TEST_INGESTION_ID1)
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
        obj = PedigreeProcessing(testapp, data, project, institution, TEST_INGESTION_ID1,
                                    submission_type='family_history')
        assert obj.passing == success_bool
        assert (len(obj.errors) == 0) == success_bool
        assert ('Column headers not detected in spreadsheet!' in ''.join(obj.errors)) == (not success_bool)

    def test_create_row_dict_pedigree(self, testapp, xls_list_pedigree, project, institution):
        """tests that dictionary of colname: field value is created for each row"""
        obj = PedigreeProcessing(testapp, iter(xls_list_pedigree), project, institution,
                                    TEST_INGESTION_ID1, submission_type='family_history')
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
        obj = PedigreeProcessing(testapp, rows, project, institution, TEST_INGESTION_ID1,
                                    submission_type='family_history')
        assert obj.passing == success_bool
        if not success_bool:
            assert 'Column(s) "{}" not found in spreadsheet!'.format(col.lower().strip(':')) in ''.join(obj.errors)

    @pytest.mark.parametrize(
        "entry,expected",
        [
            ("", ""),
            ("FOO", "foo"),
            (" foo ", "foo"),
            ("foo (bar)", "foo"),
            ("foo*", "foo"),
            ("foo:", "foo"),
            ("Foo* (BAR) ", "foo"),
        ]
    )
    def test_reformat_column_header(self, entry, expected):
        """Test column header in spreadsheet reformatted correctly."""
        result = SpreadsheetProcessing.reformat_column_header(entry)
        assert result == expected


def test_xls_to_json_accessioning(testapp, project, institution):
    """tests that xls_to_json returns expected output when a spreadsheet is formatted correctly"""
    rows = digest_xlsx(TEST_WORKBOOK)
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'accessioning')
    assert success
    assert len(json_out['family']) == 1
    assert 'encode-project:family-456' in json_out['family']
    assert len(json_out['individual']) == 3
    assert all(['encode-project:individual-' + x in json_out['individual'] for x in ['123', '456', '789']])


def test_xls_to_json_pedigree(testapp, project, institution):
    """tests that xls_to_json returns expected output when a spreadsheet is formatted correctly"""
    rows = digest_xlsx('src/encoded/tests/data/documents/pedigree_test_example.xlsx')
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'family_history')
    assert success
    assert len(json_out['family']) == 1
    assert 'encode-project:family-IND201' in json_out['family']
    assert len(json_out['individual']) == 8
    assert all(['encode-project:individual-' + x in json_out['individual'] for x in [
        'IND201', 'IND202', 'IND203', 'IND204', 'IND205', 'IND206', 'IND207', 'IND208'
    ]])


def test_xls_to_json_accessioning_errors(testapp, project, institution):
    """tests for expected output when spreadsheet is not formatted correctly"""
    rows = digest_xlsx(TEST_WORKBOOK_WITH_ERRORS)
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'accessioning')
    assert 'Row 4' in ''.join(json_out['errors'])  # row counting info correct
    assert success  # still able to proceed to validation step


def test_xls_to_json_pedigree_errors(testapp, project, institution):
    """tests for expected output when spreadsheet is not formatted correctly"""
    rows = digest_xlsx(TEST_PEDIGREE_WITH_ERRORS)
    json_out, success = xls_to_json(testapp, rows, project, institution, TEST_INGESTION_ID1, 'family_history')
    joined_errors = "".join(json_out["errors"])
    assert "Row 5" in joined_errors
    assert "HP:00000821" in joined_errors
    assert "Row 9 - missing required field(s) family id." in joined_errors
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


def test_post_and_patch_all_items(testapp, post_data, file_formats):
    output, success, file_info = post_and_patch_all_items(testapp, post_data)
    assert success
    for itemtype in post_data['post']:
        item_count = len(post_data["post"][itemtype])
        item_name = "item"
        if item_count > 1:
            item_name = "items"
        assert f'{itemtype}: {item_count} {item_name} created (with POST); 0 items failed creation' in output
        if post_data['patch'].get(itemtype):
            assert f'{itemtype}: attributes of 1 item updated (with PATCH); 0 items failed updating' in output


def test_post_and_patch_all_items_error(testapp, post_data, file_formats):
    """
    additional property introduced into 'family' item json  -
    designed to test appropriate error message produced in 'output' when item fails to post
    """
    post_data['post']['family'][0]['extra_field'] = 'extra field value'
    output, success, file_info = post_and_patch_all_items(testapp, post_data)
    assert not success
    assert 'family: 0 items created (with POST); 1 item failed creation' in output
