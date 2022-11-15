import copy

import structlog
from snovault import calculated_property, collection, load_schema

from .base import Item, get_item_or_none
from .family import Family
from ..util import get_item, title_to_snake_case, transfer_properties


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
        "processed_files.accession",  # used to locate this file from annotated VCF via search
        "processed_files.variant_type",
        "processed_files.file_type",
        "processed_files.upload_key",  # used by Higlass browsers
        "processed_files.higlass_file",  # used by Higlass browsers
        # Sample linkTo
        "samples.completed_processes",
        "samples.processed_files.uuid",
    ]


class QcConstants:

    ANCESTRY = "ancestry"
    ACCESSION = "accession"
    SEX = "sex"
    BAM_SAMPLE_ID = "bam_sample_id"
    SPECIMEN_TYPE = "specimen_type"
    INDIVIDUAL_ID = "individual_id"
    INDIVIDUAL_ACCESSION = "individual_accession"
    SEQUENCING_TYPE = "sequencing_type"
    SPECIMEN_TYPE = "specimen_type"
    COVERAGE = "coverage"
    PREDICTED_SEX = "predicted_sex"
    PREDICTED_ANCESTRY = "predicted_ancestry"
    TOTAL_READS = "total_reads"
    COVERAGE = "coverage"
    TOTAL_VARIANTS_CALLED = "total_variants_called"
    FILTERED_VARIANTS = "filtered_variants"
    FILTERED_STRUCTURAL_VARIANTS = "filtered_structural_variants"
    HETEROZYGOSITY_RATIO = "heterozygosity_ratio"
    TRANSITION_TRANSVERSION_RATIO = "transition_transversion_ratio"
    DE_NOVO_FRACTION = "de_novo_fraction"
    COMPLETED_QCS = "completed_qcs"
    LINK = "link"
    FLAG = "flag"
    VALUE = "value"
    FLAG_PASS = "pass"
    FLAG_WARN = "warn"
    FLAG_FAIL = "fail"


