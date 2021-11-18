from snovault import (
    calculated_property,
    collection,
    load_schema,
    # display_title_schema
)
from .base import (
    Item,
    get_item_or_none
)


def _build_family_embeds(*, base_path):
    """ Helper function for below method the generates appropriate metadata for family embed.
        Note that we are in a sense "taking Koray's word for it" that this is correct. It's possible that
        these can be pruned/modified for efficiency, but so long as we aren't analyzing a ton of cases
        it shouldn't be a problem.
    """
    return [base_path + '.' + p for p in [
        # Family linkTo
        "*",  # This embeds all Family fields, but not all Family.members fields.

        # Populating relationships
        "relationships.*",

        # Individual linkTo
        "proband.accession",

        # Array of phenotypes linkTo
        "family_phenotypic_features.phenotype_name",

        # Individual linkTo
        "members.*",
        # We need to have mother and father (or 'parents' maybe eventually) for all members with at least @id.

        # Case linkTo
        "members.case.case_title",
        "members.case.case_id",
        "members.case.accession",
        "members.case.report",
        "members.case.report.accession",
        "members.case.family",
        "members.case.individual",
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
    ]]


def _build_case_embedded_list():
    """ Helper function intended to be used to create the embedded list for case.
        All types should implement a function like this going forward.
    """
    return _build_family_embeds(base_path='family') + [
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

        # Sample Processing linkTo
        "sample_processing.analysis_type",
        "sample_processing.analysis_version",
        "sample_processing.last_modified.*",
        "sample_processing.completed_processes",
        "sample_processing.samples_pedigree.*",

        # Family linkTo
        "sample_processing.families.family_id",
        "sample_processing.families.title",
        "sample_processing.families.accession",
        "sample_processing.families.analysis_groups",

        # Individual linkTo
        "sample_processing.families.proband.accession",
        "sample_processing.families.proband.individual_id",

        # Individual linkTo
        "sample_processing.families.mother.accession",
        "sample_processing.families.mother.individual_id",

        # Individual linkTo
        "sample_processing.families.father.accession",
        "sample_processing.families.father.individual_id",

        # Individual linkTo
        "sample_processing.families.members.accession",
        "sample_processing.families.members.individual_id",

        # Sample linkTo
        "sample_processing.families.members.samples.accession",

        # Case linkTo
        # XXX: should it embed sample processing as well?
        "sample_processing.families.members.case.case_id",
        "sample_processing.families.members.case.report.accession",
        "sample_processing.families.members.case.family.family_id",
        "sample_processing.families.members.case.individual.individual_id",
        "sample_processing.families.members.case.sample.accession",

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
        "report.case.accession",

        # FilterSet LinkTo
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

        # MetaWorkflowRun linkTo
        "meta_workflow_run.meta_workflow.name",
        "meta_workflow_run.meta_workflow.version"
    ]


@collection(
    name='cases',
    unique_key='accession',
    properties={
        'title': 'Cases',
        'description': 'Listing of Cases',
    })
