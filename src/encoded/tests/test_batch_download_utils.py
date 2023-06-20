import json
from contextlib import contextmanager
from typing import (
    Any,
    Callable,
    Generator,
    Iterator,
    List,
    Optional,
    Sequence,
    Union,
)
from unittest import mock

import pytest
from pyramid.request import Request
from pyramid.response import Response


from .utils import patch_context
from .. import batch_download_utils as batch_download_utils_module
from ..batch_download_utils import (
    DEFAULT_FILE_FORMAT,
    OrderedSpreadsheetColumn,
    get_values_for_field,
    FilterSetSearch,
    SpreadsheetColumn,
    SpreadsheetCreationError,
    SpreadsheetFromColumnTuples,
    SpreadsheetGenerator,
    SpreadsheetRequest,
    SpreadsheetTemplate,
)
from ..util import JsonObject


SOME_REQUEST = "foo"
SOME_CONTEXT = "bar"


@contextmanager
def patch_compound_search_builder_extract_filter_set(
    **kwargs,
) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.CompoundSearchBuilder.extract_filter_set_from_search_body,
        **kwargs,
    ) as mocked_item:
        yield mocked_item


@contextmanager
def patch_compound_search_builder_execute_filter_set(
    **kwargs,
) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.CompoundSearchBuilder.execute_filter_set, **kwargs
    ) as mocked_item:
        yield mocked_item


@contextmanager
def patch_spreadsheet_request_parameters(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.SpreadsheetRequest.parameters, **kwargs
    ) as mocked_item:
        yield mocked_item


@contextmanager
def patch_filter_set_search_get_filter_set(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.FilterSetSearch._get_filter_set, **kwargs
    ) as mocked_item:
        yield mocked_item


@contextmanager
def patch_get_values_for_field(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.get_values_for_field, **kwargs
    ) as mocked_item:
        yield mocked_item


def mock_request() -> mock.MagicMock:
    return mock.create_autospec(Request)


@pytest.mark.parametrize(
    "item,field,remove_duplicates,expected",
    [
        ({"foo": "bar"}, "bar", True, ""),
        ({"foo": "bar"}, "foo", True, "bar"),
        ({"foo": 1}, "foo", True, "1"),
        ({"foo": ["bar"]}, "foo", True, "bar"),
        ({"foo": ["bar", "bar"]}, "foo", True, "bar"),
        ({"foo": ["bar", "bar"]}, "foo", False, "bar, bar"),
        ({"foo": [{"fu": "bar"}]}, "foo", True, "{'fu': 'bar'}"),
        ({"foo": [{"fu": "bar"}]}, "foo.fu", True, "bar"),
        ({"foo": [{"fu": "bar"}, {"fu": "bur"}]}, "foo.fu", True, "bar, bur"),
    ],
)
def test_get_values_for_field(
    item: JsonObject, field: str, remove_duplicates: bool, expected: str
) -> None:
    result = get_values_for_field(item, field, remove_duplicates=remove_duplicates)
    assert result == expected


def evaluate_item(item: JsonObject) -> bool:
    return True


