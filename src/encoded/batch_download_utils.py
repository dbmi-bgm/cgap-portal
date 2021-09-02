import csv
import structlog
from pyramid.httpexceptions import (
    HTTPBadRequest,
    HTTPMovedPermanently,
    HTTPServerError,
    HTTPTemporaryRedirect
)
from pyramid.request import Request
from pyramid.response import Response
from snovault.util import simple_path_ids, debug_log



log = structlog.getLogger(__name__)

# Unsure if we might prefer the below approach to avoid recursion or not-
# def simple_path_ids(obj, path):
#     if isinstance(path, str):
#         path = path.split('.')
#     path.reverse()
#     value = None
#     curr_obj_q = []
#     if isinstance(obj, list):
#         curr_obj_q = obj
#     else:
#         curr_obj_q = [obj]
#     while len(path) > 0:
#         name = path.pop()
#         next_q = []
#         for curr_obj in curr_obj_q:
#             value = curr_obj.get(name, None)
#             if value is None:
#                 continue
#             if not isinstance(value, list):
#                 value = [value]
#             for v in value:
#                 next_q.append(v)
#         curr_obj_q = next_q
#     else:
#         return curr_obj_q


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

    ## Add in headers (column title) and descriptions
    title_headers = []
    description_headers = []
    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        title_headers.append(column_title)
        description_headers.append(description)
    title_headers[0] = "## " + title_headers[0] # Add comment hash in case people using this spreadsheet file programmatically.
    description_headers[0] = "## " + description_headers[0] # Add comment hash in case people using this spreadsheet file programmatically.

    #yield writer.writerow("\xEF\xBB\xBF") # UTF-8 BOM
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
            # print("Printing", vs_dict)
            yield writer.writerow([ vs_dict.get(sm[0]) or "" for sm in spreadsheet_mappings ])

    # TODO: Figure out what we need in summary (if anything) and gather at some place.
    # Could be implemented based on request._stats, e.g. `setattr(vs_dict, "_stats", { "countX" : 0, "countY": 0 })`
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
        
