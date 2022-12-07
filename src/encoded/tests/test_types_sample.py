import copy
from unittest import mock

import pytest

from .datafixtures import (
    PROBAND_SAMPLE_ID,
    PROBAND_SAMPLE_2_ID,
    MOTHER_SAMPLE_ID,
)
from ..types import sample as sample_type_module 


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


PROBAND_SAMPLE_QC_METRICS = {
    "bam_sample_id": PROBAND_SAMPLE_ID,
    "individual_id": "proband_boy",
    "individual_accession": "GAPIDPROBAND",
    "sex": {"value": "M"},
    "predicted_sex": {
        "value": "male",
        "link": (
            "/quality-metrics-peddyqc/"
            "13d6312a-5b99-4da3-986b-c180b7aae936/@@download"
        ),
        "flag": "pass",
    },
    "ancestry": {"value": ["mars"]},
    "predicted_ancestry": {
        "value": "EARTH",
        "link": (
            "/quality-metrics-peddyqc/"
            "13d6312a-5b99-4da3-986b-c180b7aae936/@@download"
        ),
    },
    "total_reads": {"value": "467863567"},
    "coverage": {"value": "30x", "flag": "pass"},
    "heterozygosity_ratio": {"value": "2.0", "flag": "pass"},
    "transition_transversion_ratio": {"value": "1.96", "flag": "pass"},
    "de_novo_fraction": {"value": "5.2", "flag": "fail"},
    "total_variants_called": {"value": "11000"},
    "filtered_variants": {"value": "1100"},
    "filtered_structural_variants": {"value": "92"},
    "fail": ["de_novo_fraction"],
    "completed_qcs": ["BAM", "SNV", "SV"],
}
PROBAND_SAMPLE_2_QC_METRICS = {
    "bam_sample_id": PROBAND_SAMPLE_2_ID,
    "individual_id": "proband_boy",
    "individual_accession": "GAPIDPROBAND",
    "sex": {"value": "M"},
    "predicted_sex": {
        "value": "male",
        "link": (
            "/quality-metrics-peddyqc/"
            "13d6312a-5b99-4da3-986b-c180b7aae936/@@download"
        ),
        "flag": "pass",
    },
    "ancestry": {"value": ["mars"]},
    "predicted_ancestry": {
        "value": "MARS",
        "link": (
            "/quality-metrics-peddyqc/"
            "13d6312a-5b99-4da3-986b-c180b7aae936/@@download"
        ),
    },
    "total_reads": {"value": "123456789"},
    "coverage": {"value": "43x", "flag": "pass"},
    "heterozygosity_ratio": {"value": "3.0", "flag": "warn"},
    "transition_transversion_ratio": {"value": "2.5", "flag": "fail"},
    "total_variants_called": {"value": "11800"},
    "filtered_variants": {"value": "1180"},
    "filtered_structural_variants": {"value": "92"},
    "warn": ["heterozygosity_ratio"],
    "fail": ["transition_transversion_ratio"],
    "completed_qcs": ["BAM", "SNV", "SV"],
}
MOTHER_SAMPLE_QC_METRICS = {
    "bam_sample_id": MOTHER_SAMPLE_ID,
    "individual_id": "mother_person",
    "individual_accession": "GAPIDMOTHER1",
    "sex": {"value": "F"},
    "predicted_sex": {
        "value": "female",
        "link": (
            "/quality-metrics-peddyqc/"
            "13d6312a-5b99-4da3-986b-c180b7aae936/@@download"
        ),
        "flag": "pass",
    },
    "ancestry": {"value": ["jupiter"]},
    "predicted_ancestry": {
        "value": "JUPITER",
        "link": (
            "/quality-metrics-peddyqc/"
            "13d6312a-5b99-4da3-986b-c180b7aae936/@@download"
        ),
    },
    "total_reads": {"value": "987654321"},
    "coverage": {"value": "35x", "flag": "pass"},
    "heterozygosity_ratio": {"value": "1.0", "flag": "warn"},
    "transition_transversion_ratio": {"value": "2.15", "flag": "warn"},
    "total_variants_called": {"value": "13200"},
    "filtered_variants": {"value": "1320"},
    "filtered_structural_variants": {"value": "112"},
    "warn": ["heterozygosity_ratio", "transition_transversion_ratio"],
    "completed_qcs": ["BAM", "SNV", "SV"],
}


@pytest.fixture
def MIndividual(testapp, project, institution, sample_one):
    ind = {"project": "encode-project", "institution": "encode-institution", "sex": "M"}
    return testapp.post_json("/individual", ind, status=201).json["@graph"][0]


@pytest.fixture
def WIndividual(testapp, project, institution):
    ind = {"project": "encode-project", "institution": "encode-institution", "sex": "F"}
    return testapp.post_json("/individual", ind, status=201).json["@graph"][0]


@pytest.fixture
def sample_one(project, institution):
    return {
        "project": project["@id"],
        "institution": institution["@id"],
        "specimen_type": "peripheral blood",
        "date_received": "2018-12-1",
    }


@pytest.fixture
def sample_two(project, institution):
    return {
        "project": project["@id"],
        "institution": institution["@id"],
        "specimen_type": "saliva",
        "date_received": "2015-12-7",
    }


@pytest.fixture
def sample_no_project(institution, MIndividual):
    return {
        "project": "does not exist",
        "institution": institution["@id"],
        "specimen_type": "tissue",
        "date_received": "2015-12-7",
    }


@pytest.fixture
def captured_log(capsys):
    class CapLog:
        def __init__(self, capsys):
            self.capsys = capsys

        def get_calls(self):
            log_calls, _ = self.capsys.readouterr()
            return log_calls

    return CapLog(capsys)


def test_post_valid_samples(testapp, sample_one, sample_two):
    testapp.post_json("/sample", sample_one, status=201)
    testapp.post_json("/sample", sample_two, status=201)


def test_post_invalid_samples(testapp, sample_no_project):
    testapp.post_json("/sample", sample_no_project, status=422)


def test_post_valid_patch_error(testapp, sample_one):
    res = testapp.post_json("/sample", sample_one, status=201).json["@graph"][0]
    testapp.patch_json(res["@id"], {"date_received": "12-3-2003"}, status=422)
    testapp.patch_json(res["@id"], {"project": "does_not_exist"}, status=422)


def test_sample_individual_revlink(testapp, sample_one, MIndividual):
    sample_res = testapp.post_json("/sample", sample_one, status=201).json["@graph"][0]
    assert not sample_res.get("individual")
    indiv_res = testapp.patch_json(
        MIndividual["@id"], {"samples": [sample_res["@id"]]}, status=200
    ).json["@graph"][0]
    sample_indiv = testapp.get(sample_res["@id"]).json.get("individual")
    assert sample_indiv["@id"] == indiv_res["@id"]


def test_sample_requisition_completed_accepted(testapp, sample_one):
    res = testapp.post_json("/sample", sample_one, status=201).json["@graph"][0]
    assert not res.get("requisition_completed")
    res2 = testapp.patch_json(
        res["@id"], {"specimen_accession_date": "2020-01-01"}, status=200
    ).json["@graph"][0]
    assert res2.get("requisition_completed") is False
    res3 = testapp.patch_json(
        res["@id"],
        {"requisition_acceptance": {"accepted_rejected": "Accepted"}},
        status=200,
    ).json["@graph"][0]
    assert res3.get("requisition_completed") is True


def test_sample_requisition_completed_rejected(testapp, sample_one):
    sample_one["requisition_acceptance"] = {"accepted_rejected": "Rejected"}
    res = testapp.post_json("/sample", sample_one, status=201).json["@graph"][0]
    assert res.get("requisition_completed") is False
    patch_info = res.get("requisition_acceptance")
    patch_info["date_completed"] = "2020-03-01"
    res2 = testapp.patch_json(
        res["@id"], {"requisition_acceptance": patch_info}, status=200
    ).json["@graph"][0]
    assert res2.get("requisition_completed") is True


# Sample Processing Tests
def test_sample_processing_pedigree(testapp, sample_proc_fam):
    """This is an end to end test for calculating relationships
    Test for roles"""
    expected_values = {
        "GAPIDPROBAND": {
            "sample_accession": "GAPSAPROBAND",
            "sample_name": "ext_id_006",
            "parents": ["GAPIDMOTHER1", "GAPIDFATHER1"],
            "relationship": "proband",
            "sex": "M",
        },
        "GAPIDFATHER1": {
            "sample_accession": "GAPSAFATHER1",
            "sample_name": "ext_id_004",
            "parents": [],
            "relationship": "father",
            "sex": "M",
        },
        "GAPIDMOTHER1": {
            "sample_accession": "GAPSAMOTHER1",
            "sample_name": "ext_id_003",
            "parents": ["GAPIDGRANDMA", "GAPIDGRANDPA"],
            "relationship": "mother",
            "sex": "F",
        },
        "GAPIDBROTHER": {
            "sample_accession": "GAPSABROTHER",
            "sample_name": "ext_id_009",
            "parents": ["GAPIDMOTHER1", "GAPIDFATHER1"],
            "relationship": "brother",
            "sex": "M",
        },
        "GAPIDGRANDPA": {
            "sample_accession": "GAPSAGRANDPA",
            "sample_name": "ext_id_002",
            "parents": [],
            "relationship": "grandfather",
            "sex": "M",
            "association": "maternal",
        },
        "GAPIDGRANDMA": {
            "sample_accession": "GAPSAGRANDMA",
            "sample_name": "ext_id_001",
            "parents": [],
            "relationship": "grandmother",
            "sex": "F",
            "association": "maternal",
        },
        "GAPIDHALFSIS": {
            "sample_accession": "GAPSAHALFSIS",
            "sample_name": "ext_id_008",
            "parents": ["GAPIDMOTHER1"],
            "relationship": "half-sister",
            "sex": "F",
        },
        "GAPIDUNCLE01": {
            "sample_accession": "GAPSAUNCLE01",
            "sample_name": "ext_id_005",
            "parents": ["GAPIDGRANDPA"],
            "relationship": "uncle",
            "sex": "M",
            "association": "maternal",
        },
        "GAPIDCOUSIN1": {
            "sample_accession": "GAPSACOUSIN1",
            "sample_name": "ext_id_007",
            "parents": ["GAPIDUNCLE01"],
            "relationship": "cousin",
            "sex": "F",
            "association": "maternal",
        },
    }
    calculated_values = sample_proc_fam["samples_pedigree"]

    for a_sample in calculated_values:
        expected_value = expected_values[a_sample["individual"]]
        for a_key in expected_value:
            assert a_sample[a_key] == expected_value[a_key]


def test_sample_processing_pedigree_bam_location(
    testapp, sample_proc_fam, proband_processed_file
):
    """This is an end to end test for calculating relationships Test for roles"""
    bam_upload_key = proband_processed_file["upload_key"]
    calculated_values = sample_proc_fam["samples_pedigree"]
    proband_info = [i for i in calculated_values if i["individual"] == "GAPIDPROBAND"][
        0
    ]
    assert proband_info["bam_location"] == bam_upload_key


class QcTestConstants:

    REQUEST = "some_request"
    ATID = "some_atid"


