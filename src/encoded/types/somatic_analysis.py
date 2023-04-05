from typing import List

from snovault import collection, load_schema

from .analysis import Analysis


def _build_somatic_analysis_embedded_list() -> List[str]:
    return [
        "samples.@id",
        "samples.display_title",
        "samples.tissue_type",
        "samples.specimen_type",
        "samples.bam_sample_id",
        "samples.individual.@id",
        "samples.individual.display_title",
        "samples.individual.accession",
        "samples.individual.sex",
        "samples.individual.age",
        "samples.individual.age_units",
        "samples.individual.date_created", # TODO: Double check this is acceptable as "accession date"
        "samples.individual.disorders.disorder.display_title",
        "samples.individual.disorders.is_primary_diagnosis"
    ]


@collection(
    name="somatic-analyses",
    unique_key="accession",
    properties={
        "title": "SomaticAnalysis",
        "description": "Listing of Somatic Analyses",
    },
)
class SomaticAnalysis(Analysis):
    item_type = "somatic_analysis"
    name_key = "accession"
    schema = load_schema("encoded:schemas/somatic_analysis.json")
    embedded_list = Analysis.embedded_list + _build_somatic_analysis_embedded_list()
