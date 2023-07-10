from typing import List

from snovault import collection, load_schema

from .analysis import Analysis


def _build_somatic_analysis_embedded_list() -> List[str]:
    return [
        # My embeds (TODO: delete once switch to doug's) Required for Somatic Analysis Item Page UI
        "samples.@id",
        "samples.display_title",
        "samples.accession",
        "samples.specimen_collection_date",
        # "samples.preservation_type", # Does not actually exist right now... should at some point
        "samples.workup_type",
        "samples.tissue_type",
        "samples.specimen_type",
        "samples.bam_sample_id",
        "samples.sequence_id", # accessioning table only
        "individual.@id",
        "individual.individual_id",
        "individual.display_title",
        "individual.accession",
        "individual.sex",
        "individual.age",
        "individual.age_units",
        "individual.date_created", # TODO: Double check this is acceptable as "accession date"
        "individual.primary_disorders.disorder_name",
        "individual.families.title",
        "individual.families.family_id",
        "individual.families.accession"
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
