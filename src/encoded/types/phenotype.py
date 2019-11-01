"""Collection for Phenotypes objects."""
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)
from .evidence import get_evidence_linked_items

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
    # rev = {'associated_disorders': ('Disorder', 'associated_phenotypes')}
    embedded_list = [
        'slim_terms.is_slim_for',
        'slim_terms.phenotype_name',
        'parents.hpo_id'
    ]
    name_key = 'hpo_id'
    rev = {
        'as_subject_evidence': ('Evidence', 'subject_item'),
        'as_object_evidence': ('Evidence', 'object_item'),
    }

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, hpo_id, phenotype_name=None):
        if phenotype_name:
            return phenotype_name
        return hpo_id

    @calculated_property(schema={
        "title": "Linked Disorders",
        "description": "Disorders linked to this Phenotye.",
        "type": "array",
        "items": {
            "title": "Linked Disorders",
            "type": "string",
            "linkTo": "Disorder"
        }
    })
    def associated_disorders(self, request):
        evi_as_subj = self.rev_link_atids(request, 'as_object_evidence')
        return get_evidence_linked_items(request, evi_as_subj, 'subject', 'disorder')
