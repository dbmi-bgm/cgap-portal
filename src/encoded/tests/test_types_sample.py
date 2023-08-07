import copy
from contextlib import contextmanager
from unittest import mock
from typing import Iterator, Optional, Union

import pytest
from dcicutils.testing_utils import patch_context

from .. import tmp_item_models as item_models_module
from ..tmp_item_models import Individual, Sample, SampleProcessing
from ..types import qc_report_utils as qc_report_utils_module, sample as sample_type_module
from ..types.qc_report_utils import QcConstants
from ..types.sample import (
    GermlineQcFlagger,
    get_files_for_qc_from_sample_processing_files,
    get_files_for_qc_from_sample,
    get_files_for_qc_from_samples,
    get_quality_control_metrics_for_sample_processing,
    get_sample_processing_files_for_qc,
)
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


class IntegratedQcTestConstants:

    SAMPLE_1_QC_METRICS = {
        "coverage": {"flag": "fail", "value": "5x"},
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
        "sequencing_type": "WGS",
        "bam_sample_id": "Sample_ID",
        "warn": ["predicted_sex"],
        "fail": ["coverage"],
        "specimen_type": "peripheral_blood",
        "transition_transversion_ratio": {"flag": "pass", "value": "1.96"},
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
        "coverage": {"flag": "fail", "value": "5x"},
        "total_reads": {"value": "123456789"},
        "individual_accession": "GAPID8J9B9CR",
        "sex": {"value": "F"},
        "sequencing_type": "WGS",
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
        IntegratedQcTestConstants.SAMPLE_1_QC_METRICS
    ]

    sample_processing_two_samples = es_testapp.get(two_samples_atid, status=200).json
    assert sample_processing_two_samples.get("quality_control_metrics") == [
        IntegratedQcTestConstants.SAMPLE_2_QC_METRICS,
        IntegratedQcTestConstants.SAMPLE_1_QC_METRICS,
    ]

    sample_processing_one_sample_no_vcfs = es_testapp.get(
        one_sample_no_vcfs_atid, status=200
    ).json
    assert sample_processing_one_sample_no_vcfs.get("quality_control_metrics") == [
        IntegratedQcTestConstants.SAMPLE_1_BAM_ONLY_QC_METRICS
    ]

    sample_processing_one_sample_no_files = es_testapp.get(
        one_sample_no_files_atid, status=200
    ).json
    assert sample_processing_one_sample_no_files.get("quality_control_metrics") == [
        IntegratedQcTestConstants.SAMPLE_1_NO_FILES_QC_METRICS
    ]


#@contextmanager
#def patch_flag_bam_coverage(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.GermlineQcFlagger._flag_bam_coverage,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_flag_sex_consistency(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.GermlineQcFlagger._flag_sex_consistency,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_flag_heterozygosity_ratio(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.GermlineQcFlagger._flag_heterozygosity_ratio,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_flag_transition_transversion_ratio(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.GermlineQcFlagger._flag_transition_transversion_ratio,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_flag_evaluators(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_flag_bam_coverage():
#        with patch_flag_sex_consistency():
#            with patch_flag_heterozygosity_ratio():
#                with patch_flag_transition_transversion_ratio():
#                    yield
#
#
#@contextmanager
#def patch_get_desired_fields(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_desired_fields,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_sample_processing_files_for_qc(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_sample_processing_files_for_qc,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_quality_control_metrics(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_quality_control_metrics,
#        module=sample_type_module,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_files_for_qc_from_samples(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_files_for_qc_from_samples,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_files_for_qc_from_sample_processing_files(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_files_for_qc_from_sample_processing_files,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_files_for_qc_from_sample(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_files_for_qc_from_sample,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_latest_file_with_quality_metric(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_latest_file_with_quality_metric,
#        module=sample_type_module,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_latest_bam_with_quality_metric(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.get_latest_bam_with_quality_metric,
#        module=sample_type_module,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_samples(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        sample_type_module.SampleProcessingModel.get_samples,
#        **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#def get_mock_sample_processing() -> mock.MagicMock:
#    return mock.create_autospec(item_models_module.SampleProcessing, instance=True)
#
#
#def get_mock_sample() -> mock.MagicMock:
#    return mock.create_autospec(item_models_module.Sample, instance=True)
#
#
#def get_sample_processing() -> SampleProcessing:
#    return SampleProcessing({})


def get_mock_individual(sex: str = "F") -> mock.MagicMock:
    mock_individual = mock.create_autospec(Individual, instance=True)
    mock_individual.get_sex.return_value = sex
    return mock_individual