class QcFlagger:

    # Schema constants
    SEX = "sex"
    WORKUP_TYPE = "workup_type"
    WORKUP_TYPE_WGS = "WGS"
    WORKUP_TYPE_WES = "WES"

    ACCEPTED_PREDICTED_SEXES = set(["male", "female"])

    @classmethod
    def flag_bam_coverage(cls, coverage, sample_properties, *args, **kwargs):
        """Evaluate BAM coverage for flag.

        :param coverage: BAM coverage from QC item
        :type coverage: str
        :param sample_properties: Sample-specific data
        :type sample_properties: dict
        :return: Flag name
        :rtype: str or None
        """
        result = None
        sequencing_type = sample_properties.get(cls.WORKUP_TYPE)
        coverage_number_string = coverage.lower().rstrip("x")
        coverage = float(coverage_number_string)
        if coverage is not None:
            if sequencing_type == cls.WORKUP_TYPE_WGS:
                warn_limit = 20
                fail_limit = 10
            elif sequencing_type == cls.WORKUP_TYPE_WES:
                warn_limit = 60
                fail_limit = 40
            else:
                warn_limit = 0
                fail_limit = 0
            if coverage >= warn_limit:
                result = QcConstants.FLAG_PASS
            elif coverage < fail_limit:
                result = QcConstants.FLAG_FAIL
            else:
                result = QcConstants.FLAG_WARN
        return result

    @classmethod
    def flag_sex_consistency(
        cls, predicted_sex, sample_properties, individual_properties, *args, **kwargs
    ):
        """Evaluate sex consistency for flag.

        :param predicted_sex: Sex predicted by peddy
        :type predicted_sex: str
        :param sample_properties: Sample-specific data
        :type sample_properties: dict
        :return: Flag name
        :rtype: str or None
        """
        result = None
        if not predicted_sex:
            result = QcConstants.FLAG_WARN
        else:
            submitted_sex = individual_properties.get(cls.SEX)
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

    @classmethod
    def flag_heterozygosity_ratio(cls, heterozygosity_ratio, *args, **kwargs):
        """Evaluate heterozygosity ratio for flag.

        :param heterozygosity_ratio: Sample SNV heterozygosity ratio
        :type heterozygosity_ratio: str
        :return: Flag name
        :rtype: str or None
        """
        result = None
        heterozygosity_ratio = float(heterozygosity_ratio)
        upper_limit = 2.5
        lower_limit = 1.4
        if heterozygosity_ratio > upper_limit:
            result = QcConstants.FLAG_WARN
        elif heterozygosity_ratio < lower_limit:
            result = QcConstants.FLAG_WARN
        else:
            result = QcConstants.FLAG_PASS
        return result

    @classmethod
    def flag_transition_transversion_ratio(
        cls, transition_transversion_ratio, sample_properties, *args, **kwargs
    ):
        """Evaluate transition-transversion ratio for flag.

        :param transition_transversion_ratio: SNV Ts-Tv ratio
        :type transition_transversion_ratio: str
        :param sample_properties: Sample-specific data
        :type sample_properties: dict
        :return: Flag name
        :rtype: str or None
        """
        result = None
        transition_transversion_float = float(transition_transversion_ratio)
        known_sequencing_type = True
        sequencing_type = sample_properties.get(cls.WORKUP_TYPE)
        if sequencing_type:
            if sequencing_type == cls.WORKUP_TYPE_WGS:
                fail_upper_limit = 2.3
                warn_upper_limit = 2.1
                warn_lower_limit = 1.8
                fail_lower_limit = 1.6
            elif sequencing_type == cls.WORKUP_TYPE_WES:
                fail_upper_limit = 3.5
                warn_upper_limit = 3.3
                warn_lower_limit = 2.3
                fail_lower_limit = 2.1
            else:
                known_sequencing_type = False
                log.warning(
                    f"Encountered unknown sequencing type ({sequencing_type}) while"
                    " evaluating QC metrics."
                )
            if known_sequencing_type:
                if transition_transversion_float > fail_upper_limit:
                    result = QcConstants.FLAG_FAIL
                elif transition_transversion_float > warn_upper_limit:
                    result = QcConstants.FLAG_WARN
                elif transition_transversion_float > warn_lower_limit:
                    result = QcConstants.FLAG_PASS
                elif transition_transversion_float > fail_lower_limit:
                    result = QcConstants.FLAG_WARN
                else:
                    result = QcConstants.FLAG_FAIL
        return result

    @classmethod
    def flag_de_novo_fraction(cls, de_novo_fraction, *args, **kwargs):
        """Evaluate de novo fraction for flag.

        :param de_novo_fraction: SNV de novo fraction
        :type de_novo_fraction: str
        :return: Flag name
        :rtype: str or None
        """
        """"""
        result = QcConstants.FLAG_PASS
        de_novo_fraction = float(de_novo_fraction)
        upper_limit = 5
        if de_novo_fraction > upper_limit:
            result = QcConstants.FLAG_FAIL
        return result


class QcSummaryItem:

    # Schema constants
    SAMPLE = "sample"
    VALUE = "value"

    QC_TITLE_TO_FLAG_EVALUATOR = {
        QcConstants.COVERAGE: QcFlagger.flag_bam_coverage,
        QcConstants.PREDICTED_SEX: QcFlagger.flag_sex_consistency,
        QcConstants.HETEROZYGOSITY_RATIO: QcFlagger.flag_heterozygosity_ratio,
        QcConstants.TRANSITION_TRANSVERSION_RATIO: QcFlagger.flag_transition_transversion_ratio,
        QcConstants.DE_NOVO_FRACTION: QcFlagger.flag_de_novo_fraction,
    }

    
    def __init__(self, title, properties, links=None):
        self.title = title
        self.flag = None
        self.value = properties.get(self.VALUE)
        self.sample = properties.get(self.SAMPLE)
        self.link = None
        if links:
            self.link = links.get(title)

    def set_flag(self, sample_properties, individual_properties):
        flag = None
        evaluator = self.QC_TITLE_TO_FLAG_EVALUATOR.get(self.title)
        if evaluator:
            try:
                flag = evaluator(self.value, sample_properties, individual_properties)
            except Exception:
                log.exception(
                    f"Could not evaluate QC title {self.title}'s value {self.value}."
                )
        self.flag = flag

    def get_qc_display(self):
        result = {}
        if self.value:
            properties = {}
            properties[QcConstants.VALUE] = self.value
            if self.link:
                properties[QcConstants.LINK] = self.link
            if self.flag:
                properties[QcConstants.FLAG] = self.flag
            result[self.title] = properties
        return result


