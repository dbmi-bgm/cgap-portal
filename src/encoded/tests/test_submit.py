import openpyxl
import pytest

from ..submit import (
    HPO_TERM_ID_PATTERN,
    MONDO_TERM_ID_PATTERN,
    AccessionMetadata,
    AccessionProcessing,
    AccessionRow,
    PedigreeMetadata,
    PedigreeProcessing,
    PedigreeRow,
    SpreadsheetProcessing,
    compare_fields,
    digest_xlsx,
    format_ontology_term_with_colon,
    get_column_name,
    map_fields,
    parse_exception,
    post_and_patch_all_items,
    row_generator,
    validate_all_items,
    validate_item,
    xls_to_json,
)

TEST_INGESTION_ID1 = "123456-1243-1234-123456abcdef"
TEST_INGESTION_ID2 = "abcdef-1234-1234-abcdef123456"
WORKBOOK_FAMILY_ID1 = "/families/GAPFA59JKS1Y/"
WORKBOOK_FAMILY_ID2 = "/families/GAPFAYUV203P/"
WORKBOOK_FAMILY_ID3 = "/families/GAPFAZ3V21Q8/"

TEST_WORKBOOK = "src/encoded/tests/data/documents/cgap_submit_test.xlsx"
TEST_WORKBOOK_WITH_ERRORS = (
    "src/encoded/tests/data/documents/cgap_submit_test_with_errors.xlsx"
)
TEST_WORKBOOK_PEDIGREE = "src/encoded/tests/data/documents/pedigree_test_example.xlsx"
TEST_PEDIGREE_WITH_ERRORS = (
    "src/encoded/tests/data/documents/pedigree_test_example_errors.xlsx"
)

# for row counting tests (xls processing)
BLANK_ROW_ACCESSION = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
HEADER_ROW_ACCESSION = [
    "Unique Analysis ID*:",
    "Analysis ID*:",
    "Family ID:",
    "Individual ID*:",
    "Sex*:",
    "Age:",
    "Age Units:",
    "Birth Year:",
    "Relation to Proband*:",
    "Specimen Type*:",
    "Specimen ID*:",
    "Report Required*:",
    "Test Requested*:",
    "Specimen Collection Date:",
    "Sequencing Date:",
    "Files:",
]
ERRONEOUS_ROW_1_ACCESSION = [
    "Case1_Person1-1",
    "",
    "Fam1",
    "Person1-1",
    "M",
    "20",
    "year",
    "",
    "proband",
    "peripheral blood",
    "Specimen1-1",
    "N",
    "WGS",
    "",
    "",
    "",
]
ERRONEOUS_ROW_2_ACCESSION = [
    "Case1_Person1-2",
    "Case1",
    "Fam1",
    "Person1-2",
    "F",
    "50",
    "year",
    "",
    "mother",
    "peripheral blood",
    "Specimen1-2",
    "N",
    "WGS",
    "",
    "",
    "",
]
CORRECT_ROW_ACCESSION = [
    "Case1_Person1-1",
    "Accession1",
    "Fam1",
    "Person1-1",
    "M",
    "20",
    "year",
    "",
    "proband",
    "peripheral blood",
    "Specimen1-1",
    "N",
    "WGS",
    "",
    "",
    "",
]

BLANK_BEFORE_HEADER = [
    BLANK_ROW_ACCESSION,
    HEADER_ROW_ACCESSION,
    ERRONEOUS_ROW_1_ACCESSION,
]
BLANK_AFTER_HEADER = [
    HEADER_ROW_ACCESSION,
    BLANK_ROW_ACCESSION,
    ERRONEOUS_ROW_1_ACCESSION,
]
BLANK_BT_ROWS = [
    HEADER_ROW_ACCESSION,
    ERRONEOUS_ROW_1_ACCESSION,
    BLANK_ROW_ACCESSION,
    ERRONEOUS_ROW_2_ACCESSION,
]
BLANK_BEFORE_HEADER_AND_BT_ROWS = [
    BLANK_ROW_ACCESSION,
    HEADER_ROW_ACCESSION,
    ERRONEOUS_ROW_1_ACCESSION,
    BLANK_ROW_ACCESSION,
    ERRONEOUS_ROW_2_ACCESSION,
]
BLANK_AFTER_HEADER_AND_BT_ROWS = [
    HEADER_ROW_ACCESSION,
    BLANK_ROW_ACCESSION,
    ERRONEOUS_ROW_1_ACCESSION,
    BLANK_ROW_ACCESSION,
    ERRONEOUS_ROW_2_ACCESSION,
]
BLANK_AFTER_ROWS = [
    HEADER_ROW_ACCESSION,
    ERRONEOUS_ROW_1_ACCESSION,
    BLANK_ROW_ACCESSION,
    BLANK_ROW_ACCESSION,
    BLANK_ROW_ACCESSION,
]
BLANK_COMBINATION = [
    BLANK_ROW_ACCESSION,
    HEADER_ROW_ACCESSION,
    BLANK_ROW_ACCESSION,
    ERRONEOUS_ROW_1_ACCESSION,
    BLANK_ROW_ACCESSION,
    ERRONEOUS_ROW_2_ACCESSION,
    BLANK_ROW_ACCESSION,
]
BLANK_NO_ERRORS = [
    BLANK_ROW_ACCESSION,
    HEADER_ROW_ACCESSION,
    CORRECT_ROW_ACCESSION,
    BLANK_ROW_ACCESSION,
]

BLANK_ROW_PEDIGREE = ["", "", "", "", "", "", "", "", "", "", ""]
HEADER_ROW_PEDIGREE = [
    "Family ID:",
    "Individual ID",
    "Mother ID",
    "Father ID",
    "Sex",
    "HPO terms",
    "MONDO terms",
    "Proband",
    "life status",
    "deceased",
    "infertile",
]
ERRONEOUS_ROW_1_PEDIGREE = [
    "111",
    "IND204",
    "",
    "",
    "F",
    "HP:00000821, HP:0000716",
    "",
    "N",
    "alive & well",
    "",
    "",
]
ERRONEOUS_ROW_2_PEDIGREE = [
    "111",
    "IND206",
    "",
    "",
    "F",
    "HP:00000833, HP:0000722",
    "",
    "N",
    "deceased",
    "",
    "",
]
CORRECT_ROW_PEDIGREE = ["111", "IND205", "", "", "M", "", "", "N", "deceased", "Y", ""]

BLANK_BEFORE_HEADER_PED = [
    BLANK_ROW_PEDIGREE,
    HEADER_ROW_PEDIGREE,
    ERRONEOUS_ROW_1_PEDIGREE,
]
BLANK_AFTER_HEADER_PED = [
    HEADER_ROW_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    ERRONEOUS_ROW_1_PEDIGREE,
]
BLANK_BT_ROWS_PED = [
    HEADER_ROW_PEDIGREE,
    ERRONEOUS_ROW_1_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    ERRONEOUS_ROW_2_PEDIGREE,
]
BLANK_BEFORE_HEADER_AND_BT_ROWS_PED = [
    BLANK_ROW_PEDIGREE,
    HEADER_ROW_PEDIGREE,
    ERRONEOUS_ROW_1_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    ERRONEOUS_ROW_2_PEDIGREE,
]
BLANK_AFTER_HEADER_AND_BT_ROWS_PED = [
    HEADER_ROW_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    ERRONEOUS_ROW_1_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    ERRONEOUS_ROW_2_PEDIGREE,
]
BLANK_AFTER_ROWS_PED = [
    HEADER_ROW_PEDIGREE,
    ERRONEOUS_ROW_1_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    BLANK_ROW_PEDIGREE,
]
BLANK_COMBINATION_PED = [
    BLANK_ROW_PEDIGREE,
    HEADER_ROW_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    ERRONEOUS_ROW_1_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    ERRONEOUS_ROW_2_PEDIGREE,
    BLANK_ROW_PEDIGREE,
]
BLANK_NO_ERRORS_PED = [
    BLANK_ROW_PEDIGREE,
    HEADER_ROW_PEDIGREE,
    BLANK_ROW_PEDIGREE,
    CORRECT_ROW_PEDIGREE,
]


