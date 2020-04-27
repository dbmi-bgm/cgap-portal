import pytest
from encoded.commands.ingest_genes import (
    GeneIngestion
)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]
GENES_LOC = './src/encoded/tests/data/variant_workbook/gene_inserts_partial.json'


@pytest.fixture
def test_genes():
    genes = GeneIngestion(GENES_LOC)
    return genes


def test_post_gene_inserts(testapp, project, institution, test_genes):
    """ Tests posting a subset of the given genes to the portal """
    CONNECTION_URL = '/gene'
    for gene in test_genes:
        gene['project'] = 'encode-project'
        gene['institution'] = 'encode-institution'
        testapp.post_json(CONNECTION_URL, gene, status=201)
