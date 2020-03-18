from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='specimens',
    unique_key='accession',
    properties={
        'title': 'Specimens',
        'description': 'Listing of Specimens',
    })
class Specimen(Item):
    item_type = 'specimen'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/specimen.json')
    rev = {'samples': ('Sample', 'specimen')}
    embedded_list = ['samples.individual.display_title']

    @calculated_property(schema={
        "title": "Samples",
        "description": "Samples (libraries) the specimen was used for",
        "type": "string",
        "linkTo": "Sample"
    })
    def samples(self, request):
        return self.rev_link_atids(request, "samples")