# TODO: Check if these work or not.  These tests seem to be working, but they may do posting
#       that could affect other tests, so I have marked this as requiring manual invocation until we
#       investigate that. -kmp 21-Feb-2021
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.manual]


@pytest.fixture
def row_dict():
    return {
        "individual id": "456",
        "family id": "333",
        "sex": "M",
        "relation to proband": "proband",
        "analysis id": "999",
        "report required": "Y",
        "specimen id": "3464467",
        "specimen type": "Peripheral_Blood",
        "test requested": "WGS",
        "test number": "2",
    }


@pytest.fixture
def row_dict_uncle():
    return {
        "individual id": "455",
        "family id": "333",
        "sex": "M",
        "relation to proband": "uncle",
        "analysis id": "999",
        "report required": "N",
        "specimen id": "3464460",
        "specimen type": "Peripheral_Blood",
        "test requested": "WGS",
        "test number": "1",
    }


@pytest.fixture
def row_dict_pedigree():
    return {
        "family id": "333",
        "individual id": "456",
        "mother id": "123",
        "father id": "789",
        "sex": "M",
        "proband": "Y",
        "hpo terms": "HP:0000123, HP:0000999",
        "mondo terms": "MONDO:0000555",
        "ancestry": "European",
        "life status": "alive and well",
        "deceased": "N",
        "termination of pregnancy": "N",
        "still birth": "N",
        "pregnancy": "N",
        "spontaneous abortion": "N",
        "infertile": "N",
        "no children by choice": "Y",
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
        "individual": {},
        "family": {},
        "file_fastq": {},
        "file_processed": {},
        "sample": {},
        "sample_processing": {},
        "case": {},
        "report": {},
        "reports": [],
        "errors": [],
    }


@pytest.fixture
def submission_info():
    return {
        "family": {
            "test-proj:fam1": {
                "members": ["test-proj:indiv1"],
                "proband": "test-proj:indiv1",
            }
        },
        "individual": {"test-proj:indiv1": {"samples": ["test-proj:samp1"]}},
        "sample": {"test-proj:samp1": {"workup_type": "WGS"}},
        "sample_processing": {},
        "case": {
            "test-proj:case1": {
                "individual": "test-proj:indiv1",
                "families": ["test-proj: fam1"],
                "ingestion_ids": [TEST_INGESTION_ID1],
            }
        },
        "errors": [],
    }


@pytest.fixture
def submission_info2(submission_info):
    submission_info["family"]["test-proj:fam1"]["members"].append("test-proj:indiv2")
    submission_info["individual"]["test-proj:indiv2"] = {"samples": ["test-proj:samp2"]}
    submission_info["sample"]["test-proj:samp2"] = {"workup_type": "WGS"}
    return submission_info


@pytest.fixture
def submission_info3(submission_info2):
    info = submission_info2.copy()
    info["family"]["test-proj:fam1"]["members"].append("test-proj:indiv3")
    info["family"]["test-proj:fam1"]["mother"] = "test-proj:indiv2"
    info["individual"]["test-proj:indiv3"] = {"samples": ["test-proj:samp3"]}
    info["sample"]["test-proj:samp3"] = {"workup_type": "WGS"}
    return info


@pytest.fixture
def post_data(project, institution):
    return {
        "post": {
            "family": [
                {
                    "aliases": ["test-proj:fam1"],
                    "family_id": "fam1",
                    "members": ["test-proj:indiv1"],
                    "proband": "test-proj:indiv1",
                    "project": project["@id"],
                    "institution": institution["@id"],
                }
            ],
            "individual": [
                {
                    "aliases": ["test-proj:indiv1"],
                    "individual_id": "indiv1",
                    "sex": "F",
                    "samples": ["test-proj:samp1"],
                    "project": project["@id"],
                    "institution": institution["@id"],
                }
            ],
            "sample": [
                {
                    "aliases": ["test-proj:samp1"],
                    "bam_sample_id": "samp1-WGS",
                    "workup_type": "WGS",
                    "specimen_accession": "samp1",
                    "project": project["@id"],
                    "institution": institution["@id"],
                }
            ],
        },
        "patch": {},
        "aliases": {},
    }


@pytest.fixture
def sample_info():
    return {
        "test requested": "WES",
        "specimen id": "9034",
        "date collected": "2020-01-06",
    }


@pytest.fixture
def aunt(testapp, project, institution):
    item = {
        "accession": "GAPIDAUNT001",
        "age": 35,
        "age_units": "year",
        "project": project["@id"],
        "institution": institution["@id"],
        "sex": "F",
    }
    return testapp.post_json("/individual", item).json["@graph"][0]


@pytest.fixture
def case_with_ingestion_id1(testapp, project, institution, fam, sample_proc_fam):
    data = {
        "project": project["@id"],
        "institution": institution["@id"],
        "family": fam["@id"],
        "individual": "GAPIDPROBAND",
        "sample_processing": sample_proc_fam["@id"],
        "ingestion_ids": [TEST_INGESTION_ID1],
    }
    res = testapp.post_json("/case", data).json["@graph"][0]
    return res


@pytest.fixture
def case_with_ingestion_id2(testapp, project, institution, fam, sample_proc_fam):
    return {
        "project": project["@id"],
        "institution": institution["@id"],
        "family": fam["@id"],
        "individual": "GAPIDPROBAND",
        "sample_processing": sample_proc_fam["@id"],
        "ingestion_ids": [TEST_INGESTION_ID2],
    }


@pytest.fixture
def example_rows():
    return [
        (
            {
                "individual id": "456",
                "sex": "F",
                "analysis id": "1111",
                "relation to proband": "proband",
                "report required": "Y",
                "workup type": "WGS",
                "specimen id": "1",
            },
            1,
        ),
        (
            {
                "individual id": "123",
                "sex": "F",
                "analysis id": "1111",
                "relation to proband": "mother",
                "report required": "N",
                "workup type": "WGS",
                "specimen id": "2",
            },
            2,
        ),
        (
            {
                "individual id": "789",
                "sex": "M",
                "analysis id": "1111",
                "relation to proband": "father",
                "report required": "N",
                "workup type": "WGS",
                "specimen id": "3",
            },
            3,
        ),
        (
            {
                "individual id": "456",
                "sex": "F",
                "analysis id": "2222",
                "relation to proband": "proband",
                "report required": "Y",
                "workup type": "WGS",
                "specimen id": "1",
            },
            4,
        ),
        (
            {
                "individual id": "456",
                "sex": "F",
                "analysis id": "4444",
                "relation to proband": "proband",
                "report required": "Y",
                "workup type": "WES",
                "specimen id": "7",
            },
            5,
        ),
        (
            {
                "individual id": "555",
                "sex": "M",
                "analysis id": "3333",
                "relation to proband": "proband",
                "report required": "Y",
                "workup type": "WES",
                "specimen id": "5",
            },
            6,
        ),
        (
            {
                "individual id": "546",
                "sex": "F",
                "analysis id": "3333",
                "relation to proband": "mother",
                "report required": "N",
                "workup type": "WES",
                "specimen id": "6",
            },
            7,
        ),
    ]


@pytest.fixture
def example_rows_with_test_number(example_rows):
    example_rows[0][0]["test number"] = "1"
    example_rows[3][0]["test number"] = "2"
    return example_rows


