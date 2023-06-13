from typing import List, Optional, Union

from snovault import (
    calculated_property,
    collection,
    display_title_schema,
    load_schema,
)

from .base import Item
from ..util import JsonObject


def _build_individual_embedded_list() -> List[str]:
    return [
        # Individual linkTo
        "father.accession",
        "father.is_deceased",
        "father.sex",
        # Individual linkTo
        "mother.accession",
        "mother.is_deceased",
        "mother.sex",
    ]


@collection(
    name="individuals",
    unique_key="accession",
    properties={
        "title": "Individuals",
        "description": "Listing of Individuals",
    },
)
class Individual(Item):
    item_type = "individual"
    name_key = "accession"
    schema = load_schema("encoded:schemas/individual.json")
    rev = {
        "children_f": ("Individual", "father"),
        "children_m": ("Individual", "mother"),
        "families": ("Family", "members"),
        "case": ("Case", "individual"),
    }
    embedded_list = _build_individual_embedded_list()

    @calculated_property(schema=display_title_schema)
    def display_title(self, accession: str, individual_id: Optional[str] = None) -> str:
        return individual_id or accession

    @calculated_property(
        schema={
            "title": "Children",
            "description": "Children of the individual",
            "type": "array",
            "items": {"title": "Child", "type": "string", "linkTo": "Individual"},
        }
    )
    def children(self, request):
        kids = self.rev_link_atids(request, "children_f") + self.rev_link_atids(
            request, "children_m"
        )
        if kids:
            return kids

    @calculated_property(
        schema={
            "title": "Families",
            "description": "Families this individual is a member of",
            "type": "array",
            "items": {"title": "Family", "type": "string", "linkTo": "Family"},
        }
    )
    def families(self, request):
        fams = self.rev_link_atids(request, "families")
        if fams:
            return fams

    @calculated_property(
        schema={
            "title": "Cases",
            "description": "Cases for this individual",
            "type": "array",
            "items": {"title": "Case", "type": "string", "linkTo": "Case"},
        }
    )
    def case(self, request):
        rs = self.rev_link_atids(request, "case")
        if rs:
            return rs

    @calculated_property(
        schema={
            "title": "Primary Disorders",
            "description": "Primary disorders for the individual",
            "type": "array",
            "items": {
                "title": "Primary Disorder",
                "type": "string",
                "linkTo": "Disorder",
            },
        }
    )
    def primary_disorders(
        self, disorders: Optional[List[JsonObject]] = None
    ) -> Union[List[str], None]:
        if disorders:
            primary_disorders = set()
            for disorder_metadata in disorders:
                disorder = disorder_metadata.get("disorder")
                if disorder and disorder_metadata.get("is_primary_diagnosis"):
                    primary_disorders.add(disorder)
            if primary_disorders:
                return sorted(list(primary_disorders))
