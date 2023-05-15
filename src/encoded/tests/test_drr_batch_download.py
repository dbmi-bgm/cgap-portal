import json
from contextlib import contextmanager
from unittest import mock
from typing import Any, Mapping, Optional, Union

import pytest
from webtest import TestApp

from .utils import patch_context
from .. import drr_batch_download as drr_batch_download_module
from ..drr_batch_download import (
    CASE_SPREADSHEET_URL,
    SpreadsheetPost,
)
from ..util import APPLICATION_FORM_ENCODED_MIME_TYPE


def test_case_search_spreadsheet(html_es_testapp: TestApp, es_testapp: TestApp, workbook: None) -> None:
    """Test all fields of case search spreadsheet.

    Test with both a JSON and an HTML form POST, as the latter is used
    by front-end in production.
    """
    case_search_compound_filterset = (
        {
            "search_type": "Case",
            "global_flags": "case_id=CASE10254-S1-C1",
        }
    )
    post_body = {"compound_search_request": json.dumps(case_search_compound_filterset)}
    json_post_response = es_testapp.post_json(
        CASE_SPREADSHEET_URL,
        post_body,
        status=200,
    )
    json_post_rows = [row for row in json_post_response.body.decode().split("\n") if row]

    form_post_response = html_es_testapp.post(
        CASE_SPREADSHEET_URL,
        post_body,
        content_type=APPLICATION_FORM_ENCODED_MIME_TYPE,
        status=200,
    )
    form_post_rows = [row for row in form_post_response.body.decode().split("\n") if row]

    assert json_post_rows == form_post_rows

    rows = json_post_rows
    assert len(rows) == 3
