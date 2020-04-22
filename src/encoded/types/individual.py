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
    rev = {'children_f': ('Individual', 'father'),
           'children_m': ('Individual', 'mother')}

    embedded_list = [
        'father.is_deceased',
        'father.sex',
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
        return (self.rev_link_atids(request, "children_f") +
                self.rev_link_atids(request, "children_m"))
