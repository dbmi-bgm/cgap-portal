"""The type file for annotation field collection."""

from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
    # lab_award_attribution_embed_list
)


@collection(
    name='annotation-fields',
    unique_key='annotation_field:field_name',
    properties={
        'title': 'Annotation Fields',
        'description': 'List of annotation fields',
    })
class AnnotationField(Item):
    """Class for annotation fields."""

    item_type = 'annotation_field'
    name_key = 'field_name'
    schema = load_schema('encoded:schemas/annotation_field.json')

    embedded_list = Item.embedded_list  # + lab_award_attribution_embed_list

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, field_name):
        return field_name


@collection(
    name='variants',
    # unique_key='annotation_field:field_name',
    properties={
        'title': 'Variants',
        'description': 'List of all variants',
    })
class Variant(Item):
    """Class for variants."""

    item_type = 'variant'
    # name_key = 'field_name'
    schema = load_schema('encoded:schemas/variant.json')

    embedded_list = Item.embedded_list  # + lab_award_attribution_embed_list

    # @calculated_property(schema={
    #     "title": "Display Title",
    #     "description": "A calculated title for every object in 4DN",
    #     "type": "string"
    # })
    # def display_title(self, request, field_name):
    #     return field_name


@collection(
    name='variant-samples',
    # unique_key='annotation_field:field_name',
    properties={
        'title': 'Variants (sample)',
        'description': 'List of all variants with sample specific information',
    })
class VariantSample(Item):
    """Class for variant samples."""
    item_type = 'variant_sample'
    # name_key = 'field_name'
    schema = load_schema('encoded:schemas/variant_sample.json')
    embedded_list = Item.embedded_list  # + lab_award_attribution_embed_list