class TestQcFlagger:

    def qc_flagger(self):
        return sample_type_module.QcFlagger


    @pytest.mark.parametrize(
        "value,fail_upper,fail_lower,warn_upper,warn_lower,default,expected",
        [
            (30, 20, None, None, None, None, "fail"),
            (10, 20, None, None, None, None, None),
            (10, 20, None, 5, None, None, "warn"),
            (20, 20, None, None, None, None, None),
            (20, None, 20, None, None, None, None),
            (10, 20, None, None, None, "pass", "pass"),
            (10, None, None, 15, 5, None, None),
            (10, None, None, 15, 5, "pass", "pass"),
            (20, None, None, 15, 5, None, "warn"),
            (0, None, None, 15, 5, None, "warn"),
        ]
    )
    def test_assign_flag(
        self, value, fail_upper, fail_lower, warn_upper, warn_lower,
        default, expected,
    ):
        result = self.qc_flagger().assign_flag(
            value, fail_upper, fail_lower, warn_upper, warn_lower, default
        )
        assert result == expected

    def make_mocked_sample(self, is_wgs=None, is_wes=None):
        mocked_sample = mock.create_autospec(sample_type_module.SampleForQc, instance=True)
        mocked_sample.is_wgs.return_value = is_wgs
        mocked_sample.is_wes.return_value = is_wes
        mocked_sample.properties = "something"
        mocked_sample.workup_type = "foo"
        return mocked_sample

    @pytest.mark.parametrize(
        "coverage,is_wgs,is_wes,expected_log,expected",
        [
            ("100X", False, False, True, None),
            ("100X", True, False, False, "pass"),
            ("100X", True, True, False, "pass"),
            ("100X", False, True, False, "pass"),
            ("25X", True, False, False, "pass"),
            ("24X", True, False, False, "warn"),
            ("10X", True, False, False, "warn"),
            ("8.1X", True, False, False, "fail"),
            ("70X", False, True, False, "pass"),
            ("58.6X", False, True, False, "warn"),
            ("40X", False, True, False, "warn"),
            ("39X", False, True, False, "fail"),
        ],
    )
    def test_flag_bam_coverage(
        self, coverage, is_wgs, is_wes, expected_log, expected
    ):
        """Unit test flagging BAM coverage."""
        mocked_sample = self.make_mocked_sample(is_wgs=is_wgs, is_wes=is_wes)
        with mock.patch.object(sample_type_module, "log") as mocked_log:
            result = self.qc_flagger().flag_bam_coverage(coverage, sample=mocked_sample)
            assert result == expected
            if expected_log:
                mocked_log.warning.assert_called_once()
            else:
                mocked_log.warning.assert_not_called()

    @pytest.mark.parametrize(
        "predicted_sex,individual_sex,expected",
        [
            ("", None, None),
            ("foo", None, "fail"),
            ("male", None, None),
            ("foo", "M", "fail"),
            ("male", "M", "pass"),
            ("male", "F", "warn"),
            ("male", "U", "warn"),
            ("female", "M", "warn"),
            ("female", "F", "pass"),
            ("female", "U", "warn"),
        ],
    )
    def test_flag_sex_consistency(
        self, predicted_sex, individual_sex, expected
    ):
        """Unit test flagging sex consistency.

        Sample properties are passed in but irrelevant to the flag, so
        empty dictionary passed here.
        """
        mocked_individual = mock.create_autospec(sample_type_module.IndividualForQc, instance=True)
        mocked_individual.sex = individual_sex
        result = self.qc_flagger().flag_sex_consistency(
            predicted_sex, individual=mocked_individual
        )
        assert result == expected

    @pytest.mark.parametrize(
        "heterozygosity_ratio,expected",
        [
            ("3.1", "warn"),
            ("2.5", "pass"),
            ("2", "pass"),
            ("1.4", "pass"),
            ("0.8", "warn"),
        ],
    )
    def test_flag_heterozygosity_ratio(
        self, heterozygosity_ratio, expected
    ):
        """Unit test flagging SNV heterozygosity ratio."""
        result = self.qc_flagger().flag_heterozygosity_ratio(heterozygosity_ratio)
        assert result == expected

    @pytest.mark.parametrize(
        "transition_transversion_ratio,is_wgs,is_wes,expected_log,expected",
        [
            ("5", False, False, True, None),
            ("5", True, False, False, "fail"),
            ("5", True, True, False, "fail"),
            ("2.3", True, False, False, "warn"),
            ("1.9", True, False, False, "pass"),
            ("1.7", True, False, False, "warn"),
            ("1.5", True, False, False, "fail"),
            ("5", False, True, False, "fail"),
            ("3.4", False, True, False, "warn"),
            ("3.0", False, True, False, "pass"),
            ("2.2", False, True, False, "warn"),
            ("1.5", False, True, False, "fail"),
        ],
    )
    def test_flag_transition_transversion_ratio(
        self,
        transition_transversion_ratio,
        is_wgs,
        is_wes,
        expected_log,
        expected,
    ):
        """Unit test flagging SNV Ts/Tv ratio."""
        mocked_sample = self.make_mocked_sample(is_wgs=is_wgs, is_wes=is_wes)
        with mock.patch.object(sample_type_module, "log") as mocked_log:
            result = self.qc_flagger().flag_transition_transversion_ratio(
                transition_transversion_ratio, sample=mocked_sample
            )
            assert result == expected
            if expected_log:
                mocked_log.warning.assert_called_once()
            else:
                mocked_log.warning.assert_not_called()


class TestQcSummary:

    QC_SUMMARY_TITLE = "foo fu"
    QC_SUMMARY_TITLE_SNAKE_CASE = "foo_fu"
    QC_SUMMARY_VALUE = "bar"
    QC_SUMMARY_PROPERTIES = {"title": QC_SUMMARY_TITLE, "value": QC_SUMMARY_VALUE}
    QC_SUMMARY_DISPLAY = {QC_SUMMARY_TITLE_SNAKE_CASE: {"value": QC_SUMMARY_VALUE}}
    LINK = "some_link"
    FLAG = "some_flag"
    QC_SUMMARY_DISPLAY_WITH_LINK_AND_FLAG = {
        QC_SUMMARY_TITLE_SNAKE_CASE: {
            "value": QC_SUMMARY_VALUE,
            "link": LINK,
            "flag": FLAG,
        }
    }
    COMPLETED_PROCESS = "some_process"

    def simple_qc_summary(self):
        return sample_type_module.QcSummary(
            copy.deepcopy(self.QC_SUMMARY_PROPERTIES), self.COMPLETED_PROCESS
        )

    @pytest.mark.parametrize(
        "evaluator_exists,evaluator_exception,evaluator_result,expected_flag",
        [
            (False, False, "a_result", None),
            (True, True, "a_result", None),
            (False, True, "a_result", None),
            (True, False, "a_result", "a_result"),
        ]
    )
    def test_set_flag(
        self, evaluator_exists, evaluator_exception, evaluator_result,
        expected_flag,
    ):
        mocked_sample = mock.create_autospec(sample_type_module.SampleForQc, instance=True)
        mocked_individual = mock.create_autospec(sample_type_module.IndividualForQc, instance=True)
        title_to_flag_evaluator = {}
        mocked_evaluator = mock.MagicMock(return_value=evaluator_result)
        if evaluator_exception:
            mocked_evaluator.side_effect = Exception
        if evaluator_exists:
            title_to_flag_evaluator[self.QC_SUMMARY_TITLE_SNAKE_CASE] = mocked_evaluator
        with mock.patch.object(
            sample_type_module.QcSummary, "QC_TITLE_TO_FLAG_EVALUATOR",
            new_callable=mock.PropertyMock, return_value=title_to_flag_evaluator,
        ):
            with mock.patch.object(sample_type_module, "log") as mocked_log:
                qc_summary = self.simple_qc_summary()
                qc_summary.set_flag(mocked_sample, mocked_individual)
                assert qc_summary.flag == expected_flag
                if evaluator_exists:
                    mocked_evaluator.assert_called_once_with(
                        self.QC_SUMMARY_VALUE, sample=mocked_sample,
                        individual=mocked_individual
                    )
                else:
                    mocked_evaluator.assert_not_called()
                if evaluator_exists and evaluator_exception:
                    mocked_log.exception.assert_called_once()
                else:
                    mocked_log.exception.assert_not_called()

    @pytest.mark.parametrize(
        "title_replacements,expected",
        [
            ({}, QC_SUMMARY_TITLE_SNAKE_CASE),
            ({QC_SUMMARY_TITLE: "replacement"}, QC_SUMMARY_TITLE_SNAKE_CASE),
            ({QC_SUMMARY_TITLE_SNAKE_CASE: "replacement"}, "replacement"),
        ]
    )
    def test_get_qc_title(self, title_replacements, expected):
        qc_summary = self.simple_qc_summary()
        result = qc_summary.get_qc_title(self.QC_SUMMARY_TITLE,
                title_replacements)
        assert result == expected

    @pytest.mark.parametrize(
        "link,flag,expected",
        [
            (None, None, QC_SUMMARY_DISPLAY),
            (LINK, FLAG, QC_SUMMARY_DISPLAY_WITH_LINK_AND_FLAG),
        ]
    )
    def test_get_qc_display(self, link, flag, expected):
        qc_summary = self.simple_qc_summary()
        qc_summary.link = link
        qc_summary.flag = flag
        result = qc_summary.get_qc_display()
        assert result == expected


class TestQualityMetricForQc:

    QC_ITEM_SUMMARY_1 = {"sample": "some_sample"}
    QC_ITEM_SUMMARY_2 = {"sample": "some_other_sample"}
    QC_WITH_SUMMARIES = {
        "quality_metric_summary": [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]
    }
    LINK = {"foo": "bar"}
    COMPLETED_PROCESS = "foo"
    TITLE_REPLACEMENTS = {"fu": "bur"}

    def quality_metric_for_qc(self, quality_metric_item):
        with mock.patch.object(
            sample_type_module,
            "get_item",
            return_value=quality_metric_item
        ):
            return sample_type_module.QualityMetricForQc(None, QcTestConstants.REQUEST)

    @pytest.mark.parametrize(
        "quality_metric,links,expected_summaries",
        [
            ({}, LINK, []),
            (QC_WITH_SUMMARIES, None, [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]),
            (QC_WITH_SUMMARIES, LINK, [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]),
        ]
    )
    def test_collect_qc_summaries(self, quality_metric, links, expected_summaries):
        with mock.patch.object(
            sample_type_module.QualityMetricForQc, "get_qc_links",
            return_value=links
        ):
            with mock.patch.object(
                sample_type_module, "QcSummary", autospec=True
            ) as mocked_qc_summary:
                with mock.patch.object(
                    sample_type_module.QualityMetricForQc,
                    "COMPLETED_QC_PROCESS",
                    new_callable=mock.PropertyMock,
                    return_value=self.COMPLETED_PROCESS
                ):
                    with mock.patch.object(
                        sample_type_module.QualityMetricForQc,
                        "QC_TITLE_REPLACEMENTS",
                        new_callable=mock.PropertyMock,
                        return_value=self.TITLE_REPLACEMENTS
                    ):
                        quality_metric_for_qc = self.quality_metric_for_qc(quality_metric)
                        result = quality_metric_for_qc.collect_qc_summaries()
                        assert len(result) == len(expected_summaries)
                        for item in result:
                            assert item == mocked_qc_summary.return_value
                        for summary in expected_summaries:
                            mocked_qc_summary.assert_any_call(
                                summary, self.COMPLETED_PROCESS, links=links,
                                title_replacements=self.TITLE_REPLACEMENTS,
                            )


class TestSnvVepVcfQc:

    SOME_PEDDY_QC_ATID = "/quality-metrics-peddyqc/some_uuid/"
    SOME_PEDDY_QC_DOWNLOAD = SOME_PEDDY_QC_ATID + "@@download"
    QUALITY_METRIC_NO_PEDDY_QC = {
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
        ],
    }
    QUALITY_METRIC_WITH_PEDDY_QC = {
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
            {"qc_type": "quality_metric_peddyqc", "value": SOME_PEDDY_QC_ATID},
        ],
    }

    def snv_vep_vcf_qc(self, quality_metric_item):
        with mock.patch.object(
            sample_type_module, "get_item", return_value=quality_metric_item
        ):
            return sample_type_module.SnvVepVcfQc(None, QcTestConstants.REQUEST)

    @pytest.mark.parametrize(
        "quality_metric_item,expected",
        [
            ({}, None),
            (QUALITY_METRIC_NO_PEDDY_QC, None),
            (
                QUALITY_METRIC_WITH_PEDDY_QC,
                {
                    "predicted_sex": SOME_PEDDY_QC_DOWNLOAD,
                    "predicted_ancestry": SOME_PEDDY_QC_DOWNLOAD,
                }
            ),
        ]
    )
    def test_qc_links(self, quality_metric_item, expected):
        vep_quality_metric = self.snv_vep_vcf_qc(quality_metric_item)
        result = vep_quality_metric.get_qc_links()
        assert result == expected


