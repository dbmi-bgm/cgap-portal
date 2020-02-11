import os
import csv
import json
import pytest
from encoded.commands.mapping_table_intake import (
    MappingTableParser
)

pytestmark = [pytest.mark.working]
MT_LOC = './src/encoded/tests/data/sample_vcfs/mtv03.csv' # symlinked from encoded.commands
ANNOTATION_FIELD_SCHEMA = './src/encoded/schemas/annotation_field.json'
EXPECTED_FIELDS = ['no', 'vcf_name', 'source_name', 'source_version', 'sub_embedding_group',
                   'field_type', 'is_list', 'separator', 'max_size', 'schema_description', 'value_example',
                   'enum_list', 'field_priority', 'column_priority', 'facet_grouping', 'facet_priority',
                   'scale', 'domain', 'method', 'annotation_grouping', 'scope', 'schema_title', 'pre_addon', 'links_to',
                   'embedded_fields', 'calculated_property']
EXPECTED_INSERT = {'no': 1, 'vcf_name': 'CHROM', 'source_name': 'VCF', 'source_version': 'VCFv4.2',
                   'field_type': 'string', 'is_list': False, 'max_size': 2, 'schema_description': 'Chromosome',
                   'value_example': '1;2;3;4;5;6;22;X;Y;M', 'column_priority': 1,
                   'enum_list':
                       ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16',
                        '17', '18', '19', '20', '21', '22', 'X', 'Y', 'M'],
                   'scope': 'variant'}
NUMBER_ANNOTATION_FIELDS = 266
SAMPLE_FIELDS_EXPECTED = 17
VARIANT_FIELDS_EXPECTED = 249
TRANSCRIPT_FIELDS_EXPECTED = 47


@pytest.fixture
def MTParser():
    parser = MappingTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
    return parser


@pytest.fixture
def inserts(MTParser):
    return MTParser.process_mp_inserts()


@pytest.fixture
def sample_variant_items(MTParser, inserts):
    inserts = MTParser.filter_fields_by_sample(inserts)
    return MTParser.generate_properties(inserts, variant=False)


@pytest.fixture
def variant_items(MTParser, inserts):
    inserts = MTParser.filter_fields_by_variant(inserts)
    return MTParser.generate_properties(inserts)


def test_add_default_schema_fields(MTParser):
    """ Tests that default fields are added """
    schema = {}
    MTParser.add_default_schema_fields(schema)
    assert '$schema' in schema
    assert 'type' in schema
    assert 'required' in schema
    assert 'identifyingProperties' in schema
    assert 'additionalProperties' in schema
    assert 'mixinProperties' in schema


def test_read_mapping_table(MTParser):
    """ Tests that we can read mapping table header correctly based on the current format """
    assert MTParser.version == 'annV0.3'
    assert MTParser.date == '01.29.2020'
    assert sorted(MTParser.fields) == sorted(EXPECTED_FIELDS)


def test_process_mp_inserts(MTParser, inserts):
    """
        Tests that we properly process annotation field inserts
        There should be 270 total. A hand crafted example is checked
    """
    assert inserts[0] == EXPECTED_INSERT
    assert len(inserts) == NUMBER_ANNOTATION_FIELDS
    sample_fields = MTParser.filter_fields_by_sample(inserts)
    assert len(sample_fields) == SAMPLE_FIELDS_EXPECTED
    variant_fields = MTParser.filter_fields_by_variant(inserts)
    assert len(variant_fields) == VARIANT_FIELDS_EXPECTED


def test_generate_sample_json_items(MTParser, inserts):
    """ Tests that sample JSON is being created correctly checking three we expect """
    sample_fields = MTParser.filter_fields_by_sample(inserts)
    sample_props, cols, facs = MTParser.generate_properties(sample_fields, variant=False)
    assert sample_props['DP']['type'] == 'integer'
    assert sample_props['DP']['vcf_name'] == 'DP'
    assert sample_props['PGT']['type'] == 'string'
    assert sample_props['PGT']['source_name'] == 'VCF'
    assert sample_props['RSTR']['type'] == 'string'
    assert sample_props['RSTR']['source_name'] == 'novoCaller'

    # check cols/facs
    assert 'AF' in cols
    assert 'DP' in cols
    assert 'AF' not in facs
    assert 'DP' not in facs


