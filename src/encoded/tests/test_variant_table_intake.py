import io
import json
import pytest

from dcicutils.diff_utils import DiffManager
from dcicutils.misc_utils import file_contents
from dcicutils.qa_utils import MockFileSystem, notice_pytest_fixtures
from ..util import resolve_file_path
from ..ingestion.table_utils import VariantTableParser, MappingTableHeader
from .variant_fixtures import ANNOTATION_FIELD_URL


# XXX: These constants should probably be handled in a more intelligent way -will
pytestmark = [pytest.mark.working, pytest.mark.ingestion]
MT_LOC = resolve_file_path('annotations/v0.5.3_variant_table.csv')
ANNOTATION_FIELD_SCHEMA = resolve_file_path('schemas/annotation_field.json')
EXPECTED_FIELDS = ['no', 'field_name', 'vcf_field', 'source_name', 'source_version', 'sub_embedding_group',
                   'field_type', 'is_list', 'priority', 'source',
                   'description', 'value_example', 'enum_list', 'do_import',
                   'scope', 'schema_title', 'links_to', 'embedded_field',
                   'calculated_property', 'pattern', 'default', 'min', 'max', 'link', 'comments',
                   'annotation_space_location', 'abbreviation']
EXPECTED_INSERT = {'field_name': 'CHROM', 'vcf_field': 'CHROM', 'schema_title': 'Chromosome',
                   'do_import': True, 'scope': 'variant', 'source_name': 'VCF',
                   'source_version': 'VCFv4.2', 'description': 'Chromosome',
                   'field_type': 'string', 'is_list': False,
                   'enum_list': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
                                 '11', '12', '13', '14', '15', '16', '17', '18', '19',
                                 '20', '21', '22', 'X', 'Y', 'M']}
VEP_CONSEQUENCE_EMBEDS = ['transcript.vep_consequence.var_conseq_id', 'transcript.vep_consequence.definition',
                          'transcript.vep_consequence.impact', 'transcript.vep_consequence.location',
                          'transcript.vep_consequence.coding_effect', 'transcript.vep_gene.display_title',
                          'transcript.vep_gene.gene_symbol', 'transcript.vep_gene.ensgid',
                          'transcript.vep_consequence.var_conseq_name']
VARIANT_TABLE_VERSION = 'annV0.5.3'
VARIANT_TABLE_DATE = '03.09.2021'
NUMBER_ANNOTATION_FIELDS = 191
SAMPLE_FIELDS_EXPECTED = 26
VARIANT_FIELDS_EXPECTED = 165
TRANSCRIPT_FIELDS_EXPECTED = 30


@pytest.fixture
def MTParser(mocked_file_system):
    notice_pytest_fixtures(mocked_file_system)
    parser = VariantTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
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
    assert MTParser.version == VARIANT_TABLE_VERSION
    assert MTParser.date == VARIANT_TABLE_DATE
    assert sorted(MTParser.fields) == sorted(EXPECTED_FIELDS)
    for field in EXPECTED_FIELDS:  # all fields are categorized by the Parser
        assert field in MappingTableHeader.ALL_FIELDS


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
    assert sample_props['novoPP']['abbreviation'] == 'novoPP'
    assert sample_props['DP']['type'] == 'integer'
    assert sample_props['DP']['field_name'] == 'DP'
    assert sample_props['PGT']['type'] == 'string'
    assert sample_props['PGT']['source_name'] == 'VCF'
    assert sample_props['novoPP']['type'] == 'number'
    assert 'samplegeno' in sample_props
    assert 'cmphet' in sample_props
    assert 'ALT' not in sample_props


def test_generate_variant_json_items(MTParser, inserts):
    """ Tests that variant JSON along with columns and facets are produced """
    var_props, cols, facs = MTParser.generate_properties(inserts)

    # check top level fields
    assert var_props['CHROM']['title'] == 'Chromosome'
    assert var_props['CHROM']['type'] == 'string'
    assert var_props['POS']['type'] == 'integer'
    assert var_props['csq_cadd_phred']['source_name'] == 'dbNSFP'
    assert var_props['csq_cadd_phred']['type'] == 'number'

    # check vep (transcript) sub-embedded object
    sub_obj_props = var_props['transcript']['items']['properties']
    assert len(sub_obj_props.keys()) == TRANSCRIPT_FIELDS_EXPECTED
    assert sub_obj_props['csq_gene']['field_name'] == 'csq_gene'
    assert sub_obj_props['csq_gene']['linkTo'] == 'Gene'
    assert sub_obj_props['csq_gene']['type'] == 'string'
    assert sub_obj_props['csq_distance']['type'] == 'string'
    assert sub_obj_props['csq_canonical']['type'] == 'boolean'

    # check sub-embedded object array
    assert sub_obj_props['csq_consequence']['type'] == 'array'
    assert sub_obj_props['csq_consequence']['items']['type'] == 'string'
    assert sub_obj_props['csq_consequence']['items']['linkTo'] == 'VariantConsequence'