class TestFileForQc:
    VCF_FILE_FORMAT = "/file-formats/vcf_gz/"
    FILE_PROCESSED_SNV_FINAL_VCF_1 = {
        "variant_type": "SNV",
        "vcf_to_ingest": True,
        "file_format": VCF_FILE_FORMAT,
    }
    FILE_PROCESSED_SNV_FINAL_VCF_2 = {
        "variant_type": "SNV",
        "file_type": "full annotated VCF",
        "file_format": VCF_FILE_FORMAT,
    }
    FILE_PROCESSED_SV_FINAL_VCF = {
        "variant_type": "SV",
        "vcf_to_ingest": True,
        "file_format": VCF_FILE_FORMAT,
    }
    SOME_PEDDY_QC_ATID = "/quality-metrics-peddyqc/some_uuid/"
    FILE_PROCESSED_SNV_VEP_VCF = {
        "variant_type": "SNV",
        "file_type": "Vep-annotated VCF",
        "file_format": VCF_FILE_FORMAT,
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
            {"qc_type": "quality_metric_peddyqc", "value": SOME_PEDDY_QC_ATID},
        ],
    }
    FILE_PROCESSED_NON_VCF = {
        "file_format": "foo",
        "file_type": "bar",
    }
    FILE_PROCESSED_BAM = {"file_format": "/file-formats/bam/"}

    def file_for_qc(self, file_item):
        with mock.patch.object(
            sample_type_module, "get_item", return_value=file_item
        ):
            return sample_type_module.FileForQc(None, QcTestConstants.REQUEST)

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            (FILE_PROCESSED_NON_VCF, False),
            (FILE_PROCESSED_SNV_FINAL_VCF_1, True),
        ]
    )
    def test_is_vcf(self, file_item, expected):
        file_for_qc = self.file_for_qc(file_item)
        result = file_for_qc.is_vcf()
        assert result == expected

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            (FILE_PROCESSED_NON_VCF, False),
            (FILE_PROCESSED_BAM, True),
        ]
    )
    def test_is_bam(self, file_item, expected):
        file_for_qc = self.file_for_qc(file_item)
        result = file_for_qc.is_bam()
        assert result == expected

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            (FILE_PROCESSED_NON_VCF, False),
            (FILE_PROCESSED_SNV_FINAL_VCF_1, True),
            (FILE_PROCESSED_SNV_FINAL_VCF_2, True),
        ]
    )
    def test_is_final_vcf(self, file_item, expected):
        file_for_qc = self.file_for_qc(file_item)
        result = file_for_qc.is_final_vcf()
        assert result == expected

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            (FILE_PROCESSED_NON_VCF, False),
            (FILE_PROCESSED_SNV_VEP_VCF, True),
        ]
    )
    def test_is_vep_vcf(self, file_item, expected):
        file_for_qc = self.file_for_qc(file_item)
        result = file_for_qc.is_vep_vcf()
        assert result == expected

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            (FILE_PROCESSED_NON_VCF, False),
            (FILE_PROCESSED_SNV_FINAL_VCF_1, True),
            (FILE_PROCESSED_SV_FINAL_VCF, False),
        ]
    )
    def test_is_snv_final_vcf(self, file_item, expected):
        file_for_qc = self.file_for_qc(file_item)
        result = file_for_qc.is_snv_final_vcf()
        assert result == expected

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            (FILE_PROCESSED_NON_VCF, False),
            (FILE_PROCESSED_SNV_FINAL_VCF_1, False),
            (FILE_PROCESSED_SV_FINAL_VCF, True),
        ]
    )
    def test_is_sv_final_vcf(self, file_item, expected):
        file_for_qc = self.file_for_qc(file_item)
        result = file_for_qc.is_sv_final_vcf()
        assert result == expected

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            ({}, None),
            (FILE_PROCESSED_NON_VCF, None),
            (FILE_PROCESSED_SNV_FINAL_VCF_1, sample_type_module.SnvFinalVcfQc),
            (FILE_PROCESSED_SV_FINAL_VCF, sample_type_module.SvFinalVcfQc),
            (FILE_PROCESSED_SNV_VEP_VCF, sample_type_module.SnvVepVcfQc),
            (FILE_PROCESSED_BAM, sample_type_module.BamQc),
        ],
    )
    def test_get_quality_metric_type(self, file_item, expected):
        file_for_qc = self.file_for_qc(file_item)
        result = file_for_qc.get_quality_metric_type()
        assert result == expected

    @pytest.mark.parametrize(
        "quality_metric,expected",
        [
            (None, False),
            ("", False),
            ("some_atid", True),
        ]
    )
    def test_create_quality_metric_for_qc(self, quality_metric, expected):
        file_for_qc = self.file_for_qc({})
        file_for_qc.quality_metric = quality_metric
        quality_metric_type = mock.MagicMock()
        result = file_for_qc.create_quality_metric_for_qc(quality_metric_type)
        if expected:
            quality_metric_type.assert_called_once_with(
                quality_metric, QcTestConstants.REQUEST
            )
            assert result == quality_metric_type()
        else:
            quality_metric_type.assert_not_called()
            assert result is None


class TestSampleForQc:

    def sample_for_qc(self, sample_item):
        with mock.patch.object(
            sample_type_module, "get_item", return_value=sample_item
        ):
            return sample_type_module.SampleForQc(None, QcTestConstants.REQUEST)

    def empty_sample_for_qc(self):
        return self.sample_for_qc({})

    @pytest.mark.parametrize(
        "is_bam_results", 
        [
            [],
            [False],
            [True, True, False],
        ]
    )
    def test_get_quality_metrics(self, is_bam_results):
        some_atid = "some_atid"
        some_quality_metric = "some_quality_metric"
        processed_file_atids = [some_atid for item in is_bam_results]
        with mock.patch.object(
            sample_type_module,
            "FileForQc",
            autospec=True,
        ) as mocked_file:
            mocked_file_instance = mocked_file.return_value
            mocked_file_instance.is_bam.side_effect = is_bam_results
            mocked_file_instance.create_quality_metric_for_qc.return_value = some_quality_metric
            sample_for_qc = self.empty_sample_for_qc()
            sample_for_qc.processed_files = processed_file_atids
            result = sample_for_qc.get_quality_metrics()
            if any(is_bam_results):
                mocked_file.assert_called()
                mocked_file_instance.create_quality_metric_for_qc.assert_called_once_with(
                    sample_type_module.BamQc
                )
                assert result == [some_quality_metric]
            else:
                mocked_file_instance.create_quality_metric_for_qc.assert_not_called()
                assert result == []


class TestItemQcProperties:

    SOME_ITEM = {"foo": "bar", "fu": "bur"}

    def simple_item_properties(self):
        with mock.patch.object(
            sample_type_module, "get_item", return_value=copy.deepcopy(self.SOME_ITEM)
        ):
            return sample_type_module.ItemProperties(None, QcTestConstants.REQUEST)

    def simple_item_qc_properties(self):
        return sample_type_module.ItemQcProperties(self.simple_item_properties())

    @pytest.mark.parametrize(
        "non_display_properties,display_properties,property_replacements,expected",
        [
            ([], [], {}, {}),
            (["bar"], [], {}, {}),
            ([], ["bar"], {}, {}),
            (["foo"], [], {}, {"foo": "bar"}),
            (["foo"], [], {"foo": "foobar"}, {"foobar": "bar"}),
            ([], ["foo"], {}, {"foo": {"value": "bar"}}),
            ([], ["foo"], {"foo": "foobar"}, {"foobar": {"value": "bar"}}),
        ]
    )
    def test_update_qc_properties(
        self, non_display_properties, display_properties, property_replacements,
        expected,
    ):
        with mock.patch.object(
            sample_type_module.ItemQcProperties,
            "QC_NON_DISPLAY_PROPERTIES",
            new_callable=mock.PropertyMock,
            return_value=non_display_properties,
        ):
            with mock.patch.object(
                sample_type_module.ItemQcProperties,
                "QC_DISPLAY_PROPERTIES",
                new_callable=mock.PropertyMock,
                return_value=display_properties,
            ):
                with mock.patch.object(
                    sample_type_module.ItemQcProperties,
                    "PROPERTY_REPLACEMENTS",
                    new_callable=mock.PropertyMock,
                    return_value=property_replacements,
                ):
                    item_with_qc_properties = self.simple_item_qc_properties()
                    item_with_qc_properties.update_qc_properties()
                    assert item_with_qc_properties.qc_properties == expected
                    # Original properties should remain the same
                    assert item_with_qc_properties.item_properties == self.SOME_ITEM


#class TestSampleQcProperties:
#
#    SAMPLE_ID = "sample_id"
#    SAMPLE_PROPERTIES = {"foo": "bar", "bam_sample_id": SAMPLE_ID}
#
#    def sample_qc_properties(self, sample_item):
#        return sample_type_module.SampleQcProperties(sample_item)
#
#    def simple_sample_qc_properties(self):
#        sample_for_qc = TestSampleForQc().sample_for_qc(self.SAMPLE_PROPERTIES)
#        return self.sample_qc_properties(sample_for_qc)
#
#    def test_update_qc_properties(self):
#        mocked_individual_qc = mock.create_autospec(
#            sample_type_module.IndividualQcProperties,
#            instance=True
#        )
#        with mock.patch.object(
#            sample_type_module.SampleQcProperties,
#            "add_non_display_properties"
#        ) as mocked_add_non_display_properties:
#            with mock.patch.object(
#                sample_type_module.SampleQcProperties,
#                "add_display_properties"
#            ) as mocked_add_display_properties:
#                sample_qc_properties = self.simple_sample_qc_properties()
#                sample_qc_properties.individual_qc = mocked_individual_qc
#                sample_qc_properties.update_qc_properties()
#                mocked_add_non_display_properties.assert_called_once_with()
#                mocked_add_display_properties.assert_called_once_with()
#                mocked_individual_qc.update_qc_properties.assert_called_once_with()
#
#    def test_collect_qc_data(self):
#        mocked_individual_qc = mock.create_autospec(
#            sample_type_module.IndividualQcProperties, instance=True
#        )
#        with mock.patch.object(
#            sample_type_module.SampleQcProperties,
#            "update_qc_properties"
#        ) as mocked_update_qc_properties:
#            with mock.patch.object(
#                sample_type_module.SampleQcProperties,
#                "update_quality_metrics"
#            ) as mocked_update_quality_metrics:
#                sample_qc_properties = self.simple_sample_qc_properties()
#                sample_qc_properties.individual_qc = mocked_individual_qc
#                sample_qc_properties.collect_qc_data()
#                mocked_update_qc_properties.assert_called_once_with()
#                mocked_individual_qc.update_qc_properties.assert_called_once_with()
#                mocked_update_quality_metrics.assert_called_once_with()
#
#    @pytest.mark.parametrize(
#        "most_recent_bam_result,create_quality_metric_result,expected_quality_metrics",
#        [
#            (False, None, []),
#            (True, None, []),
#            (True, "foo", ["foo"]),
#        ]
#    )
#    def test_update_quality_metrics(self, most_recent_bam_result,
#            create_quality_metric_result, expected_quality_metrics
#    ):
#        mocked_bam = mock.create_autospec(
#            sample_type_module.FileForQc,
#            instance=True,
#        )
#        mocked_bam.create_quality_metric_for_qc.return_value = create_quality_metric_result
#        with mock.patch.object(
#            sample_type_module.SampleForQc,
#            "get_most_recent_bam_file"
#        ) as mocked_get_bam:
#            if most_recent_bam_result:
#                mocked_get_bam.return_value = mocked_bam
#            else:
#                mocked_get_bam.return_value = None
#            sample_qc_properties = self.simple_sample_qc_properties()
#            sample_qc_properties.update_quality_metrics()
#            if most_recent_bam_result:
#                mocked_bam.create_quality_metric_for_qc.assert_called_once_with(
#                    sample_type_module.BamQc
#                )
#            else:
#                mocked_bam.create_quality_metric_for_qc.assert_not_called()
#            if expected_quality_metrics:
#                assert sample_qc_properties.quality_metrics == [create_quality_metric_result]
#            else:
#                assert sample_qc_properties.quality_metrics == []

