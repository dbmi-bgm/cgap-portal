import datetime

import pytest
import pytz
import requests  # XXX: C4-211
import webtest
from dateutil.parser import isoparse

from ..ingestion.common import CGAP_CORE_PROJECT
from ..types.variant import build_variant_sample_annotation_id
from .variant_fixtures import VARIANT_SAMPLE_URL

pytestmark = [pytest.mark.working, pytest.mark.schema, pytest.mark.workbook]

@pytest.fixture
def bgm_test_variant_sample2(bgm_test_variant_sample):
    # IS NOT pre-POSTed into DB.
    bgm_test_variant_sample_copy = bgm_test_variant_sample.copy()
    bgm_test_variant_sample_copy['file'] = 'other-file-name'
    return bgm_test_variant_sample_copy


@pytest.fixture
def bgm_note_for_patch_process(institution, bgm_project):
    # IS NOT pre-POSTed into DB.
    return {
        # 'status': 'in review', # Can't be explicitly supplied by non-admin user.
        'note_text': 'dummy text 1',
        'project': bgm_project['@id'],
        'institution': institution['@id']
    }

@pytest.fixture
def bgm_note_for_patch_process2(bgm_note_for_patch_process):
    # IS NOT pre-POSTed into DB.
    bgm_note_for_patch_process_copy = bgm_note_for_patch_process.copy()
    bgm_note_for_patch_process_copy['note_text'] = 'dummy text 2'
    return bgm_note_for_patch_process_copy



@pytest.fixture
def y_variant(bgm_user_testapp, bgm_project, institution):
    item = {
        'project': bgm_project['@id'],
        'institution': institution["name"],
        "ID": "rs104894976",
        "ALT": "A",
        "POS": 2787207,
        "REF": "G",
        "hg19": [
            {
                "hg19_pos": 2655248,
                "hg19_chrom": "chrY",
                "hg19_hgvsg": "NC_000024.9:g.2655248G>A"
            }
        ],
        "CHROM": "Y"
    }
    return bgm_user_testapp.post_json('/variants', item).json['@graph'][0]

@pytest.fixture
def bgm_y_variant_sample(y_variant, institution, bgm_project):
    # IS NOT pre-POSTed into DB.
    return {
        'variant': y_variant['@id'],
        'AD': '1,3',
        'CALL_INFO': 'my_test_sample',
        'file': 'dummy-file-name',
        'project': bgm_project['@id'],
        'institution': institution['@id'],
        'inheritance_modes': [
            'Dominant (maternal)',
            'Y-linked dominant',
            'de novo (strong)',
            'Compound Het (Unphased/strong_pair)',
            'Compound Het (Phased/medium_pair)'
        ]
    }


def test_variant_sample_proband_inheritance(bgm_user_testapp, bgm_y_variant_sample):
    res = bgm_user_testapp.post_json(VARIANT_SAMPLE_URL, bgm_y_variant_sample, status=[201, 409]).json['@graph'][0]
    assert sorted(res['proband_only_inheritance_modes']) == sorted([
        'Y-linked',
        'Compound Het (Unphased/strong_pair)',
    ])


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


def test_bam_snapshot_presence(
    testapp, variant, variant_sample
):
    """
    Test creation of BAM snapshot calc prop on variant samples with
    different chromosomes
    """
    calc_prop_name = "bam_snapshot"
    vs_post = testapp.post_json(VARIANT_SAMPLE_URL, variant_sample, status=201)
    vs_atid = vs_post.json["@graph"][0]["@id"]
    chromosomes = [str(x) for x in range(1, 23)] + ["X", "Y", "M"]
    excluded_chromosomes = ["M"]
    for chromosome in chromosomes:
        testapp.patch_json(variant["@id"], {"CHROM": chromosome}, status=200)
        vs_get = testapp.get(vs_atid, status=200).json
        if chromosome in excluded_chromosomes:
            assert calc_prop_name not in vs_get
        else:
            assert calc_prop_name in vs_get


@pytest.fixture
def variant_sample_list1(bgm_project, institution):
    return {
        'project': bgm_project['@id'],
        'institution': institution["name"],
        'created_for_case': 'GAPCAP4E4GMG'
    }


def test_variant_sample_list_post(bgm_user_testapp, variant_sample_list1):
    bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201)


