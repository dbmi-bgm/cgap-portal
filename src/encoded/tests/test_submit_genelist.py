import json
import pytest

from encoded.tests.test_access_key import basic_auth
from encoded.submit_genelist import (
    GeneListSubmission,
    VariantUpdateSubmission,
    CommonUtils,
)

pytestmark = [pytest.mark.setone, pytest.mark.working]


GENELIST_PATH = "src/encoded/tests/data/documents/gene_lists/"
VARIANT_UPDATE_PATH = "src/encoded/tests/data/documents/"


@pytest.fixture
def wb_project(es_testapp, workbook):
    search_string = "/search/?type=Project&title=Test+Project"
    project = es_testapp.get(search_string).json["@graph"][0]
    return project


@pytest.fixture
def core_project(es_testapp, workbook):
    search_string = "/search/?type=Project&title=Core+Project"
    project = es_testapp.get(search_string).json["@graph"][0]
    return project


@pytest.fixture
def wb_institution(es_testapp, workbook):
    search_string = "/search/?type=Institution&title=HMS+DBMI"
    institution = es_testapp.get(search_string).json["@graph"][0]
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

    def test_basic_genelist(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Tests for gene list functionality given gene list with all genes
        identifiable in the database and a title.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test-parse_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.genes) == 3
        assert genelist.title == "Example Gene List"
        assert len(genelist.gene_ids) == 3
        assert len(genelist.post_bodies) == 2
        assert wb_project["@id"] == genelist.post_bodies[0]["project"]
        assert wb_institution["@id"] == genelist.post_bodies[0]["institution"]
        assert genelist.post_bodies[1]["genes"] == genelist.gene_ids
        assert genelist.title in genelist.post_bodies[1]["title"]
        assert genelist.validation_output
        assert genelist.post_output

    def test_parse_empty_genelist(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Tests for detection of empty gene list and no title.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test-empty_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert not genelist.title
        assert not genelist.genes
        assert genelist.errors

    def test_parse_empty_genelist_excel(
        self, es_testapp, workbook, wb_project, wb_institution
    ):
        """
        Tests for correct detection of no title and no genes provided when
        given an excel gene list.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test_empty_gene_list.xlsx",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert not genelist.title
        assert not genelist.genes
        assert genelist.errors

    def test_match_genes(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Tests for matching of genes given various ID types (correct gene
        symbol, previous symbol, OMIM ID, etc.) as well as removal of duplicate
        items in the gene list that both point to the same gene item via
        different names.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test-match_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3

    def test_no_match_genes(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Ensure genes that don't match any existing genes are identified and
        possible alternative genes are provided, if applicable. Also, no
        posting should occur in this scenario.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test-no-match_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 3
        assert genelist.errors
        assert not genelist.post_output

    def test_validate_and_post(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Test for correct validation but no posting of document and gene list
        when some genes are not identified in the database.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test-no-match_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert genelist.validation_output
        assert not genelist.post_output

    def test_existing_title(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Ensure gene list and document are patched if attempting to submit gene
        list with title identical to the title of a previously created gene
        list associated with the project. Also tests for accurate patching
        of bam_sample_ids.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test-previous-title_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert genelist.patch_genelist_uuid
        assert genelist.patch_document_uuid
        assert genelist.bam_sample_ids

    def test_excel_format(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Test for correct parsing of excel-formatted gene list.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test-match_gene_list.xlsx",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.gene_ids) == 2
        assert genelist.post_output

    def test_valid_case_accession(self, es_testapp, wb_project, wb_institution):
        """
        Test for successful gene list submission when a valid case accession is
        given.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test_match_case_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert genelist.case_atids
        assert genelist.bam_sample_ids
        assert genelist.post_output
        assert not genelist.errors

    def test_invalid_case_accession(self, es_testapp, wb_project, wb_institution):
        """
        Test for unsuccessful gene list submission when invalid case accession
        provided, as well as successful parsing of multiple cases submitted.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test_no_match_case_gene_list.txt",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.case_atids) == 3
        assert len(genelist.bam_sample_ids) == 1
        assert genelist.errors
        assert not genelist.post_output

    def test_xlsx_case_parsing(self, es_testapp, wb_project, wb_institution):
        """
        Test that Excel (.xlsx) files including case accessions are appropriately
        parsed when given in subsequent rows or in one comma-separated row.
        """
        genelist = GeneListSubmission(
            GENELIST_PATH + "test_parse_cases_gene_list.xlsx",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(genelist.case_atids) == 3
        assert len(genelist.bam_sample_ids) == 1


class TestVariantUpdateSubmission:
    def test_variant_update(self, es_testapp, workbook, wb_project, wb_institution):
        """
        Ensure variant_update ingestion class parses file of input gene uuids
        and queues project-associated variant samples for indexing.
        """
        variant_update = VariantUpdateSubmission(
            VARIANT_UPDATE_PATH + "test-variant-update.json",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(variant_update.gene_uuids) == 3
        assert len(variant_update.variant_samples) == 4
        assert variant_update.validate_output
        assert variant_update.post_output
        assert not variant_update.errors

    def test_variant_update_with_case(self, es_testapp, wb_project, wb_institution):
        """
        Test that submission with case information (BAM sample IDs) is correctly
        parsed and only variant samples associated with the case are queued for
        indexing.
        """
        variant_update = VariantUpdateSubmission(
            VARIANT_UPDATE_PATH + "test_variant_update_with_case.json",
            wb_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(variant_update.gene_uuids) == 3
        assert len(variant_update.variant_samples) == 2
        assert len(variant_update.bam_sample_ids) == 1
        assert not variant_update.errors

    def test_core_variant_update(self, es_testapp, core_project, wb_institution):
        """
        Test that submission from CGAP_CORE_PROJECT will update all variant
        samples regardless of project.
        """
        variant_update = VariantUpdateSubmission(
            VARIANT_UPDATE_PATH + "test-variant-update.json",
            core_project["@id"],
            wb_institution["@id"],
            es_testapp,
        )
        assert len(variant_update.variant_samples) == 6

    def test_variant_update_endpoint(
        self, testapp, bgm_project, bgm_access_key, institution
    ):
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
        datafile_body = {"genes": ["PCSK9", "FBN1"]}
        datafile = json.dumps(datafile_body)
        upload_file = [
            (
                "datafile",
                "Testing.json",
                bytes(datafile, encoding="utf-8"),
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


def test_batch_search(es_testapp, wb_project, wb_institution):
    """
    Test batch search returns all search items rather than the default
    limit of 25 items.
    """
    item_list = [wb_institution["uuid"]]
    search_term = "institution.uuid"
    item_type = "Item"
    project = wb_project["@id"]
    fields = ["uuid", "project"]
    response = CommonUtils.batch_search(
        es_testapp,
        item_list,
        search_term,
        item_type=item_type,
        project=project,
        fields=fields,
    )
    assert len(response) > 25
    for idx in range(len(response)):
        assert "uuid" in response[idx]
        assert response[idx]["project"]["@id"] == project