def get_mock_sample(
    is_wgs: bool = False, is_wes: bool = False, individual: Optional[Individual] = None,
) -> mock.MagicMock:
    mock_sample = mock.create_autospec(Sample, instance=True)
    mock_sample.is_wgs.return_value = is_wgs
    mock_sample.is_wes.return_value = is_wes
    mock_sample.get_individual.return_value = individual
    return mock_sample


class TestGermlineQcFlagger:

    @pytest.mark.parametrize(
        "title,value,sample,expected",
        [
            ("", "", None, ""),
            (QcConstants.COVERAGE, "5X", None, ""),
            (QcConstants.COVERAGE, "5X", get_mock_sample(is_wgs=True), QcConstants.FLAG_FAIL),
            (QcConstants.COVERAGE, "10X", get_mock_sample(is_wgs=True), QcConstants.FLAG_WARN),
            (QcConstants.COVERAGE, "20X", get_mock_sample(is_wgs=True), QcConstants.FLAG_WARN),
            (QcConstants.COVERAGE, "25X", get_mock_sample(is_wgs=True), QcConstants.FLAG_PASS),
            (QcConstants.COVERAGE, "30X", get_mock_sample(is_wgs=True), QcConstants.FLAG_PASS),
            (QcConstants.COVERAGE, "35X", get_mock_sample(is_wes=True), QcConstants.FLAG_FAIL),
            (QcConstants.COVERAGE, "40X", get_mock_sample(is_wes=True), QcConstants.FLAG_WARN),
            (QcConstants.COVERAGE, "60X", get_mock_sample(is_wes=True), QcConstants.FLAG_WARN),
            (QcConstants.COVERAGE, "70X", get_mock_sample(is_wes=True), QcConstants.FLAG_PASS),
            (QcConstants.COVERAGE, "90X", get_mock_sample(is_wes=True), QcConstants.FLAG_PASS),
            (QcConstants.PREDICTED_SEX, "female", get_mock_sample(), ""),
            (
                QcConstants.PREDICTED_SEX,
                "female",
                get_mock_sample(individual=get_mock_individual()),
                QcConstants.FLAG_PASS
            ),
            (
                QcConstants.PREDICTED_SEX,
                "female",
                get_mock_sample(individual=get_mock_individual(sex="M")),
                QcConstants.FLAG_WARN
            ),
            (
                QcConstants.PREDICTED_SEX,
                "female",
                get_mock_sample(individual=get_mock_individual(sex="U")),
                QcConstants.FLAG_WARN
            ),
            (
                QcConstants.PREDICTED_SEX,
                "female",
                get_mock_sample(individual=get_mock_individual(sex="foo")),
                QcConstants.FLAG_WARN
            ),
            (
                QcConstants.PREDICTED_SEX,
                "male",
                get_mock_sample(individual=get_mock_individual()),
                QcConstants.FLAG_WARN
            ),
            (
                QcConstants.PREDICTED_SEX,
                "foo",
                get_mock_sample(individual=get_mock_individual()),
                QcConstants.FLAG_FAIL
            ),
            (QcConstants.HETEROZYGOSITY_RATIO, "", None, ""),
            (QcConstants.HETEROZYGOSITY_RATIO, "2.7", None, QcConstants.FLAG_WARN),
            (QcConstants.HETEROZYGOSITY_RATIO, "2.5", None, QcConstants.FLAG_PASS),
            (QcConstants.HETEROZYGOSITY_RATIO, "2.0", None, QcConstants.FLAG_PASS),
            (QcConstants.HETEROZYGOSITY_RATIO, "1.4", None, QcConstants.FLAG_PASS),
            (QcConstants.HETEROZYGOSITY_RATIO, "1", None, QcConstants.FLAG_WARN),
            (QcConstants.HETEROZYGOSITY_RATIO, "1", get_mock_sample(), QcConstants.FLAG_WARN),
            (QcConstants.TRANSITION_TRANSVERSION_RATIO, "", None, ""),
            (QcConstants.TRANSITION_TRANSVERSION_RATIO, "2.0", get_mock_sample(), ""),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "2.5",
                get_mock_sample(is_wgs=True),
                QcConstants.FLAG_FAIL,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "2.3",
                get_mock_sample(is_wgs=True),
                QcConstants.FLAG_WARN,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "2.1",
                get_mock_sample(is_wgs=True),
                QcConstants.FLAG_PASS,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "2.0",
                get_mock_sample(is_wgs=True),
                QcConstants.FLAG_PASS,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "1.8",
                get_mock_sample(is_wgs=True),
                QcConstants.FLAG_PASS,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "1.6",
                get_mock_sample(is_wgs=True),
                QcConstants.FLAG_WARN,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "1.4",
                get_mock_sample(is_wgs=True),
                QcConstants.FLAG_FAIL,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "3.6",
                get_mock_sample(is_wes=True),
                QcConstants.FLAG_FAIL,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "3.5",
                get_mock_sample(is_wes=True),
                QcConstants.FLAG_WARN,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "3.3",
                get_mock_sample(is_wes=True),
                QcConstants.FLAG_PASS,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "3.0",
                get_mock_sample(is_wes=True),
                QcConstants.FLAG_PASS,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "2.2",
                get_mock_sample(is_wes=True),
                QcConstants.FLAG_PASS,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "2.1",
                get_mock_sample(is_wes=True),
                QcConstants.FLAG_WARN,
            ),
            (
                QcConstants.TRANSITION_TRANSVERSION_RATIO,
                "2.0",
                get_mock_sample(is_wes=True),
                QcConstants.FLAG_FAIL,
            ),
        ]
    )
    def test_get_flag(self, title: str, value: str, sample: Sample, expected: str) -> None:
        result = GermlineQcFlagger.get_flag(title, value, sample=sample)
        assert result == expected


