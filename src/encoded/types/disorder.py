"""Collection for Phenotypes objects."""
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
)
from .evidence import get_evidence_linked_items


@collection(
    name='disorders',
    unique_key='disorder:disorder_id',
    properties={
        'title': 'Disorders',
        'description': 'Listing of Disorders',
    })
class Disorder(Item):
    item_type = 'disorder'
    schema = load_schema('encoded:schemas/disorder.json')
    embedded_list = []
    name_key = 'disorder_id'
    rev = {
        'as_subject_evidence': ('Evidence', 'subject_item'),
        'as_object_evidence': ('Evidence', 'object_item'),
    }

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, disorder_name):
        return disorder_name

    @calculated_property(schema={
        "title": "Phenotypes",
        "description": "Phenotypes associated with this Disorder.",
        "type": "array",
        "items": {
            "title": "Phenotypic Features",
            "type": "string",
            "linkTo": "Phenotype"
        }
    })
    def phenotype_features(self, request):
        evi_as_subj = self.rev_link_atids(request, 'as_subject_evidence')
        return get_evidence_linked_items(request, evi_as_subj, 'object')