def test_variant_sample_patch_notes_process_success(
    testapp,
    bgm_user,
    bgm_user_testapp,
    bgm_test_variant_sample2, # This VS is from BGM project and has no "genes" on it initially.
    bgm_note_for_patch_process,
    bgm_note_for_patch_process2,
    gene, # These 2 Gene are from ENCODED project (not BGM)
    gene_2
):
    
    # Load up some data - these are notes to be added with "/@@process-notes/"
    note1 = bgm_user_testapp.post_json('/notes-standard', bgm_note_for_patch_process, status=201).json['@graph'][0]
    note2 = bgm_user_testapp.post_json('/notes-interpretation', bgm_note_for_patch_process2, status=201).json['@graph'][0]

    note3_json = bgm_note_for_patch_process2.copy()
    note3_json["note_text"] = "gene discovery note text"
    note4_json = bgm_note_for_patch_process2.copy()
    note4_json["note_text"] = "gene note text"
    note3 = bgm_user_testapp.post_json('/notes-discovery', note3_json, status=201).json['@graph'][0]
    note4 = bgm_user_testapp.post_json('/notes-standard', note4_json, status=201).json['@graph'][0]

    # Create a "pre-existing" variant_note with same Project (BGM).
    bgm_note_for_patch_process_preexisting = bgm_note_for_patch_process2.copy()
    bgm_note_for_patch_process_preexisting['note_text'] = 'dummy text 3'
    note_pre_existing = bgm_user_testapp.post_json('/notes-standard', bgm_note_for_patch_process_preexisting, status=201).json['@graph'][0]

    # Create our VariantSample Item w. linked Variant & Gene (already has Variant)
    bgm_test_variant_sample_copy = bgm_test_variant_sample2.copy()
    bgm_test_variant_sample_copy['file'] = 'other-file-name2'

    # Notes need to be on VariantSample before they can be shared to project
    bgm_test_variant_sample_copy['variant_notes'] = note1['@id']
    bgm_test_variant_sample_copy['interpretation'] = note2['@id']
    bgm_test_variant_sample_copy['discovery_interpretation'] = note3['@id']
    bgm_test_variant_sample_copy['gene_notes'] = note4['@id']
    variant_sample = bgm_user_testapp.post_json('/variant_sample', bgm_test_variant_sample_copy, status=201).json['@graph'][0]

    # Add the pre-existing variant_note by PATCHING VariantSample.variant.variant_notes (as admin)
    # Also ensure we have gene(s)
    variant_payload_for_initial_state = {
        "variant_notes": [ note_pre_existing["@id"] ],
        "genes": [ {"genes_most_severe_gene": gene["@id"] }, {"genes_most_severe_gene": gene_2["@id"] } ]
    }
    variant_loaded = testapp.patch_json(variant_sample["variant"], variant_payload_for_initial_state, status=200).json['@graph'][0]

    prepatch_datetime = datetime.datetime.now(pytz.utc)

    # Test /@@process-notes/ endpoint
    patch_process_payload = {
        "save_to_project_notes" : {
            "variant_notes": note1["uuid"],
            "interpretation": note2["uuid"],
            "discovery_interpretation": note3["uuid"],
            "gene_notes": note4["uuid"]
        }
    }

    resp = bgm_user_testapp.patch_json(variant_sample['@id'] + "/@@process-notes/", patch_process_payload, status=200).json

    assert resp["status"] == "success"
    assert resp["patch_results"]["Variant"] == 1
    assert resp["patch_results"]["Note"] == 5 # 4 Newly-shared Notes, +1 "superseding_notes" field to existing Note PATCH

    note1_reloaded = bgm_user_testapp.get(note1["@id"] + "?datastore=database&frame=object", status=200).json
    note3_reloaded = bgm_user_testapp.get(note1["@id"] + "?datastore=database&frame=object", status=200).json
    assert note1_reloaded["status"] == "current"
    assert note3_reloaded["status"] == "current"
    assert note1_reloaded["approved_by"] == bgm_user["@id"] # Ensure this is set for us
    assert note3_reloaded["approved_by"] == bgm_user["@id"]
    assert isoparse(note1_reloaded["date_approved"]) >= prepatch_datetime # Datetime of approval is same or after the datetime at which we started PATCH
    assert isoparse(note3_reloaded["date_approved"]) >= prepatch_datetime # Datetime of approval is same or after the datetime at which we started PATCH

    variant_reloaded = bgm_user_testapp.get(variant_sample["variant"] + "?datastore=database", status=200).json
    assert note1["@id"] in [ inp["@id"] for inp in variant_reloaded["variant_notes"] ]
    assert note2["@id"] in [ inp["@id"] for inp in variant_reloaded["interpretations"] ]

    # Gene notes not embedded by default on variant, we GET Gene first to check on it.
    gene_loaded = bgm_user_testapp.get(variant_reloaded["genes"][0]["genes_most_severe_gene"]["@id"] + "?datastore=database", status=200).json
    gene_2_loaded = bgm_user_testapp.get(variant_reloaded["genes"][1]["genes_most_severe_gene"]["@id"] + "?datastore=database", status=200).json
    assert note3["@id"] in [ inp["@id"] for inp in gene_loaded["discovery_interpretations"] ]
    assert note4["@id"] in [ inp["@id"] for inp in gene_loaded["gene_notes"] ]
    assert note3["@id"] in [ inp["@id"] for inp in gene_2_loaded["discovery_interpretations"] ]
    assert note4["@id"] in [ inp["@id"] for inp in gene_2_loaded["gene_notes"] ]

    # Since note_pre_existing (pre-existing) has same Project (BGM), it should have been removed and instead available via note1.previous_note
    assert note_pre_existing["@id"] not in [ inp["@id"] for inp in variant_reloaded["variant_notes"] ]
    assert note1_reloaded["previous_note"] == note_pre_existing["@id"]

    # Make sure it acts like a linked-list, ""
    note_pre_existing_reloaded = bgm_user_testapp.get(note_pre_existing["@id"] + "?datastore=database&frame=object", status=200).json
    assert note_pre_existing_reloaded["superseding_note"] == note1["@id"]


