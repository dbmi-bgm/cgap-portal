import pytest
import mimetypes
import os
import magic
from base64 import b64encode
from ..types.gene_list import (
    get_genes,
    )
pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def gene1(testapp, project, institution):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "gene_symbol": "GENEID1",
        "ensgid": "ENSG00000000001"
    }
    return testapp.post_json('/gene', item).json['@graph'][0]


@pytest.fixture
def gene2(testapp, project, institution):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "gene_symbol": "GENEID2",
        "ensgid": "ENSG00000000002"
    }
    return testapp.post_json('/gene', item).json['@graph'][0]


@pytest.fixture
def gene3(testapp, project, institution):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "gene_symbol": "GENEID3",
        "ensgid": "ENSG00000000003"
    }
    return testapp.post_json('/gene', item).json['@graph'][0]


@pytest.fixture
def gene4(testapp, project, institution):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "gene_symbol": "GENEID4",
        "ensgid": "ENSG00000000004"
    }
    return testapp.post_json('/gene', item).json['@graph'][0]


def test_rev_link_on_genes(testapp, project, institution, gene1, gene2, gene3, gene4):
    post_body = {
        'project': project['@id'],
        'institution': institution['@id'],
        'title': 'Basic Gene List',
        'genes': [gene1['@id'], gene2['@id'], gene3['@id'], gene4['@id']]
        }
    testapp.post_json('/gene_list', post_body)
    gene1_item = testapp.get(gene1['@id']).json
    assert gene1_item['gene_lists'][0]['title'] == post_body['title']
    assert gene1_item['gene_lists'][0]['display_title'] == post_body['title']
