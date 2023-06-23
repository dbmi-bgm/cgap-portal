import pytest
from webtest.app import TestApp

from ..util import JsonObject


QUALITY_METRIC_UUID = "c2fda3d3-6330-4a97-acfc-abb443440681"


@pytest.fixture
def quality_metric_generic(
    testapp: TestApp, project: JsonObject, institution: JsonObject
) -> JsonObject:
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "uuid": QUALITY_METRIC_UUID,
        "name": "Great QC",
    }
    return testapp.post_json("/quality_metric_generic", item, status=201).json[
        "@graph"
    ][0]


def test_href(quality_metric_generic: JsonObject) -> None:
    href = quality_metric_generic["href"]
    expected = (
        f"/quality-metrics-generic/{QUALITY_METRIC_UUID}/@@download"
        f"/{QUALITY_METRIC_UUID}"
    )
    assert href == expected
