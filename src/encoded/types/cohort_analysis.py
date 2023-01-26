from typing import Optional, Sequence
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
    embedded_list = AbstractAnalysis.embedded_list + _build_cohort_analysis_embedded_list()

    @calculated_property(
        schema={
            "title": "Samples",
            "description": "The samples used in the analysis",
            "type": "array",
            "items": {
                "type": "string",
                "linkTo": "Sample",
            },
        }
    )
    def samples(
        self,
        case_samples: Optional[Sequence[str]] = None,
        control_samples: Optional[Sequence[str]] = None
    ):
        """Collects all samples used in the analysis"""
        if case_samples or control_samples:
            result = []
            result.extend(case_samples or [])
            result.extend(control_samples or [])
            return result
