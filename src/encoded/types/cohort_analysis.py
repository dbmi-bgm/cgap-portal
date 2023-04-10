from typing import List

from snovault import collection, load_schema

from .analysis import Analysis


def _build_cohort_analysis_embedded_list() -> List[str]:
    return []


@collection(
    name="cohort-analyses",
    unique_key="accession",
    properties={
        "title": "CohortAnalyses",
        "description": "Listing of Cohort Analyses",
    },
)
class CohortAnalysis(Analysis):
    item_type = "cohort_analysis"
    name_key = "accession"
    schema = load_schema("encoded:schemas/cohort_analysis.json")
    embedded_list = Analysis.embedded_list + _build_cohort_analysis_embedded_list()
