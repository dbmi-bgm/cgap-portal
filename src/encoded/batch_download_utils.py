import csv
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import cached_property
from typing import (
    Any, Callable, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, Tuple, Union
)
from urllib.parse import parse_qs

import structlog
from pyramid.request import Request
from pyramid.response import Response
from snovault.util import simple_path_ids

from .drr_item_models import JsonObject
from .root import CGAPRoot
from .search.compound_search import GLOBAL_FLAGS, INTERSECT, CompoundSearchBuilder
from .types.base import Item
from .types.filter_set import FILTER_BLOCKS


log = structlog.getLogger(__name__)

OrderedSpreadsheetColumn = Tuple[str, str, Union[str, Callable]]

CSV_EXTENSION = "csv"
TSV_EXTENSION = "tsv"
ACCEPTABLE_FILE_FORMATS = set([TSV_EXTENSION, CSV_EXTENSION])
DEFAULT_FILE_FORMAT = TSV_EXTENSION
FILE_FORMAT_TO_DELIMITER = {CSV_EXTENSION: ",", TSV_EXTENSION: "\t"}



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

    if '@id' not in item:
        return None

    sheet_dict = {}  # OrderedDict() # Keyed by column title. Maybe OrderedDict not necessary now..

    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        if cgap_field_or_func is None: # Skip
            continue

        is_field_str = isinstance(cgap_field_or_func, str)

        if not is_field_str:  # Assume render or custom-logic function
            sheet_dict[column_title] = cgap_field_or_func(item)
        else:
            sheet_dict[column_title] = get_values_for_field(item, cgap_field_or_func)

    return sheet_dict


def human_readable_filter_block_queries(filterset_blocks_request):
    parsed_filter_block_qs = []
    fb_len = len(filterset_blocks_request[FILTER_BLOCKS])
    for fb in filterset_blocks_request[FILTER_BLOCKS]:
        curr_fb_str = None
        query = fb.get("query")
        if not query:
            curr_fb_str = "<Any>"
            if fb_len > 1:
                curr_fb_str = "( " + curr_fb_str + " )"
        else:
            qs_dict = parse_qs(query)
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
    return (" AND " if filterset_blocks_request.get(INTERSECT, False) else " OR ").join(parsed_filter_block_qs)


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


class SpreadsheetCreationError(Exception):
    pass


@dataclass(frozen=True)
class SpreadsheetColumn:

    title: str
    description: str
    evaluator: Union[str, Callable]

    def get_title(self):
        return self.title

    def get_description(self):
        return self.description

    def get_field_for_item(self, item: Any) -> str:
        if self.is_property_evaluator() and isinstance(item, Dict):
            return self._get_field_from_item(item)
        if self.is_callable_evaluator():
            return self.evaluator(item)
        raise ValueError(
            f"Unable to evaluate item {item} with evaluator {self.evaluator}"
        )

    def _get_field_from_item(self, item: Any) -> str:
        return get_values_for_field(item, self.evaluator)

    def is_property_evaluator(self):
        return isinstance(self.evaluator, str)

    def is_callable_evaluator(self):
        return callable(self.evaluator)


@dataclass(frozen=True)
class SpreadsheetTemplate(ABC):

    items_to_evaluate: Iterable[JsonObject]

    @abstractmethod
    def _get_headers(self) -> None:
        pass

    @abstractmethod
    def _get_column_titles(self) -> None:
        pass

    @abstractmethod
    def _get_column_descriptions(self) -> None:
        pass

    @abstractmethod
    def _get_row_for_item(self, item_to_evaluate: JsonObject) -> None:
        pass

    def yield_rows(self) -> Iterator[Iterable[str]]:
        self._yield_headers()
        self._yield_column_rows()
        self._yield_item_rows()

    def _yield_headers(self) -> Iterator[Iterable[str]]:
        for header in self._get_headers():
            yield header

    def _yield_column_rows(self) -> Iterator[Iterable[str]]:
        yield self._get_column_titles()
        yield self._get_column_descriptions()

    def _yield_item_rows(self) -> Iterator[Iterable[str]]:
        for item in self.items_to_evaluate:
            yield self._get_row_for_item(item)


