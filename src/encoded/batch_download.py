import csv
import io
import json
import os
import structlog
from math import inf
from urllib.parse import parse_qs, urlparse
from collections import OrderedDict
from itertools import chain
from pyramid.compat import bytes_
from pyramid.httpexceptions import (
    HTTPBadRequest,
    HTTPMovedPermanently,
    HTTPServerError,
    HTTPTemporaryRedirect
)
from base64 import b64decode
from pyramid.view import view_config
from pyramid.request import Request
from pyramid.response import Response
from pyramid.traversal import find_resource
from pyramid.settings import asbool
from snovault import TYPES, calculated_property, collection, load_schema
from snovault.util import simple_path_ids, debug_log
from snovault.calculated import calculate_properties
from snovault.embed import make_subrequest

from encoded.types.base import Item, get_item_or_none
from encoded.types.variant import (
    POPULATION_SUFFIX_TITLE_TUPLES,
    get_spreadsheet_mappings,
    get_fields_to_embed
)
from .custom_embed import CustomEmbed
from .batch_download_utils import stream_tsv_output, convert_item_to_sheet_dict
from .search.compound_search import CompoundSearchBuilder

# from .search import (
#     iter_search_results,
#     build_table_columns,
#     get_iterable_search_results,
#     make_search_subreq
# )





log = structlog.getLogger(__name__)

def includeme(config):
    config.add_route('variant_sample_search_spreadsheet', '/variant-sample-search-spreadsheet/')
    config.scan(__name__)




###########################################################################
## Spreadsheet Generation Code Specific to VariantSample Search Requests ##
###########################################################################



@view_config(route_name='variant_sample_search_spreadsheet', request_method=['GET', 'POST'])
@debug_log
def variant_sample_search_spreadsheet(context, request):
    """
    Returns spreadsheet
    """

    request_body = {}
    try:
        request_body = request.POST
    except:
        try:
            request_body = request.json
        except:
            pass


    file_format = request_body.get("file_format", request.GET.get("file_format", "tsv")).lower()
    if file_format not in { "tsv", "csv" }: # TODO: Add support for xslx.
        raise HTTPBadRequest("Expected a valid `file_format` such as TSV or CSV.")
    suggested_filename = request_body.get("suggested_filename", request.GET.get("suggested_filename", None))
    if not suggested_filename:
        suggested_filename = "variant-sample-filtering." + file_format # TODO: Datetime


    spreadsheet_mappings = get_spreadsheet_mappings(request)

    # TEMPORARY - WE WILL GET THIS FROM POST BODY IN NEAR FUTURE - MUST NOT CONTAIN `limit`
    filterset_blocks_request = {
        "search_type":"VariantSample",
        "global_flags":"CALL_INFO=SAM10254-S1&file=GAPFI3EBH4X2&additional_facet=proband_only_inheritance_modes&sort=date_created",
        "intersect": False,
        "filter_blocks":[
            {
                "query":"associated_genotype_labels.proband_genotype_label=Heterozygous&associated_genelists=Breast+Cancer+%2828%29&variant.genes.genes_most_severe_consequence.impact=MODERATE&variant.genes.genes_most_severe_consequence.impact=HIGH",
                "flags_applied":[]
            },
            {
                "query":"GQ.from=60&GQ.to=99&associated_genotype_labels.proband_genotype_label=Heterozygous&associated_genelists=Familial+Cancer+%28148%29&variant.csq_clinvar_clnsig=Uncertain_significance&variant.csq_clinvar_clnsig=Pathogenic&variant.csq_gnomadg_af.from=0&variant.csq_gnomadg_af.to=0.001&variant.genes.genes_most_severe_consequence.impact=MODERATE&variant.genes.genes_most_severe_consequence.impact=HIGH",
                "flags_applied":[]
            },
            {
                "query":"variant.csq_gnomade2_af.from=0&variant.csq_gnomade2_af.to=0.001&variant.csq_gnomadg_af.from=0&variant.csq_gnomadg_af.to=0.001",
                "flags_applied":[]
            }
        ]
    }

    filter_set = CompoundSearchBuilder.extract_filter_set_from_search_body(request, filterset_blocks_request)
    global_flags = filterset_blocks_request.get('global_flags', None)
    intersect = True if filterset_blocks_request.get('intersect', False) else False

    compound_search_res = CompoundSearchBuilder.execute_filter_set(
        context,
        request,
        filter_set,
        from_=0,
        to="all",
        global_flags=global_flags,
        intersect=intersect,
        return_generator=True
    )

    def variant_samples_gen():
        for embedded_representation_variant_sample in compound_search_res:
            embed_and_merge_note_items_to_variant_sample(request, embedded_representation_variant_sample)
            yield embedded_representation_variant_sample


    return Response(
        app_iter = stream_tsv_output(
            map(
                lambda x: convert_item_to_sheet_dict(x, spreadsheet_mappings),
                variant_samples_gen()
            ),
            spreadsheet_mappings,
            file_format
        ),
        headers={
            'X-Accel-Buffering': 'no',
            'Content-Encoding': 'utf-8',
            'Content-Disposition': 'attachment; filename=' + suggested_filename,
            'Content-Type': 'text/' + file_format,
            'Content-Description': 'File Transfer',
            'Cache-Control': 'no-cache'
        },
        # content_type='text/' + file_format,
        # content_encoding='utf-8',
        # content_disposition='attachment;filename="%s"' % suggested_filename
    )


def embed_and_merge_note_items_to_variant_sample(request, embedded_vs):
    '''
    Important: Modifies `embedded_vs` in-place.

    This function requires that `embedded_vs` contain the below
    `note_containing_fields` with at least a populated `@id` field
    (if present).
    '''
    note_containing_fields = [
        "variant.interpretations",
        "variant.discovery_interpretations",
        "variant.variant_notes",
        "variant.genes.genes_most_severe_gene.gene_notes",
        "interpretation",
        "discovery_interpretation",
        "variant_notes",
        "gene_notes"
    ]
    # TODO: Parallelize?
    for note_field in note_containing_fields:
        for incomplete_note_obj in simple_path_ids(embedded_vs, note_field):
            # Using request.embed instead of CustomEmbed because we're fine with getting from ES (faster)
            # for search-based spreadsheet requests.
            full_embedded_note = request.embed(incomplete_note_obj["@id"])
            incomplete_note_obj.update(full_embedded_note)
