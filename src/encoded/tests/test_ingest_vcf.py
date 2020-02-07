import os
import pytest
from encoded.tests.data.sample_vcfs.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    EXPECTED_ANNOTATION_FIELDS,
    TEST_VCF,
    RAW_INFOTAG_DESCRIPTION,
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
    assert test_vcf.get_sub_embedded_label('ANNOVAR') == None


def test_VCFP_one_variant(test_vcf):
    """
    Tests that we can correctly process a single VCF variant
    Checks many specific things about the record for correctness
    For all the following tests we check a 'representative subset' of information
    """
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)

    # check top level fields
    assert result['CHROM'] == '1'
    assert result['cytoband_cytoband'] == '1p36.33'
    assert result['conservation_phastcons30'] == 0.283
    assert result['clinvar_clnhgvs'] == 'NC_000001.11:g.1014359G>T'
    assert result['clinvar_clndn'] == ['Immunodeficiency_38_with_basal_ganglia_calcification']

    # check sub-embedded object fields
    assert result['transcript'][0]['vep_consequence'] == ['upstream_gene_variant']
    assert result['transcript'][0]['vep_impact'] == 'MODIFIER'
    assert result['transcript'][0]['vep_pubmed'] == ['29618732', '25307056', '22859821']
    assert result['transcript'][0]['vep_tssdistance'] == 1166
    assert result['transcript'][0]['vep_somatic'] == [False, False, True]
    assert result['transcript'][1]['vep_symbol'] == 'ISG15'

def test_VCFP_multiple_variants(test_vcf):
    """
    Tests that we can correctly process an annotated VCF with multiple records
    """
    test_VCFP_one_variant(test_vcf)  # run previous test
    # check record 2
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    assert len(result['transcript'].keys()) == 2
    assert result['transcript'][0]['vep_consequence'] == ['missense_variant']
    assert result['transcript'][0]['vep_feature'] == 'ENST00000379370'
    assert result['transcript'][0]['vep_domains'] == ['Gene3D:2.40.50.120', 'Pfam:PF03146', 
                                                      'PROSITE_profiles:PS51121', 'Superfamily:SSF50242']
    assert result['transcript'][1]['vep_hgnc_id'] == 'HGNC:329'
    assert result['transcript'][1]['vep_clin_sig'] == 'pathogenic'
    assert result['conservation_phylop20'] == 1.048
    assert result['conservation_phylop30'] == 1.175
    assert result['clinvar_clnhgvs'] == 'NC_000001.11:g.1022225G>A'
    assert result['clinvar_clnrevstat'] == ['no_assertion_criteria_provided']
    assert result['conservation_phastcons100'] == 1.0

    # check record 3
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    assert len(result['transcript'].keys()) == 2
    assert result['transcript'][0]['vep_consequence'] == ['missense_variant']
    assert result['transcript'][0]['vep_feature'] == 'ENST00000379370'
    assert result['transcript'][0]['vep_domains'] == ['Gene3D:2.40.50.120', 'Pfam:PF03146', 
                                                      'PROSITE_profiles:PS51121', 'PANTHER:PTHR10574', 
                                                      'PANTHER:PTHR10574:SF288', 'Superfamily:SSF50242']
    assert result['transcript'][1]['vep_trembl'] == 'A0A087X208'
    assert result['clinvar_geneinfo'] == 'AGRN:375790'
    assert result['spliceai_ds_dl'] == 0.0
    assert result['cadd_phred'] == 29.0
    assert result['spliceai_dp_ag'] == 5
    assert result['CHROM'] == '1'


def test_VCFP_multiple_sample_variants(test_vcf):
    """ Generates 3 sample variant items and checks them for correctness """
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)[0]
    assert result['DP'] == 22
    assert result['AF'] == 0.333
    assert result['GT'] == '0/0'
    assert result['PL'] == '0,18,270'
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)[0]
    assert result['DP'] == 70
    assert result['AF'] == 1.0
    assert result['GT'] == '1/1'
    assert result['GQ'] == 99
    assert result['PL'] == '2839,211,0'
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)[0]
    assert result['DP'] == 66
    assert result['AF'] == 0.833
    #assert result['AD'] == [0, 66]


def test_VCFP_post_sample_variants(testapp, institution, project, test_vcf):
    """ Attempts to post all generated sample variants """
    CONNECTION_URL = '/variant_sample'
    for record in test_vcf:
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'encode-project'
            sample['institution'] = 'encode-institution'
            testapp.post_json(CONNECTION_URL, sample, status=201)


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
        Actual results are already validated in previous 3 tests, just
        check to see that we get the 3 that we expect and they post correctly
    """
    vss, vs = test_vcf.run(project='encode-project', institution='encode-institution')
    assert len(vss) == 2895
    assert len(vs) == 965
    for v in vs:
        testapp.post_json('/variant', v, status=201)
    for vs in vss:
        testapp.post_json('/variant_sample', vs, status=201)