#    def test_collect_individual_data(self):
#        sample = self.simple_sample_with_qc_properties()
#        sample.collect_individual_data()
#        sample.individual.update_qc_properties.assert_called_once_with()
#
#    def test_get_sample_id(self):
#        sample = self.simple_sample_with_qc_properties()
#        result = sample.get_sample_id()
#        assert result == self.SAMPLE_ID
#
#    def test_get_quality_metrics(self):
#        sample = self.simple_sample_with_qc_properties()
#        result = sample.get_quality_metrics()
#        assert result == self.QUALITY_METRICS
#
#    @pytest.mark.parametrize(
#        "quality_metric_type_and_result,expected_quality_metrics",
#        [
#            ([], QUALITY_METRICS),
#            ([(None, None)], QUALITY_METRICS),
#            ([(sample_type_module.BamQc, None)], QUALITY_METRICS),
#            ([(sample_type_module.BamQc, "foo")], QUALITY_METRICS + ["foo"]),
#            ([(sample_type_module.BamQc, "foo"), (sample_type_module.BamQc, "bar")],
#                QUALITY_METRICS + ["foo"]),
#        ]
#    )
#    def test_collect_bam_file(self, empty_quality_metric_parser, quality_metric_type_and_result,
#            expected_quality_metrics):
#        sample = self.simple_sample_with_qc_properties()
#
#        some_atid = "some_atid"
#        processed_file_atids = [some_atid * len(quality_metric_type_and_result)]
#        sample.properties["processed_files"] = processed_file_atids
#
#        get_quality_metric_type_results = [item[0] for item in
#                quality_metric_type_and_result] or None
#        create_quality_metric_for_qc_results = [item[1] for item in
#                quality_metric_type_and_result] or None
#        mock_file_attributes = {
#            "return_value.get_quality_metric_type.side_effect": get_quality_metric_type_results,
#            "return_value.create_quality_metric_for_qc.side_effect": create_quality_metric_for_qc_results,
#        }
#        with mock.patch.object(
#            sample_type_module, "FileForQc", **mock_file_attributes
#        ) as mocked_file_item:
#            sample.collect_bam_file()
#            if processed_file_atids:
#                assert mocked_file_item.called_with(some_atid,
#                        empty_quality_metric_parser.request)
#            else:
#                mocked_file_item.assert_not_called()
#            assert sample.quality_metrics == expected_quality_metrics


class TestSampleQcReport:

    def simple_sample_qc_report(self):
#        sample_attributes = {
#            "properties": TestSampleWithQcProperties.SAMPLE_PROPERTIES,
#            "individual_properties": TestSampleWithQcProperties.INDIVIDUAL_PROPERTIES,
#        }
#        with mock.patch.object(
#            sample_type_module, "SampleWithQcProperties"
#        ) as mocked_sample:
        return sample_type_module.SampleQcReport(
            QcTestConstants.ATID, QcTestConstants.REQUEST
        )

    def test_add_qc_summary(self):
        sample_qc_report = self.simple_sample_qc_report()
        qc_summary_item = mock.create_autospec(
            sample_type_module.QcSummary, instance=True
        )
        sample_qc_report.add_qc_summary(qc_summary_item)
        qc_summary_item.set_flag.assert_called_once_with(
            sample_qc_report.sample, sample_qc_report.individual
        )
        assert sample_qc_report.qc_summaries == [qc_summary_item]

    @pytest.mark.parametrize(
        "qc_properties,expected",
        [
            ([], {}),
            ([{"foo": "bar"}, {"fu": "bur"}], {"foo": "bar", "fu": "bur"}),
        ]
    )
    def test_record_item_qc_properties(self, qc_properties, expected):
        item_qc_properties = []
        for qc_property in qc_properties:
            mock_item = mock.MagicMock()
            mock_item.qc_properties = qc_property
            item_qc_properties.append(mock_item)
        sample_qc_report = self.simple_sample_qc_report()
        sample_qc_report.item_qc_properties = item_qc_properties
        sample_qc_report.record_item_qc_properties()
        assert sample_qc_report.qc_report == expected

    @pytest.mark.parametrize(
        "qc_displays,expected",
        [
            ([], {}),
            ([{"foo": "bar"}, {"fu": "bur"}], {"foo": "bar", "fu": "bur"}),
        ]
    )
    def test_record_qc_summaries(self, qc_displays, expected):
        qc_summaries = []
        for qc_display in qc_displays:
            qc_summary = mock.create_autospec(
                sample_type_module.QcSummary,
                instance=True
            )
            qc_summary.get_qc_display.return_value = qc_display
            qc_summaries.append(qc_summary)
        with mock.patch.object(
            sample_type_module.SampleQcReport,
            "update_flags"
        ) as mocked_update_flags:
            with mock.patch.object(
                sample_type_module.SampleQcReport,
                "update_completed_processes"
            ) as mocked_update_completed_processes:
                sample_qc_report = self.simple_sample_qc_report()
                sample_qc_report.qc_summaries = qc_summaries
                sample_qc_report.record_qc_summaries()
                assert sample_qc_report.qc_report == expected
                for qc_summary in qc_summaries:
                    mocked_update_flags.assert_any_call(qc_summary)
                    mocked_update_completed_processes.assert_any_call(qc_summary)

    @pytest.mark.parametrize(
        "existing_flags,qc_flag,qc_title,expected_flags",
        [
            ({}, "foo", "bar", {}),
            ({"foo": set(["bur"])}, "foo", "bar", {"foo": set(["bur"])}),
            ({}, "warn", "bar", {"warn": set(["bar"])}),
            ({"warn": set(["bur"])}, "warn", "bar", {"warn": set(["bur", "bar"])}),
            ({}, "fail", "bar", {"fail": set(["bar"])}),
            ({"fail": set(["bur"])}, "fail", "bar", {"fail": set(["bur", "bar"])}),
        ]
    )
    def test_update_flags(self, existing_flags, qc_flag, qc_title,
            expected_flags):
        qc_summary_item = mock.create_autospec(
            sample_type_module.QcSummary, instance=True,
            **{"flag": qc_flag, "title": qc_title},
        )
        sample_qc_report = self.simple_sample_qc_report()
        sample_qc_report.flags = existing_flags
        sample_qc_report.update_flags(qc_summary_item)
        assert sample_qc_report.flags == expected_flags

    @pytest.mark.parametrize(
        "completed_process,expected", 
        [
            (None, set()),
            ("foo", set(["foo"])),
        ]
    )
    def test_update_completed_processes(self, completed_process, expected):
        qc_summary = mock.create_autospec(
            sample_type_module.QcSummary, instance=True,
            **{"completed_process": completed_process}
        )
        sample_qc_report = self.simple_sample_qc_report()
        sample_qc_report.update_completed_processes(qc_summary)
        assert sample_qc_report.completed_processes == expected

    @pytest.mark.parametrize(
        "completed_processes,expected",
        [
            ([], {"completed_qcs": []}),
            (["foo", "bar"], {"completed_qcs": ["bar", "foo"]}),
        ]
    )
    def test_record_completed_processes(self, completed_processes, expected):
        sample_qc_report = self.simple_sample_qc_report()
        sample_qc_report.completed_processes = completed_processes
        sample_qc_report.record_completed_processes()
        assert sample_qc_report.qc_report == expected

    @pytest.mark.parametrize(
        "flags,expected_qc_report",
        [
            ({}, {}),
            ({"foo": set(["bur", "bar"])}, {"foo": ["bar", "bur"]}),
        ]
    )
    def test_record_flag_summaries(self, flags, expected_qc_report):
        sample_qc_report = self.simple_sample_qc_report()
        sample_qc_report.flags = flags
        sample_qc_report.record_flag_summaries()
        assert sample_qc_report.qc_report == expected_qc_report

    @pytest.mark.parametrize(
        "qc_report,properties_to_include,expected",
        [
            ({}, [], {}),
            ({"foo": "bar"}, [], {}),
            ({"foo": "bar"}, ["bar"], {}),
            ({"foo": "bar"}, ["foo"], {"foo": "bar"}),
        ]
    )
    def test_prune_qc_report(self, qc_report, properties_to_include, expected):
        with mock.patch.object(
            sample_type_module.SampleQcReport,
            "QC_PROPERTIES_TO_KEEP",
            new_callable=mock.PropertyMock,
            return_value=properties_to_include,
        ):
            sample_qc_report = self.simple_sample_qc_report()
            sample_qc_report.qc_report = qc_report
            sample_qc_report.prune_qc_report()
            assert sample_qc_report.qc_report == expected

#    def make_qc_summary(title, flag):
#        properties = {"title": title, "value": "something"}
#        qc_summary = sample_type_module.QcSummary(properties)
#        qc_summary.flag = flag
#        return qc_summary
#
#    QC_SUMMARY_1 = make_qc_summary("foo", "bar")
#    QC_SUMMARY_2 = make_qc_summary("fu", "bur")
#    QC_DISPLAY_1 = QC_SUMMARY_1.get_qc_display()
#    QC_DISPLAY_2 = QC_SUMMARY_2.get_qc_display()
#
#    @pytest.mark.parametrize(
#        (
#            "qc_summaries,properties_to_include,flags_to_capture,"
#            "expected_qc_report,expected_flags"
#        ),
#        [
#            ([], [], [], {}, {}),
#            ([QC_SUMMARY_1, QC_SUMMARY_2], [], [], {}, {}),
#            ([QC_SUMMARY_1, QC_SUMMARY_2], ["foo"], [], QC_DISPLAY_1, {}),
#            ([QC_SUMMARY_1, QC_SUMMARY_2], ["foo"], ["bar"], QC_DISPLAY_1, {"bar":
#                set(["foo"])}),
#        ]
#    )
#    def test_add_qc_summaries(
#        self, qc_summaries, properties_to_include, flags_to_capture,
#        expected_qc_report, expected_flags
#    ):
#        sample_qc = self.simple_sample_qc()
#        sample_qc.qc_summaries = qc_summaries
#        sample_qc.add_qc_summaries(properties_to_include, flags_to_capture)
#        assert sample_qc.qc_report == expected_qc_report
#        assert sample_qc.flags == expected_flags
#
#    @pytest.mark.parametrize(
#        "flags,expected_qc_report",
#        [
#            ({}, {}),
#            ({"foo": set(["bur", "bar"])}, {"foo": ["bar", "bur"]}),
#        ]
#    )
#    def test_add_flag_summaries(self, flags, expected_qc_report):
#        sample_qc = self.simple_sample_qc()
#        sample_qc.flags = flags
#        sample_qc.add_flag_summaries()
#        assert sample_qc.qc_report == expected_qc_report
#
#    @pytest.mark.parametrize(
#        "completed_processes,expected_qc_report",
#        [
#            (set([]), {}),
#            (set(["bur", "bar"]), {"completed_qcs": ["bar", "bur"]}),
#        ]
#    )
#    def test_add_completed_processes(self, completed_processes, expected_qc_report):
#        sample_qc = self.simple_sample_qc()
#        sample_qc.completed_processes = completed_processes
#        sample_qc.add_completed_processes()
#        assert sample_qc.qc_report == expected_qc_report
#
#    @pytest.mark.parametrize(
#        "qc_step_name,expected",
#        [
#            (None, set()),
#            ("something", set(["something"])),
#        ]
#    )
#    def test_update_completed_processes(self, qc_step_name, expected):
#        sample_qc = self.simple_sample_qc()
#        sample_qc.update_completed_processes(qc_step_name)
#        assert sample_qc.completed_processes == expected


