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
    """Evaluate QC values for appropriate flags."""

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
    TRANSITION_TRANSVERSION_WES_WARN_LOWER = 2.3
    TRANSITION_TRANSVERSION_WES_FAIL_LOWER = 2.1

    @classmethod
    def assign_flag(
        cls,
        value,
        fail_upper=None,
        fail_lower=None,
        warn_upper=None,
        warn_lower=None,
        default=QcConstants.FLAG_PASS,
    ):
        """Provide flag for value.

        Note: all boundary values evaluated as strict inequalities.

        :param value: Value to evaluate
        :type value: float
        :param fail_lower: Lower boundary for fail flag
        :type fail_lower: float or None
        :param fail_upper: Upper boundary for fail flag
        :type fail_upper: float or None
        :param warn_upper: Upper boundary for warn flag
        :type warn_upper: float or None
        :param warn_lower: Lower boundary for warn flag
        :type warn_lower: float or None
        :param default: Default flag
        :type default: str
        :return: Flag
        :rtype: str
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
    def flag_bam_coverage(cls, coverage, sample=None, **kwargs):
        """Evaluate BAM coverage for flag.

        :param coverage: BAM coverage from QC item
        :type coverage: str
        :param sample: Sample data
        :type sample: class:`SampleForQc` or None
        :return: Flag name
        :rtype: str or None
        """
        result = None
        coverage_number_string = coverage.lower().rstrip("x")
        coverage = float(coverage_number_string)
        if sample.is_wgs():
            result = cls.assign_flag(
                coverage,
                warn_lower=cls.BAM_COVERAGE_WGS_WARN_LOWER,
                fail_lower=cls.BAM_COVERAGE_WGS_FAIL_LOWER,
            )
        elif sample.is_wes():
            result = cls.assign_flag(
                coverage,
                warn_lower=cls.BAM_COVERAGE_WES_WARN_LOWER,
                fail_lower=cls.BAM_COVERAGE_WES_FAIL_LOWER,
            )
        else:
            log.warning(
                f"Encountered unexpected sequencing type ({sample.workup_type}) while"
                f" evaluating QC metrics for sample: {sample.properties}."
            )
        return result

    @classmethod
    def flag_sex_consistency(cls, predicted_sex, individual=None, **kwargs):
        """Evaluate sex consistency for flag.

        :param predicted_sex: Sex predicted by peddy
        :type predicted_sex: str
        :param individual: Individual data
        :type individual: class:`IndividualForQc` or None
        :return: Flag name
        :rtype: str or None
        """
        result = None
        if predicted_sex:
            submitted_sex = individual.sex
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
    def flag_heterozygosity_ratio(cls, heterozygosity_ratio, **kwargs):
        """Evaluate heterozygosity ratio for flag.

        :param heterozygosity_ratio: Sample SNV heterozygosity ratio
        :type heterozygosity_ratio: str
        :return: Flag name
        :rtype: str or None
        """
        heterozygosity_ratio = float(heterozygosity_ratio)
        result = cls.assign_flag(
            heterozygosity_ratio,
            warn_upper=cls.HETEROZYGOSITY_WARN_UPPER,
            warn_lower=cls.HETEROZYGOSITY_WARN_LOWER,
        )
        return result

    @classmethod
    def flag_transition_transversion_ratio(
        cls, transition_transversion_ratio, sample=None, **kwargs
    ):
        """Evaluate transition-transversion ratio for flag.

        :param transition_transversion_ratio: SNV Ts-Tv ratio
        :type transition_transversion_ratio: str
        :param sample: Sample data
        :type sample: class:`SampleForQc` or None
        :return: Flag name
        :rtype: str or None
        """
        result = None
        transition_transversion_float = float(transition_transversion_ratio)
        if sample.is_wgs():
            result = cls.assign_flag(
                transition_transversion_float,
                fail_upper=cls.TRANSITION_TRANSVERSION_WGS_FAIL_UPPER,
                warn_upper=cls.TRANSITION_TRANSVERSION_WGS_WARN_UPPER,
                warn_lower=cls.TRANSITION_TRANSVERSION_WGS_WARN_LOWER,
                fail_lower=cls.TRANSITION_TRANSVERSION_WGS_FAIL_LOWER,
            )
        elif sample.is_wes():
            result = cls.assign_flag(
                transition_transversion_float,
                fail_upper=cls.TRANSITION_TRANSVERSION_WES_FAIL_UPPER,
                warn_upper=cls.TRANSITION_TRANSVERSION_WES_WARN_UPPER,
                warn_lower=cls.TRANSITION_TRANSVERSION_WES_WARN_LOWER,
                fail_lower=cls.TRANSITION_TRANSVERSION_WES_FAIL_LOWER,
            )
        else:
            log.warning(
                f"Encountered unexpected sequencing type ({sample.workup_type}) while"
                f" evaluating QC metrics for sample: {sample.properties}."
            )
        return result


class QcSummary:
    """Information on single QC value."""

    # Schema constants
    SAMPLE = "sample"
    TITLE = "title"
    VALUE = "value"

    QC_TITLE_TO_FLAG_EVALUATOR = {
        QcConstants.COVERAGE: QcFlagger.flag_bam_coverage,
        QcConstants.PREDICTED_SEX: QcFlagger.flag_sex_consistency,
        QcConstants.HETEROZYGOSITY_RATIO: QcFlagger.flag_heterozygosity_ratio,
        QcConstants.TRANSITION_TRANSVERSION_RATIO: QcFlagger.flag_transition_transversion_ratio,
    }

    def __init__(
        self, properties, completed_process, links=None, title_replacements=None
    ):
        """Constructor method.

        :param properties: QC summary properties
        :type properties: dict
        :param completed_process: QC process for the summary
        :type completed_process: str
        :param links: Potential URL links for summary. Mapping of QC
            titles --> URLs
        :type links: dict or None
        :param title_replacements: Potential replacement titles for
            summary. Mapping of titles --> replacements
        :type title_replacements: dict or None
        """
        self.completed_process = completed_process
        self.value = properties.get(self.VALUE)
        self.sample = properties.get(self.SAMPLE)
        self.title = self.get_qc_title(
            properties.get(self.TITLE, ""), title_replacements
        )
        self.flag = None
        self.link = None
        if links:
            self.link = links.get(self.title)

    def get_qc_title(self, title, title_replacements):
        """Get snake case QC display title, replacing if indicated.

        :param title: QC title from QualityMetric
        :type title: str
        :param title_replacements: Potential replacement titles for
            summary. Mapping of titles --> replacements
        :type title_replacements: dict or None
        :return: QC display title
        :rtype: str
        """
        result = title_to_snake_case(title)
        if title_replacements:
            result = title_replacements.get(result, result)
        return result

    def set_flag(self, sample, individual):
        """Evaluate flag for summary if evaluator exists.

        Updates flag attribute directly.

        :param sample: Sample data
        :type sample: class:`SampleForQc`
        :param individual: Individual data
        :type individual: class:`IndividualForQc`
        """
        flag = None
        evaluator = self.QC_TITLE_TO_FLAG_EVALUATOR.get(self.title)
        if evaluator:
            try:
                flag = evaluator(self.value, sample=sample, individual=individual)
            except Exception:
                log.exception(
                    f"Could not evaluate QC title {self.title}'s value {self.value}."
                )
        self.flag = flag

    def get_qc_display(self):
        """Make summary display for QC report.

        :return: Summary display
        :rtype: dict
        """
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


class ItemProperties:
    """Abstract class to store properties and request."""

    def __init__(self, item_atid, request):
        """Constructor method.

        :param item_atid: Item @id identifier
        :type item_atid: str
        :param request: Web request
        :type request: class:`pyramid.request.Request`
        """
        self.request = request
        self.properties = get_item(request, item_atid)


class QualityMetricForQc(ItemProperties):
    """Abstract class for QualityMetric item data and methods."""

    # Schema constants
    QUALITY_METRIC_SUMMARY = "quality_metric_summary"
    TITLE = "title"
    QC_LIST = "qc_list"
    QC_TYPE = "qc_type"
    VALUE = "value"

    COMPLETED_QC_PROCESS = None
    QC_TITLE_REPLACEMENTS = None

    def __init__(self, quality_metric_atid, request):
        """Constructor method.

        :param quality_metric_atid: Item @id identifier
        :type quality_metric_atid: str
        :param request: Web request
        :type request: class:`pyramid.request.Request`
        """
        super().__init__(quality_metric_atid, request)
        self.quality_metric_summary = self.properties.get(
            self.QUALITY_METRIC_SUMMARY, []
        )
        self.qc_list = self.properties.get(self.QC_LIST, [])

    def collect_qc_summaries(self):
        """Gather all sample-specific QC summaries.

        Add type-specific links for summaries.

        :return: QC summary objects
        :rtype: list[:class:`QcSummary`]
        """
        result = []
        qc_links = self.get_qc_links()
        for summary in self.quality_metric_summary:
            result.append(
                QcSummary(
                    summary,
                    self.COMPLETED_QC_PROCESS,
                    links=qc_links,
                    title_replacements=self.QC_TITLE_REPLACEMENTS,
                )
            )
        return result

    def get_qc_links(self):
        pass


class SnvFinalVcfQc(QualityMetricForQc):

    COMPLETED_QC_PROCESS = "SNV"


class SnvVepVcfQc(QualityMetricForQc):

    PEDDY_QC_STRING = "peddyqc"
    DOWNLOAD_ADD_ON = "@@download"

    def get_qc_links(self):
        """Collect peddy QC links to include for display.

        Identifying presence of peddy QC is fragile here since based
        on string presence.

        :return: Link mapping summary title --> QC URL
        :rtype: dict or None
        """
        result = None
        peddy_qc_atid = None
        for item in self.qc_list:
            qc_type = item.get(self.QC_TYPE)
            if self.PEDDY_QC_STRING in qc_type:
                peddy_qc_atid = item.get(self.VALUE)
                break
        if peddy_qc_atid:
            peddy_qc_download_url = peddy_qc_atid + self.DOWNLOAD_ADD_ON
            result = {
                QcConstants.PREDICTED_SEX: peddy_qc_download_url,
                QcConstants.PREDICTED_ANCESTRY: peddy_qc_download_url,
            }
        return result


class SvFinalVcfQc(QualityMetricForQc):

    COMPLETED_QC_PROCESS = "SV"
    QC_TITLE_REPLACEMENTS = {
        QcConstants.FILTERED_VARIANTS: QcConstants.FILTERED_STRUCTURAL_VARIANTS
    }


class BamQc(QualityMetricForQc):

    COMPLETED_QC_PROCESS = "BAM"


class FileForQc(ItemProperties):
    """File item properties and methods."""

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
        """Constructor method.

        :param file_atid: Item @id identifier
        :type file_atid: str
        :param request: Web request
        :type request: class:`pyramid.request.Request`
        """
        super().__init__(file_atid, request)
        self.file_format = self.properties.get(self.FILE_FORMAT, "")
        self.file_type = self.properties.get(self.FILE_TYPE, "")
        self.vcf_to_ingest = self.properties.get(self.VCF_TO_INGEST, False)
        self.variant_type = self.properties.get(
            self.VARIANT_TYPE, self.VARIANT_TYPE_SNV
        )
        self.quality_metric = self.properties.get(self.QUALITY_METRIC)

    def is_vcf(self):
        """Whether file is a VCF.

        :return: `True` if VCF, `False` otherwise
        :rtype: bool
        """
        return self.file_format == self.VCF_FILE_FORMAT

    def is_bam(self):
        """Whether file is a BAM.

        :return: `True` if BAM, `False` otherwise
        :rtype: bool
        """
        return self.file_format == self.BAM_FILE_FORMAT

    def is_final_vcf(self):
        """Whether file is a final VCF (has variants to ingest).

        :return: `True` if final VCF, `False` otherwise
        :rtype: bool
        """
        return self.is_vcf() and (
            self.file_type == self.FINAL_VCF_FILE_TYPE or self.vcf_to_ingest
        )

    def is_vep_vcf(self):
        """Whether file is a VEP VCF.

        Fragile since no proper metadata property.

        :return: `True` if VEP VCF, `False` otherwise
        :rtype: bool
        """
        return self.is_vcf() and self.VEP_ANNOTATED_STRING in self.file_type.lower()

    def is_snv_final_vcf(self):
        """Whether file is a final SNV VCF.

        :return: `True` if final SNV VCF, `False` otherwise
        :rtype: bool
        """
        return self.variant_type == self.VARIANT_TYPE_SNV and self.is_final_vcf()

    def is_sv_final_vcf(self):
        """Whether file is a final SV VCF.

        :return: `True` if final SV VCF, `False` otherwise
        :rtype: bool
        """
        return self.variant_type == self.VARIANT_TYPE_SV and self.is_final_vcf()

    def get_quality_metric_type(self):
        """Determine appropriate class for associated QualityMetric.

        Prevents unnecessary creation of QualityMetric classes and
        associated sub-requests.

        :return: QualityMetric class, if found
        :rtype: class:`QualityMetricForQc` type or None
        """
        result = None
        if self.is_bam():
            result = BamQc
        elif self.is_vep_vcf():
            result = SnvVepVcfQc
        elif self.is_snv_final_vcf():
            result = SnvFinalVcfQc
        elif self.is_sv_final_vcf():
            result = SvFinalVcfQc
        return result

    def create_quality_metric_for_qc(self, quality_metric_type):
        """Create QualityMetric object for associated quality metric,
        if it exists.

        Pass in the class type instead of calculating since
        get_quality_metric_type presumably already called.

        :param quality_metric_type: Class type to use for obtaining
            QualityMetric data
        :type quality_metric_type: class:`type`
        :return: QualityMetric object
        :rtype: class:`QualityMetricForQc` or None
        """
        result = None
        if quality_metric_type and self.quality_metric:
            result = quality_metric_type(self.quality_metric, self.request)
        return result


class IndividualForQc(ItemProperties):
    """Individual item properties and methods."""

    # Schema constants
    ACCESSION = "accession"
    INDIVIDUAL_ID = "individual_id"
    SEX = "sex"
    ANCESTRY = "ancestry"

    def __init__(self, individual_atid, request):
        """Constructor method.

        :param individual_atid: Item @id identifier
        :type individual_atid: str
        :param request: Web request
        :type request: class:`pyramid.request.Request`
        """
        super().__init__(individual_atid, request)
        self.sex = self.properties.get(self.SEX)


class SampleForQc(ItemProperties):
    """Sample item properties and methods."""

    # Schema constants
    BAM_SAMPLE_ID = "bam_sample_id"
    INDIVIDUAL = "individual"
    PROCESSED_FILES = "processed_files"
    WORKUP_TYPE = "workup_type"
    WORKUP_TYPE_WGS = "WGS"
    WORKUP_TYPE_WES = "WES"
    SPECIMEN_TYPE = "specimen_type"

    def __init__(self, sample_atid, request):
        """Constructor method.

        :param sample_atid: Item @id identifier
        :type sample_atid: str
        :param request: Web request
        :type request: class:`pyramid.request.Request`
        """
        super().__init__(sample_atid, request)
        self.bam_sample_id = self.properties.get(self.BAM_SAMPLE_ID)
        self.workup_type = self.properties.get(self.WORKUP_TYPE)
        self.individual = self.properties.get(self.INDIVIDUAL)
        self.processed_files = self.properties.get(self.PROCESSED_FILES, [])

    def get_quality_metrics(self):
        """Get relevant QualityMetrics.

        Currently, only looking for latest BAM info.

        :return: QualityMetric data classes
        :rtype: list[:class:`QualityMetricForQc`]
        """
        result = []
        for processed_file_atid in self.processed_files[::-1]:  # Most recent last
            processed_file = FileForQc(processed_file_atid, self.request)
            if processed_file.is_bam():
                result.append(processed_file.create_quality_metric_for_qc(BamQc))
                break
        return result

    def is_wgs(self):
        """Whether sample contains WGS data.

        :return: `True` if WGS, `False` otherwise
        :rtype: bool
        """
        return self.workup_type == self.WORKUP_TYPE_WGS

    def is_wes(self):
        """Whether sample contains WES data.

        :return: `True` if WES, `False` otherwise
        :rtype: bool
        """
        return self.workup_type == self.WORKUP_TYPE_WES


class ItemQcProperties:
    """Abstract class for creating QC report properties from an item.

    'Display' properties here refers to those that will eventually be
    used in the QC table on the front-end, so they're formatted
    identically to the data from the QC summaries.

    'Non-display' properties refers to those that are used by front-end
    to create the display table but are not appearing in the table.
    """

    QC_DISPLAY_PROPERTIES = set()  # Format for display similar to QC summaries
    QC_NON_DISPLAY_PROPERTIES = set()  # Not meant for display in QC table
    PROPERTY_REPLACEMENTS = {}

    def __init__(self, item_with_properties):
        """Constructor method.

        :param item_with_properties: Class for item properties
        :type item_with_properties: class:`ItemWithProperties`
        """
        self.item = item_with_properties
        self.item_properties = item_with_properties.properties
        self.qc_properties = {}
        self.update_qc_properties()

    def update_qc_properties(self):
        """Orchestrate update of qc_properties attribute."""
        self.add_non_display_properties()
        self.add_display_properties()

    def add_non_display_properties(self):
        """Move 'non-display' properties to qc_properties."""
        transfer_properties(
            self.item_properties,
            self.qc_properties,
            self.QC_NON_DISPLAY_PROPERTIES,
            property_replacements=self.PROPERTY_REPLACEMENTS,
        )

    def add_display_properties(self):
        """Format and move 'display' properties to qc_properties."""
        properties = copy.deepcopy(self.item_properties)
        for property_name in self.QC_DISPLAY_PROPERTIES:
            property_value = properties.get(property_name)
            if property_value is not None:
                properties[property_name] = {QcConstants.VALUE: property_value}
        transfer_properties(
            properties,
            self.qc_properties,
            self.QC_DISPLAY_PROPERTIES,
            property_replacements=self.PROPERTY_REPLACEMENTS,
        )


class IndividualQcProperties(ItemQcProperties):

    QC_DISPLAY_PROPERTIES = set([IndividualForQc.SEX, IndividualForQc.ANCESTRY])
    QC_NON_DISPLAY_PROPERTIES = set(
        [IndividualForQc.ACCESSION, IndividualForQc.INDIVIDUAL_ID]
    )
    PROPERTY_REPLACEMENTS = {
        IndividualForQc.ACCESSION: QcConstants.INDIVIDUAL_ACCESSION
    }


class SampleQcProperties(ItemQcProperties):

    QC_NON_DISPLAY_PROPERTIES = set(
        [SampleForQc.BAM_SAMPLE_ID, SampleForQc.WORKUP_TYPE, SampleForQc.SPECIMEN_TYPE]
    )
    PROPERTY_REPLACEMENTS = {SampleForQc.WORKUP_TYPE: QcConstants.SEQUENCING_TYPE}


class SampleQcReport:
    """QC data for a single Sample."""

    FLAGS_TO_CAPTURE = set([QcConstants.FLAG_WARN, QcConstants.FLAG_FAIL])
    QC_PROPERTIES_TO_KEEP = (
        set(
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
                QcConstants.COMPLETED_QCS,
            ]
        )
        | FLAGS_TO_CAPTURE
    )  # Should be 1-to-1 with properties in calcprop

    def __init__(self, sample_atid, request):
        """Constructor method.

        :param sample_atid: Item @id identifier
        :type sample_atid: str
        :param request: Web request
        :type request: class:`pyramid.request.Request`
        """
        self.request = request
        self.sample = SampleForQc(sample_atid, request)
        self.individual = IndividualForQc(self.sample.individual, request)
        self.item_qc_properties = [
            SampleQcProperties(self.sample),
            IndividualQcProperties(self.individual),
        ]
        self.qc_report = {}
        self.qc_summaries = []
        self.flags = {}
        self.completed_processes = set([])

    def add_qc_summary(self, qc_summary):
        """Set flag for QC summary item then add to attribute.

        QC summary info will be added to the report for this sample,
        so should be matched by sample identifier already.

        :param qc_summary: Single QC summary from QualityMetric
        :type qc_summary: class:`QcSummary`
        """
        qc_summary.set_flag(self.sample, self.individual)
        self.qc_summaries.append(qc_summary)

    def get_qc_display(self):
        """Orchestrate formation of sample's report.

        Move all information to be displayed in final QC table + all
        information required by front-end to create QC table to
        attribute.

        :return: Sample QC report for SampleProcessing calcprop
        :rtype: dict
        """
        self.record_item_qc_properties()
        self.record_qc_summaries()
        self.record_completed_processes()
        self.record_flag_summaries()
        self.prune_qc_report()
        return self.qc_report

    def record_item_qc_properties(self):
        """Move non-QC summary information to report."""
        for item_qc_properties in self.item_qc_properties:
            self.qc_report.update(item_qc_properties.qc_properties)

    def record_qc_summaries(self):
        """Move QC summary information to report.

        Update flags and completed processes to be moved to report
        afterwards.
        """
        for qc_summary in self.qc_summaries:
            self.qc_report.update(qc_summary.get_qc_display())
            self.update_flags(qc_summary)
            self.update_completed_processes(qc_summary)

    def update_flags(self, qc_summary):
        """Update flags attribute with QC summary info, required.

        Keep track of captured flags to simplify front-end display.

        :param qc_summary: Single QC summary from QualityMetric
        :type qc_summary: class:`QcSummary`
        """
        flag_to_add = qc_summary.flag
        if flag_to_add in self.FLAGS_TO_CAPTURE:
            existing_values = self.flags.get(flag_to_add)
            if existing_values:
                existing_values.add(qc_summary.title)
            else:
                self.flags[flag_to_add] = set([qc_summary.title])

    def update_completed_processes(self, qc_summary):
        """Update completed process with QC summary info, if exists.

        :param qc_summary: Single QC summary from QualityMetric
        :type qc_summary: class:`QcSummary`
        """
        completed_process = qc_summary.completed_process
        if completed_process:
            self.completed_processes.add(completed_process)

    def record_completed_processes(self):
        """Format and move completed processes to report."""
        if self.completed_processes:
            self.qc_report[QcConstants.COMPLETED_QCS] = sorted(
                list(self.completed_processes)
            )

    def record_flag_summaries(self):
        """Format and move captured flags to report."""
        for flag, flagged_qc_titles in self.flags.items():
            self.qc_report[flag] = sorted(list(flagged_qc_titles))

    def prune_qc_report(self):
        """Remove any unexpected properties in report.

        Not strictly required if all set up properly elsewhere, but
        ensures only properties expected in the SampleProcessing
        calcprop schema end up in report.
        """
        keys_to_delete = []
        for qc_property in self.qc_report:
            if qc_property not in self.QC_PROPERTIES_TO_KEEP:
                keys_to_delete.append(qc_property)
        for key_to_delete in keys_to_delete:
            del self.qc_report[key_to_delete]


class QualityMetricParser:
    """Orchestrate creation of QC reports for all Samples."""

    def __init__(self, request):
        """Constructor method

        :param request: Web request
        :type request: class:`pyramid.request.Request`
        """
        self.request = request
        self.quality_metrics = []
        self.sample_mapping = {}

    def get_qc_display_results(self, samples, processed_files):
        """Gather and process all data to make calcprop.

        Top-level method of the class.

        :param samples: Identifiers for Samples associated with
            SampleProcessing
        :type samples: list[str]
        :param processed_files: Identifiers for FileProcessed items
            associated with SampleProcessing
        :type processed_files: list[str]
        :return: QC metrics for all Samples
        :rtype: list[dict]
        """
        result = None
        if samples:
            if processed_files:
                self.collect_quality_metrics(processed_files)
            for sample in samples:
                self.collect_sample_data(sample)
            self.associate_quality_metrics_with_samples()
            qc_display = self.create_qc_display()
            if qc_display:
                result = qc_display
        return result

    def collect_quality_metrics(self, processed_files):
        """Collect QualityMetrics of interest from SampleProcessing.

        Updates `quality_metrics` attribute with `QualityMetricForQc`
        objects.

        :param processed_files: Identifiers for FileProcessed items
            associated with SampleProcessing
        :type processed_files: list[str]
        """
        snv_vcf_found = False
        vep_vcf_found = False
        sv_vcf_found = False
        for processed_file_atid in processed_files[::-1]:  # Most recent files last
            file_item = FileForQc(processed_file_atid, self.request)
            quality_metric_type = file_item.get_quality_metric_type()
            if quality_metric_type is SnvFinalVcfQc:
                if not snv_vcf_found:
                    snv_vcf_found = True
                    self.add_quality_metric(quality_metric_type, file_item)
            elif quality_metric_type is SnvVepVcfQc:
                if not vep_vcf_found:
                    vep_vcf_found = True
                    self.add_quality_metric(quality_metric_type, file_item)
            elif quality_metric_type is SvFinalVcfQc:
                if not sv_vcf_found:
                    sv_vcf_found = True
                    self.add_quality_metric(quality_metric_type, file_item)
            if snv_vcf_found and vep_vcf_found and sv_vcf_found:
                break

    def add_quality_metric(self, quality_metric_type, file_item):
        """Make QualityMetric object and add to attribute, if exists.

        :param quality_metric_type: Class type to use for QualityMetric
            on file
        :type quality_metric_type: class:`type`
        :param file_item: File from which to grab QualityMetric
        :type file_item: class:`FileForQc:
        """
        quality_metric = file_item.create_quality_metric_for_qc(quality_metric_type)
        if quality_metric:
            self.quality_metrics.append(quality_metric)

    def collect_sample_data(self, sample_identifier):
        """Get Sample QualityMetrics and add sample report to sample
        mapping.

        QC summaries are associated with Samples via the bam_sample_id,
        which should practically always exist, but we don't assume so
        here.

        :param sample_identifier: Sample item @id
        :type sample_identifier: str
        :return: Formatted QC metrics for display
        :rtype: list
        """
        sample_report = SampleQcReport(sample_identifier, self.request)
        self.quality_metrics += sample_report.sample.get_quality_metrics()
        sample_id = sample_report.sample.bam_sample_id
        if sample_id:
            self.sample_mapping[sample_id] = sample_report

    def associate_quality_metrics_with_samples(self):
        """Match QC summaries from QualityMetrics with sample reports.

        Log summaries that can't find matches, but not high alert since
        there's no guarantee Files on SampleProcessing were derived
        from the input Samples. Should be correct in majority of cases,
        however.
        """
        for quality_metric in self.quality_metrics:
            qc_summaries = quality_metric.collect_qc_summaries()
            for qc_summary in qc_summaries:
                sample_qc_report = self.sample_mapping.get(qc_summary.sample)
                if sample_qc_report is None:
                    log.info(
                        "Unable to find properties for given sample identifier"
                        f" ({qc_summary.sample}) on QualityMetric:"
                        f" {quality_metric.properties}."
                    )
                    continue
                sample_qc_report.add_qc_summary(qc_summary)

    def create_qc_display(self):
        """Generate final QC metrics for each sample for QC table.

        :return: QC metrics for calcprop
        :rtype: list[dict]
        """
        result = []
        for sample_qc_report in self.sample_mapping.values():
            sample_qc_display = sample_qc_report.get_qc_display()
            if sample_qc_display:
                result.append(sample_qc_display)
        return result


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
    display_pipelines = True

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
                },
            },
        }
    )
    def quality_control_metrics(self, request, samples=None, processed_files=None):
        """Calculate QC metrics for associated samples."""
        qc_parser = QualityMetricParser(request)
        result = qc_parser.get_qc_display_results(samples, processed_files)
        return result
