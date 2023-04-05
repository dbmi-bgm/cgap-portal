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


def test_case_search_spreadsheet(es_testapp: TestApp, workbook: None) -> None:
    case_search_compound_filterset = (
        {
            "search_type": "Case",
            "global_flags": "case_id=CASE10254-S1-C1",
        }
    )
    post_body = {"compound_search_request": json.dumps(case_search_compound_filterset)}
    response = es_testapp.post_json(
        CASE_SPREADSHEET_URL,
        post_body,
        status=200,
    )
    rows = response.body.decode().split("\n")
    assert rows
