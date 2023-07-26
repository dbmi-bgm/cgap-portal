from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, List, Mapping, Optional, Union

import structlog

from ..tmp_item_models import File, QualityMetric, QualityMetricSummary, Sample, Individual
from ..util import JsonObject, title_to_snake_case


log = structlog.getLogger(__name__)


class QcConstants:

    ANCESTRY = "ancestry"
    ACCESSION = "accession"
    BAM_SAMPLE_ID = "bam_sample_id"
    COMPLETED_QCS = "completed_qcs"
    COMPLETED_QC_BAM = "BAM"
    COMPLETED_QC_SNV = "SNV"
    COMPLETED_QC_SV = "SV"
    COVERAGE = "coverage"
    DE_NOVO_FRACTION = "de_novo_fraction"
    FILTERED_VARIANTS = "filtered_variants"
    FILTERED_STRUCTURAL_VARIANTS = "filtered_structural_variants"
    FLAG = "flag"
    FLAG_PASS = "pass"
    FLAG_WARN = "warn"
    FLAG_FAIL = "fail"
    INDIVIDUAL_ID = "individual_id"
    INDIVIDUAL_ACCESSION = "individual_accession"
    HETEROZYGOSITY_RATIO = "heterozygosity_ratio"
    LINK = "link"
    PREDICTED_SEX = "predicted_sex"
    PREDICTED_ANCESTRY = "predicted_ancestry"
    READ_LENGTH = "read_length"
    SEQUENCING_TYPE = "sequencing_type"
    SEX = "sex"
    SPECIMEN_TYPE = "specimen_type"
    TOTAL_READS = "total_reads"
    TOTAL_VARIANTS_CALLED = "total_variants_called"
    TRANSITION_TRANSVERSION_RATIO = "transition_transversion_ratio"
    VALUE = "value"


