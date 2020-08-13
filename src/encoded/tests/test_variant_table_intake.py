import json
import pytest

from ..util import resolve_file_path
from ..commands.variant_table_intake import MappingTableParser
from .variant_fixtures import ANNOTATION_FIELD_URL


# XXX: These constants should probably be handled in a more intelligent way -will
pytestmark = [pytest.mark.working, pytest.mark.ingestion]
MT_LOC = resolve_file_path('annotations/variant_table_v0.4.8.csv')
ANNOTATION_FIELD_SCHEMA = resolve_file_path('schemas/annotation_field.json')
EXPECTED_FIELDS = ['no', 'field_name', 'source_name', 'source_version', 'sub_embedding_group',
                   'field_type', 'is_list',
                   'description', 'value_example', 'enum_list', 'do_import',
                   'facet_order', 'column_order', 'annotation_category',
                   'scope', 'schema_title', 'links_to', 'embedded_field',
                   'calculated_property', 'pattern', 'default', 'min', 'max', 'link', 'comments',
                   'annotation_space_location']
EXPECTED_INSERT = {'field_name': 'CHROM', 'schema_title': 'Chromosome',
                   'do_import': True, 'scope': 'variant', 'source_name': 'VCF',
                   'source_version': 'VCFv4.2', 'description': 'Chromosome',
                   'field_type': 'string', 'is_list': False, 'annotation_category': 'Position',
                   'facet_order': 1,
                   'enum_list': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
                                 '11', '12', '13', '14', '15', '16', '17', '18', '19',
                                 '20', '21', '22', 'X', 'Y', 'M']}
VEP_CONSEQUENCE_EMBEDS = ['transcript.vep_consequence.var_conseq_id', 'transcript.vep_consequence.definition',
                          'transcript.vep_consequence.impact', 'transcript.vep_consequence.location',
                          'transcript.vep_consequence.coding_effect', 'transcript.vep_gene.display_title',
                          'transcript.vep_gene.gene_symbol', 'transcript.vep_gene.ensgid']
NUMBER_ANNOTATION_FIELDS = 354
SAMPLE_FIELDS_EXPECTED = 27
VARIANT_FIELDS_EXPECTED = 327
TRANSCRIPT_FIELDS_EXPECTED = 35


@pytest.fixture
def MTParser():
    parser = MappingTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
    return parser


@pytest.fixture
def inserts(MTParser):
    return MTParser.process_annotation_field_inserts()


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


def test_read_variant_table_header(MTParser):
    """ Tests that we can read mapping table header correctly based on the current format """
    assert MTParser.version == 'annV0.4.8'
    assert MTParser.date == '08.13.2020'
    assert sorted(MTParser.fields) == sorted(EXPECTED_FIELDS)
    for field in EXPECTED_FIELDS:  # all fields are categorized by the Parser
        assert field in MTParser.ALL_FIELDS


def test_process_variant_table_inserts(MTParser, inserts):
    """
        Tests that we properly process annotation field inserts
        There should be 306 total. A hand crafted example is checked
    """
    chrom_insert = None
    for insert in inserts:
        if insert['field_name'] == 'CHROM':
            chrom_insert = insert
    assert chrom_insert == EXPECTED_INSERT
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
    assert sample_props['DP']['field_name'] == 'DP'
    assert sample_props['PGT']['type'] == 'string'
    assert sample_props['PGT']['source_name'] == 'VCF'
    assert sample_props['novoPP']['type'] == 'number'
    assert 'samplegeno' in sample_props
    assert 'cmphet' in sample_props

    # check cols/facs (there are none now)
    assert 'AF' in cols
    assert 'DP' in cols
    assert 'GQ' in facs
    assert 'novoPP' in facs


def test_generate_variant_json_items(MTParser, inserts):
    """ Tests that variant JSON along with columns and facets are produced """
    var_props, cols, facs = MTParser.generate_properties(inserts)

    # check top level fields
    assert var_props['CHROM']['title'] == 'Chromosome'
    assert var_props['CHROM']['type'] == 'string'
    assert var_props['POS']['type'] == 'integer'
    assert var_props['cadd_phred']['source_name'] == 'CADD'
    assert var_props['cadd_phred']['type'] == 'number'

    # check vep (transcript) sub-embedded object
    sub_obj_props = var_props['transcript']['items']['properties']
    assert len(sub_obj_props.keys()) == TRANSCRIPT_FIELDS_EXPECTED
    assert sub_obj_props['vep_gene']['field_name'] == 'vep_gene'
    assert sub_obj_props['vep_gene']['type'] == 'string'
    assert sub_obj_props['vep_distance']['type'] == 'string'
    assert sub_obj_props['vep_canonical']['type'] == 'boolean'

    # check sub-embedded object array
    assert sub_obj_props['vep_consequence']['type'] == 'array'
    assert sub_obj_props['vep_consequence']['items']['type'] == 'string'

    # check cols/facs
    assert 'max_pop_af_af_popmax' in cols
    assert 'gnomad_af' in facs
    assert facs['CHROM']['title'] == 'Chromosome'
    assert facs['CHROM']['grouping'] == 'Position'
    assert cols['genes.genes_ensg.display_title']['order'] == 40


