from snovault import (
    calculated_property,
    collection,
    load_schema,
    CONNECTION,
    COLLECTIONS,
    display_title_schema
)
from snovault.util import debug_log
from .base import (
    Item,
    get_item_if_you_can
)
from pyramid.httpexceptions import HTTPUnprocessableEntity
from pyramid.view import view_config
from datetime import datetime
from dateutil.relativedelta import relativedelta
import structlog


log = structlog.getLogger(__name__)


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
        "individual.samples.specimen_type",
        "individual.samples.specimen_notes",
        "individual.samples.specimen_collection_date",
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
        "sample_processing.samples.accession",
        "sample_processing.processed_files",
        "sample_processing.processed_files.quality_metric",
        "sample_processing.processed_files.quality_metric.qc_list.qc_type",
        "sample_processing.processed_files.quality_metric.qc_list.value.overall_quality_status",
        "sample_processing.processed_files.quality_metric.qc_list.value.url",
        "sample_processing.processed_files.quality_metric.qc_list.value.status",
        "sample_processing.processed_files.quality_metric.overall_quality_status",
        "sample_processing.processed_files.quality_metric.url",
        "sample_processing.processed_files.quality_metric.status",
        "sample_processing.sample_processed_files",
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