# class TestSampleProcessingQualityControlMetrics:
# 
#     def test_get_quality_control_metrics_for_sample_processing(self) -> None:
#         with patch_get_sample_processing_files_for_qc() as mock_get_files:
#             with patch_get_desired_fields() as mock_get_desired_fields:
#                 with patch_get_quality_control_metrics() as mock_get_qc_metrics:
#                     sample_processing = get_mock_sample_processing()
#                     result = get_quality_control_metrics_for_sample_processing(
#                         sample_processing
#                     )
#                     mock_get_files.assert_called_once_with(sample_processing)
#                     mock_get_qc_metrics.assert_called_once_with(
#                         sample_processing.get_samples.return_value,
#                         mock_get_files.return_value,
#                         sample_type_module.GermlineQcFlagger,
#                         mock_get_desired_fields.return_value,
#                     )
#                     assert result == mock_get_qc_metrics.return_value
# 
#     def test_get_sample_processing_files_for_qc(self) -> None:
#         some_file = "some_file"
#         sample_files = [some_file]
#         sample_processing_files = [some_file, None]
#         with patch_get_files_for_qc_from_samples(return_value=sample_files) as mock_get_files_from_samples:
#             with patch_get_files_for_qc_from_sample_processing_files(return_value=sample_processing_files) as mock_get_files_from_sample_processing:
#                 sample_processing = get_mock_sample_processing()
#                 result = get_sample_processing_files_for_qc(sample_processing)
#                 mock_get_files_from_samples.assert_called_once_with(sample_processing)
#                 mock_get_files_from_sample_processing.assert_called_once_with(sample_processing)
#                 assert result == [some_file] * 2
# 
#     def test_get_files_for_qc_from_sample_processing_files(self) -> None:
#         sample_processing = get_mock_sample_processing()
#         expected_get_latest_file_calls = [
#             sample_type_module.is_vep_vcf,
#             sample_type_module.is_final_snv_vcf,
#             sample_type_module.is_final_sv_vcf,
#         ]
#         with patch_get_latest_file_with_quality_metric() as mock_get_file:
#             result = get_files_for_qc_from_sample_processing_files(sample_processing)
#             assert result == [mock_get_file.return_value] * len(expected_get_latest_file_calls)
#             assert len(mock_get_file.call_args_list) == len(expected_get_latest_file_calls)
#             for expected_call in expected_get_latest_file_calls:
#                 mock_get_file.assert_any_call(
#                     sample_processing.get_processed_files.return_value,
#                     expected_call,
#                 )
# 
#     def test_get_files_for_qc_from_samples(self) -> None:
#         samples = ["sample_1", "sample_2"]
#         file_for_qc = ["file"]
#         files = file_for_qc * len(samples)
#         with patch_get_samples(return_value=samples):
#             with patch_get_files_for_qc_from_sample(return_value=file_for_qc) as mock_get_files:
#                 sample_processing = get_sample_processing()
#                 result = get_files_for_qc_from_samples(sample_processing)
#                 for sample in samples:
#                     mock_get_files.assert_any_call(sample)
#                 assert len(mock_get_files.call_args_list) == len(samples)
#                 assert result == files
# 
#     def test_get_files_for_qc_from_sample(self) -> None:
#         with patch_get_latest_bam_with_quality_metric() as mock_get_bam:
#             sample = get_mock_sample()
#             result = get_files_for_qc_from_sample(sample)
#             assert result == [mock_get_bam.return_value]
#             mock_get_bam.assert_called_once_with(sample.get_processed_files.return_value)