def test_variant_sample_list_patch_success(bgm_user, bgm_user_testapp, variant_sample_list1, bgm_test_variant_sample, bgm_test_variant_sample2):
    vsl = bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    vs1 = bgm_user_testapp.post_json('/variant_sample', bgm_test_variant_sample, status=201).json['@graph'][0]
    vs2 = bgm_user_testapp.post_json('/variant_sample', bgm_test_variant_sample2, status=201).json['@graph'][0]

    patch = {
        'variant_samples': [
            {
                "variant_sample_item": vs1['@id'],
                "filter_blocks_request_at_time_of_selection": '{"search_type":"VariantSample","global_flags":"CALL_INFO=NA12879_sample&file=GAPFI2VBKGM7&additional_facet=associated_genotype_labels.mother_genotype_label&additional_facet=associated_genotype_labels.father_genotype_label&sort=date_created","intersect":false,"filter_blocks":[{"query":"variant.genes.genes_most_severe_consequence.coding_effect=Missense","flags_applied":[]},{"query":"variant.mutanno_variant_class=SNV","flags_applied":[]}]}',
            },
            {
                "variant_sample_item": vs2['@id'],
                "filter_blocks_request_at_time_of_selection": '{"search_type":"VariantSample","global_flags":"CALL_INFO=NA12879_sample&file=GAPFI2VBKGM7&additional_facet=associated_genotype_labels.mother_genotype_label&additional_facet=associated_genotype_labels.father_genotype_label&sort=date_created","intersect":false,"filter_blocks":[{"query":"variant.genes.genes_most_severe_consequence.coding_effect=Missense","flags_applied":[]},{"query":"variant.mutanno_variant_class=SNV","flags_applied":[]}]}',
                # "date_selected": "2021-01-25T16:41:47.787+00:00", # Should be auto-filled by server.
                # "selected_by" : ... # <- This should be auto-filled by server, we'll test it .. sometime.
            }
        ]
    }
    resp = bgm_user_testapp.patch_json(vsl['@id'], patch, status=200).json['@graph'][0]

    assert resp['variant_samples'][0]["variant_sample_item"] == vs1['@id']
    assert resp['variant_samples'][1]["variant_sample_item"] == vs2['@id']
    assert len(resp['variant_samples'][1]["date_selected"]) > 10 # Check that datetime is auto-populated
    assert resp['variant_samples'][1]["selected_by"] == bgm_user["@id"] # Check that userid is auto-populated


