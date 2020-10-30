"""The type file for the collection Institution.

was moved here in 4DN to allow a lab/institution member to edit the
lab/institution info at any time
with simplified permissions may potentially move back
"""
from snovault import (
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='institutions',
    unique_key='institution:name',
    properties={
        'title': 'Institutions',
        'description': 'Listing of Institutions',
    })
class Institution(Item):
    """Institution class."""

    item_type = 'institution'
    schema = load_schema('encoded:schemas/institution.json')
    name_key = 'name'
    embedded_list = Item.embedded_list
