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
def genes(es_testapp, workbook, test_genes):
    """ Fixture that posts a subset of genes """
    for gene in test_genes:
        gene['project'] = 'hms-dbmi'
        gene['institution'] = 'hms-dbmi'
        es_testapp.post_json(GENE_URL, gene, status=201)


@pytest.fixture(scope='session')
def gene_workbook(es_testapp, workbook):
    """ Posts Genes required for the first few variants in the test VCF up to NUMBER_TO_POST """
    genes = json.load(open(GENE_WORKBOOK, 'r'))
    for entry in genes:
        entry['project'] = 'hms-dbmi'
        entry['institution'] = 'hms-dbmi'
        es_testapp.post_json(GENE_URL, entry, status=201)
