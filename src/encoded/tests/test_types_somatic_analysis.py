from webtest.app import TestApp

from .utils import get_identifier


SOMATIC_QC_METRICS_SAMPLE_1 = {
    "coverage": {"value": "30x"},
    "total_reads": {"value": "123456789"},
    "individual_accession": "GAPID8J9B9CR",
    "sequencing_type": "WES",
    "bam_sample_id": "Sample_ID",
    "fail": ["coverage"],
    "specimen_type": "peripheral_blood",
}
SOMATIC_QC_METRICS_SAMPLE_2 = {
    "coverage": {"flag": "pass", "value": "50x"},
    "total_reads": {"value": "987654321"},
    "individual_accession": "GAPIDAF1DXBB",
    "sequencing_type": "WGS",
    "bam_sample_id": "Another_Sample_ID",
}


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
    assert somatic_analysis_two_samples_with_bams.get("quality_control_metrics") == [
        SOMATIC_QC_METRICS_SAMPLE_1, SOMATIC_QC_METRICS_SAMPLE_2
    ]
