from snovault import collection, load_schema, calculated_property

from .analysis import AbstractAnalysis


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
class SomaticAnalysis(AbstractAnalysis):
    item_type = "somatic_analysis"
    name_key = "accession"
    schema = load_schema("encoded:schemas/somatic_analysis.json")
    embedded_list = _build_somatic_analysis_embedded_list()
