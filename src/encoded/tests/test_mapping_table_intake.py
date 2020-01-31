import os
import csv
import json
import pytest
from .features.conftest import workbook
from encoded.commands.mapping_table_intake import (
    MappingTableParser
)

pytestmark = [pytest.mark.working]
MT_LOC = './src/encoded/tests/data/sample_vcfs/mtv03.csv' # symlinked from encoded.commands
ANNOTATION_FIELD_SCHEMA = './src/encoded/schemas/annotation_field.json'
EXPECTED_FIELDS = ['no', 'vcf_name', 'source_name', 'source_version', 'sub_embedding_group',
                   'field_type', 'is_list', 'max_size', 'schema_description', 'value_example']
EXPECTED_INSERT = {
    'no': 18,
    'vcf_name':'vep_consequence',
    'source_name': 'VEP',
    'source_version': 'v98.4',
    'sub_embedding_group': 'transcript',
    'field_type': 'string',
    'is_list': True,
    'max_size': 66,
    'schema_description': 'Consequence type',
    'value_example':'intron_variant;intron_variant~NMD_transcript_variant;intron_variant~non_coding_transcript_variant;regulatory_region_variant;splice_region_variant~intron_variant~non_coding_transcript_variant;splice_acceptor_variant~non_coding_transcript_variant;splice_region_variant~non_coding_transcript_exon_variant;non_coding_transcript_exon_variant;downstream_gene_variant;splice_region_variant~intron_variant;splice_donor_variant;splice_region_variant~5_prime_UTR_variant;5_prime_UTR_variant;splice_acceptor_variant;upstream_gene_variant;TF_binding_site_variant;splice_region_variant~intron_variant~NMD_transcript_variant;splice_donor_variant~NMD_transcript_variant;splice_donor_variant~non_coding_transcript_variant;splice_region_variant~5_prime_UTR_variant~NMD_transcript_variant'
}
NUMBER_ANNOTATION_FIELDS = 262
SAMPLE_FIELDS_EXPECTED = 10
VARIANT_FIELDS_EXPECTED = 252


@pytest.fixture
def MTParser():
    parser = MappingTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
    return parser


@pytest.fixture
def inserts(MTParser):
    return MTParser.process_mp_inserts()


@pytest.fixture
def sample_variant_items(MTParser, inserts):
    return MTParser.generate_properties(inserts, variant=False)


@pytest.fixture
def variant_items(MTParser, inserts):
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
    assert MTParser.date == '01.29.20'
    assert sorted(MTParser.fields) == sorted(EXPECTED_FIELDS)


def test_process_mp_inserts(MTParser, inserts):
    """
        Tests that we properly process annotation field inserts
        There should be 245 total. A hand crafted example is checked
    """
    assert inserts[17] == EXPECTED_INSERT
    assert len(inserts) == NUMBER_ANNOTATION_FIELDS
    sample_fields = MTParser.filter_fields_by_sample(inserts)
    assert len(sample_fields) == SAMPLE_FIELDS_EXPECTED
    variant_fields = MTParser.filter_fields_by_variant(inserts)
    assert len(variant_fields) == VARIANT_FIELDS_EXPECTED


def test_generate_sample_json_items(MTParser, inserts):
    """ Tests that sample JSON is being created correctly checking three we expect """
    sample_fields = MTParser.filter_fields_by_sample(inserts)
    sample_props = MTParser.generate_sample_variant_properties(sample_fields)
    assert sample_props['PL']['type'] == 'array'
    assert sample_props['PL']['items']['type'] == 'integer'
    assert sample_props['PL']['items']['description'] == 'Phred-scaled likelihoods for genotypes'
    assert sample_props['PS']['type'] == 'integer'
    assert sample_props['PS']['is_list'] is False


def test_generate_variant_json_items(MTParser, inserts):
    """ Tests that variant JSON along with columns and facets are produced """
    var_props = MTParser.generate_variant_properties(inserts)

    # check top level fields
    assert var_props['CHROM']['title'] == 'CHROM'
    assert var_props['CHROM']['type'] == 'string'
    assert var_props['CHROM']['max_size'] == 2
    assert var_props['POS']['type'] == 'integer'
    assert var_props['cadd_phred']['source_name'] == 'CADD'
    assert var_props['cadd_phred']['type'] == 'float'

    # check sub-embedded object
    sub_obj_props = var_props['transcript']['items']['properties']
    assert len(sub_obj_props.keys()) == 43 # should see 43 of these
    assert sub_obj_props['vep_allele']['vcf_name'] == 'vep_allele'
    assert sub_obj_props['vep_allele']['type'] == 'string'
    assert sub_obj_props['vep_distance']['type'] == 'integer'


def test_generate_variant_sample_schema(MTParser, sample_variant_items):
    """ Tests some aspects of the variant_sample schema """
    items, _, _ = sample_variant_items
    schema = MTParser.generate_variant_sample_schema(items)
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
    assert properties['ALT']['type'] == 'array'
    assert properties['ALT']['items']['vcf_name'] == 'ALT'
    assert properties['ALT']['items']['type'] == 'string'
    assert properties['ALT']['items']['separator'] == 'comma'
    assert properties['ALT']['items']['lookup'] == 5
    assert properties['ALT']['lookup'] == 5
    assert properties['ALT']['items']['separator'] == 'comma'

    # check sub-embedded object fields
    sub_obj_props = properties['transcript']['items']['properties']
    assert len(sub_obj_props) == 76
    assert sub_obj_props['vep_domains']['type'] == 'array'
    assert sub_obj_props['vep_domains']['items']['separator'] == 'tilde'
    assert sub_obj_props['vep_domains']['items']['type'] == 'string'


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
