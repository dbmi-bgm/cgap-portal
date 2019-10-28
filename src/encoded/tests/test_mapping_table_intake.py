import os
import csv
import json
import pytest
from encoded.commands.mapping_table_intake import (
    process_fields,
    read_mapping_table,
    process_inserts,
    get_sample_inserts,
    get_variant_inserts,
    generate_properties,
    add_default_schema_fields,
    generate_variant_sample_schema,
    generate_variant_schema
)

pytestmark = [pytest.mark.working]
FNAME = './src/encoded/tests/mp.csv' # symlinked from encoded.commands
EXPECTED_FIELDS = ['field_name', 'vcf_name', 'value_example', 'field_type',
                    'enum_list', 'scale', 'domain', 'method', 'annotation_grouping',
                    'is_list', 'sub_embedding_group', 'separator', 'scope',
                    'schema_title', 'schema_description', 'source_name',
                    'source_version', 'field_priority', 'column_priority',
                    'facet_priority', 'links_to', 'mvp']
EXPECTED_INSERT = {'is_list': False, 'field_name': 'chrom', 'mvp': True, 'schema_title':
               'Chromosome', 'enum_list': ['1', '2', '3', '4', '5', '6', '7', '8',
               '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
               '21', '22', 'X', 'Y', 'M'], 'institution': 'hms-dbmi', 'field_type':
               'string', 'column_priority': 1, 'field_priority': 1, 'project':
               '12a92962-8265-4fc0-b2f8-cf14f05db58b', 'submitted_by': 'koray_kirli@hms.harvard.edu',
               'scope': 'variant', 'source_version': 'VCFv4.2', 'source_name': 'VCF',
               'value_example': '1', 'vcf_name': 'CHROM'}
EXPECTED_VARIANT_SAMPLE_FIELDS = ['sample', 'variant', 'qual', 'filter', 'call_info',
                           'gt', 'ad', 'dp', 'gq', 'pl', 'pgt', 'pid', 'ps', 'af']
MVP_EXPECTED = 317
SAMPLE_FIELDS_EXPECTED = 12
VARIANT_FIELDS_EXPECTED = 305

@pytest.fixture
def fields():
    _, _, FIELDS = read_mapping_table(FNAME)
    return FIELDS


@pytest.fixture
def inserts(fields):
    return process_inserts(FNAME, fields)


@pytest.fixture
def sample_variant_items(inserts):
    return generate_properties(inserts, variant=False)


@pytest.fixture
def variant_items(inserts):
    return generate_properties(inserts)


def test_add_default_schema_fields():
    """ Tests that default fields are added """
    schema = {}
    add_default_schema_fields(schema)
    assert '$schema' in schema
    assert 'type' in schema
    assert 'required' in schema
    assert 'identifyingProperties' in schema
    assert 'additionalProperties' in schema
    assert 'mixinProperties' in schema


def test_read_mapping_table():
    """ Tests that we can read mapping table header correctly based on the current format """
    VERSION, DATE, FIELDS = read_mapping_table(FNAME)
    assert VERSION == 'annV1'
    assert DATE == '09.13.19'
    assert sorted(FIELDS) == sorted(EXPECTED_FIELDS)


def test_process_inserts(inserts):
    """ Tests that we properly process an inserts into mvp, sample, variant """
    assert inserts[0] == EXPECTED_INSERT
    mvp_list = [i for i in inserts if i.get('mvp')]
    assert len(mvp_list) == MVP_EXPECTED
    sample = [i for i in mvp_list if i.get('scope') == 'sample']
    assert len(sample) == SAMPLE_FIELDS_EXPECTED
    variant = [i for i in mvp_list if i.get('scope') != 'sample']
    assert len(variant) == VARIANT_FIELDS_EXPECTED
    variant = get_variant_inserts(inserts)
    assert len(variant) == VARIANT_FIELDS_EXPECTED
    sample = get_sample_inserts(inserts)
    assert len(sample) == SAMPLE_FIELDS_EXPECTED


def test_generate_sample_json_items(inserts):
    """ Tests that sample JSON is being created correctly checking three we expect """
    sample_props, _, _ = generate_properties(inserts, variant=False)
    assert sample_props['qual']['title'] == 'Quality score'
    assert sample_props['qual']['vcf_name'] == 'QUAL'
    assert sample_props['qual']['type'] == 'number'
    assert sample_props['pid']['title'] == 'Physical phasing ID information'
    assert sample_props['pid']['vcf_name'] == 'PID'
    assert sample_props['pid']['type'] == 'string'
    assert sample_props['af']['title'] == 'Allele fraction'
    assert sample_props['af']['source_name'] == 'VCF'
    assert sample_props['af']['source_version'] == 'VCFv4.2'


def test_generate_variant_json_items(inserts):
    """ Tests that variant JSON along with columns and facets are produced """
    var_props, cols, facs = generate_properties(inserts)
    assert cols['chrom']['title'] == 'Chromosome'
    assert cols['pos']['title'] == 'Position'
    assert cols['id']['title'] == 'ID'
    assert cols['ref']['title'] == 'Reference allele'
    assert cols['alt']['title'] == 'Alternative allele'
    assert facs['clinsig']['title'] == 'ClinVar significance'
    assert var_props['cytoband']['title'] == 'Cytoband'
    assert var_props['cytoband']['type'] == 'string'
    assert var_props['cytoband']['scale'] == 'WINDOW'
    assert var_props['cytoband']['domain'] == 'FUNCTION'
    assert var_props['cytoband']['source_name'] == 'ANNOVAR'
    assert var_props['exac_sas']['title'] == 'ExAC Allele frequency in South Asian samples'
    assert var_props['exac_sas']['vcf_name'] == 'ExAC_SAS'
    assert var_props['exac_sas']['type'] == 'number'
    assert var_props['exac_sas']['scale'] == 'VARIANT'
    assert var_props['exac_sas']['domain'] == 'POPULATION GENETICS'
    assert var_props['exac_sas']['source_name'] == 'ExAC'
    assert var_props['exac_sas']['source_version'] == '3'


def test_generate_variant_sample_schema(sample_variant_items):
    """ Tests some aspects of the variant_sample schema """
    items, _, _ = sample_variant_items
    schema = generate_variant_sample_schema(items)
    properties = schema['properties']
    for field in EXPECTED_VARIANT_SAMPLE_FIELDS:
        assert field in properties
    assert properties['ad']['items']['vcf_name'] == 'AD'
    assert properties['ad']['type'] == 'array'
    assert properties['ad']['items']['type'] == 'integer'
    assert properties['ps']['vcf_name'] == 'PS'
    assert 'description' in properties['ps']
    assert 'columns' in schema
    assert 'facets' in schema


def test_generate_variant_schema(variant_items):
    items, cols, facs = variant_items
    schema = generate_variant_schema(items, cols, facs)
    properties = schema['properties']
    assert properties['chrom']['vcf_name'] == 'CHROM'
    assert properties['chrom']['source_name'] == 'VCF'
    assert properties['chrom']['type'] == 'string'
    assert 'enum' in properties['chrom']
    assert properties['alt']['vcf_name'] == 'ALT'
    assert properties['alt']['type'] == 'array'
    assert properties['alt']['items']['vcf_name'] == 'ALT'
    assert properties['alt']['items']['type'] == 'string'
    assert properties['alt']['items']['separator'] == 'comma'
    assert properties['alt']['items']['lookup'] == 5
    assert properties['alt']['lookup'] == 5
    assert len(properties['transcript_snpeff']['items']['properties']) == 16
    assert properties['transcript_snpeff']['items']['properties']['gene_name']['separator'] == 'semicolon'