@pytest.fixture
def big_family_rows():
    return [
        (
            {
                "individual id": "456",
                "sex": "M",
                "analysis id": "1111",
                "relation to proband": "proband",
                "report required": "Y",
                "workup type": "WGS",
                "specimen id": "1",
            },
            1,
        ),
        (
            {
                "individual id": "123",
                "sex": "F",
                "analysis id": "1111",
                "relation to proband": "mother",
                "report required": "N",
                "workup type": "WGS",
                "specimen id": "2",
            },
            2,
        ),
        (
            {
                "individual id": "789",
                "sex": "M",
                "analysis id": "1111",
                "relation to proband": "father",
                "report required": "N",
                "workup type": "WGS",
                "specimen id": "3",
            },
            3,
        ),
        (
            {
                "individual id": "546",
                "sex": "F",
                "analysis id": "1111",
                "relation to proband": "sister",
                "report required": "Y",
                "workup type": "WGS",
                "specimen id": "4",
            },
            4,
        ),
        (
            {
                "individual id": "555",
                "sex": "M",
                "analysis id": "1111",
                "relation to proband": "full brother 1",
                "report required": "Y",
                "workup type": "WGS",
                "specimen id": "5",
            },
            5,
        ),
    ]


@pytest.fixture
def example_rows_obj(testapp, example_rows, project, institution):
    return AccessionMetadata(
        testapp, example_rows, project, institution, TEST_INGESTION_ID1
    )


@pytest.fixture
def example_rows_pedigree():
    return [
        (
            {
                "family id": "0101",
                "individual id": "456",
                "mother id": "123",
                "father id": "789",
                "sex": "F",
                "proband": "Y",
                "hpo terms": "HP:0000001, HP:0099994",
                "mondo terms": "MONDO:0012345",
            },
            1,
        ),
        (
            {
                "family id": "0101",
                "individual id": "123",
                "mother id": "223",
                "father id": "323",
                "sex": "F",
                "proband": "N",
                "hpo terms": "HP:0099994",
                "mondo terms": "",
            },
            2,
        ),
        (
            {
                "family id": "0101",
                "individual id": "789",
                "mother id": "",
                "father id": "",
                "sex": "M",
                "proband": "N",
                "hpo terms": "",
                "mondo terms": "",
            },
            3,
        ),
        (
            {
                "family id": "0101",
                "individual id": "423",
                "mother id": "223",
                "father id": "323",
                "sex": "M",
                "proband": "N",
                "hpo terms": "",
                "mondo terms": "",
            },
            4,
        ),
        (
            {
                "family id": "0101",
                "individual id": "223",
                "mother id": "",
                "father id": "",
                "sex": "F",
                "proband": "N",
                "hpo terms": "HP:0099994, HP:0012345",
                "mondo terms": "",
            },
            5,
        ),
        (
            {
                "family id": "0101",
                "individual id": "323",
                "mother id": "",
                "father id": "",
                "sex": "F",
                "proband": "N",
                "hpo terms": "",
                "mondo terms": "MONDO:0045732, MONDO:0043872",
            },
            6,
        ),
        (
            {
                "family id": "0101",
                "individual id": "156",
                "mother id": "456",
                "father id": "",
                "sex": "F",
                "proband": "N",
                "hpo terms": "",
                "mondo terms": "",
                "pregnancy": "y",
                "gestational age": "25",
                "gestational age units": "week",
            },
            7,
        ),
    ]


@pytest.fixture
def example_rows_pedigree_obj(testapp, example_rows_pedigree, project, institution):
    return PedigreeMetadata(
        testapp, example_rows_pedigree, project, institution, TEST_INGESTION_ID1
    )


@pytest.fixture
def first_family():
    return {
        "@graph": [
            {
                "aliases": ["encode-project:family-456"],
                "proband": "encode-project:individual-456",
                "members": ["encode-project:individual-456"],
            }
        ]
    }


@pytest.fixture
def new_family(child, mother, father):
    return {
        "title": "Smith family",
        "proband": child["@id"],
        "members": [child["@id"], mother["@id"], father["@id"]],
    }


@pytest.fixture
def pedigree_row(row_dict_pedigree, project, institution):
    """A PedigreeRow without errors."""
    return PedigreeRow(row_dict_pedigree, 1, project["name"], institution["name"])


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
    result = map_fields(sample_info, {}, [], "sample")
    assert result["workup_type"] == "WES"
    assert result["specimen_accession"] == "9034"
    assert result["specimen_collection_date"] == "2020-01-06"
    assert not result.get("sequencing_lab")


@pytest.mark.parametrize(
    "row,columns,expected",
    [
        ({}, ["foo", "bar"], "bar"),
        ({"bar": ""}, ["foo"], "foo"),
        ({"bar": ""}, ["foo", "bar"], "bar"),
        ({"bar": ""}, ["bar", "foo"], "bar"),
        ({"bar": None}, ["bar", "foo"], "foo"),
    ],
)
def test_get_column_name(row, columns, expected):
    """Test retrieval of header from row when multiple headers
    corresponding to same data field exist.
    """
    result = get_column_name(row, columns)
    assert result == expected


@pytest.mark.parametrize(
    "term, result",
    [
        ("hp_12345", "HP:12345"),
        ("mOndO_765432", "MONDO:765432"),
        ("mondo:123", "MONDO:123"),
        ("hpo12345", "HPO12345"),
    ],
)
def test_format_ontology_term_with_colon(term, result):
    assert format_ontology_term_with_colon(term) == result


