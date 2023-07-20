from __future__ import annotations

from typing import Callable, Iterable, List, Optional, Union

import structlog
from pyramid.request import Request
from snovault import calculated_property, collection, display_title_schema, load_schema

from .base import Item, get_item_or_none
from .family import Family
from .qc_report_utils import (
    QC_FLAG_SCHEMA,
    QC_LINK_SCHEMA,
    QC_VALUE_SCHEMA,
    get_latest_bam_with_quality_metric,
    get_latest_file_with_quality_metric,
    get_quality_control_metrics,
    QcConstants,
    QcFlagger,
)
from ..tmp_item_models import File, SampleProcessing as SampleProcessingModel
from ..util import JsonObject


log = structlog.getLogger(__name__)


def _build_sample_embedded_list():
    """Helper function to create embedded list for sample."""
    return [
        # File linkTo
        "files.status",
        "files.file_format.file_format",
        "files.accession",
        # File linkTo
        "processed_files.accession",
        "processed_files.file_format.file_format",
        "processed_files.workflow_run_outputs.@id",
    ]


@collection(
    name="samples",
    unique_key="accession",
    properties={
        "title": "Samples",
        "description": "Listing of Samples",
    },
)
class Sample(Item):
    item_type = "sample"
    name_key = "accession"
    schema = load_schema("encoded:schemas/sample.json")
    rev = {"indiv": ("Individual", "samples")}
    embedded_list = _build_sample_embedded_list()

    @calculated_property(schema=display_title_schema)
    def display_title(
        self,
        accession: str,
        bam_sample_id: Optional[str] = None,
        specimen_accession: Optional[str] = None,
    ) -> str:
        return specimen_accession or bam_sample_id or accession

    @calculated_property(
        schema={
            "title": "Individual",
            "description": "Individual the sample belongs to",
            "type": "string",
            "linkTo": "Individual",
        }
    )
    def individual(self, request):
        indivs = self.rev_link_atids(request, "indiv")
        if indivs:
            return indivs[0]

    @calculated_property(
        schema={
            "title": "Requisition Completed",
            "description": "True when Requisition Acceptance fields are completed",
            "type": "boolean",
        }
    )
    def requisition_completed(self, request):
        props = self.properties
        req = props.get("requisition_acceptance", {})
        if req:
            if req.get("accepted_rejected") == "Accepted":
                return True
            elif req.get("accepted_rejected") == "Rejected" and req.get(
                "date_completed"
            ):
                return True
            else:
                return False
        elif any(
            props.get(item)
            for item in [
                "specimen_accession_date",
                "specimen_accession",
                "date_requisition_received",
                "accessioned_by",
            ]
        ):
            return False


def _build_sample_processing_embedded_list():
    """Helper function to build embedded list for sample_processing."""
    return [
        # File linkTo
        "files.quality_metric",  # to update QC calcprop
        "processed_files.accession",  # used to locate this file from annotated VCF via search
        "processed_files.variant_type",
        "processed_files.file_type",
        "processed_files.upload_key",  # used by Higlass browsers
        "processed_files.higlass_file",  # used by Higlass browsers
        "processed_files.quality_metric",  # to update QC calcprop
        # Sample linkTo
        "samples.completed_processes",
        "samples.files.quality_metric",  # to update QC calcprop
        "samples.processed_files.uuid",
        "samples.processed_files.quality_metric",  # to update QC calcprop
    ]


