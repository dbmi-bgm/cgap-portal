import pytest
from encoded.commands.gene_table_intake import (
    GeneTableParser
)

pytestmark = [pytest.mark.working]
MT_LOC = './src/encoded/tests/data/variant_workbook/gene_table.csv'
GENE_ANNOTATION_FIELD_SCHEMA = './src/encoded/schemas/gene_annotation_field.json'
EXPECTED_FIELDS = ['column_priority', 'comments', 'description', 'do_import',
                   'enum_list', 'facet_grouping', 'facet_priority', 'field_name',
                   'field_priority', 'field_type', 'is_list', 'link', 'no', 'schema_title',
                   'separator', 'source_name', 'source_version', 'sub_embedding_group', 'value_example']
NUMBER_ANNOTATION_FIELDS = 280
EXPECTED_INSERT = {'no': 1, 'field_name': 'chrom', 'source_name': 'ENSEMBLgene',
                   'source_version': 'v99', 'schema_title': 'Chromosome',
                   'description': "name of the chromosome or scaffold; chromosome names without a 'chr'",
                   'value_example': '1; 2; 3; 4; 5; 6; 7; X; 8; 9', 'is_list': False,
                   'field_type': 'string',
                   'enum_list':
                       ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
                        '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y', 'M'],
                   'do_import': True}


@pytest.fixture
def GTParser():
    parser = GeneTableParser(MT_LOC, GENE_ANNOTATION_FIELD_SCHEMA)
    return parser

@pytest.fixture
def inserts(GTParser):
    return GTParser.process_mp_inserts()


def test_read_gene_table_header(GTParser):
    """ Tests that we can read mapping table header correctly based on the current format """
    assert GTParser.version == 'gene_annV0.4.1'
    assert GTParser.date == '2020.04.20'
    assert sorted(GTParser.fields) == sorted(EXPECTED_FIELDS)


def test_process_gene_table_inserts(GTParser, inserts):
    """
        Tests that we properly process gene annotation field inserts
        There should be 254 total. A hand crafted example is checked
    """
    assert inserts[0] == EXPECTED_INSERT
    assert len(inserts) == NUMBER_ANNOTATION_FIELDS


def test_post_gene_annotation_field_inserts(inserts, testapp):
    """
    Tests that we can post the processed inserts to a test app with
    no errors.
    Use variant_items fixture to use already generated inserts based
    on the current mapping table
    Post them to the testapp
    """
    CONNECTION_URL = '/gene_annotation_field'
    for item in inserts:
        testapp.post_json(CONNECTION_URL, item, status=201)
