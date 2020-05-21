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
from encoded.tests.variant_fixtures import (  # noqa
    gene_workbook,
    post_variant_consequence_items,
    MAX_POSTS_FOR_TESTING,
)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]


@pytest.fixture
def test_vcf():
    parser = VCFParser(TEST_VCF, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
    return parser


def test_VCFP_meta(test_vcf):
    """ Checks that we can correctly read which fields are annotation """
    annotation_fields = test_vcf.annotation_keys
    for annot_field in EXPECTED_ANNOTATION_FIELDS:
        assert annot_field in annotation_fields
    assert test_vcf.get_sub_embedded_label('VEP') == 'transcript'
    assert test_vcf.get_sub_embedded_label('GENES') == 'genes'
    assert test_vcf.get_sub_embedded_label('HG19') == 'hg19'
    assert test_vcf.get_sub_embedded_label('CLINVAR_SUBMISSION') == 'clinvar_submission'
    assert test_vcf.get_sub_embedded_label('ANNOVAR') is None


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
    assert result['conservation_phastcons30'] == 0.545
    assert result['dbsnp_rs_number'] == 'rs72631890'
    assert result['gnomad_an_raw'] == 143376

    # check sub-embedded object fields
    assert result['transcript'][0]['vep_consequence'] == ['missense_variant']
    assert result['transcript'][0]['vep_symbol'] == 'NOC2L'
    assert result['transcript'][0]['vep_canonical'] is True
    assert result['transcript'][10]['vep_tsl'] == 5


def test_VCFP_multiple_variants(test_vcf):
    """
    Tests that we can correctly process an annotated VCF with multiple records
    """
    test_VCFP_one_variant(test_vcf)  # run previous test

    # check record 2
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)

    # check top level fields
    assert result['conservation_phylop20'] == -0.91
    assert result['conservation_phylop30'] == -1.239
    assert result['topmed_het'] == 67
    assert result['cosmic_mutation_somatic_status'] == 'Confirmed somatic variant'
    assert result['conservation_phastcons100'] == 0.0

    # check transcript
    assert len(result['transcript'].keys()) == 6
    assert result['transcript'][0]['vep_consequence'] == ['inframe_deletion']
    assert result['transcript'][3]['vep_consequence'] == ['downstream_gene_variant']
    assert result['transcript'][0]['vep_feature'] == 'ENST00000341290'
    assert result['transcript'][5]['vep_feature'] == 'ENST00000491024'
    assert result['transcript'][0]['vep_domains'] == ['PANTHER:PTHR47282']

    # check genes
    assert result['genes'][0]['genes_ensg'] == 'ENSG00000187642'
    assert result['genes'][1]['genes_ensg'] == 'ENSG00000187583'

    # check hg19
    assert result['hg19'][0]['hg19_pos'] == 914414

    # check record 3 (only a few things)
    record = test_vcf.read_next_record()
    result = test_vcf.create_variant_from_record(record)
    assert len(result['transcript'].keys()) == 3
    assert result['transcript'][0]['vep_consequence'] == ['intron_variant']
    assert result['transcript'][0]['vep_feature'] == 'ENST00000624652'
    assert result['transcript'][1]['vep_trembl'] == 'A0A096LPJ4'
    assert result['gnomad_ac_afr_male'] == 158
    assert result['topmed_het'] == 403


def test_VCFP_multiple_sample_variants(test_vcf):
    """ Generates 3 sample variant items and checks them for correctness """
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)
    for sample in result:
        assert sample['GT'] != '0/0'  # this VCF has one of these that should be dropped
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)[0]
    assert result['DP'] == 38
    assert result['GT'] == '0/1'
    assert result['GQ'] == 99
    assert result['PL'] == '876,0,605'
    record = test_vcf.read_next_record()
    result = test_vcf.create_sample_variant_from_record(record)[0]
    assert result['DP'] == 52
    assert len(result['samplegeno']) == 3
    assert 'NUMGT' in result['samplegeno'][0]
    assert 'AD' in result['samplegeno'][0]
    assert 'GT' in result['samplegeno'][0]


def test_VCFP_post_sample_variants(testapp, institution, project, test_vcf):
    """ Attempts to post all generated sample variants without links"""
    CONNECTION_URL = '/variant_sample'
    for idx, record in enumerate(test_vcf):
        if idx == MAX_POSTS_FOR_TESTING:
            break
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'encode-project'
            sample['institution'] = 'encode-institution'
            testapp.post_json(CONNECTION_URL, sample, status=201)


def test_VCFP_post_variants(testapp, institution, project, test_vcf, gene_workbook, post_variant_consequence_items):
    """ Attempts to post all generated variants without links """
    CONNECTION_URL = '/variant'
    for idx, record in enumerate(test_vcf):
        if idx == MAX_POSTS_FOR_TESTING:
            break
        variant = test_vcf.create_variant_from_record(record)
        variant['project'] = 'encode-project'
        variant['institution'] = 'encode-institution'
        test_vcf.format_variant_sub_embedded_objects(variant)
        testapp.post_json(CONNECTION_URL, variant, status=201)


# @pytest.mark.skip  # will not run currently without valid VCF
# def test_VCFP_run(testapp, institution, project, test_vcf, gene_workbook, post_variant_consequence_items):
#     """ Tests the 'run' method, which processes all the VCF records
#         Actual results are already validated in previous 3 tests, just
#         check to see that we get the 3 that we expect and they post correctly
#     """
#     vss, vs = test_vcf.run(project='encode-project', institution='encode-institution')
#     assert len(vss) == 20
#     assert len(vs) == 11
#     for v in vs[:MAX_POSTS_FOR_TESTING]:
#         testapp.post_json('/variant', v, status=201)
#     for vs in vss[:MAX_POSTS_FOR_TESTING]:
#         testapp.post_json('/variant_sample', vs, status=201)


def test_VCFP_make_links(testapp, institution, project, test_vcf, gene_workbook, post_variant_consequence_items):
    """ Will post all generated variants and samples, forming linkTo's from variant_sample to variant """
    VARIANT_URL, VARIANT_SAMPLE_URL = '/variant', '/variant_sample'
    for idx, record in enumerate(test_vcf):
        if idx == MAX_POSTS_FOR_TESTING:
            break
        variant = test_vcf.create_variant_from_record(record)
        variant['project'] = 'encode-project'
        variant['institution'] = 'encode-institution'
        test_vcf.format_variant_sub_embedded_objects(variant)
        res = testapp.post_json(VARIANT_URL, variant, status=201).json['@graph'][0]  # only one item posted
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'encode-project'
            sample['institution'] = 'encode-institution'
            sample['variant'] = res['@id']  # make link
            testapp.post_json(VARIANT_SAMPLE_URL, sample, status=201)
