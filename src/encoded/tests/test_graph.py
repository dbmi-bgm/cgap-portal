import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_graph_dot(es_testapp, workbook):
    res = es_testapp.get('/profiles/graph.dot', status=200)
    assert res.content_type == 'text/vnd.graphviz'
    assert res.text


def test_graph_svg(es_testapp, workbook):
    res = es_testapp.get('/profiles/graph.svg', status=200)
    assert res.content_type == 'image/svg+xml'
    assert res.text
