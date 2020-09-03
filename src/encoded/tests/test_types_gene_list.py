import pytest
import mimetypes
import os
import magic
from base64 import b64encode
from unittest import mock
from ..util import get_trusted_email
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


def test_get_genes_txt():
    """Test Gene List creation endpoint."""
    test_file = 'src/encoded/tests/data/documents/gene_lists/test1.txt'
    # gather patch info
    size = os.stat(test_file).st_size
    with open(test_file, 'rb') as stream:
        content = b64encode(stream.read()).decode('ascii')
    guessed_mime = mimetypes.guess_type(test_file)[0]
    detected_mime = magic.from_file(test_file, mime=True)
    assert guessed_mime == detected_mime
    payload = {'size': size,
               'href': content,
               'download': test_file,
               'type': detected_mime}
    genes = get_genes(payload, 'gene_list_uuid')
    expected_genes = ['GENEID1', 'GENEID2', 'ENSG00000000003', 'ENSG00000000004']
    print(genes)
    assert genes == expected_genes


def test_get_genes_xlsx():
    """Test Gene List creation endpoint."""
    test_file = 'src/encoded/tests/data/documents/gene_lists/test2.xlsx'
    # gather patch info
    size = os.stat(test_file).st_size
    with open(test_file, 'rb') as stream:
        content = b64encode(stream.read()).decode('ascii')
    guessed_mime = mimetypes.guess_type(test_file)[0]
    detected_mime = magic.from_file(test_file, mime=True)
    assert guessed_mime == detected_mime
    payload = {'size': size,
               'href': content,
               'download': test_file,
               'type': detected_mime}
    genes = get_genes(payload, 'gene_list_uuid')
    expected_genes = ['GENEID1', 'GENEID2', 'ENSG00000000003', 'ENSG00000000004']
    print(genes)
    assert genes == expected_genes


def test_get_genes_xls():
    """Test Gene List creation endpoint."""
    test_file = 'src/encoded/tests/data/documents/gene_lists/test3.xls'
    # gather patch info
    size = os.stat(test_file).st_size
    with open(test_file, 'rb') as stream:
        content = b64encode(stream.read()).decode('ascii')
    guessed_mime = mimetypes.guess_type(test_file)[0]
    detected_mime = magic.from_file(test_file, mime=True)
    assert guessed_mime == detected_mime
    payload = {'size': size,
               'href': content,
               'download': test_file,
               'type': detected_mime}
    genes = get_genes(payload, 'gene_list_uuid')
    expected_genes = ['GENEID1', 'GENEID2', 'ENSG00000000003', 'ENSG00000000004']
    print(genes)
    assert genes == expected_genes


def test_process_genelist_txt(testapp, project, institution,
                              gene1, gene2, gene3, gene4):
    """Test Gene List creation endpoint."""
    test_file = 'src/encoded/tests/data/documents/gene_lists/test1.txt'
    # create and empty genelist item
    post_body = {'project': project['@id'],
                 'institution': institution['@id'],
                 'title': 'Test Gene List with TXT input'}
    gene_list_item = testapp.post_json('/gene_list', post_body).json['@graph'][0]
    # gather patch info
    size = os.stat(test_file).st_size
    with open(test_file, 'rb') as stream:
        content = b64encode(stream.read()).decode('ascii')
    guessed_mime = mimetypes.guess_type(test_file)[0]
    detected_mime = magic.from_file(test_file, mime=True)
    assert guessed_mime == detected_mime
    payload = {'size': size,
               'href': content,
               'download': test_file,
               'type': detected_mime}
    process_endpoint = gene_list_item['@id'] + 'process-genelist'
    with mock.patch('encoded.types.gene_list.get_trusted_email', return_value='dummy@dummy.com'):
        process_response = testapp.patch_json(process_endpoint, payload).json
        print(process_response)
        assert False