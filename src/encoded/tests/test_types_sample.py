import copy
from unittest import mock

import pytest

from ..types import sample as sample_type_module
from .utils import make_atid


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


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
    PROPERTIES = {"foo": "bar", "fu": "bur"}
    WORKUP_TYPE = "some_workup_type"
    LINK = {"foo": "bar"}
    FLAG = "some_flag"
    COMPLETED_PROCESS = "some_completed_process"
    PEDDY_QC_ATID = "/quality-metrics-peddyqc/some_uuid/"
    PEDDY_QC_LIST = [
        {"qc_type": "foo", "value": "bar"},
        {"qc_type": "quality_metric_peddyqc", "value": PEDDY_QC_ATID},
    ]
    RESULT = "some_result"
    SAMPLE_1_QC_METRICS = {
        "coverage": {"flag": "fail", "value": "30x"},
        "filtered_variants": {"value": "1100"},
        "total_reads": {"value": "123456789"},
        "individual_accession": "GAPID8J9B9CR",
        "predicted_sex": {
            "flag": "warn",
            "link": "/quality-metrics-peddyqc/feb921a1-064e-4aef-b8c0-b88f3faa548f/@@download",
            "value": "male",
        },
        "sex": {"value": "F"},
        "de_novo_fraction": {"value": "5.2"},
        "sequencing_type": "WES",
        "bam_sample_id": "Sample_ID",
        "warn": ["predicted_sex"],
        "fail": ["coverage", "transition_transversion_ratio"],
        "specimen_type": "peripheral_blood",
        "transition_transversion_ratio": {"flag": "fail", "value": "1.96"},
        "heterozygosity_ratio": {"flag": "pass", "value": "2.0"},
        "predicted_ancestry": {
            "link": "/quality-metrics-peddyqc/feb921a1-064e-4aef-b8c0-b88f3faa548f/@@download",
            "value": "EARTH",
        },
        "total_variants_called": {"value": "11000"},
        "filtered_structural_variants": {"value": "92"},
        "completed_qcs": ["BAM", "SNV", "SV"],
    }
    SAMPLE_2_QC_METRICS = {
        "coverage": {"flag": "pass", "value": "50x"},
        "filtered_variants": {"value": "1180"},
        "total_reads": {"value": "987654321"},
        "individual_accession": "GAPIDAF1DXBB",
        "predicted_sex": {
            "flag": "warn",
            "link": "/quality-metrics-peddyqc/feb921a1-064e-4aef-b8c0-b88f3faa548f/@@download",
            "value": "male",
        },
        "sex": {"value": "F"},
        "sequencing_type": "WGS",
        "bam_sample_id": "Another_Sample_ID",
        "warn": ["heterozygosity_ratio", "predicted_sex"],
        "fail": ["transition_transversion_ratio"],
        "transition_transversion_ratio": {"flag": "fail", "value": "2.5"},
        "heterozygosity_ratio": {"flag": "warn", "value": "3.0"},
        "predicted_ancestry": {
            "link": "/quality-metrics-peddyqc/feb921a1-064e-4aef-b8c0-b88f3faa548f/@@download",
            "value": "MARS",
        },
        "total_variants_called": {"value": "11800"},
        "filtered_structural_variants": {"value": "92"},
        "completed_qcs": ["BAM", "SNV", "SV"],
    }
    SAMPLE_1_BAM_ONLY_QC_METRICS = {
        "coverage": {"flag": "fail", "value": "30x"},
        "total_reads": {"value": "123456789"},
        "individual_accession": "GAPID8J9B9CR",
        "sex": {"value": "F"},
        "sequencing_type": "WES",
        "bam_sample_id": "Sample_ID",
        "fail": ["coverage"],
        "specimen_type": "peripheral_blood",
        "completed_qcs": ["BAM"],
    }
    SAMPLE_1_NO_FILES_QC_METRICS = {
        "individual_accession": "GAPID8J9B9CR",
        "sex": {"value": "F"},
        "sequencing_type": "WES",
        "bam_sample_id": "Sample_ID_2",
        "specimen_type": "peripheral_blood",
    }

    @staticmethod
    def mocked_individual_for_qc():
        """Fully mocked IndividualForQc."""
        return mock.create_autospec(sample_type_module.IndividualForQc, instance=True)

    @staticmethod
    def mocked_sample_for_qc():
        """Fully mocked SampleForQc."""
        return mock.create_autospec(sample_type_module.SampleForQc, instance=True)

    @staticmethod
    def mocked_qc_summary():
        """Fully mocked QcSummary."""
        return mock.create_autospec(sample_type_module.QcSummary, instance=True)

    @staticmethod
    def mocked_file_for_qc():
        """Fully mocked FileForQc."""
        return mock.create_autospec(sample_type_module.FileForQc, instance=True)

    @staticmethod
    def mocked_sample_qc_report():
        """Fully mocked SampleQcReport."""
        return mock.create_autospec(sample_type_module.SampleQcReport, instance=True)

    @staticmethod
    def mocked_quality_metric_for_qc():
        """Fully mocked QualityMetricForQc."""
        return mock.create_autospec(
            sample_type_module.QualityMetricForQc, instance=True
        )


