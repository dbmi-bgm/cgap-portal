from snovault import collection, load_schema, calculated_property

from .base import Item
from ..util import get_item


def _build_somatic_case_embedded_list():
    return []


@collection(
    name="somatic-cases",
    unique_key="accession",
    properties={
        "title": "SomaticCases",
        "description": "Listing of Somatic Cases",
    },
)
class SomaticCase(Item):
    item_type = "somatic_case"
    name_key = "accession"
    schema = load_schema("encoded:schemas/somatic_case.json")
    embedded_list = _build_somatic_case_embedded_list()

    @calculated_property(
        schema={
            "title": "Display Title",
            "description": "The display title for the object",
            "type": "string",
        }
    )
    def display_title(self, request, accession, title=None, individual=None):
        result = accession
        if title:
            result = title
        elif individual:
            individual_item = get_item(individual, request)
            individual_id = individual_item.get("individual_id")
            if individual_id:
                result = f"{individual_id} ({accession})"
        return result
