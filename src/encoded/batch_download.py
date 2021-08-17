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
    get_spreadsheet_mappings
)
from .custom_embed import CustomEmbed

# from .search import (
#     iter_search_results,
#     build_table_columns,
#     get_iterable_search_results,
#     make_search_subreq
# )





log = structlog.getLogger(__name__)

def includeme(config):
    config.add_route('variant_sample_list_spreadsheet', '/variant-sample-list-spreadsheet/')
    config.scan(__name__)




##############################
### Spreadsheet Generation ###
##############################


def get_values_for_field(item, field, remove_duplicates=True):
    """Copied over from 4DN / batch_download / metadata.tsv endpoint code"""
    c_value = []

    if remove_duplicates:
        for value in simple_path_ids(item, field):
            str_value = str(value)
            if str_value not in c_value:
                c_value.append(str_value)
    else:
        for value in simple_path_ids(item, field):
            c_value.append(str(value))

    return ", ".join(c_value)


def convert_item_to_sheet_dict(item, spreadsheet_mappings):
    '''
    We assume we have @@embedded representation of Item here
    that has all fields required by spreadsheet_mappings, either
    through an /embed request or @@embedded representation having
    proper embedded_list.
    '''

    if not "@id" in item:
        return None

    sheet_dict = {} # OrderedDict() # Keyed by column title. Maybe OrderedDict not necessary now..

    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        if cgap_field_or_func is None: # Skip
            continue

        is_field_str = isinstance(cgap_field_or_func, str)

        if not is_field_str: # Assume render or custom-logic function
            sheet_dict[column_title] = cgap_field_or_func(item)
        else:
            sheet_dict[column_title] = get_values_for_field(item, cgap_field_or_func)

    return sheet_dict




class Echo(object):
    def write(self, line):
        return line.encode("utf-8")



def stream_tsv_output(dictionaries_iterable, spreadsheet_mappings, file_format = "tsv"):
    '''
    Generator which converts iterable of column:value dictionaries into a TSV stream.
    :param dictionaries_iterable: Iterable of dictionaries, each containing TSV_MAPPING keys and values from a file in ExperimentSet.
    '''
    writer = csv.writer(Echo(), delimiter= "\t" if file_format == "tsv" else ",")

    # Initial 2 lines: Intro, Headers
    # writer.writerow([
    #     '###', 'N.B.: File summary located at bottom of TSV file.', '', '', '', '',
    #     'Suggested command to download: ', '', '', 'cut -f 1 ./{} | tail -n +3 | grep -v ^# | xargs -n 1 curl -O -L --user <access_key_id>:<access_key_secret>'.format(filename_to_suggest)
    # ])
    # yield line.read().encode('utf-8')

    # Headers (column title)
    title_headers = []
    description_headers = []
    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        title_headers.append(column_title)
        description_headers.append(description)
    title_headers[0] = "## " + title_headers[0] # Add comment hash in case people using this spreadsheet file programmatically.
    description_headers[0] = "## " + description_headers[0] # Add comment hash in case people using this spreadsheet file programmatically.

    yield writer.writerow(title_headers)
    yield writer.writerow(description_headers)

    del title_headers
    del description_headers

    for vs_dict in dictionaries_iterable:
        if vs_dict is None: # No view permissions (?)
            row = [ "" for sm in spreadsheet_mappings ]
            row[0] = "# Not Available"
            yield writer.writerow(row)
        else:
            print("Printing", vs_dict)
            yield writer.writerow([ vs_dict.get(sm[0]) or "" for sm in spreadsheet_mappings ])


    # for summary_line in generate_summary_lines():
    #     writer.writerow(summary_line)
    #     yield line.read().encode('utf-8')


def build_xslx_spreadsheet(dictionaries_iterable, spreadsheet_mappings):
    '''TODO'''
    from tempfile import NamedTemporaryFile
    from openpyxl import Workbook
    wb = Workbook()

    with NamedTemporaryFile() as tmp:
        wb.save(tmp.name)
        tmp.seek(0)
        stream = tmp.read()



