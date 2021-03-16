import pytest

from ..submit_genelist import GeneListSubmission

pytestmark = [pytest.mark.setone, pytest.mark.working]


@pytest.fixture
def project(es_testapp, workbook):
    project = es_testapp.get("/search/?type=Project").json["@graph"][0]
    return project


@pytest.fixture
def institution(es_testapp, workbook):
    institution = es_testapp.get("/search/?type=Institution").json["@graph"][0]
    return institution


class TestGeneListSubmission:
    def test_normal_genelist(self, es_testapp, workbook, project, institution):
        """
        Tests for full gene list functionality given gene list with all genes
        identifiable in the database.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-parse_gene_list.txt",
            project["@id"],
            institution["@id"],
            es_testapp,
        )
        assert len(genelist.genes) == 3
        assert genelist.title == "Example Gene List"
        assert len(genelist.gene_ids) == 3
        assert len(genelist.post_bodies) == 2
        assert project["@id"] == genelist.post_bodies[0]["project"]
        assert institution["@id"] == genelist.post_bodies[0]["institution"]
        assert genelist.post_bodies[1]["genes"] == genelist.gene_ids
        assert genelist.title in genelist.post_bodies[1]["title"]
        assert genelist.validation_output
        assert genelist.post_output
        assert genelist.variants_queued == "success"

    def test_parse_empty_genelist(
        self, es_testapp, workbook, project, institution
    ):
        """
        Tests for detection of empty gene list and no title.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-empty_gene_list.txt",
            project["@id"],
            institution["@id"],
            es_testapp,
        )
        assert not genelist.title
        assert not genelist.genes
        assert genelist.errors

    def test_match_genes(self, es_testapp, workbook, project, institution):
        """
        Tests for matching of genes given various ID types (correct gene
        symbol, previous symbol, OMIM ID, etc.) as well as removal of duplicate
        items in the gene list that both point to the same gene item via
        different names.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-match_gene_list.txt",
            project["@id"],
            institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3

    def test_no_match_genes(self, es_testapp, workbook, project, institution):
        """
        Ensure genes that don't match any existing genes are identified and
        possible alternative genes are provided, if applicable. Also, no
        posting should occur in this scenario.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-no-match_gene_list.txt",
            project["@id"],
            institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3
        assert genelist.errors
        assert not genelist.post_output

    def test_validate_and_post(
        self, es_testapp, workbook, project, institution
    ):
        """
        Test for correct validation but no posting of document and gene list
        when some genes are not identified in the database.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-no-match_gene_list.txt",
            project["@id"],
            institution["@id"],
            es_testapp,
        )
        assert genelist.validation_output
        assert not genelist.post_output

    def test_existing_title(self, es_testapp, workbook, project, institution):
        """
        Ensure gene list and document are patched if attempting to submit gene
        list with title identical to the title of a previously created gene
        list associated with the project.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-previous-title_gene_list.txt",
            project["@id"],
            institution["@id"],
            es_testapp,
        )
        assert genelist.patch_genelist_uuid
        assert genelist.patch_document_uuid
