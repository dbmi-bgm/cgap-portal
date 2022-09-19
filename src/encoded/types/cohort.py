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
    def display_title(self, accession, title=None):
        """TODO: handle alternatives when no title available
        """
        if title:
            result = f"{title} ({accession})"
        else:
            result = accession
        return result

    @calculated_property(
        schema={
            "title": "Samples",
            "description": "Samples involved in the cohort",
            "type": "array",
            "items": {
                "title": "Sample",
                "type": "string",
                "linkTo": "Sample"
            }
        }
    )
    def samples(self, request, sample_processings=None):
        """"""
        result = None
        if sample_processings:
            samples = set()
            for sample_processing_atid in sample_processings:
                sample_processing = get_item_or_none(request, sample_processing_atid)
                if sample_processing:
                    samples.update(sample_processing.get("case_samples", []))
                    samples.update(sample_processing.get("control_samples", []))
            if samples:
                result = sorted(list(samples))
        return result
