import pytest

from ..submit import AccessionRow


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
def accession_row(testapp, project, institution, row_dict):
    """"""
    return AccessionRow(
        testapp, row_dict, 0, "family_alias", project["name"], institution["name"]
    )


class TestAccessionRow:
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
    def test_get_paired_end_from_name(self, accession_row, file_name, expected):
        """"""
        result = accession_row.get_paired_end_from_name(file_name)
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
                [("fastq_r1.gz", "fastq_r2.gz"), ("fastq_r1_001.gz", "fastq_r2_001.gz")],
                [],
            ),
        ],
    )
    def test_pair_fastqs_by_name(
        self,
        accession_row,
        fastq_paired_end_1,
        fastq_paired_end_2,
        expected_matches,
        expected_unmatched,
    ):
        """"""
        unmatched = accession_row.pair_fastqs_by_name(
            fastq_paired_end_1, fastq_paired_end_2
        )
        assert unmatched == expected_unmatched
        for paired_end_1_file_name, paired_end_2_file_name in expected_matches:
            paired_end_1_item = fastq_paired_end_1.get(paired_end_1_file_name)
            paired_end_2_item = fastq_paired_end_2.get(paired_end_2_file_name)
            assert paired_end_1_item and paired_end_2_item
            paired_end_1_match = paired_end_1_item[accession_row.RELATED_FILES][0][
                accession_row.FILE
            ]
            assert paired_end_1_match == paired_end_2_item[accession_row.ALIASES][0]

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
    def test_make_expected_paired_end_2_name(self, accession_row, file_name, expected):
        """"""
        result = accession_row.make_expected_paired_end_2_name(file_name)
        assert result == expected
