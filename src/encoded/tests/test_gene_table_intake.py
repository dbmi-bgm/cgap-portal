import pytest
from encoded.commands.gene_table_intake import (
    GeneTableParser
)

pytestmark = [pytest.mark.working, pytest.mark.ingestion]
MT_LOC = './src/encoded/tests/data/variant_workbook/gene_table.csv'
GENE_SCHEMA_TEST_LOC = './src/encoded/tests/data/variant_workbook/gene.json'
GENE_ANNOTATION_FIELD_SCHEMA = './src/encoded/schemas/gene_annotation_field.json'
EXPECTED_FIELDS = ['column_priority', 'comments', 'description', 'do_import',
                   'enum_list', 'pattern', 'facet_grouping', 'facet_priority', 'field_name',
                   'field_priority', 'field_type', 'is_list', 'link', 'no', 'schema_title',
                   'separator', 'source_name', 'source_version', 'sub_embedding_group', 'value_example']
NUMBER_ANNOTATION_FIELDS = 284
EXPECTED_INSERT = {'no': 1, 'field_name': 'chrom', 'source_name': 'ENSEMBLgene',
                   'source_version': 'v99', 'schema_title': 'Chromosome',
                   'description': "name of the chromosome or scaffold; chromosome names without a 'chr'",
                   'value_example': '1; 2; 3; 4; 5; 6; 7; X; 8; 9', 'is_list': False,
                   'field_type': 'string',
                   'enum_list':
                       ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
                        '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y', 'M'],
                   'do_import': True}
CLINGENDIS_FIELDS_EXPECTED = 6
TRANSCRIPT_FIELDS_EXPECTED = 15


@pytest.fixture
def GTParser():
    parser = GeneTableParser(MT_LOC, GENE_ANNOTATION_FIELD_SCHEMA)
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
    assert GTParser.version == 'gene_annV0.4.4'
    assert GTParser.date == '2020.04.27'
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
    CONNECTION_URL = '/gene_annotation_field'
    for item in inserts:
        testapp.post_json(CONNECTION_URL, item, status=201)


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
    assert 'classification_date' in clingendis_props
    clingendis_disease_label = properties['clingendis']['items']['properties']['disease_label']
    assert clingendis_disease_label['type'] == 'string'

    transcript_props = properties['transcript']['items']['properties']
    assert len(transcript_props.keys()) == TRANSCRIPT_FIELDS_EXPECTED
    assert 'refseq' in transcript_props
    assert 'protein_length' in transcript_props
    assert transcript_props['five_prime_utr']['source_name'] == 'GenCode'

    # check regex
    assert properties['ensgid']['pattern'] == '^ENSG[0-9]{11}$'
    assert properties['ucsc_id']['pattern'] == '^uc[0-9]{3}[a-z]{3}\\.[0-9]$'

    # XXX: Columns/Facets are empty
    assert gene_schema['columns'] == {}
    assert gene_schema['facets'] == {}


def test_gene_table_run(GTParser, testapp):
    """ Runs the gene table ingestion process, building the schema into the test location
        and posting the resulting inserts """
    CONNECTION_URL = '/gene_annotation_field'
    inserts = GTParser.run(gs_out=GENE_SCHEMA_TEST_LOC, write=True)
    for item in inserts:
        testapp.post_json(CONNECTION_URL, item, status=201)

