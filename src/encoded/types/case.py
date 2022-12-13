from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from snovault.util import IndexSettings
from .base import Item, get_item_or_none
from .sample import QcConstants
from ..util import get_item


def _build_family_embeds(*, base_path):
    """Helper function for below method the generates appropriate metadata for family embed.
    Note that we are in a sense "taking Koray's word for it" that this is correct. It's possible that
    these can be pruned/modified for efficiency, but so long as we aren't analyzing a ton of cases
    it shouldn't be a problem.
    """
    return [
        base_path + "." + p
        for p in [
            # Family linkTo
            "*",  # This embeds all Family fields, but not all Family.members fields.
            # Populating relationships
            "relationships.*",
            # Individual linkTo
            "proband.accession",
            "proband.individual_id",
            # Individual linkTo
            "mother.accession",
            "mother.individual_id",
            # Individual linkTo
            "father.accession",
            "father.individual_id",
            # Array of phenotypes linkTo
            "family_phenotypic_features.phenotype_name",
            # Individual linkTo
            "members.*",
            # Case linkTo
            "members.case.case_title",
            "members.case.case_id",
            "members.case.accession",
            "members.case.report",
            "members.case.report.accession",
            "members.case.family",
            "members.case.family.family_id",
            "members.case.individual",
            "members.case.individual.individual_id",
            "members.case.sample_processing",
            "members.case.sample.accession",
            "members.case.sample.workup_type",
            # Sample linkTo
            "members.samples.bam_sample_id",
            "members.samples.sequence_id",
            "members.samples.other_specimen_ids",
            "members.samples.specimen_accession",
            "members.samples.completed_processes",
            "members.samples.library_info",
            "members.samples.workup_type",
            "members.samples.specimen_type",
            "members.samples.specimen_collection_date",
            "members.samples.accession",
            # File linkTo
            "members.samples.processed_files.last_modified.*",
            "members.samples.processed_files.accession",
            # File linkTo
            "members.samples.files.last_modified.*",
            "members.samples.files.file_format.file_format",
            "members.samples.files.accession",
            # TODO review QC
            "members.samples.files.quality_metric",
            "members.samples.files.quality_metric.qc_list.qc_type",
            "members.samples.files.quality_metric.qc_list.value.overall_quality_status",
            "members.samples.files.quality_metric.qc_list.value.url",
            "members.samples.files.quality_metric.qc_list.value.status",
            "members.samples.files.quality_metric.overall_quality_status",
            "members.samples.files.quality_metric.url",
            "members.samples.files.quality_metric.status",
            # TODO Probably don't need all of this; look into
            "analysis_groups.*",
            # Case linkTo
            "analysis_groups.cases.family",
            "analysis_groups.cases.individual",
            "analysis_groups.cases.sample_processing",
            "analysis_groups.cases.case_id",
            # Sample linkTo
            "analysis_groups.cases.sample.accession",
        ]
    ]


