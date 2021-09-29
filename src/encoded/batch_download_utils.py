import csv
from urllib.parse import parse_qs
import structlog
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


def human_readable_filter_block_queries(filterset_blocks_request):
    parsed_filter_block_qs = []
    fb_len = len(filterset_blocks_request["filter_blocks"])
    for fb in filterset_blocks_request["filter_blocks"]:
        curr_fb_str = None
        if not fb["query"]:
            curr_fb_str = "<Any>"
            if fb_len > 1:
                curr_fb_str = "( " + curr_fb_str + " )"
        else:
            qs_dict = parse_qs(fb["query"])
            curr_fb_q = []
            for field, value in qs_dict.items():
                formstr = field + " = "
                if len(value) == 1:
                    formstr += str(value[0])
                else:
                    formstr += "[ " + " | ".join([ str(v) for v in value ]) + " ]"
                curr_fb_q.append(formstr)
            curr_fb_str = " & ".join(curr_fb_q)
            if fb_len > 1:
                curr_fb_str = "( " + curr_fb_str + " )"
        parsed_filter_block_qs.append(curr_fb_str)
    return (" AND " if filterset_blocks_request.get("intersect", False) else " OR ").join(parsed_filter_block_qs)


class Echo(object):
    def write(self, line):
        return line.encode("utf-8")



def stream_tsv_output(
    dictionaries_iterable,
    spreadsheet_mappings,
    file_format = "tsv",
    header_rows=None
):
    '''
    Generator which converts iterable of column:value dictionaries into a TSV stream.
    :param dictionaries_iterable: Iterable of dictionaries, each containing TSV_MAPPING keys and values from a file in ExperimentSet.
    '''

    writer = csv.writer(
        Echo(),
        delimiter= "\t" if file_format == "tsv" else ",",
        quoting=csv.QUOTE_NONNUMERIC
    )

    # yield writer.writerow("\xEF\xBB\xBF") # UTF-8 BOM - usually shows up as special chars (not useful)

    # Header/Intro Rows (if any)
    for row in (header_rows or []):
        yield writer.writerow(row)

    ## Add in headers (column title) and descriptions
    title_headers = []
    description_headers = []
    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        title_headers.append(column_title)
        description_headers.append(description)

    # Prepend comment hash in case people using this spreadsheet file programmatically.
    title_headers[0] = "# " + title_headers[0]
    description_headers[0] = "# " + description_headers[0]

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
            row = [ vs_dict.get(sm[0]) or "" for sm in spreadsheet_mappings ]
            yield writer.writerow(row)



def build_xlsx_spreadsheet(dictionaries_iterable, spreadsheet_mappings):
    '''TODO'''
    from tempfile import NamedTemporaryFile
    from openpyxl import Workbook
    wb = Workbook()

    with NamedTemporaryFile() as tmp:
        wb.save(tmp.name)
        tmp.seek(0)
        stream = tmp.read()
        
