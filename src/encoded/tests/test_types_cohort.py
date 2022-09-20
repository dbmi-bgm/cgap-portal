import pytest


pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def empty_sample_processing(testapp, cgap_core_project, institution):
    """A simple SampleProcessing."""
    item = {
        "project": cgap_core_project["@id"],
        "institution": institution["@id"],
    }
    result = testapp.post_json("/sample_processing", item).json["@graph"][0]
    return result


@pytest.fixture
def empty_cohort(testapp, cgap_core_project, institution, empty_sample_processing):
    """A simple Cohort."""
    item = {
        "project": cgap_core_project["@id"],
        "institution": institution["@id"],
        "sample_processings": [empty_sample_processing["@id"]],
    }
    result = testapp.post_json("/cohort", item).json["@graph"][0]
    return result


def test_display_title(testapp, empty_cohort):
    """Test display title calcprop."""
    accession = empty_cohort.get("accession")
    assert empty_cohort.get("display_title") == accession

    title = "Some title"
    patch_body = {"title": title}
    result = testapp.patch_json(
        empty_cohort["@id"], patch_body, status=200
    ).json["@graph"][0]
    assert result.get("display_title") == f"{title} ({accession})"
