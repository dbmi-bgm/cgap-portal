"""Collection for Disorder objects."""
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
)


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

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, disorder_name):
        return disorder_name
