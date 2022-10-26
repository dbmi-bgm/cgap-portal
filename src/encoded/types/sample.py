import structlog
from snovault import calculated_property, collection, load_schema

from .base import Item, get_item_or_none
from .family import Family
from ..util import title_to_snake_case


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


class QualityMetricParser:

    # Schema constants
    FILE_FORMAT = "file_format"
    FILE_TYPE = "file_type"
    VCF_TO_INGEST = "vcf_to_ingest"
    VARIANT_TYPE = "variant_type"
    SNV_VARIANT_TYPE = "SNV"
    SV_VARIANT_TYPE = "SV"
    QC_LIST = "qc_list"
    QC_TYPE = "qc_type"
    VALUE = "value"
    INDIVIDUAL = "individual"
    PROCESSED_FILES = "processed_files"
    WORKUP_TYPE = "workup_type"
    WGS = "WGS"
    WES = "WES"
    BAM_SAMPLE_ID = "bam_sample_id"
    QUALITY_METRIC = "quality_metric"
    QUALITY_METRIC_SUMMARY = "quality_metric_summary"
    TITLE = "title"
    SAMPLE = "sample"
    INDIVIDUAL_ID = "individual_id"
    MALE = "male"
    FEMALE = "female"
    ANCESTRY = "ancestry"
    SEX = "sex"

    # Class constants
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
    LINK = "link"
    DOWNLOAD_ADD_ON = "@@download"
    FINAL_VCF_FILE_TYPE = "full annotated VCF"
    FLAG = "flag"
    FLAG_PASS = "pass"
    FLAG_WARN = "warn"
    FLAG_FAIL = "fail"
    BAM_FILE_FORMAT_ATID = "/file-formats/bam/"
    VCF_FILE_FORMAT_ATID = "/file-formats/vcf_gz/"
    VEP_ANNOTATED_STRING = "vep-annotated"
    PEDDY_QC_STRING = "peddyqc"

    SIMPLE_SAMPLE_PROPERTIES = [BAM_SAMPLE_ID, WORKUP_TYPE]
    SIMPLE_INDIVIDUAL_PROPERTIES = [INDIVIDUAL_ID]
    DISPLAY_INDIVIDUAL_PROPERTIES = [SEX, ANCESTRY]
    DISPLAY_BAM_PROPERTIES = [COVERAGE, TOTAL_READS]
    DISPLAY_SNV_FINAL_VCF_PROPERTIES = [FILTERED_VARIANTS]
    DISPLAY_SV_FINAL_VCF_PROPERTIES = [FILTERED_STRUCTURAL_VARIANTS]
    DISPLAY_SNV_VEP_VCF_PROPERTIES = [
        TOTAL_VARIANTS_CALLED,
        HETEROZYGOSITY_RATIO,
        TRANSITION_TRANSVERSION_RATIO,
        DE_NOVO_FRACTION,
        PREDICTED_SEX,
        PREDICTED_ANCESTRY,
    ]
    SIMPLE_QUALITY_METRIC_PROPERTIES = [VALUE]
    SAMPLE_PROPERTIES_TO_KEEP = set([BAM_SAMPLE_ID, SEX, ANCESTRY, INDIVIDUAL_ID])
    QC_PROPERTIES_TO_KEEP = set(
        [
            PREDICTED_SEX,
            PREDICTED_ANCESTRY,
            TOTAL_READS,
            COVERAGE,
            TOTAL_VARIANTS_CALLED,
            FILTERED_VARIANTS,
            FILTERED_STRUCTURAL_VARIANTS,
            HETEROZYGOSITY_RATIO,
            TRANSITION_TRANSVERSION_RATIO,
            DE_NOVO_FRACTION,
        ]
    )
    SCHEMA_PROPERTIES = (
        SAMPLE_PROPERTIES_TO_KEEP | QC_PROPERTIES_TO_KEEP | set([FLAG_WARN, FLAG_FAIL])
    )
    ACCEPTED_PREDICTED_SEXES = set([MALE, FEMALE])
    QC_PROPERTY_NAMES_TO_LINKS = {
        PREDICTED_SEX: PEDDY_QC_STRING,
        PREDICTED_ANCESTRY: PEDDY_QC_STRING,
    }
    FLAGS_TO_CAPTURE = set([FLAG_WARN, FLAG_FAIL])

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
        self.processed_files_with_quality_metrics = []
        self.sample_mapping = {}
        self.qc_property_to_evaluator = {
            self.COVERAGE: self.flag_bam_coverage,
            self.PREDICTED_SEX: self.flag_sex_consistency,
            self.HETEROZYGOSITY_RATIO: self.flag_heterozygosity_ratio,
            self.TRANSITION_TRANSVERSION_RATIO: self.flag_transition_transversion_ratio,
            self.DE_NOVO_FRACTION: self.flag_de_novo_fraction,
        }

    def get_item(self, item_atid):
        """Get item from database.

        :param item_atid: Item identifier (usually @id)
        :type item_atid: str
        :return: Item in object view
        :rtype: dict
        """
        item_collection = item_atid.split("/")[0]
        result = get_item_or_none(self.request, item_atid, item_collection)
        if result is None:
            log.exception(f"Could not find expected item for identifer: {item_atid}.")
            result = {}
        return result

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
        final_vcf_found = self.collect_sample_processing_processed_files_data(
            processed_files
        )
        if final_vcf_found and samples:
            result = self.collect_and_process_samples_data(samples)
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
        final_vcf_found = False
        for processed_file_atid in processed_files[::-1]:  # Most recent files last
            file_item = self.get_item(processed_file_atid)
            file_format_atid = file_item.get(self.FILE_FORMAT)
            if file_format_atid != self.VCF_FILE_FORMAT_ATID:
                continue
            file_type = file_item.get(self.FILE_TYPE, "")
            file_vcf_to_ingest = file_item.get(self.VCF_TO_INGEST, False)
            file_variant_type = file_item.get(self.VARIANT_TYPE, self.SNV_VARIANT_TYPE)
            if file_type == self.FINAL_VCF_FILE_TYPE or file_vcf_to_ingest is True:
                if file_variant_type == self.SNV_VARIANT_TYPE:
                    if snv_vcf_found:
                        continue
                    snv_vcf_found = True
                    self.add_to_processed_files(
                        file_item, self.DISPLAY_SNV_FINAL_VCF_PROPERTIES
                    )
                elif file_variant_type == self.SV_VARIANT_TYPE:
                    if sv_vcf_found:
                        continue
                    sv_vcf_found = True
                    property_replacements = {
                        self.FILTERED_VARIANTS: self.FILTERED_STRUCTURAL_VARIANTS
                    }
                    self.add_to_processed_files(
                        file_item,
                        self.DISPLAY_SV_FINAL_VCF_PROPERTIES,
                        property_replacements=property_replacements,
                    )
            elif (
                not vep_vcf_found
                and file_variant_type == self.SNV_VARIANT_TYPE
                and self.VEP_ANNOTATED_STRING in file_type.lower()  # Pretty fragile
            ):
                vep_vcf_found = True
                self.add_to_processed_files(
                    file_item, self.DISPLAY_SNV_VEP_VCF_PROPERTIES
                )
            if snv_vcf_found and sv_vcf_found and vep_vcf_found:
                break
        if snv_vcf_found or sv_vcf_found:
            final_vcf_found = True
        return final_vcf_found

    def add_to_processed_files(
        self, file_item, properties_to_find, property_replacements=None
    ):
        """Add FileProcessed item and its associated QC properties to
        collect to attribute for use once samples collected.

        :param file_item: File properties
        :type file_item: dict
        :param properties_to_find: QC properties to find associated
            with the file
        :type properties_to_find: list
        :param property_replacements: Mapping of QC property names
            to replacement names
        :type property_replacements: dict or None
        """
        self.processed_files_with_quality_metrics.append(
            (file_item, properties_to_find, property_replacements)
        )

    def collect_and_process_samples_data(self, sample_identifiers):
        """Gather sample data, associate QC metrics with samples, and
        format the results.

        :param sample_identifiers: Sample item identifiers
        :type sample_identifiers: list
        :return: Formatted QC metrics for display
        :rtype: list
        """
        for sample_identifier in sample_identifiers:
            self.collect_sample_data(sample_identifier)
        self.associate_file_quality_metrics_with_samples()
        result = self.reformat_sample_mapping_to_schema()
        return result

    def update_simple_properties(self, properties_to_get, item_to_get, item_to_update):
        """Helper function to add key, value pair from one dict to
        another if exists in original.

        :param properties_to_get: Keys to transfer
        :type properties_to_get: list
        :param item_to_get: Dictionary from which to obtain key, value
            pair
        :type item_to_get: dict
        :param item_to_update: Dictionary to update with key, value
            pair
        """
        for property_to_get in properties_to_get:
            property_value = item_to_get.get(property_to_get)
            if property_value is not None:
                item_to_update[property_to_get] = property_value

    def update_display_properties(self, properties_to_get, item_to_get, item_to_update):
        """Helper function to add key, value pair from one dict to
        another (if exists) in formatting expected of calc prop.

        :param properties_to_get: Keys to transfer
        :type properties_to_get: list
        :param item_to_get: Dictionary from which to obtain key, value
            pair
        :type item_to_get: dict
        :param item_to_update: Dictionary to update with key, value
            pair
        """
        for property_to_get in properties_to_get:
            property_value = item_to_get.get(property_to_get)
            if property_value is not None:
                item_to_update[property_to_get] = {self.VALUE: property_value}

    def collect_sample_data(self, sample_identifier):
        """Gather Sample item data required for QC metrics.

        Update attribute with results to use for associating sample
        data with processed file data.

        :param sample_identifier: Sample identifier (@id)
        :type sample_identifier: str
        """
        sample_qc_properties = {}
        sample_item = self.get_item(sample_identifier)
        self.update_simple_properties(
            self.SIMPLE_SAMPLE_PROPERTIES, sample_item, sample_qc_properties
        )
        individual_atid = sample_item.get(self.INDIVIDUAL)
        if individual_atid:
            self.collect_individual_data(individual_atid, sample_qc_properties)
        processed_files = sample_item.get(self.PROCESSED_FILES)
        if processed_files:
            self.collect_sample_processed_files_data(
                processed_files, sample_qc_properties
            )
        bam_sample_id = sample_item.get(self.BAM_SAMPLE_ID)
        if bam_sample_id:
            self.sample_mapping[bam_sample_id] = sample_qc_properties

    def collect_individual_data(self, individual_atid, sample_info):
        """Gather Individual item data required for QC metrics.

        :param individual_atid: Individual identifier
        :type individual_atid: str
        :param sample_info: Sample-specific data to update
        :type sample_info: dict
        """
        individual_item = self.get_item(individual_atid)
        self.update_simple_properties(
            self.SIMPLE_INDIVIDUAL_PROPERTIES, individual_item, sample_info
        )
        self.update_display_properties(
            self.DISPLAY_INDIVIDUAL_PROPERTIES, individual_item, sample_info
        )

    def collect_sample_processed_files_data(self, processed_file_atids, sample_info):
        """Gather FileProcessed data associated with a Sample.

        :param processed_file_atids: FileProcessed identifiers
        :type processed_file_atids: list
        :param sample_info: Sample-specific data to update
        :type sample_info: dict
        """
        for processed_file_atid in processed_file_atids[::-1]:  # Most recent last
            file_item = self.get_item(processed_file_atid)
            file_format = file_item.get(self.FILE_FORMAT)
            if file_format == self.BAM_FILE_FORMAT_ATID:
                self.collect_bam_quality_metric_values(file_item, sample_info)
                break

    def collect_bam_quality_metric_values(self, file_item, sample_info):
        """Gather BAM QC properties.

        :param file_item: BAM file item
        :type file_item: dict
        :param sample_info: Sample-specific data to update
        :type sample_info: dict
        """
        quality_metric_atid = file_item.get(self.QUALITY_METRIC)
        if quality_metric_atid:
            quality_metric_item = self.get_item(quality_metric_atid)
            summary = quality_metric_item.get(self.QUALITY_METRIC_SUMMARY, [])
            for item in summary:
                self.add_qc_property_to_sample_info(
                    sample_info, item, self.DISPLAY_BAM_PROPERTIES
                )

    def add_qc_property_to_sample_info(
        self,
        sample_qc_properties,
        qc_summary_item,
        properties_to_find,
        links=None,
        property_replacements=None,
    ):
        """Add a QC item to sample-specific data if designated for
        inclusion and associated sample exists.

        Rename, add flags, and add links for QC properties as needed.

        :param sample_qc_properties: Sample-specific data
        :type sample_qc_properties: dict
        :param qc_summary_item: QC item to evaluate
        :type qc_summary_item: dict
        :param properties_to_find: QC titles to find
        :type properties_to_find: list
        :param links: Mapping link name --> link URL
        :type links: dict or None
        :param property_replacements: Mapping of QC property names
            to replacement names
        :type property_replacements: dict or None
        """
        summary_title = self.get_qc_summary_title(
            qc_summary_item, property_replacements
        )
        if summary_title in properties_to_find:
            qc_title_properties = {}
            self.update_simple_properties(
                self.SIMPLE_QUALITY_METRIC_PROPERTIES,
                qc_summary_item,
                qc_title_properties,
            )
            if links:
                link_to_add = self.QC_PROPERTY_NAMES_TO_LINKS.get(summary_title)
                link = links.get(link_to_add)
                if link:
                    qc_title_properties[self.LINK] = link
            qc_flag = self.add_flags_for_qc_value(
                sample_qc_properties, summary_title, qc_title_properties.get(self.VALUE)
            )
            if qc_flag:
                qc_title_properties[self.FLAG] = qc_flag
                if qc_flag in self.FLAGS_TO_CAPTURE:
                    self.update_flag_count(qc_flag, summary_title, sample_qc_properties)
            sample_qc_properties[summary_title] = qc_title_properties

    def get_qc_summary_title(self, qc_summary_item, property_replacements):
        """Get QC display title.

        :param qc_summary_item: QC item to evaluate
        :type qc_summary_item: dict
        :param property_replacements: Mapping of QC property names
            to replacement names
        :type property_replacements: dict or None
        :return: QC display title
        :rtype: str
        """
        title = qc_summary_item.get(self.TITLE, "")
        schema_title = title_to_snake_case(title)
        if property_replacements:
            updated_schema_title = property_replacements.get(schema_title)
            if updated_schema_title:
                schema_title = updated_schema_title
        return schema_title

    def update_flag_count(self, flag_level, qc_title, sample_qc_properties):
        """Add QC title to sample-specific flag count.

        :param flag_level: Flag name
        :type flag_level: str
        :param qc_title: QC display title
        :type qc_title: str
        :param sample_qc_properties: Sample-specific data
        :type sample_qc_properties: dict
        """
        existing_flagged_titles = sample_qc_properties.get(flag_level)
        if existing_flagged_titles is None:
            sample_qc_properties[flag_level] = set([qc_title])
        else:
            existing_flagged_titles.add(qc_title)

    def associate_file_quality_metrics_with_samples(self):
        """For each FileProcessed off of the SampleProcessing, get its
        QualityMetric and update sample-specific data with QC metrics.
        """
        for (
            processed_file,
            properties_to_find,
            property_replacements,
        ) in self.processed_files_with_quality_metrics:
            quality_metric_atid = processed_file.get(self.QUALITY_METRIC)
            if quality_metric_atid:
                self.associate_quality_metric_with_sample(
                    quality_metric_atid,
                    properties_to_find,
                    property_replacements=property_replacements,
                )

    def associate_quality_metric_with_sample(
        self, quality_metric_atid, properties_to_find, property_replacements=None
    ):
        """Update sample-specific data with QualityMetric QC items.

        :param quality_metric_atid: QualityMetric identifier
        :type quality_metric_atid: str
        :param properties_to_find: QC titles to find
        :type properties_to_find: list
        :param property_replacements: Mapping of QC property names
            to replacement names
        :type property_replacements: dict or None
        """
        links = None
        quality_metric = self.get_item(quality_metric_atid)
        quality_metric_summary = quality_metric.get(self.QUALITY_METRIC_SUMMARY, [])
        links = self.get_qc_links(quality_metric)
        for item in quality_metric_summary:
            item_sample = item.get(self.SAMPLE)
            sample_props = self.sample_mapping.get(item_sample)
            if sample_props is None:
                log.warning(
                    "Unable to find properties for given sample identifier"
                    f" ({item_sample}) on QualityMetric: {quality_metric}."
                )
                continue
            self.add_qc_property_to_sample_info(
                sample_props,
                item,
                properties_to_find,
                links=links,
                property_replacements=property_replacements,
            )

    def get_qc_links(self, quality_metric):
        """Collect QualityMetric links to include for display.

        :param quality_metric: QualityMetric item
        :type quality_metric: dict
        :return: Link mapping
        :rtype: dict or None
        """
        result = None
        peddy_qc_atid = None
        qc_list = quality_metric.get(self.QC_LIST, [])
        for item in qc_list:
            qc_type = item.get(self.QC_TYPE)
            if self.PEDDY_QC_STRING in qc_type:
                peddy_qc_atid = item.get(self.VALUE)
        if peddy_qc_atid:
            peddy_qc_download_url = peddy_qc_atid + self.DOWNLOAD_ADD_ON
            result = {self.PEDDY_QC_STRING: peddy_qc_download_url}
        return result

    def add_flags_for_qc_value(self, sample_qc_properties, qc_title, qc_value):
        """Flag QC values.

        :param sample_qc_properties: Sample-specific data
        :type sample_qc_properties: dict
        :param qc_title: QC display title
        :type qc_title: str
        :param qc_value: QC value to evaluate
        :type qc_value: str
        :return: Flag for QC value
        :rtype: str or None
        """
        result = None
        evaluator = self.qc_property_to_evaluator.get(qc_title)
        if evaluator:
            try:
                result = evaluator(qc_value, sample_qc_properties)
            except Exception:
                log.exception(f"Could not evaluate QC value: {qc_value}.")
        return result

    def flag_bam_coverage(self, coverage, sample_properties, *args, **kwargs):
        """Evaluate BAM coverage for flag.

        :param coverage: BAM coverage from QC item
        :type coverage: str
        :param sample_properties: Sample-specific data
        :type sample_properties: dict
        :return: Flag name
        :rtype: str or None
        """
        result = None
        sequencing_type = sample_properties.get(self.WORKUP_TYPE)
        coverage_number_string = coverage.lower().rstrip("x")
        coverage = float(coverage_number_string)
        if coverage is not None:
            if sequencing_type == self.WGS:
                warn_limit = 20
                fail_limit = 10
            elif sequencing_type == self.WES:
                warn_limit = 60
                fail_limit = 40
            else:
                warn_limit = 0
                fail_limit = 0
            if coverage >= warn_limit:
                result = self.FLAG_PASS
            elif coverage < fail_limit:
                result = self.FLAG_FAIL
            else:
                result = self.FLAG_WARN
        return result

    def flag_sex_consistency(self, predicted_sex, sample_properties, *args, **kwargs):
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
            result = self.FLAG_WARN
        else:
            submitted_sex = sample_properties.get(self.SEX, {}).get(self.VALUE)
            predicted_sex_lower = predicted_sex.lower()
            predicted_sex_short_form = predicted_sex.upper()[0]
            if predicted_sex_lower not in self.ACCEPTED_PREDICTED_SEXES:
                result = self.FLAG_FAIL
            elif submitted_sex:
                if predicted_sex_short_form == submitted_sex:
                    result = self.FLAG_PASS
                else:
                    result = self.FLAG_WARN
        return result

    def flag_heterozygosity_ratio(self, heterozygosity_ratio, *args, **kwargs):
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
            result = self.FLAG_WARN
        elif heterozygosity_ratio < lower_limit:
            result = self.FLAG_WARN
        else:
            result = self.FLAG_PASS
        return result

    def flag_transition_transversion_ratio(
        self, transition_transversion_ratio, sample_properties, *args, **kwargs
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
        sequencing_type = sample_properties.get(self.WORKUP_TYPE)
        if sequencing_type:
            if sequencing_type == self.WGS:
                fail_upper_limit = 2.3
                warn_upper_limit = 2.1
                warn_lower_limit = 1.8
                fail_lower_limit = 1.6
            elif sequencing_type == self.WES:
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
                    result = self.FLAG_FAIL
                elif transition_transversion_float > warn_upper_limit:
                    result = self.FLAG_WARN
                elif transition_transversion_float > warn_lower_limit:
                    result = self.FLAG_PASS
                elif transition_transversion_float > fail_lower_limit:
                    result = self.FLAG_WARN
                else:
                    result = self.FLAG_FAIL
        return result

    def flag_de_novo_fraction(self, de_novo_fraction, *args, **kwargs):
        """Evaluate de novo fraction for flag.

        :param de_novo_fraction: SNV de novo fraction
        :type de_novo_fraction: str
        :return: Flag name
        :rtype: str or None
        """
        """"""
        result = self.FLAG_PASS
        de_novo_fraction = float(de_novo_fraction)
        upper_limit = 5
        if de_novo_fraction > upper_limit:
            result = self.FLAG_FAIL
        return result

    def reformat_sample_mapping_to_schema(self):
        """Clean up and format sample-specific data to match desired
        output for calcprop.

        :return: Sample-specific QC data
        :rtype: list
        """
        result = []
        for sample_properties in self.sample_mapping.values():
            schema_properties = {}
            self.convert_flag_sets_to_lists(sample_properties)
            for schema_property in self.SCHEMA_PROPERTIES:
                property_value = sample_properties.get(schema_property)
                if property_value is not None:
                    schema_properties[schema_property] = property_value
            if schema_properties:
                result.append(schema_properties)
        return result

    def convert_flag_sets_to_lists(self, sample_properties):
        """Change flag values from sets to lists to meet JSON
        expectations.

        :param sample_properties: Sample-specific data
        :type sample_properties: dict
        """
        for flag_value in self.FLAGS_TO_CAPTURE:
            flagged_properties = sample_properties.get(flag_value)
            if flagged_properties is not None:
                sample_properties[flag_value] = list(flagged_properties)


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
            temp["sample_accession"] = sample_info["display_title"]
            temp["sample_name"] = sample_info.get("bam_sample_id", "")
            if relation_infos:
                relation_info = relation_infos[0]
                temp["relationship"] = relation_info.get("relationship", "")
                if relation_info.get("association", ""):
                    temp["association"] = relation_info.get("association", "")
            samples_pedigree.append(temp)
        return samples_pedigree

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
            "title": "Quality Control Metrics",
            "description": "Select quality control metrics for associated samples",
            "type": "array",
            "items": {
                "title": "Sample Quality Control Metrics",
                "description": "Quality control metrics for associated sample",
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    QualityMetricParser.BAM_SAMPLE_ID: {
                        "title": "Sample Identifier",
                        "description": "Sample identifier used in BAM file",
                        "type": "string",
                    },
                    QualityMetricParser.INDIVIDUAL_ID: {
                        "title": "Individual Identifier",
                        "description": "Individual identifier submitted related to sample",
                        "type": "string",
                    },
                    QualityMetricParser.SEX: {
                        "title": "Sex",
                        "description": "Individual sex submitted for sample",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                        },
                    },
                    QualityMetricParser.PREDICTED_SEX: {
                        "title": "Predicted Sex",
                        "description": "Predicted sex for sample",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                            "link": QC_LINK_SCHEMA,
                            "flag": QC_FLAG_SCHEMA,
                        },
                    },
                    QualityMetricParser.ANCESTRY: {
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
                    QualityMetricParser.PREDICTED_ANCESTRY: {
                        "title": "Predicted Ancestry",
                        "description": "Ancestry predicted for sample",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                            "link": QC_LINK_SCHEMA,
                        },
                    },
                    QualityMetricParser.TOTAL_READS: {
                        "title": "Total Reads",
                        "description": "Total reads in BAM file",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                        },
                    },
                    QualityMetricParser.COVERAGE: {
                        "title": "Coverage",
                        "description": "BAM file coverage",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                            "flag": QC_FLAG_SCHEMA,
                        },
                    },
                    QualityMetricParser.HETEROZYGOSITY_RATIO: {
                        "title": "Heterozygosity Ratio",
                        "description": "SNV heterozygosity ratio for sample",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                            "flag": QC_FLAG_SCHEMA,
                        },
                    },
                    QualityMetricParser.TRANSITION_TRANSVERSION_RATIO: {
                        "title": "Transition-Transversion Ratio",
                        "description": "SNV transition-transversion ratio for sample",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                            "flag": QC_FLAG_SCHEMA,
                        },
                    },
                    QualityMetricParser.DE_NOVO_FRACTION: {
                        "title": "De Novo Fraction",
                        "description": "SNV de novo fraction for sample",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                            "flag": QC_FLAG_SCHEMA,
                        },
                    },
                    QualityMetricParser.TOTAL_VARIANTS_CALLED: {
                        "title": "Total SNV Variants Called",
                        "description": "Total SNVs called prior to filtering",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                        },
                    },
                    QualityMetricParser.FILTERED_VARIANTS: {
                        "title": "Filtered SNV Variants",
                        "description": "Total SNVs after filtering",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                        },
                    },
                    QualityMetricParser.FILTERED_STRUCTURAL_VARIANTS: {
                        "title": "Filtered Structural Variants",
                        "description": "Total SVs after filtering",
                        "type": "object",
                        "properties": {
                            "value": QC_VALUE_SCHEMA,
                        },
                    },
                    QualityMetricParser.FLAG_WARN: {
                        "title": "Warn Flag Properties",
                        "description": "QC metrics with warn flags",
                        "type": "array",
                        "items": {
                            "title": "Warn Flag Property",
                            "description": "QC metric with warning flag",
                            "type": "string",
                        },
                    },
                    QualityMetricParser.FLAG_FAIL: {
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
        result = None
        if samples and processed_files:
            qc_parser = QualityMetricParser(request)
            result = qc_parser.get_qc_display_results(samples, processed_files)
        return result
