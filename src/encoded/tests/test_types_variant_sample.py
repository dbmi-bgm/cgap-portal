import pytest
import webtest
import requests  # XXX: C4-211
from encoded.tests.variant_fixtures import VARIANT_SAMPLE_URL
from encoded.types.variant import build_variant_sample_annotation_id
from encoded.ingestion.common import CGAP_CORE_PROJECT


pytestmark = [pytest.mark.working, pytest.mark.schema, pytest.mark.workbook]

@pytest.fixture
def bgm_test_variant_sample2(bgm_test_variant_sample):
    # IS NOT pre-POSTed into DB.
    bgm_test_variant_sample_copy = bgm_test_variant_sample.copy()
    bgm_test_variant_sample_copy['file'] = 'other-file-name'
    return bgm_test_variant_sample_copy


@pytest.mark.integrated  # uses s3
def test_bam_snapshot_download(workbook, es_testapp, test_variant_sample):
    """ Tests that we can correctly download an IGV image from the wfoutput bucket. """
    test_variant_sample['file'] += '2'
    res = es_testapp.post_json(VARIANT_SAMPLE_URL, test_variant_sample, status=[201, 409]).json
    uuid = res['@graph'][0]['uuid']
    bam_snapshot_location = res['@graph'][0]['bam_snapshot']
    assert bam_snapshot_location == test_variant_sample['file'] + '/bamsnap/chr1_12125898.png'
    download = es_testapp.get('/' + uuid + '/@@download').location
    # download location is https://test-wfout-bucket.s3.amazonaws.com/dummy-file-name2/bamsnap/chr1_12125898.png
    resp = requests.get(download)
    assert 'hello world' in resp.content.decode('utf-8')


@pytest.fixture
def variant_sample_list1(bgm_project, institution):
    return {
        'project': bgm_project['@id'],
        'institution': institution["name"],
        'created_for_case': 'GAPCAP4E4GMG'
    }


def test_variant_sample_list_post(bgm_user_testapp, variant_sample_list1):
    bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201)



def test_variant_sample_list_patch_success(bgm_user, bgm_user_testapp, variant_sample_list1, bgm_test_variant_sample, bgm_test_variant_sample2):
    vsl = bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    vs1 = bgm_user_testapp.post_json('/variant_sample', bgm_test_variant_sample, status=201).json['@graph'][0]
    vs2 = bgm_user_testapp.post_json('/variant_sample', bgm_test_variant_sample2, status=201).json['@graph'][0]

    patch = {
        'variant_samples': [
            {
                "variant_sample_item": vs1['@id'],
                "filter_blocks_request_at_time_of_selection": '{"search_type":"VariantSample","global_flags":"CALL_INFO=NA12879_sample&file=GAPFI2VBKGM7&additional_facet=associated_genotype_labels.mother_genotype_label&additional_facet=associated_genotype_labels.father_genotype_label&sort=date_created","intersect":false,"filter_blocks":[{"query":"variant.genes.genes_most_severe_consequence.coding_effect=Missense","flags_applied":[]},{"query":"variant.mutanno_variant_class=SNV","flags_applied":[]}]}',
                # Existing values for following 2 fields should be preserved -
                "date_selected": "2021-01-25T16:41:47.787+00:00",
                "userid" : "1234-test-1234"
            },
            {
                "variant_sample_item": vs2['@id'],
                "filter_blocks_request_at_time_of_selection": '{"search_type":"VariantSample","global_flags":"CALL_INFO=NA12879_sample&file=GAPFI2VBKGM7&additional_facet=associated_genotype_labels.mother_genotype_label&additional_facet=associated_genotype_labels.father_genotype_label&sort=date_created","intersect":false,"filter_blocks":[{"query":"variant.genes.genes_most_severe_consequence.coding_effect=Missense","flags_applied":[]},{"query":"variant.mutanno_variant_class=SNV","flags_applied":[]}]}',
                # "date_selected": "2021-01-25T16:41:47.787+00:00", # Should be auto-filled by server.
                # "userid" : ... # <- This should be auto-filled by server, we'll test it .. sometime.
            }
        ]
    }
    resp = bgm_user_testapp.patch_json(vsl['@id'], patch, status=200).json['@graph'][0]

    assert resp['variant_samples'][0]["variant_sample_item"] == vs1['@id']
    assert resp['variant_samples'][1]["variant_sample_item"] == vs2['@id']
    assert len(resp['variant_samples'][1]["date_selected"]) > 10 # Check that datetime is auto-populated
    assert resp['variant_samples'][1]["userid"] == bgm_user["uuid"] # Check that userid is auto-populated


def test_variant_sample_list_patch_fail(bgm_variant, bgm_user_testapp, variant_sample_list1):
    vsl = bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    patch = {
        'variant_samples': [bgm_variant["@id"]]  # wrong data structure and item type
    }
    bgm_user_testapp.patch_json(vsl['@id'], patch, status=422)


@pytest.mark.parametrize('call_info,variant_uuid,file_accession', [
    ('NA1278_SAMPLE', 'uuid1', 'GAPIDFIABC'),
    ('NA1279_SAMPLE', 'uuid1', 'GAPIDFIABC'),
    ('NA1279_SAMPLE', 'uuid2', 'GAPIDFIABC'),
])
def test_build_variant_sample_annotation_id(call_info, variant_uuid, file_accession):
    """ Some sanity checks for this helper function, which will cause variant sample
        patches to fail if not working correctly """
    assert build_variant_sample_annotation_id(call_info, variant_uuid, file_accession) == (
            call_info + ':' + variant_uuid + ':' + file_accession)


def test_project_specific_variant_sample_genelist(
    testapp,
    genelist,
    cgap_core_genelist,
    bgm_genelist,
    variant_sample,
    cgap_core_variant_sample,
    bgm_variant_sample,
    variant_sample_2
):
    """
    Ensure variant samples are correctly matched with gene lists based on their
    respective projects. Institution is irrelevant here.

    Logic is:
        - If gene list project is CGAP_CORE_PROJECT or same as variant sample
          project, then the two are associated (via variant sample's
          project_genelists property)
    """
    response = testapp.post_json("/variant-samples", variant_sample).json["@graph"][0]
    cgap_core_response = testapp.post_json(
        "/variant-samples", cgap_core_variant_sample).json["@graph"][0]
    bgm_response = testapp.post_json(
        "/variant-samples", bgm_variant_sample).json["@graph"][0]
    no_genelists_response = testapp.post_json(
        "/variant-samples", variant_sample_2).json["@graph"][0]
    assert set(response["project_genelists"]) == {
        genelist["display_title"],
        cgap_core_genelist["display_title"]}
    assert set(cgap_core_response["project_genelists"]) == {
        cgap_core_genelist["display_title"]}
    assert set(bgm_response["project_genelists"]) == {
        bgm_genelist["display_title"],
        cgap_core_genelist["display_title"]}
    assert not no_genelists_response["project_genelists"]