@pytest.fixture
def empty_quality_metric_parser():
    """An empty class for testing."""
    return sample_type_module.QualityMetricParser(QcTestConstants.REQUEST)


class TestQualityMetricParser:

    SOME_SAMPLES = ["sample_1", "sample_2"]
    SOME_FILES = ["file_1", "file_2"]
    SOME_ATID = "/collection/identifier/"
    VCF_FILE_FORMAT = "/file-formats/vcf_gz/"
    SOME_QUALITY_METRIC_ATID = "/quality-metrics/uuid/"
    FILE_PROCESSED_SNV_FINAL_VCF_1 = {
        "variant_type": "SNV",
        "vcf_to_ingest": True,
        "file_format": VCF_FILE_FORMAT,
        "quality_metric": SOME_QUALITY_METRIC_ATID,
    }
    FILE_PROCESSED_SNV_FINAL_VCF_2 = {
        "variant_type": "SNV",
        "file_type": "full annotated VCF",
        "file_format": VCF_FILE_FORMAT,
        "quality_metric": SOME_QUALITY_METRIC_ATID,
    }
    FILE_PROCESSED_SV_FINAL_VCF = {
        "variant_type": "SV",
        "vcf_to_ingest": True,
        "file_format": VCF_FILE_FORMAT,
        "quality_metric": SOME_QUALITY_METRIC_ATID,
    }
    SOME_PEDDY_QC_ATID = "/quality-metrics-peddyqc/some_uuid/"
    SOME_PEDDY_QC_DOWNLOAD = SOME_PEDDY_QC_ATID + "@@download"
    SOME_PEDDY_QC_LINK = {"peddy_qc_download": SOME_PEDDY_QC_DOWNLOAD}
    FILE_PROCESSED_SNV_VEP_VCF = {
        "variant_type": "SNV",
        "file_type": "Vep-annotated VCF",
        "file_format": VCF_FILE_FORMAT,
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
            {"qc_type": "quality_metric_peddyqc", "value": SOME_PEDDY_QC_ATID},
        ],
    }
    FILE_PROCESSED_SNV_VEP_VCF_NO_PEDDYQC = {
        "variant_type": "SNV",
        "file_type": "Vep-annotated VCF",
        "file_format": VCF_FILE_FORMAT,
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
        ],
    }
    FILE_PROCESSED_NON_VCF = {
        "file_format": "foo",
        "file_type": "bar",
    }
    PROCESSED_FILES_1 = [
        FILE_PROCESSED_SNV_FINAL_VCF_1,
        FILE_PROCESSED_SV_FINAL_VCF,
        FILE_PROCESSED_SNV_VEP_VCF,
    ]
    PROCESSED_FILES_2 = [
        FILE_PROCESSED_SNV_VEP_VCF_NO_PEDDYQC,
        FILE_PROCESSED_SV_FINAL_VCF,
        FILE_PROCESSED_NON_VCF,
        FILE_PROCESSED_SNV_FINAL_VCF_2,
        FILE_PROCESSED_SNV_FINAL_VCF_1,
    ]
    SOME_INDIVIDUAL_ATID = "/individuals/foo/"
    SOME_FILE_ATIDS = ["/files-processed/file_1/", "/files-processed/file_2/"]
    SOME_BAM_SAMPLE_ID = "sample_1"
    SAMPLE_WITHOUT_ID = {
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }
    SAMPLE = {
        "bam_sample_id": SOME_BAM_SAMPLE_ID,
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }
    WGS_SAMPLE = {
        "bam_sample_id": SOME_BAM_SAMPLE_ID,
        "workup_type": "WGS",
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }
    WES_SAMPLE = {
        "bam_sample_id": SOME_BAM_SAMPLE_ID,
        "workup_type": "WES",
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }
    SOME_SEX = "some_sex"
    SOME_ANCESTRY = ["some_ancestry"]
    SOME_ACCESSION = "GAPFIFOO"
    SOME_INDIVIDUAL = {
        "sex": SOME_SEX,
        "ancestry": SOME_ANCESTRY,
        "accession": SOME_ACCESSION,
    }
    SOME_INDIVIDUAL_DATA = {
        "sex": {"value": SOME_SEX},
        "ancestry": {"value": SOME_ANCESTRY},
        "individual_accession": SOME_ACCESSION,
    }
    ANOTHER_INDIVIDUAL = copy.copy(SOME_INDIVIDUAL)
    ANOTHER_INDIVIDUAL.update({"foo": "bar"})

    SOME_BAM_FILE = {"@id": "some_atid", "file_format": "/file-formats/bam/"}
    SOME_OTHER_FILE = {"@id": "another_atid", "file_format": "some_file_format"}

    SOME_ATID = "/foo/bar/"
    SAMPLE_1 = "sample_1"
    SAMPLE_1_PROPERTIES = {"fu": "bur", "foo": ["bar"]}
    SAMPLE_2 = "sample_2"
    SAMPLE_2_PROPERTIES = {"baz": "fa"}
    SAMPLE_MAPPING = {
        SAMPLE_1: SAMPLE_1_PROPERTIES,
        SAMPLE_2: SAMPLE_2_PROPERTIES,
    }
    QC_ITEM_SUMMARY_1 = {"sample": SAMPLE_1}
    QC_ITEM_SUMMARY_2 = {"sample": "some_other_sample"}
    QC_WITH_SUMMARY_1 = {"quality_metric_summary": [QC_ITEM_SUMMARY_1]}
    QC_WITH_SUMMARY_1_2 = {
        "quality_metric_summary": [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]
    }
    SAMPLE_1_PROPERTIES_WITH_QC_PROPERTIES = copy.deepcopy(SAMPLE_1_PROPERTIES)
    SAMPLE_1_PROPERTIES_WITH_QC_PROPERTIES.update(QC_ITEM_SUMMARY_1)
    SAMPLE_MAPPING_WITH_QC_UPDATES = {
        SAMPLE_1: SAMPLE_1_PROPERTIES_WITH_QC_PROPERTIES,
        SAMPLE_2: SAMPLE_2_PROPERTIES,
    }

    SOME_TITLE = "some_title"
    INCOMPLETE_QC_SUMMARY_ITEM = {
        "title": "Some title",
        "value": "some_value",
    }
    QC_SUMMARY_ITEM = {
        "title": "Some Title",
        "value": "some_value",
        "numberType": "some_number_type",
    }
    SAMPLE_QC_SUMMARY = {
        SOME_TITLE: {
            "value": "some_value",
        }
    }
    EXISTING_SAMPLE_PROPERTIES = {"foo": {"fu": "bar"}}
    SAMPLE_QC_SUMMARY_WITH_EXISTING_PROPERTIES = copy.deepcopy(SAMPLE_QC_SUMMARY)
    SAMPLE_QC_SUMMARY_WITH_EXISTING_PROPERTIES.update(EXISTING_SAMPLE_PROPERTIES)
    SAMPLE_QC_SUMMARY_PASS_FLAG = {
        key: copy.deepcopy(value) for key, value in SAMPLE_QC_SUMMARY.items()
    }
    SAMPLE_QC_SUMMARY_PASS_FLAG[SOME_TITLE].update({"flag": "pass"})
    SAMPLE_QC_SUMMARY_FAIL_FLAG = {
        key: copy.deepcopy(value) for key, value in SAMPLE_QC_SUMMARY.items()
    }
    SAMPLE_QC_SUMMARY_FAIL_FLAG[SOME_TITLE].update({"flag": "fail"})
    SAMPLE_QC_SUMMARY_FAIL_FLAG["fail"] = set([SOME_TITLE])
    SOME_TITLE_WITH_LINK = "some_title_with_link"
    SOME_PROPERTIES_TO_FIND = [SOME_TITLE, SOME_TITLE_WITH_LINK]
    QC_PROPERTY_NAMES_TO_LINKS = {SOME_TITLE_WITH_LINK: "some_link"}
    QC_SUMMARY_ITEM_WITH_LINK = {
        "title": "Some Title With Link",
        "value": "some_value",
        "numberType": "some_number_type",
    }
    SAMPLE_QC_SUMMARY_WITHOUT_LINK = {
        SOME_TITLE_WITH_LINK: {
            "value": "some_value",
        }
    }
    SAMPLE_QC_SUMMARY_WITH_LINK = {
        SOME_TITLE_WITH_LINK: {
            "value": "some_value",
            "link": "an_actual_link",
        }
    }
    SOME_QC_LINK = {"some_link": "an_actual_link"}
    SOME_QC_PROPERTIES = [SOME_TITLE, SOME_TITLE_WITH_LINK]
    SOME_PROPERTY_REPLACEMENTS = {SOME_TITLE: SOME_TITLE_WITH_LINK}

    SAMPLE_MAPPING_1 = {
        "foo": {
            "qc_field_1": {},
            "qc_field_2": {"flag": "warn"},
            "qc_field_3": {"flag": "pass"},
        },
        "bar": {
            "qc_field_1": {},
            "qc_field_2": {},
            "qc_field_3": {"flag": "pass"},
        },
        "fu": {
            "qc_field_1": {"flag": "warn"},
            "qc_field_2": {"flag": "fail"},
            "qc_field_3": {"flag": "pass"},
        },
    }
    SAMPLE_MAPPING_2 = {
        "foo": {
            "qc_field_1": {"flag": "warn"},
            "qc_field_2": {"flag": "fu"},
        },
        "bar": {
            "qc_field_1": {},
            "qc_field_2": {},
        },
    }
    SAMPLE_MAPPING_3 = {
        "foo": {
            "non_qc_field_1": {"value": "fu"},
            "qc_field_1": {"flag": "warn"},
            "non_qc_field_2": {"value": "3000"},
        },
    }

    SOME_PEDDY_QC_ATID = "/peddy_qc/a_peddy_qc/"
    SOME_PEDDY_LINK = {"peddyqc": SOME_PEDDY_QC_ATID + "@@download"}
    SOME_NON_PEDDY_QC = {"qc_type": "some_other_quality_metric_type", "value": "foobar"}
    QC_WITH_PEDDY_QC_LINK = {
        "qc_list": [
            SOME_NON_PEDDY_QC,
            {"qc_type": "quality_metric_peddyqc", "value": SOME_PEDDY_QC_ATID},
        ]
    }
    QC_WITH_NO_PEDDY_QC_LINK = {"qc_list": [SOME_NON_PEDDY_QC]}

    SOME_FLAG_NAMES = ["foo", "bar", "foobar"]
    SAMPLE_PROPERTIES_WITH_FLAGS = {"foo": set(SOME_FLAG_NAMES), "fu": set(["bur"])}
    SAMPLE_PROPERTIES_WITH_FLAGS_LIST = {"foo": SOME_FLAG_NAMES, "fu": set(["bur"])}

