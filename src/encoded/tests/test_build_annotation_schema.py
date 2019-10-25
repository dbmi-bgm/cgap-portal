import os
import csv
import json
import pytest
from encoded.commands.build_annotation_schema import (
    process_fields,
    read_mapping_table,
    add_annotation_schema_fields,
    add_annotation_schema_facets_and_columns,
    build_annotation_field_schema
)

pytestmark = [pytest.mark.working]
FNAME = './src/encoded/tests/mp.csv' # symlinked from encoded.commands
EXPECTED_FIELDS = ['field_name', 'vcf_name', 'value_example', 'field_type',
                    'enum_list', 'scale', 'domain', 'method', 'annotation_grouping',
                    'is_list', 'sub_embedding_group', 'separator', 'scope',
                    'schema_title', 'schema_description', 'source_name',
                    'source_version', 'field_priority', 'column_priority',
                    'facet_priority', 'links_to', 'mvp']


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


def test_build_full_schema():
    """
    Tests that some fields look correct when we build the whole annotation
    field schema. Tests random things about properties that should be there
    """
    _, _, FIELDS = read_mapping_table(FNAME)
    schema = json.loads(build_annotation_field_schema(FIELDS))
    assert schema['properties']['field_name']['type'] == 'string'
    assert schema['properties']['is_list']['type'] == 'boolean'
    assert schema['properties']['scale']['title'] == 'Scale'
    assert schema['properties']['domain']['description'] == 'Domain defined by new annotation structure'
    assert sorted(schema['properties']['scope']['enum']) == sorted(['variant', 'sample', 'gene'])
    assert sorted(schema['properties']['links_to']['enum']) == sorted(['Gene', 'Disorder', 'Phenotype'])
    assert schema['properties']['value_example']['type'] == 'string'
