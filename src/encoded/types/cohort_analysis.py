from snovault import calculated_property, collection, load_schema

from .base import Item


@collection(
    name="cohort-analyses",
    properties={
        "title": "CohortAnalyses",
        "description": "Listing of Cohort Analyses",
    },
)
class CohortAnalysis(Item):
    item_type = "cohort_analysis"
    schema = load_schema("encoded:schemas/cohort_analysis.json")
    embedded_list = []

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Cohort analysis display title",
        "type": "string"
    })
    def display_title(self, accession, title=None):
        if title:
            result = f"{title} ({accession})"
        else:
            result = accession
        return result
