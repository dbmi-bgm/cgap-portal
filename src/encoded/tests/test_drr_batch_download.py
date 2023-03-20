import json
from contextlib import contextmanager
from unittest import mock
from typing import Any, Mapping, Optional, Union

import pytest
from webtest import TestApp

from .. import drr_batch_download as drr_batch_download_module
from ..drr_batch_download import (
    CASE_SPREADSHEET_URL, SpreadsheetPost,
    VariantSampleForSpreadsheet
)


def test_get_request_body(testapp: TestApp) -> None:
    testapp.post_json(CASE_SPREADSHEET_URL, {}, status=200)


class CommonConstants:

    SOME_REQUEST = "some request"


class Patches:

    @staticmethod
    @contextmanager
    def patch_property(
        target: str, attribute: str, return_value: Optional[Any] = None
    ) -> mock.PropertyMock:
        with mock.patch.object(
            target, attribute, new=mock.PropertyMock(return_value=return_value)
        ) as mock_property:
            yield mock_property

    @staticmethod
    @contextmanager
    def patch_post_parameters(**kwargs) -> mock.PropertyMock:
        with Patches.patch_property(SpreadsheetPost, "parameters", **kwargs) as mock_property:
            yield mock_property


class TestSpreadsheetPost:

    SOME_FILE_FORMAT = 'some_file_format'
    SOME_CASE_ACCESSION = 'some_case_accession'
    SOME_CASE_TITLE = 'some_case_title'
    SOME_COMPOUND_SEARCH_REQUEST = {"foo": 'some_compound_search_request'}
    SOME_JSON_COMPOUND_SEARCH_REQUEST = json.dumps(SOME_COMPOUND_SEARCH_REQUEST)

    def spreadsheet_post(self) -> SpreadsheetPost:
        return SpreadsheetPost(CommonConstants.SOME_REQUEST)

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, "tsv"),
            ({SpreadsheetPost.FILE_FORMAT: SOME_FILE_FORMAT}, SOME_FILE_FORMAT),
        ]
    )
    def test_get_file_format(self, parameters: Mapping, expected: str) -> None:
        with Patches.patch_post_parameters(return_value=parameters):
            spreadsheet_post = self.spreadsheet_post()
            assert spreadsheet_post.get_file_format() == expected

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, ""),
            ({SpreadsheetPost.CASE_ACCESSION: SOME_CASE_ACCESSION}, SOME_CASE_ACCESSION),
        ]
    )
    def test_get_case_accession(self, parameters, expected) -> None:
        with Patches.patch_post_parameters(return_value=parameters):
            spreadsheet_post = self.spreadsheet_post()
            assert spreadsheet_post.get_case_accession() == expected

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, ""),
            ({SpreadsheetPost.CASE_TITLE: SOME_CASE_TITLE}, SOME_CASE_TITLE),
        ]
    )
    def test_get_case_title(self, parameters, expected) -> None:
        with Patches.patch_post_parameters(return_value=parameters):
            spreadsheet_post = self.spreadsheet_post()
            assert spreadsheet_post.get_case_title() == expected

    @pytest.mark.parametrize(
        "parameters,expected",
        [
            ({}, {}),
            ({SpreadsheetPost.COMPOUND_SEARCH_REQUEST: SOME_COMPOUND_SEARCH_REQUEST}, SOME_COMPOUND_SEARCH_REQUEST),
            ({SpreadsheetPost.COMPOUND_SEARCH_REQUEST: SOME_JSON_COMPOUND_SEARCH_REQUEST}, SOME_COMPOUND_SEARCH_REQUEST),
        ]
    )
    def test_get_associated_compound_search(self, parameters, expected) -> None:
        with Patches.patch_post_parameters(return_value=parameters):
            spreadsheet_post = self.spreadsheet_post()
            assert spreadsheet_post.get_associated_compound_search() == expected
