import os
import pytest
from encoded.tests.data.sample_vcfs.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    SINGLE_RECORD_FULL,
    EXPECTED_ANNOTATION_FIELDS,
    EXPECTED_GENERIC_FIELDS,
    EXPECTED_ANNOVAR_FIELDS,
    RESULT_EXPECTED_FIELDS
)
from encoded.commands.ingest_vcf import (
    VCFParser
)


@pytest.fixture
def single_record():
    parser = VCFParser(SINGLE_RECORD_FULL, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
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