def _build_case_embedded_list():
    """Helper function intended to be used to create the embedded list for case.
    All types should implement a function like this going forward.
    """
    return [
        ## Canonical Family, grab UUID and @ID to help ID it within sample_processing.families on UI
        "family.@id",
        "family.uuid",
        # Used for search column
        "family.accession",
        "family.family_id",
        "family.title",
        "family.last_modified.date_modified",
        # Individual linkTo
        "individual.accession",
        "individual.date_created",
        "individual.status",
        "individual.sex",
        "individual.individual_id",
        "individual.is_deceased",
        "individual.is_pregnancy",
        "individual.is_termination_of_pregnancy",
        "individual.is_spontaneous_abortion",
        "individual.is_still_birth",
        "individual.cause_of_death",
        "individual.age",
        "individual.age_units",
        "individual.age_at_death",
        "individual.age_at_death_units",
        "individual.is_no_children_by_choice",
        "individual.is_infertile",
        "individual.cause_of_infertility",
        "individual.ancestry",
        "individual.clinic_notes",
        # Individual linkTo
        "individual.father.accession",
        # TODO fixme samples linkTo
        "individual.father.samples.library_info",
        "individual.father.samples.workup_type",
        "individual.father.samples.accession",
        # Individual linkTo
        "individual.mother.accession",
        # Samples linkTo
        "individual.mother.samples.library_info",
        "individual.mother.samples.workup_type",
        "individual.mother.samples.accession",
        # Phenotype linkTo
        "individual.phenotypic_features.phenotypic_feature.phenotype_name",
        "individual.phenotypic_features.phenotypic_feature.hpo_id",
        "individual.phenotypic_features.onset_age",
        "individual.phenotypic_features.onset_age_units",
        # Samples linkTo
        "individual.samples.status",
        "individual.samples.accession",
        "individual.samples.last_modified.*",
        "individual.samples.specimen_type",
        "individual.samples.specimen_notes",
        "individual.samples.specimen_collection_date",
        "individual.samples.specimen_accession_date",
        "individual.samples.sequencing_date",
        "individual.samples.workup_type",
        "individual.samples.completed_processes",
        # TODO fixme file linkTo
        "individual.samples.processed_files.file_format.file_format",
        "individual.samples.processed_files.accession",
        "individual.samples.processed_files.workflow_run_outputs.display_title",
        # QC
        "individual.samples.processed_files.quality_metric.qc_list.qc_type",
        "individual.samples.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "individual.samples.processed_files.quality_metric.qc_list.value.url",
        "individual.samples.processed_files.quality_metric.qc_list.value.status",
        "individual.samples.processed_files.quality_metric.overall_quality_status",
        "individual.samples.processed_files.quality_metric.url",
        "individual.samples.processed_files.quality_metric.status",
        # File linkTo
        "individual.samples.files.file_format.file_format",
        "individual.samples.files.accession",
        # QC
        "individual.samples.files.quality_metric.qc_list.qc_type",
        "individual.samples.files.quality_metric.qc_list.value.overall_quality_status",
        "individual.samples.files.quality_metric.qc_list.value.url",
        "individual.samples.files.quality_metric.qc_list.value.status",
        "individual.samples.files.quality_metric.overall_quality_status",
        "individual.samples.files.quality_metric.url",
        "individual.samples.files.quality_metric.status",
        # Family linkTo
        "individual.families.uuid",
        # Sample linkTo
        "sample.accession",
        "sample.bam_sample_id",
        "sample.specimen_type",
        "sample.specimen_collection_date",
        "sample.sequencing_date",
        "sample.workup_type",
        "sample.library_info",
        "sample.last_modified.*",
        "sample.completed_processes",
        "sample.indication",
        # File linkTo
        "sample.files.status",
        "sample.files.accession",
        "sample.files.file_format.file_format",
        # FileFormat linkTo
        "sample.processed_files.file_format.file_format",
        # QC
        "sample.processed_files.quality_metric.quality_metric_summary.sample",
        "sample.processed_files.quality_metric.quality_metric_summary.title",
        "sample.processed_files.quality_metric.quality_metric_summary.value",
        "sample.processed_files.quality_metric.quality_metric_summary.numberType",
        # SampleProcessing QC calcprop
        "sample_processing.quality_control_metrics",
        # Sample Processing linkTo
        "sample_processing.analysis_type",
        "sample_processing.analysis_version",
        "sample_processing.last_modified.*",
        "sample_processing.completed_processes",
        "sample_processing.samples_pedigree.*",
        # Sample Processing - Family[] linkTo
        *_build_family_embeds(base_path="sample_processing.families"),
        # Sample linkTo
        "sample_processing.samples.accession",
        "sample_processing.samples.bam_sample_id",
        # File linkTo
        "sample_processing.samples.processed_files.accession",
        "sample_processing.samples.processed_files.file_format.file_format",
        "sample_processing.samples.processed_files.last_modified.*",
        # File linkTo
        "sample_processing.processed_files.file_format.file_format",
        "sample_processing.processed_files.accession",
        "sample_processing.processed_files.variant_type",
        "sample_processing.processed_files.file_type",
        "sample_processing.processed_files.upload_key",
        # File linkTo
        "sample_processing.sample_processed_files.processed_files.accession",
        "sample_processing.sample_processed_files.processed_files.file_format.file_format",
        "sample_processing.sample_processed_files.processed_files.last_modified.*",
        # Sample linkTo
        "sample_processing.sample_processed_files.sample.accession",
        # QC
        "sample_processing.samples.processed_files.quality_metric.*",
        # QC
        "sample_processing.processed_files.quality_metric.*",
        "sample_processing.processed_files.quality_metric.qc_list.value.ancestry and sex prediction",
        "sample_processing.processed_files.quality_metric.qc_list.value.url",
        # Report linkTo
        "report.last_modified.*",
        "report.status",
        "report.accession",
        # "report.case.accession", # This is same as this Item's accession, no?
        # "report.variant_samples.uuid",
        # FilterSet linkTo
        "active_filterset.@id",
        "active_filterset.title",
        "active_filterset_sv.@id",
        "active_filterset_sv.title",
        # FilterSet linkTo
        "cohort.filter_set.*",
        # Project linkTo
        "project.name",
        # File linkTo
        "vcf_file.file_ingestion_status",
        "vcf_file.accession",
        # File linkTo
        "structural_variant_vcf_file.file_ingestion_status",
        "structural_variant_vcf_file.accession",
    ]


