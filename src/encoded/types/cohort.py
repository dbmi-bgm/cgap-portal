import structlog

from snovault import (
    calculated_property,
    collection,
    load_schema,
)

from .base import Item


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
        "description": "Cohort display title",
        "type": "string"
    })
    def display_title(self, accession, title=None):
        if title:
            result = f"{title} ({accession})"
        else:
            result = accession
        return result
