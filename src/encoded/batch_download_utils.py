import csv
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import lru_cache
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)
from urllib.parse import parse_qs

import structlog
from pyramid.request import Request
from pyramid.response import Response
from snovault.util import simple_path_ids

from .root import CGAPRoot
from .search.compound_search import GLOBAL_FLAGS, INTERSECT, CompoundSearchBuilder
from .types.base import Item
from .types.filter_set import FILTER_BLOCKS
from .util import JsonObject


log = structlog.getLogger(__name__)

OrderedSpreadsheetColumn = Tuple[str, str, Union[str, Callable]]

CSV_EXTENSION = "csv"
TSV_EXTENSION = "tsv"
ACCEPTABLE_FILE_FORMATS = set([TSV_EXTENSION, CSV_EXTENSION])
DEFAULT_FILE_FORMAT = TSV_EXTENSION
FILE_FORMAT_TO_DELIMITER = {CSV_EXTENSION: ",", TSV_EXTENSION: "\t"}


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
                    formstr += "[ " + " | ".join([str(v) for v in value]) + " ]"
                curr_fb_q.append(formstr)
            curr_fb_str = " & ".join(curr_fb_q)
            if fb_len > 1:
                curr_fb_str = "( " + curr_fb_str + " )"
        parsed_filter_block_qs.append(curr_fb_str)
    return (" AND " if filterset_blocks_request.get(INTERSECT, False) else " OR ").join(
        parsed_filter_block_qs
    )


class Echo(object):
    def write(self, line):
        return line.encode("utf-8")


class SpreadsheetCreationError(Exception):
    pass


@dataclass(frozen=True)
class SpreadsheetColumn:

    title: str
    description: str
    evaluator: Union[str, Callable]

    def get_title(self) -> str:
        return self.title

    def get_description(self) -> str:
        return self.description

    def get_evaluator(self) -> Union[str, Callable]:
        return self.evaluator

    def get_field_for_item(self, item: Any) -> str:
        if self.is_property_evaluator() and isinstance(item, Dict):
            return self._get_field_from_item(item)
        if self.is_callable_evaluator():
            return self.evaluator(item)
        raise SpreadsheetCreationError(
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
    def _get_headers(self) -> List[List[str]]:
        pass

    @abstractmethod
    def _get_column_titles(self) -> List[str]:
        pass

    @abstractmethod
    def _get_column_descriptions(self) -> List[str]:
        pass

    @abstractmethod
    def _get_row_for_item(self, item_to_evaluate: JsonObject) -> List[str]:
        pass

    def yield_rows(self) -> Iterator[Iterable[str]]:
        yield from self._yield_headers()
        yield from self._yield_column_rows()
        yield from self._yield_item_rows()

    def _yield_headers(self) -> Iterator[Iterable[str]]:
        for header in self._get_headers():
            yield header

    def _yield_column_rows(self) -> Iterator[Iterable[str]]:
        yield self._get_column_descriptions()
        yield self._get_column_titles()

    def _yield_item_rows(self) -> Iterator[Iterable[str]]:
        for item in self.items_to_evaluate:
            yield self._get_row_for_item(item)


@dataclass(frozen=True)
class SpreadsheetFromColumnTuples(SpreadsheetTemplate, ABC):
    @classmethod
    @abstractmethod
    def _get_column_tuples(cls) -> None:
        pass

    @property
    def _spreadsheet_columns(self) -> None:
        return self.get_spreadsheet_columns()

    @classmethod
    @lru_cache()
    def get_spreadsheet_columns(cls) -> List[SpreadsheetColumn]:
        column_tuples = cls._get_column_tuples()
        return cls._convert_column_tuples_to_spreadsheet_columns(column_tuples)

    @classmethod
    def _convert_column_tuples_to_spreadsheet_columns(
        cls,
        columns: Iterable[OrderedSpreadsheetColumn],
    ) -> List[SpreadsheetColumn]:
        return [SpreadsheetColumn(*column) for column in columns]

    def _get_column_titles(self) -> List[str]:
        return [column.get_title() for column in self._spreadsheet_columns]

    def _get_column_descriptions(self) -> List[str]:
        result = []
        for idx, column in enumerate(self._spreadsheet_columns):
            description = column.get_description()
            if idx == 0:
                result.append(f"# {description}")
            else:
                result.append(description)
        return result


@dataclass(frozen=True)
class SpreadsheetRequest:

    CASE_ACCESSION = "case_accession"
    CASE_TITLE = "case_title"
    COMPOUND_SEARCH_REQUEST = "compound_search_request"
    FILE_FORMAT = "file_format"

    request: Request

    def get_request(self) -> Request:
        return self.request

    @property
    def parameters(self) -> JsonObject:
        return self.request.params or self.request.json

    def get_file_format(self) -> str:
        return self.parameters.get(self.FILE_FORMAT, DEFAULT_FILE_FORMAT).lower()

    def get_case_accession(self) -> str:
        return self.parameters.get(self.CASE_ACCESSION, "")

    def get_case_title(self) -> str:
        return self.parameters.get(self.CASE_TITLE, "")

    def get_compound_search(self) -> JsonObject:
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
        """Use csv.writer for formatting lines, not writing to file."""
        delimiter = self._get_delimiter()
        return csv.writer(Echo(), delimiter=delimiter, quoting=csv.QUOTE_NONNUMERIC)

    def _get_delimiter(self) -> str:
        result = FILE_FORMAT_TO_DELIMITER.get(self.file_format)
        if result is None:
            raise SpreadsheetCreationError(
                f"No known delimiter for given file format {self.file_format}"
            )
        return result

    def _get_response_headers(self) -> Dict:
        return {
            "X-Accel-Buffering": "no",
            "Content-Disposition": (
                f"attachment; filename={self._get_file_name_with_extension()}"
            ),
            "Content-Type": f"text/{self.file_format}",
            "Content-Description": "File Transfer",
            "Cache-Control": "no-store",
        }

    def _get_file_name_with_extension(self) -> str:
        return f"{self.file_name}.{self.file_format}"
