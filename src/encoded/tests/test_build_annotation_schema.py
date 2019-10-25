import os
import csv
import json
import pytest
from encoded.commands.build_annotation_schema import (
    read_mapping_table,
    add_annotation_schema_fields,
    add_annotation_schema_facets_and_columns,
    build_annotation_field_schema
)

pytestmark = [pytest.mark.working]
FNAME = './sample_mp_header.csv' # symlinked from encoded.commands

EXPECTED_FIELDS = 'FIELD NAME,VCF NAME(field name on ann vcf),value_example, \
                "field_type (string, integer, boolean, number)", \
                enum_list (limit values to this list),SCALE,DOMAIN,METHOD, \
                Annotation_grouping,is_list,sub_embedding_group (SUBEMBEDDED \
                OBJECT GROUPING),"SEPARATOR (comma, pipe, semicolon, colon, \
                tab) ",SCOPE (sample/variant/gene),schema_title (HUMAN READABLE \
                HEADER),schema_description (DESCRIPTION),SOURCE_NAME,SOURCE VERSION, \
                FIELD_PRIORITY (lookup number),COLUMN_PRIORITY,FACET_PRIORITY,links_to, \
                MVP (Y/N),#excel_order'



@pytest.yield_fixture
def sample_mp_header():
    with open(FNAME, 'w+') as out:
        writer = csv.writer(out, delimiter=',')
        writer.writerow('#FILEFORMAT= annV1,,,,,,,,,,,,,,,,,,,,,,'.split(','))
        writer.writerow('#FILEDATE=09.13.19,,,,,,,,,,,,,,,,,,,,,,'.split(','))
        writer.writerow(EXPECTED_FIELDS.split(','))

    yield # run test

    os.remove(FNAME) # remove file when we're done


def test_read_mapping_table(sample_mp_header):
    """ Tests that we can read mapping table header correctly based on the current format """
    VERSION, DATE, FIELDS = read_mapping_table(FNAME)
    assert VERSION == 'annV1'
    assert DATE == '09.13.19'
    assert sorted(FIELDS) == sorted(EXPECTED_FIELDS.split(','))


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


def test_build_full_schema(sample_mp_header):
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
