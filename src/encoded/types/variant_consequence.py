"""Collection for Variant Classifier objects."""
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='variant-consequences',
    unique_key='variant_consequence:var_conseq_id',
    lookup_key='var_conseq_name',
    properties={
        'title': 'Variant Consequences',
        'description': 'Listing of Variant Consequences',
    })
class VariantConsequence(Item):
    """The VariantConsequence class that stores SO terms used to categorize variant consequences."""

    item_type = 'variant_consequence'
    schema = load_schema('encoded:schemas/variant_consequence.json')
    embedded_list = []
    name_key = 'var_conseq_id'

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, var_conseq_name):
        ''' var_conseq_name is a required property '''
        return var_conseq_name.capitalize().replace('_', ' ')
