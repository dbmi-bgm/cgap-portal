from snovault import collection, load_schema, calculated_property
from .base import Item


# XXX: These constants could be defined on CompoundSearchBuilder, but thought they may be
#      more useful here/more logically belong. - Will
FLAGS = 'flags'
FILTER_BLOCKS = 'filter_blocks'


@collection(
    name='filter-sets',
    unique_key='nexus:title',
    properties={
        'title': 'Filter Sets',
        'description': 'Filter Set for combining multiple queries'
    }
)
class FilterSet(Item):
    """The class to store information about 4DN file formats"""
    item_type = 'filter_set'
    schema = load_schema('encoded:schemas/filter_set.json')
    embedded_list = []
