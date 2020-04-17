from snovault import (
    calculated_property,
    collection,
    load_schema,
    display_title_schema
)
from .base import Item


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
        "report.status"
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