QC_VALUE_SCHEMA = {
    "title": "Value",
    "description": "Value for this QC metric",
    "type": "string",
}
QC_FLAG_SCHEMA = {
    "title": "QC Flag",
    "description": "Flag for this QC value",
    "type": "string",
    "enum": [
        QcConstants.FLAG_PASS,
        QcConstants.FLAG_WARN,
        QcConstants.FLAG_FAIL,
    ],
}
QC_LINK_SCHEMA = {
    "title": "QC Link",
    "description": "Link for this QC metric",
    "type": "string",
}
QC_SUMMARY_SCHEMA = {
    "title": "QC Flags",
    "description": "Quality control flags",
    "type": "object",
    "properties": {
        QcConstants.FLAG: {
            "title": "Overall Flag",
            "description": "Overall QC flag",
            "type": "string",
            "enum": [
                QcConstants.FLAG_PASS,
                QcConstants.FLAG_WARN,
                QcConstants.FLAG_FAIL,
            ],
        },
        QcConstants.FLAG_WARN: {
            "title": "Warn Flags",
            "description": "Number of warn flags",
            "type": "integer",
        },
        QcConstants.FLAG_FAIL: {
            "title": "Fail Flags",
            "description": "Number of fail flags",
            "type": "integer",
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
    },
}
 

class QcFlagger(ABC):
    """Evaluate QC values for appropriate flags."""

    ACCEPTED_PREDICTED_SEXES = set()
    BAM_COVERAGE_WGS_WARN_LOWER = 0
    BAM_COVERAGE_WGS_FAIL_LOWER = 0
    BAM_COVERAGE_WES_WARN_LOWER = 0
    BAM_COVERAGE_WES_FAIL_LOWER = 0
    HETEROZYGOSITY_WARN_UPPER = 0
    HETEROZYGOSITY_WARN_LOWER = 0
    TRANSITION_TRANSVERSION_WGS_FAIL_UPPER = 0
    TRANSITION_TRANSVERSION_WGS_WARN_UPPER = 0
    TRANSITION_TRANSVERSION_WGS_WARN_LOWER = 0
    TRANSITION_TRANSVERSION_WGS_FAIL_LOWER = 0
    TRANSITION_TRANSVERSION_WES_FAIL_UPPER = 0
    TRANSITION_TRANSVERSION_WES_WARN_UPPER = 0
    TRANSITION_TRANSVERSION_WES_WARN_LOWER = 0
    TRANSITION_TRANSVERSION_WES_FAIL_LOWER = 0

    @classmethod
    @abstractmethod
    def get_flag(
        cls,
        title: str,
        value: str,
        sample: Optional[Sample] = None,
    ) -> str:
        pass

    @staticmethod
    def _assign_flag(
        value: float,
        fail_upper: Optional[float] = None,
        fail_lower: Optional[float] = None,
        warn_upper: Optional[float] = None,
        warn_lower: Optional[float] = None,
        default: str = QcConstants.FLAG_PASS,
    ) -> str:
        """Provide flag for value.

        Note: all boundary values evaluated as strict inequalities.
        """
        result = default
        if fail_upper and value > fail_upper:
            result = QcConstants.FLAG_FAIL
        elif warn_upper and value > warn_upper:
            result = QcConstants.FLAG_WARN
        elif fail_lower and value < fail_lower:
            result = QcConstants.FLAG_FAIL
        elif warn_lower and value < warn_lower:
            result = QcConstants.FLAG_WARN
        return result

    @classmethod
    def _flag_bam_coverage(
        cls,
        coverage: str,
        sample: Optional[Sample] = None,
        **kwargs,
    ) -> str:
        """Evaluate BAM coverage for flag."""
        result = ""
        coverage_float = cls._get_coverage_as_float(coverage)
        if isinstance(sample, Sample):
            return cls._flag_bam_coverage_for_sample(coverage_float, sample)
        return result

    @staticmethod
    def _get_coverage_as_float(coverage: str) -> float:
        return float(coverage.lower().rstrip("x"))

    @classmethod
    def _flag_bam_coverage_for_sample(
        cls,
        coverage: float,
        sample: Sample
    ) -> str:
        result = ""
        if sample.is_wgs():
            result = cls._assign_flag(
                coverage,
                warn_lower=cls.BAM_COVERAGE_WGS_WARN_LOWER,
                fail_lower=cls.BAM_COVERAGE_WGS_FAIL_LOWER,
            )
        elif sample.is_wes():
            result = cls._assign_flag(
                coverage,
                warn_lower=cls.BAM_COVERAGE_WES_WARN_LOWER,
                fail_lower=cls.BAM_COVERAGE_WES_FAIL_LOWER,
            )
        else:
            log.warning(
                f"Encountered unexpected sequencing type"
                f" ({sample.get_workup_type()}) while"
                f" evaluating QC metrics for sample: {sample.get_properties()}."
            )
        return result


    @classmethod
    def _flag_sex_consistency(
        cls,
        predicted_sex: str,
        sample: Optional[Sample] = None,
        **kwargs,
    ) -> Union[str, None]:
        """Evaluate sex consistency for flag."""
        result = None
        individual = cls._get_individual_from_sample(sample)
        if predicted_sex and individual:
            submitted_sex = individual.get_sex()
            predicted_sex_lower = predicted_sex.lower()
            predicted_sex_short_form = predicted_sex.upper()[0]
            if predicted_sex_lower not in cls.ACCEPTED_PREDICTED_SEXES:
                result = QcConstants.FLAG_FAIL
            elif submitted_sex:
                if predicted_sex_short_form == submitted_sex:
                    result = QcConstants.FLAG_PASS
                else:
                    result = QcConstants.FLAG_WARN
        return result

    @staticmethod
    def _get_individual_from_sample(sample: Union[Sample, None]) -> Union[Individual, None]:
        if isinstance(sample, Sample):
            individual = sample.get_individual()
            if isinstance(individual, Individual):
                return individual
        return

    @classmethod
    def _flag_heterozygosity_ratio(
        cls,
        heterozygosity_ratio: str,
        **kwargs
    ) -> Union[str, None]:
        """Evaluate heterozygosity ratio for flag."""
        heterozygosity_ratio = float(heterozygosity_ratio)
        result = cls._assign_flag(
            heterozygosity_ratio,
            warn_upper=cls.HETEROZYGOSITY_WARN_UPPER,
            warn_lower=cls.HETEROZYGOSITY_WARN_LOWER,
        )
        return result

    @classmethod
    def _flag_transition_transversion_ratio(
        cls,
        transition_transversion_ratio: str,
        sample: Optional[Sample] = None,
        **kwargs
    ) -> Union[str, None]:
        """Evaluate transition-transversion ratio for flag."""
        result = None
        transition_transversion_float = float(transition_transversion_ratio)
        if isinstance(sample, Sample):
            if sample.is_wgs():
                result = cls._assign_flag(
                    transition_transversion_float,
                    fail_upper=cls.TRANSITION_TRANSVERSION_WGS_FAIL_UPPER,
                    warn_upper=cls.TRANSITION_TRANSVERSION_WGS_WARN_UPPER,
                    warn_lower=cls.TRANSITION_TRANSVERSION_WGS_WARN_LOWER,
                    fail_lower=cls.TRANSITION_TRANSVERSION_WGS_FAIL_LOWER,
                )
            elif sample.is_wes():
                result = cls._assign_flag(
                    transition_transversion_float,
                    fail_upper=cls.TRANSITION_TRANSVERSION_WES_FAIL_UPPER,
                    warn_upper=cls.TRANSITION_TRANSVERSION_WES_WARN_UPPER,
                    warn_lower=cls.TRANSITION_TRANSVERSION_WES_WARN_LOWER,
                    fail_lower=cls.TRANSITION_TRANSVERSION_WES_FAIL_LOWER,
                )
            else:
                log.warning(
                    f"Encountered unexpected sequencing type"
                    f" ({sample.get_workup_type()}) while"
                    f" evaluating QC metrics for sample: {sample.get_properties()}."
                )
        return result


def get_latest_file_with_quality_metric(
    files: Iterable[File],
    evaluator: Callable
) -> Union[File, None]:
    for file in reversed(files):
        if evaluator(file) and file.get_quality_metric():
            return file
    return


def get_latest_bam_with_quality_metric(files: Iterable[File]) -> Union[File, None]:
    return get_latest_file_with_quality_metric(files, is_bam)


def is_bam(file: File) -> bool:
    return file.is_bam()


@dataclass(frozen=True)
class QualityControlMetric(ABC):

    sample_id: str
    title: str
    value: Union[str, List[str]]

    @abstractmethod
    def get_formatted_metric(self) -> JsonObject:
        pass

    def get_sample_id(self) -> str:
        return self.sample_id

    def get_title(self) -> str:
        return self.title

    def get_value(self) -> Union[str, List[str]]:
        return self.value

    @abstractmethod
    def update(self) -> QualityControlMetric:
        pass


@dataclass(frozen=True)
class FlatQualityControlMetric(QualityControlMetric):

    def get_formatted_metric(self) -> JsonObject:
        if self.title and self.value:
            return {self.title: self.value}
        return {}

    def update(self, title: Optional[str] = None, **kwargs) -> FlatQualityControlMetric:
        if title:
            return FlatQualityControlMetric(self.sample_id, title, self.value)
        return self


@dataclass(frozen=True)
class NestedQualityControlMetric(QualityControlMetric):

    flag: Optional[str] = None
    link: Optional[str] = None
    completed_qc_step: Optional[str] = None

    def get_flag(self) -> str:
        return self.flag or ""

    def get_completed_qc_step(self) -> str:
        return self.completed_qc_step or ""

    def get_formatted_metric(self) -> JsonObject:
        if self.title and self.value:
            return self._get_formatted_metric()
        return {}

    def _get_formatted_metric(self) -> JsonObject:
        nested_properties = self._get_nested_properties()
        return {self.title: nested_properties}

    def _get_nested_properties(self) -> JsonObject:
        result = {QcConstants.VALUE: self.value}
        if self.flag:
            result[QcConstants.FLAG] = self.flag
        if self.link:
            result[QcConstants.LINK] = self.link
        return result

    def update(
        self,
        title: Optional[str] = None,
        flag: Optional[str] = None,
        link: Optional[str] = None,
        completed_qc_step: Optional[str] = None,
        **kwargs
    ) -> NestedQualityControlMetric:
        if any([title, flag, link, completed_qc_step]):
            return NestedQualityControlMetric(
                self.sample_id,
                title or self.title,
                self.value,
                flag=(flag or self.flag),
                link=(link or self.link),
                completed_qc_step=(completed_qc_step or self.completed_qc_step),
            )
        return self



def get_quality_control_metrics(
    samples: Iterable[Sample],
    files: Iterable[File],
    qc_flagger: QcFlagger,
    desired_fields: Iterable[str],
) -> Union[List[JsonObject], None]:
    qc_metrics = get_qc_metrics(
        files, samples, qc_flagger, desired_fields
    )
    qc_metrics_per_sample = get_qc_metrics_per_sample(
        samples, qc_metrics, desired_fields
    )
    quality_control_metrics = get_sorted_and_formatted_quality_control_metrics(
        qc_metrics_per_sample
    )
    if quality_control_metrics:
        return quality_control_metrics
    return


def get_qc_metrics(
    files: Iterable[File],
    samples: Iterable[Sample],
    qc_flagger: QcFlagger,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    qc_metrics_without_flags = get_qc_metrics_without_flags(
        files, samples, desired_fields
    )
    return get_qc_metrics_with_flags(qc_metrics_without_flags, samples, qc_flagger)


def get_qc_metrics_with_flags(
    qc_metrics_without_flags: Iterable[QualityControlMetric],
    samples: Iterable[Sample],
    qc_flagger: QcFlagger,
) -> List[QualityControlMetric]:
    sample_ids_to_samples = get_sample_ids_to_samples(samples)
    return [
        get_qc_metric_with_flag(qc_metric, sample_ids_to_samples, qc_flagger)
        for qc_metric in qc_metrics_without_flags
    ]


def get_sample_ids_to_samples(samples: Iterable[Sample]) -> Dict[str, Sample]:
    return {sample.get_bam_sample_id(): sample for sample in samples}


def get_qc_metric_with_flag(
    qc_metric: QualityControlMetric,
    sample_ids_to_samples: Mapping[str, Sample],
    qc_flagger: QcFlagger,
) -> QualityControlMetric:
    if isinstance(qc_metric, NestedQualityControlMetric):
        return get_nested_qc_metric_with_flag(qc_metric, sample_ids_to_samples, qc_flagger)
    return qc_metric


def get_nested_qc_metric_with_flag(
    qc_metric: NestedQualityControlMetric,
    sample_ids_to_samples: Mapping[str, Sample],
    qc_flagger: QcFlagger,
) -> NestedQualityControlMetric:
    sample = get_sample_for_qc_metric(qc_metric, sample_ids_to_samples)
    if sample:
        return get_nested_qc_metric_with_flag_update(qc_metric, sample, qc_flagger)
    return qc_metric


def get_sample_for_qc_metric(
    qc_metric: QualityControlMetric,
    sample_ids_to_samples: Mapping[str, Sample],
) -> Union[Sample, None]:
    return sample_ids_to_samples.get(qc_metric.get_sample_id())


def get_nested_qc_metric_with_flag_update(
    qc_metric: NestedQualityControlMetric,
    sample: Sample,
    qc_flagger: QcFlagger,
) -> NestedQualityControlMetric:
    flag = get_flag_for_qc_metric(qc_metric, sample, qc_flagger)
    if flag:
        return get_updated_qc_metric(qc_metric, flag=flag)
    return qc_metric


def get_flag_for_qc_metric(
    qc_metric: NestedQualityControlMetric,
    sample: Sample,
    qc_flagger: QcFlagger,
) -> NestedQualityControlMetric:
    title = qc_metric.get_title()
    value = qc_metric.get_value()
    return qc_flagger.get_flag(title, value, sample=sample)


def get_qc_metrics_without_flags(
    files: Iterable[File],
    samples: Iterable[Sample],
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    return get_qc_metrics_from_files(
        files, desired_fields
    ) + get_qc_metrics_from_samples(samples, desired_fields)


def get_qc_metrics_from_files(
    files: Iterable[File],
    desired_fields: Iterable[str],
) -> List[NestedQualityControlMetric]:
    result = []
    for file in files:
        result += get_qc_metrics_from_file(file, desired_fields)
    return result


def get_qc_metrics_from_file(
    file: File,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    quality_metric = file.get_quality_metric()
    if isinstance(quality_metric, QualityMetric):
        return get_qc_metrics_from_quality_metric_with_file_data(
            quality_metric, file, desired_fields
        )
    return []


def get_qc_metrics_from_quality_metric_with_file_data(
    quality_metric: QualityMetric,
    file: File,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    qc_metrics_from_quality_metric = get_qc_metrics_from_quality_metric(
        quality_metric, desired_fields
    )
    return get_qc_metrics_with_file_data(qc_metrics_from_quality_metric, file)


def get_qc_metrics_with_file_data(
    qc_metrics: Iterable[QualityControlMetric],
    file: File,
) -> List[QualityControlMetric]:
    qc_metrics_with_completed_qc_step = get_qc_metrics_with_completed_qc_step(
        qc_metrics, file
    )
    return get_qc_metrics_with_title_updates(qc_metrics_with_completed_qc_step, file)


def get_qc_metrics_with_completed_qc_step(
    qc_metrics: Iterable[QualityControlMetric],
    file: File,
) -> List[QualityControlMetric]:
    completed_qc_step = get_completed_qc_step_from_file(file)
    if completed_qc_step:
        return get_updated_qc_metrics(qc_metrics, completed_qc_step=completed_qc_step)
    return qc_metrics


def get_completed_qc_step_from_file(file: File) -> str:
    if file.is_bam():
        return QcConstants.COMPLETED_QC_BAM
    if file.is_snv_final_vcf():
        return QcConstants.COMPLETED_QC_SNV
    if file.is_sv_final_vcf():
        return QcConstants.COMPLETED_QC_SV
    return ""


def get_updated_qc_metrics(
    qc_metrics: Iterable[QualityControlMetric],
    **kwargs,
) -> List[QualityControlMetric]:
    return [get_updated_qc_metric(qc_metric, **kwargs) for qc_metric in qc_metrics]


def get_updated_qc_metric(
    qc_metric: QualityControlMetric,
    **kwargs,
) -> QualityControlMetric:
    return qc_metric.update(**kwargs)


def get_qc_metrics_with_title_updates(
    qc_metrics: Iterable[QualityControlMetric],
    file: File,
) -> List[QualityControlMetric]:
    title_updates = get_title_updates(file)
    if title_updates:
        return get_qc_metrics_with_updated_titles(qc_metrics, title_updates)
    return qc_metrics


def get_title_updates(file: File) -> Dict[str, str]:
    if file.is_sv_final_vcf():
        return {QcConstants.FILTERED_VARIANTS: QcConstants.FILTERED_STRUCTURAL_VARIANTS}
    return {}


def get_qc_metrics_with_updated_titles(
    qc_metrics: Iterable[QualityControlMetric],
    title_updates: Mapping[str, str],
) -> List[QualityControlMetric]:
    return [
        get_qc_metric_with_updated_title(qc_metric, title_updates)
        for qc_metric in qc_metrics
    ]


def get_qc_metric_with_updated_title(
    qc_metric: QualityControlMetric,
    title_updates: Mapping[str, str],
) -> QualityControlMetric:
    current_title = qc_metric.get_title()
    updated_title = title_updates.get(current_title)
    if updated_title:
        return qc_metric.update(title=updated_title)
    return qc_metric


def get_qc_metrics_from_quality_metric(
    quality_metric: QualityMetric,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    quality_metric_summaries = quality_metric.get_quality_metric_summaries()
    qc_metrics_from_quality_metric_summaries = get_qc_metrics_from_quality_metric_summaries(
        quality_metric_summaries, desired_fields
    )
    return get_qc_metrics_with_quality_metric_data(
        qc_metrics_from_quality_metric_summaries, quality_metric
    )


def get_qc_metrics_with_quality_metric_data(
    qc_metrics: Iterable[QualityControlMetric],
    quality_metric: QualityMetric,
) -> List[QualityControlMetric]:
    qc_metric_titles_for_link = get_qc_metric_titles_for_link(quality_metric)
    link = get_link_from_quality_metric(quality_metric)
    if qc_metric_titles_for_link and link:
        return get_updated_qc_metrics_with_link(qc_metrics, qc_metric_titles_for_link, link)
    return qc_metrics


def get_qc_metric_titles_for_link(quality_metric: QualityMetric) -> List[str]:
    if is_qc_list_with_peddy_qc(quality_metric):
        return [QcConstants.PREDICTED_ANCESTRY, QcConstants.PREDICTED_SEX]
    return []


def get_link_from_quality_metric(quality_metric: QualityMetric) -> str:
    if is_qc_list_with_peddy_qc(quality_metric):
        return get_peddy_qc_download_link_from_qc_list(quality_metric)
    return ""


def is_qc_list_with_peddy_qc(quality_metric: QualityMetric) -> bool:
    if quality_metric.is_qc_list_type() and get_peddy_qc_from_qc_list(quality_metric):
        return True
    return False


def get_peddy_qc_from_qc_list(quality_metric: QualityMetric) -> Union[QualityMetric, None]:
    for child_quality_metric in quality_metric.get_qc_list_quality_metrics():
        if child_quality_metric.is_peddy_qc_type():
            return child_quality_metric
    return


def get_peddy_qc_download_link_from_qc_list(quality_metric: QualityMetric) -> str:
    peddy_qc = get_peddy_qc_from_qc_list(quality_metric)
    return f"{peddy_qc.get_at_id()}@@download"


def get_updated_qc_metrics_with_link(
    qc_metrics: Iterable[QualityControlMetric],
    qc_metric_titles_for_link: Iterable[str],
    link: str,
) -> List[QualityControlMetric]:
    return [
        get_updated_qc_metric_with_link(qc_metric, qc_metric_titles_for_link, link)
        for qc_metric in qc_metrics
    ]


def get_updated_qc_metric_with_link(
    qc_metric: QualityControlMetric,
    qc_metric_titles_for_link: Iterable[str],
    link: str,
) -> QualityControlMetric:
    if is_title_for_link(qc_metric, qc_metric_titles_for_link):
        return qc_metric.update(link=link)
    return qc_metric


def is_title_for_link(
    qc_metric: QualityControlMetric,
    qc_metric_titles_for_link: Iterable[str],
) -> bool:
    if qc_metric.get_title() in qc_metric_titles_for_link:
        return True
    return False


def get_qc_metrics_from_quality_metric_summaries(
    quality_metric_summaries: Iterable[QualityControlMetricSummary],
    desired_fields: Iterable[str],
) -> List[NestedQualityControlMetric]:
    result = []
    for quality_metric_summary in quality_metric_summaries:
        qc_metric = get_qc_metric_from_quality_metric_summary(
            quality_metric_summary, desired_fields
        )
        if qc_metric:
            result.append(qc_metric)
    return result

def get_qc_metric_from_quality_metric_summary(
    quality_metric_summary: QualityControlMetricSummary,
    desired_fields: Iterable[str],
) -> Union[QualityControlMetric, None]:
    if is_desired_quality_metric_summary(quality_metric_summary, desired_fields):
        return get_nested_qc_metric_from_quality_metric_summary(quality_metric_summary)


def is_desired_quality_metric_summary(
    quality_metric_summary: QualityControlMetricSummary,
    desired_fields: Iterable[str],
) -> bool:
    if get_title_from_quality_metric_summary(quality_metric_summary) in desired_fields:
        return True
    return False


def get_title_from_quality_metric_summary(quality_metric_summary: QualityControlMetricSummary) -> str:
    return title_to_snake_case(quality_metric_summary.get_title())


def get_nested_qc_metric_from_quality_metric_summary(
    quality_metric_summary: QualityControlMetricSummary,
) -> NestedQualityControlMetric:
    sample_id = quality_metric_summary.get_sample()
    title = get_title_from_quality_metric_summary(quality_metric_summary)
    value = quality_metric_summary.get_value()
    return NestedQualityControlMetric(sample_id, title, value)


def get_qc_metrics_from_samples(
    samples: Iterable[Sample],
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    result = []
    for sample in samples:
        result += get_qc_metrics_from_sample(sample, desired_fields)
    return result


def get_qc_metrics_from_sample(
    sample: Sample,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    return get_sample_qc_metrics(sample, desired_fields) + get_individual_qc_metrics(sample, desired_fields)


def get_sample_qc_metrics(
    sample: Sample,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    result = []
    sample_id = sample.get_bam_sample_id()
    if QcConstants.BAM_SAMPLE_ID in desired_fields:
        result.append(get_sample_bam_sample_id(sample_id))
    if QcConstants.SPECIMEN_TYPE in desired_fields:
        result.append(get_sample_specimen_type(sample_id, sample))
    if QcConstants.SEQUENCING_TYPE in desired_fields:
        result.append(get_sample_sequencing_type(sample_id, sample))
    return result


def get_sample_bam_sample_id(
    sample_id: str
) -> FlatQualityControlMetric:
    return FlatQualityControlMetric(
        sample_id, QcConstants.BAM_SAMPLE_ID, sample_id
    )

def get_sample_specimen_type(
    sample_id: str,
    sample: Sample,
) -> FlatQualityControlMetric:
    return FlatQualityControlMetric(
        sample_id, QcConstants.SPECIMEN_TYPE, sample.get_specimen_type()
    )

def get_sample_sequencing_type(
    sample_id: str,
    sample: Sample,
) -> FlatQualityControlMetric:
    return FlatQualityControlMetric(
        sample_id, QcConstants.SEQUENCING_TYPE, sample.get_workup_type()
    )


def get_individual_qc_metrics(
    sample: Sample,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    result = []
    sample_id = sample.get_bam_sample_id()
    individual = sample.get_individual()
    if isinstance(individual, Individual):
        result += get_desired_individual_qc_metrics(sample_id, individual, desired_fields)
    return result


def get_desired_individual_qc_metrics(
    sample_id: str,
    individual: Individual,
    desired_fields: Iterable[str],
) -> List[QualityControlMetric]:
    result = []
    if QcConstants.SEX in desired_fields:
        result.append(get_individual_sex_qc_metric(sample_id, individual))
    if QcConstants.INDIVIDUAL_ID in desired_fields:
        result.append(get_individual_id_qc_metric(sample_id, individual))
    if QcConstants.ANCESTRY in desired_fields:
        result.append(get_individual_ancestry_qc_metric(sample_id, individual))
    if QcConstants.INDIVIDUAL_ACCESSION in desired_fields:
        result.append(get_individual_accession_qc_metric(sample_id, individual))
    return result


def get_individual_sex_qc_metric(
    sample_id: str,
    individual: Individual,
) -> NestedQualityControlMetric:
    return NestedQualityControlMetric(
        sample_id, QcConstants.SEX, individual.get_sex()
    )


def get_individual_id_qc_metric(
    sample_id: str,
    individual: Individual,
) -> FlatQualityControlMetric:
    return FlatQualityControlMetric(
        sample_id, QcConstants.INDIVIDUAL_ID, individual.get_submitted_identifier()
    )


def get_individual_ancestry_qc_metric(
    sample_id: str,
    individual: Individual,
) -> NestedQualityControlMetric:
    ancestry = get_individual_ancestry(individual)
    return NestedQualityControlMetric(
        sample_id, QcConstants.ANCESTRY, ancestry
    )


def get_individual_ancestry(individual: Individual) -> str:
    submitted_ancestries = individual.get_ancestry()
    if submitted_ancestries:
        return ", ".join(submitted_ancestries)
    return ""


def get_individual_accession_qc_metric(
    sample_id: str,
    individual: Individual,
) -> FlatQualityControlMetric:
    return FlatQualityControlMetric(
        sample_id, QcConstants.INDIVIDUAL_ACCESSION, individual.get_accession()
    )


def get_qc_metrics_per_sample(
    samples: Iterable[Sample],
    quality_control_metrics: Iterable[QualityControlMetric],
    desired_fields: Iterable[str],
) -> List[JsonObject]:
    sample_id_to_qc_metrics = get_matched_qc_metrics_by_sample(
        samples, quality_control_metrics
    )
    if QcConstants.COMPLETED_QCS in desired_fields:
        add_completed_qcs_qc_metric(sample_id_to_qc_metrics)
    if QcConstants.FLAG_WARN in desired_fields:
        add_warn_flag_qc_metric(sample_id_to_qc_metrics)
    if QcConstants.FLAG_FAIL in desired_fields:
        add_fail_flag_qc_metric(sample_id_to_qc_metrics)
    return sample_id_to_qc_metrics


def get_matched_qc_metrics_by_sample(
    samples: Iterable[Sample], quality_control_metrics: Iterable[QualityControlMetric]
) -> Dict[str, List[QualityControlMetric]]:
    sample_id_to_qc_metrics = {sample.get_bam_sample_id(): [] for sample in samples}
    for quality_control_metric in quality_control_metrics:
        sample_id = quality_control_metric.get_sample_id()
        sample_qc_metrics = sample_id_to_qc_metrics.get(sample_id)
        if sample_qc_metrics is not None:
            sample_qc_metrics.append(quality_control_metric)
    return sample_id_to_qc_metrics


def add_completed_qcs_qc_metric(sample_id_to_qc_metrics: Dict[str, List[QualityControlMetric]]) -> None:
    add_qc_metric_for_each_sample(sample_id_to_qc_metrics, get_completed_qcs)


def add_qc_metric_for_each_sample(
    sample_id_to_qc_metrics: Dict[str, List[QualityControlMetric]],
    get_qc_metric_to_add: Callable,
) -> None:
    for sample_id, quality_control_metrics in sample_id_to_qc_metrics.items():
        qc_to_add = get_qc_metric_to_add(sample_id, quality_control_metrics)
        quality_control_metrics.append(qc_to_add)


def get_completed_qcs(sample_id: str, quality_control_metrics: List[QualityControlMetric]) -> FlatQualityControlMetric:
    all_completed_qc_steps = get_all_completed_qc_steps(quality_control_metrics)
    unique_completed_qc_steps = get_sorted_unique_items(all_completed_qc_steps)
    return FlatQualityControlMetric(
        sample_id, QcConstants.COMPLETED_QCS, unique_completed_qc_steps
    )


def get_sorted_unique_items(items: Iterable[str]) -> List[str]:
    return sorted(list(set(items)))


def get_all_completed_qc_steps(quality_control_metrics: List[QualityControlMetric]) -> List[str]:
    return [
        quality_control_metric.get_completed_qc_step()
        for quality_control_metric in quality_control_metrics
        if (
            isinstance(quality_control_metric, NestedQualityControlMetric)
            and quality_control_metric.get_completed_qc_step()
        )
    ]


def add_warn_flag_qc_metric(
    sample_id_to_qc_metrics: Dict[str, List[QualityControlMetric]]
) -> None:
    add_qc_metric_for_each_sample(sample_id_to_qc_metrics, get_warn_flag_qc)


def get_warn_flag_qc(
    sample_id: str,
    quality_control_metrics: List[QualityControlMetric]
) -> FlatQualityControlMetric:
    return get_qc_metric_for_flag(sample_id, quality_control_metrics, QcConstants.FLAG_WARN)


def get_qc_metric_for_flag(
    sample_id: str,
    quality_control_metrics: List[QualityControlMetric],
    flag_type: str
) -> FlatQualityControlMetric:
    all_qc_titles_with_flag_type = get_all_qc_titles_with_flag_type(
        quality_control_metrics, flag_type
    )
    unique_qc_titles_with_flag_type = get_sorted_unique_items(all_qc_titles_with_flag_type)
    return FlatQualityControlMetric(sample_id, flag_type, unique_qc_titles_with_flag_type)


def get_all_qc_titles_with_flag_type(
    quality_control_metrics: List[QualityControlMetric],
    flag_type: str
) -> List[str]:
    return [
        quality_control_metric.get_title()
        for quality_control_metric in quality_control_metrics
        if (
            isinstance(quality_control_metric, NestedQualityControlMetric)
            and quality_control_metric.get_flag() == flag_type
        )
    ]


def add_fail_flag_qc_metric(
    sample_id_to_qc_metrics: Dict[str, List[QualityControlMetric]]
) -> None:
    add_qc_metric_for_each_sample(sample_id_to_qc_metrics, get_fail_flag_qc)


def get_fail_flag_qc(
    sample_id: str,
    quality_control_metrics: List[QualityControlMetric]
) -> FlatQualityControlMetric:
    return get_qc_metric_for_flag(sample_id, quality_control_metrics, QcConstants.FLAG_FAIL)


def get_sorted_and_formatted_quality_control_metrics(
    qc_metrics_per_sample: Mapping[str, List[QualityControlMetric]]
) -> List[JsonObject]:
    result = []
    sorted_sample_ids = sorted(qc_metrics_per_sample.keys())
    for sample_id in sorted_sample_ids:
        formatted_quality_control_metrics = get_formatted_quality_control_metrics(
            sample_id, qc_metrics_per_sample
        )
        if formatted_quality_control_metrics:
            result.append(formatted_quality_control_metrics)
    return result


def get_formatted_quality_control_metrics(
    sample_id: str,
    qc_metrics_per_sample: Mapping[str, List[QualityControlMetric]],
) -> JsonObject:
    result = {}
    for quality_control_metric in qc_metrics_per_sample.get(sample_id, []):
        result.update(quality_control_metric.get_formatted_metric())
    return result


#@dataclass(frozen=True)
#class SampleQualityControlMetrics:
#
#    properties: JsonObject
#
#    @property
#    def _sample_id(self) -> str:
#        return self.properties.get(QcConstants.BAM_SAMPLE_ID, "")
#
#    @property
#    def _warn_flags(self) -> List[str]:
#        return self.properties.get(QcConstants.FLAG_WARN, [])
#
#    @property
#    def _fail_flags(self) -> List[str]:
#        return self.properties.get(QcConstants.FLAG_FAIL, [])
#
#    @property
#    def _completed_qc_steps(self) -> List[str]:
#        return self.properties.get(QcConstants.COMPLETED_QC_STEPS, [])
#
#    def get_warn_flag_count(self) -> int:
#        return len(self._warn_flags)
#
#    def get_fail_flag_count(self) -> int:
#        return len(self._fail_flags)
#
#    def get_completed_qc_steps(self) -> List[str]:
#        return self._completed_qc_steps
#
#    def has_pass_flag(self) -> bool:
#
#    def get_nested_qc_metrics(self) -> List[QualityControlMetric]:
#        result = []
#        for key, value in self.properties.items():
#            nested_qc_metric = get_nested_qc_metric(key, value)


@dataclass(frozen=True)
class QualityControlMetricSummary:

    title: str
    value: Union[str, List[str], int]

    def get_formatted_summary(self) -> JsonObject:
        return {self.title: self.value}


def get_quality_control_metrics_summary(
    samples_formatted_qc_metrics: Iterable[JsonObject]
) -> JsonObject:
    quality_control_metrics = get_qc_metrics_from_formatted_metrics(samples_formatted_qc_metrics)
    qc_metrics_summaries = get_qc_metric_summaries(quality_control_metrics)
    return get_formatted_quality_control_metrics_summary(qc_metrics_summaries)


def get_qc_metrics_from_formatted_metrics(samples_formatted_qc_metrics: Iterable[JsonObject]) -> List[QualityControlMetric]:
    result = []
    for sample_formatted_qc_metrics in samples_formatted_qc_metrics:
        result += get_qc_metrics_for_sample(sample_formatted_qc_metrics)
    return result


def get_qc_metrics_for_sample(sample_formatted_qc_metrics: JsonObject) -> List[QualityControlMetric]:
    sample_id = get_sample_id_from_qc_metrics(sample_formatted_qc_metrics)
    return [
        get_qc_metric(sample_id, qc_metric_title, qc_metric_value)
        for qc_metric_title, qc_metric_value in sample_formatted_qc_metrics.items()
    ]


def get_sample_id_from_qc_metrics(sample_formatted_qc_metrics: JsonObject) -> str:
    return sample_formatted_qc_metrics.get(QcConstants.BAM_SAMPLE_ID, "")


def get_qc_metric(sample_id: str, qc_metric_title: str, qc_metric_value: Union[str, List[str], JsonObject]) -> QualityControlMetric:
    if isinstance(qc_metric_value, dict):
        return get_nested_quality_control_metric(sample_id, qc_metric_title, qc_metric_value)
    return get_flat_quality_control_metric(sample_id, qc_metric_title, qc_metric_value)


def get_nested_quality_control_metric(sample_id: str, qc_metric_title: str, qc_metric_value: JsonObject) -> NestedQualityControlMetric:
    value = qc_metric_value.get(QcConstants.VALUE)
    flag = qc_metric_value.get(QcConstants.FLAG)
    return NestedQualityControlMetric(sample_id, qc_metric_title, value, flag=flag)


def get_flat_quality_control_metric(sample_id: str, qc_metric_title: str, qc_metric_value: Union[str, List[str]]) -> FlatQualityControlMetric:
    return FlatQualityControlMetric(sample_id, qc_metric_title, qc_metric_value)


def get_qc_metric_summaries(qc_metrics: Iterable[QualityControlMetric]) -> List[QualityControlMetricSummary]:
    possible_summaries = get_possible_qc_metric_summaries(qc_metrics)
    return [summary for summary in possible_summaries if summary]


def get_possible_qc_metric_summaries(qc_metrics: Iterable[QualityControlMetric]) -> List[Union[QualityControlMetricSummary, None]]:
    return [
        get_warn_flag_summary(qc_metrics),
        get_fail_flag_summary(qc_metrics),
        get_overall_flag_summary(qc_metrics),
        get_completed_qc_steps_summary(qc_metrics),
    ]


def get_warn_flag_summary(qc_metrics: Iterable[QualityControlMetric]) -> QualityControlMetricSummary:
    warn_count = get_flag_count(qc_metrics, QcConstants.FLAG_WARN)
    return QualityControlMetricSummary(QcConstants.FLAG_WARN, warn_count)


def get_fail_flag_summary(qc_metrics: Iterable[QualityControlMetric]) -> QualityControlMetricSummary:
    fail_count = get_flag_count(qc_metrics, QcConstants.FLAG_FAIL)
    return QualityControlMetricSummary(QcConstants.FLAG_FAIL, fail_count)


def get_flag_count(qc_metrics: Iterable[QualityControlMetric], flag_to_count: str) -> int:
    flag_count = 0
    for qc_metric in qc_metrics:
        if has_flag_to_count(qc_metric, flag_to_count):
            flag_count += 1
    return flag_count


def has_flag_to_count(qc_metric: QualityControlMetric, flag_to_count: str) -> bool:
    flag = get_flag(qc_metric)
    if flag == flag_to_count:
        return True
    return False


def get_flag(qc_metric: QualityControlMetric) -> Union[str, None]:
    if isinstance(qc_metric, NestedQualityControlMetric):
        return qc_metric.get_flag()
    return


def get_overall_flag_summary(qc_metrics: Iterable[QualityControlMetric]) -> Union[QualityControlMetricSummary, None]:
    worst_flag = get_worst_flag(qc_metrics)
    if worst_flag:
        return QualityControlMetricSummary(QcConstants.FLAG, worst_flag)
    return


def get_worst_flag(qc_metrics: Iterable[QualityControlMetric]) -> str:
    all_flags = get_all_flags(qc_metrics)
    return get_worst_flag_from_all_flags(all_flags)


def get_all_flags(qc_metrics: Iterable[QualityControlMetric]) -> List[str]:
    result = []
    for qc_metric in qc_metrics:
        flag = get_flag(qc_metric)
        if flag:
            result.append(flag)
    return result


def get_worst_flag_from_all_flags(flags: Iterable[str]) -> str:
    if QcConstants.FLAG_FAIL in flags:
        return QcConstants.FLAG_FAIL
    if QcConstants.FLAG_WARN in flags:
        return QcConstants.FLAG_WARN
    if QcConstants.FLAG_PASS in flags:
        return QcConstants.FLAG_PASS
    return ""


def get_completed_qc_steps_summary(qc_metrics: Iterable[QualityControlMetric]) -> Union[QualityControlMetricSummary, None]:
    completed_qc_steps = get_completed_qc_steps(qc_metrics)
    if completed_qc_steps:
        return QualityControlMetricSummary(QcConstants.COMPLETED_QCS, completed_qc_steps)
    return


def get_completed_qc_steps(qc_metrics: Iterable[QualityControlMetric]) -> List[str]:
    completed_qc_steps = get_completed_qc_steps_from_metrics(qc_metrics)
    return get_sorted_unique_items(completed_qc_steps)


def get_completed_qc_steps_from_metrics(qc_metrics: Iterable[QualityControlMetric]) -> List[str]:
    result = []
    for qc_metric in qc_metrics:
        if is_completed_qc_step_metric(qc_metric):
            result += qc_metric.get_value()
    return result


def is_completed_qc_step_metric(qc_metric: QualityControlMetric) -> bool:
    return qc_metric.get_title() == QcConstants.COMPLETED_QCS


def get_formatted_quality_control_metrics_summary(
    qc_metric_summaries: Iterable[QualityControlMetricSummary]
) -> JsonObject:
    result = {}
    for qc_metric_summary in qc_metric_summaries:
        result.update(qc_metric_summary.get_formatted_summary())
    return result