@dataclass(frozen=True)
class SpreadsheetFromColumnTuples(SpreadsheetTemplate, ABC):

    @abstractmethod
    def _get_column_tuples(self) -> None:
        pass

    @cached_property
    def _spreadsheet_columns(self) -> None:
        column_tuples = self._get_column_tuples()
        return self._convert_column_tuples_to_spreadsheet_columns(column_tuples)

    def _get_column_titles(self) -> Iterator[str]:
        return (column.get_title() for column in self._spreadsheet_columns)

    def _get_column_descriptions(self) -> Iterator[str]:
        return (column.get_description() for column in self._spreadsheet_columns)

    def _convert_column_tuples_to_spreadsheet_columns(
        self,
        columns: Iterable[OrderedSpreadsheetColumn],
    ) -> List[SpreadsheetColumn]:
        return [SpreadsheetColumn(*column) for column in columns]


@dataclass(frozen=True)
class SpreadsheetPost:

    CASE_ACCESSION = "case_accession"
    CASE_TITLE = "case_title"
    COMPOUND_SEARCH_REQUEST = "compound_search_request"
    FILE_FORMAT = "file_format"

    request: Request

    @property
    def parameters(self) -> JsonObject:
        return self.request.params

    def get_file_format(self) -> str:
        return self.parameters.get(self.FILE_FORMAT, DEFAULT_FILE_FORMAT).lower()

    def get_case_accession(self) -> str:
        return self.parameters.get(self.CASE_ACCESSION, "")

    def get_case_title(self) -> str:
        return self.parameters.get(self.CASE_TITLE, "")

    def get_compound_search(self) -> JsonObject:
        # May want to validate this value
        # Going with Alex's format here for json.loading if a string
        # Not sure this should be a dict; might be an array
        compound_search = self.parameters.get(self.COMPOUND_SEARCH_REQUEST, {})
        if isinstance(compound_search, str):
            compound_search = json.loads(compound_search)
        return compound_search


@dataclass(frozen=True)
class FilterSetSearch:

    context: Union[CGAPRoot, Item]
    request: Request
    compound_search: Mapping

    def get_search_results(self) -> Iterator[JsonObject]:
        return CompoundSearchBuilder.execute_filter_set(
            self.context,
            self.request,
            self._get_filter_set(),
            to=CompoundSearchBuilder.ALL,
            global_flags=self._get_global_flags(),
            intersect=self._is_intersect(),
            return_generator=True,
        )

    def _get_filter_set(self) -> JsonObject:
        return CompoundSearchBuilder.extract_filter_set_from_search_body(
            self.request, self.compound_search
        )

    def _get_global_flags(self) -> Union[str, None]:
        return self.compound_search.get(GLOBAL_FLAGS)

    def _is_intersect(self) -> bool:
        return bool(self._get_intersect())

    def _get_intersect(self) -> str:
        return self.compound_search.get(INTERSECT, "")


@dataclass(frozen=True)
class SpreadsheetGenerator:

    file_name: str
    rows_to_write: Iterable[Sequence[str]]
    file_format: Optional[str] = DEFAULT_FILE_FORMAT

    def get_streaming_response(self) -> Response:
        return Response(
            app_iter=self._stream_spreadsheet(), headers=self._get_response_headers()
        )

    def _stream_spreadsheet(self) -> Iterator[Callable]:
        writer = self._get_writer()
        for row in self.rows_to_write:
            if row:
                yield writer.writerow(row)

    def _get_writer(self) -> csv.writer:
        """Using csv.writer for formatting lines, not writing to actual file here."""
        delimiter = self._get_delimiter()
        return csv.writer(Echo(), delimiter=delimiter, quoting=csv.QUOTE_NONNUMERIC)

    def _get_delimiter(self) -> str:
        result = FILE_FORMAT_TO_DELIMITER.get(self.file_format)
        if result is None:
            raise ValueError
        return result

    def _get_response_headers(self) -> Dict:
        return {
            "X-Accel-Buffering": "no",
            "Content-Disposition": (
                f"attachment; filename={self._get_file_name_with_extension()}"
            ),
            "Content-Type": f"text/{self.file_format}",
            "Content-Description": "File Transfer",
            "Cache-Control": "no-store"
        }

    def _get_file_name_with_extension(self) -> str:
        return f"{self.file_name}.{self.file_format}"
