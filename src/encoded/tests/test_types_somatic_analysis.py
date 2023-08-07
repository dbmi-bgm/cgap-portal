from unittest import mock

import pytest
from webtest.app import TestApp

from .utils import get_identifier
from ..types.qc_report_utils import QcConstants
from ..types.somatic_analysis import SomaticAnalysisQcFlagger
from ..tmp_item_models import Sample


SOMATIC_QC_METRICS_SAMPLE_1 = {
    "coverage": {"flag": "pass", "value": "50x"},
    "total_reads": {"value": "987654321"},
    "individual_accession": "GAPIDAF1DXBB",
    "sequencing_type": "WGS",
    "bam_sample_id": "Another_Sample_ID",
    "completed_qcs": ["BAM"],
}
SOMATIC_QC_METRICS_SAMPLE_2 = {
    "coverage": {"value": "5x", "flag": "fail"},
    "total_reads": {"value": "123456789"},
    "read_length": {"value": "151"},
    "individual_accession": "GAPID8J9B9CR",
    "sequencing_type": "WGS",
    "bam_sample_id": "Sample_ID",
    "fail": ["coverage"],
    "specimen_type": "peripheral_blood",
    "completed_qcs": ["BAM"],
}
SOMATIC_QC_METRICS_SUMMARY = {
    "fail": 1,
    "warn": 0,
    "completed_qcs": ["BAM"],
    "flag": "fail",
}
SOMATIC_QUALITY_CONTROL_METRICS = {
    "samples": [SOMATIC_QC_METRICS_SAMPLE_1, SOMATIC_QC_METRICS_SAMPLE_2],
    "summary": SOMATIC_QC_METRICS_SUMMARY,
}


@pytest.mark.workbook
def test_quality_control_metrics(es_testapp: TestApp, workbook: None) -> None:
    somatic_analysis_without_samples_uuid = "e92d1201-24ca-49c5-86c6-80184c1ad4ce"
    somatic_analysis_two_samples_with_bams_uuid = "bb3df3d6-ec3a-4eb2-8094-2e171de66fa8"

    somatic_analysis_without_samples = get_identifier(
        es_testapp, somatic_analysis_without_samples_uuid
    )
    assert somatic_analysis_without_samples.get("quality_control_metrics") is None

    somatic_analysis_two_samples_with_bams = get_identifier(
        es_testapp, somatic_analysis_two_samples_with_bams_uuid
    )
    assert somatic_analysis_two_samples_with_bams.get(
        "quality_control_metrics"
    ) == SOMATIC_QUALITY_CONTROL_METRICS



def get_mock_sample(is_wgs: bool = False, is_wes: bool = False) -> mock.MagicMock:
    mock_sample = mock.create_autospec(Sample, instance=True)
    mock_sample.is_wgs.return_value = is_wgs
    mock_sample.is_wes.return_value = is_wes
    return mock_sample


class TestSomaticAnalysisQcFlagger:

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
            (QcConstants.COVERAGE, "5X", get_mock_sample(is_wes=True), ""),
        ],
    )
    def test_get_flag(self, title: str, value: str, sample: Sample, expected: str) -> None:
        result = SomaticAnalysisQcFlagger.get_flag(title, value, sample=sample)
        assert result == expected