#    @pytest.mark.parametrize(
#        "item_atid,get_item_or_none_result,expected",
#        [
#            ("", None, {}),
#            ("not_an_atid", None, {}),
#            (SOME_ATID, None, {}),
#            (SOME_ATID, FILE_PROCESSED_NON_VCF, FILE_PROCESSED_NON_VCF),
#        ],
#    )
#    def test_get_item(
#        self,
#        captured_log,
#        empty_quality_metric_parser,
#        item_atid,
#        get_item_or_none_result,
#        expected,
#    ):
#        """Unit test item retrieval with mocked get_item_or_none."""
#        with mock.patch.object(
#            sample_type_module,
#            "get_item_or_none",
#            return_value=get_item_or_none_result,
#        ) as mocked_get_item_or_none:
#            result = empty_quality_metric_parser.get_item(item_atid)
#            expected_call = [
#                empty_quality_metric_parser.request,
#                item_atid,
#                item_atid.split("/")[0],
#            ]
#            assert mocked_get_item_or_none.called_once_with(expected_call)
#            log_calls = captured_log.get_calls()
#            if get_item_or_none_result is None:
#                assert log_calls
#            else:
#                assert not log_calls
#            assert result == expected


    @pytest.mark.parametrize(
        "samples,processed_files,qc_display,expected",
        [
            (None, None, [], None),
            (None, ["files"], [], None),
            (None, ["files"], ["some_display"], None),
            (["samples"], None, [], None),
            (["samples"], None, ["some_display"], ["some_display"]),
            (["samples"], None, ["some_display"], ["some_display"]),
            (["samples"], ["files"], ["some_display"], ["some_display"]),
        ],
    )
    def test_get_qc_display_results(
        self,
        empty_quality_metric_parser,
        samples,
        processed_files,
        qc_display,
        expected,
    ):
        """Unit test collection and processing of data to create QC
        display.
        """
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "collect_sample_processing_processed_files_data",
        ) as mocked_collect_files_data:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "collect_sample_data",
            ) as mocked_collect_sample_data:
                with mock.patch.object(
                    sample_type_module.QualityMetricParser,
                    "associate_quality_metrics_with_samples",
                ) as mocked_associate_quality_metrics:
                    with mock.patch.object(
                        sample_type_module.QualityMetricParser,
                        "create_qc_display",
                        return_value=qc_display,
                    ) as mocked_create_qc_display:
                        result = empty_quality_metric_parser.get_qc_display_results(
                            samples, processed_files
                        )
                        if samples:
                            if processed_files:
                                mocked_collect_files_data.assert_called_once_with(
                                    processed_files
                                )
                            else:
                                mocked_collect_files_data.assert_not_called()
                            for sample in samples:
                                mocked_collect_sample_data.assert_any_call(sample)
                            assert len(samples) == len(
                                mocked_collect_sample_data.call_args_list
                            )
                            mocked_associate_quality_metrics.assert_called_once_with()
                            mocked_create_qc_display.assert_called_once_with()
                        else:
                            mocked_collect_files_data.assert_not_called()
                            mocked_collect_sample_data.assert_not_called()
                            mocked_associate_quality_metrics.assert_not_called()
                            mocked_create_qc_display.assert_not_called()
                        assert result == expected

#    def return_get_item_properties(self, request, properties):
#        """Helper for mocking."""
#        return properties

    @pytest.mark.parametrize(
        "quality_metric_types,expected_add_quality_metric_call_types",
        [
            ([], []),
            ([sample_type_module.SnvFinalVcfQc], [sample_type_module.SnvFinalVcfQc]),
            (
                [
                    sample_type_module.SnvFinalVcfQc,
                    None,
                    sample_type_module.SnvFinalVcfQc,
                    sample_type_module.SvFinalVcfQc,
                    None,
                    sample_type_module.SvFinalVcfQc,
                    sample_type_module.SnvVepVcfQc,
                ],
                [
                    sample_type_module.SnvFinalVcfQc,
                    sample_type_module.SvFinalVcfQc,
                    sample_type_module.SnvVepVcfQc,
                ]
            ),
        ],
    )
    def test_collect_sample_processing_processed_files_data(
        self,
        empty_quality_metric_parser,
        quality_metric_types,
        expected_add_quality_metric_call_types,
    ):
        """Unit test collecting appropriate FilesProcessed off of a
        SampleProcessing.
        """
        processed_files = ["something" for item in quality_metric_types]
        with mock.patch.object(
            sample_type_module,
            "FileForQc",
            **{"return_value.get_quality_metric_type.side_effect":
                quality_metric_types},
        ) as mocked_file:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "add_quality_metric",
            ) as mocked_add_quality_metric:
                qc_parser = empty_quality_metric_parser
                qc_parser.collect_sample_processing_processed_files_data(
                    processed_files
                )
                if not expected_add_quality_metric_call_types:
                    mocked_add_quality_metric.assert_not_called()
                else:
                    assert len(
                        mocked_add_quality_metric.call_args_list
                    ) == len(expected_add_quality_metric_call_types)
                    for expected_type in expected_add_quality_metric_call_types:
                        mocked_add_quality_metric.assert_any_call(
                            expected_type, mocked_file()
                        )

    @pytest.mark.parametrize(
        "quality_metric,expected",
        [
            (None, []),
            ("foobar", ["foobar"]),
        ]
    )
    def test_add_quality_metric(
        self, empty_quality_metric_parser, quality_metric, expected
    ):
        quality_metric_type = "something"
        file_item = mock.create_autospec(sample_type_module.FileForQc, instance=True)
        file_item.create_quality_metric_for_qc.return_value = quality_metric
        empty_quality_metric_parser.add_quality_metric(
            quality_metric_type, file_item
        )
        file_item.create_quality_metric_for_qc.assert_called_once_with(quality_metric_type)
        assert empty_quality_metric_parser.file_quality_metrics == expected

#    @pytest.mark.parametrize(
#        "file_item,property_replacements,links",
#        [
#            ({}, None, None),
#            (FILE_PROCESSED_NON_VCF, {"foo": "bar"}, {"some_property": "some_link"}),
#        ],
#    )
#    def test_add_to_processed_files(
#        self, empty_quality_metric_parser, file_item, property_replacements, links
#    ):
#        """Unit test updating attribute with FileProcessed data."""
#        empty_quality_metric_parser.add_to_processed_files(
#            file_item, property_replacements, links
#        )
#        assert empty_quality_metric_parser.processed_files_with_quality_metrics == [
#            (file_item, property_replacements, links)
#        ]

    @pytest.mark.parametrize(
        "quality_metrics,bam_sample_id",
        [
            ([], None),
            ([], "sample_id"),
            (["foo", "bar"], "sample_id"),
        ]
    )
    def test_collect_sample_data(
        self, empty_quality_metric_parser, quality_metrics, bam_sample_id
    ):
        sample_identifier = "foobar"
        mocked_sample = mock.MagicMock(
            **{
                "bam_sample_id": bam_sample_id,
                "get_quality_metrics.return_value": quality_metrics,
            }
        )
        with mock.patch.object(
            sample_type_module,
            "SampleQcReport",
            autospec=True,
        ) as mocked_sample_qc_report:
            mocked_sample_qc_report.return_value.sample = mocked_sample
            empty_quality_metric_parser.collect_sample_data(sample_identifier)
            mocked_sample_qc_report.assert_called_once_with(
                sample_identifier, empty_quality_metric_parser.request
            )
            assert empty_quality_metric_parser.file_quality_metrics == quality_metrics
            sample_mapping = empty_quality_metric_parser.sample_mapping
            if bam_sample_id:
                assert len(sample_mapping) == 1
                assert sample_mapping[bam_sample_id] == mocked_sample_qc_report.return_value
            else:
                assert not empty_quality_metric_parser.sample_mapping

    @pytest.mark.parametrize(
        "qc_summary_samples,expected_warnings,expected_summary_adds",
        [
            ([], 0, []),
            ([SAMPLE_2], 1, []),
            ([SAMPLE_1], 0, [SAMPLE_1]),
            ([SAMPLE_1, SAMPLE_2], 1, [SAMPLE_1]),
        ]
    )
    def test_associate_quality_metrics_with_samples(
        self, empty_quality_metric_parser, qc_summary_samples, expected_warnings,
        expected_summary_adds
    ):
        mocked_sample_qc_report = mock.create_autospec(
            sample_type_module.SampleQcReport, instance=True
        )
        sample_mapping = {self.SAMPLE_1: mocked_sample_qc_report}
        empty_quality_metric_parser.sample_mapping = sample_mapping
        qc_summaries = [
            mock.MagicMock(**{"sample": sample}) for sample in qc_summary_samples
        ]
        file_quality_metric = mock.create_autospec(
            sample_type_module.QualityMetricForQc, instance=True
        )
        file_quality_metric.collect_qc_summaries.return_value = qc_summaries
        file_quality_metric.properties = "foo"
        empty_quality_metric_parser.file_quality_metrics = [file_quality_metric]
        with mock.patch.object(
            sample_type_module,
            "log",
        ) as mocked_log:
            empty_quality_metric_parser.associate_quality_metrics_with_samples()
            assert len(mocked_log.warning.call_args_list) == expected_warnings
            add_qc_summary_calls = mocked_sample_qc_report.add_qc_summary.call_args_list
            assert len(add_qc_summary_calls) == len(expected_summary_adds)
            for call in add_qc_summary_calls:
                called_qc_summary = call[0][0]
                assert called_qc_summary.sample in expected_summary_adds

    def test_create_qc_display(self, empty_quality_metric_parser):
        sample_qc_display_1 = "foo"
        sample_qc_display_2 = None
        sample_qc_displays = [sample_qc_display_1, sample_qc_display_2]
        sample_qc_reports = [
            mock.MagicMock(**{"get_qc_display.return_value": sample_qc_display})
            for sample_qc_display in sample_qc_displays
        ]
        sample_mapping = {idx: item for idx, item in enumerate(sample_qc_reports)}
        empty_quality_metric_parser.sample_mapping = sample_mapping
        result = empty_quality_metric_parser.create_qc_display()
        assert result == [sample_qc_display_1]


