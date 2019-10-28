import os
import csv
import json
import pytest
from encoded.commands.create_annotation_inserts import (
    process_fields,
    read_mapping_table,
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


def test_process_inserts(inserts):
    """ Tests that we properly process an inserts into mvp, sample, variant """
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