############################
## Spreadsheet Generation Code Specific to VariantSampleList Items 
############################



@view_config(route_name='variant_sample_list_spreadsheet', request_method=['GET', 'POST'])
@debug_log
def variant_sample_list_spreadsheet(context, request):
    """
    Returns spreasheet containing information about every VariantSample selection
    in the VariantSampleList Item.
    TODO:
      Figure out fields needed, use CustomEmbed class to fetch them, then
      plop them out as a download stream. See 4DN/fourfront's batch_download
      for precedent example (downloading/streaming a TSV from /search/ request).
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
        suggested_filename = "case-interpretation." + file_format # TODO: Datetime

    

    requested_variant_sample_uuids = request_body.get("variant_sample_uuids", None)

    if requested_variant_sample_uuids is None:
        # Check for VariantSampleList Item and get from there.
        variant_sample_list_id_requested = request_body.get("variant_sample_list_id", request.GET.get("variant_sample_list_id", None))
        if variant_sample_list_id_requested is None:
            raise HTTPBadRequest("Expected a valid `variant_sample_list_id` or `variant_sample_item_uuids`")
        subreq = make_subrequest(request, variant_sample_list_id_requested + "?frame=object&datastore=database", None, inherit_user=True)
        subreq.__parent__ = None

        loaded_vsl = request.invoke_subrequest(subreq).json
        # print('\n\nLoaded VSL:', loaded_vsl)
        variant_sample_objects = loaded_vsl.get("variant_samples", [])
        requested_variant_sample_uuids = [ vso["variant_sample_item"] for vso in variant_sample_objects ]


    spreadsheet_mappings = get_spreadsheet_mappings(request)
    fields_to_embed = [
        # Most of these are needed for columns with render/transform/custom-logic functions in place of (string) CGAP field.
        # Keep up-to-date with any custom logic.
        "@id",
        "@type",
        "variant.transcript.csq_canonical",
        "variant.transcript.csq_most_severe",
        "variant.transcript.csq_feature",
        "variant.transcript.csq_consequence.impact",
        "variant.transcript.csq_consequence.var_conseq_name",
        "variant.transcript.csq_consequence.display_title",
        "variant.transcript.csq_exon",
        "variant.transcript.csq_intron"
    ]
    for pop_suffix, pop_name in POPULATION_SUFFIX_TITLE_TUPLES:
        fields_to_embed.append("variant.csq_gnomadg_af-" + pop_suffix)
        fields_to_embed.append("variant.csq_gnomade2_af-" + pop_suffix)
    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        if isinstance(cgap_field_or_func, str):
            # We don't expect any duplicate fields (else would've used a set in place of list) ... pls avoid duplicates in spreadsheet_mappings.
            fields_to_embed.append(cgap_field_or_func)

    def load_variant_sample(vs_id):
        '''
        We want to grab datastore=database version of Items here since is likely that user has _just_ finished making
        an edit when they decide to export the spreadsheet from the InterpretationTab UI.
        '''
        # print("Loading...", vs_id)
        vs_embedding_instance = CustomEmbed(request, vs_id, embed_props={ "requested_fields": fields_to_embed })
        return vs_embedding_instance.result

    # request.response.headers['X-Accel-Buffering'] = "no"

    return Response(
        app_iter = stream_tsv_output(
            map(
                lambda x: convert_item_to_sheet_dict(x, spreadsheet_mappings),
                map(
                    load_variant_sample,
                    requested_variant_sample_uuids
                )
            ),
            spreadsheet_mappings,
            file_format
        ),
        headers={
            'X-Accel-Buffering': 'no',
            'Content-Encoding': 'utf-8',
            'Content-Disposition': 'attachment;filename="%s"' % suggested_filename,
            'Content-Type': 'text/' + file_format
        },
        # content_type='text/' + file_format,
        # content_encoding='utf-8',
        # content_disposition='attachment;filename="%s"' % suggested_filename
    )