#    @pytest.mark.parametrize(
#        "sample_identifiers,reformat_result",
#        [
#            ([], None),
#            (SOME_SAMPLES, None),
#            (SOME_SAMPLES, {"foo": "bar"}),
#        ],
#    )
#    def test_collect_and_process_samples_data(
#        self, empty_quality_metric_parser, sample_identifiers, reformat_result
#    ):
#        """Unit test processing Sample item to gather associated data,
#        create mapping to QC data, and reformatting result.
#        """
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser, "collect_sample_data"
#        ) as mocked_collect_sample_data:
#            with mock.patch.object(
#                sample_type_module.QualityMetricParser,
#                "associate_file_quality_metrics_with_samples",
#            ) as mocked_associate_qcs_with_samples:
#                with mock.patch.object(
#                    sample_type_module.QualityMetricParser,
#                    "reformat_sample_mapping_to_schema",
#                    return_value=reformat_result,
#                ) as mocked_reformat_to_schema:
#                    qc_parser = empty_quality_metric_parser
#                    result = qc_parser.collect_and_process_samples_data(
#                        sample_identifiers
#                    )
#                    expected_collect_samples_calls = len(sample_identifiers)
#                    result_collect_samples_calls = len(
#                        mocked_collect_sample_data.call_args_list
#                    )
#                    assert (
#                        result_collect_samples_calls == expected_collect_samples_calls
#                    )
#                    mocked_associate_qcs_with_samples.assert_called_once()
#                    mocked_reformat_to_schema.assert_called_once()
#                    assert result == reformat_result
#
#    @pytest.mark.parametrize(
#        "properties_to_get,item_to_get,item_to_update,property_replacements,expected",
#        [
#            ([], {}, {}, None, {}),
#            (["foo"], WES_SAMPLE, {}, None, {}),
#            (["workup_type"], WES_SAMPLE, {}, None, {"workup_type": "WES"}),
#            (
#                ["workup_type"],
#                WES_SAMPLE,
#                {},
#                {"workup_type": "type_workup"},
#                {"type_workup": "WES"},
#            ),
#        ],
#    )
#    def test_update_simple_properties(
#        self,
#        empty_quality_metric_parser,
#        properties_to_get,
#        item_to_get,
#        item_to_update,
#        property_replacements,
#        expected,
#    ):
#        """Unit test transfer of key, value pairs from one dict to
#        another.
#        """
#        empty_quality_metric_parser.update_simple_properties(
#            properties_to_get,
#            item_to_get,
#            item_to_update,
#            property_replacements=property_replacements,
#        )
#        assert item_to_update == expected
#
#    @pytest.mark.parametrize(
#        "properties_to_get,item_to_get,item_to_update,property_replacements,expected",
#        [
#            ([], {}, {}, None, {}),
#            (["foo"], WES_SAMPLE, {}, None, {}),
#            (
#                ["workup_type", "bam_sample_id"],
#                WES_SAMPLE,
#                {},
#                None,
#                {
#                    "workup_type": {"value": "WES"},
#                    "bam_sample_id": {"value": SOME_BAM_SAMPLE_ID},
#                },
#            ),
#            (
#                ["workup_type", "bam_sample_id"],
#                WES_SAMPLE,
#                {},
#                {"bam_sample_id": "sample_bam_id"},
#                {
#                    "workup_type": {"value": "WES"},
#                    "sample_bam_id": {"value": SOME_BAM_SAMPLE_ID},
#                },
#            ),
#        ],
#    )
#    def test_update_display_properties(
#        self,
#        empty_quality_metric_parser,
#        properties_to_get,
#        item_to_get,
#        item_to_update,
#        property_replacements,
#        expected,
#    ):
#        """Unit test transfer of key, value pairs from one dict to
#        another with reformatting of value.
#        """
#        empty_quality_metric_parser.update_display_properties(
#            properties_to_get,
#            item_to_get,
#            item_to_update,
#            property_replacements=property_replacements,
#        )
#        assert item_to_update == expected
#
#    @pytest.mark.parametrize(
#        "property_name,property_replacements,expected",
#        [
#            ("foo", {}, "foo"),
#            ("foo", {"fu": "foo"}, "foo"),
#            ("foo", {"foo": "fu"}, "fu"),
#        ],
#    )
#    def test_update_property_name(
#        self,
#        empty_quality_metric_parser,
#        property_name,
#        property_replacements,
#        expected,
#    ):
#        """Unit test replacement or maintenance of property name."""
#        result = empty_quality_metric_parser.update_property_name(
#            property_name, property_replacements
#        )
#        assert result == expected
#
#    @pytest.mark.parametrize(
#        "sample_item,expected_sample_mapping",
#        [
#            (SAMPLE_WITHOUT_ID, {}),
#            (SAMPLE, {SOME_BAM_SAMPLE_ID: {"bam_sample_id": SOME_BAM_SAMPLE_ID}}),
#        ],
#    )
#    def test_collect_sample_data(
#        self, empty_quality_metric_parser, sample_item, expected_sample_mapping
#    ):
#        """Unit test getting Sample item and collecting associated
#        data.
#        """
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "get_item",
#            side_effect=self.return_input,
#        ):
#            with mock.patch.object(
#                sample_type_module.QualityMetricParser,
#                "collect_individual_data",
#            ) as mocked_collect_individual_data:
#                with mock.patch.object(
#                    sample_type_module.QualityMetricParser,
#                    "collect_sample_processed_files_data",
#                ) as mocked_collect_file_data:
#                    empty_quality_metric_parser.collect_sample_data(sample_item)
#                    result_sample_mapping = empty_quality_metric_parser.sample_mapping
#                    assert result_sample_mapping == expected_sample_mapping
#                    mocked_collect_individual_data.assert_called_once()
#                    individual_call = mocked_collect_individual_data.call_args[0]
#                    assert self.SOME_INDIVIDUAL_ATID == individual_call[0]
#                    mocked_collect_file_data.assert_called_once()
#                    file_call = mocked_collect_file_data.call_args[0]
#                    assert self.SOME_FILE_ATIDS == file_call[0]
#
#    @pytest.mark.parametrize(
#        "individual_item,sample_info,expected",
#        [
#            ({}, {}, {}),
#            (SOME_INDIVIDUAL, {}, SOME_INDIVIDUAL_DATA),
#            (ANOTHER_INDIVIDUAL, {}, SOME_INDIVIDUAL_DATA),
#        ],
#    )
#    def test_collect_individual_data(
#        self, empty_quality_metric_parser, individual_item, sample_info, expected
#    ):
#        """Unit test collecting Individual data."""
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "get_item",
#            return_value=individual_item,
#        ) as mocked_get_item:
#            empty_quality_metric_parser.collect_individual_data(
#                self.SOME_INDIVIDUAL_ATID, sample_info
#            )
#            mocked_get_item.assert_called_once_with(self.SOME_INDIVIDUAL_ATID)
#            assert sample_info == expected
#
#    @pytest.mark.parametrize(
#        "processed_file_items,expected_get_item_call_count,expected_collect_bam_call",
#        [
#            ([], 0, False),
#            ([SOME_OTHER_FILE], 1, False),
#            ([SOME_OTHER_FILE, SOME_BAM_FILE], 2, True),
#            ([SOME_BAM_FILE, SOME_OTHER_FILE], 1, True),
#            ([SOME_BAM_FILE, SOME_BAM_FILE], 1, True),
#        ],
#    )
#    def test_collect_sample_processed_files_data(
#        self,
#        empty_quality_metric_parser,
#        processed_file_items,
#        expected_get_item_call_count,
#        expected_collect_bam_call,
#    ):
#        """Unit test collection of FileProcessed items off of a Sample
#        item.
#        """
#        sample_info = {"key": "value"}
#        processed_file_atids = [item.get("@id") for item in processed_file_items]
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "get_item",
#            side_effect=processed_file_items,
#        ) as mocked_get_item:
#            with mock.patch.object(
#                sample_type_module.QualityMetricParser,
#                "collect_bam_quality_metric_values",
#            ) as mocked_collect_bam_qc_values:
#                empty_quality_metric_parser.collect_sample_processed_files_data(
#                    processed_file_atids, sample_info
#                )
#                get_item_calls = len(mocked_get_item.call_args_list)
#                assert get_item_calls == expected_get_item_call_count
#                if expected_collect_bam_call:
#                    mocked_collect_bam_qc_values.assert_called_once_with(
#                        self.SOME_BAM_FILE, sample_info
#                    )
#                else:
#                    mocked_collect_bam_qc_values.assert_not_called()
#
#    @pytest.mark.parametrize(
#        "qc_item,expected_get_item_call,expected_add_qc_property_calls",
#        [
#            (None, 0, []),
#            ({"foo": "bar"}, 1, []),
#            (QC_WITH_SUMMARY_1, 1, [QC_ITEM_SUMMARY_1]),
#            (QC_WITH_SUMMARY_1_2, 1, [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]),
#        ],
#    )
#    def test_collect_bam_quality_metric_values(
#        self,
#        empty_quality_metric_parser,
#        qc_item,
#        expected_get_item_call,
#        expected_add_qc_property_calls,
#    ):
#        """Unit test collection of BAM file QC items."""
#        file_item = {"quality_metric": qc_item}
#        sample_info = {"key": "value"}
#        expected_add_qc_property_calls = [
#            mock.call(
#                sample_info, item, empty_quality_metric_parser.DISPLAY_BAM_PROPERTIES
#            )
#            for item in expected_add_qc_property_calls
#        ]
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "get_item",
#            return_value=qc_item,
#        ) as mocked_get_item:
#            with mock.patch.object(
#                sample_type_module.QualityMetricParser,
#                "add_qc_property_to_sample_info",
#            ) as mocked_add_qc_property:
#                empty_quality_metric_parser.collect_bam_quality_metric_values(
#                    file_item, sample_info
#                )
#                if expected_get_item_call:
#                    mocked_get_item.assert_called_once_with(qc_item)
#                else:
#                    mocked_get_item.assert_not_called()
#                mocked_add_qc_property_calls = mocked_add_qc_property.call_args_list
#                assert mocked_add_qc_property_calls == expected_add_qc_property_calls
#
#    @pytest.mark.parametrize(
#        (
#            "sample_properties,qc_item,properties_to_find,links,summary_title,"
#            "flag_result,expected_add_flag_called,expected_sample_properties"
#        ),
#        [
#            ({}, {}, SOME_PROPERTIES_TO_FIND, None, "foo", None, False, {}),
#            (
#                {},
#                QC_SUMMARY_ITEM,
#                SOME_PROPERTIES_TO_FIND,
#                None,
#                SOME_TITLE,
#                None,
#                True,
#                SAMPLE_QC_SUMMARY,
#            ),
#            ({}, QC_SUMMARY_ITEM, [], None, SOME_TITLE, None, False, {}),
#            (
#                {},
#                QC_SUMMARY_ITEM,
#                SOME_PROPERTIES_TO_FIND,
#                None,
#                SOME_TITLE,
#                "pass",
#                True,
#                SAMPLE_QC_SUMMARY_PASS_FLAG,
#            ),
#            (
#                {},
#                QC_SUMMARY_ITEM,
#                SOME_PROPERTIES_TO_FIND,
#                None,
#                SOME_TITLE,
#                "fail",
#                True,
#                SAMPLE_QC_SUMMARY_FAIL_FLAG,
#            ),
#            (
#                EXISTING_SAMPLE_PROPERTIES,
#                QC_SUMMARY_ITEM,
#                SOME_PROPERTIES_TO_FIND,
#                None,
#                SOME_TITLE,
#                None,
#                True,
#                SAMPLE_QC_SUMMARY_WITH_EXISTING_PROPERTIES,
#            ),
#            (
#                {},
#                QC_SUMMARY_ITEM_WITH_LINK,
#                SOME_PROPERTIES_TO_FIND,
#                None,
#                SOME_TITLE_WITH_LINK,
#                None,
#                True,
#                SAMPLE_QC_SUMMARY_WITHOUT_LINK,
#            ),
#            (
#                {},
#                QC_SUMMARY_ITEM_WITH_LINK,
#                SOME_PROPERTIES_TO_FIND,
#                SOME_QC_LINK,
#                SOME_TITLE_WITH_LINK,
#                None,
#                True,
#                SAMPLE_QC_SUMMARY_WITH_LINK,
#            ),
#        ],
#    )
#    def test_add_qc_property_to_sample_info(
#        self,
#        empty_quality_metric_parser,
#        sample_properties,
#        qc_item,
#        properties_to_find,
#        links,
#        summary_title,
#        flag_result,
#        expected_add_flag_called,
#        expected_sample_properties,
#    ):
#        """Unit test addition of QC item to sample QC properties."""
#        property_replacements = {"foo": "bar"}
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "QC_PROPERTY_NAMES_TO_LINKS",
#            new_callable=mock.PropertyMock,
#            return_value=self.QC_PROPERTY_NAMES_TO_LINKS,
#        ):
#            with mock.patch.object(
#                sample_type_module.QualityMetricParser,
#                "get_qc_summary_title",
#                return_value=summary_title,
#            ) as mocked_get_qc_summary_title:
#                with mock.patch.object(
#                    sample_type_module.QualityMetricParser,
#                    "add_flags_for_qc_value",
#                    return_value=flag_result,
#                ) as mocked_add_flags:
#                    empty_quality_metric_parser.add_qc_property_to_sample_info(
#                        sample_properties,
#                        qc_item,
#                        properties_to_find,
#                        links=links,
#                        property_replacements=property_replacements,
#                    )
#                    mocked_get_qc_summary_title.assert_called_once_with(
#                        qc_item, property_replacements
#                    )
#                    if expected_add_flag_called:
#                        qc_value = qc_item.get("value")
#                        mocked_add_flags.assert_called_once_with(
#                            sample_properties, summary_title, qc_value
#                        )
#                    else:
#                        mocked_add_flags.assert_not_called()
#                    assert sample_properties == expected_sample_properties
#
#    @pytest.mark.parametrize(
#        "qc_summary,property_replacements,expected",
#        [
#            ({}, None, ""),
#            (QC_SUMMARY_ITEM, None, SOME_TITLE),
#            (QC_SUMMARY_ITEM, SOME_PROPERTY_REPLACEMENTS, SOME_TITLE_WITH_LINK),
#            (QC_SUMMARY_ITEM, {SOME_TITLE_WITH_LINK: SOME_TITLE}, SOME_TITLE),
#        ],
#    )
#    def test_get_qc_summary_title(
#        self, empty_quality_metric_parser, qc_summary, property_replacements, expected
#    ):
#        """Unit test reformatting and possible replacing QC item title
#        to expected title.
#        """
#        result = empty_quality_metric_parser.get_qc_summary_title(
#            qc_summary, property_replacements
#        )
#        assert result == expected
#
#    @pytest.mark.parametrize(
#        "flag_level,qc_title,sample_properties,expected_sample_properties",
#        [
#            ("foo", "bar", {}, {"foo": set(["bar"])}),
#            ("foo", "bar", {"foo": set(["bar"])}, {"foo": set(["bar"])}),
#            ("foo", "bar", {"foo": set(["bur"])}, {"foo": set(["bar", "bur"])}),
#        ],
#    )
#    def test_update_flag_count(
#        self,
#        empty_quality_metric_parser,
#        flag_level,
#        qc_title,
#        sample_properties,
#        expected_sample_properties,
#    ):
#        """Unit test adding QC title to flag property in sample
#        properties."""
#        empty_quality_metric_parser.update_flag_count(
#            flag_level, qc_title, sample_properties
#        )
#        assert sample_properties == expected_sample_properties
#
#    @pytest.mark.parametrize(
#        "processed_files_with_quality_metrics,expected_associate_quality_metric_calls",
#        [
#            ([], []),
#            ([({}, [], None)], []),
#            (
#                [({"quality_metric": "some_atid"}, [], None)],
#                [("some_atid", [], {"property_replacements": None})],
#            ),
#            (
#                [
#                    ({}, [], None),
#                    ({"quality_metric": "some_atid"}, ["foobar"], {"foo": "bar"}),
#                ],
#                [
#                    (
#                        "some_atid",
#                        ["foobar"],
#                        {"property_replacements": {"foo": "bar"}},
#                    )
#                ],
#            ),
#        ],
#    )
#    def test_associate_file_quality_metrics_with_samples(
#        self,
#        empty_quality_metric_parser,
#        processed_files_with_quality_metrics,
#        expected_associate_quality_metric_calls,
#    ):
#        """Unit test associating QualitMetrics from SampleProcessing's
#        FilesProcessed with sample-specific QC data.
#        """
#        setattr(
#            empty_quality_metric_parser,
#            "processed_files_with_quality_metrics",
#            processed_files_with_quality_metrics,
#        )
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "associate_quality_metric_with_sample",
#        ) as mocked_associate_quality_metric_with_sample:
#            empty_quality_metric_parser.associate_file_quality_metrics_with_samples()
#            result_calls = mocked_associate_quality_metric_with_sample.call_args_list
#            if not expected_associate_quality_metric_calls:
#                mocked_associate_quality_metric_with_sample.assert_not_called()
#            else:
#                assert len(result_calls) == len(expected_associate_quality_metric_calls)
#                for (
#                    processed_file,
#                    properties_to_find,
#                    kwargs,
#                ) in expected_associate_quality_metric_calls:
#                    mocked_associate_quality_metric_with_sample.assert_has_calls(
#                        [mock.call(processed_file, properties_to_find, **kwargs)]
#                    )
#
#    @pytest.mark.parametrize(
#        (
#            "qc_item,properties_to_find,links,property_replacements,sample_mapping,expected_log,"
#            "expected_add_qc_calls"
#        ),
#        [
#            ({}, [], None, None, {}, False, []),
#            (QC_WITH_SUMMARY_1, [], None, None, {}, True, []),
#            ({}, [], None, None, SAMPLE_MAPPING, False, []),
#            (
#                QC_WITH_SUMMARY_1,
#                [],
#                None,
#                None,
#                SAMPLE_MAPPING,
#                False,
#                [(SAMPLE_1_PROPERTIES, QC_ITEM_SUMMARY_1)],
#            ),
#            (
#                QC_WITH_SUMMARY_1_2,
#                [],
#                None,
#                None,
#                SAMPLE_MAPPING,
#                True,
#                [(SAMPLE_1_PROPERTIES, QC_ITEM_SUMMARY_1)],
#            ),
#            (
#                QC_WITH_SUMMARY_1,
#                [],
#                SOME_QC_LINK,
#                SOME_PROPERTY_REPLACEMENTS,
#                SAMPLE_MAPPING,
#                False,
#                [(SAMPLE_1_PROPERTIES, QC_ITEM_SUMMARY_1)],
#            ),
#        ],
#    )
#    def test_associate_quality_metric_with_sample(
#        self,
#        captured_log,
#        empty_quality_metric_parser,
#        qc_item,
#        properties_to_find,
#        links,
#        property_replacements,
#        sample_mapping,
#        expected_log,
#        expected_add_qc_calls,
#    ):
#        """Unit test associating one QualityMetric's QC items with
#        samples' data.
#        """
#        empty_quality_metric_parser.sample_mapping = sample_mapping
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "get_item",
#            return_value=qc_item,
#        ) as mocked_get_item:
#            with mock.patch.object(
#                sample_type_module.QualityMetricParser,
#                "get_qc_links",
#                return_value=links,
#            ) as mocked_get_peddy_link:
#                with mock.patch.object(
#                    sample_type_module.QualityMetricParser,
#                    "add_qc_property_to_sample_info",
#                ) as mocked_add_qc_property:
#                    empty_quality_metric_parser.associate_quality_metric_with_sample(
#                        qc_item,
#                        properties_to_find,
#                        property_replacements=property_replacements,
#                    )
#                    mocked_get_item.assert_called_once()
#                    mocked_get_peddy_link.assert_called_once_with(qc_item)
#                    if expected_add_qc_calls:
#                        kwargs = {
#                            "links": links,
#                            "property_replacements": property_replacements,
#                        }
#                        for args in expected_add_qc_calls:
#                            mocked_add_qc_property.assert_has_calls(
#                                [mock.call(*args, properties_to_find, **kwargs)]
#                            )
#                        assert len(expected_add_qc_calls) == len(
#                            mocked_add_qc_property.call_args_list
#                        )
#                    else:
#                        mocked_add_qc_property.assert_not_called()
#                    log_calls = captured_log.get_calls()
#                    if expected_log:
#                        assert log_calls
#                    else:
#                        assert not log_calls
#
#    @pytest.mark.parametrize(
#        "quality_metric,expected",
#        [
#            ({}, None),
#            (QC_WITH_NO_PEDDY_QC_LINK, None),
#            (QC_WITH_PEDDY_QC_LINK, SOME_PEDDY_LINK),
#        ],
#    )
#    def test_get_qc_links(self, empty_quality_metric_parser, quality_metric, expected):
#        """Unit test collection of QC links for display."""
#        result = empty_quality_metric_parser.get_qc_links(quality_metric)
#        assert result == expected
#
#    @pytest.mark.parametrize(
#        "evaluator_exists,evaluator_result,evaluator_error,expected",
#        [
#            (False, None, False, None),
#            (True, 5, False, 5),
#            (True, "foo", True, None),
#        ],
#    )
#    def test_add_flags_for_qc_value(
#        self,
#        captured_log,
#        empty_quality_metric_parser,
#        evaluator_exists,
#        evaluator_result,
#        evaluator_error,
#        expected,
#    ):
#        """Unit test flagging QC values."""
#        sample_qc_properties = {"foo": "bar"}
#        qc_title = "some_title"
#        qc_value = "some_value"
#        qc_property_to_evaluator = {}
#        side_effect = None
#        if evaluator_error:
#            side_effect = Exception("Problem found")
#        evaluator = mock.MagicMock(
#            return_value=evaluator_result, side_effect=side_effect
#        )
#        if evaluator_exists:
#            qc_property_to_evaluator[qc_title] = evaluator
#        empty_quality_metric_parser.qc_property_to_evaluator = qc_property_to_evaluator
#        result = empty_quality_metric_parser.add_flags_for_qc_value(
#            sample_qc_properties, qc_title, qc_value
#        )
#        if evaluator_exists:
#            evaluator.assert_called_once_with(qc_value, sample_qc_properties)
#        else:
#            evaluator.assert_not_called()
#        log_calls = captured_log.get_calls()
#        if evaluator_error:
#            assert log_calls
#        else:
#            assert not log_calls
#        assert result == expected
#
#    @pytest.mark.parametrize(
#        "sample_mapping,schema_properties,expected",
#        [
#            ({}, [], []),
#            (SAMPLE_MAPPING, ["foo", "fu"], [SAMPLE_1_PROPERTIES]),
#            (
#                SAMPLE_MAPPING,
#                ["foo", "fu", "baz"],
#                [SAMPLE_1_PROPERTIES, SAMPLE_2_PROPERTIES],
#            ),
#        ],
#    )
#    def test_reformat_sample_mapping_to_schema(
#        self, empty_quality_metric_parser, sample_mapping, schema_properties, expected
#    ):
#        """Unit test conversion of sample mapping --> sample-specific
#        data to desired output for calcprop.
#        """
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "convert_flag_sets_to_lists",
#            side_effect=self.return_input,
#        ) as mocked_convert_flags:
#            with mock.patch.object(
#                sample_type_module.QualityMetricParser,
#                "SCHEMA_PROPERTIES",
#                return_value=schema_properties,
#                new_callable=mock.PropertyMock,
#            ):
#                empty_quality_metric_parser.sample_mapping = sample_mapping
#                result = empty_quality_metric_parser.reformat_sample_mapping_to_schema()
#                for item in sample_mapping.values():
#                    mocked_convert_flags.assert_any_call(item)
#                assert result == expected
#
#    @pytest.mark.parametrize(
#        "flags_to_capture,sample_properties,expected",
#        [
#            ([], {}, {}),
#            (SOME_FLAG_NAMES, {}, {}),
#            ([], SAMPLE_PROPERTIES_WITH_FLAGS, SAMPLE_PROPERTIES_WITH_FLAGS),
#            (
#                SOME_FLAG_NAMES,
#                SAMPLE_PROPERTIES_WITH_FLAGS,
#                SAMPLE_PROPERTIES_WITH_FLAGS_LIST,
#            ),
#        ],
#    )
#    def test_convert_flag_sets_to_lists(
#        self, empty_quality_metric_parser, flags_to_capture, sample_properties, expected
#    ):
#        """Unit test conversion of flag properties from lists to sets."""
#        with mock.patch.object(
#            sample_type_module.QualityMetricParser,
#            "FLAGS_TO_CAPTURE",
#            new_callable=mock.PropertyMock,
#            return_value=flags_to_capture,
#        ):
#            empty_quality_metric_parser.convert_flag_sets_to_lists(sample_properties)
#            for key, value in sample_properties.items():
#                expected_value = expected[key]
#                assert type(value) == type(expected_value)
#                assert len(value) == len(expected_value)
#                for item in expected_value:
#                    assert item in value