class TestAccessionRow:
    @pytest.mark.parametrize(
        "col, val, sample_alias",
        [
            (None, None, "encode-project:sample-3464467-WGS-2"),
            ("test requested", "WES", "encode-project:sample-3464467-WES-2"),
            ("test number", "1", "encode-project:sample-3464467-WGS-1"),
            ("test number", None, "encode-project:sample-3464467-WGS"),
        ],
    )
    def test_row_sample_aliases(
        self, testapp, row_dict, col, val, sample_alias, project, institution
    ):
        if col:
            row_dict[col] = val
        obj = AccessionRow(
            testapp, row_dict, 1, "test-proj:fam", project["name"], institution["name"]
        )
        assert obj.sample_alias == sample_alias

    def test_extract_individual_metadata(self, testapp, row_dict, project, institution):
        obj = AccessionRow(
            testapp, row_dict, 1, "test-proj:fam1", project["name"], institution["name"]
        )
        assert obj.indiv_alias == "encode-project:individual-456"
        assert obj.individual.metadata["aliases"] == [obj.indiv_alias]
        assert obj.individual.metadata["individual_id"] == row_dict["individual id"]

    @pytest.mark.parametrize(
        "age, birth_year, val_type", [("33", "1986", int), ("abc", "def", str)]
    )
    def test_extract_individual_metadata_nums(
        self, testapp, row_dict, age, birth_year, val_type, project, institution
    ):
        """
        numerical values for age and birth year are expected
        text values for age and birth year should be passed on without errors to eventually fail validation
        """
        row_dict["age"] = age
        row_dict["birth year"] = birth_year
        obj = AccessionRow(
            testapp, row_dict, 1, "test-proj:fam1", project["name"], institution["name"]
        )
        assert isinstance(obj.individual.metadata["age"], val_type)
        assert not obj.errors

    @pytest.mark.parametrize(
        "relation, error", [("proband", False), ("grandmother", True)]
    )
    def test_extract_family_metadata_new(
        self, testapp, row_dict, project, institution, relation, error
    ):
        """
        Currently without pedigree processing, can only parse proband/mother/father/sibling relationships.
        Other relationships like 'grandmother' should result in an error message, but in the future may
        be permitted with a pedigree file.
        """
        row_dict["relation to proband"] = relation
        obj = AccessionRow(
            testapp, row_dict, 1, "test-proj:fam1", project["name"], institution["name"]
        )
        assert obj.family.alias == "test-proj:fam1"
        assert obj.family.metadata["members"] == ["encode-project:individual-456"]
        if relation == "proband":
            assert obj.family.metadata["proband"] == "encode-project:individual-456"
        assert not obj.errors == (not error)  # check presence of errors
        # check for correct error message
        assert ("Row 1 - Invalid relation" in "".join(obj.errors)) == error

    def test_extract_family_metadata_extended_fail(
        self, testapp, row_dict_uncle, project, institution
    ):
        """
        Currently without pedigree processing, can only parse proband/mother/father/sibling
        relationships without pedigree file (but may pass if pedigree file has already been
        uploaded with the relevant individual). This tests that a relationship like "uncle"
        fails if pedigree hasn't been submitted first.
        """
        obj = AccessionRow(
            testapp,
            row_dict_uncle,
            1,
            "test-proj:fam1",
            project["name"],
            institution["name"],
        )
        assert obj.family.alias == "test-proj:fam1"
        assert obj.family.metadata["members"] == ["encode-project:individual-455"]
        assert len(obj.errors) > 0  # check presence of errors
        # check for correct error message
        assert "Row 1 - Invalid relation" in "".join(obj.errors)
        assert "please submit family history first" in "".join(obj.errors)

    def test_extract_family_metadata_extended_pass(
        self, workbook, es_testapp, row_dict_uncle
    ):
        """
        Currently without pedigree processing, can only parse proband/mother/father/sibling
        relationships without pedigree file (but may pass if pedigree file has already been
        uploaded with the relevant individual). This tests that a relationship like "uncle"
        passes if pedigree has been submitted first.
        """
        obj = AccessionRow(
            es_testapp, row_dict_uncle, 1, "hms-dbmi:family-456", "hms-dbmi", "hms-dbmi"
        )
        assert obj.family.metadata["members"] == ["hms-dbmi:individual-455"]
        assert not obj.errors

    def test_extract_sample_metadata(self, testapp, row_dict, project, institution):
        """
        Some fields are formatted differently in spreadsheets vs in DB -
        ex.
        'Yes' --> 'Accepted' / 'No' --> 'Rejected' for requisition accepted field
        'Y' --> 'Yes' / 'N' --> 'No' for specimen accepted field
        """
        row_dict["req accepted y/n"] = "Yes"
        row_dict["specimen accepted by ref lab"] = "n"
        obj = AccessionRow(
            testapp, row_dict, 1, "test-proj:fam1", project["name"], institution["name"]
        )
        assert obj.sample.metadata["specimen_accession"] == row_dict["specimen id"]
        assert obj.sample.metadata["specimen_accepted"] == "No"
        assert obj.sample.metadata["specimen_type"] == "peripheral blood"
        assert (
            obj.sample.metadata["requisition_acceptance"]["accepted_rejected"]
            == "Accepted"
        )
        assert obj.analysis.metadata["samples"] == [obj.sample.alias]
        assert obj.individual.metadata["samples"] == [obj.sample.alias]

    def test_extract_file_metadata_valid(self, testapp, row_dict, project, institution):
        """expected file extensions in spreadsheet"""
        row_dict["files"] = "f1.fastq.gz, f2.cram, f3.vcf.gz"
        files = [f.strip() for f in row_dict["files"].split(",")]
        obj = AccessionRow(
            testapp, row_dict, 1, "fam1", project["name"], institution["name"]
        )
        assert files[0] in obj.files_fastq[0].alias
        assert obj.files_fastq[0].metadata["file_format"] == "/file-formats/fastq/"
        assert obj.files_fastq[0].metadata["file_type"] == "reads"
        assert obj.files_processed[0].alias == "encode-project:f2.cram"
        assert files[2] in obj.files_processed[1].alias
        assert not obj.errors

    def test_extract_file_metadata_uncompressed(
        self, testapp, row_dict, project, institution
    ):
        """filenames indicating uncompressed fastqs/vcfs should lead to errors"""
        row_dict["files"] = "f1.fastq, f2.cram, f3.vcf"
        files = [f.strip() for f in row_dict["files"].split(",")]
        obj = AccessionRow(
            testapp, row_dict, 1, "fam1", project["name"], institution["name"]
        )
        assert not obj.files_fastq
        assert obj.files_processed[0].alias == "encode-project:f2.cram"
        assert files[2] not in "".join([f.alias for f in obj.files_processed])
        assert all("File must be compressed" in error for error in obj.errors)

    def test_extract_file_metadata_invalid(
        self, testapp, row_dict, project, institution
    ):
        """# file extensions other than fastq.gz,.cram, .vcf.gz should generate an error"""
        row_dict["files"] = "f3.gvcf.gz"
        files = [f.strip() for f in row_dict["files"].split(",")]
        obj = AccessionRow(
            testapp, row_dict, 1, "fam1", project["name"], institution["name"]
        )
        assert not obj.files_processed
        assert "File extension on f3.gvcf.gz not supported - " in "".join(obj.errors)

    @pytest.mark.parametrize(
        "field, error",
        [
            ("workup type", False),
            ("specimen id", True),
            ("individual id", True),
            ("family id", False),
            ("relation to proband", True),
            ("analysis id", True),
            ("report required", True),
            ("specimen type", False),
            ("alsdkjfdk", False),
        ],
    )
    def test_found_missing_values(
        self, testapp, row_dict, project, institution, field, error
    ):
        """some columns are required for spreadsheet submission, others are optional."""
        row_dict[field] = None
        obj = AccessionRow(
            testapp, row_dict, 1, "fam1", project["name"], institution["name"]
        )
        assert (len(obj.errors) > 0) == error
        assert (
            "Row 1 - missing required field(s) {}. This row cannot be processed."
            "".format(field) in obj.errors
        ) == error

    @pytest.mark.parametrize(
        "num, val", [(0, 1), (1, 2), (2, 1), (3, 2), (4, 1), (5, 2)]
    )
    def test_get_paired_end_value(self, num, val):
        assert AccessionRow.get_paired_end_value(num) == val


