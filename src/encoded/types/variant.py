import json
from pyramid.view import view_config
from snovault.util import debug_log
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import Item


def build_variant_embedded_list():
    """ Determines the embedded_list based on the information
        present in ./src/encoded/schemas/variant_embeds.json
    """
    embedded_list = []
    with open('./src/encoded/schemas/variant_embeds.json', 'r') as fd:  # XXX: get this some other way
        embeds = json.load(fd)['variant']
        for embedded_type, _embeds in embeds.items():
            embedded_list.extend(_embeds)
    return embedded_list + Item.embedded_list


@collection(
    name='variants',
    properties={
        'title': 'Variants',
        'description': 'List of all variants'
    })
class Variant(Item):
    """ Variant class """

    item_type = 'variant'
    schema = load_schema('encoded:schemas/variant.json')
    # embedded_list = [
    #     'transcript.vep_consequence.definition'  # XXX: Get this info from mapping table
    # ]
    embedded_list = build_variant_embedded_list()

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, CHROM, POS, REF, ALT):
        return 'chr%s:%s %s/%s' % (CHROM, POS, REF, ALT)


@view_config(name='variant_ingestion', context=Variant.Collection,
             request_method='POST', permission='add')
@debug_log
def variant_ingestion(context, request):
    """
        Variant Ingestion API

        Processes all, or none, of a vcf file based on the loaded annotation
        fields and on the variant and variant sample schemas
    """
    # TODO: Implement this when we need it, though practically speaking it probably takes too long to do this way
    # get vcf file
    # build the variants, post a dry run
    # if dry run is successful, run for real
    # catch potential errors
    pass