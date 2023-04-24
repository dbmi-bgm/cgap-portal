from typing import List, Union

import pytest
from webtest.app import TestApp

from .utils import get_identifier, get_identifier_path


@pytest.mark.workbook
@pytest.mark.parametrize(
    "somatic_analysis_identifier,expected",
    [
        ("hms-dbmi:somatic_analysis_no_samples", None),
        ("hms-dbmi:somatic_analysis_tumor_normal", "/individuals/GAPIDISC7R74/"),
    ],
)
def test_individual(somatic_analysis_identifier: str, expected: Union[List[str], None], es_testapp: TestApp, workbook: None) -> None:
    somatic_analysis = get_identifier(es_testapp, somatic_analysis_identifier)
    assert somatic_analysis.get("individual") == expected


@pytest.mark.workbook
def test_post_samples_with_multiple_individuals(es_testapp: TestApp, workbook: None) -> None:
    post_body = {
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
        "samples": ["hms-dbmi:normal_sample_3", "hms-dbmi:sample_1"],
    }
    es_testapp.post_json("/somatic-analyses/", post_body, status=400)


@pytest.mark.workbook
def test_patch_samples_with_multiple_individuals(es_testapp: TestApp, workbook: None) -> None:
    patch_body = {"samples": ["hms-dbmi:normal_sample_3", "hms-dbmi:sample_1"]}
    to_patch_identifier = "hms-dbmi:somatic_analysis_tumor_normal"
    to_patch = get_identifier_path(to_patch_identifier)
    es_testapp.patch_json(to_patch, patch_body, status=400)