SAMPLE_PROCESSING_QC_METRICS_SCHEMA_PROPERTIES = {
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
    QcConstants.SEX: {
        "title": "Sex",
        "description": "Individual sex submitted for sample",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
        },
    },
    QcConstants.PREDICTED_SEX: {
        "title": "Predicted Sex",
        "description": "Predicted sex for sample",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
            "link": QC_LINK_SCHEMA,
            "flag": QC_FLAG_SCHEMA,
        },
    },
    QcConstants.ANCESTRY: {
        "title": "Ancestry",
        "description": "Ancestry submitted for individual related to sample",
        "type": "object",
        "properties": {
            "value": {
                "title": "Values",
                "description": "Values for the QC metric",
                "type": "array",
                "items": {"type": "string"},
            },
        },
    },
    QcConstants.PREDICTED_ANCESTRY: {
        "title": "Predicted Ancestry",
        "description": "Ancestry predicted for sample",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
            "link": QC_LINK_SCHEMA,
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
    QcConstants.HETEROZYGOSITY_RATIO: {
        "title": "Heterozygosity Ratio",
        "description": "SNV heterozygosity ratio for sample",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
            "flag": QC_FLAG_SCHEMA,
        },
    },
    QcConstants.TRANSITION_TRANSVERSION_RATIO: {
        "title": "Transition-Transversion Ratio",
        "description": "SNV transition-transversion ratio for sample",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
            "flag": QC_FLAG_SCHEMA,
        },
    },
    QcConstants.DE_NOVO_FRACTION: {
        "title": "De Novo Fraction",
        "description": "SNV de novo fraction for sample",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
            "flag": QC_FLAG_SCHEMA,
        },
    },
    QcConstants.TOTAL_VARIANTS_CALLED: {
        "title": "Total SNV Variants Called",
        "description": "Total SNVs called prior to filtering",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
        },
    },
    QcConstants.FILTERED_VARIANTS: {
        "title": "Filtered SNV Variants",
        "description": "Total SNVs after filtering",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
        },
    },
    QcConstants.FILTERED_STRUCTURAL_VARIANTS: {
        "title": "Filtered Structural Variants",
        "description": "Total SVs after filtering",
        "type": "object",
        "properties": {
            "value": QC_VALUE_SCHEMA,
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
    name="sample-processings",
    properties={
        "title": "SampleProcessings",
        "description": "Listing of Sample Processings",
    },
)
class SampleProcessing(Item):
    item_type = "sample_processing"
    schema = load_schema("encoded:schemas/sample_processing.json")
    embedded_list = _build_sample_processing_embedded_list()
    rev = {"case": ("Case", "sample_processing")}

    @calculated_property(
        schema={
            "title": "Cases",
            "description": "The case(s) this sample processing is for",
            "type": "array",
            "items": {"title": "Case", "type": "string", "linkTo": "Case"},
        }
    )
    def cases(self, request):
        rs = self.rev_link_atids(request, "case")
        if rs:
            return rs

    @calculated_property(
        schema={
            "title": "Samples Pedigree",
            "description": "Relationships to proband for samples.",
            "type": "array",
            "items": {
                "title": "Sample Pedigree",
                "type": "object",
                "properties": {
                    "individual": {"title": "Individual", "type": "string"},
                    "sample_accession": {"title": "Individual", "type": "string"},
                    "sample_name": {"title": "Individual", "type": "string"},
                    "parents": {
                        "title": "Parents",
                        "type": "array",
                        "items": {"title": "Parent", "type": "string"},
                    },
                    "association": {
                        "title": "Individual",
                        "type": "string",
                        "enum": ["paternal", "maternal"],
                    },
                    "sex": {"title": "Sex", "type": "string", "enum": ["F", "M", "U"]},
                    "relationship": {"title": "Relationship", "type": "string"},
                    "bam_location": {"title": "Bam File Location", "type": "string"},
                },
            },
        }
    )
    def samples_pedigree(self, request, families=None, samples=None):
        """Filter Family Pedigree for samples to be used in QCs"""
        # If there are multiple families this will be problematic, return empty
        # We will need to know the context
        samples_pedigree = []
        if not families or not samples:
            return samples_pedigree
        # this part will need word (ie disregard relations and just return parents)
        if len(families) != 1:
            return samples_pedigree
        family = families[0]

        # get relationship from family
        fam_data = get_item_or_none(request, family, "families")
        if not fam_data:
            return samples_pedigree
        proband = fam_data.get("proband", "")
        members = fam_data.get("members", [])
        if not proband or not members:
            return samples_pedigree
        family_id = fam_data["accession"]
        # collect members properties
        all_props = []
        for a_member in members:
            # This might be a step to optimize if families get larger
            # TODO: make sure all mother fathers are in member list, if not fetch them too
            #  for complete connection tracing
            props = get_item_or_none(request, a_member, "individuals")
            all_props.append(props)
        relations = Family.calculate_relations(proband, all_props, family_id)

        for a_sample in samples:
            temp = {
                "individual": "",
                "sample_accession": "",
                "sample_name": "",
                "parents": [],
                "relationship": "",
                "sex": "",
                # "bam_location": "" optional, add if exists
                # "association": ""  optional, add if exists
            }
            mem_infos = [i for i in all_props if a_sample in i.get("samples", [])]
            if not mem_infos:
                continue
            mem_info = mem_infos[0]
            sample_info = get_item_or_none(request, a_sample, "samples")

            # find the bam file
            sample_processed_files = sample_info.get("processed_files", [])
            sample_bam_file = ""
            # no info about file formats on object frame of sample
            # cycle through files (starting at most recent) and check the format
            for a_file in sample_processed_files[::-1]:
                file_info = get_item_or_none(request, a_file, "files-processed")
                if not file_info:
                    continue
                # if format is bam, record the upload key and exit loop
                if file_info.get("file_format") == "/file-formats/bam/":
                    sample_bam_file = file_info.get("upload_key", "")
                    break
            # if bam file location was found, add it to temp
            if sample_bam_file:
                temp["bam_location"] = sample_bam_file

            # fetch the calculated relation info
            relation_infos = [
                i for i in relations if i["individual"] == mem_info["accession"]
            ]
            # fill in temp dict
            temp["individual"] = mem_info["accession"]
            temp["sex"] = mem_info.get("sex", "U")
            parents = []
            for a_parent in ["mother", "father"]:
                if mem_info.get(a_parent):
                    # extract accession from @id
                    mem_acc = mem_info[a_parent].split("/")[2]
                    parents.append(mem_acc)
            temp["parents"] = parents
            temp["sample_accession"] = sample_info["accession"]
            temp["sample_name"] = sample_info.get("bam_sample_id", "")
            if relation_infos:
                relation_info = relation_infos[0]
                temp["relationship"] = relation_info.get("relationship", "")
                if relation_info.get("association", ""):
                    temp["association"] = relation_info.get("association", "")
            samples_pedigree.append(temp)
        return samples_pedigree

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
                "properties": SAMPLE_PROCESSING_QC_METRICS_SCHEMA_PROPERTIES,
            },
        }
    )
    def quality_control_metrics(self, request: Request) -> List[JsonObject]:
        """Calculate QC metrics for associated samples."""
        sample_processing = get_sample_processing_model(self.properties, request)
        return get_quality_control_metrics_for_sample_processing(sample_processing)


