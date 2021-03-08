import pytest

from ..submit_genelist import (
        submit_genelist,
        GeneListSubmission
)


class TestGeneListSubmission:

    def test_parse_genelist(self, project, institution, testapp):
        genelist = GeneListSubmission(
                '/Users/drioux/CGAP/cgap_wrangling/data/gene_lists/DRR_test_gene_list.txt',
                project,
                institution,
                testapp
        )
        assert len(genelist.genes) == 3
        assert genelist.title == 'Example Gene List'
