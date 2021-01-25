import pytest
import webtest
import requests  # XXX: C4-211
from .variant_fixtures import VARIANT_SAMPLE_URL


pytestmark = [pytest.mark.working, pytest.mark.schema]


# Copied from test_permissions.py
# Maybe we could make test_permissions.py fixtures be largely defined in importable file or in datafixtures.py?
# @pytest.fixture
# def bgm_user_testapp(bgm_user, app, external_tx, zsa_savepoints):
#     environ = {
#         'HTTP_ACCEPT': 'application/json',
#         'REMOTE_USER': str(bgm_user['uuid']),
#     }
#     return webtest.TestApp(app, environ)


# @pytest.fixture
# def bgm_variant(bgm_user_testapp, bgm_project, institution):
#     '''Same thing as workbook inserts, but different project stuff'''
#     item = {
#         'project': bgm_project['@id'],
#         'institution': institution["name"],
#         # We do not supply an explicit UUID here anymore because it says we need "permission restricted items"
#         # Might be some other way of getting it in here, but idk nor have time to rly explore atm.
#         # "uuid": "f6aef055-4c88-4a3e-a306-d37a71535d8b",
#         "ID": "rs564328546",
#         "ALT": "T",
#         "POS": 12125898,
#         "REF": "TG",
#         "hg19": [
#         {
#             "hg19_pos": 12185955,
#             "hg19_chrom": "chr1",
#             "hg19_hgvsg": "NC_000001.11:g.12185956del"
#         }
#         ],
#         "CHROM": "1",
#         "topmed_an": 125568
#     }
#     return bgm_user_testapp.post_json('/variants', item).json['@graph'][0]

# @pytest.fixture
# def bgm_test_variant_sample(bgm_variant, institution, bgm_project):
#     # IS NOT pre-POSTed into DB.
#     return {
#         'variant': bgm_variant['@id'],
#         'AD': '1,3',
#         'CALL_INFO': 'my_test_sample',
#         'file': 'dummy-file-name',
#         'project': bgm_project['@id'],
#         'institution': institution['@id']
#     }

@pytest.fixture
def bgm_test_variant_sample2(bgm_test_variant_sample):
    # IS NOT pre-POSTed into DB.
    bgm_test_variant_sample_copy = bgm_test_variant_sample.copy()
    bgm_test_variant_sample_copy['file'] = 'other-file-name'
    return bgm_test_variant_sample_copy


@pytest.mark.integrated  # uses s3
def test_bam_snapshot_download(workbook, bgm_user_testapp, bgm_test_variant_sample):
    """ Tests that we can correctly download an IGV image from the wfoutput bucket. """
    res = bgm_user_testapp.post_json(VARIANT_SAMPLE_URL, bgm_test_variant_sample, status=201).json
    uuid = res['@graph'][0]['uuid']
    bam_snapshot_location = res['@graph'][0]['bam_snapshot']
    assert bam_snapshot_location == 'dummy-file-name/bamsnap/chr1:12125898.png'
    download = bgm_user_testapp.get('/' + uuid + '/@@download').location
    resp = requests.get(download)
    assert 'hello world' in resp.content.decode('utf-8')


@pytest.fixture
def variant_sample_list1(bgm_project, institution):
    return {
        'project': bgm_project['@id'],
        'institution': institution["name"],
        'created_for_case': 'GAPCAP4E4GMG'
    }


def test_variant_sample_list_post(workbook, bgm_user_testapp, variant_sample_list1):
    bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201)



def test_variant_sample_list_patch_success(workbook, bgm_user_testapp, variant_sample_list1, bgm_test_variant_sample2):
    vsl = bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    vs = bgm_user_testapp.post_json('/variant_sample', bgm_test_variant_sample2, status=201).json['@graph'][0]
    patch = {
        'variant_samples': [
            {
                "variant_sample_item": vs['@id'],
                "filter_blocks_request_at_time_of_selection": '{"search_type":"VariantSample","global_flags":"CALL_INFO=NA12879_sample&file=GAPFI2VBKGM7&additional_facet=associated_genotype_labels.mother_genotype_label&additional_facet=associated_genotype_labels.father_genotype_label&sort=date_created","intersect":false,"filter_blocks":[{"query":"variant.genes.genes_most_severe_consequence.coding_effect=Missense","flags_applied":[]},{"query":"variant.mutanno_variant_class=SNV","flags_applied":[]}]}',
                # Existing values for following 2 fields should be preserved -
                "date_selected": "2021-01-25T16:41:47.787+00:00",
                "userid" : "1234-test-1234"
            },
            {
                "variant_sample_item": vs['@id'],
                "filter_blocks_request_at_time_of_selection": '{"search_type":"VariantSample","global_flags":"CALL_INFO=NA12879_sample&file=GAPFI2VBKGM7&additional_facet=associated_genotype_labels.mother_genotype_label&additional_facet=associated_genotype_labels.father_genotype_label&sort=date_created","intersect":false,"filter_blocks":[{"query":"variant.genes.genes_most_severe_consequence.coding_effect=Missense","flags_applied":[]},{"query":"variant.mutanno_variant_class=SNV","flags_applied":[]}]}',
                # "date_selected": "2021-01-25T16:41:47.787+00:00", # Should be auto-filled by server.
                # "userid" : ... # <- This should be auto-filled by server, we'll test it .. sometime.
            }
        ]
    }
    resp = bgm_user_testapp.patch_json(vsl['@id'], patch, status=200).json['@graph'][0]

    assert resp['variant_samples'][0]["variant_sample_item"] == vs['@id']
    assert len(resp['variant_samples'][0]["date_selected"]) > 10 # Check that datetime is populated


def test_variant_sample_list_patch_fail(bgm_variant, bgm_user_testapp, variant_sample_list1):
    vsl = bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    patch = {
        'variant_samples': [bgm_variant["@id"]]  # wrong data structure and item type
    }
    bgm_user_testapp.patch_json(vsl['@id'], patch, status=422)