class QualityMetricForQc:

    # Schema constants
    QUALITY_METRIC_SUMMARY = "quality_metric_summary"
    TITLE = "title"

    COMPLETED_PROCESS = None
    PROPERTY_REPLACEMENTS = {}

    def __init__(self, quality_metric_atid, request):
        self.quality_metric = get_item(request, quality_metric_atid)
        self.quality_metric_summary = self.quality_metric.get(
            self.QUALITY_METRIC_SUMMARY, []
        )

    def collect_qc_summaries(self):
        result = []
        qc_links = self.get_qc_links()
        for item in self.quality_metric_summary:
            qc_title = self.get_qc_summary_title(item)
            result.append(
                QcSummaryItem(qc_title, item, links=qc_links)
            )
        return result

    def get_qc_links(self):
        pass

    def get_qc_summary_title(self, qc_summary_item):
        """Get QC display title.

        :param qc_summary_item: QC item to evaluate
        :type qc_summary_item: dict
        :return: QC display title
        :rtype: str
        """
        title = title_to_snake_case(qc_summary_item.get(self.TITLE, ""))
        qc_title = self.PROPERTY_REPLACEMENTS.get(title, title)
        return qc_title

    def get_completed_process(self):
        return self.COMPLETED_PROCESS


class SnvFinalVcfQc(QualityMetricForQc):
    
    COMPLETED_PROCESS = "SNV"


class SnvVepVcfQc(QualityMetricForQc):

    # Schema constants
    QC_LIST = "qc_list"
    QC_TYPE = "qc_type"
    VALUE = "value"

    PEDDY_QC_STRING = "peddyqc"
    DOWNLOAD_ADD_ON = "@@download"

    def get_qc_links(self):
        """Collect QualityMetric links to include for display.

        :param quality_metric: QualityMetric item
        :type quality_metric: dict
        :return: Link mapping
        :rtype: dict or None
        """
        result = None
        peddy_qc_atid = None
        qc_list = self.quality_metric.get(self.QC_LIST, [])
        for item in qc_list:
            qc_type = item.get(self.QC_TYPE)
            if self.PEDDY_QC_STRING in qc_type:
                peddy_qc_atid = item.get(self.VALUE)
        if peddy_qc_atid:
            peddy_qc_download_url = peddy_qc_atid + self.DOWNLOAD_ADD_ON
            result = {
                QcConstants.PREDICTED_SEX: peddy_qc_download_url,
                QcConstants.PREDICTED_ANCESTRY: peddy_qc_download_url,
            }
        return result


class SvFinalVcfQc(QualityMetricForQc):

    COMPLETED_PROCESS = "SV"
    PROPERTY_REPLACEMENTS = {
        QcConstants.FILTERED_VARIANTS: QcConstants.FILTERED_STRUCTURAL_VARIANTS
    }


class BamQc(QualityMetricForQc):
    
    COMPLETED_PROCESS = "BAM"


class FileForQc:

    # Schema constants
    FILE_FORMAT = "file_format"
    FILE_TYPE = "file_type"
    QUALITY_METRIC = "quality_metric"
    VARIANT_TYPE = "variant_type"
    VARIANT_TYPE_SNV = "SNV"
    VARIANT_TYPE_SV = "SV"
    VCF_TO_INGEST = "vcf_to_ingest"

    BAM_FILE_FORMAT = "/file-formats/bam/"
    VCF_FILE_FORMAT = "/file-formats/vcf_gz/"
    FINAL_VCF_FILE_TYPE = "full annotated VCF"
    VEP_ANNOTATED_STRING = "vep-annotated"

    def __init__(self, file_atid, request):
        self.properties = get_item(request, file_atid)
        self.file_format = self.properties.get(self.FILE_FORMAT)
        self.file_type = self.properties.get(self.FILE_TYPE)
        self.vcf_to_ingest = self.properties.get(self.VCF_TO_INGEST, False)
        self.variant_type = self.properties.get(self.VARIANT_TYPE, self.VARIANT_TYPE_SNV)
        self.quality_metric_atid = self.properties.get(self.QUALITY_METRIC)

    def is_vcf(self):
        return self.file_format == self.VCF_FILE_FORMAT

    def is_bam(self):
        return self.file_format == self.BAM_FILE_FORMAT

    def is_final_vcf(self):
        return (self.file_type == self.FINAL_VCF_FILE_TYPE or self.vcf_to_ingest)

    def is_vep_vcf(self):
        return self.VEP_ANNOTATED_STRING in self.file_type.lower()

    def is_snv_file(self):
        return self.variant_type == self.VARIANT_TYPE_SNV

    def is_sv_file(self):
        return self.variant_type == self.VARIANT_TYPE_SV