def test_quality_control_metrics(
    testapp, child, mother, sample_processing, vep_vcf_with_qcs
):
    """Integrated testing of calcprop with fixtures."""
    sample_processing_atid = sample_processing["@id"]

    # All samples + files
    quality_control_metrics = sample_processing.get("quality_control_metrics")
    assert quality_control_metrics == [
        PROBAND_SAMPLE_QC_METRICS,
        PROBAND_SAMPLE_2_QC_METRICS,
        MOTHER_SAMPLE_QC_METRICS,
    ]

    # No samples, all files
    patch_body = {"samples": []}
    response = testapp.patch_json(sample_processing_atid, patch_body, status=200).json[
        "@graph"
    ][0]
    assert response.get("quality_control_metrics") is None

    # Partial samples, all files
    proband_samples = child.get("samples")
    patch_body = {"samples": proband_samples}
    response = testapp.patch_json(sample_processing_atid, patch_body, status=200).json[
        "@graph"
    ][0]
    assert response.get("quality_control_metrics") == [
        PROBAND_SAMPLE_QC_METRICS,
        PROBAND_SAMPLE_2_QC_METRICS,
    ]

    # All samples, no files
    mother_sample = mother.get("samples")
    all_samples = proband_samples + mother_sample
    patch_body = {"samples": all_samples, "processed_files": []}
    response = testapp.patch_json(sample_processing_atid, patch_body, status=200).json[
        "@graph"
    ][0]
    assert response.get("quality_control_metrics") is None

    # All samples, only VEP file
    vep_file_atid = vep_vcf_with_qcs["@id"]
    patch_body = {"processed_files": [vep_file_atid]}
    response = testapp.patch_json(sample_processing_atid, patch_body, status=200).json[
        "@graph"
    ][0]
    assert response.get("quality_control_metrics") is None