def test_generate_variant_sample_schema(MTParser, sample_variant_items):
    """ Tests some aspects of the variant_sample schema """
    items, cols, facs = sample_variant_items
    schema = MTParser.generate_variant_sample_schema(items, cols, facs, {}, {})
    properties = schema['properties']
    assert 'CHROM' not in properties
    assert 'vep_consequence' not in properties

    # check samplegeno sub-embedded obj
    assert 'samplegeno' in properties
    assert 'samplegeno_ad' in properties['samplegeno']['items']['properties']
    assert 'samplegeno_gt' in properties['samplegeno']['items']['properties']
    assert 'samplegeno_numgt' in properties['samplegeno']['items']['properties']

    # check comhet sub-embedded obj
    assert 'cmphet' in properties
    assert 'comhet_gene'in properties['cmphet']['items']['properties']

    assert 'GT' in properties
    assert 'GQ' in properties
    assert properties['AF']['type'] == 'number'
    assert 'columns' in schema
    assert 'AF' in schema['facets']
    assert 'facets' in schema
    assert 'variant' in properties
    assert 'file' in properties
    assert 'variant.display_title' in cols
    assert facs['DP']['order'] == 8
    assert facs['AF']['order'] == 9
    assert cols['DP']['order'] == 20
    assert cols['AF']['order'] == 21
    assert cols['GT']['order'] == 30
    assert facs['cmphet.comhet_impact_gene']['order'] == 17


def test_generate_variant_schema(MTParser, variant_items):
    """ Tests some aspects of the variant schema """
    items, cols, facs = variant_items
    schema = MTParser.generate_variant_schema(items, cols, facs)

    # check top level schema fields of various types
    properties = schema['properties']
    assert properties['CHROM']['field_name'] == 'CHROM'
    assert properties['CHROM']['source_name'] == 'VCF'
    assert properties['CHROM']['type'] == 'string'
    assert 'enum' in properties['CHROM']
    assert properties['ALT']['field_name'] == 'ALT'
    assert properties['ALT']['type'] == 'string'
    assert properties['max_pop_af_af_popmax']['default'] == 0
    assert properties['max_pop_af_af_popmax']['min'] == 0
    assert properties['max_pop_af_af_popmax']['max'] == 1

    # check sub-embedded object fields
    assert properties['transcript']['type'] == 'array'
    assert properties['transcript']['title'] == 'Transcript'
    sub_obj_props = properties['transcript']['items']['properties']
    assert len(sub_obj_props) == TRANSCRIPT_FIELDS_EXPECTED
    assert sub_obj_props['vep_consequence']['type'] == 'array'
    assert sub_obj_props['vep_consequence']['items']['type'] == 'string'
    assert sub_obj_props['vep_consequence']['items']['linkTo'] == 'VariantConsequence'
    assert sub_obj_props['vep_domains']['type'] == 'array'
    assert sub_obj_props['vep_domains']['items']['type'] == 'string'
    assert sub_obj_props['vep_tsl']['type'] == 'integer'
    assert sub_obj_props['vep_domains']['type'] == 'array'
    assert sub_obj_props['vep_domains']['items']['type'] == 'string'

    # check (existence of) different sub-embedded object fields
    assert properties['genes']['type'] == 'array'
    assert properties['hg19']['type'] == 'array'
    assert properties['clinvar_submission']['type'] == 'array'

    # check cols/facs
    assert 'AF' not in schema['columns']
    assert 'CHROM' in schema['facets']
    assert 'POS' in schema['facets']
    assert 'order' in schema['facets']['POS']
    assert cols['genes.genes_ensg.display_title']['order'] == 40
    assert cols['clinvar_variationid']['order'] == 70

    # check embedded fields are there
    with open(MTParser.EMBEDDED_VARIANT_FIELDS, 'r') as fd:
        embeds_to_check = json.load(fd)
        for embed in embeds_to_check['variant']['embedded_field']:
            if 'vep' in embed:
                assert embed.strip() in VEP_CONSEQUENCE_EMBEDS


def test_post_variant_annotation_field_inserts(inserts, project, institution, testapp):
    """
    Tests that we can post the processed inserts to a test app with
    no errors.
    Use variant_items fixture to use already generated inserts based
    on the current mapping table
    Post them to the testapp
    """
    for item in inserts:
        item['project'] = 'encode-project'
        item['institution'] = 'encode-institution'
        testapp.post_json(ANNOTATION_FIELD_URL, item, status=201)


def test_post_inserts_via_run(MTParser, project, institution, testapp):
    """ Tests that we can run the above test using the 'run' method """
    inserts = MTParser.run(institution='encode-institution', project='encode-project',
                           vs_out=resolve_file_path('schemas/variant_sample.json'),
                           v_out=resolve_file_path('schemas/variant.json'), write=True)  # enable to generate schemas
    for item in inserts:
        testapp.post_json(ANNOTATION_FIELD_URL, item, status=201)