class ItemWithQcProperties:

    QC_DISPLAY_PROPERTIES = set()  # Format for display similar to QC summaries
    QC_NON_DISPLAY_PROPERTIES = set()  # Not meant for display in QC table
    PROPERTY_REPLACEMENTS = {}

    def __init__(self, item_atid, request):
        self.request = request
        self.properties = get_item(request, item_atid)
        self.qc_properties = {}

    def update_qc_properties(self):
        self.add_non_display_properties()
        self.add_display_properties()

    def add_non_display_properties(self):
        transfer_properties(
            self.properties, self.qc_properties, self.QC_NON_DISPLAY_PROPERTIES,
            property_replacements=self.PROPERTY_REPLACEMENTS
        )

    def add_display_properties(self):
        properties = copy.deepcopy(self.properties)
        for property_name in self.QC_DISPLAY_PROPERTIES:
            property_value = properties.get(property_name)
            if property_value is not None:
                properties[property_name] = {QcConstants.VALUE: property_value}
        transfer_properties(
            properties, self.qc_properties, self.QC_DISPLAY_PROPERTIES,
            property_replacements=self.PROPERTY_REPLACEMENTS
        )
        
class IndividualWithQcProperties(ItemWithQcProperties):

    # Schema constants
    ACCESSION = "accession"
    INDIVIDUAL_ID = "individual_id"
    SEX = "sex"
    ANCESTRY = "ancestry"

    QC_DISPLAY_PROPERTIES = set([SEX, ANCESTRY])
    QC_NON_DISPLAY_PROPERTIES = set([ACCESSION, INDIVIDUAL_ID])
    PROPERTY_REPLACEMENTS = {ACCESSION: QcConstants.INDIVIDUAL_ACCESSION}


class SampleWithQcProperties(ItemWithQcProperties):

    # Schema constants
    BAM_SAMPLE_ID = "bam_sample_id"
    INDIVIDUAL = "individual"
    PROCESSED_FILES = "processed_files"
    WORKUP_TYPE = "workup_type"
    SPECIMEN_TYPE = "specimen_type"

    QC_NON_DISPLAY_PROPERTIES = set([BAM_SAMPLE_ID, WORKUP_TYPE, SPECIMEN_TYPE])
    PROPERTY_REPLACEMENTS = {WORKUP_TYPE: QcConstants.SEQUENCING_TYPE}

    def __init__(self, sample_atid, request):
        super().__init__(sample_atid, request)
        self.bam_sample_id = self.properties.get(self.BAM_SAMPLE_ID)
        self.individual_properties = {}
        self.quality_metrics = []
        self.qc_summaries = []
        self.flags = {}
        self.completed_processes = set([])

    def collect_qc_data(self):
        self.collect_sample_data()
        self.collect_individual_data()
        self.collect_bam_file()

    def collect_sample_data(self):
        self.update_qc_properties()

    def collect_individual_data(self):
        individual_atid = self.properties.get(self.INDIVIDUAL)
        individual = IndividualWithQcProperties(individual_atid, self.request)
        self.individual_properties.update(individual.properties)
        individual.update_qc_properties()
        self.qc_properties.update(individual.qc_properties)

    def collect_bam_file(self):
        processed_file_atids = self.properties.get(self.PROCESSED_FILES, [])
        for processed_file_atid in processed_file_atids[::-1]:  # Most recent last
            file_item = FileForQc(processed_file_atid, self.request)
            if file_item.is_bam():
                if file_item.quality_metric_atid:
                    self.quality_metrics.append(
                        BamQc(file_item.quality_metric_atid, self.request)
                    )
                break

    def add_qc_summary(self, qc_summary):
        qc_summary.set_flag(self.properties, self.individual_properties)
        self.qc_summaries.append(qc_summary)

    def add_qc_to_flags(self, qc_summary):
        flag_to_add = qc_summary.flag
        existing_values = self.flags.get(flag_to_add)
        if existing_values:
            existing_values.add(qc_summary.title)
        else:
            self.flags[flag_to_add] = set([qc_summary.title])

    def get_qc_display(self, properties_to_include, flags_to_capture):
        self.prune_qc_properties(properties_to_include)
        self.add_qc_summaries(properties_to_include, flags_to_capture)
        self.add_completed_processes()
        self.add_flag_summaries()
        return self.qc_properties

    def prune_qc_properties(self, properties_to_include):
        keys_to_delete = []
        for qc_property in self.qc_properties:
            if qc_property not in properties_to_include:
                keys_to_delete.append(qc_property)
        for key_to_delete in keys_to_delete:
            del self.qc_properties[key_to_delete]

    def add_qc_summaries(self, properties_to_include, flags_to_capture):
        for qc_summary in self.qc_summaries:
            if qc_summary.title not in properties_to_include:
                continue
            self.qc_properties.update(qc_summary.get_qc_display())
            if qc_summary.flag in flags_to_capture:
                self.add_qc_to_flags(qc_summary)

    def add_flag_summaries(self):
        for flag, flagged_qc_titles in self.flags.items():
            self.qc_properties[flag] = sorted(list(flagged_qc_titles))

    def add_completed_processes(self):
        if self.completed_processes:
            self.qc_properties[QcConstants.COMPLETED_QCS] = sorted(
                list(self.completed_processes)
            )

    def update_completed_processes(self, qc_step_name):
        if qc_step_name:
            self.completed_processes.add(qc_step_name)


