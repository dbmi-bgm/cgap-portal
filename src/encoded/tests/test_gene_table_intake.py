import pytest
from encoded.tests.test_variant_table_intake import (
    ANNOTATION_FIELD_SCHEMA,
    EXPECTED_FIELDS
)
from encoded.util import resolve_file_path
from encoded.tests.variant_fixtures import GENE_ANNOTATION_FIELD_URL
from encoded.commands.gene_table_intake import GeneTableParser

pytestmark = [pytest.mark.working, pytest.mark.ingestion]
MT_LOC = resolve_file_path('annotations/gene_table_v0.4.5.csv')
GENE_SCHEMA_TEST_LOC = resolve_file_path('schemas/gene.json')
NUMBER_ANNOTATION_FIELDS = 284
EXPECTED_INSERT = {'no': 1, 'field_name': 'chrom',
                   'schema_title': 'Chromosome', 'do_import': True,
                   'source_name': 'ENSEMBLgene', 'source_version': 'v99',
                   'description': "name of the chromosome or scaffold; chromosome names without a 'chr'",
                   'field_type': 'string', 'is_list': False,
                   'enum_list': ['1', '2', '3', '4', '5', '6','7', '8', '9', '10', '11', '12', '13', '14', '15', '16',
                                 '17', '18', '19', '20', '21', '22', 'X', 'Y', 'M'],
                   'value_example': '1; 2; 3; 4; 5; 6; 7; X; 8; 9'}
CLINGENDIS_FIELDS_EXPECTED = 4
TRANSCRIPT_FIELDS_EXPECTED = 15


@pytest.fixture
def GTParser():
    parser = GeneTableParser(MT_LOC, ANNOTATION_FIELD_SCHEMA)
    return parser

@pytest.fixture
def inserts(GTParser):
    return GTParser.process_annotation_field_inserts()


@pytest.fixture
def gene_schema(GTParser, inserts):
    props, columns, facets = GTParser.generate_properties(inserts)
    return GTParser.generate_gene_schema(props, columns, facets)


def test_read_gene_table_header(GTParser):
    """ Tests that we can read mapping table header correctly based on the current format """
    assert GTParser.version == 'gene_annV0.4.5'
    assert GTParser.date == '2020.05.20'
    assert sorted(GTParser.fields) == sorted(EXPECTED_FIELDS)


def test_process_gene_table_inserts(inserts):
    """
        Tests that we properly process gene annotation field inserts
        There should be 254 total. A hand crafted example is checked
    """
    assert inserts[0] == EXPECTED_INSERT
    assert len(inserts) == NUMBER_ANNOTATION_FIELDS


def test_post_gene_annotation_field_inserts(inserts, testapp):
    """
    Tests that we can post the processed inserts to a test app with
    no errors. This posts all gene annotation fields in the gene_table.
    """
    for item in inserts:
        testapp.post_json(GENE_ANNOTATION_FIELD_URL, item, status=201)


def test_generate_gene_schema(gene_schema):
    """ Inspects parts of the generated gene schema for correctness """
    properties = gene_schema['properties']

    # check top level properties
    assert 'chrom' in properties
    assert 'enum' in properties['chrom']
    assert properties['chrom']['type'] == 'string'
    assert properties['chrom']['do_import'] is True
    assert properties['chrom']['schema_title'] == 'Chromosome'

    # check sub-embedded object fields
    assert properties['clingendis']['type'] == 'array'
    clingendis_props = properties['clingendis']['items']['properties']
    assert len(clingendis_props.keys()) == CLINGENDIS_FIELDS_EXPECTED
    assert 'disease_id' in clingendis_props
    clingendis_disease_label = properties['clingendis']['items']['properties']['disease_label']
    assert clingendis_disease_label['type'] == 'string'

    # Re-enable once these fields are added to gene schema via do_import
    # transcript_props = properties['transcript']['items']['properties']
    # assert len(transcript_props.keys()) == TRANSCRIPT_FIELDS_EXPECTED
    # assert 'refseq' in transcript_props
    # assert 'protein_length' in transcript_props
    # assert transcript_props['five_prime_utr']['source_name'] == 'GenCode'

    # check regex
    assert properties['ensgid']['pattern'] == '^ENSG[0-9]{11}$'
    assert properties['ucsc_id']['pattern'] == '^uc[0-9]{3}[a-z]{3}\\.[0-9]$'

    # XXX: Columns/Facets are empty
    assert gene_schema['columns'] == {}
    assert gene_schema['facets'] == {}


def test_gene_table_run(GTParser, testapp):
    """ Runs the gene table ingestion process, building the schema into the test location
        and posting the resulting inserts """
    inserts = GTParser.run(gs_out=GENE_SCHEMA_TEST_LOC, write=False)
    for item in inserts:
        testapp.post_json(GENE_ANNOTATION_FIELD_URL, item, status=201)

