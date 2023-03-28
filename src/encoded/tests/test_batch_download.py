from contextlib import contextmanager
from unittest import mock
from typing import Any, Iterable

import pytest

from .utils import patch_context
from .. import drr_batch_download as batch_download_module
from ..batch_download_utils import (
    OrderedSpreadsheetColumn, SpreadsheetColumn, SpreadsheetCreationError
)
from ..drr_batch_download import VariantSampleSpreadsheet
from ..drr_item_models import Note, VariantSample


SOME_TITLE = "title"
SOME_DESCRIPTION = "description"
SOME_PROPERTY_COLUMN_TUPLE = (SOME_TITLE, SOME_DESCRIPTION, "fu")
SOME_CALLABLE_COLUMN_TUPLE = (SOME_TITLE, SOME_DESCRIPTION, print)
SOME_COLUMN_TUPLES = [SOME_PROPERTY_COLUMN_TUPLE, SOME_CALLABLE_COLUMN_TUPLE]
SOME_SPREADSHEET_COLUMNS = [SpreadsheetColumn(*column) for column in SOME_COLUMN_TUPLES]


@contextmanager
def patch_variant_sample_spreadsheet_column_tuples(**kwargs):
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet,
        "_get_column_tuples",
        **kwargs,
    ) as mock_get_column_tuples:
        yield mock_get_column_tuples


@contextmanager
def patch_variant_sample_spreadsheet_columns(**kwargs):
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet,
        "_spreadsheet_columns",
        new_callable=mock.PropertyMock,
        **kwargs,
    ) as mock_get_columns:
        yield mock_get_columns


@contextmanager
def patch_evaluate_item_with_column(**kwargs):
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet,
        "_evaluate_item_with_column",
        **kwargs
    ) as mock_evaluate_item:
        yield mock_evaluate_item


@contextmanager
def patch_variant_sample(**kwargs):
    with patch_context(
        batch_download_module,
        "VariantSample",
        **kwargs,
    ) as mock_variant_sample:
        yield mock_variant_sample


@contextmanager
def patch_get_note_properties(**kwargs):
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet,
        "_get_note_properties",
        **kwargs,
    ) as mock_get_note_properties:
        yield mock_get_note_properties


@contextmanager
def patch_get_values_for_field(**kwargs):
    with patch_context(
        batch_download_module,
        "get_values_for_field",
        **kwargs
    ) as mock_get_values_for_field:
        yield mock_get_values_for_field


def mock_variant_sample() -> mock.MagicMock:
    return mock.create_autospec(VariantSample, instance=True)


def mock_note() -> mock.MagicMock:
    return mock.create_autospec(Note, instance=True)


def assert_column_tuples(column_tuples: Iterable[OrderedSpreadsheetColumn]) -> None:
    # Should be an easier way to do this with the annotation type directly...
    assert isinstance(column_tuples, Iterable)
    for column_tuple in column_tuples:
        assert len(column_tuple) == 3
        (title, description, evaluator) = column_tuple
        assert isinstance(title, str)
        assert isinstance(description, str)
        assert isinstance(evaluator, str) or callable(evaluator)


