import json
import pytest
from encoded.tests.data.variant_workbook.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    EXPECTED_ANNOTATION_FIELDS,
    TEST_VCF,
    RAW_INFOTAG_DESCRIPTION,
)
from encoded.commands.ingest_vcf import (
    VCFParser
)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]


@pytest.fixture
def post_variant_consequence_items(testapp):
    """ Posts VariantConsequence items so we can post variants that link to these """
    vcs = json.load(open('./src/encoded/tests/data/variant_workbook/variant_consequence.json', 'r'))
    for entry in vcs:
        testapp.post_json('/variant_consequence', entry, status=201)


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
    assert result['conservation_phastcons30'] == 0.133
    assert result['clinvar_clnhgvs'] == 'NC_000001.11:g.1014143C>T'
    assert result['clinvar_clndn'] == ['Immunodeficiency_38_with_basal_ganglia_calcification']

    # check sub-embedded object fields
    assert result['transcript'][0]['vep_consequence'] == ['upstream_gene_variant']
    assert result['transcript'][0]['vep_impact'] == 'MODIFIER'
    assert result['transcript'][0]['vep_pubmed'] == ['25307056']
    assert result['transcript'][0]['vep_tssdistance'] == 950
    assert result['transcript'][1]['vep_symbol'] == 'ISG15'

def test_VCFP_multiple_variants(test_vcf):
    """
    Tests that we can correctly process an annotated VCF with multiple records
    """
    test_VCFP_one_variant(test_vcf)  # run previous test
    # check record 2
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    assert len(result['transcript'].keys()) == 5
    assert result['transcript'][0]['vep_consequence'] == ['upstream_gene_variant']
    assert result['transcript'][0]['vep_feature'] == 'ENST00000458555'
    assert result['transcript'][1]['vep_domains'] == ['Gene3D:3.10.20.90', 'Pfam:PF00240',
                                                      'PROSITE_profiles:PS50053', 'PANTHER:PTHR10666',
                                                      'PANTHER:PTHR10666:SF267', 'SMART:SM00213',
                                                      'Superfamily:SSF54236', 'CDD:cd01810']
    assert result['transcript'][1]['vep_hgnc_id'] == 'HGNC:4053'
    assert result['transcript'][1]['vep_clin_sig'] == 'pathogenic'
    assert result['conservation_phylop20'] == -0.903
    assert result['conservation_phylop30'] == -0.772
    assert result['clinvar_clnhgvs'] == 'NC_000001.11:g.1014359G>T'
    assert result['clinvar_clnrevstat'] == ['no_assertion_criteria_provided']
    assert result['conservation_phastcons100'] == 0.0

    # check record 3
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    assert len(result['transcript'].keys()) == 2
    assert result['transcript'][0]['vep_consequence'] == ['missense_variant']
    assert result['transcript'][0]['vep_feature'] == 'ENST00000379370'
    assert result['transcript'][0]['vep_domains'] == ['Gene3D:2.40.50.120', 'Pfam:PF03146',
                                                      'PROSITE_profiles:PS51121', 'Superfamily:SSF50242']
    assert result['transcript'][1]['vep_trembl'] == 'A0A087X208'
    assert result['clinvar_geneinfo'] == 'AGRN:375790'
    assert result['spliceai_ds_dl'] == 0.0
    assert result['cadd_phred'] == 32.0
    assert result['spliceai_dp_ag'] == -24
    assert result['CHROM'] == '1'


def test_VCFP_multiple_sample_variants(test_vcf):
    """ Generates 3 sample variant items and checks them for correctness """
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)
    for sample in result:
        assert sample['GT'] != '0/0'  # this VCF has one of these that should be dropped
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)[0]
    assert result['DP'] == 1
    assert result['GT'] == '1/1'
    assert result['GQ'] == 6
    assert result['PL'] == '73,6,0'
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)[0]
    assert result['DP'] == 70
    assert len(result['samplegeno']) == 3
    assert 'NUMGT' in result['samplegeno'][0]
    assert 'AD' in result['samplegeno'][0]
    assert 'GT' in result['samplegeno'][0]


def test_VCFP_post_sample_variants(testapp, institution, project, test_vcf):
    """ Attempts to post all generated sample variants without links"""
    CONNECTION_URL = '/variant_sample'
    for record in test_vcf:
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'encode-project'
            sample['institution'] = 'encode-institution'
            testapp.post_json(CONNECTION_URL, sample, status=201)


def test_VCFP_post_variants(testapp, institution, project, test_vcf, post_variant_consequence_items):
    """ Attempts to post all generated variants without links """
    CONNECTION_URL = '/variant'
    for record in test_vcf:
        variant = test_vcf.create_variant_from_record(record)
        variant['project'] = 'encode-project'
        variant['institution'] = 'encode-institution'
        test_vcf.format_variant(variant)
        testapp.post_json(CONNECTION_URL, variant, status=201)



def test_VCFP_run(testapp, institution, project, test_vcf, post_variant_consequence_items):
    """ Tests the 'run' method, which processes all the VCF records
        Actual results are already validated in previous 3 tests, just
        check to see that we get the 3 that we expect and they post correctly
    """
    vss, vs = test_vcf.run(project='encode-project', institution='encode-institution')
    assert len(vss) == 20
    assert len(vs) == 11
    for v in vs:
        testapp.post_json('/variant', v, status=201)
    for vs in vss:
        testapp.post_json('/variant_sample', vs, status=201)


def test_VCFP_make_links(testapp, institution, project, test_vcf, post_variant_consequence_items):
    """ Will post all generated variants and samples, forming linkTo's from variant_sample to variant """
    VARIANT_URL, VARIANT_SAMPLE_URL = '/variant', '/variant_sample'
    for record in test_vcf:
        variant = test_vcf.create_variant_from_record(record)
        variant['project'] = 'encode-project'
        variant['institution'] = 'encode-institution'
        test_vcf.format_variant(variant)
        res = testapp.post_json(VARIANT_URL, variant, status=201).json['@graph'][0]  # only one item posted
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'encode-project'
            sample['institution'] = 'encode-institution'
            sample['variant'] = res['@id']  # make link
            testapp.post_json(VARIANT_SAMPLE_URL, sample, status=201)