class TestSpreadsheetColumn:

    SOME_TITLE = "column_a"
    SOME_DESCRIPTION = "A lovely little column"
    SOME_FIELD_TO_EVALUATE = "foo"
    SOME_FIELD_VALUE = "bar"
    SOME_ITEM_TO_EVALUATE = {SOME_FIELD_TO_EVALUATE: SOME_FIELD_VALUE}
    SOME_CALLABLE_EVALUATOR = evaluate_item

    def get_spreadsheet_column(
        self, evaluator: Union[str, Callable] = SOME_FIELD_TO_EVALUATE
    ) -> SpreadsheetColumn:
        return SpreadsheetColumn(self.SOME_TITLE, self.SOME_DESCRIPTION, evaluator)

    @pytest.mark.parametrize(
        "to_evaluate,evaluator,exception_expected,expected",
        [
            (SOME_ITEM_TO_EVALUATE, SOME_FIELD_TO_EVALUATE, False, SOME_FIELD_VALUE),
            ("not_a_dict", SOME_FIELD_TO_EVALUATE, True, None),
            (SOME_ITEM_TO_EVALUATE, SOME_CALLABLE_EVALUATOR, False, True),
            (SOME_ITEM_TO_EVALUATE, None, True, None),
        ],
    )
    def test_get_field_for_item(
        self, to_evaluate: Any, evaluator: Any, exception_expected: bool, expected: Any
    ) -> None:
        spreadsheet_column = self.get_spreadsheet_column(evaluator=evaluator)
        if exception_expected:
            with pytest.raises(SpreadsheetCreationError):
                spreadsheet_column.get_field_for_item(to_evaluate)
        else:
            result = spreadsheet_column.get_field_for_item(to_evaluate)
            assert result == expected

    def test_get_field_from_item(self) -> None:
        with patch_get_values_for_field(
            return_value=self.SOME_FIELD_VALUE
        ) as mock_get_values_for_field:
            spreadsheet_column = self.get_spreadsheet_column()
            result = spreadsheet_column._get_field_from_item(self.SOME_ITEM_TO_EVALUATE)
            assert result == self.SOME_FIELD_VALUE
            mock_get_values_for_field.assert_called_once_with(
                self.SOME_ITEM_TO_EVALUATE, self.SOME_FIELD_TO_EVALUATE
            )

    @pytest.mark.parametrize(
        "evaluator,expected",
        [
            (SOME_FIELD_TO_EVALUATE, True),
            (SOME_CALLABLE_EVALUATOR, False),
        ],
    )
    def test_is_property_evaluator(
        self, evaluator: Union[str, Callable], expected: bool
    ) -> None:
        spreadsheet_column = self.get_spreadsheet_column(evaluator=evaluator)
        assert spreadsheet_column.is_property_evaluator() == expected

    @pytest.mark.parametrize(
        "evaluator,expected",
        [
            (SOME_FIELD_TO_EVALUATE, False),
            (SOME_CALLABLE_EVALUATOR, True),
        ],
    )
    def test_is_callable_evaluator(
        self, evaluator: Union[str, Callable], expected: bool
    ) -> None:
        spreadsheet_column = self.get_spreadsheet_column(evaluator=evaluator)
        assert spreadsheet_column.is_callable_evaluator() == expected


class TestSpreadsheetTemplate:

    SOME_ITEM_TO_EVALUATE = {"foo": "bar"}
    ITEMS_TO_EVALUATE = [SOME_ITEM_TO_EVALUATE]

    class Spreadsheet(SpreadsheetTemplate):

        SOME_HEADER = ["foo", "bar"]
        SOME_HEADERS = [SOME_HEADER]
        SOME_COLUMN_TITLES = ["title1", "title2"]
        SOME_COLUMN_DESCRIPTIONS = ["description1", "description2"]
        SOME_ITEM_ROW = ["item_name", "some_property"]

        def _get_headers(self) -> List[List[str]]:
            return self.SOME_HEADERS

        def _get_column_titles(self) -> List[str]:
            return self.SOME_COLUMN_TITLES

        def _get_column_descriptions(self) -> List[str]:
            return self.SOME_COLUMN_DESCRIPTIONS

        def _get_row_for_item(self, item_to_evaluate: JsonObject) -> List[str]:
            return self.SOME_ITEM_ROW

    def get_spreadsheet(self) -> Spreadsheet:
        return self.Spreadsheet(self.ITEMS_TO_EVALUATE)

    def test_yield_rows(self) -> None:
        spreadsheet = self.get_spreadsheet()
        result = spreadsheet.yield_rows()
        assert isinstance(result, Generator)
        rows = list(result)
        assert rows == [
            self.Spreadsheet.SOME_HEADER,
            self.Spreadsheet.SOME_COLUMN_DESCRIPTIONS,
            self.Spreadsheet.SOME_COLUMN_TITLES,
            self.Spreadsheet.SOME_ITEM_ROW,
        ]