def test_variant_sample_list_patch_fail(bgm_variant, bgm_user_testapp, variant_sample_list1):
    vsl = bgm_user_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    patch = {
        'variant_samples': [bgm_variant["@id"]]  # wrong data structure and item type
    }
    bgm_user_testapp.patch_json(vsl['@id'], patch, status=422)


def test_variant_sample_list_revlink(testapp, variant_sample_list):
    """Ensure revlink from VSL to variant sample established."""
    vsl_atid = variant_sample_list["@id"]
    vs_atid = variant_sample_list["variant_samples"][0]["variant_sample_item"]
    variant_sample = testapp.get(vs_atid, status=200).json
    assert vsl_atid == variant_sample["variant_sample_list"]["@id"]


def test_variant_sample_list_sv_patch(
    testapp, variant_sample_list, structural_variant, structural_variant_sample
):
    """Test adding SV samples to variant sample list and rev link to SV sample."""
    vsl_atid = variant_sample_list["@id"]
    sv_sample = testapp.post_json(
        "/structural_variant_sample", structural_variant_sample, status=201
    ).json["@graph"][0]
    sv_sample_atid = sv_sample["@id"]
    vsl_patch = {
        "structural_variant_samples": [{"structural_variant_sample_item": sv_sample_atid}]
    }
    resp = testapp.patch_json(vsl_atid, vsl_patch, status=200).json["@graph"][0]
    vsl_struct_var = resp["structural_variant_samples"][0]["structural_variant_sample_item"]
    sv_sample = testapp.get(sv_sample_atid).json
    assert vsl_struct_var == sv_sample["@id"]
    assert "variant_sample_list" in sv_sample.keys()


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
          associated_genelists property)
    """
    response = testapp.post_json(
        "/variant-samples", variant_sample, status=201
    ).json["@graph"][0]
    cgap_core_response = testapp.post_json(
        "/variant-samples", cgap_core_variant_sample, status=201
    ).json["@graph"][0]
    bgm_response = testapp.post_json(
        "/variant-samples", bgm_variant_sample, status=201
    ).json["@graph"][0]
    no_genelists_response = testapp.post_json(
        "/variant-samples", variant_sample_2, status=201
    ).json["@graph"][0]
    assert set(response["associated_genelists"]) == {
        genelist["display_title"],
        cgap_core_genelist["display_title"]}
    assert set(cgap_core_response["associated_genelists"]) == {
        cgap_core_genelist["display_title"]}
    assert set(bgm_response["associated_genelists"]) == {
        bgm_genelist["display_title"],
        cgap_core_genelist["display_title"]}
    assert not no_genelists_response["associated_genelists"]


def test_case_specific_variant_sample_genelist(
    testapp, genelist, cgap_core_genelist, variant_sample
):
    """
    Test variant samples correctly matched with gene lists based on project
    and cases (via genelist bam_sample_ids) when gene lists have case info.
    """
    genelist_title = genelist["display_title"]

    bam_sample_id = "some_sample"
    genelist_patch = {"bam_sample_ids": [bam_sample_id]}
    testapp.patch_json(genelist["@id"], genelist_patch, status=200)
    variant_sample["CALL_INFO"] = bam_sample_id
    vs_post = testapp.post_json(
        "/variant-samples", variant_sample, status=201
    ).json["@graph"][0]
    assert genelist_title in vs_post["associated_genelists"]

    new_bam_sample_id = "another_sample"
    genelist_patch = {"bam_sample_ids": [new_bam_sample_id]}
    testapp.patch_json(genelist["@id"], genelist_patch, status=200)
    vs_patch = testapp.patch_json(vs_post["@id"], {}, status=200).json["@graph"][0]
    assert genelist_title not in vs_patch["associated_genelists"]

    testapp.patch_json(cgap_core_genelist["@id"], genelist_patch, status=200)
    vs_patch = testapp.patch_json(vs_post["@id"], {}, status=200).json["@graph"][0]
    assert not vs_patch["associated_genelists"]

    genelist_patch = {"bam_sample_ids": [bam_sample_id, new_bam_sample_id]}
    testapp.patch_json(genelist["@id"], genelist_patch, status=200)
    vs_patch = testapp.patch_json(vs_post["@id"], {}, status=200).json["@graph"][0]
    assert genelist_title in vs_patch["associated_genelists"]
