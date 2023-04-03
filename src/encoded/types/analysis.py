from typing import List, Optional

from snovault import (
    abstract_collection,
    calculated_property,
    display_title_schema,
    load_schema,
)

from .base import Item


def _build_analysis_embedded_list() -> List[str]:
    return []


@abstract_collection(
    name="analyses",
    unique_key="accession",
    properties={
        "title": "Analyses",
        "description": "Listing of Analyses",
    },
)
class Analysis(Item):

    item_type = "analysis"
    base_types = ["Analysis"] + Item.base_types
    schema = load_schema("encoded:schemas/analysis.json")
    name_key = "accession"
    embedded_list = _build_analysis_embedded_list()

    @calculated_property(schema=display_title_schema)
    def display_title(
        self, accession: str, external_identifier: Optional[str] = None
    ) -> str:
        if external_identifier:
            result = external_identifier
        else:
            result = accession
        return result