class Case(Item):
    item_type = 'case'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/case.json')
    embedded_list = _build_case_embedded_list()

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, accession, individual=None, family=None, sample_processing=None, case_id=None):
        title = self.case_title(request, individual, family, sample_processing, case_id)
        if title:
            return title + ' ({})'.format(accession)
        else:
            return accession

    @calculated_property(schema={
        "title": "Sample",
        "description": "Primary sample used for this case",
        "type": "string",
        "linkTo": 'Sample'
    })
    def sample(self, request, individual=None, sample_processing=None):
        if not individual or not sample_processing:
            return {}
        ind_data = get_item_or_none(request, individual, 'individuals')
        sp_data = get_item_or_none(request, sample_processing, 'sample-processings')
        ind_samples = ind_data.get('samples', [])
        sp_samples = sp_data.get('samples', [])
        intersection = [i for i in ind_samples if i in sp_samples]
        if not intersection:
            return {}
        if len(intersection) != 1:
            # To Do we need to invoke a validation error
            return {}
        return intersection[0]

    @calculated_property(schema={
        "title": "Secondary Families",
        "description": "Secondary families associated with the case",
        "type": "array",
        "items": {
            "title": "Secondary Family",
            "type": "string",
            "linkTo": "Family"
        }
    })
    def secondary_families(self, request, individual=None, family=None):
        """Calculate secondary families for a given case
        family = @id of primary family"""
        if not individual or not family:
            return []
        ind_data = get_item_or_none(request, individual, 'individuals')
        if not ind_data:
            return []
        individual_families = ind_data.get('families', [])
        secondary_families = [i for i in individual_families if i != family]
        return secondary_families

    @calculated_property(schema={
        "title": "SNV VCF File",
        "description": "VCF file that will be used in SNV variant digestion",
        "type": "string",
        "linkTo": "File"
    })
    def vcf_file(self, request, sample_processing=None):
        """
        Map the SNV vcf file to be digested.
        """
        vcf_file = {}
        if not sample_processing:
            return vcf_file
        sp_data = get_item_or_none(request, sample_processing, 'sample-processings')
        if not sp_data:
            return vcf_file
        files_processed = sp_data.get('processed_files', [])
        if not files_processed:
            return vcf_file
        for file_processed in files_processed[::-1]:  #VCFs usually at/near end of list
            file_data = get_item_or_none(request, file_processed, 'files-processed')
            file_type = file_data.get("file_type", "")
            file_variant_type = file_data.get("variant_type", "")
            if file_type == "full annotated VCF" and file_variant_type != "SV":
                vcf_file = file_data["@id"]
                break
        return vcf_file

    @calculated_property(schema={
        "title": "SV VCF File",
        "description": "VCF file that will be used in SV variant digestion",
        "type": "string",
        "linkTo": "File"
    })
    def structural_variant_vcf_file(self, request, sample_processing=None):
        """
        Map the SV vcf file to be digested.
        """
        sv_vcf_file = {}
        if not sample_processing:
            return sv_vcf_file
        sp_data = get_item_or_none(request, sample_processing, 'sample-processings')
        if not sp_data:
            return sv_vcf_file
        files_processed = sp_data.get('processed_files', [])
        if not files_processed:
            return sv_vcf_file
        for file_processed in files_processed[::-1]:  #VCFs usually at/near end of list
            file_data = get_item_or_none(request, file_processed, 'files-processed')
            file_type = file_data.get("file_type", "")
            file_variant_type = file_data.get("variant_type", "")
            if file_type == "full annotated VCF" and file_variant_type == "SV":
                sv_vcf_file = file_data["@id"]
                break
        return sv_vcf_file

    @calculated_property(schema={
        "title": "Search Query Filter String Add-On",
        "description": "String to be appended to the initial search query to limit variant sample results to those related to this case.",
        "type": "string"
    })
    def initial_search_href_filter_addon(self, request, sample_processing=None, individual=None):
        """
        Use vcf file and sample accessions to limit variant/variantsample to this case
        """
        if not individual or not sample_processing:
            return ''
        sample = self.sample(request, individual, sample_processing)
        if not sample:
            return ''
        vcf = self.vcf_file(request, sample_processing)
        if not vcf:
            return ''
        sp_data = get_item_or_none(request, sample, 'sample')
        sample_read_group = sp_data.get('bam_sample_id', '')
        if not sample_read_group:
            return ''
        vcf_acc = vcf.split('/')[2]
        add_on = "CALL_INFO={}&file={}".format(sample_read_group, vcf_acc)
        return add_on

    @calculated_property(schema={
        "title": "Search Query Filter String Add-On For SVs",
        "description": (
            "String to be appended to the initial search query to limit structural"
            " variant sample results to those related to this case."
        ),
        "type": "string"
    })
    def sv_initial_search_href_filter_addon(
            self, request, sample_processing=None, individual=None
    ):
        """
        Use SV vcf file and sample accessions to limit structural variants/
        structural variant samples to this case.
        """
        if not individual or not sample_processing:
            return ''
        sample = self.sample(request, individual, sample_processing)
        if not sample:
            return ''
        vcf = self.structural_variant_vcf_file(request, sample_processing)
        if not vcf:
            return ''
        sp_data = get_item_or_none(request, sample, 'sample')
        sample_read_group = sp_data.get('bam_sample_id', '')
        if not sample_read_group:
            return ''
        vcf_acc = vcf.split('/')[2]
        add_on = "CALL_INFO={}&file={}".format(sample_read_group, vcf_acc)
        return add_on


    @calculated_property(schema={
        "title": "Additional Variant Sample Facets",
        "description": "Additional facets relevant to this case.",
        "type": "array",
        "items": {
            "title": "Additional Variant Sample Facet",
            "type": "string"
        }
    })
    def additional_variant_sample_facets(self, request, sample_processing=None, extra_variant_sample_facets=[]):
        if not sample_processing:
            return ''
        fields = [facet for facet in extra_variant_sample_facets]
        sp_item = get_item_or_none(request, sample_processing, 'sample_processing')
        analysis_type = sp_item.get('analysis_type')
        if analysis_type:
            if (analysis_type.endswith('-Trio') or analysis_type.endswith('-Group')):
                fields.append('inheritance_modes')
                included_relations = [item.get('relationship') for item in sp_item.get('samples_pedigree', [{}])]
                for relation in ['mother', 'father', 'sister', 'brother', 'co-parent',
                                'daughter', 'son', 'daughter II', 'son II',
                                'daughter III', 'son III', 'sister II',
                                'sister III', 'sister IV', 'brother II',
                                'brother III', 'brother IV']:
                    if relation in included_relations:
                        relation = relation.replace(' ', '_').replace('-', '_')
                        fields.append(f'associated_genotype_labels.{relation}_genotype_label')
            elif analysis_type in ['WGS', 'WES']:  # proband-only analysis types
                fields.append('proband_only_inheritance_modes')
        return fields

    @calculated_property(schema={
        "title": "Proband Case",
        "description": "Does this case belong to the proband",
        "type": "boolean"
    })
    def proband_case(self, request, individual=None, family=None):
        if not individual or not family:
            return False
        family_info = get_item_or_none(request, family, 'family')
        proband = family_info.get('proband', {})
        if proband == individual:
            return True
        return False

    @calculated_property(schema={
        "title": "Case Title",
        "description": "Title of the case",
        "type": "string"
    })
    def case_title(self, request, individual=None, family=None, sample_processing=None, case_id=None):
        if case_id:
            return case_id
        title = ''
        if not individual or not family:
            return title
        if not sample_processing:
            return title
        family_info = get_item_or_none(request, family, 'family')
        proband = family_info.get('proband', {})
        if not proband:
            return title
        proband_case = False
        if proband == individual:
            proband_case = True
        # individual info to get the id, use instition id, if not use accession
        ind_id = ''
        ind_data = get_item_or_none(request, individual, 'individual')
        if ind_data.get('individual_id'):
            ind_id = ind_data['individual_id']
        else:
            ind_id = ind_data['accession']
        # if individual is not proband, get the id for proband
        pro_id = ''
        if not proband_case:
            pro_data = get_item_or_none(request, proband, 'individual')
            if pro_data.get('individual_id'):
                pro_id = pro_data['individual_id']
            else:
                pro_id = pro_data['accession']
            # append p for proband
            pro_id += 'p'
        sp_data = get_item_or_none(request, sample_processing, 'sample-processings')
        analysis = sp_data.get('analysis_type', 'missing analysis')
        if proband_case:
            title = "{} {}".format(ind_id, analysis)
        else:
            title = "{} {} - in {}".format(ind_id, analysis, pro_id)
        return title
