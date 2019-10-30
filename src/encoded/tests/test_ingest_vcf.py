import os
import pytest
from encoded.tests.data.sample_vcfs.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    ANN_SINGLE_RECORD,
    ANN_FIELDS,
    ANN_SINGLE_RECORD_EXPECTED,
    ANNOVAR_SINGLE_RECORD,
    ANNOVAR_SINGLE_RECORD_EXPECTED,
    SAMPLE_VCF_V41,
    SAMPLE_VCF_KEYS,
    SAMPLE_VCF_EXPECTED
)
from encoded.commands.ingest_vcf import (
    VCFParser
)

@pytest.fixture
def sample_vcf():
    """ Creates parser for a standard v4.1 VCF """
    return VCFParser(SAMPLE_VCF_V41, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)


@pytest.fixture
def initialized_sample_vcf(sample_vcf):
    """ Initializes the sample_vcf parser with fields """
    sample_vcf.parse_vcf_fields()
    return sample_vcf


@pytest.fixture
def single_record_parser():
    """
    Creates a parser using a vcf with a single record containing 'ANN' annotations
    """
    return VCFParser(ANN_SINGLE_RECORD, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)


@pytest.fixture
def initialized_single_record_parser(single_record_parser):
    """ Initializes the VCFParser for singe_record_parser """
    single_record_parser.parse_vcf_fields()
    return single_record_parser


@pytest.fixture
def single_record_annovar():
    parser = VCFParser(ANNOVAR_SINGLE_RECORD, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
    parser.parse_vcf_fields()
    return parser


def test_VCFParser_generic(sample_vcf):
    """ Tests that we can correctly read a standard v4.1 VCF """
    meta = sample_vcf.read_vcf_metadata()
    assert meta['fileformat'] == 'VCFv4.1'
    assert meta['fileDate'] == '20100501'
    assert meta['reference'] == '1000GenomesPilot-NCBI36'
    fields = sample_vcf.read_vcf_fields()
    assert 'BKPTID' in fields
    assert 'CIEND' in fields
    assert 'CIPOS' in fields
    assert 'HOMLEN' in fields
    assert 'SVTYPE' in fields
    sample_vcf.parse_vcf_fields()
    actual_fields = sample_vcf.format
    assert 'BKPTID' in actual_fields
    assert 'CIEND' in actual_fields
    assert 'CIPOS' in actual_fields
    assert 'HOMLEN' in actual_fields
    assert 'SVTYPE' in actual_fields


def test_VCFParser_generic_record(initialized_sample_vcf):
    """ Tests that we can read records from a standard v4.1 VCF """
    record = initialized_sample_vcf.get_record()
    result = initialized_sample_vcf.parse_vcf_record(record)
    for field in SAMPLE_VCF_KEYS:
        assert field in result
    for field in SAMPLE_VCF_EXPECTED:
        assert result[field] is not None


def test_VCFParser_basic(single_record_parser):
    """ Tests that we can read meta data/fields from an annotated VCF using ANN """
    meta = single_record_parser.read_vcf_metadata()
    assert meta['fileformat'] == 'VCFv4.2'
    assert meta['SnpEffVersion'][0] == '"4.3t (build 2017-11-24 10:18), by Pablo Cingolani"'
    fields = single_record_parser.read_vcf_fields()
    fields_w_key = single_record_parser.read_vcf_fields(key='ANN') # should be same
    assert fields['ANN'] == fields_w_key # must index fields since there could be many
    single_record_parser.parse_vcf_fields()
    actual_fields = single_record_parser.format
    assert sorted(actual_fields['ANN']) == sorted(ANN_FIELDS) # must index for same reason


def test_VCFParser_parse_ANN_record(initialized_single_record_parser):
    """ Tests that we can correctly parse annotation fields for ANN """
    record = initialized_single_record_parser.get_record()
    result = initialized_single_record_parser.parse_vcf_record(record)
    assert result == ANN_SINGLE_RECORD_EXPECTED


def test_VCFParser_parse_ANNOVAR(single_record_annovar):
    """ Tests that we can read/process ANNOVAR annotations """
    record = single_record_annovar.get_record()
    result = single_record_annovar.parse_vcf_record(record)
    assert result == ANNOVAR_SINGLE_RECORD_EXPECTED
