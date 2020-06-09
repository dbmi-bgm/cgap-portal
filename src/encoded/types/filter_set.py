from snovault import collection, load_schema, calculated_property
from .base import Item


@collection(
    name='filter-sets',
    properties={
        'title': 'Filter Sets',
        'description': 'Filter Set for combining multiple queries'
    }
)
class FilterSet(Item):
    """The class to store information about 4DN file formats"""
    item_type = 'filter_set'
    schema = load_schema('encoded:schemas/filter_set.json')
    name_key = 'filter_set'
    embedded_list = []
