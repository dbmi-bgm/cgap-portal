import os
import pytest
from encoded.tests.data.sample_vcfs.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    SINGLE_RECORD_FULL,
    EXPECTED_ANNOTATION_FIELDS,
    EXPECTED_GENERIC_FIELDS,
    EXPECTED_ANNOVAR_FIELDS,
    RESULT_EXPECTED_FIELDS,
    TEST_VCF_FULL
)
from encoded.commands.ingest_vcf import (
    VCFParser
)


@pytest.fixture
def single_record():
    parser = VCFParser(SINGLE_RECORD_FULL, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
    return parser


@pytest.fixture
def test_vcf():
    parser = VCFParser(TEST_VCF_FULL, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
    return parser


def test_VCFParser_single_record_meta(single_record):
    """ Checks that we can correctly read which fields are annotation """
    annotation_fields = single_record.get_annotation_fields()
    for annot_field in EXPECTED_ANNOTATION_FIELDS:
        assert annot_field in annotation_fields
    generic_fields = single_record.get_generic_fields()
    for generic_field in EXPECTED_GENERIC_FIELDS:
        assert generic_field in generic_fields


def test_VCFParser_single_record_full(single_record):
    """
    Tests that we can correctly process a single VCF variant
    Checks many specific things about the record for correctness
    """
    record = single_record.get_record()
    result = single_record.parse_vcf_record(record)
    for field in result['ANNOVAR']:
        assert field in EXPECTED_ANNOVAR_FIELDS
    for top_level_field in result:
        assert top_level_field in RESULT_EXPECTED_FIELDS
    assert result['QD'] == 29.28
    assert result['MLEAC'] == [2]
    assert result['MQ'] == 65.65
    assert result['ANNOVAR']['Func.ensGene'][0] == 'intergenic'
    assert result['ANNOVAR']['Func.knownGene'][0] == 'intergenic'
    assert result['ANNOVAR']['cytoBand'][0] == '1p36.33'
    assert len(result['VEP']['Location'].keys()) == 7 # varying entry amount
    assert len(result['VEP']['Allele'].keys()) == 7
    assert len(result['VEP']['UNIPARC'].keys()) == 2
    assert len(result['VEP']['ENSP'].keys()) == 4
    assert result['VEP']['Codons'][3] == 'Atg/Gtg'
    assert result['dbNSFP']['codon_degeneracy'][0] == '0'
    assert result['dbNSFP']['CADD_raw'][0] == '1.955781'
    for key in result['CADD'].keys(): # all entries should have 3
        assert len(result['CADD'][key].keys()) == 3
    for key in result['genomicSuperDups'].keys(): # all entries should have 2
        assert len(result['genomicSuperDups'][key].keys()) == 2
    assert result['dgvMerged']['name'][0] == '585'
    assert result['dgvMerged']['name'][5] == '73'
    assert result['dgvMerged']['varType'][1] == 'loss'
    assert result['dgvMerged']['pubMedId'][11] == '20981092'
    assert result['Chrom'] == 'chr1'
    assert result['Ref'] == 'A'
    assert result['ID'] is None


def test_VCFParser_full(test_vcf):
    """
    Tests that we can correctly process an annotated VCF with multiple records
    """
    record = test_vcf.get_record()
    result = test_vcf.parse_vcf_record(record)
    for field in result['ANNOVAR']:
        assert field in EXPECTED_ANNOVAR_FIELDS
    for top_level_field in result:
        assert top_level_field in RESULT_EXPECTED_FIELDS
    # check all the same things as the previous test, as they should be the same
    assert result['QD'] == 29.28
    assert result['MLEAC'] == [2]
    assert result['MQ'] == 65.65
    assert result['ANNOVAR']['Func.ensGene'][0] == 'intergenic'
    assert result['ANNOVAR']['Func.knownGene'][0] == 'intergenic'
    assert result['ANNOVAR']['cytoBand'][0] == '1p36.33'
    assert len(result['VEP']['Location'].keys()) == 7 # varying entry amount
    assert len(result['VEP']['Allele'].keys()) == 7
    assert len(result['VEP']['UNIPARC'].keys()) == 2
    assert len(result['VEP']['ENSP'].keys()) == 4
    assert result['VEP']['Codons'][3] == 'Atg/Gtg'
    assert result['dbNSFP']['codon_degeneracy'][0] == '0'
    assert result['dbNSFP']['CADD_raw'][0] == '1.955781'
    for key in result['CADD'].keys(): # all entries should have 3
        assert len(result['CADD'][key].keys()) == 3
    for key in result['genomicSuperDups'].keys(): # all entries should have 2
        assert len(result['genomicSuperDups'][key].keys()) == 2
    assert result['dgvMerged']['name'][0] == '585'
    assert result['dgvMerged']['name'][5] == '73'
    assert result['dgvMerged']['varType'][1] == 'loss'
    assert result['dgvMerged']['pubMedId'][11] == '20981092'
    assert result['Chrom'] == 'chr1'
    assert result['Ref'] == 'A'
    assert result['ID'] is None

    # check next entry for correctness
    record = test_vcf.get_record()
    result = test_vcf.parse_vcf_record(record)
    for field in result['ANNOVAR']:
        assert field in EXPECTED_ANNOVAR_FIELDS
    for top_level_field in result:
        assert top_level_field in RESULT_EXPECTED_FIELDS
    # check correctness of fields for the second record
    assert result['AF'] == [1.0]
    assert result['DP'] == 12
    assert result['MQ'] == 44.51
    assert result['ANNOVAR']['Func.ensGene'][0] == 'exonic'
    assert result['ANNOVAR']['Func.knownGene'][0] == 'exonic'
    assert result['ANNOVAR']['Gene.ensGene'][0] == 'OR4F5'
    assert len(result['VEP']['Location'].keys()) == 4 # varying entry amount
    assert len(result['VEP']['Allele'].keys()) == 4
    assert len(result['VEP']['SWISSPROT'].keys()) == 1
    assert len(result['VEP']['TREMBL'].keys()) == 1
    assert result['VEP']['CCDS'][1] == 'CCDS30547.1'
    assert result['VEP']['TREMBL'][2] == 'A0A2U3U0J3'
    assert result['ESP6500']['EA_AC_ALT'][0] == '5337'
    assert result['ESP6500']['AA_AC_ALT'][0] == '1937'
    assert result['ESP6500']['MAF_AA'][0] == '45.5899'
    assert result['ExAC']['AC_Adj'][0] == '72743'
    assert result['ExAC']['AC_EAS'][0] == '8379'
    assert result['ExAC']['AC_NFE'][0] == '37731'
    assert result['ExACnonpsych']['AN_AMR'][0] == '6466'
    assert result['ExACnonpsych']['AN_EAS'][0] == '5424'
    assert result['ExACnonpsych']['DP'][0] == '2408573'
    assert result['ExACnonTCGA']['AN_FIN'][0] == '3320'
    assert result['ExACnonTCGA']['AN_OTH'][0] == '452'
    assert result['gnomAD']['AC_afr'][0] == '15784'
    assert result['gnomAD']['nhomalt_nfe'][0] == '16125'
    assert result['gnomAD']['nhomalt_sas_female'][0] == '125'
    assert result['gnomAD']['AC_oth_male'][0] == '424'
    assert result['gnomADexome']['AC_amr'][0] == '19014'
    assert result['gnomADexome']['AN_amr_female'][0] == '11748'
    assert result['dbNSFP']['Denisova'][0] == './.'
    assert result['dbNSFP']['phastCons17way_primate_rankscore'][0] == '0.18915'
    assert result['dbNSFP']['Eigen-PC-phred_coding'][0] == '0.1837653'
    for key in result['CADD'].keys(): # all entries should have 2
        assert len(result['CADD'][key].keys()) == 2
    assert result['SpliceAI']['DS_DG'][0] == '0.02'
    assert result['SpliceAI']['DP_AG'][0] == '26'
    assert result['INTERVAR']['InterVar_automated'][0] == 'Benign'
    assert result['INTERVAR']['BS1'][0] == '1'
    assert result['INTERVAR']['BS3'][0] == '0'
    assert result['genomicSuperDups']['otherChrom'][1] == 'chr19'
    assert result['genomicSuperDups']['otherEnd'][0] == '101981189'
    for key in result['dgvMerged'].keys(): # all entries should have 13
        assert len(result['dgvMerged'][key].keys()) == 13

    # check record 3
    record = test_vcf.get_record()
    result = test_vcf.parse_vcf_record(record)
    for field in result['ANNOVAR']:
        assert field in EXPECTED_ANNOVAR_FIELDS
    for top_level_field in result:
        assert top_level_field in RESULT_EXPECTED_FIELDS
    assert result['BaseQRankSum'] == 1.04
    assert result['ExcessHet'] == 3.0103
    assert result['Chrom'] == 'chr1'
    assert result['ANNOVAR']['Gene.ensGene'][0] == 'AGRN'
    assert result['ANNOVAR']['Func.refGene'][0] == 'exonic'
    assert len(result['VEP']['Location'].keys()) == 16
    assert len(result['VEP']['Allele'].keys()) == 16
    assert len(result['VEP']['GENE_PHENO'].keys()) == 9
    assert len(result['VEP']['DISTANCE'].keys()) == 5
    assert result['VEP']['SYMBOL_SOURCE'][3] == 'HGNC'
    assert result['VEP']['BIOTYPE'][2] == 'retained_intron'
    assert result['VEP']['Gene'][3] == 'ENSG00000188157'
    assert result['VEP']['Feature'][0] == 'CCDS30551.1'
    assert result['VEP']['TREMBL'][7] == 'A0A087X208'
    assert result['1000GP']['AN'][0] == '5008'
    assert result['1000GP']['EUR_AF'][0] == '0.0467'
    assert result['ESP6500']['TAC_ALT'][0] == '404'
    assert result['ESP6500']['AA_AC_ALT'][0] == '38'
    assert result['KAVIAR']['AC'][0] == '4528'
    assert result['UK10K']['DP'][0] == '21610'
    assert result['TOPmed']['AF'][0] == '0.0275707'
    assert result['TOPmed']['Hom'][0] == '60'
    assert result['dbSNP']['RS'][0] == '113288277'
    assert result['gnomAD']['AN_amr_male'][0] == '7738'
    assert result['gnomAD']['AN_asj_female'][0] == '1760'
    assert result['gnomAD']['nhomalt'][0] == '98'
    assert result['gnomAD']['nhomalt_amr'][0] == '6'
    assert result['gnomADexome']['AC_eas_male'][0] == '41'
    assert result['gnomADexome']['AC_eas'][0] == '77'
    assert result['gnomADexome']['AC_oth'][0] == '206'
    assert result['dbNSFP']['CADD_raw_rankscore'][0] == '0.92371'
    assert result['dbNSFP']['GERP++_NR'][0] == '4.58'
    assert result['dbNSFP']['phastCons30way_mammalian_rankscore'][0] == '0.39996'
    assert result['dbNSFP']['clinvar_id'][0] == '128294'
    assert result['CADD']['Consequence'][0] == 'NON_SYNONYMOUS'
    assert result['CADD']['AnnoType'][0] == 'CodingTranscript'
    assert result['CADD']['protPos'][0] == '728'
    assert result['CADD']['EncodeH3K4me1-sum'][0] == '3.61'
    assert result['CADD']['Rare1000bp'][0] == '18'
    for key in result['dgvMerged'].keys(): # all entries should have 13
        assert len(result['dgvMerged'][key].keys()) == 15