@collection(
    name="cases",
    unique_key="accession",
    properties={
        "title": "Cases",
        "description": "Listing of Cases",
    },
)
class Case(Item):
    item_type = "case"
    name_key = "accession"
    schema = load_schema("encoded:schemas/case.json")
    embedded_list = _build_case_embedded_list()

    class Collection(Item.Collection):
        @staticmethod
        def index_settings():
            """Type specific settings for case"""
            return IndexSettings(
                replica_count=2,  # hold 2 copies of this index
                shard_count=2,  # split the index into two shards
                refresh_interval="3s",  # force update every 3 seconds
            )

    @calculated_property(
        schema={
            "title": "Display Title",
            "description": "A calculated title for every object in 4DN",
            "type": "string",
        }
    )
    def display_title(
        self,
        request,
        accession,
        individual=None,
        family=None,
        sample_processing=None,
        case_id=None,
    ):
        title = self.case_title(request, individual, family, sample_processing, case_id)
        if title:
            return title + " ({})".format(accession)
        else:
            return accession

    @calculated_property(
        schema={
            "title": "Sample",
            "description": "Primary sample used for this case",
            "type": "string",
            "linkTo": "Sample",
        }
    )
    def sample(self, request, individual=None, sample_processing=None):
        result = None
        if individual and sample_processing:
            individual_item = get_item(request, individual)
            sample_processing_item = get_item(request, sample_processing)
            individual_samples = individual_item.get("samples", [])
            sample_processing_samples = sample_processing_item.get("samples", [])
            intersection = list(
                set(individual_samples) & set(sample_processing_samples)
            )
            if len(intersection) == 1:
                result = intersection[0]
        return result

    @calculated_property(
        schema={
            "title": "Secondary Families",
            "description": "Secondary families associated with the case",
            "type": "array",
            "items": {
                "title": "Secondary Family",
                "type": "string",
                "linkTo": "Family",
            },
        }
    )
    def secondary_families(self, request, individual=None, family=None):
        """Calculate secondary families for a given case
        family = @id of primary family"""
        result = None
        if individual and family:
            individual_item = get_item(request, individual)
            individual_families = individual_item.get("families", [])
            secondary_families = [
                individual_family
                for individual_family in individual_families
                if individual_family != family
            ]
            if secondary_families:
                result = secondary_families
        return result

    @staticmethod
    def get_vcf_from_sample_processing(request, sample_processing_atid, variant_type):
        """Retrieve VCF for ingestion of given variant type.

        For backwards compatibility, assume variant type of SNV if none
        provided.
        """
        vcf_file = None
        sample_processing = get_item_or_none(
            request, sample_processing_atid, "sample-processings"
        )
        if sample_processing:
            processed_files = sample_processing.get("processed_files", [])
            for processed_file in processed_files[::-1]:  # Take last in list (~newest)
                file_data = get_item_or_none(request, processed_file, "files-processed")
                file_type = file_data.get("file_type", "")
                file_vcf_to_ingest = file_data.get("vcf_to_ingest", False)
                file_variant_type = file_data.get("variant_type", "SNV")
                if (
                    file_type == "full annotated VCF" or file_vcf_to_ingest is True
                ) and file_variant_type == variant_type:
                    vcf_file = file_data["@id"]
                    break
        return vcf_file

    @calculated_property(
        schema={
            "title": "SNV VCF File",
            "description": "VCF file that will be used in SNV variant digestion",
            "type": "string",
            "linkTo": "File",
        }
    )
    def vcf_file(self, request, sample_processing=None):
        """
        Map the SNV vcf file to be digested.
        """
        vcf_file = None
        variant_type = "SNV"
        if sample_processing:
            vcf_file = self.get_vcf_from_sample_processing(
                request, sample_processing, variant_type
            )
        return vcf_file

    @calculated_property(
        schema={
            "title": "SV VCF File",
            "description": "VCF file that will be used in SV variant digestion",
            "type": "string",
            "linkTo": "File",
        }
    )
    def structural_variant_vcf_file(self, request, sample_processing=None):
        """
        Map the SV vcf file to be digested.
        """
        sv_vcf_file = None
        variant_type = "SV"
        if sample_processing:
            sv_vcf_file = self.get_vcf_from_sample_processing(
                request, sample_processing, variant_type
            )
        return sv_vcf_file

    @calculated_property(
        schema={
            "title": "CNV VCF File",
            "description": "VCF file that will be used in CNV ingestion",
            "type": "string",
            "linkTo": "File",
        }
    )
    def cnv_vcf_file(self, request, sample_processing=None):
        """Map the CNV vcf file to be ingested."""
        cnv_vcf_file = None
        variant_type = "CNV"
        if sample_processing:
            cnv_vcf_file = self.get_vcf_from_sample_processing(
                request, sample_processing, variant_type
            )
        return cnv_vcf_file

    @calculated_property(
        schema={
            "title": "Search Query Filter String Add-On",
            "description": "String to be appended to the initial search query to limit variant sample results to those related to this case.",
            "type": "string",
        }
    )
    def initial_search_href_filter_addon(
        self, request, sample_processing=None, individual=None
    ):
        """
        Use vcf file and sample accessions to limit variant/variantsample to this case
        """
        result = None
        if individual and sample_processing:
            sample = self.sample(request, individual, sample_processing)
            vcf = self.vcf_file(request, sample_processing)
            sample_item = get_item(request, sample)
            sample_id = sample_item.get("bam_sample_id")
            if sample_id and vcf:
                vcf_accession = vcf.split("/")[2]
                result = f"CALL_INFO={sample_id}&file={vcf_accession}"
        return result

    @calculated_property(
        schema={
            "title": "Search Query Filter String Add-On For SVs",
            "description": (
                "String to be appended to the initial search query to limit structural"
                " variant sample results to those related to this case."
            ),
            "type": "string",
        }
    )
    def sv_initial_search_href_filter_addon(
        self, request, sample_processing=None, individual=None
    ):
        """
        Use SV and CNV VCF files and sample accessions to limit
        structural variant samples to this case.
        """
        result = None
        if individual and sample_processing:
            sample = self.sample(request, individual, sample_processing)
            sv_vcf = self.structural_variant_vcf_file(request, sample_processing)
            cnv_vcf = self.cnv_vcf_file(request, sample_processing)
            sample_item = get_item(request, sample)
            sample_id = sample_item.get("bam_sample_id")
            if sample_id and any([sv_vcf, cnv_vcf]):
                search_addon = f"CALL_INFO={sample_id}"
                if sv_vcf:
                    sv_vcf_accession = sv_vcf.split("/")[2]
                    search_addon += f"&file={sv_vcf_accession}"
                if cnv_vcf:
                    cnv_vcf_accession = cnv_vcf.split("/")[2]
                    search_addon += f"&file={cnv_vcf_accession}"
                result = search_addon
        return result

    @calculated_property(
        schema={
            "title": "Additional Variant Sample Facets",
            "description": "Additional facets relevant to this case.",
            "type": "array",
            "items": {"title": "Additional Variant Sample Facet", "type": "string"},
        }
    )
    def additional_variant_sample_facets(
        self, request, sample_processing=None, extra_variant_sample_facets=None
    ):
        result = None
        if sample_processing:
            fields = extra_variant_sample_facets or []
            sp_item = get_item(request, sample_processing)
            analysis_type = sp_item.get("analysis_type")
            if analysis_type:
                if analysis_type.endswith("-Trio") or analysis_type.endswith("-Group"):
                    fields.append("inheritance_modes")
                    included_relations = [
                        item.get("relationship")
                        for item in sp_item.get("samples_pedigree", [])
                    ]
                    for relation in [
                        "mother",
                        "father",
                        "sister",
                        "brother",
                        "co-parent",
                        "daughter",
                        "son",
                        "daughter II",
                        "son II",
                        "daughter III",
                        "son III",
                        "sister II",
                        "sister III",
                        "sister IV",
                        "brother II",
                        "brother III",
                        "brother IV",
                    ]:
                        if relation in included_relations:
                            relation = relation.replace(" ", "_").replace("-", "_")
                            fields.append(
                                f"associated_genotype_labels.{relation}_genotype_label"
                            )
                elif analysis_type in ["WGS", "WES"]:  # proband-only analysis types
                    fields.append("proband_only_inheritance_modes")
            if fields:
                result = fields
        return result

    @calculated_property(
        schema={
            "title": "Proband Case",
            "description": "Does this case belong to the proband",
            "type": "boolean",
        }
    )
    def proband_case(self, request, individual=None, family=None):
        if not individual or not family:
            return False
        family_info = get_item_or_none(request, family, "family")
        proband = family_info.get("proband", {})
        if proband == individual:
            return True
        return False

    @calculated_property(
        schema={
            "title": "Case Title",
            "description": "Title of the case",
            "type": "string",
        }
    )
    def case_title(
        self,
        request,
        individual=None,
        family=None,
        sample_processing=None,
        case_id=None,
    ):
        if case_id:
            return case_id
        title = ""
        if not individual or not family:
            return title
        if not sample_processing:
            return title
        family_info = get_item_or_none(request, family, "family")
        proband = family_info.get("proband", {})
        if not proband:
            return title
        proband_case = False
        if proband == individual:
            proband_case = True
        # individual info to get the id, use instition id, if not use accession
        ind_id = ""
        ind_data = get_item_or_none(request, individual, "individual")
        if ind_data.get("individual_id"):
            ind_id = ind_data["individual_id"]
        else:
            ind_id = ind_data["accession"]
        # if individual is not proband, get the id for proband
        pro_id = ""
        if not proband_case:
            pro_data = get_item_or_none(request, proband, "individual")
            if pro_data.get("individual_id"):
                pro_id = pro_data["individual_id"]
            else:
                pro_id = pro_data["accession"]
            # append p for proband
            pro_id += "p"
        sp_data = get_item_or_none(request, sample_processing, "sample-processings")
        analysis = sp_data.get("analysis_type", "missing analysis")
        if proband_case:
            title = "{} {}".format(ind_id, analysis)
        else:
            title = "{} {} - in {}".format(ind_id, analysis, pro_id)
        return title

    @calculated_property(
        schema={
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
    )
    def quality_control_flags(self, request, sample_processing=None):
        """Gather and count QC flags from SampleProcessing."""
        result = None
        if sample_processing:
            sample_processing_item = get_item(request, sample_processing)
            quality_control_metrics = sample_processing_item.get(
                "quality_control_metrics", []
            )
            qc_metrics_collector = CaseQcMetricsCollector(quality_control_metrics)
            result = qc_metrics_collector.get_quality_control_flags()
        return result


class CaseQcMetricsCollector:
    """Create QC metrics for a Case from those for its Samples."""

    def __init__(self, quality_control_metrics):
        """Constructor method.

        :param quality_control_metrics: Sample QC metrics from
            SampleProcessing
        :type quality_control_metrics: list[dict]
        """
        self.quality_control_metrics = quality_control_metrics
        self.overall_flag = None
        self.pass_flag_present = False
        self.fail_count = 0
        self.warn_count = 0
        self.sample_completed_steps = []
        self.completed_steps = []
        self.quality_control_flags = {}

    def get_quality_control_flags(self):
        """Create case QC metrics for calcprop.

        Primary method to call for the class.

        :return: Case QC metrics
        :rtype: dict or None
        """
        result = None
        self.collect_sample_qc_metric_data()
        self.calculate_overall_flag()
        self.calculate_completed_steps()
        self.update_quality_control_flags()
        if self.quality_control_flags:
            result = self.quality_control_flags
        return result

    def collect_sample_qc_metric_data(self):
        """Loop through sample QC metrics once to collect data."""
        for qc_metric in self.quality_control_metrics:
            self.collect_flags(qc_metric)
            self.collect_completed_steps(qc_metric)

    def collect_flags(self, qc_metric):
        """Update flag counts from sample's QC metrics.

        Note: Pass flags not included in SampleProcessing calcprop, so
        need to check for presence on any samples.

        :param qc_metric: Sample QC metrics
        :type qc_metric: dict
        """
        sample_fail_flags = qc_metric.get(QcConstants.FLAG_FAIL, [])
        sample_warn_flags = qc_metric.get(QcConstants.FLAG_WARN, [])
        if (
            not self.pass_flag_present
            and not sample_fail_flags
            and not sample_warn_flags
        ):
            self.pass_flag_present = self.is_pass_flag_present(qc_metric)
        self.fail_count += len(sample_fail_flags)
        self.warn_count += len(sample_warn_flags)

    def is_pass_flag_present(self, qc_metric):
        """Identify if any pass flag present in sample's QC metrics.

        :param qc_metric: Sample QC metrics
        :type qc_metric: dict
        :return: `True` if passing metric present, `False` otherwise
        :rtype: bool
        """
        result = False
        for qc_value in qc_metric.values():
            if isinstance(qc_value, dict):
                flag = qc_value.get(QcConstants.FLAG)
                if flag == QcConstants.FLAG_PASS:
                    result = True
                    break
        return result

    def collect_completed_steps(self, qc_metric):
        """Update attribute with sample's completed QC steps.

        Store while looping through samples for later calculation.

        :param qc_metric: Sample QC metrics
        :type qc_metric: dict
        """
        sample_completed_steps = qc_metric.get(QcConstants.COMPLETED_QCS, [])
        self.sample_completed_steps.append(sample_completed_steps)

    def calculate_overall_flag(self):
        """Update attribute with worst flag across samples."""
        result = None
        if self.fail_count:
            result = QcConstants.FLAG_FAIL
        elif self.warn_count:
            result = QcConstants.FLAG_WARN
        elif self.pass_flag_present:
            result = QcConstants.FLAG_PASS
        self.overall_flag = result

    def calculate_completed_steps(self):
        """Update attribute with completed steps across all samples.

        For typical situations, all samples will have identical QC
        steps.
        """
        case_completed_qcs = set()
        for idx, sample_completed_steps in enumerate(self.sample_completed_steps):
            if idx == 0:
                case_completed_qcs |= set(sample_completed_steps)
            else:
                case_completed_qcs &= set(sample_completed_steps)
        self.completed_steps = sorted(list(case_completed_qcs))

    def update_quality_control_flags(self):
        """Update attribute with properties to display in calcprop."""
        if self.quality_control_metrics:
            result = {
                QcConstants.FLAG_FAIL: self.fail_count,
                QcConstants.FLAG_WARN: self.warn_count,
            }
            if self.overall_flag:
                result[QcConstants.FLAG] = self.overall_flag
            if self.completed_steps:
                result[QcConstants.COMPLETED_QCS] = self.completed_steps
            self.quality_control_flags = result