class TestAccessionMetadata:
    def test_init_families(self, example_rows_obj, project):
        """test family aliases are named after proband individual ids"""
        proj_name = project["name"] + ":"
        fams = example_rows_obj.family_dict
        assert sorted(list(fams.keys())) == ["1111", "2222", "3333", "4444"]
        assert fams["1111"] == proj_name + "family-456"
        assert fams["2222"] == proj_name + "family-456"
        assert fams["3333"] == proj_name + "family-555"

    def test_get_analysis_types(
        self, testapp, example_rows_obj, example_rows, project, institution
    ):
        """Test analysis type string calculation for cases."""
        a_types = example_rows_obj.analysis_types
        assert a_types["1111"] == "WGS-Trio"
        assert a_types["2222"] == "WGS"
        assert a_types["3333"] == "WES-Group"
        example_rows[1][0]["test requested"] = "WES"
        new_obj = AccessionMetadata(
            testapp, example_rows, project, institution, TEST_INGESTION_ID1
        )
        assert not new_obj.errors
        new_a_types = new_obj.analysis_types
        assert new_a_types["1111"] == "WES/WGS-Trio"
        del example_rows[1][0]["workup type"]
        example_rows[1][0]["test requested"] = ""
        new_obj = AccessionMetadata(
            testapp, example_rows, project, institution, TEST_INGESTION_ID1
        )
        assert new_obj.errors

    @pytest.mark.parametrize(
        "relations,expected",
        [
            (["proband"], ""),
            (["proband", "mother", "father"], "-Trio"),
            (["mother", "proband", "father"], "-Trio"),
            (["proband", "mother"], "-Group"),
            (["foo"], "-Group"),
            ([], "-Group"),
        ],
    )
    def test_get_analysis_type_add_on(self, example_rows_obj, relations, expected):
        """Test analysis label based on relations."""
        result = example_rows_obj.get_analysis_type_add_on(relations)
        assert result == expected

    def test_add_metadata_single_item(
        self, testapp, example_rows, project, institution
    ):
        """
        if json for an item was already created in a previous row, any new fields for that
        item in the current row should be added to the existing json.
        if the current row has less information than the previous json item, the fields in
        the previous json item won't get overwritten.
        """
        for rowidx in (1, 2):
            data = [
                ({k: v for k, v in example_rows[0][0].items()}, 0),
                # 2 rows have same sample
                ({k: v for k, v in example_rows[1][0].items()}, 1),
                ({k: v for k, v in example_rows[1][0].items()}, 2),
            ]
            data[rowidx][0]["specimen accepted by ref lab"] = "Y"
        submission = AccessionMetadata(
            testapp, data, project, institution, TEST_INGESTION_ID1
        )
        assert len(submission.individuals) == 2
        assert len(submission.samples) == 2
        assert "specimen_accepted" in list(submission.samples.values())[1]

    def test_add_metadata_single_item_fastq(
        self, testapp, example_rows, project, institution
    ):
        """
        if fastq files appear multiple times in the sheet, the related_file array prop shouldn't be
        duplicated if it is consistent.
        """
        # for rowidx in (1, 2):
        example_rows[0][0]["files"] = "f1.fastq.gz, f2.fastq.gz"
        example_rows[1][0]["files"] = "f1.fastq.gz, f2.fastq.gz"
        submission = AccessionMetadata(
            testapp, example_rows, project, institution, TEST_INGESTION_ID1
        )
        fastqs = list(submission.files_fastq.values())
        assert len(fastqs[1]["related_files"]) == 1

    @pytest.mark.parametrize(
        "files1, files2",
        [
            (
                "f1.fastq.gz, f2.fastq.gz",
                "f1.fastq.gz, f3.fastq.gz",
            ),  # inconsistent pairing on first
            (
                "f1.fastq.gz, f2.fastq.gz",
                "f4.fastq.gz, f2.fastq.gz",
            ),  # inconsistent pairing on second
        ],
    )
    def test_add_metadata_single_item_fastq_inconsistent(
        self, testapp, example_rows, files1, files2, project, institution
    ):
        """
        if fastq files appear multiple times in the sheet, the related_file array prop shouldn't be
        duplicated if it is consistent.
        """
        # for rowidx in (1, 2):
        example_rows[0][0]["files"] = files1
        example_rows[1][0]["files"] = files2
        submission = AccessionMetadata(
            testapp, example_rows, project, institution, TEST_INGESTION_ID1
        )
        assert "Please ensure fastq is paired with correct file in all rows" in "".join(
            submission.errors
        )
        # fastqs = list(submission.files_fastq.values())
        # assert len(fastqs[1]['related_files']) == 1

    def test_add_metadata_single_item_same_sample_accession(
        self, testapp, example_rows_with_test_number, project, institution
    ):
        """
        if samples have the same specimen_accession but different test number, the bam_sample_id
        should be unique but the specimen_accession should stay the same.
        """
        submission = AccessionMetadata(
            testapp,
            example_rows_with_test_number,
            project,
            institution,
            TEST_INGESTION_ID1,
        )
        accession1 = [
            item
            for item in submission.samples.values()
            if item["specimen_accession"] == "1"
        ]
        assert (
            accession1[0]["specimen_accession"] == accession1[1]["specimen_accession"]
        )
        assert accession1[0]["bam_sample_id"] != accession1[1]["bam_sample_id"]

    @pytest.mark.parametrize(
        "last_relation, error",
        [
            ("brother", False),  # not a duplicate relation
            (
                "mother",
                True,
            ),  # error if two members of family have same parental relation
            ("sister", False),  # two siblings can have same relation
        ],
    )
    def test_add_family_metadata(
        self, testapp, big_family_rows, project, institution, last_relation, error
    ):
        """
        tests handling of duplicate relations for parents vs siblings.
        before modification, fixture contains proband, mother, father, sister.
        """
        big_family_rows[4][0]["relation to proband"] = last_relation
        submission = AccessionMetadata(
            testapp, big_family_rows, project, institution, TEST_INGESTION_ID1
        )
        assert len(submission.families) == 1
        fam = list(submission.families.values())[0]
        assert len(fam["members"]) == 5
        assert (len(submission.errors) > 0) == error
        assert ("Multiple values for relation" in "".join(submission.errors)) == error

    def test_add_sample_processing(self, testapp, example_rows, project, institution):
        """tests metadata creation for sample_processing item from a set of rows"""
        example_rows[6][0]["workup type"] = ""  # trigger error for row 7
        submission = AccessionMetadata(
            testapp, example_rows, project, institution, TEST_INGESTION_ID1
        )
        sps = submission.sample_processings
        assert sps["encode-project:analysis-1111"]["analysis_type"] == "WGS-Trio"
        assert sps["encode-project:analysis-2222"]["analysis_type"] == "WGS"
        assert sps["encode-project:analysis-1111"]["samples"] == [
            "encode-project:sample-1-WGS",
            "encode-project:sample-2-WGS",
            "encode-project:sample-3-WGS",
        ]
        assert sps["encode-project:analysis-2222"]["samples"] == [
            "encode-project:sample-1-WGS"
        ]
        assert "Row 7" in "".join(submission.errors)

    @pytest.mark.parametrize(
        "case_id, report", [(None, True), ("Case123", True), ("Case123", False)]
    )
    def test_create_case_metadata(
        self, testapp, row_dict, case_id, report, project, institution
    ):
        """tests case and report item creation after all rows processed"""
        if not report:
            row_dict["report required"] = "N"
        row_dict["unique analysis id"] = case_id
        submission = AccessionMetadata(
            testapp, [(row_dict, 0)], project, institution, TEST_INGESTION_ID1
        )
        case = list(submission.cases.values())[0]
        assert row_dict["individual id"] in case["individual"]
        assert case["ingestion_ids"] == [TEST_INGESTION_ID1]
        assert case["family"] == list(submission.families.keys())[0]
        assert (len(submission.reports) > 0) == report
        case_alias = list(submission.cases.keys())[0]
        if case_id:
            assert case_id in case_alias
        else:
            assert (
                "{}-{}".format(row_dict["analysis id"], row_dict["specimen id"])
                in case_alias
            )
        if report:
            assert case["report"]

    @pytest.mark.parametrize("case_id", [(None), ("Case123")])
    def test_add_case_info(self, testapp, row_dict, case_id, project, institution):
        """tests that case ID from row gets added to proper dictionary attribute"""
        row_dict["unique analysis id"] = case_id
        submission = AccessionMetadata(
            testapp, [(row_dict, 0)], project, institution, TEST_INGESTION_ID1
        )
        key = "{}-{}".format(row_dict["analysis id"], row_dict["specimen id"])
        assert submission.case_info.get(key)["case id"] == case_id

    def test_add_individual_relations(
        self, testapp, big_family_rows, project, institution
    ):
        """
        tests that correct proband mother and father get added to individual item metadata
        after all rows are processed
        """
        obj = AccessionMetadata(
            testapp, big_family_rows, project, institution, TEST_INGESTION_ID1
        )
        proband = obj.individuals["encode-project:individual-456"]
        sister = obj.individuals["encode-project:individual-546"]
        brother = obj.individuals["encode-project:individual-555"]
        parent = obj.individuals["encode-project:individual-789"]
        assert all(field in proband for field in ["mother", "father"])
        assert all(field not in parent for field in ["mother", "father"])
        assert proband["mother"] == sister["mother"] == brother["mother"]
        assert proband["father"] == sister["father"] == brother["father"]
        assert not any(
            field in obj.families["encode-project:family-456"]
            for field in ["mother", "father", "sister", "brother"]
        )

    def test_process_rows(self, example_rows_obj, project, institution):
        """tests that all rows get processed and create desired number and type of json items"""
        assert example_rows_obj.json_out
        assert len(example_rows_obj.individuals) == 5
        assert len(example_rows_obj.families) == 2
        assert len(example_rows_obj.samples) == 6
        assert len(example_rows_obj.sample_processings) == 4
        assert len(example_rows_obj.cases) == 7
        assert len(example_rows_obj.reports) == 4
        assert (
            len(
                example_rows_obj.individuals["encode-project:individual-456"]["samples"]
            )
            == 2
        )

    def test_create_json_out(self, example_rows_obj, project, institution):
        """tests that all expected items are present in final json as well as
        project and institution fields"""
        assert all(
            key in example_rows_obj.json_out
            for key in [
                "individual",
                "family",
                "sample",
                "sample_processing",
                "case",
                "report",
            ]
        )
        for key, val in example_rows_obj.json_out.items():
            if key != "errors":
                for val2 in val.values():
                    assert val2["project"]
                    assert val2["institution"]
                    assert all(
                        val3 for val3 in val2.values()
                    )  # test all None values are removed


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
                {
                    "phenotypic_features": [
                        {"phenotypic_feature": "/phenotypes/HP:0001111/"}
                    ]
                },
            ),
            (
                {"foo": "bar", "phenotypic_features": "HP:0001111"},
                {
                    "foo": "bar",
                    "phenotypic_features": [
                        {"phenotypic_feature": "/phenotypes/HP:0001111/"}
                    ],
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
                        {
                            "disorder": "/disorders/MONDO:0001111/",
                            "is_primary_diagnosis": True,
                        }
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
                        {
                            "disorder": "/disorders/MONDO:0001111/",
                            "is_primary_diagnosis": True,
                        },
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
                [
                    {
                        "disorder": "/disorders/MONDO:0001111/",
                        "is_primary_diagnosis": True,
                    }
                ],
            ),
            (
                "MONDO:0001111, MONDO:0001111",
                None,
                None,
                None,
                False,
                [
                    {
                        "disorder": "/disorders/MONDO:0001111/",
                        "is_primary_diagnosis": True,
                    }
                ],
            ),
            ("MONDO:0001111, MONDO:0001112", None, None, None, True, []),
            (
                "MONDO:0001111, MONDO:foo",
                None,
                None,
                None,
                True,
                [
                    {
                        "disorder": "/disorders/MONDO:0001111/",
                        "is_primary_diagnosis": True,
                    }
                ],
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
            (
                "Foo, MONDO:0007947, MONDO:001",
                True,
                [{"disorder": "/disorders/MONDO:0007947/"}],
            ),
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
    def test_add_individual_metadata(
        self, testapp, example_rows_pedigree, project, institution
    ):
        """
        if json for an item was already created in a previous row, any new fields for that
        item in the current row should be added to the existing json.
        if the current row has less information than the previous json item, the fields in
        the previous json item won't get overwritten.
        """
        for rowidx in (1, 2):
            data = [
                ({k: v for k, v in example_rows_pedigree[0][0].items()}, 1),
                # 2 rows have same sample
                ({k: v for k, v in example_rows_pedigree[6][0].items()}, 2),
                ({k: v for k, v in example_rows_pedigree[6][0].items()}, 3),
            ]
            submission = PedigreeMetadata(
                testapp, data, project, institution, TEST_INGESTION_ID1
            )
            assert (
                len(submission.individuals) == 4
            )  # row 0, row 6, + 2 parents of row[0]
            # assert len(submission.families) == 1
            assert "is_pregnancy" in list(submission.individuals.values())[1]
            assert list(submission.individuals.values())[1]["is_pregnancy"] == True

    def test_add_family_metadata(
        self,
        testapp,
        example_rows_pedigree,
        example_rows_pedigree_obj,
        project,
        institution,
    ):
        assert len(example_rows_pedigree_obj.families) == 1
        fam = list(example_rows_pedigree_obj.families.values())[0]
        assert fam["proband"] == "encode-project:individual-456"
        assert len(fam["members"]) == len(example_rows_pedigree)

    def test_add_family_metadata_db_single(
        self, workbook, es_testapp, example_rows_pedigree, wb_project, wb_institution
    ):
        """Tests that if a family ID is already in the database, the atid is used as an identifier instead
        of the new alias. Additionally, if the proband designation is missing from the family history rows,
        the PedigreeMetadata object still gets created without error messages when the family is in the DB already.
        """
        example_rows_pedigree[0][0]["proband"] == "N"
        submission = PedigreeMetadata(
            es_testapp,
            example_rows_pedigree,
            wb_project,
            wb_institution,
            TEST_INGESTION_ID1,
        )
        assert len(submission.families) == 1
        fam = list(submission.families.values())[0]
        assert list(submission.families.keys())[0] == WORKBOOK_FAMILY_ID1
        assert len(fam["members"]) == len(example_rows_pedigree)
        assert len(submission.errors) == 0

    def test_add_family_metadata_db_multi(
        self, workbook, es_testapp, example_rows_pedigree, wb_project, wb_institution
    ):
        """Tests that if 2 items are in the DB with same familyID, that both of these are reflected in the
        PedigreeMetadata object. Checks that both items have all members and proband of each isn't changed."""
        for row in example_rows_pedigree:
            row[0]["family id"] = "0102"
        submission = PedigreeMetadata(
            es_testapp,
            example_rows_pedigree,
            wb_project,
            wb_institution,
            TEST_INGESTION_ID1,
        )
        assert len(submission.families) == 2
        assert sorted(list(submission.families.keys())) == sorted(
            [WORKBOOK_FAMILY_ID2, WORKBOOK_FAMILY_ID3]
        )
        for fam in submission.families.values():
            assert len(fam["members"]) == len(example_rows_pedigree)
            assert "proband" not in fam

    def test_add_family_metadata_no_proband(
        self, testapp, example_rows_pedigree, project, institution
    ):
        del example_rows_pedigree[0][0]["proband"]
        submission = PedigreeMetadata(
            testapp, example_rows_pedigree, project, institution, TEST_INGESTION_ID1
        )
        assert len(submission.errors) > 0
        assert (
            "No proband indicated for family 0101. Please edit and resubmit"
            in "".join(submission.errors)
        )
        print(submission.errors)

    def test_process_rows(self, example_rows_pedigree_obj):
        assert len(example_rows_pedigree_obj.families) == 1
        assert len(example_rows_pedigree_obj.individuals) == 7
        assert not example_rows_pedigree_obj.errors

    def test_json_out(self, example_rows_pedigree_obj):
        assert sorted(list(example_rows_pedigree_obj.json_out.keys())) == [
            "errors",
            "family",
            "individual",
        ]
        assert not example_rows_pedigree_obj.json_out["errors"]
        assert len(example_rows_pedigree_obj.json_out["family"]) == 1
        assert len(example_rows_pedigree_obj.json_out["individual"]) == 7

    def test_check_individuals(
        self, testapp, example_rows_pedigree, project, institution
    ):
        submission = PedigreeMetadata(
            testapp,
            [example_rows_pedigree[0]],
            project,
            institution,
            TEST_INGESTION_ID1,
        )
        assert sorted(list(submission.json_out.keys())) == [
            "errors",
            "family",
            "individual",
        ]
        assert not submission.json_out["errors"]
        assert len(submission.json_out["family"]) == 1
        assert len(submission.json_out["individual"]) == 3


class TestSpreadsheetProcessing:
    @pytest.mark.parametrize(
        "remove_row, success_bool",
        [
            (
                0,
                True,
            ),  # super header missing should work ok (e.g. 'Patient Information' row)
            (1, False),  # main header missing should cause a caught error
            (2, True),  # missing comment row should work ok
        ],
    )
    def test_header_found(
        self, testapp, project, institution, xls_list, remove_row, success_bool
    ):
        """tests that proper header is found when present"""
        data = iter(xls_list[0:remove_row] + xls_list[(remove_row) + 1 :])
        obj = AccessionProcessing(
            testapp, data, project, institution, TEST_INGESTION_ID1
        )
        assert obj.passing == success_bool
        assert (len(obj.errors) == 0) == success_bool
        assert (
            "Column headers not detected in spreadsheet!" in "".join(obj.errors)
        ) == (not success_bool)

    def test_create_row_dict(self, testapp, xls_list, project, institution):
        """tests that dictionary of colname: field value is created for each row"""
        obj = AccessionProcessing(
            testapp, iter(xls_list), project, institution, TEST_INGESTION_ID1
        )
        assert obj.keys
        assert len(obj.rows) == 3
        rows = list(map(lambda x: x[0], obj.rows))
        for row in rows:
            assert all(key in row for key in obj.keys)

    def test_create_row_dict_missing_col(self, testapp, xls_list, project, institution):
        """tests that correct error is returned when a required column header is not in spreadsheet"""
        idx = xls_list[1].index("Specimen ID")
        rows = (row[0:idx] + row[idx + 1 :] for row in xls_list)
        obj = AccessionProcessing(
            testapp, rows, project, institution, TEST_INGESTION_ID1
        )
        assert not obj.passing
        assert 'Column(s) "specimen id" not found in spreadsheet!' in "".join(
            obj.errors
        )

    @pytest.mark.parametrize(
        "remove_row, success_bool",
        [
            (0, False),  # main header missing should cause a caught error
            (8, True),  # last data row missing shouldn't cause issues
        ],
    )
    def test_header_found_pedigree(
        self, testapp, project, institution, xls_list_pedigree, remove_row, success_bool
    ):
        """tests that proper header is found when present"""
        data = iter(
            xls_list_pedigree[0:remove_row] + xls_list_pedigree[(remove_row) + 1 :]
        )
        obj = PedigreeProcessing(
            testapp,
            data,
            project,
            institution,
            TEST_INGESTION_ID1,
            submission_type="family_history",
        )
        assert obj.passing == success_bool
        assert (len(obj.errors) == 0) == success_bool
        assert (
            "Column headers not detected in spreadsheet!" in "".join(obj.errors)
        ) == (not success_bool)

    def test_create_row_dict_pedigree(
        self, testapp, xls_list_pedigree, project, institution
    ):
        """tests that dictionary of colname: field value is created for each row"""
        obj = PedigreeProcessing(
            testapp,
            iter(xls_list_pedigree),
            project,
            institution,
            TEST_INGESTION_ID1,
            submission_type="family_history",
        )
        assert obj.keys
        assert len(obj.rows) == 8
        rows = list(map(lambda x: x[0], obj.rows))
        for row in rows:
            assert all(key in row for key in obj.keys)

    @pytest.mark.parametrize(
        "col, success_bool",
        [
            ("Sex", False),  # required column
            ("Family ID:", False),  # required column
            ("HPO terms", True),  # not required
        ],
    )
    def test_create_row_dict_pedigree_missing_col(
        self, testapp, xls_list_pedigree, project, institution, col, success_bool
    ):
        """tests that correct error is returned when a required column header is not in spreadsheet"""
        idx = xls_list_pedigree[0].index(col)
        rows = (row[0:idx] + row[idx + 1 :] for row in xls_list_pedigree)
        obj = PedigreeProcessing(
            testapp,
            rows,
            project,
            institution,
            TEST_INGESTION_ID1,
            submission_type="family_history",
        )
        assert obj.passing == success_bool
        if not success_bool:
            assert 'Column(s) "{}" not found in spreadsheet!'.format(
                col.lower().strip(":")
            ) in "".join(obj.errors)

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
        ],
    )
    def test_reformat_column_header(self, entry, expected):
        """Test column header in spreadsheet reformatted correctly."""
        result = SpreadsheetProcessing.reformat_column_header(entry)
        assert result == expected