class TestSpreadsheetFromColumnTuples:
    class Spreadsheet(SpreadsheetFromColumnTuples):
        @classmethod
        def callable_evaluator(cls, to_evaluate: Any) -> str:
            return "foo"

        SOME_TITLE_1 = "Some title"
        SOME_TITLE_2 = "Another title"
        SOME_DESCRIPTION_1 = "Some description"
        SOME_DESCRIPTION_2 = "Another description"
        SOME_COLUMN_TUPLES = [
            (SOME_TITLE_1, SOME_DESCRIPTION_1, "Some property"),
            (SOME_TITLE_2, SOME_DESCRIPTION_2, callable_evaluator),
        ]

        @classmethod
        def _get_column_tuples(cls) -> List[OrderedSpreadsheetColumn]:
            return cls.SOME_COLUMN_TUPLES

        def _get_headers(self) -> None:
            return

        def _get_row_for_item(self) -> None:
            return

    def get_spreadsheet(self) -> Spreadsheet:
        return self.Spreadsheet([])

    def test_get_spreadsheet_columns(self) -> None:
        spreadsheet = self.get_spreadsheet()
        result = spreadsheet.get_spreadsheet_columns()
        assert len(result) == 2
        for item in result:
            assert isinstance(item, SpreadsheetColumn)

    def test_get_column_titles(self) -> None:
        spreadsheet = self.get_spreadsheet()
        result = spreadsheet._get_column_titles()
        assert result == [self.Spreadsheet.SOME_TITLE_1, self.Spreadsheet.SOME_TITLE_2]

    def test_get_column_descriptions(self) -> None:
        spreadsheet = self.get_spreadsheet()
        result = spreadsheet._get_column_descriptions()
        assert result == [
            f"# {self.Spreadsheet.SOME_DESCRIPTION_1}",
            self.Spreadsheet.SOME_DESCRIPTION_2,
        ]


class TestSpreadsheetRequest:

    SOME_FILE_FORMAT = "something"
    SOME_CASE_ACCESSION = "foo"
    SOME_CASE_TITLE = "bar"
    SOME_COMPOUND_SEARCH = {"search": "this"}
    SOME_PARAMETERS = {
        "file_format": SOME_FILE_FORMAT,
        "case_accession": SOME_CASE_ACCESSION,
        "case_title": SOME_CASE_TITLE,
        "compound_search_request": SOME_COMPOUND_SEARCH,
    }

    def get_spreadsheet_request(self) -> SpreadsheetRequest:
        return SpreadsheetRequest(SOME_REQUEST)

    def test_parameters(self) -> None:
        request = mock_request()
        spreadsheet_request = SpreadsheetRequest(request)
        assert spreadsheet_request.parameters == request.params

        request.params = None
        assert spreadsheet_request.parameters == request.json

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, DEFAULT_FILE_FORMAT),
            (SOME_PARAMETERS, SOME_FILE_FORMAT),
        ],
    )
    def test_get_file_format(self, parameters: JsonObject, expected: str) -> None:
        with patch_spreadsheet_request_parameters(return_value=parameters):
            spreadsheet_request = self.get_spreadsheet_request()
            assert spreadsheet_request.get_file_format() == expected

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, ""),
            (SOME_PARAMETERS, SOME_CASE_ACCESSION),
        ],
    )
    def test_get_case_accession(self, parameters: JsonObject, expected: str) -> None:
        with patch_spreadsheet_request_parameters(return_value=parameters):
            spreadsheet_request = self.get_spreadsheet_request()
            assert spreadsheet_request.get_case_accession() == expected

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, ""),
            (SOME_PARAMETERS, SOME_CASE_TITLE),
        ],
    )
    def test_get_case_title(self, parameters: JsonObject, expected: str) -> None:
        with patch_spreadsheet_request_parameters(return_value=parameters):
            spreadsheet_request = self.get_spreadsheet_request()
            assert spreadsheet_request.get_case_title() == expected

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, {}),
            (SOME_PARAMETERS, SOME_COMPOUND_SEARCH),
            (
                {"compound_search_request": json.dumps(SOME_COMPOUND_SEARCH)},
                SOME_COMPOUND_SEARCH,
            ),
        ],
    )
    def test_get_compound_search(self, parameters: JsonObject, expected: str) -> None:
        with patch_spreadsheet_request_parameters(return_value=parameters):
            spreadsheet_request = self.get_spreadsheet_request()
            assert spreadsheet_request.get_compound_search() == expected


