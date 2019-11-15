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
FNAME = './src/encoded/tests/mpv2.csv' # symlinked from encoded.commands
EXPECTED_FIELDS = ['no', 'field_name', 'vcf_name_v0.2', 'source_name_v0.2',
                   'source_version_v0.2', 'field_type', 'value_example',
                   'enum_list', 'is_list', 'sub_embedding_group', 'separator',
                   'scale', 'domain', 'method', 'annotation_grouping', 'scope',
                   'schema_title', 'schema_description', 'source_name',
                   'source_version', 'field_priority', 'column_priority',
                   'facet_grouping', 'facet_priority', 'links_to', 'mvp']
EXPECTED_INSERT = {'no': '1', 'field_name': 'chrom', 'vcf_name_v0.2': 'CHROM',
                   'source_name_v0.2': 'VCF', 'source_version_v0.2': 'VCFv4.2',
                   'field_type': 'string', 'value_example': '1', 'enum_list': [],
                   'is_list': False, 'scope': 'variant', 'schema_title': 'Chromosome',
                   'source_name': 'VCF', 'source_version': 'VCFv4.2',
                   'field_priority': 1, 'column_priority': 1, 'facet_grouping':
                   'Chromosome', 'mvp': True, 'project': '12a92962-8265-4fc0-b2f8-cf14f05db58b',
                   'institution': 'hms-dbmi', 'submitted_by': 'koray_kirli@hms.harvard.edu'}
MVP_EXPECTED = 619
SAMPLE_FIELDS_EXPECTED = 12
VARIANT_FIELDS_EXPECTED = 607

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
    assert VERSION == 'annV0.2'
    assert DATE == '11.08.19'
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
    assert sample_props['QUAL']['title'] == 'Quality score'
    assert sample_props['QUAL']['vcf_name'] == 'QUAL'
    assert sample_props['QUAL']['type'] == 'number'
    assert sample_props['PID']['title'] == 'Physical phasing ID information'
    assert sample_props['PID']['vcf_name'] == 'PID'
    assert sample_props['PID']['type'] == 'string'
    assert sample_props['AF']['title'] == 'Sample allele fraction'
    assert sample_props['AF']['source_name'] == 'VCF'
    assert sample_props['AF']['source_version'] == 'VCFv4.2'
    assert sample_props['gnomad_an_afr']['vcf_name'] == 'gnomad_an_afr'
    assert sample_props['gnomad_an_afr']['source_version'] == '2.1.1'


def test_generate_variant_json_items(inserts):
    """ Tests that variant JSON along with columns and facets are produced """
    var_props, cols, facs = generate_properties(inserts)
    assert cols['chrom']['title'] == 'Chromosome'
    assert cols['pos']['title'] == 'Position'
    assert cols['id']['title'] == 'ID'
    assert cols['ref']['title'] == 'Reference allele'
    assert cols['alt']['title'] == 'Alternative allele'
    assert facs['clinsig']['title'] == 'ClinVar significance'
    assert var_props['annovar_cytoband']['title'] == 'Cytoband'
    assert var_props['annovar_cytoband']['type'] == 'string'
    assert var_props['annovar_cytoband']['scale'] == 'WINDOW'
    assert var_props['annovar_cytoband']['domain'] == 'FUNCTION'
    assert var_props['annovar_cytoband']['source_name'] == 'ANNOVAR'
    assert var_props['exac_af']['title'] == 'ExAC Allele frequency in All subjects'
    assert var_props['exac_af']['vcf_name'] == 'exac_af'
    assert var_props['exac_af']['type'] == 'number'
    assert var_props['exac_af']['scale'] == 'VARIANT'
    assert var_props['exac_af']['domain'] == 'POPULATION GENETICS'
    assert var_props['exac_af']['source_name'] == 'ExAC'
    assert var_props['exac_af']['source_version'] == '3'
    assert var_props['transcript']['title'] == 'Transcript'
    assert var_props['transcript']['type'] == 'array'
    sub_obj_props = var_props['transcript']['items']['properties']
    assert len(sub_obj_props.keys()) == 50 # should see 50 of these
    assert sub_obj_props['vep_allele']['vcf_name'] == 'vep_allele'
    assert sub_obj_props['vep_allele']['type'] == 'string'
    assert sub_obj_props['vep_distance']['type'] == 'integer'


def test_generate_variant_sample_schema(sample_variant_items):
    """ Tests some aspects of the variant_sample schema """
    items, _, _ = sample_variant_items
    schema = generate_variant_sample_schema(items)
    properties = schema['properties']
    assert 'transcript' not in properties
    assert 'CHROM' in properties
    assert 'ALT' in properties
    assert 'intervar_pm3' in properties
    assert 'nestedrepeats_name' in properties
    assert properties['microsat_name']['type'] == 'string'
    assert properties['AD']['items']['vcf_name'] == 'AD'
    assert properties['AD']['type'] == 'array'
    assert properties['AD']['items']['type'] == 'integer'
    assert properties['PS']['vcf_name'] == 'PS'
    assert 'description' in properties['PS']
    assert 'columns' in schema
    assert 'facets' in schema


def test_generate_variant_schema(variant_items):
    items, cols, facs = variant_items
    schema = generate_variant_schema(items, cols, facs)
    properties = schema['properties']
    assert properties['CHROM']['vcf_name'] == 'CHROM'
    assert properties['CHROM']['source_name'] == 'VCF'
    assert properties['CHROM']['type'] == 'string'
    assert 'enum' in properties['CHROM']
    assert properties['ALT']['vcf_name'] == 'ALT'
    assert properties['ALT']['type'] == 'array'
    assert properties['ALT']['items']['vcf_name'] == 'ALT'
    assert properties['ALT']['items']['type'] == 'string'
    assert properties['ALT']['items']['separator'] == 'comma'
    assert properties['ALT']['items']['lookup'] == 5
    assert properties['ALT']['lookup'] == 5
    assert len(properties['transcript']['items']['properties']) == 50
    assert properties['ALT']['items']['separator'] == 'comma'
    assert properties['transcript']['items']['properties']['vep_domains']['type'] == 'array'
    assert properties['transcript']['items']['properties']['vep_domains']['items']['separator'] == 'comma'
    assert properties['transcript']['items']['properties']['vep_domains']['items']['type'] == 'string'
