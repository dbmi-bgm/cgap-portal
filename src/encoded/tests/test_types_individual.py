from typing import List, Union

import pytest
from webtest.app import TestApp

from .utils import get_identifier


pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def MIndividual():
    return {
        "project": "encode-project",
        "institution": "encode-institution",
        "sex": "M",
    }


@pytest.fixture
def WIndividual():
    return {
        "project": "encode-project",
        "institution": "encode-institution",
        "sex": "F",
    }


def test_post_valid_individuals(
    testapp, project, institution, MIndividual, WIndividual
):
    """Posts valid individuals"""
    testapp.post_json("/individual", MIndividual, status=201)
    res = testapp.post_json("/individual", WIndividual, status=201)
    assert "display_title" in res


def test_patch_invalid_sex(testapp, project, institution, MIndividual):
    """Checks 'U' first then tries 'Y' which should fail"""
    res = testapp.post_json("/individual", MIndividual, status=201).json["@graph"][0]
    testapp.patch_json(res["@id"], {"sex": "U"}, status=200)
    testapp.patch_json(res["@id"], {"sex": "Y"}, status=422)


def test_patch_invalid_project_inst(testapp, project, institution, MIndividual):
    """Tries to patch invalid projects and institutions"""
    res = testapp.post_json("/individual", MIndividual, status=201).json["@graph"][0]
    testapp.patch_json(res["@id"], {"project": "does not exist"}, status=422)
    testapp.patch_json(res["@id"], {"institution": "does not exist"}, status=422)


def test_individual_children(testapp, project, institution, MIndividual, WIndividual):
    res_m = testapp.post_json("/individual", MIndividual, status=201).json["@graph"][0]
    WIndividual["father"] = res_m["@id"]
    res_f = testapp.post_json("/individual", WIndividual, status=201).json["@graph"][0]
    children = testapp.get(res_m["@id"]).json.get("children")
    assert len(children) == 1
    assert children[0]["@id"] == res_f["@id"]


def test_individual_families(testapp, fam, mother):
    assert mother.get("families") is None
    mom = testapp.get(mother["@id"]).json
    assert [f["@id"] for f in mom.get("families")] == [fam["@id"]]


def test_individual_case(testapp, child, a_case):
    assert child.get("case") is None
    case = testapp.post_json("/case", a_case, status=201).json["@graph"][0]
    child_res = testapp.get(child["@id"]).json
    assert len(child_res.get("case", [])) == 1
    assert child_res["case"][0]["@id"] == case["@id"]


@pytest.mark.workbook
@pytest.mark.parametrize(
    "individual_identifier,expected",
    [
        ("GAPIDISC7R73", None),
        (
            "GAPIDISC7R74",
            [
                "/disorders/DD1/",
                "/disorders/DD3/",
            ],
        ),
    ],
)
def test_primary_disorders(
    individual_identifier: str,
    expected: Union[List[str], None],
    es_testapp: TestApp,
    workbook: None,
) -> None:
    individual_properties = get_identifier(es_testapp, individual_identifier)
    assert individual_properties.get("primary_disorders") == expected