class TestFilterSetSearch:

    SOME_COMPOUND_SEARCH = {"foo": "bar"}

    def get_filter_set_search(
        self, compound_search: Optional[JsonObject] = None
    ) -> FilterSetSearch:
        compound_search_to_use = compound_search or self.SOME_COMPOUND_SEARCH
        return FilterSetSearch(SOME_CONTEXT, SOME_REQUEST, compound_search_to_use)

    def test_get_search_results(self) -> None:
        filter_set_search = self.get_filter_set_search()
        with patch_compound_search_builder_execute_filter_set() as mock_execute_filter_set:
            with patch_filter_set_search_get_filter_set() as mock_get_filter_set:
                filter_set_search.get_search_results()
                mock_execute_filter_set.assert_called_once_with(
                    SOME_CONTEXT,
                    SOME_REQUEST,
                    mock_get_filter_set.return_value,
                    to="all",
                    global_flags=None,
                    intersect=False,
                    return_generator=True,
                )

    def test_get_filter_set(self) -> None:
        filter_set_search = self.get_filter_set_search()
        with patch_compound_search_builder_extract_filter_set() as mock_extract_filter_set:
            filter_set_search._get_filter_set()
            mock_extract_filter_set.assert_called_once_with(
                SOME_REQUEST, self.SOME_COMPOUND_SEARCH
            )

    @pytest.mark.parametrize(
        "compound_search,expected",
        [
            ({}, None),
            ({"global_flags": "something"}, "something"),
        ],
    )
    def test_get_global_flags(
        self, compound_search: JsonObject, expected: Union[str, None]
    ) -> None:
        filter_set_search = self.get_filter_set_search(compound_search=compound_search)
        assert filter_set_search._get_global_flags() == expected

    @pytest.mark.parametrize(
        "compound_search,expected",
        [
            ({}, False),
            ({"intersect": False}, False),
            ({"intersect": True}, True),
        ],
    )
    def test_is_intersect(self, compound_search: JsonObject, expected: bool) -> None:
        filter_set_search = self.get_filter_set_search(compound_search=compound_search)
        assert filter_set_search._is_intersect() == expected


class TestSpreadsheetGenerator:

    FILE_NAME = "foobar"
    ROWS_TO_WRITE = [["a"], ["b"]]
    BAD_FILE_FORMAT = "foo"

    def get_spreadsheet_generator(
        self,
        file_name: Optional[str] = None,
        rows_to_write: Optional[Sequence[Sequence[str]]] = None,
        file_format: Optional[str] = None,
    ) -> SpreadsheetGenerator:
        name = file_name or self.FILE_NAME
        to_write = rows_to_write or self.ROWS_TO_WRITE
        if file_format:
            return SpreadsheetGenerator(name, to_write, file_format=file_format)
        else:
            return SpreadsheetGenerator(name, to_write)

    def test_get_streaming_response(self) -> None:
        spreadsheet_generator = self.get_spreadsheet_generator()
        result = spreadsheet_generator.get_streaming_response()
        assert isinstance(result, Response)
        assert isinstance(result.app_iter, Generator)
        assert result.status_code == 200

    @pytest.mark.parametrize(
        "rows_to_write,expected",
        [
            ([["a", "b"], ["c"]], [b'"a"\t"b"\r\n', b'"c"\r\n']),
            ([["a", "b"], [], ["c"]], [b'"a"\t"b"\r\n', b'"c"\r\n']),
            ([[5], [[1, 2]]], [b"5\r\n", b'"[1, 2]"\r\n']),
            ([[{"a": "b"}]], [b"\"{'a': 'b'}\"\r\n"]),
        ],
    )
    def test_stream_spreadsheet(
        self, rows_to_write: List[List[str]], expected: List[str]
    ) -> None:
        spreadsheet_generator = self.get_spreadsheet_generator(
            rows_to_write=rows_to_write
        )
        written_rows = spreadsheet_generator._stream_spreadsheet()
        assert isinstance(written_rows, Generator)
        assert list(written_rows) == expected

    @pytest.mark.parametrize(
        "file_format,exception_expected,expected",
        [
            ("tsv", False, "\t"),
            ("foo", True, ""),
        ],
    )
    def test_get_delimiter(
        self, file_format: str, exception_expected: bool, expected: str
    ) -> None:
        spreadsheet_generator = self.get_spreadsheet_generator(file_format=file_format)
        if exception_expected:
            with pytest.raises(SpreadsheetCreationError):
                spreadsheet_generator._get_delimiter()
        else:
            assert spreadsheet_generator._get_delimiter() == expected

    def test_get_response_headers(self) -> None:
        spreadsheet_generator = self.get_spreadsheet_generator()
        assert spreadsheet_generator._get_response_headers() == {
            "X-Accel-Buffering": "no",
            "Content-Disposition": "attachment; filename=foobar.tsv",
            "Content-Type": "text/tsv",
            "Content-Description": "File Transfer",
            "Cache-Control": "no-store",
        }
