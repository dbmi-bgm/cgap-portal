import json
from contextlib import contextmanager
from unittest import mock
from typing import Any, List, Mapping, Optional, Union

import pytest
from webtest import TestApp
from webtest.response import TestResponse

from .utils import patch_context
from .. import drr_batch_download as drr_batch_download_module
from ..drr_batch_download import (
    CASE_SPREADSHEET_URL,
    SpreadsheetPost,
)
from ..util import APPLICATION_FORM_ENCODED_MIME_TYPE


EXPECTED_CASE_SPREADSHEET_COLUMNS = [
    ("# Case identifier", "Case ID", "CASE10254-S1-C1"),
    ("Unique database identifier", "UUID", "165ad0fb-7acb-469e-bc1e-eb2fc6f94c82"),
    ("Individual identifier", "Individual ID", "BRCA proband"),
    ("Sex of associated individual", "Individual sex", "M"),
    ("Whether case is for a proband", "Proband case", "False"),
    ("Family identifier", "Family ID", "BRCA-001"),
    ("Analysis type", "Analysis type", "WES-Group"),
    ("Primary sample identifier", "Sample ID", "BRCA_proband_sample"),
    ("Primary sample sequencing type", "Sequencing", "WES"),
    ("Overall QC flag", "QC flag", "fail"),
    ("Completed QC steps", "Completed QC", "BAM, SNV, SV"),
    (
        "QC steps with warning flags",
        "QC warnings",
        "predicted_sex, heterozygosity_ratio",
    ),
    (
        "QC steps with failure flags",
        "QC failures",
        "coverage, transition_transversion_ratio",
    ),
]


def parse_spreadsheet_response(response: TestResponse) -> List[List[str]]:
    result = []
    for row in response.body.decode().split("\n"):
        if not row:
            continue
        formatted_row = []
        cells = row.strip("\r").split("\t")
        for cell in cells:
            formatted_cell = cell.strip('"')
            formatted_row.append(formatted_cell)
        result.append(formatted_row)
    return result


def test_case_search_spreadsheet(html_es_testapp: TestApp, es_testapp: TestApp, workbook: None) -> None:
    """Integrated test of case search spreadsheet.

    Ensure all fields present on at least one Case included in the
    spreadsheet.

    Test with both a JSON and an HTML form POST; the latter is used by
    front-end in production.
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
    json_post_rows = parse_spreadsheet_response(json_post_response)

    form_post_response = html_es_testapp.post(
        CASE_SPREADSHEET_URL,
        post_body,
        content_type=APPLICATION_FORM_ENCODED_MIME_TYPE,
        status=200,
    )
    form_post_rows = parse_spreadsheet_response(form_post_response)

    assert json_post_rows == form_post_rows

    rows = json_post_rows
    assert len(rows) == 3

    columns = list(zip(*rows))
    assert columns == EXPECTED_CASE_SPREADSHEET_COLUMNS


def test_variant_sample_spreadsheet_download(
    html_es_testapp: TestApp, es_testapp: TestApp, workbook: None
) -> None:

