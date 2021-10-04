import json
import datetime
import pytz
import structlog
from pyramid.httpexceptions import (
    HTTPBadRequest,
    HTTPMovedPermanently,
    HTTPServerError,
    HTTPTemporaryRedirect
)
from pyramid.view import view_config
from pyramid.response import Response
from pyramid.traversal import find_resource
from snovault.util import simple_path_ids, debug_log
from snovault.embed import make_subrequest

from encoded.types.variant import (
    get_spreadsheet_mappings
)
from .batch_download_utils import (
    stream_tsv_output,
    convert_item_to_sheet_dict,
    human_readable_filter_block_queries
)
from .search.compound_search import CompoundSearchBuilder




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
        # This is what we should be receiving
        request_body = request.POST
    except:
        # TODO: Consider accepting JSON body for unit test purposes only
        pass


    file_format = request_body.get("file_format", request.GET.get("file_format", "tsv")).lower()
    if file_format not in { "tsv", "csv" }: # TODO: Add support for xslx.
        raise HTTPBadRequest("Expected a valid `file_format` such as TSV or CSV.")

    case_accession = request_body.get("case_accession", request.GET.get("case_accession"))
    case_title = request_body.get("case_title", request.GET.get("case_title"))

    timestamp = datetime.datetime.now(pytz.utc).isoformat()[:-13] + "Z"
    suggested_filename = (case_accession or "case") + "-filtering-" + timestamp + "." + file_format

    spreadsheet_mappings = get_spreadsheet_mappings(request)


    # Must not contain `limit`
    filterset_blocks_request = request_body["compound_search_request"]
    if isinstance(filterset_blocks_request, str):
        # Assuming is from a www-form-encoded POST request, which has value stringified.
        filterset_blocks_request = json.loads(filterset_blocks_request)

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

    def vs_dicts_generator():
        for embedded_representation_variant_sample in compound_search_res:
            # Extends `embedded_representation_variant_sample` in place
            embed_and_merge_note_items_to_variant_sample(request, embedded_representation_variant_sample)
            yield convert_item_to_sheet_dict(embedded_representation_variant_sample, spreadsheet_mappings)


    header_info_rows = [
        ["#"],
        ["#", "Case Accession:", "", case_accession or "Not Available"],
        ["#", "Case Title:", "", case_title or "Not Available"],
        ["#", "Filters Selected:", "", human_readable_filter_block_queries(filterset_blocks_request) ],
        #["#", "Filtering Query Used:", "", json.dumps({ "intersect": intersect, "filter_blocks": [ fb["query"] for fb in filter_set["filter_blocks"] ] })  ],
        ["#"],
        ["## -------------------------------------------------------"] # <- Slightly less than horizontal length of most VS @IDs
    ]


    return Response(
        app_iter = stream_tsv_output(
            vs_dicts_generator(),
            spreadsheet_mappings,
            file_format=file_format,
            header_rows=header_info_rows
        ),
        headers={
            'X-Accel-Buffering': 'no',
            # 'Content-Encoding': 'utf-8', # Commented out -- unit test's TestApp won't decode otherwise.
            'Content-Disposition': 'attachment; filename=' + suggested_filename,
            'Content-Type': 'text/' + file_format,
            'Content-Description': 'File Transfer',
            'Cache-Control': 'no-store'
        }
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
    # TODO: Parallelize (^ notes per VS)?
    for note_field in note_containing_fields:
        for incomplete_note_obj in simple_path_ids(embedded_vs, note_field):
            # Using request.embed instead of CustomEmbed because we're fine with getting from ES (faster)
            # for search-based spreadsheet requests.
            note_subreq = make_subrequest(request, incomplete_note_obj["@id"])
            # We don't get _stats on subreq of www-encoded-form POST requests; need to look into (could perhaps amend in snovault)
            # Add this in to prevent error in snovault's `after_cursor_execute`
            setattr(note_subreq, "_stats", request._stats)
            note_response = request.invoke_subrequest(note_subreq)
            incomplete_note_obj.update(note_response.json)

