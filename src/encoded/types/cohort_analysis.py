from snovault import calculated_property, collection, load_schema

from .analysis import AbstractAnalysis


def _build_cohort_analysis_embedded_list():
    return []


@collection(
    name="cohort-analyses",
    properties={
        "title": "CohortAnalyses",
        "description": "Listing of Cohort Analyses",
    },
)
class CohortAnalysis(AbstractAnalysis):
    item_type = "cohort_analysis"
    name_key = "accession"
    schema = load_schema("encoded:schemas/cohort_analysis.json")
    embedded_list = _build_cohort_analysis_embedded_list()
