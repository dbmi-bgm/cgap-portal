import pytest
from .variant_fixtures import test_genes, GENE_URL  # noqa (fixture)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]


def test_post_gene_inserts(testapp, project, institution, test_genes):
    """ Tests posting a subset of the given genes to the portal """
    for gene in test_genes:
        gene['project'] = 'encode-project'
        gene['institution'] = 'encode-institution'
        testapp.post_json(GENE_URL, gene, status=201)


def test_post_gene_inserts_via_upload(testapp, project, institution, test_genes):
    """ Attempts to post using the upload method """
    test_genes.upload(testapp, project='encode-project', institution='encode-institution')
