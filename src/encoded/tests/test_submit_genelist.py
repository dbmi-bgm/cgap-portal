import pytest

from .test_access_key import basic_auth
from ..submit_genelist import GeneListSubmission, VariantUpdateSubmission

pytestmark = [pytest.mark.setone, pytest.mark.working]


@pytest.fixture
def project(es_testapp, workbook):
    project = es_testapp.get("/search/?type=Project").json["@graph"][0]
    return project


@pytest.fixture
def wb_institution(es_testapp, workbook):
    institution = es_testapp.get("/search/?type=Institution").json["@graph"][0]
    return institution


class TestGeneListSubmission:
    def test_genelist_endpoint(self, testapp, bgm_project, bgm_access_key, institution):
        """
        Test for valid posting to genelist endpoint via ingestion listener.
        """
        creation_post_url = "/IngestionSubmission"
        creation_post_data = {
            "ingestion_type": "genelist",
            "project": bgm_project["name"],
            "institution": institution["name"],
            "processing_status": {"state": "submitted"},
        }
        creation_post_headers = {
            "Content-type": "application/json",
            "Accept": "application/json",
            "Authorization": basic_auth(
                bgm_access_key["access_key_id"],
                bgm_access_key["secret_access_key"],
            ),
        }
        creation_response = testapp.post_json(
            creation_post_url,
            creation_post_data,
            headers=creation_post_headers,
            status=201,
        ).json
        submission_id = creation_response["@graph"][0]["@id"]
        submission_post_url = submission_id + "submit_for_ingestion"
        submission_post_data = {"validate_only": False}
        submission_post_headers = {
            "Authorization": basic_auth(
                bgm_access_key["access_key_id"],
                bgm_access_key["secret_access_key"],
            )
        }
        upload_file = [
            (
                "datafile",
                "Testing",
                bytes("\n".join(["PCSK9", "FBN1"]), encoding="utf-8"),
            )
        ]
        submission_response = testapp.post(
            submission_post_url,
            submission_post_data,
            upload_files=upload_file,
            headers=submission_post_headers,
            status=200,
        ).json
        assert creation_response["status"] == "success"
        assert submission_response["success"]

    def test_normal_genelist(self, es_testapp, workbook, project, wb_institution):
        """
        Tests for full gene list functionality given gene list with all genes
        identifiable in the database.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test-parse_gene_list.txt",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.genes) == 3
        assert genelist.title == "Example Gene List"
        assert len(genelist.gene_ids) == 3
        assert len(genelist.post_bodies) == 2
        assert project["@id"] == genelist.post_bodies[0]["project"]
        assert wb_institution["@id"] == genelist.post_bodies[0]["institution"]
        assert genelist.post_bodies[1]["genes"] == genelist.gene_ids
        assert genelist.title in genelist.post_bodies[1]["title"]
        assert genelist.validation_output
        assert genelist.post_output

    def test_parse_empty_genelist(self, es_testapp, workbook, project, wb_institution):
        """
        Tests for detection of empty gene list and no title.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test-empty_gene_list.txt",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert not genelist.title
        assert not genelist.genes
        assert genelist.errors

    def test_parse_empty_genelist_excel(self, es_testapp, workbook, project, wb_institution):
        """
        Tests for correct detection of no title and no genes provided when
        given an excel gene list.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test_empty_gene_list.xlsx",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert not genelist.title
        assert not genelist.genes
        assert genelist.errors

    def test_match_genes(self, es_testapp, workbook, project, wb_institution):
        """
        Tests for matching of genes given various ID types (correct gene
        symbol, previous symbol, OMIM ID, etc.) as well as removal of duplicate
        items in the gene list that both point to the same gene item via
        different names.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test-match_gene_list.txt",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3

    def test_no_match_genes(self, es_testapp, workbook, project, wb_institution):
        """
        Ensure genes that don't match any existing genes are identified and
        possible alternative genes are provided, if applicable. Also, no
        posting should occur in this scenario.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test-no-match_gene_list.txt",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3
        assert genelist.errors
        assert not genelist.post_output

    def test_validate_and_post(self, es_testapp, workbook, project, wb_institution):
        """
        Test for correct validation but no posting of document and gene list
        when some genes are not identified in the database.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test-no-match_gene_list.txt",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert genelist.validation_output
        assert not genelist.post_output

    def test_existing_title(self, es_testapp, workbook, project, wb_institution):
        """
        Ensure gene list and document are patched if attempting to submit gene
        list with title identical to the title of a previously created gene
        list associated with the project.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test-previous-title_gene_list.txt",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert genelist.patch_genelist_uuid
        assert genelist.patch_document_uuid

    def test_excel_format(self, es_testapp, workbook, project, wb_institution):
        """
        Test for correct parsing of excel-formatted gene list.
        """
        genelist = GeneListSubmission(
            "src/encoded/tests/data/documents/gene_lists/"
            "test-match_gene_list.xlsx",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 2
        assert genelist.post_output


class TestVariantUpdateSubmission:
    def test_variant_update(self, es_testapp, workbook, project, wb_institution):
        """
        Ensure variant_update ingestion class parses file of input gene uuids
        and queues associated variant samples for indexing.
        """
        variant_update = VariantUpdateSubmission(
            "src/encoded/tests/data/documents/test-variant-update.txt",
            project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(variant_update.gene_uuids) == 3
        assert len(variant_update.variant_samples) == 1
        assert variant_update.validate_output
        assert variant_update.post_output
        assert not variant_update.errors

    def test_variant_update_endpoint(self, testapp, bgm_project, bgm_access_key, institution):
        """
        Test for valid posting to variant_endpoint endpoint via ingestion listener.
        """
        creation_post_url = "/IngestionSubmission"
        creation_post_data = {
            "ingestion_type": "variant_update",
            "project": bgm_project["name"],
            "institution": institution["name"],
            "processing_status": {"state": "submitted"},
        }
        creation_post_headers = {
            "Content-type": "application/json",
            "Accept": "application/json",
            "Authorization": basic_auth(
                bgm_access_key["access_key_id"],
                bgm_access_key["secret_access_key"],
            ),
        }
        creation_response = testapp.post_json(
            creation_post_url,
            creation_post_data,
            headers=creation_post_headers,
            status=201,
        ).json
        submission_id = creation_response["@graph"][0]["@id"]
        submission_post_url = submission_id + "submit_for_ingestion"
        submission_post_data = {"validate_only": False}
        submission_post_headers = {
            "Authorization": basic_auth(
                bgm_access_key["access_key_id"],
                bgm_access_key["secret_access_key"],
            )
        }
        upload_file = [
            (
                "datafile",
                "Testing",
                bytes("\n".join(["PCSK9", "FBN1"]), encoding="utf-8"),
            )
        ]
        submission_response = testapp.post(
            submission_post_url,
            submission_post_data,
            upload_files=upload_file,
            headers=submission_post_headers,
            status=200,
        ).json
        assert creation_response["status"] == "success"
        assert submission_response["success"]