class TestQcFlagger:
    def qc_flagger(self):
        return sample_type_module.QcFlagger

    @pytest.mark.parametrize(
        "value,fail_upper,fail_lower,warn_upper,warn_lower,default,expected",
        [
            (30, 20, None, None, None, None, "fail"),
            (10, 20, None, None, None, None, None),
            (10, 20, None, 5, None, None, "warn"),
            (20, 20, None, None, None, "foo", "foo"),
            (20, None, 20, None, None, None, None),
            (10, 20, None, None, None, "pass", "pass"),
            (10, None, None, 15, 5, None, None),
            (10, None, None, 15, 5, "pass", "pass"),
            (20, None, None, 15, 5, None, "warn"),
            (0, None, None, 15, 5, None, "warn"),
        ],
    )
    def test_assign_flag(
        self,
        value,
        fail_upper,
        fail_lower,
        warn_upper,
        warn_lower,
        default,
        expected,
    ):
        result = self.qc_flagger().assign_flag(
            value, fail_upper, fail_lower, warn_upper, warn_lower, default
        )
        assert result == expected

    def make_mocked_sample(self, is_wgs=None, is_wes=None):
        mocked_sample = QcTestConstants.mocked_sample_for_qc()
        mocked_sample.is_wgs.return_value = is_wgs
        mocked_sample.is_wes.return_value = is_wes
        mocked_sample.properties = QcTestConstants.PROPERTIES
        mocked_sample.workup_type = QcTestConstants.WORKUP_TYPE
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
    def test_flag_bam_coverage(self, coverage, is_wgs, is_wes, expected_log, expected):
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
    def test_flag_sex_consistency(self, predicted_sex, individual_sex, expected):
        mocked_individual = QcTestConstants.mocked_individual_for_qc()
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
    def test_flag_heterozygosity_ratio(self, heterozygosity_ratio, expected):
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
            ("2.2", False, True, False, "pass"),
            ("2.15", False, True, False, "warn"),
            ("2.1", False, True, False, "warn"),
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
    QC_SUMMARY_DISPLAY_WITH_LINK_AND_FLAG = {
        QC_SUMMARY_TITLE_SNAKE_CASE: {
            "value": QC_SUMMARY_VALUE,
            "link": QcTestConstants.LINK,
            "flag": QcTestConstants.FLAG,
        }
    }

    def simple_qc_summary(self):
        return sample_type_module.QcSummary(
            copy.deepcopy(self.QC_SUMMARY_PROPERTIES), QcTestConstants.COMPLETED_PROCESS
        )

    @pytest.mark.parametrize(
        "evaluator_exists,evaluator_exception,evaluator_result,expected_flag",
        [
            (False, False, "a_result", None),
            (True, True, "a_result", None),
            (False, True, "a_result", None),
            (True, False, "a_result", "a_result"),
        ],
    )
    def test_set_flag(
        self,
        evaluator_exists,
        evaluator_exception,
        evaluator_result,
        expected_flag,
    ):
        """Test retrieval and handling of flag evaluator.

        Mock the evaluator to control its behavior (result returned or
        exception raised), and mock the mapping of QC titles to
        evaluators so independent of actual class constants.
        """
        mocked_sample = QcTestConstants.mocked_sample_for_qc()
        mocked_individual = QcTestConstants.mocked_individual_for_qc()
        title_to_flag_evaluator = {}
        mocked_evaluator = mock.MagicMock(return_value=evaluator_result)
        if evaluator_exception:
            mocked_evaluator.side_effect = Exception
        if evaluator_exists:
            title_to_flag_evaluator[self.QC_SUMMARY_TITLE_SNAKE_CASE] = mocked_evaluator
        with mock.patch.object(
            sample_type_module.QcSummary,
            "QC_TITLE_TO_FLAG_EVALUATOR",
            new_callable=mock.PropertyMock,
            return_value=title_to_flag_evaluator,
        ):
            with mock.patch.object(sample_type_module, "log") as mocked_log:
                qc_summary = self.simple_qc_summary()
                qc_summary.set_flag(mocked_sample, mocked_individual)
                assert qc_summary.flag == expected_flag
                if evaluator_exists:
                    mocked_evaluator.assert_called_once_with(
                        self.QC_SUMMARY_VALUE,
                        sample=mocked_sample,
                        individual=mocked_individual,
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
        ],
    )
    def test_get_qc_title(self, title_replacements, expected):
        qc_summary = self.simple_qc_summary()
        result = qc_summary.get_qc_title(self.QC_SUMMARY_TITLE, title_replacements)
        assert result == expected

    @pytest.mark.parametrize(
        "link,flag,expected",
        [
            (None, None, QC_SUMMARY_DISPLAY),
            (
                QcTestConstants.LINK,
                QcTestConstants.FLAG,
                QC_SUMMARY_DISPLAY_WITH_LINK_AND_FLAG,
            ),
        ],
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
    TITLE_REPLACEMENTS = {"fu": "bur"}

    def quality_metric_for_qc(self, quality_metric_item):
        with mock.patch.object(
            sample_type_module, "get_item", return_value=quality_metric_item
        ):
            return sample_type_module.QualityMetricForQc(
                QcTestConstants.ATID, QcTestConstants.REQUEST
            )

    @pytest.mark.parametrize(
        "quality_metric,links,expected_summaries",
        [
            ({}, QcTestConstants.LINK, []),
            (QC_WITH_SUMMARIES, None, [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]),
            (
                QC_WITH_SUMMARIES,
                QcTestConstants.LINK,
                [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2],
            ),
        ],
    )
    def test_collect_qc_summaries(self, quality_metric, links, expected_summaries):
        """Test creation and collection of QC summaries from a
        QualityMetric.

        Though a simple method, mock out the class constants and methods
        used in creation of the QcSummary objects (since all return
        None for this abstract class) to ensure created as intended.
        """
        with mock.patch.object(
            sample_type_module.QualityMetricForQc, "get_qc_links", return_value=links
        ):
            with mock.patch.object(
                sample_type_module, "QcSummary", autospec=True
            ) as mocked_qc_summary:
                with mock.patch.object(
                    sample_type_module.QualityMetricForQc,
                    "COMPLETED_QC_PROCESS",
                    new_callable=mock.PropertyMock,
                    return_value=QcTestConstants.COMPLETED_PROCESS,
                ):
                    with mock.patch.object(
                        sample_type_module.QualityMetricForQc,
                        "QC_TITLE_REPLACEMENTS",
                        new_callable=mock.PropertyMock,
                        return_value=self.TITLE_REPLACEMENTS,
                    ):
                        quality_metric_for_qc = self.quality_metric_for_qc(
                            quality_metric
                        )
                        result = quality_metric_for_qc.collect_qc_summaries()
                        assert len(result) == len(expected_summaries)
                        for item in result:
                            assert item == mocked_qc_summary.return_value
                        for summary in expected_summaries:
                            mocked_qc_summary.assert_any_call(
                                summary,
                                QcTestConstants.COMPLETED_PROCESS,
                                links=links,
                                title_replacements=self.TITLE_REPLACEMENTS,
                            )


class TestSnvVepVcfQc:

    SOME_PEDDY_QC_DOWNLOAD = QcTestConstants.PEDDY_QC_ATID + "@@download"
    QUALITY_METRIC_NO_PEDDY_QC = {
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
        ],
    }
    QUALITY_METRIC_WITH_PEDDY_QC = {"qc_list": QcTestConstants.PEDDY_QC_LIST}

    def snv_vep_vcf_qc(self, quality_metric_item):
        with mock.patch.object(
            sample_type_module, "get_item", return_value=quality_metric_item
        ):
            return sample_type_module.SnvVepVcfQc(
                QcTestConstants.ATID, QcTestConstants.REQUEST
            )

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
                },
            ),
        ],
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
    FILE_PROCESSED_SNV_VEP_VCF = {
        "variant_type": "SNV",
        "file_type": "Vep-annotated VCF",
        "file_format": VCF_FILE_FORMAT,
        "qc_list": QcTestConstants.PEDDY_QC_LIST,
    }
    FILE_PROCESSED_SNV_VEP_VCF_2 = {
        "variant_type": "SNV",
        "description": "output from VEP in VCF format",
        "file_format": VCF_FILE_FORMAT,
        "qc_list": QcTestConstants.PEDDY_QC_LIST,
    }
    FILE_PROCESSED_NON_VCF = {
        "file_format": "foo",
        "file_type": "bar",
    }
    FILE_PROCESSED_BAM = {"file_format": "/file-formats/bam/"}

    def file_for_qc(self, file_item):
        with mock.patch.object(sample_type_module, "get_item", return_value=file_item):
            return sample_type_module.FileForQc(
                QcTestConstants.ATID, QcTestConstants.REQUEST
            )

    @pytest.mark.parametrize(
        "file_item,expected",
        [
            (FILE_PROCESSED_NON_VCF, False),
            (FILE_PROCESSED_SNV_FINAL_VCF_1, True),
        ],
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
        ],
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
        ],
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
            (FILE_PROCESSED_SNV_VEP_VCF_2, True),
        ],
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
        ],
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
        ],
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
        ],
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
            return sample_type_module.SampleForQc(
                QcTestConstants.ATID, QcTestConstants.REQUEST
            )

    def empty_sample_for_qc(self):
        return self.sample_for_qc({})

    @pytest.mark.parametrize(
        "is_bam_results",
        [
            [],
            [False],
            [True, True, False],
        ],
    )
    def test_get_quality_metrics(self, is_bam_results):
        """Test retrieval of relevant QualityMetric objects from
        processed files on the Sample.

        Since only looking for BAMs currently, mock out the processed
        file objects on the Sample to return corresponding result of
        whether file is a BAM and to ensure methods called correctly.
        """
        processed_file_atids = [QcTestConstants.ATID for item in is_bam_results]
        with mock.patch.object(
            sample_type_module,
            "FileForQc",
            autospec=True,
        ) as mocked_file:
            mocked_file_instance = mocked_file.return_value
            mocked_file_instance.is_bam.side_effect = is_bam_results
            mocked_file_instance.create_quality_metric_for_qc.return_value = (
                QcTestConstants.RESULT
            )
            sample_for_qc = self.empty_sample_for_qc()
            sample_for_qc.processed_files = processed_file_atids
            result = sample_for_qc.get_quality_metrics()
            if any(is_bam_results):
                mocked_file.assert_called()
                mocked_file_instance.create_quality_metric_for_qc.assert_called_once_with(
                    sample_type_module.BamQc
                )
                assert result == [QcTestConstants.RESULT]
            else:
                mocked_file_instance.create_quality_metric_for_qc.assert_not_called()
                assert result == []


