from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='samples',
    unique_key='accession',
    properties={
        'title': 'Samples',
        'description': 'Listing of Samples',
    })
class Sample(Item):
    item_type = 'sample'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/sample.json')
    rev = {'indiv': ('Individual', 'samples')}
    embedded_list = [
        "processed_files.workflow_run_outputs"
    ]

    @calculated_property(schema={
        "title": "Individual",
        "description": "Individual the sample belongs to",
        "type": "string",
        "linkTo": "Individual"
    })
    def individual(self, request):
        indivs = self.rev_link_atids(request, "indiv")
        if indivs:
            return indivs[0]