def test_generate_variant_json_items(MTParser, inserts):
    """ Tests that variant JSON along with columns and facets are produced """
    var_props, cols, facs = MTParser.generate_properties(inserts)

    # check top level fields
    assert var_props['CHROM']['title'] == 'CHROM'
    assert var_props['CHROM']['type'] == 'string'
    assert var_props['CHROM']['max_size'] == 2
    assert var_props['POS']['type'] == 'integer'
    assert var_props['cadd_phred']['source_name'] == 'CADD'
    assert var_props['cadd_phred']['type'] == 'number'

    # check sub-embedded object
    sub_obj_props = var_props['transcript']['items']['properties']
    assert len(sub_obj_props.keys()) == TRANSCRIPT_FIELDS_EXPECTED
    assert sub_obj_props['vep_impact']['vcf_name'] == 'vep_impact'
    assert sub_obj_props['vep_impact']['type'] == 'string'
    assert sub_obj_props['vep_distance']['type'] == 'string'

    # check sub-embedded object array
    assert sub_obj_props['vep_consequence']['type'] == 'array'
    assert sub_obj_props['vep_consequence']['items']['type'] == 'string'
    assert sub_obj_props['vep_consequence']['items']['separator'] == 'tilde'

    # check cols/facs
    assert 'ALT' in cols
    assert 'CHROM' in cols
    assert 'cadd_phred' in cols
    assert 'AF' not in cols
    assert cols['transcript.vep_consequence.display_title']['title'] == 'vep_consequence'  # linkTo has display title
    assert facs['transcript.vep_consequence.display_title']['title'] == 'vep_consequence'
    assert facs['transcript.vep_symbol']['title'] == 'vep_symbol'
    assert facs['cadd_phred']['aggregation_type'] == 'stats'
    assert 'transcript.vep_symbol' in facs


def test_generate_variant_sample_schema(MTParser, sample_variant_items):
    """ Tests some aspects of the variant_sample schema """
    items, cols, facs = sample_variant_items
    schema = MTParser.generate_variant_sample_schema(items, cols, facs, {}, {})
    properties = schema['properties']
    assert 'CHROM' not in properties
    assert 'vep_consequence' not in properties
    assert 'GT' in properties
    assert 'GQ' in properties
    assert properties['AF']['type'] == 'number'
    assert properties['RSTR']['type'] == 'string'
    assert 'columns' in schema
    assert 'AF' in schema['columns']
    assert 'AF' not in schema['facets']
    assert 'facets' in schema
    assert 'variant' in properties
    assert 'sample' in properties


def test_generate_variant_schema(MTParser, variant_items):
    """ Tests some aspects of the variant schema """
    items, cols, facs = variant_items
    schema = MTParser.generate_variant_schema(items, cols, facs)

    # check top level schema fields of various types
    properties = schema['properties']
    assert properties['CHROM']['vcf_name'] == 'CHROM'
    assert properties['CHROM']['source_name'] == 'VCF'
    assert properties['CHROM']['type'] == 'string'
    assert 'enum' in properties['CHROM']
    assert properties['ALT']['vcf_name'] == 'ALT'
    assert properties['ALT']['type'] == 'string'

    # check sub-embedded object fields
    assert properties['transcript']['type'] == 'array'
    sub_obj_props = properties['transcript']['items']['properties']
    assert len(sub_obj_props) == TRANSCRIPT_FIELDS_EXPECTED
    assert sub_obj_props['vep_consequence']['type'] == 'array'
    assert sub_obj_props['vep_consequence']['items']['facet_priority'] == 2
    assert sub_obj_props['vep_consequence']['items']['type'] == 'string'
    assert sub_obj_props['vep_consequence']['items']['linkTo'] == 'VariantConsequence'
    assert sub_obj_props['vep_consequence']['items']['embedded_fields'] == 'definition'  # XXX: allow multiple
    assert sub_obj_props['vep_domains']['type'] == 'array'
    assert sub_obj_props['vep_domains']['items']['separator'] == 'tilde'
    assert sub_obj_props['vep_domains']['items']['type'] == 'string'
    assert sub_obj_props['vep_clin_sig']['type'] == 'string'
    assert sub_obj_props['vep_somatic']['type'] == 'array'
    assert sub_obj_props['vep_somatic']['items']['type'] == 'boolean'
    assert sub_obj_props['vep_somatic']['items']['separator'] == 'tilde'

    # check cols/facs
    assert 'ALT' in schema['columns']
    assert 'AF' not in schema['columns']
    assert 'transcript.vep_consequence.display_title' in schema['facets']
    assert 'transcript.vep_symbol' in schema['facets']


def test_post_inserts(inserts, project, institution, testapp):
    """
    Tests that we can post the processed inserts to a test app with
    no errors.
    Use variant_items fixture to use already generated inserts based
    on the current mapping table
    Post them to the testapp
    """
    CONNECTION_URL = '/annotation_field'
    for item in inserts:
        item['project'] = 'encode-project'
        item['institution'] = 'encode-institution'
        testapp.post_json(CONNECTION_URL, item, status=201)


def test_post_inserts_via_run(MTParser, project, institution, testapp):
    """ Tests that we can run the above test using the 'run' method """
    inserts = MTParser.run(institution='encode-institution', project='encode-project', write=False)
    CONNECTION_URL = '/annotation_field'
    for item in inserts:
        testapp.post_json(CONNECTION_URL, item, status=201)