class TestItemQcProperties:
    def simple_item_properties(self):
        with mock.patch.object(
            sample_type_module,
            "get_item",
            return_value=copy.deepcopy(QcTestConstants.PROPERTIES),
        ):
            return sample_type_module.ItemProperties(
                QcTestConstants.ATID, QcTestConstants.REQUEST
            )

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
        ],
    )
    def test_update_qc_properties(
        self,
        non_display_properties,
        display_properties,
        property_replacements,
        expected,
    ):
        """Test creation of QC display and non-display properties.

        Testing on the abstract class here, so mock the corresponding
        class constants as though a concrete class.
        """
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
                    assert (
                        item_with_qc_properties.item_properties
                        == QcTestConstants.PROPERTIES
                    )


class TestSampleQcReport:
    def simple_sample_qc_report(self):
        return sample_type_module.SampleQcReport(
            QcTestConstants.ATID, QcTestConstants.REQUEST
        )

    def test_add_qc_summary(self):
        sample_qc_report = self.simple_sample_qc_report()
        mocked_qc_summary = QcTestConstants.mocked_qc_summary()
        sample_qc_report.add_qc_summary(mocked_qc_summary)
        mocked_qc_summary.set_flag.assert_called_once_with(
            sample_qc_report.sample, sample_qc_report.individual
        )
        assert sample_qc_report.qc_summaries == [mocked_qc_summary]

    @pytest.mark.parametrize(
        "qc_properties,expected",
        [
            ([], {}),
            ([{"foo": "bar"}, {"fu": "bur"}], {"foo": "bar", "fu": "bur"}),
        ],
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
        ],
    )
    def test_record_qc_summaries(self, qc_displays, expected):
        qc_summaries = []
        for qc_display in qc_displays:
            mocked_qc_summary = QcTestConstants.mocked_qc_summary()
            mocked_qc_summary.get_qc_display.return_value = qc_display
            qc_summaries.append(mocked_qc_summary)
        with mock.patch.object(
            sample_type_module.SampleQcReport, "update_flags"
        ) as mocked_update_flags:
            with mock.patch.object(
                sample_type_module.SampleQcReport, "update_completed_processes"
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
        ],
    )
    def test_update_flags(self, existing_flags, qc_flag, qc_title, expected_flags):
        mocked_qc_summary = QcTestConstants.mocked_qc_summary()
        mocked_qc_summary.flag = qc_flag
        mocked_qc_summary.title = qc_title
        sample_qc_report = self.simple_sample_qc_report()
        sample_qc_report.flags = existing_flags
        sample_qc_report.update_flags(mocked_qc_summary)
        assert sample_qc_report.flags == expected_flags

    @pytest.mark.parametrize(
        "completed_process,expected",
        [
            (None, set()),
            ("foo", set(["foo"])),
        ],
    )
    def test_update_completed_processes(self, completed_process, expected):
        mocked_qc_summary = QcTestConstants.mocked_qc_summary()
        mocked_qc_summary.completed_process = completed_process
        sample_qc_report = self.simple_sample_qc_report()
        sample_qc_report.update_completed_processes(mocked_qc_summary)
        assert sample_qc_report.completed_processes == expected

    @pytest.mark.parametrize(
        "completed_processes,expected",
        [
            ([], {}),
            (["foo", "bar"], {"completed_qcs": ["bar", "foo"]}),
        ],
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
        ],
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
        ],
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


