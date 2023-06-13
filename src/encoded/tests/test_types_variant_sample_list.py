import pytest
from webtest.app import TestApp

from .test_drr_batch_download import EXPECTED_VARIANT_SAMPLE_SPREADSHEET_COLUMNS, parse_spreadsheet_response
from ..types.variant import get_variant_sample_spreadsheet_file_name


@pytest.mark.workbook
def test_variant_sample_list_spreadsheet(es_testapp: TestApp, workbook: None) -> None:
    """Integrated test of associated VariantSample spreadsheet download.

    Ensure all fields present on at least one VariantSample included in
    the spreadsheet.
    """
    item_uuid = "292250e7-5cb7-4543-85b2-80cd318287b2"
    item_spreadsheet_endpoint = f"/variant-sample-lists/{item_uuid}/@@spreadsheet/?file_format=tsv"
    response = es_testapp.get(item_spreadsheet_endpoint, status=200)
    spreadsheet_rows = parse_spreadsheet_response(response)
    spreadsheet_columns = list(zip(*spreadsheet_rows))
    assert len(spreadsheet_rows) == 4
    assert spreadsheet_columns == EXPECTED_VARIANT_SAMPLE_SPREADSHEET_COLUMNS