class QualityMetricParser:

    QC_PROPERTIES_TO_KEEP = set(
        [
            QcConstants.SEX,
            QcConstants.ANCESTRY,
            QcConstants.BAM_SAMPLE_ID,
            QcConstants.INDIVIDUAL_ID,
            QcConstants.INDIVIDUAL_ACCESSION,
            QcConstants.SEQUENCING_TYPE,
            QcConstants.SPECIMEN_TYPE,
            QcConstants.PREDICTED_SEX,
            QcConstants.PREDICTED_ANCESTRY,
            QcConstants.TOTAL_READS,
            QcConstants.COVERAGE,
            QcConstants.TOTAL_VARIANTS_CALLED,
            QcConstants.FILTERED_VARIANTS,
            QcConstants.FILTERED_STRUCTURAL_VARIANTS,
            QcConstants.HETEROZYGOSITY_RATIO,
            QcConstants.TRANSITION_TRANSVERSION_RATIO,
            QcConstants.DE_NOVO_FRACTION,
        ]
    )
    FLAGS_TO_CAPTURE = set([QcConstants.FLAG_WARN, QcConstants.FLAG_FAIL])

    def __init__(self, request):
        """Initialize class and set attributes.

        :param request: Request
        :type request: pyramid.request.Request instance
        :var request: Request
        :vartype request: pyramid.request.Request instance
        :var processed_files_with_quality_metrics: FileProcessed items
            from which to extract QC metrics
        :vartype processed_files_with_quality_metrics: list
        :var sample_mapping: Mapping bam_sample_id --> Sample items
        :vartype sample_mapping: dict
        :var qc_property_to_evaluator: Mapping QC property titles to
            evaluators for flags
        :vartype qc_property_to_evaluator: dict
        """
        self.request = request
        self.file_quality_metrics = []
        self.sample_mapping = {}
        self.qc_display = []

    def get_qc_display_results(self, samples, processed_files):
        """Gather and process all data to make calcprop.

        Top-level method of the class.

        :param samples: Samples associated with a SampleProcessing
        :type samples: list
        :param processed_files: FilesProcessed associated with a
            SampleProcessing
        :type processed_files: list
        :return: QC metrics to display per sample
        :rtype: list
        """
        result = None
        if samples:
            if processed_files is None:
                processed_files = []
            self.collect_sample_processing_processed_files_data(processed_files)
            self.collect_samples_data(samples)
            self.associate_quality_metrics_with_samples()
            self.create_qc_display()
            if self.qc_display:
                result = self.qc_display
        return result

    def collect_sample_processing_processed_files_data(self, processed_files):
        """Collect processed files of interest from a SampleProcessing.

        :param processed_files: FilesProcessed associated with a
            SampleProcessing
        :type processed_files: list
        :return: Whether a "final" VCF (i.e. one for ingestion) was
            found
        :rtype: bool
        """
        snv_vcf_found = False
        vep_vcf_found = False
        sv_vcf_found = False
        for processed_file_atid in processed_files[::-1]:  # Most recent files last
            file_item = FileForQc(processed_file_atid, self.request)
            quality_metric_atid = file_item.quality_metric_atid
            if not file_item.is_vcf():
                continue
            if file_item.is_final_vcf():
                if file_item.is_snv_file():
                    if snv_vcf_found:
                        continue
                    snv_vcf_found = True
                    if quality_metric_atid:
                        self.file_quality_metrics.append(
                            SnvFinalVcfQc(quality_metric_atid, self.request)
                        )
                elif file_item.is_sv_file():
                    if sv_vcf_found:
                        continue
                    sv_vcf_found = True
                    if quality_metric_atid:
                        self.file_quality_metrics.append(
                            SvFinalVcfQc(
                                quality_metric_atid, self.request
                            )
                        )
            elif (
                not vep_vcf_found
                and file_item.is_snv_file()
                and file_item.is_vep_vcf()
            ):
                vep_vcf_found = True
                if quality_metric_atid:
                    self.file_quality_metrics.append(
                        SnvVepVcfQc(
                            quality_metric_atid, self.request
                        )
                    )
            if snv_vcf_found and sv_vcf_found and vep_vcf_found:
                break

    def collect_samples_data(self, sample_identifiers):
        """Gather sample data, associate QC metrics with samples, and
        format the results.

        :param sample_identifiers: Sample item identifiers
        :type sample_identifiers: list
        :return: Formatted QC metrics for display
        :rtype: list
        """
        for sample_identifier in sample_identifiers:
            sample_item = SampleWithQcProperties(sample_identifier, self.request)
            sample_item.collect_qc_data()
            self.file_quality_metrics += sample_item.quality_metrics
            sample_id = sample_item.bam_sample_id
            if sample_id:
                self.sample_mapping[sample_id] = sample_item

    def associate_quality_metrics_with_samples(self):
        """For each FileProcessed off of the SampleProcessing, get its
        QualityMetric and update sample-specific data with QC metrics.
        """
        for quality_metric in self.file_quality_metrics:
            qc_process = quality_metric.get_completed_process()
            qc_summaries = quality_metric.collect_qc_summaries()
            for qc_summary in qc_summaries:
                sample = self.sample_mapping.get(qc_summary.sample)
                if sample is None:
                    log.warning(
                        "Unable to find properties for given sample identifier"
                        f" ({qc_summary.sample}) on QualityMetric: {quality_metric}."
                    )
                    continue
                sample.add_qc_summary(qc_summary)
                sample.update_completed_processes(qc_process)

#    def associate_quality_metric_with_samples(self, quality_metric):
#        """Update sample-specific data with QualityMetric QC items.
#
#        :param quality_metric_atid: QualityMetric identifier
#        :type quality_metric_atid: str
#        :param properties_to_find: QC titles to find
#        :type properties_to_find: list
#        :param property_replacements: Mapping of QC property names
#            to replacement names
#        :type property_replacements: dict or None
#        """
#        qc_summaries = quality_metric.collect_qc_items()
#        for qc_summary in qc_summaries:
#            sample = self.sample_mapping.get(qc_summary.sample)
#            if sample is None:
#                log.warning(
#                    "Unable to find properties for given sample identifier"
#                    f" ({qc_summary.sample}) on QualityMetric: {quality_metric}."
#                )
#                continue
#            sample.add_qc_summary(qc_summary)

    def create_qc_display(self):
        for sample in self.sample_mapping.values():
            sample_qc_properties = sample.get_qc_display(
                self.QC_PROPERTIES_TO_KEEP, self.FLAGS_TO_CAPTURE
            )
            if sample_qc_properties:
                self.qc_display.append(sample_qc_properties)


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
            "pass",
            "warn",
            "fail",
        ],
    }
    QC_LINK_SCHEMA = {
        "title": "QC Link",
        "description": "Link for this QC metric",
        "type": "string",
    }

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
            temp["sample_accession"] = sample_info["display_title"]
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
                "properties": {
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
                },
            },
        }
    )
    def quality_control_metrics(self, request, samples=None, processed_files=None):
        """Calculate QC metrics for associated samples."""
        qc_parser = QualityMetricParser(request)
        result = qc_parser.get_qc_display_results(samples, processed_files)
        return result
