from snovault import (
    calculated_property,
    collection,
    load_schema,
    display_title_schema
)
from .base import (
    Item,
    get_item_or_none
)


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
    embedded_list = [
        "individual.accession",
        "individual.father",
        "individual.mother",
        "individual.status",
        "individual.sex",
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
        "individual.phenotypic_features.phenotypic_feature",
        "individual.phenotypic_features.onset_age",
        "individual.phenotypic_features.onset_age_units",
        "individual.samples.status",
        "individual.samples.last_modified.*",
        "individual.samples.specimen_type",
        "individual.samples.specimen_notes",
        "individual.samples.specimen_collection_date",
        "individual.samples.specimen_accession_date",
        "individual.samples.sequencing_date",
        "individual.samples.workup_type",
        "individual.samples.processed_files",
        "individual.samples.processed_files.workflow_run_outputs",
        "individual.samples.processed_files.quality_metric",
        "individual.samples.processed_files.quality_metric.qc_list.qc_type",
        "individual.samples.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "individual.samples.processed_files.quality_metric.qc_list.value.url",
        "individual.samples.processed_files.quality_metric.qc_list.value.status",
        "individual.samples.processed_files.quality_metric.overall_quality_status",
        "individual.samples.processed_files.quality_metric.url",
        "individual.samples.processed_files.quality_metric.status",
        "individual.samples.files.quality_metric",
        "individual.samples.files.quality_metric.qc_list.qc_type",
        "individual.samples.files.quality_metric.qc_list.value.overall_quality_status",
        "individual.samples.files.quality_metric.qc_list.value.url",
        "individual.samples.files.quality_metric.qc_list.value.status",
        "individual.samples.files.quality_metric.overall_quality_status",
        "individual.samples.files.quality_metric.url",
        "individual.samples.files.quality_metric.status",
        "individual.samples.completed_processes",
        "individual.families.uuid",
        "sample_processing.analysis_type",
        "sample_processing.last_modified.*",
        "sample_processing.families.family_id",
        "sample_processing.families.proband.individual_id",
        "sample_processing.families.mother.individual_id",
        "sample_processing.families.father.individual_id",
        "sample_processing.families.accession",
        "sample_processing.samples.accession",
        "sample_processing.samples.specimen_collection_date",
        "sample_processing.samples.sequence_id",
        "sample_processing.samples.other_specimen_ids.*",
        "sample_processing.samples.individual.individual_id",
        "sample_processing.samples.last_modified.*",
        "sample_processing.samples.workup_type",
        "sample_processing.processed_files",
        "sample_processing.processed_files.last_modified.*",
        "sample_processing.processed_files.quality_metric",
        "sample_processing.processed_files.quality_metric.qc_list.qc_type",
        "sample_processing.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "sample_processing.processed_files.quality_metric.qc_list.value.url",
        "sample_processing.processed_files.quality_metric.qc_list.value.status",
        "sample_processing.processed_files.quality_metric.overall_quality_status",
        "sample_processing.processed_files.quality_metric.url",
        "sample_processing.processed_files.quality_metric.status",
        "sample_processing.sample_processed_files",
        "sample_processing.sample_processed_files.processed_files.last_modified.*",
        "sample_processing.sample_processed_files.sample.accession",
        "sample_processing.sample_processed_files.processed_files.quality_metric",
        "sample_processing.sample_processed_files.processed_files.quality_metric.qc_list.qc_type",
        "sample_processing.sample_processed_files.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "sample_processing.sample_processed_files.processed_files.quality_metric.qc_list.value.url",
        "sample_processing.sample_processed_files.processed_files.quality_metric.qc_list.value.status",
        "sample_processing.sample_processed_files.processed_files.quality_metric.overall_quality_status",
        "sample_processing.sample_processed_files.processed_files.quality_metric.url",
        "sample_processing.sample_processed_files.processed_files.quality_metric.status",
        "sample_processing.completed_processes",
        "report.last_modified.*",
        "report.status",
        "family.accession",
        "cohort.filter_set.*"
    ]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, accession, title=None):
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
        if not individual or not family:
            return []
        ind_data = get_item_or_none(request, individual, 'individuals', frame='embedded')
        if not ind_data:
            return []
        individual_families = ind_data.get('families', [])
        secondary_families = [i['@id'] for i in individual_families if i['@id'] != family]
        return secondary_families

    @calculated_property(schema={
        "title": "VCF File",
        "description": "VCF file that will be used in variant digestion",
        "type": "string",
        "linkTo": "File"
    })
    def vcf_file(self, request, sample_processing=None):
        vcf_file = {}
        """Map the vcf file to be digested
        Currently we have a single file on processed_files field of sample processing"""
        if not sample_processing:
            return vcf_file
        sp_data = get_item_or_none(request, sample_processing, 'sample-processings')
        if not sp_data:
            return vcf_file
        files = sp_data.get('processed_files', [])
        if not files:
            return vcf_file
        vcf_file = files[0]
        return vcf_file

    @calculated_property(schema={
        "title": "Filter Set Flag add-on",
        "description": "tag to be added to the filter set flag for limiting search to varants/sample variants from this case",
        "type": "string"
    })
    def filter_set_flag_addon(self, request, sample_processing=None, individual=None):
        """use vcf file and sample accessions to limit variant/variantsample to this case"""
        if not individual or not sample_processing:
            return ''
        sample = self.sample(request, individual, sample_processing)
        if not sample:
            return ''
        vcf = self.vcf_file(request, sample_processing)
        if not vcf:
            return ''
        sample_read_group = sample.get('bam_sample_id', '')
        if not sample_read_group:
            return ''
        vcf_acc = vcf.split('/')[2]
        add_on = "&CALL_INFO={}&file={}".format(sample_read_group, vcf_acc)
        return add_on