def test_xls_to_json_accessioning(testapp, project, institution):
    """tests that xls_to_json returns expected output when a spreadsheet is formatted correctly"""
    rows = digest_xlsx(TEST_WORKBOOK)
    json_out, success = xls_to_json(
        testapp, rows, project, institution, TEST_INGESTION_ID1, "accessioning"
    )
    assert success
    assert len(json_out["family"]) == 1
    assert "encode-project:family-456" in json_out["family"]
    assert len(json_out["individual"]) == 3
    assert all(
        [
            "encode-project:individual-" + x in json_out["individual"]
            for x in ["123", "456", "789"]
        ]
    )


def test_xls_to_json_pedigree(testapp, project, institution):
    """tests that xls_to_json returns expected output when a spreadsheet is formatted correctly"""
    rows = digest_xlsx(TEST_WORKBOOK_PEDIGREE)
    json_out, success = xls_to_json(
        testapp, rows, project, institution, TEST_INGESTION_ID1, "family_history"
    )
    assert success
    assert len(json_out["family"]) == 1
    assert "encode-project:family-IND201" in json_out["family"]
    assert len(json_out["individual"]) == 8
    assert all(
        [
            "encode-project:individual-" + x in json_out["individual"]
            for x in [
                "IND201",
                "IND202",
                "IND203",
                "IND204",
                "IND205",
                "IND206",
                "IND207",
                "IND208",
            ]
        ]
    )


