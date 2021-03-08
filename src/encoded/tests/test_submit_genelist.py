import pytest

from ..submit_genelist import (
        submit_genelist,
        GeneListSubmission
)


@pytest.fixture
def genes(testapp, project, institution):
    gene1 = {
            'institution': institution['@id'],
            'project': project['@id'],
            'gene_symbol': 'NLGN4Y',
            'ensgid': 'ENSG00000165246'
    }
    gene2 = {
            'institution': institution['@id'],
            'project': project['@id'],
            'gene_symbol': 'USP9Y',
            'ensgid': 'ENSG00000165247'
    }
    gene3 = {
            'institution': institution['@id'],
            'project': project['@id'],
            'gene_symbol': 'TSPY8',
            'ensgid': 'ENSG00000165248'
    }
    genes = [gene1, gene2, gene3]
    for gene in genes:
        resp = testapp.post_json(
                '/genes/',
                gene
        )
        print(resp)
    return


class TestGeneListSubmission:

    def test_parse_genelist(self, project, institution, testapp, genes):
        genelist = GeneListSubmission(
                'src/encoded/tests/data/documents/gene_lists/DRR_test_gene_list.txt',
                project,
                institution,
                testapp
        )
        assert len(genelist.genes) == 3
        assert genelist.title == 'Example Gene List'