class TestQualityMetricParser:
    """Note: Since this class is heavily dependent on many others,
    tests employ much mocking to ensure objects called correctly and
    'business logic' of orchestration makes sense. Integrated tests
    with workbook inserts are essential to ensure the orchestration
    actually works on real items.
    """

    SAMPLE_1 = "sample_1"
    SAMPLE_2 = "sample_2"

    def quality_metric_parser(self):
        return sample_type_module.QualityMetricParser(QcTestConstants.REQUEST)

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
        samples,
        processed_files,
        qc_display,
        expected,
    ):
        """Test orchestration of QC metric collection from samples and
        processed files.

        Mock out all the methods to ensure calls made correctly, but
        challenging to test in integrated fashion given number of
        objects indirectly called via sub-requests. Integrated tests
        with workbook inserts test this more completely.
        """
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "collect_quality_metrics",
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
                        quality_metric_parser = self.quality_metric_parser()
                        result = quality_metric_parser.get_qc_display_results(
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
                ],
            ),
        ],
    )
    def test_collect_quality_metrics(
        self,
        quality_metric_types,
        expected_add_quality_metric_call_types,
    ):
        """Test collection of desired QualityMetrics off of processed
        files on SampleProcessing.

        Mock out processed files and relevant method results.
        """
        processed_files = [QcTestConstants.RESULT for item in quality_metric_types]
        with mock.patch.object(
            sample_type_module,
            "FileForQc",
            **{
                "return_value.get_quality_metric_type.side_effect": quality_metric_types
            },
        ) as mocked_file:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "add_quality_metric",
            ) as mocked_add_quality_metric:
                quality_metric_parser = self.quality_metric_parser()
                quality_metric_parser.collect_quality_metrics(processed_files)
                if not expected_add_quality_metric_call_types:
                    mocked_add_quality_metric.assert_not_called()
                else:
                    assert len(mocked_add_quality_metric.call_args_list) == len(
                        expected_add_quality_metric_call_types
                    )
                    for expected_type in expected_add_quality_metric_call_types:
                        mocked_add_quality_metric.assert_any_call(
                            expected_type, mocked_file.return_value
                        )

    @pytest.mark.parametrize(
        "quality_metric,expected",
        [
            (None, []),
            ("foobar", ["foobar"]),
        ],
    )
    def test_add_quality_metric(self, quality_metric, expected):
        quality_metric_parser = self.quality_metric_parser()
        mocked_file_for_qc = QcTestConstants.mocked_file_for_qc()
        mocked_file_for_qc.create_quality_metric_for_qc.return_value = quality_metric
        quality_metric_parser.add_quality_metric(
            QcTestConstants.RESULT, mocked_file_for_qc
        )
        mocked_file_for_qc.create_quality_metric_for_qc.assert_called_once_with(
            QcTestConstants.RESULT
        )
        assert quality_metric_parser.quality_metrics == expected

    @pytest.mark.parametrize(
        "quality_metrics,bam_sample_id",
        [
            ([], None),
            ([], "sample_id"),
            (["foo", "bar"], "sample_id"),
        ],
    )
    def test_collect_sample_data(self, quality_metrics, bam_sample_id):
        """Test collection of Sample data required for QC metrics.

        Mock out classes to facilitate testing, as difficult to provide
        enough data to test in more integrated fashion.
        """
        mocked_sample_for_qc = QcTestConstants.mocked_sample_for_qc()
        mocked_sample_for_qc.bam_sample_id = bam_sample_id
        mocked_sample_for_qc.get_quality_metrics.return_value = quality_metrics
        with mock.patch.object(
            sample_type_module,
            "SampleQcReport",
            autospec=True,
        ) as mocked_sample_qc_report:
            mocked_sample_qc_report.return_value.sample = mocked_sample_for_qc
            quality_metric_parser = self.quality_metric_parser()
            quality_metric_parser.collect_sample_data(QcTestConstants.ATID)
            mocked_sample_qc_report.assert_called_once_with(
                QcTestConstants.ATID, QcTestConstants.REQUEST
            )
            assert quality_metric_parser.quality_metrics == quality_metrics
            sample_mapping = quality_metric_parser.sample_mapping
            if bam_sample_id:
                assert len(sample_mapping) == 1
                assert (
                    sample_mapping[bam_sample_id]
                    == mocked_sample_qc_report.return_value
                )
            else:
                assert not quality_metric_parser.sample_mapping

    @pytest.mark.parametrize(
        "qc_summary_samples,expected_log_info,expected_summary_adds",
        [
            ([], 0, []),
            ([SAMPLE_2], 1, []),
            ([SAMPLE_1], 0, [SAMPLE_1]),
            ([SAMPLE_1, SAMPLE_2], 1, [SAMPLE_1]),
        ],
    )
    def test_associate_quality_metrics_with_samples(
        self,
        qc_summary_samples,
        expected_log_info,
        expected_summary_adds,
    ):
        """Test adding QC summaries to matching sample objects.

        Mock out the quality metric, QC summary, and sample objects to
        facilitate testing here, as well as use a simple, fixed sample
        mapping.
        """
        quality_metric_parser = self.quality_metric_parser()
        mocked_sample_qc_report = QcTestConstants.mocked_sample_qc_report()
        sample_mapping = {self.SAMPLE_1: mocked_sample_qc_report}
        quality_metric_parser.sample_mapping = sample_mapping
        qc_summaries = [
            mock.MagicMock(**{"sample": sample}) for sample in qc_summary_samples
        ]
        mocked_quality_metric = QcTestConstants.mocked_quality_metric_for_qc()
        mocked_quality_metric.collect_qc_summaries.return_value = qc_summaries
        mocked_quality_metric.properties = "foo"
        quality_metric_parser.quality_metrics = [mocked_quality_metric]
        with mock.patch.object(
            sample_type_module,
            "log",
        ) as mocked_log:
            quality_metric_parser.associate_quality_metrics_with_samples()
            assert len(mocked_log.info.call_args_list) == expected_log_info
            add_qc_summary_calls = mocked_sample_qc_report.add_qc_summary.call_args_list
            assert len(add_qc_summary_calls) == len(expected_summary_adds)
            for call in add_qc_summary_calls:
                called_qc_summary = call[0][0]
                assert called_qc_summary.sample in expected_summary_adds

    def test_create_qc_display(self):
        quality_metric_parser = self.quality_metric_parser()
        sample_qc_display_1 = "foo"
        sample_qc_display_2 = None
        sample_qc_displays = [sample_qc_display_1, sample_qc_display_2]
        sample_qc_reports = [
            mock.MagicMock(**{"get_qc_display.return_value": sample_qc_display})
            for sample_qc_display in sample_qc_displays
        ]
        sample_mapping = {idx: item for idx, item in enumerate(sample_qc_reports)}
        quality_metric_parser.sample_mapping = sample_mapping
        result = quality_metric_parser.create_qc_display()
        assert result == [sample_qc_display_1]


