import io
import json
import mock
import pytest

from dcicutils.diff_utils import DiffManager
from dcicutils.misc_utils import file_contents
from ..util import resolve_file_path
from ..ingestion.table_utils import (
    VariantTableParser, MappingTableHeader, StructuralVariantTableParser
)
from .variant_fixtures import ANNOTATION_FIELD_URL


# XXX: These constants should probably be handled in a more intelligent way -will
pytestmark = [pytest.mark.working, pytest.mark.ingestion]
MT_LOC = resolve_file_path('annotations/v0.5.4_variant_table.csv')
ANNOTATION_FIELD_SCHEMA = resolve_file_path('schemas/annotation_field.json')
EXPECTED_FIELDS = ['no', 'field_name', 'vcf_field', 'source_name', 'source_version', 'sub_embedding_group',
                   'field_type', 'is_list', 'priority', 'source',
                   'description', 'value_example', 'enum_list', 'do_import',
                   'scope', 'schema_title', 'links_to', 'embedded_field',
                   'calculated_property', 'pattern', 'default', 'min', 'max', 'link', 'comments',
                   'annotation_space_location', 'abbreviation', 'add_no_value']
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
VARIANT_TABLE_VERSION = 'annV0.5.4'
VARIANT_TABLE_DATE = '06.23.2021'
NUMBER_ANNOTATION_FIELDS = 236
SAMPLE_FIELDS_EXPECTED = 26
VARIANT_FIELDS_EXPECTED = 210
TRANSCRIPT_FIELDS_EXPECTED = 30


@pytest.fixture
def MTParser():
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
    assert var_props['csq_cadd_phred']['source_name'] == 'CADD'
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
    assert 'comhet_gene' in properties['cmphet']['items']['properties']

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
    assert properties['csq_gnomadg_af_popmax']['min'] == 0
    assert properties['csq_gnomadg_af_popmax']['max'] == 1
    assert properties['csq_gnomade2_an']['items']['min'] == 0
    assert properties['csq_gnomade2_ac']['items']['add_no_value'] is True
    assert properties['csq_gnomadg_af-xy']['add_no_value'] is True
    assert properties['csq_gnomadg_nhomalt-amr']['add_no_value'] is True
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
    with io.open(MTParser.EMBEDDED_VARIANT_FIELDS, 'r') as fd:
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


_VARIANT_SCHEMA_FILENAME = resolve_file_path('schemas/variant.json')
_VARIANT_SAMPLE_SCHEMA_FILENAME = resolve_file_path('schemas/variant_sample.json')


def test_post_inserts_via_run(MTParser, project, institution, testapp):
    """ Tests that we can run the above test using the 'run' method """

    variant_schema = json.loads(file_contents(_VARIANT_SCHEMA_FILENAME))
    variant_sample_schema = json.loads(file_contents(_VARIANT_SAMPLE_SCHEMA_FILENAME))

    inserts = MTParser.run(institution='encode-institution', project='encode-project',
                           vs_out=_VARIANT_SAMPLE_SCHEMA_FILENAME,
                           v_out=_VARIANT_SCHEMA_FILENAME,
                           # enable to generate schemas
                           write=False)
    for item in inserts:
        # NOTE: The ACTUAL test going on here is to assure these get 201 responses.
        #       Everything else in this test before the 'inserts =' above or after
        #       this 'for' loop is instrumentation for the purpose of tracking C4-636.
        #       -kmp 21-Mar-2021
        testapp.post_json(ANNOTATION_FIELD_URL, item, status=201)

    variant_schema_afterward = json.loads(file_contents(_VARIANT_SCHEMA_FILENAME))
    variant_sample_schema_afterward = json.loads(file_contents(_VARIANT_SAMPLE_SCHEMA_FILENAME))

    dm = DiffManager(label="<schema>")

    variant_schema_delta = dm.comparison(variant_schema, variant_schema_afterward)
    variant_sample_schema_delta = dm.comparison(variant_sample_schema, variant_sample_schema_afterward)

    assert not variant_schema_delta
    assert not variant_sample_schema_delta