def test_xls_to_json_accessioning_errors(testapp, project, institution):
    """tests for expected output when spreadsheet is not formatted correctly"""
    rows = digest_xlsx(TEST_WORKBOOK_WITH_ERRORS)
    json_out, success = xls_to_json(
        testapp, rows, project, institution, TEST_INGESTION_ID1, "accessioning"
    )
    assert "Row 4" in "".join(json_out["errors"])  # row counting info correct
    assert success  # still able to proceed to validation step


def test_xls_to_json_pedigree_errors(testapp, project, institution):
    """tests for expected output when spreadsheet is not formatted correctly"""
    rows = digest_xlsx(TEST_PEDIGREE_WITH_ERRORS)
    json_out, success = xls_to_json(
        testapp, rows, project, institution, TEST_INGESTION_ID1, "family_history"
    )
    joined_errors = "".join(json_out["errors"])
    assert "Row 5" in joined_errors
    assert "HP:00000821" in joined_errors
    assert "Row 9 - missing required field(s) family id." in joined_errors
    assert success


@pytest.mark.parametrize(
    "digested_xlsx, expected_error_rows",
    [
        (BLANK_BEFORE_HEADER, [3]),
        (BLANK_AFTER_HEADER, [3]),
        (BLANK_BT_ROWS, [2, 4]),
        (BLANK_AFTER_HEADER_AND_BT_ROWS, [3, 5]),
        (BLANK_AFTER_ROWS, [2]),
        (BLANK_COMBINATION, [4, 6]),
        (BLANK_NO_ERRORS, []),
    ],
)
def test_xls_to_json_accession_row_counting(
    testapp, project, institution, digested_xlsx, expected_error_rows
):
    """
    Test for correct row counting in SpreadsheetProcessing, specifically
    accounting for blank rows in Case ingestion submissions.

    Types of cases:
        - blank row(s) before header
        - blank row(s) directly after header
        - blank row(s) between rows with erroneous data
        - blank row(s) after rows with erroneous data
        - combination of placement of blank row(s)
        - blank row(s) in spreadsheet with no erroneous rows

    :param digested_xlsx: list representing contents of spreadsheet
    :type digested_xlsx: list[lists[str]]
    :param expected_error_rows: row positions within spreadsheet with erroneous rows
    :type expected_error_rows: list[int]
    """
    rows = (row for row in digested_xlsx)
    json_out, success = xls_to_json(
        testapp, rows, project, institution, TEST_INGESTION_ID1, "accessioning"
    )
    joined_errors = "".join(json_out["errors"])
    for row_with_error in expected_error_rows:
        assert f"Row {str(row_with_error)}" in joined_errors
    assert success


