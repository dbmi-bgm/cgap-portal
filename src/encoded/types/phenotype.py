"""Collection for Phenotypes objects."""
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='phenotypes',
    unique_key='phenotype:hpo_id',
    lookup_key='phenotype_name',
    properties={
        'title': 'Phenotypes',
        'description': 'Listing of Phenotypes',
    })
class Phenotype(Item):
    """The Phenotype class that holds info on HPO terms."""

    item_type = 'phenotype'
    schema = load_schema('encoded:schemas/phenotype.json')
    embedded_list = [
        'slim_terms.is_slim_for',
        'slim_terms.phenotype_name',
        'parents.hpo_id'
    ]
    name_key = 'hpo_id'

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, hpo_id, phenotype_name=None):
        if phenotype_name:
            return phenotype_name
        return hpo_id