class TestVariantSampleSpreadsheet:

    SOME_VARIANT_SAMPLE_PROPERTIES = {"variant": "something"}
    SOME_VARIANT_SAMPLE = VariantSample(SOME_VARIANT_SAMPLE_PROPERTIES)

    def get_variant_sample_spreadsheet(self) -> VariantSampleSpreadsheet:
        return VariantSampleSpreadsheet([self.SOME_VARIANT_SAMPLE_PROPERTIES])

    def test_get_column_titles(self) -> None:
        with patch_variant_sample_spreadsheet_column_tuples(
            return_value=SOME_COLUMN_TUPLES
        ):
            spreadsheet = self.get_variant_sample_spreadsheet()
            result = spreadsheet._get_column_titles()
            assert list(result) == [SOME_TITLE] * 2

    def test_get_column_descriptions(self) -> None:
        with patch_variant_sample_spreadsheet_column_tuples(
            return_value=SOME_COLUMN_TUPLES
        ):
            spreadsheet = self.get_variant_sample_spreadsheet()
            result = spreadsheet._get_column_descriptions()
            assert list(result) == [SOME_DESCRIPTION] * 2

    def test_get_row_for_item(self) -> None:
        expected_result_count = len(SOME_COLUMN_TUPLES)
        with patch_variant_sample_spreadsheet_columns(
            return_value=SOME_SPREADSHEET_COLUMNS
        ):
            with patch_evaluate_item_with_column() as mock_evaluate_item_with_column:
                with patch_variant_sample(
                    return_value=self.SOME_VARIANT_SAMPLE
                ):
                    spreadsheet = self.get_variant_sample_spreadsheet()
                    result_generator = spreadsheet._get_row_for_item(self.SOME_VARIANT_SAMPLE_PROPERTIES)
                    result = list(result_generator)
                    assert len(result) == expected_result_count
                    assert len(mock_evaluate_item_with_column.call_args_list) == expected_result_count
                    for column in SOME_SPREADSHEET_COLUMNS:
                        mock_evaluate_item_with_column.assert_any_call(
                            column, self.SOME_VARIANT_SAMPLE
                        )



    @pytest.mark.parametrize(
        (
            "is_property_evaluator,is_callable_evaluator,expected_exception,"
            "expected_field_for_item_call"
        ),
        [
            (True, False, False, SOME_VARIANT_SAMPLE_PROPERTIES),
            (False, True, False, SOME_VARIANT_SAMPLE),
            (True, True, False, SOME_VARIANT_SAMPLE_PROPERTIES),
            (False, False, True, None),
        ]
    )
    def test_evaluate_item_with_column(
        self, is_property_evaluator: bool, is_callable_evaluator: bool,
        expected_exception: bool, expected_field_for_item_call: Any,
    ) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        column = self.make_mock_column(is_property_evaluator, is_callable_evaluator)
        if expected_exception:
            with pytest.raises(SpreadsheetCreationError):
                spreadsheet._evaluate_item_with_column(column, self.SOME_VARIANT_SAMPLE)
        else:
            result = spreadsheet._evaluate_item_with_column(column, self.SOME_VARIANT_SAMPLE)
            assert result == column.get_field_for_item.return_value
            column.get_field_for_item.assert_called_once_with(expected_field_for_item_call)

    def make_mock_column(
        self, is_property_evaluator: bool, is_callable_evaluator: bool
    ) -> mock.MagicMock:
        column = mock.create_autospec(SpreadsheetColumn, instance=True)
        column.is_property_evaluator.return_value = is_property_evaluator
        column.is_callable_evaluator.return_value = is_callable_evaluator
        return column

    def test_get_column_tuples(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        result = spreadsheet._get_column_tuples()
        assert_column_tuples(result)

    def test_get_canonical_transcript_feature(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_canonical_transcript_feature(variant_sample)
        assert result == variant_sample.get_canonical_transcript_feature.return_value

    def test_get_canonical_transcript_location(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_canonical_transcript_location(variant_sample)
        assert result == variant_sample.get_canonical_transcript_location.return_value

    def test_get_canonical_transcript_consequence_display_title(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_canonical_transcript_consequence_display_title(variant_sample)
        assert result == variant_sample.get_canonical_transcript_consequence_display_title.return_value

    def test_get_most_severe_transcript_feature(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_most_severe_transcript_feature(variant_sample)
        assert result == variant_sample.get_most_severe_transcript_feature.return_value

    def test_get_most_severe_transcript_location(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_most_severe_transcript_location(variant_sample)
        assert result == variant_sample.get_most_severe_transcript_location.return_value

    def test_get_most_severe_transcript_consequence_display_title(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_most_severe_transcript_consequence_display_title(variant_sample)
        assert result == variant_sample.get_most_severe_transcript_consequence_display_title.return_value


    def test_get_gnomad_v3_popmax_population(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_gnomad_v3_popmax_population(variant_sample)
        assert result == variant_sample.get_gnomad_v3_popmax_population.return_value

    def test_get_gnomad_v2_popmax_population(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_gnomad_v2_popmax_population(variant_sample)
        assert result == variant_sample.get_gnomad_v2_popmax_population.return_value

    def test_get_note_of_same_project(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        property_location = "foo"
        property_to_retrieve = "bar"
        with patch_get_note_properties() as mock_get_note_properties:
            result = spreadsheet._get_note_of_same_project(property_location,
                                                             property_to_retrieve)
            assert callable(result)
            assert result.func == mock_get_note_properties
            assert not result.args
            assert result.keywords == {
                "note_property_location": property_location,
                "note_property_to_retrieve": property_to_retrieve
            }

    @pytest.mark.parametrize(
        "note_found,expected",
        [
            (False, False), 
            (True, True),
        ]
    )
    def test_get_note_properties(self, note_found: bool, expected: bool) -> None:
        note_property_location = "foo"
        note_property_to_retrieve = "bar"
        note_property_value = "foobar"
        variant_sample = mock_variant_sample()
        note = mock_note()
        if note_found:
            variant_sample.get_note_of_same_project.return_value = note
        else:
            variant_sample.get_note_of_same_project.return_value = None
        with patch_get_values_for_field(
            return_value=note_property_value
        ) as mock_get_values_for_field:
            spreadsheet = self.get_variant_sample_spreadsheet()
            result = spreadsheet._get_note_properties(
                variant_sample,
                note_property_location=note_property_location,
                note_property_to_retrieve=note_property_to_retrieve,
            )
            variant_sample.get_note_of_same_project.assert_called_once_with(
                note_property_location
            )
            if note_found:
                mock_get_values_for_field.assert_called_once_with(
                    note.get_properties.return_value, note_property_to_retrieve
                )
            else:
                mock_get_values_for_field.assert_not_called()
            if expected:
                assert result == note_property_value
            else:
                assert result == ""
