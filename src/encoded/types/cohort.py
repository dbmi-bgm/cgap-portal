import structlog

from snovault import (
    calculated_property,
    collection,
    load_schema,
)

from .base import Item, get_item_or_none


log = structlog.getLogger(__name__)


@collection(
    name='cohorts',
    unique_key='accession',
    properties={
        'title': 'Cohorts',
        'description': 'Listing of Cohorts',
    })
class Cohort(Item):
    item_type = 'cohort'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/cohort.json')
    embedded_list = []

    @calculated_property(schema={
        "title": "Display Title",
        "type": "string"
    })
    def display_title(self, request, title=None, accession=None):
        """TODO: handle alternatives when no title available
        """
        result = "Cohort from date"
        if title:
            result = title
        elif accession:
            result = f"Cohort {accession}"
        return result

    def samples(self, sample_processings=None):
        """"""
        result = None
        if sample_processings:
            samples = set()
            for sample_processing_atid in sample_processings:
                sample_processing = get_item_or_none(
                    sample_processing_atid, "sample-processing"
                )
                if sample_processing:
                    samples.update(sample_processing.get("case_samples", []))
                    samples.update(sample_processing.get("control_samples", []))
            if samples:
                result = sorted(list(samples))
        return result

