from typing import List, Iterable, Optional

from pyramid.request import Request
from snovault import calculated_property, collection, load_schema

from .analysis import Analysis
from .qc_report_utils import (
    QC_FLAG_SCHEMA,
    QC_VALUE_SCHEMA,
    get_latest_bam_with_quality_metric,
    get_quality_control_metrics,
    QcConstants,
    QcFlagger,
)
from ..tmp_item_models import File, Sample, SomaticAnalysis as SomaticAnalysisModel
from ..util import JsonObject


def _build_somatic_analysis_embedded_list() -> List[str]:
    return [
        # My embeds (TODO: delete once switch to doug's) Required for Somatic Analysis Item Page UI
        "samples.@id",
        "samples.display_title",
        "samples.accession",
        "samples.specimen_collection_date",
        # "samples.preservation_type", # Does not actually exist right now... should at some point
        "samples.workup_type",
        "samples.tissue_type",
        "samples.specimen_type",
        "samples.bam_sample_id",
        "samples.sequence_id", # accessioning table only
        "individual.@id",
        "individual.individual_id",
        "individual.display_title",
        "individual.accession",
        "individual.sex",
        "individual.age",
        "individual.age_units",
        "individual.date_created", # TODO: Double check this is acceptable as "accession date"
        "individual.primary_disorders.disorder_name",
        "individual.families.title",
        "individual.families.family_id",
        "individual.families.accession"
    ]


SOMATIC_ANALYSIS_QC_METRICS_SCHEMA_PROPERTIES = {
    QcConstants.BAM_SAMPLE_ID: {
        "title": "Sample Identifier",
        "description": "Sample identifier used in BAM file",
        "type": "string",
    },
    QcConstants.INDIVIDUAL_ID: {
        "title": "Individual Identifier",
        "description": "Individual identifier submitted related to sample",
        "type": "string",
    },
    QcConstants.INDIVIDUAL_ACCESSION: {
        "title": "Individual Accession",
        "description": "Individual accession related to sample",
        "type": "string",
    },
    QcConstants.SEQUENCING_TYPE: {
        "title": "Sequencing Type",
        "description": "Sequencing type for sample",
        "type": "string",
    },
    QcConstants.SPECIMEN_TYPE: {
        "title": "Specimen Type",
        "description": "Specimen type for the sample",
        "type": "string",
    },
    QcConstants.READ_LENGTH: {
        "title": "Read Length",
        "description": "Average read length in BAM file",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
        },
    },
    QcConstants.TOTAL_READS: {
        "title": "Total Reads",
        "description": "Total reads in BAM file",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
        },
    },
    QcConstants.COVERAGE: {
        "title": "Coverage",
        "description": "BAM file coverage",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
            "flag": QC_FLAG_SCHEMA,
        },
    },
    QcConstants.FLAG_WARN: {
        "title": "Warn Flag Properties",
        "description": "QC metrics with warn flags",
        "type": "array",
        "items": {
            "title": "Warn Flag Property",
            "description": "QC metric with warning flag",
            "type": "string",
        },
    },
    QcConstants.FLAG_FAIL: {
        "title": "Fail Flag Properties",
        "description": "QC metrics with fail flags",
        "type": "array",
        "items": {
            "title": "Fail Flag Property",
            "description": "QC metric with fail flag",
            "type": "string",
        },
    },
    QcConstants.COMPLETED_QCS: {
        "title": "Completed QCs",
        "description": "Completed QC steps",
        "type": "array",
        "items": {
            "title": "Completed QC",
            "description": "Completed QC step",
            "type": "string",
        },
    },
}


@collection(
    name="somatic-analyses",
    unique_key="accession",
    properties={
        "title": "SomaticAnalysis",
        "description": "Listing of Somatic Analyses",
    },
)
class SomaticAnalysis(Analysis):
    item_type = "somatic_analysis"
    name_key = "accession"
    schema = load_schema("encoded:schemas/somatic_analysis.json")
    embedded_list = Analysis.embedded_list + _build_somatic_analysis_embedded_list()

    @calculated_property(
        schema={
            "title": "Quality Control Metrics",
            "description": "Select quality control metrics for associated samples",
            "type": "array",
            "items": {
                "title": "Sample Quality Control Metrics",
                "description": "Quality control metrics for associated sample",
                "type": "object",
                "additionalProperties": False,
                "properties": SOMATIC_ANALYSIS_QC_METRICS_SCHEMA_PROPERTIES,
            },
        }
    )
    def quality_control_metrics(self, request: Request) -> List[JsonObject]:
        somatic_analysis = SomaticAnalysisModel(
            self.properties, request=request, fetch_links=True
        )
        return get_somatic_analysis_quality_control_metrics(somatic_analysis)


class SomaticAnalysisQcFlagger(QcFlagger):
    BAM_COVERAGE_WGS_WARN_LOWER = 25
    BAM_COVERAGE_WGS_FAIL_LOWER = 10

    @classmethod
    def get_flag(
        cls,
        title: str,
        value: str,
        sample: Optional[Sample] = None,
    ) -> str:
        if title == QcConstants.COVERAGE:
            return cls._flag_bam_coverage(value, sample=sample)
        return ""

    @classmethod
    def _flag_bam_coverage_for_sample(cls, coverage: float, sample: Sample) -> str:
        result = ""
        if sample.is_wgs():
            result = cls._assign_flag(
                coverage,
                warn_lower=cls.BAM_COVERAGE_WGS_WARN_LOWER,
                fail_lower=cls.BAM_COVERAGE_WGS_FAIL_LOWER,
            )
        return result


def get_somatic_analysis_quality_control_metrics(somatic_analysis: SomaticAnalysisModel) -> List[JsonObject]:
    samples = somatic_analysis.get_samples()
    desired_fields = get_desired_fields()
    files_for_qc = get_somatic_analysis_files_for_qc(somatic_analysis)
    return get_quality_control_metrics(
        samples, files_for_qc, SomaticAnalysisQcFlagger, desired_fields
    )


def get_desired_fields() -> List[str]:
    return SOMATIC_ANALYSIS_QC_METRICS_SCHEMA_PROPERTIES.keys()


def get_somatic_analysis_files_for_qc(somatic_analysis: SomaticAnalysisModel) -> List[File]:
    files = []
    samples = somatic_analysis.get_samples()
    for sample in samples:
        files += get_sample_files_for_qc(sample)
    return [file for file in files if file]


def get_sample_files_for_qc(sample: Sample) -> List[File]:
    processed_files = sample.get_processed_files()
    return [get_latest_bam_with_quality_metric(processed_files)]
