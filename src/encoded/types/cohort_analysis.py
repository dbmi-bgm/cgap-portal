from snovault import collection, load_schema

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