@pytest.mark.workbook
def test_quality_control_metrics(es_testapp, workbook):
    """Integrated testing of calcprop with workbook items.

    Tests calcprop on items below as they exist in inserts, then
    manipulates one item to ensure corresponding changes in calcprop.
    """
    sample_processing_without_samples_uuid = "589fee08-e054-4786-862d-f7250a435793"
    sample_processing_one_sample_uuid = "589fee08-e054-4786-862d-f7250a435794"
    sample_processing_two_samples_uuid = "8471a80f-81c6-4663-a182-c2955c21c6ce"
    sample_processing_one_sample_no_vcfs_uuid = "d9a26951-9bfa-4a11-a014-35d5724bfbff"
    sample_processing_one_sample_no_files_uuid = "5cac1b7d-563d-4258-b93b-37b3a6f765d5"

    no_samples_atid = make_atid(sample_processing_without_samples_uuid)
    one_sample_atid = make_atid(sample_processing_one_sample_uuid)
    two_samples_atid = make_atid(sample_processing_two_samples_uuid)
    one_sample_no_vcfs_atid = make_atid(sample_processing_one_sample_no_vcfs_uuid)
    one_sample_no_files_atid = make_atid(sample_processing_one_sample_no_files_uuid)

    sample_processing_without_samples = es_testapp.get(no_samples_atid, status=200).json
    assert sample_processing_without_samples.get("quality_control_metrics") is None

    sample_processing_one_sample = es_testapp.get(one_sample_atid, status=200).json
    assert sample_processing_one_sample.get("quality_control_metrics") == [
        QcTestConstants.SAMPLE_1_QC_METRICS
    ]

    sample_processing_two_samples = es_testapp.get(two_samples_atid, status=200).json
    assert sample_processing_two_samples.get("quality_control_metrics") == [
        QcTestConstants.SAMPLE_1_QC_METRICS,
        QcTestConstants.SAMPLE_2_QC_METRICS,
    ]

    sample_processing_one_sample_no_vcfs = es_testapp.get(
        one_sample_no_vcfs_atid, status=200
    ).json
    assert sample_processing_one_sample_no_vcfs.get("quality_control_metrics") == [
        QcTestConstants.SAMPLE_1_BAM_ONLY_QC_METRICS
    ]

    sample_processing_one_sample_no_files = es_testapp.get(
        one_sample_no_files_atid, status=200
    ).json
    assert sample_processing_one_sample_no_files.get("quality_control_metrics") == [
        QcTestConstants.SAMPLE_1_NO_FILES_QC_METRICS
    ]
