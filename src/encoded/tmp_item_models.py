from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Union

from dcicutils.item_models import SubembeddedProperty
from snovault.item_models import PortalItem

from .util import JsonObject


LinkTo = Union[str, JsonObject]


# def _get_link_as_item_class_if_embedded(
#     link: LinkTo,
#     item_class: Item
# ) -> Union[Item, None]:
#     if isinstance(link, dict):
#         return item_class(link)
#     return link
# 
# 
# def _get_links_as_item_classes_if_embedded(
#     links: List[LinkTo],
#     item_class: Item
# ) -> List[Item]:
#     return [_get_link_as_item_class_if_embedded(link, item_class) for link in links]


@dataclass(frozen=True)
class Item(PortalItem):
    INSTITUTION = "institution"
    PROJECT = "project"

    @property
    def _project(self) -> LinkTo:
        return self.properties.get(self.PROJECT, "")

    @property
    def _institution(self) -> LinkTo:
        return self.properties.get(self.INSTITUTION, "")

    def get_project(self) -> LinkTo:
        return self._get_link(self._project, Item)

    def get_institution(self) -> LinkTo:
        return self._get_link(self._institution, Item)


@dataclass(frozen=True)
class QualityMetricSummary(SubembeddedProperty):

    SAMPLE = "sample"
    TITLE = "title"
    VALUE = "value"

    @property
    def _title(self) -> str:
        return self.properties.get(self.TITLE, "")

    @property
    def _value(self) -> str:
        return self.properties.get(self.VALUE, "")

    @property
    def _sample(self) -> str:
        return self.properties.get(self.SAMPLE, "")

    def get_title(self) -> str:
        return self._title

    def get_value(self) -> str:
        return self._value

    def get_sample(self) -> str:
        return self._sample


@dataclass(frozen=True)
class QualityMetric(Item):

    QUALITY_METRIC_SUMMARY = "quality_metric_summary"
    QC_LIST = "qc_list"
    QC_TYPE = "qc_type"
    TITLE = "title"
    TYPE_PEDDY_QC = "QualityMetricPeddyqc"
    VALUE = "value"

    @property
    def _quality_metric_summary(self) -> List[JsonObject]:
        return self.properties.get(self.QUALITY_METRIC_SUMMARY, [])

    @property
    def _qc_list(self) -> List[LinkTo]:
        return self.properties.get(self.QC_LIST, [])

    def get_quality_metric_summaries(self) -> List[QualityMetricSummary]:
        return [QualityMetricSummary(item) for item in self._quality_metric_summary]

    def get_qc_list(self) -> List[Union[QualityMetric, str]]:
        return self._get_links(self._qc_list, QualityMetric)

    def is_peddy_qc_type(self) -> bool:
        return self.TYPE_PEDDY_QC in self._type


@dataclass(frozen=True)
class FileFormat(Item):

    FILE_FORMAT = "file_format"

    FILE_FORMAT_BAM = "bam"
    FILE_FORMAT_VCF = "vcf"
    FILE_FORMAT_VCF_GZ = "vcf_gz"
    VCF_FILE_FORMATS = (FILE_FORMAT_VCF, FILE_FORMAT_VCF_GZ)

    @property
    def _file_format(self) -> str:
        return self.properties.get(self.FILE_FORMAT, "")

    def is_bam_file_format(self) -> bool:
        return self._file_format == self.FILE_FORMAT_BAM

    def is_vcf_file_format(self) -> bool:
        return self._file_format in self.VCF_FILE_FORMATS