def test_generate_variant_sample_schema(MTParser, sample_variant_items):
    """ Tests some aspects of the variant_sample schema """
    items, cols, facs = sample_variant_items
    schema = MTParser.generate_variant_sample_schema(items, cols, facs, {}, {})
    properties = schema['properties']
    assert 'CHROM' not in properties
    assert 'csq_consequence' not in properties

    # check samplegeno sub-embedded obj
    assert 'samplegeno' in properties
    assert 'samplegeno_ad' in properties['samplegeno']['items']['properties']
    assert 'samplegeno_gt' in properties['samplegeno']['items']['properties']
    assert 'samplegeno_numgt' in properties['samplegeno']['items']['properties']
    assert 'samplegeno_role' in properties['samplegeno']['items']['properties']

    # check comhet sub-embedded obj
    assert 'cmphet' in properties
    assert 'comhet_gene'in properties['cmphet']['items']['properties']

    assert 'GT' in properties
    assert 'GQ' in properties
    assert properties['AF']['type'] == 'number'


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
    assert properties['csq_gnomadg_af_popmax']['default'] == 0
    assert properties['csq_gnomadg_af_popmax']['min'] == 0
    assert properties['csq_gnomadg_af_popmax']['max'] == 1
    assert properties['csq_sift_pred']['type'] == 'string'

    # check sub-embedded object fields
    assert properties['transcript']['type'] == 'array'
    assert properties['transcript']['title'] == 'Transcript'
    sub_obj_props = properties['transcript']['items']['properties']
    assert len(sub_obj_props) == TRANSCRIPT_FIELDS_EXPECTED
    assert sub_obj_props['csq_consequence']['type'] == 'array'
    assert sub_obj_props['csq_consequence']['items']['type'] == 'string'
    assert sub_obj_props['csq_consequence']['items']['linkTo'] == 'VariantConsequence'
    assert sub_obj_props['csq_domains']['type'] == 'array'
    assert sub_obj_props['csq_domains']['items']['type'] == 'string'

    # check (existence of) different sub-embedded object fields
    assert properties['genes']['type'] == 'array'
    assert properties['hg19']['type'] == 'array'
    assert properties['csq_clinvar_clnsigconf']['type'] == 'array'

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


_VARIANT_EMBEDS_FILENAME = resolve_file_path('schemas/variant.json')
_VARIANT_SAMPLE_EMBEDS_FILENAME = resolve_file_path('schemas/variant_sample.json')


def test_post_inserts_via_run(MTParser, project, institution, testapp):
    """ Tests that we can run the above test using the 'run' method """

    variant_schema = json.loads(file_contents(_VARIANT_EMBEDS_FILENAME))
    variant_sample_schema = json.loads(file_contents(_VARIANT_SAMPLE_EMBEDS_FILENAME))

    inserts = MTParser.run(institution='encode-institution', project='encode-project',
                           vs_out=_VARIANT_SAMPLE_EMBEDS_FILENAME,
                           v_out=_VARIANT_EMBEDS_FILENAME,
                           # enable to generate schemas
                           write=True)
    for item in inserts:
        # NOTE: The ACTUAL test going on here is to assure these get 201 responses.
        #       Everything else in this test before the 'inserts =' above or after
        #       this 'for' loop is instrumentation for the purpose of tracking C4-636. 
        #       -kmp 21-Mar-2021
        testapp.post_json(ANNOTATION_FIELD_URL, item, status=201)

    variant_schema2 = json.loads(file_contents(_VARIANT_EMBEDS_FILENAME))
    variant_sample_schema2 = json.loads(file_contents(_VARIANT_SAMPLE_EMBEDS_FILENAME))

    dm = DiffManager(label="<schema>")

    variant_schema_delta = dm.comparison(variant_schema, variant_schema2)
    variant_sample_schema_delta = dm.comparison(variant_sample_schema, variant_sample_schema2)

    assert variant_schema_delta == ['<schema>.properties.schema_version.default : "2" => "1"']

    assert not variant_sample_schema_delta
