import os
import pytest
from encoded.tests.data.sample_vcfs.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    EXPECTED_ANNOTATION_FIELDS,
    EXPECTED_GENERIC_FIELDS,
    TEST_VCF,
    RAW_INFOTAG_DESCRIPTION
)
from encoded.commands.ingest_vcf import (
    VCFParser
)


@pytest.fixture
def test_vcf():
    parser = VCFParser(TEST_VCF, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
    return parser


def test_VCFP_parse_infotag_description(test_vcf):
    """
    Tests the staticmethod that parses the infotag description and produces
    a dictionary of all the keyed 'fields'
    """
    entries = test_vcf.parse_infotag_description(RAW_INFOTAG_DESCRIPTION)
    assert 'Subembedded' in entries
    assert 'Format' in entries


def test_VCFP_meta(test_vcf):
    """ Checks that we can correctly read which fields are annotation """
    annotation_fields = test_vcf.annotation_keys
    for annot_field in EXPECTED_ANNOTATION_FIELDS:
        assert annot_field in annotation_fields
    assert test_vcf.get_sub_embedded_label('VEP') == 'transcript'
    assert test_vcf.get_sub_embedded_label('dbNSFPTranscript') == 'transcript'
    assert test_vcf.get_sub_embedded_label('ANNOVAR') == None


def test_VCFP_one_variant(test_vcf):
    """
    Tests that we can correctly process a single VCF variant
    Checks many specific things about the record for correctness
    """
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)

    # check top level fields
    assert result['annovar_cytoband'] == '1p36.33'
    assert result['dbnsfp_genocanyon_score'] == 0.999999999998938
    assert result['clinvar_alleleid'] == '244110'
    assert result['clinvar_clnvcso'] == 'SO:0001483'

    # check sub-embedded object fields
    assert result['transcript'][0]['vep_feature'] == 'ENST00000379370'
    assert result['transcript'][1]['vep_feature'] == 'ENST00000620552'
    assert result['transcript'][0]['vep_pheno'] == ['1', '1']
    assert result['transcript'][0]['vep_codons'] == 'Ggc/Agc'
    assert result['transcript'][0]['dbnsfptranscript_sift4g_pred'] == 'D'
    assert result['transcript'][0]['dbnsfptranscript_mutationassessor_score'] == 2.19

def test_VCFP_multiple_variants(test_vcf):
    """
    Tests that we can correctly process an annotated VCF with multiple records
    """
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    # check all the same things as the previous test, as they should be the same
    assert result['annovar_cytoband'] == '1p36.33'
    assert result['dbnsfp_genocanyon_score'] == 0.999999999998938
    assert result['clinvar_alleleid'] == '244110'
    assert result['clinvar_clnvcso'] == 'SO:0001483'
    assert result['transcript'][0]['vep_feature'] == 'ENST00000379370'
    assert result['transcript'][1]['vep_feature'] == 'ENST00000620552'
    assert result['transcript'][0]['vep_pheno'] == ['1', '1']
    assert result['transcript'][0]['vep_codons'] == 'Ggc/Agc'
    assert result['transcript'][0]['dbnsfptranscript_sift4g_pred'] == 'D'
    assert result['transcript'][0]['dbnsfptranscript_mutationassessor_score'] == 2.19

    # check record 2
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    assert len(result['transcript'].keys()) == 9
    assert result['transcript'][0]['vep_location'] == '1:1044368'
    assert result['transcript'][0]['dbnsfptranscript_sift_score'] == 0.036
    assert result['transcript'][4]['vep_distance'] == 1031
    assert result['transcript'][6]['vep_hgvsc'] == 'ENST00000620552.4:c.1769A>T'
    assert result['transcript'][6]['dbnsfptranscript_vest4_score'] == 0.283
    assert result['gnomadexome_ac_sas'] == 675
    assert result['dbnsfp_gm12878_fitcons_rankscore'] == 0.89359
    assert result['clinvar_clnhgvs'] == 'NC_000001.11:g.1044368A>T'
    assert result['kaviar_an'] == 155504.0
    assert result['1000gp_afr_af'] == 0.0008

    # check record 3
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    assert len(result['transcript'].keys()) == 7
    assert result['transcript'][0]['vep_location'] == '1:1804548'
    assert result['transcript'][0]['dbnsfptranscript_sift_score'] == 0.001
    assert result['transcript'][1]['vep_trembl'] == 'F6UT28'
    assert result['transcript'][1]['dbnsfptranscript_sift_pred'] == 'D'
    assert result['transcript'][2]['dbnsfptranscript_fathmm_score'] == 5.08
    assert result['transcript'][4]['vep_allele'] == 'C'
    assert result['transcript'][6]['vep_hgvsc'] == 'ENST00000615252.4:c.1A>G'
    assert result['transcript'][6]['dbnsfptranscript_vest4_score'] == 0.736
    assert result['dbnsfp_cadd_raw'] == 3.318765
    assert result['clinvar_clnsig'] == 'Pathogenic/Likely_pathogenic'
    assert result['clinvar_clnvc'] == 'single_nucleotide_variant'
    assert result['dbsnp_rs'] == '869312825'


def test_VCFP_multiple_sample_variants(test_vcf):
    """ Generates 3 sample variant items and checks them for correctness """
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)
    assert result['DP'] == 12
    assert result['AF'] == [1.0]
    assert result['QUAL'] == 403.9
    assert result['FILTER'] == 'VQSRTrancheSNP99.90to100.00'
    assert result['GT'] == '1/1'
    assert result['PL'] == [430, 36, 0]
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)
    assert result['DP'] == 42
    assert result['AF'] == [0.833]
    assert result['QUAL'] == 3202.19
    assert result['FILTER'] == 'VQSRTrancheSNP99.00to99.90'
    assert result['GT'] == '1/1'
    assert result['GQ'] == 99
    assert result['PL'] == [1720, 126, 0]
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)
    assert result['DP'] == 2
    assert result['AF'] == [0.5]
    assert result['QUAL'] == 58.56
    assert result['FILTER'] == 'VQSRTrancheSNP99.00to99.90'
    assert result['AD'] == [0, 2]


def test_VCFP_post_sample_variants(testapp, institution, project, test_vcf):
    """ Attempts to post all generated sample variants """
    CONNECTION_URL = '/variant_sample'
    for record in test_vcf:
        variant_sample = test_vcf.create_sample_variant_from_record(record)
        variant_sample['project'] = 'encode-project'
        variant_sample['institution'] = 'encode-institution'
        testapp.post_json(CONNECTION_URL, variant_sample, status=201)


def test_VCFP_post_variants(testapp, institution, project, test_vcf):
    """ Attempts to post all generated variants """
    CONNECTION_URL = '/variant'
    for record in test_vcf:
        variant = test_vcf.create_variant_from_record(record)
        variant['project'] = 'encode-project'
        variant['institution'] = 'encode-institution'
        test_vcf.format_variant(variant)
        testapp.post_json(CONNECTION_URL, variant, status=201)


def test_VCFP_run(testapp, institution, project, test_vcf):
    """ Tests the 'run' method, which processes all the VCF records
        Actaul results are already validated in previous 3 tests, just
        check to see that we get the 3 that we expect and they post correctly
    """
    vss, vs = test_vcf.run(project='encode-project', institution='encode-institution')
    assert len(vss) == 3
    assert len(vs) == 3
    for v in vs:
        testapp.post_json('/variant', v, status=201)
    for vs in vss:
        testapp.post_json('/variant_sample', vs, status=201)
