from typing import List

from snovault import collection, load_schema

from .analysis import Analysis


def _build_somatic_analysis_embedded_list() -> List[str]:
    return [
        # Required for Somatic Analysis Item Page UI
        "samples.@id",
        "samples.display_title",
        "samples.accession",
        "samples.specimen_collection_date",
        "samples.preservation_type",
        "samples.workup_type",
        "samples.tissue_type",
        "samples.specimen_type",
        "samples.bam_sample_id",
        "samples.sequence_id", # accessioning table only
        "samples.individual.@id",
        "samples.individual.individual_id",
        "samples.individual.display_title",
        "samples.individual.accession",
        "samples.individual.sex",
        "samples.individual.age",
        "samples.individual.age_units",
        "samples.individual.date_created", # TODO: Double check this is acceptable as "accession date"
        "samples.individual.disorders.disorder.display_title",
        "samples.individual.disorders.is_primary_diagnosis",
        "samples.individual.family.title",
        "samples.individual.family.family_id",
        "samples.individual.family.accession",
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
