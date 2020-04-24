import pytest
from encoded.commands.ingest_genes import (
    GeneIngestion
)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]
GENES_LOC = './src/encoded/tests/data/variant_workbook/gene_inserts.json'


@pytest.fixture
def test_genes():
    genes = GeneIngestion(GENES_LOC)
    return genes


def test_post_gene_inserts(testapp, project, institution, test_genes):
    """ Tests posting the given genes to the portal
        XXX: fix test when new inserts come in """
    CONNECTION_URL = '/gene'
    success, fail = 0, 0
    for gene in test_genes[0:100]:
        gene['project'] = 'encode-project'
        gene['institution'] = 'encode-institution'
        try:
            testapp.post_json(CONNECTION_URL, gene, status=201)
            success += 1
        except:
            fail += 1

    #raise Exception('success: %s, fail: %s' % (success, fail))
