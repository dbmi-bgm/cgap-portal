import json
from pyramid.view import view_config
from snovault.util import debug_log
from encoded.util import resolve_file_path
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
    get_item_if_you_can,
)


def extend_embedded_list(embedded_list, fd, typ, prefix=None):
    """ Extends the given embedded list with embeds from fd. Helper method for
        building embedded lists from files, used for Variant and Variant Sample
        (and gene in the future).

        :param embedded_list: embedded_list to extend
        :param fd: (open) file descriptor to read JSON from
        :param typ: lowercase snake_case item type
        :param prefix: prefix to add to every embed (if you are embedding another item's embeds)
        :raises RuntimeError: if bad type is detected for the given fd ie: you try to get variant embeds from
                              variant_sample_embeds.json
    """
    embeds = json.load(fd).get(typ, None)
    if embeds is None:
        raise RuntimeError('Bad type %s passed to create_embedded_list from file %s' % (typ, fd))
    if prefix is None:
        for _, _embeds in embeds.items():
            embedded_list.extend(_embeds)
    else:
        for _, _embeds in embeds.items():
            embedded_list.extend(prefix + e for e in _embeds)


def build_variant_embedded_list():
    """ Determines the embedded_list based on the information
        present in ./src/encoded/schemas/variant_embeds.json

        :returns: list of variant embeds
    """
    embedded_list = []
    with open(resolve_file_path('schemas/variant_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'variant')
    return embedded_list + Item.embedded_list


def build_variant_sample_embedded_list():
    """ Determines the embedded list for variants within variant_sample
        ie: variant.* is not sufficient for things embedded into variant
        that we'd like to search on in the variant_sample context. Works
        very similary to the above function

        :returns: list of embeds from 'variant' linkTo
    """
    embedded_list = []
    with open(resolve_file_path('schemas/variant_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'variant', prefix='variant.')
    with open(resolve_file_path('schemas/variant_sample_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'variant_sample')
    return ['variant.*'] + embedded_list + Item.embedded_list


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
    embedded_list = build_variant_embedded_list()

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, CHROM, POS, REF, ALT):
        return 'chr%s:%s%s>%s' % (CHROM, POS, REF, ALT)  # chr1:504A>T


@collection(
    name='variant-samples',
    properties={
        'title': 'Variants (sample)',
        'description': 'List of all variants with sample specific information',
    })
class VariantSample(Item):
    """Class for variant samples."""

    item_type = 'variant_sample'
    schema = load_schema('encoded:schemas/variant_sample.json')
    embedded_list = build_variant_sample_embedded_list()

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, CALL_INFO, variant=None):
        variant = get_item_if_you_can(request, variant, 'Variant')
        if variant:
            return CALL_INFO + ':' + variant['display_title']  # HG002:chr1:504A>T
        return CALL_INFO

    @calculated_property(schema={
        "title": "AD_REF",
        "description": "Reference AD",
        "type": "integer"
    })
    def AD_REF(self, AD):
        if AD:
            return int(AD.split(',')[0])
        return -1

    @calculated_property(schema={
        "title": "AD_ALT",
        "description": "Alternate AD",
        "type": "integer"
    })
    def AD_ALT(self, AD):
        if AD:
            return int(AD.split(',')[1])
        return -1

    @calculated_property(schema={
        "title": "AF",
        "description": "Allele Frequency",
        "type": "number"
    })
    def AF(self, AD):
        if AD:
            ref, alt = AD.split(',')
            return round(int(alt) / (int(ref) + int(alt)), 3)  # round to 3 digits
        return 0.0


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