@pytest.mark.parametrize(
    "digested_xlsx, expected_error_rows",
    [
        (BLANK_BEFORE_HEADER_PED, [3]),
        (BLANK_AFTER_HEADER_PED, [3]),
        (BLANK_BT_ROWS_PED, [2, 4]),
        (BLANK_BEFORE_HEADER_AND_BT_ROWS_PED, [3, 5]),
        (BLANK_AFTER_HEADER_AND_BT_ROWS_PED, [3, 5]),
        (BLANK_AFTER_ROWS_PED, [2]),
        (BLANK_COMBINATION_PED, [4, 6]),
        (BLANK_NO_ERRORS_PED, []),
    ],
)
def test_xls_to_json_pedigree_row_counting(
    testapp, project, institution, digested_xlsx, expected_error_rows
):
    """
    Test for correct row counting in SpreadsheetProcessing, specifically
    accounting for blank rows in Family History ingestion submissions.

    Types of cases:
        - blank row(s) before header
        - blank row(s) directly after header
        - blank row(s) between rows with erroneous data
        - blank row(s) after rows with erroneous data
        - combination of placement of blank row(s)
        - blank row(s) in spreadsheet with no erroneous rows

    :param digested_xlsx: list representing contents of spreadsheet
    :type digested_xlsx: list[lists[str]]
    :param expected_error_rows: row positions within spreadsheet with erroneous rows
    :type expected_error_rows: list[int]
    """
    rows = (
        row for row in digested_xlsx
    )  # make generator out of the digested_xlsx parameter
    json_out, success = xls_to_json(
        testapp, rows, project, institution, TEST_INGESTION_ID1, "family_history"
    )
    joined_errors = "".join(json_out["errors"])
    for row_with_error in expected_error_rows:
        assert f"Row {str(row_with_error)}" in joined_errors
    assert success


def test_parse_exception_invalid_alias(testapp, a_case):
    a_case["invalid_field"] = "value"
    a_case["project"] = "/projects/invalid-project/"
    errors = []
    try:
        testapp.post_json("/case", a_case)
    except Exception as e:
        errors = parse_exception(e, ["/projects/other-project/"])
    assert len(errors) == 2
    assert "Additional properties are not allowed" in "".join(errors)
    assert "not found" in "".join(errors)


def test_parse_exception_with_alias(testapp, a_case):
    a_case["project"] = "/projects/invalid-project/"
    errors = None
    try:
        testapp.post_json("/case", a_case)
    except Exception as e:
        errors = parse_exception(e, ["/projects/invalid-project/"])
    assert errors == []


def test_compare_fields_same(testapp, fam, new_family):
    """tests that compare_fields returns None when json item has no new info compared to db item"""
    profile = testapp.get("/profiles/family.json").json
    result = compare_fields(profile, [], new_family, fam)
    assert not result


def test_compare_fields_same_seo(
    testapp, file_fastq, file_fastq2, project, institution
):
    """tests that sub-embedded objects that are the same are recognized as the same in compare_fields"""
    db_relation = {
        "related_files": [
            {"relationship_type": "paired with", "file": file_fastq2["@id"]}
        ]
    }
    [file1] = testapp.patch_json(file_fastq["@id"], db_relation).json["@graph"]
    profile = testapp.get("/profiles/file_fastq.json").json
    json_data = {
        "file_format": "/file-formats/fastq/",
        "institution": institution["@id"],
        "project": project["@id"],
        "status": "uploaded",
        "related_files": [
            {"relationship_type": "paired with", "file": "test-project:file2"}
        ],
    }
    result = compare_fields(
        profile, {"test-project:file2": file_fastq2["@id"]}, json_data, file1
    )
    assert not result


def test_compare_fields_different(testapp, aunt, fam, new_family):
    """tests that compare_fields finds differences between json item and db item  when present"""
    new_family["members"].append(aunt["@id"])
    new_family["title"] = "Smythe family"
    profile = testapp.get("/profiles/family.json").json
    result = compare_fields(profile, [], new_family, fam)
    assert len(result) == 2
    assert "title" in result
    assert len(result["members"]) == len(fam["members"]) + 1


def test_compare_fields_array_of_string(
    testapp, case_with_ingestion_id1, case_with_ingestion_id2
):
    """
    tests that compare_fields finds differences between json item and db item when present -
    in this case checks that when the 2 items have a different array, the db array gets extended
    rather than replaced
    """
    profile = testapp.get("/profiles/case.json").json
    result = compare_fields(
        profile, [], case_with_ingestion_id2, case_with_ingestion_id1
    )
    assert "ingestion_ids" in result
    assert len(result["ingestion_ids"]) == 2


def test_validate_item_post_valid(testapp, a_case):
    """tests that no errors are returned when item passes validation"""
    result = validate_item(testapp, a_case, "post", "case", [])
    assert not result


def test_validate_item_post_invalid(testapp, a_case):
    """tests for expected error when item fails validation"""
    a_case["project"] = "/projects/invalid-project/"
    result = validate_item(testapp, a_case, "post", "case", [])
    assert "not found" in result[0]


def test_validate_item_post_invalid_yn(testapp, sample_info, project, institution):
    """
    tests expected error message is generated for fields in which
    spreadsheet value is expected to have a Y/N value but doesn't
    """
    sample_info["req accepted y/n"] = "not sure"
    sample_info["specimen accepted by ref lab"] = "I don't know"
    sample_item = map_fields(sample_info, {}, ["workup_type"], "sample")
    req_info = map_fields(
        sample_info, {}, ["date sent", "date completed"], "requisition"
    )
    sample_item["requisition_acceptance"] = req_info
    sample_item["project"] = project["@id"]
    sample_item["institution"] = institution["@id"]
    result = validate_item(testapp, sample_item, "post", "sample", [])
    assert len(result) == 2
    assert all("is not one of ['Y', 'N']" in error for error in result)


def test_validate_item_patch_valid(testapp, mother, grandpa):
    """tests that patch info passes validation when expected and generates no errors"""
    patch_dict = {"mother": mother["aliases"][0]}
    result = validate_item(
        testapp, patch_dict, "patch", "individual", [], atid=grandpa["@id"]
    )
    assert not result


def test_validate_item_patch_invalid(testapp, grandpa):
    """tests that patch info fails validation when expected and generates error"""
    patch_dict = {"mother": "non-existant-alias"}
    result = validate_item(
        testapp, patch_dict, "patch", "individual", [], atid=grandpa["@id"]
    )
    assert "not found" in result[0]


def test_validate_item_patch_alias(testapp, grandpa):
    """tests that linkTo passes validation if item linked hasn't been posted yet"""
    patch_dict = {"mother": "existing-alias"}
    result = validate_item(
        testapp,
        patch_dict,
        "patch",
        "individual",
        ["existing-alias"],
        atid=grandpa["@id"],
    )
    assert not result


def test_validate_all_items_errors(testapp, mother, empty_items):
    """tests that validation error messages get passed up to parent validate_all_items function result"""
    new_individual = {
        "aliases": ["test-proj:new-individual-alias"],
        "individual_id": "1234",
        "sex": "F",
        "mother": mother["aliases"][0],
        "project": "test-proj:invalid-project-alias",
        "institution": "test-proj:invalid-institution-alias",
    }
    items = empty_items
    items["individual"]["new-individual-alias"] = new_individual
    data_out, result, success = validate_all_items(testapp, items)
    assert not data_out
    assert not success
    assert len(result) > 1
    errors = " ".join(result)
    assert "'test-proj:invalid-project-alias' not found" in errors
    assert "'test-proj:invalid-institution-alias' not found" in errors
    assert mother["aliases"][0] not in errors


def test_post_and_patch_all_items(testapp, post_data):
    output, success, file_info = post_and_patch_all_items(testapp, post_data)
    assert success
    for itemtype in post_data["post"]:
        assert (
            f"{itemtype}: 1 item created (with POST); 0 items failed creation" in output
        )
        if post_data["patch"].get(itemtype):
            assert (
                f"{itemtype}: attributes of 1 item updated (with PATCH); 0 items failed updating"
                in output
            )


def test_post_and_patch_all_items_error(testapp, post_data):
    """
    additional property introduced into 'family' item json  -
    designed to test appropriate error message produced in 'output' when item fails to post
    """
    post_data["post"]["family"][0]["extra_field"] = "extra field value"
    output, success, file_info = post_and_patch_all_items(testapp, post_data)
    assert not success
    assert "family: 0 items created (with POST); 1 item failed creation" in output
