from unittest import mock

import pytest

from ..submit import SubmittedFilesParser


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
def file_parser(testapp):
    """"""
    result = SubmittedFilesParser(testapp, "some_project_name")
    assert not result.errors
    return result


@pytest.fixture
def file_parser_with_search(es_testapp, wb_project):
    """"""
    result = SubmittedFilesParser(es_testapp, wb_project["name"])
    assert not result.errors
    return result


class TestSubmittedFilesParser:

    PROJECT_NAME = "hms-dbmi"  # Project name of wb_project fixture
    GENOME_BUILD = "GChR38"
    VCF_FILE_NAME = "foo_bar.vcf.gz"
    VCF_FILE_PATH = "/path/to/" + VCF_FILE_NAME
    VCF_FILE_ALIAS = "%s:%s" % (PROJECT_NAME, VCF_FILE_NAME)
    VCF_FILE_ITEM = {
        "aliases": [VCF_FILE_ALIAS],
        "file_format": "/file-formats/vcf_gz/",
        "filename": VCF_FILE_PATH,
    }
    VCF_FILE_ITEM_WITH_GENOME_BUILD = {"genome_assembly": GENOME_BUILD}
    VCF_FILE_ITEM_WITH_GENOME_BUILD.update(VCF_FILE_ITEM)
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

    def assert_lists_equal(self, list_1, list_2):
        """"""
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
        """"""
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
        """"""
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
        "accepted_file_formats,expected",
        [
            ([], []),
            (
                [
                    {"standard_file_extension": "foo.bar"},
                    {
                        "standard_file_extension": "bar",
                        "other_allowed_extensions": ["foo", "bar", "foo.bar"],
                    },
                ],
                ["bar", "foo", "foo.bar"],
            ),
        ],
    )
    def test_get_accepted_file_extensions(
        self, file_parser, accepted_file_formats, expected
    ):
        """"""
        with mock.patch(
            "encoded.submit.SubmittedFilesParser.get_accepted_file_formats",
            return_value=accepted_file_formats,
        ) as mocked_file_formats:
            result = file_parser.get_accepted_file_extensions()
            mocked_file_formats.assert_called_once()
            assert result == expected

    @pytest.mark.workbook
    def test_get_accepted_file_formats(self, file_parser_with_search):
        """"""
        result_file_formats = []
        expected_file_formats = ["fastq", "vcf_gz"]
        result = file_parser_with_search.get_accepted_file_formats()
        assert len(result) == 2
        for item in result:
            result_file_formats.append(item.get("file_format"))
        assert sorted(result_file_formats) == sorted(expected_file_formats)

    @pytest.mark.parametrize(
        "file_suffixes,return_values,expected_calls,expected",
        [
            ([], [], [], None),
            (
                [".foo"],
                [[]],
                ["foo"],
                None,
            ),
            (
                [".foo", ".bar"],
                [[], [{"@id": "atid_1"}]],
                ["foo.bar", "bar"],
                "atid_1",
            ),
            (
                [".foo", ".bar"],
                [[{"@id": "atid_1"}]],
                ["foo.bar"],
                "atid_1",
            ),
            (
                [".foo", ".bar"],
                [[{"@id": "atid_1"}, {"@id": "atid_2"}], []],
                ["foo.bar"],
                None,
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
        """"""
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
        """"""
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
        """"""
        result = file_parser_with_search.search_query(query)
        assert isinstance(result, list)
        assert len(result) == expected_length

    @pytest.mark.workbook
    def test_make_get_request(self, file_parser_with_search, wb_project):
        """"""
        get_result = file_parser_with_search.make_get_request(wb_project["@id"])
        for key, value in wb_project.items():
            result_value = get_result.get(key)
            assert result_value == value

        search_query = "/search/?type=Project&uuid=" + wb_project["uuid"]
        search_result = file_parser_with_search.make_get_request(search_query)
        assert search_result["@graph"][0] == wb_project

        search_query = "/search/?type=Project&uuid!=No value"  # 301 follow
        search_result = file_parser_with_search.make_get_request(search_query)
        assert search_result["@graph"]

    def make_file_dicts_for_names(file_names):
        """"""
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
        """"""
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
        """"""
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
        """"""
        result = file_parser.make_expected_paired_end_2_name(file_name)
        assert result == expected
