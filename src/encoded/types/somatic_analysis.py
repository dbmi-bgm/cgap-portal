from snovault import collection, load_schema, calculated_property

from .base import Item


def _build_somatic_analysis_embedded_list():
    return []


@collection(
    name="somatic-analyses",
    unique_key="accession",
    properties={
        "title": "SomaticAnalysis",
        "description": "Listing of Somatic Analyses",
    },
)
class SomaticAnalysis(Item):
    item_type = "somatic_analysis"
    name_key = "accession"
    schema = load_schema("encoded:schemas/somatic_analysis.json")
    embedded_list = _build_somatic_analysis_embedded_list()

    @calculated_property(
        schema={
            "title": "Display Title",
            "description": "The display title for the object",
            "type": "string",
        }
    )
    def display_title(self, request, accession, title=None):
        result = accession
        if title:
            result = title
        return result
