import structlog
from snovault import (
    calculated_property,
    collection,
    load_schema,
)

from .base import Item
from ..util import convert_integer_to_comma_string


log = structlog.getLogger(__name__)


def _build_gene_embedded_list():
    """ Helper function intended to be used to create the embedded list for gene """
    return [
        "gene_lists.title",
    ]


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
    embedded_list = _build_gene_embedded_list()

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

    @calculated_property(schema={
        "title": "Start Display",
        "description": "Formatted gene start position in hg38 coordinates",
        "type": "string",
    })
    def start_display(self, spos=None):
        """Create comma-formatted gene start position, if possible.

        :param spos: Starting position
        :type spos: int
        :returns: Formatted display or None
        :rtype: str or None
        """
        return convert_integer_to_comma_string(spos)

    @calculated_property(schema={
        "title": "End Display",
        "description": "Formatted gene end position in hg38 coordinates",
        "type": "string",
    })
    def end_display(self, epos=None):
        """Create comma-formatted gene end position, if possible.

        :param epos: End position
        :type epos: int
        :returns: Formatted display or None
        :rtype: str or None
        """
        return convert_integer_to_comma_string(epos)


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
