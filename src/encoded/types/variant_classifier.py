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
    name='variant-classifiers',
    unique_key='variant_classifier:varclass_id',
    lookup_key='variant_class',
    properties={
        'title': 'Variant Classifiers',
        'description': 'Listing of Variant Classifiers',
    })
class VariantClassifier(Item):
    """The VariantClassifier class that stores SO terms used to classify variants."""

    item_type = 'variant_classifier'
    schema = load_schema('encoded:schemas/variant_classifier.json')
    embedded_list = []
    name_key = 'varclass_id'

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, variant_class):
        return variant_class.capitalize().replace('_', ' ')
