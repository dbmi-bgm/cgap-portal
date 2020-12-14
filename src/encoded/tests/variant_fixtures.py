import pytest
import json
from ..util import resolve_file_path
from ..commands.ingest_genes import GeneIngestion


GENES_LOC = resolve_file_path('tests/data/variant_workbook/gene_inserts_partial.json')
GENE_WORKBOOK = resolve_file_path('tests/data/variant_workbook/gene_workbook.json')
VARIANT_CONSEQUENCE_LOC = resolve_file_path('annotations/variant_consequence.json')
MAX_POSTS_FOR_TESTING = 5
ANNOTATION_FIELD_URL = '/annotation_field'
GENE_ANNOTATION_FIELD_URL = '/gene_annotation_field'
VARIANT_URL = '/variant'
VARIANT_SAMPLE_URL = '/variant_sample'
GENE_URL = '/gene'


@pytest.fixture
def test_genes():
    genes = GeneIngestion(GENES_LOC)
    return genes


@pytest.fixture
def genes(workbook, es_testapp, test_genes):
    """ Fixture that posts a subset of genes """
    for gene in test_genes:
        gene['project'] = 'hms-dbmi'
        gene['institution'] = 'hms-dbmi'
        es_testapp.post_json(GENE_URL, gene, status=201)
