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
    name='higlass-view-configs',
    unique_key='higlass_view_config:uuid',
    lookup_key='name',
    properties={
        'title': 'HiGlass Displays',
        'description': 'Displays and view configurations for HiGlass',
    })
class HiglassViewConfig(Item):
    """
    Item type which contains a `view_config` property and other metadata.
    """

    item_type = 'higlass_view_config'
    schema = load_schema('encoded:schemas/higlass_view_config.json')
    embedded_list = []
    name_key = 'name'

    
    

