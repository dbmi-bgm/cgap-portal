from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='individuals',
    unique_key='accession',
    properties={
        'title': 'Individuals',
        'description': 'Listing of Individuals',
    })
class Individual(Item):
    item_type = 'individual'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/individual.json')
    rev = {
        'children_f': ('Individual', 'father'),
        'children_m': ('Individual', 'mother'),
        'families': ('Family', 'members'),
        'case': ('Case', 'individual')
    }

    embedded_list = [
        # Individual linkTo
        'father.accession',
        'father.other_id',
        'father.is_deceased',
        'father.sex',

        # Individual linkTo
        'mother.accession',
        'mother.other_id',
        'mother.is_deceased',
        'mother.sex'
    ]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Individual's Identifier",
        "type": "string"
    })
    def display_title(self, request, accession, bgm_id=None, other_id=None):
        """Use bgm_id, other_id, or accession (in that order)"""
        if bgm_id:
            title = bgm_id
        elif other_id:
            title = '%s (%s)' % (other_id['id'], other_id['id_source'])
        else:
            title = accession
        return title

    @calculated_property(schema={
        "title": "Children",
        "description": "Children of the individual",
        "type": "array",
        "items": {
            "title": "Child",
            "type": "string",
            "linkTo": "Individual"
        }
    })
    def children(self, request):
        kids = (self.rev_link_atids(request, "children_f") +
                self.rev_link_atids(request, "children_m"))
        if kids:
            return kids

    @calculated_property(schema={
        "title": "Families",
        "description": "Families this individual is a member of",
        "type": "array",
        "items": {
            "title": "Family",
            "type": "string",
            "linkTo": "Family"
        }
    })
    def families(self, request):
        fams = self.rev_link_atids(request, "families")
        if fams:
            return fams

    @calculated_property(schema={
        "title": "Cases",
        "description": "Cases for this individual",
        "type": "array",
        "items": {
            "title": "Case",
            "type": "string",
            "linkTo": "Case"
        }
    })
    def case(self, request):
        rs = self.rev_link_atids(request, "case")
        if rs:
            return rs