@pytest.fixture
def sv_schema():
    schema = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "type": "object",
        "identifyingProperties": ["uuid", "aliases", "annotation_id"],
        "additionalProperties": False,
        "title": "Structural Variant",
        "description": "Schema for structural variants",
        "id": "/profiles/structural_variant.json",
        "properties": {
            "vcf_field_to_drop": {"type": "string", "vcf_field": "something"},
            "non_vcf_field_to_keep": {"type": "number", "min": 1},
            "vcf_field_with_non_vcf_subembed": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "some_vcf_field": {
                            "type": "string",
                            "vcf_field": "something else",
                        },
                        "another_non_vcf_field": {"type": "integer", "max": 20},
                    },
                },
            },
            "non_vcf_field_with_non_vcf_subembed": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "non_vcf_field": {"type": "array", "items": {"type": "string"}}
                    },
                },
            },
        },
        "columns": {"first_columns": {"order": 0}},
        "facets": {"non_vcf_field_to_keep": {"order": 0}},
    }
    return schema


@pytest.fixture
def props_from_inserts():
    props = {
        "mapping_table_field_1": {"type": "string", "vcf_field": "new_vcf_field_1"},
        "vcf_field_with_non_vcf_subembed": {
            "type": "array",
            "items": {"properties": {"mapping_table_field_2": {"type": "number"}}},
        },
    }
    return props


class TestSVTableParser:
    """
    Mock builtins.open method for all these tests to prevent over-writing
    structural_variant_embeds.json schema with test mocking table results.
    """

    @mock.patch("builtins.open", new_callable=mock.mock_open())
    @mock.patch(
        "encoded.ingestion.table_utils.StructuralVariantTableParser.old_sv_schema",
        new_callable=mock.PropertyMock,
    )
    def test_get_vcf_props(self, mock_sv_schema, mock_open_file, sv_schema):
        """
        Test existing schema "properties" fields are correctly parsed
        according to whether they are or contain fields coming from a previous
        mapping table ingestion.
        """
        mock_sv_schema.return_value = sv_schema
        parser = StructuralVariantTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
        assert "non_vcf_field_to_keep" in parser.sv_non_vcf_props
        assert "non_vcf_field_with_non_vcf_subembed" in parser.sv_non_vcf_props
        assert parser.sv_non_vcf_props["vcf_field_with_non_vcf_subembed"] == [
            "another_non_vcf_field"
        ]

    @mock.patch("builtins.open", new_callable=mock.mock_open)
    def test_provision_and_update_embeds(self, mock_open_file):
        """
        Test structural_variant_embeds.json correctly updated with embeds
        from mapping table.
        """
        parser = StructuralVariantTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
        mock_open_file().write.assert_any_call('"structural_variant"')
        mock_open_file().write.assert_any_call('"structural_variant_sample"')

        # Mock json.load so embed writes go to mock_open_file
        with mock.patch("json.load", new_callable=mock.MagicMock) as mock_json_load:
            mock_json_load.return_value = {"structural_variant": {}}
            inserts = parser.process_annotation_field_inserts()
            sv_props, _, _ = parser.generate_properties(
                parser.filter_fields_by_variant(inserts)
            )
        # Depending on mapping table (MT_LOC), what's written may vary, so check only
        # for writing of new line (\n) which should occur if anything written. If
        # failing after change to MT_LOC, can provide fixture for mapping table.
        # drr 07-26-2021
        mock_open_file().write.assert_any_call("\n")

    @mock.patch("builtins.open", new_callable=mock.mock_open)
    @mock.patch(
        "encoded.ingestion.table_utils.StructuralVariantTableParser.old_sv_schema",
        new_callable=mock.PropertyMock,
    )
    def test_generate_schema(
            self, mock_sv_schema, mock_open_file, sv_schema, props_from_inserts
    ):
        """
        Test new schema generation from existing schema. Only schema
        "properties" should be updated with new fields from mapping table,
        and existing fields that did not come from a mapping table ingestion
        should also be present in the new schema "properties".
        """
        mock_sv_schema.return_value = sv_schema
        parser = StructuralVariantTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
        new_sv_schema = parser.generate_schema(
            props_from_inserts, parser.old_sv_schema, parser.sv_non_vcf_props
        )
        new_schema_props = new_sv_schema["properties"]
        old_schema_props = sv_schema["properties"]
        for key, value in sv_schema.items():
            if key == "properties":
                assert new_sv_schema[key] != value
                continue
            assert new_sv_schema[key] == value
        for key, value in parser.sv_non_vcf_props.items():
            if not value:
                assert new_schema_props[key] == old_schema_props[key]
            else:
                # Indicates sub-embed of non-vcf field inside field with vcf field
                # sub-embed, so should still be present.
                sub_embeds = new_schema_props[key]["items"]["properties"]
                for sub_embed_item in value:
                    assert sub_embed_item in sub_embeds
