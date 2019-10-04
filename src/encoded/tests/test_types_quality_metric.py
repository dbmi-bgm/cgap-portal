import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def qc_bamcheck_data1(institution, project):
    return {
        "uuid": "af8e47c1-35bd-46fd-8a2e-e5d7b89560aa",
        'institution': institution['@id'],
        'project': project['@id'],
        "number_of_lines": 1234567,
        "quickcheck": "OK"
    }


@pytest.fixture
def qc_bamcheck_data2(institution, project):
    return {
        "uuid": "af8e47c1-35bd-46fd-8a2e-e5d7b89560ab",
        'institution': institution['@id'],
        'project': project['@id'],
        "number_of_lines": 1234568,
        "quickcheck": " not OK"
    }


def test_overall_quality_pass(testapp, qc_bamcheck_data1):
    res = testapp.post_json('/quality_metric_bamcheck', qc_bamcheck_data1, status=201)
    assert res.json['@graph'][0]['overall_quality_status'] == "PASS"


def test_overall_quality_fail(testapp, qc_bamcheck_data2):
    res = testapp.post_json('/quality_metric_bamcheck', qc_bamcheck_data2, status=201)
    assert res.json['@graph'][0]['overall_quality_status'] == "FAIL"
