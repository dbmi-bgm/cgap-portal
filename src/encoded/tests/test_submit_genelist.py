import pytest

from ..submit_genelist import GeneListSubmission

pytestmark = [pytest.mark.setone, pytest.mark.working]


class TestGeneListSubmission:
    def test_normal_genelist(self, es_testapp, workbook):
        """
        Tests for full gene list functionality given gene list with all genes
        identifiable in the database.
        """
        project = es_testapp.get("/search/?type=Project").json["@graph"][0]
        institution = es_testapp.get("/search/?type=Institution").json[
            "@graph"
        ][0]
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-parse_gene_list.txt",
            project,
            institution,
            es_testapp,
        )
        assert len(genelist.genes) == 3
        assert genelist.title == "Example Gene List"
        assert len(genelist.gene_ids) == 3
        assert len(genelist.post_bodies) == 2
        assert project["uuid"] == genelist.post_bodies[0]["project"]
        assert institution["uuid"] == genelist.post_bodies[0]["institution"]
        assert genelist.post_bodies[1]["genes"] == genelist.gene_ids
        assert genelist.title in genelist.post_bodies[1]["title"]
        assert genelist.validation_output == "success"
        assert genelist.post_output == "success"
        assert genelist.variants_queued == "success"

    def test_parse_empty_genelist(self, es_testapp, workbook):
        """
        Tests for detection of empty gene list and no title.
        """
        project = es_testapp.get("/search/?type=Project").json["@graph"][0]
        institution = es_testapp.get("/search/?type=Institution").json[
            "@graph"
        ][0]
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-empty_gene_list.txt",
            project,
            institution,
            es_testapp,
        )
        assert genelist.title is None
        assert genelist.genes is None
        assert genelist.errors

    def test_match_genes(self, es_testapp, workbook):
        """
        Tests for matching of genes given various ID types (correct gene
        symbol, previous symbol, OMIM ID, etc.) as well as removal of duplicate
        items in the gene list that both point to the same gene item via
        different names.
        """
        project = es_testapp.get("/search/?type=Project").json["@graph"][0]
        institution = es_testapp.get("/search/?type=Institution").json[
            "@graph"
        ][0]
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-match_gene_list.txt",
            project,
            institution,
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3

    def test_no_match_genes(self, es_testapp, workbook):
        """
        Ensure genes that don't match any existing genes are identified and
        possible alternative genes are provided, if applicable. Also, no
        posting should occur in this scenario.
        """
        project = es_testapp.get("/search/?type=Project").json["@graph"][0]
        institution = es_testapp.get("/search/?type=Institution").json[
            "@graph"
        ][0]
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-no-match_gene_list.txt",
            project,
            institution,
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3
        assert genelist.errors
        assert genelist.post_output is None

    def test_validate_and_post(self, es_testapp, workbook):
        """
        Test for correct validation but no posting of document and gene list
        when some genes are not identified in the database.
        """
        project = es_testapp.get("/search/?type=Project").json["@graph"][0]
        institution = es_testapp.get("/search/?type=Institution").json[
            "@graph"
        ][0]
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-no-match_gene_list.txt",
            project,
            institution,
            es_testapp,
        )
        assert genelist.validation_output == "success"
        assert genelist.post_output is None

    def test_existing_title(self, es_testapp, workbook):
        """
        Ensure no posting if attempting to submit gene list with title
        identical to the title of a previously created gene list associated
        with the project.
        """
        project = es_testapp.get("/search/?type=Project").json["@graph"][0]
        institution = es_testapp.get("/search/?type=Institution").json[
            "@graph"
        ][0]
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-previous-title_gene_list.txt",
            project,
            institution,
            es_testapp,
        )
        assert genelist.post_output is None
        assert genelist.errors

    def test_existing_document(self, es_testapp, workbook):
        """
        Ensure no posting if attempting to submit document with title
        identical to the title of a previously created document associated
        with the project.
        """
        project = es_testapp.get("/search/?type=Project").json["@graph"][0]
        institution = es_testapp.get("/search/?type=Institution").json[
            "@graph"
        ][0]
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "DRR_test-previous-doc_gene_list.txt",
            project,
            institution,
            es_testapp,
        )
        assert genelist.post_output is None
        assert genelist.errors
