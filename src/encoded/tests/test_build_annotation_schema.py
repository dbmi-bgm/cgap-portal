import os
import csv
import json
import pytest
from encoded.commands.build_annotation_schema import (
    process_fields,
    read_mapping_table,
    add_annotation_schema_fields,
    add_annotation_schema_facets_and_columns,
    build_annotation_field_schema,
    process_inserts,
    generate_sample_json,
    generate_variant_json
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


def test_read_mapping_table():
    """ Tests that we can read mapping table header correctly based on the current format """
    VERSION, DATE, FIELDS = read_mapping_table(FNAME)
    assert VERSION == 'annV1'
    assert DATE == '09.13.19'
    assert sorted(FIELDS) == sorted(EXPECTED_FIELDS)


def test_add_annotation_schema_fields():
    """ Tests that schema fields look right when addded """
    schema = {}
    add_annotation_schema_fields(schema)
    assert 'identifyingProperties' in schema
    assert 'title' in schema
    assert 'type' in schema
    assert schema['type'] == 'object'
    assert 'properties' in schema
    assert 'schema_version' in schema['properties']


def test_add_facets_and_columns():
    """ Tests that facet and column fields are added correctly """
    schema = {}
    add_annotation_schema_facets_and_columns(schema)
    assert 'facets' in schema
    assert 'columns' in schema
    assert 'field_type' in schema['facets']
    assert 'scope' in schema['facets']
    assert 'mvp' in schema['facets']
    assert 'field_type' in schema['columns']
    assert 'source_name' in schema['columns']


def test_build_full_schema(fields):
    """
    Tests that some fields look correct when we build the whole annotation
    field schema. Tests random things about properties that should be there
    """
    schema = json.loads(build_annotation_field_schema(fields))
    assert schema['properties']['field_name']['type'] == 'string'
    assert schema['properties']['is_list']['type'] == 'boolean'
    assert schema['properties']['scale']['title'] == 'Scale'
    assert schema['properties']['domain']['description'] == 'Domain defined by new annotation structure'
    assert sorted(schema['properties']['scope']['enum']) == sorted(['variant', 'sample', 'gene'])
    assert sorted(schema['properties']['links_to']['enum']) == sorted(['Gene', 'Disorder', 'Phenotype'])
    assert schema['properties']['value_example']['type'] == 'string'


def test_process_inserts(inserts):
    """ Tests that we properly process an insert """
    assert inserts[0] == EXPECTED_INSERT
    mvp_list = [i for i in inserts if i.get('mvp')]
    assert len(mvp_list) == MVP_EXPECTED
    sample = [i for i in mvp_list if i.get('scope') == 'sample']
    assert len(sample) == SAMPLE_FIELDS_EXPECTED
    variant = [i for i in mvp_list if i.get('scope') != 'sample']
    assert len(variant) == VARIANT_FIELDS_EXPECTED


def test_generate_sample_json(inserts):
    """ Tests that sample JSON is being created correctly checking three we expect """
    sample_props = generate_sample_json(inserts)
    assert sample_props['qual']['title'] == 'Quality score'
    assert sample_props['qual']['vcf_name'] == 'QUAL'
    assert sample_props['qual']['type'] == 'number'
    assert sample_props['pid']['title'] == 'Physical phasing ID information'
    assert sample_props['pid']['vcf_name'] == 'PID'
    assert sample_props['pid']['type'] == 'string'
    assert sample_props['af']['title'] == 'Allele fraction'
    assert sample_props['af']['source_name'] == 'VCF'
    assert sample_props['af']['source_version'] == 'VCFv4.2'


def test_generate_variant_json(inserts):
    """ Tests that variant JSON along with columns and facets are produced """
    var_props, cols, facs = generate_variant_json(inserts)
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