@dataclass(frozen=True)
class File(Item):

    DESCRIPTION = "description"
    FILE_FORMAT = "file_format"
    FILE_TYPE = "file_type"
    QUALITY_METRIC = "quality_metric"
    VARIANT_TYPE = "variant_type"
    VARIANT_TYPE_SNV = "SNV"
    VARIANT_TYPE_SV = "SV"
    VCF_TO_INGEST = "vcf_to_ingest"

    FINAL_VCF_FILE_TYPE = "full annotated VCF"
    VEP_ANNOTATED = "vep-annotated"
    VEP_OUTPUT = "output from vep"

    @property
    def _file_type(self) -> str:
        return self.properties.get(self.FILE_TYPE, "")

    @property
    def _description(self) -> str:
        return self.properties.get(self.DESCRIPTION, "")

    @property
    def _vcf_to_ingest(self) -> bool:
        return self.properties.get(self.VCF_TO_INGEST, False)

    @property
    def _variant_type(self) -> str:
        return self.properties.get(self.VARIANT_TYPE, "")

    @property
    def _quality_metric(self) -> LinkTo:
        return self.properties.get(self.QUALITY_METRIC, "")

    @property
    def _file_format(self) -> LinkTo:
        return self.properties.get(self.FILE_FORMAT, "")

    def _get_file_format(self) -> Union[FileFormat, None]:
        return self._get_link(self._file_format, FileFormat)

    def get_quality_metric(self) -> Union[QualityMetric, None]:
        return self._get_link(self._quality_metric, QualityMetric)

    def _is_vcf(self) -> bool:
        result = False
        file_format = self._get_file_format()
        if file_format:
            result = file_format.is_vcf_file_format()
        return result

    def is_bam(self) -> bool:
        result = False
        file_format = self._get_file_format()
        if file_format:
            result = file_format.is_bam_file_format()
        return result

    def _is_final_vcf(self) -> bool:
        return self._is_vcf() and (
            self._file_type == self.FINAL_VCF_FILE_TYPE or self._vcf_to_ingest
        )

    def _has_snv_data(self) -> bool:
        return self._variant_type == self.VARIANT_TYPE_SNV

    def _has_sv_data(self) -> bool:
        return self._variant_type == self.VARIANT_TYPE_SV

    def is_vep_output_snv_vcf(self) -> bool:
        return (
            self._is_vcf()
            and self._has_snv_data()
            and (
                self.VEP_ANNOTATED in self._file_type.lower()
                or self.VEP_OUTPUT in self._description.lower()
            )
        )

    def is_snv_final_vcf(self) -> bool:
        return self._is_final_vcf() and self._has_snv_data()

    def is_sv_final_vcf(self) -> bool:
        return self._is_final_vcf() and self._has_sv_data()


@dataclass(frozen=True)
class Sample(Item):
    BAM_SAMPLE_ID = "bam_sample_id"
    INDIVIDUAL = "individual"
    PROCESSED_FILES = "processed_files"
    WORKUP_TYPE = "workup_type"
    WORKUP_TYPE_WGS = "WGS"
    WORKUP_TYPE_WES = "WES"
    SPECIMEN_TYPE = "specimen_type"

    @property
    def _bam_sample_id(self) -> str:
        return self.properties.get(self.BAM_SAMPLE_ID, "")

    @property
    def _workup_type(self) -> str:
        return self.properties.get(self.WORKUP_TYPE, "")

    @property
    def _specimen_type(self) -> str:
        return self.properties.get(self.SPECIMEN_TYPE, "")

    @property
    def _processed_files(self) -> List[LinkTo]:
        return self.properties.get(self.PROCESSED_FILES, [])

    @property
    def _individual(self) -> LinkTo:
        return self.properties.get(self.INDIVIDUAL, "")

    def get_processed_files(self) -> List[File]:
        return self._get_links(self._processed_files, File)

    def get_individual(self) -> Union[Individual, None]:
        return self._get_link(self._individual, Individual)

    def is_wgs(self) -> bool:
        return self._workup_type == self.WORKUP_TYPE_WGS

    def is_wes(self) -> bool:
        return self._workup_type == self.WORKUP_TYPE_WES

    def get_bam_sample_id(self) -> str:
        return self._bam_sample_id

    def get_specimen_type(self) -> str:
        return self._specimen_type

    def get_workup_type(self) -> str:
        return self._workup_type


@dataclass(frozen=True)
class Individual(Item):

    ANCESTRY = "ancestry"
    INDIVIDUAL_ID = "individual_id"
    SEX = "sex"

    @property
    def _ancestry(self) -> List[str]:
        return self.properties.get(self.ANCESTRY, [])

    @property
    def _sex(self) -> str:
        return self.properties.get(self.SEX, "")

    @property
    def _individual_id(self) -> str:
        return self.properties.get(self.INDIVIDUAL_ID, "")

    def get_sex(self) -> str:
        return self._sex

    def get_submitted_identifier(self) -> str:
        return self._individual_id

    def get_ancestry(self) -> str:
        return self._ancestry


@dataclass(frozen=True)
class SampleProcessing(Item):

    PROCESSED_FILES = "processed_files"
    SAMPLES = "samples"

    @property
    def _processed_files(self) -> List[LinkTo]:
        return self.properties.get(self.PROCESSED_FILES, [])

    @property
    def _samples(self) -> List[LinkTo]:
        return self.properties.get(self.SAMPLES, [])

    def get_processed_files(self) -> List[Union[File, str]]:
        return self._get_links(self._processed_files, File)

    def get_samples(self) -> List[Union[Sample, str]]:
        return self._get_links(self._samples, Sample)


@dataclass(frozen=True)
class SomaticAnalysis(Item):

    SAMPLES = "samples"

    @property
    def _samples(self) -> List[LinkTo]:
        return self.properties.get(self.SAMPLES, [])

    def get_samples(self) -> List[Union[Sample, str]]:
        return self._get_links(self._samples, Sample)
