from snovault import collection, load_schema, calculated_property
from .base import Item


@collection(
    name='gene-lists',
    properties={
        'title': 'Gene Lists',
        'description': 'Collection of Genes related to a condition'
    }
)
class GeneList(Item):
    """The class to store information about gene lists"""
    item_type = 'gene_list'
    schema = load_schema('encoded:schemas/gene_list.json')
    name_key = 'gene_list'
    embedded_list = []