class GermlineQcFlagger(QcFlagger):
    """Evaluate germline QC values for appropriate flags."""

    ACCEPTED_PREDICTED_SEXES = set(["male", "female"])
    BAM_COVERAGE_WGS_WARN_LOWER = 25
    BAM_COVERAGE_WGS_FAIL_LOWER = 10
    BAM_COVERAGE_WES_WARN_LOWER = 70
    BAM_COVERAGE_WES_FAIL_LOWER = 40
    HETEROZYGOSITY_WARN_UPPER = 2.5
    HETEROZYGOSITY_WARN_LOWER = 1.4
    TRANSITION_TRANSVERSION_WGS_FAIL_UPPER = 2.3
    TRANSITION_TRANSVERSION_WGS_WARN_UPPER = 2.1
    TRANSITION_TRANSVERSION_WGS_WARN_LOWER = 1.8
    TRANSITION_TRANSVERSION_WGS_FAIL_LOWER = 1.6
    TRANSITION_TRANSVERSION_WES_FAIL_UPPER = 3.5
    TRANSITION_TRANSVERSION_WES_WARN_UPPER = 3.3
    TRANSITION_TRANSVERSION_WES_WARN_LOWER = 2.2
    TRANSITION_TRANSVERSION_WES_FAIL_LOWER = 2.1

    @classmethod
    def get_flag(
        cls,
        title: str,
        value: str,
        sample: Optional[Sample] = None,
    ) -> str:
        if title == QcConstants.COVERAGE:
            return cls._flag_bam_coverage(value, sample=sample)
        if title == QcConstants.PREDICTED_SEX:
            return cls._flag_sex_consistency(value, sample=sample)
        if title == QcConstants.HETEROZYGOSITY_RATIO:
            return cls._flag_heterozygosity_ratio(value, sample=sample)
        if title == QcConstants.TRANSITION_TRANSVERSION_RATIO:
            return cls._flag_transition_transversion_ratio(value, sample=sample)
        return ""


def get_sample_processing_model(
    properties: JsonObject,
    request: Request
) -> SampleProcessingModel:
    return SampleProcessingModel(properties, request=request, fetch_links=True)


def get_quality_control_metrics_for_sample_processing(sample_processing: SampleProcessingModel) -> List[JsonObject]:
    samples = sample_processing.get_samples()
    desired_fields = get_desired_fields()
    files_for_qc = get_sample_processing_files_for_qc(sample_processing)
    return get_quality_control_metrics(samples, files_for_qc, GermlineQcFlagger, desired_fields)


def get_desired_fields() -> List[str]:
    return SAMPLE_PROCESSING_QC_METRICS_SCHEMA_PROPERTIES.keys()


def get_sample_processing_files_for_qc(sample_processing: SampleProcessing) -> List[File]:
    files = []
    files += get_files_for_qc_from_sample_processing_files(sample_processing)
    files += get_files_for_qc_from_samples(sample_processing)
    return [file for file in files if file]


def get_files_for_qc_from_sample_processing_files(sample_processing: SampleProcessing) -> List[File]:
    processed_files = sample_processing.get_processed_files()
    return [
        get_latest_vep_vcf_with_quality_metric(processed_files),
        get_latest_final_snv_vcf_with_quality_metric(processed_files),
        get_latest_final_sv_vcf_with_quality_metric(processed_files),
    ]


def get_latest_vep_vcf_with_quality_metric(files: Iterable[File]) -> Union[File, None]:
    return get_latest_file_with_quality_metric(files, is_vep_vcf)


def is_vep_vcf(file: File) -> bool:
    return file.is_vep_output_snv_vcf()


def get_latest_final_snv_vcf_with_quality_metric(files: Iterable[File]) -> Union[File, None]:
    return get_latest_file_with_quality_metric(files, is_final_snv_vcf)


def is_final_snv_vcf(file: File) -> bool:
    return file.is_snv_final_vcf()


def get_latest_final_sv_vcf_with_quality_metric(files: Iterable[File]) -> Union[File, None]:
    return get_latest_file_with_quality_metric(files, is_final_sv_vcf)


def is_final_sv_vcf(file: File) -> bool:
    return file.is_sv_final_vcf()


def get_files_for_qc_from_samples(sample_processing: SampleProcessing) -> List[File]:
    result = []
    samples = sample_processing.get_samples()
    for sample in samples:
        result += get_files_for_qc_from_sample(sample)
    return result


def get_files_for_qc_from_sample(sample: Sample) -> List[Union[File, None]]:
    processed_files = sample.get_processed_files()
    return [get_latest_bam_with_quality_metric(processed_files)]
