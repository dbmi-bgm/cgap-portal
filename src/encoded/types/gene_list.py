import structlog
from snovault import (
    calculated_property,
    collection,
    load_schema,
    CONNECTION,
    display_title_schema
)

from .base import Item, get_item_or_none


log = structlog.getLogger(__name__)


@collection(
    name='genes',
    unique_key='gene:ensgid',
    properties={
        'title': 'Genes',
        'description': 'Gene items',
    })
class Gene(Item):
    """Gene class."""
    item_type = 'gene'
    name_key = 'ensgid'  # use the ENSEMBL Gene ID as the identifier
    schema = load_schema('encoded:schemas/gene.json')
    rev = {'gene_lists': ('GeneList', 'genes')}
    embedded_list = [
        'gene_lists.title',
        'interpretation.classification',
        'interpretation.acmg_guidelines',
        'interpretation.conclusion',
        'interpretation.note_text'
    ]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Gene ID",
        "type": "string"
    })
    def display_title(self, gene_symbol):
        return gene_symbol

    @calculated_property(schema={
        "title": "Gene Lists",
        "description": "Gene Lists which this gene is part of",
        "type": "array",
        "items": {
            "title": "Gene List",
            "type": "string",
            "linkTo": "GeneList"
        }
    })
    def gene_lists(self, request):
        result = self.rev_link_atids(request, "gene_lists")
        if result:
            return result


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
