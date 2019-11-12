import os
import pytest
from encoded.tests.data.sample_vcfs.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    SINGLE_RECORD_FULL,
    EXPECTED_ANNOTATION_FIELDS,
    EXPECTED_GENERIC_FIELDS,
    EXPECTED_ANNOVAR_FIELDS
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
    """ Tests that we can correctly process a single VCF variant """
    record = single_record.get_record()
    result = single_record.parse_vcf_record(record)
    for field in result['ANNOVAR']:
        assert field in EXPECTED_ANNOVAR_FIELDS
