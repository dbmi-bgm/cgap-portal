import pytest
import json
from ..util import resolve_file_path
from ..commands.ingest_genes import GeneIngestion


GENES_LOC = resolve_file_path('tests/data/variant_workbook/gene_inserts_partial.json')
GENE_WORKBOOK = resolve_file_path('tests/data/variant_workbook/gene_workbook.json')
VARIANT_CONSEQUENCE_LOC = resolve_file_path('annotations/variant_consequence.json')
MAX_POSTS_FOR_TESTING = 5
ANNOTATION_FIELD_URL = '/annotation_field'
GENE_ANNOTATION_FIELD_URL = '/gene_annotation_field'
VARIANT_URL = '/variant'
VARIANT_SAMPLE_URL = '/variant_sample'
GENE_URL = '/gene'


@pytest.fixture
def test_genes():
    genes = GeneIngestion(GENES_LOC)
    return genes


@pytest.fixture
def genes(es_testapp, workbook, test_genes):
    """ Fixture that posts a subset of genes """
    for gene in test_genes:
        gene['project'] = 'hms-dbmi'
        gene['institution'] = 'hms-dbmi'
        es_testapp.post_json(GENE_URL, gene, status=201)


@pytest.fixture
def gene_workbook(es_testapp, workbook):
    """ Posts Genes required for the first few variants in the test VCF up to NUMBER_TO_POST """
    genes = json.load(open(GENE_WORKBOOK, 'r'))
    for entry in genes:
        entry['project'] = 'hms-dbmi'
        entry['institution'] = 'hms-dbmi'
        try:
            es_testapp.post_json(GENE_URL, entry, status=201)
        except:
            pass  # likely already there


@pytest.fixture
def post_variant_consequence_items(es_testapp, workbook):
    """ Posts VariantConsequence items so we can post variants that link to these """
    vcs = json.load(open(VARIANT_CONSEQUENCE_LOC, 'r'))
    for entry in vcs:
        entry['project'] = 'hms-dbmi'
        entry['institution'] = 'hms-dbmi'
        es_testapp.post_json('/variant_consequence', entry, status=201)


@pytest.fixture
def variants_and_variant_samples(es_testapp, workbook, test_vcf, gene_workbook, post_variant_consequence_items):
    """ Will post a small subset of variants + variant samples with links """
    for idx, record in enumerate(test_vcf):
        if idx == MAX_POSTS_FOR_TESTING:
            break
        variant = test_vcf.create_variant_from_record(record)
        variant['project'] = 'hms-dbmi'
        variant['institution'] = 'hms-dbmi'
        test_vcf.format_variant_sub_embedded_objects(variant)
        res = es_testapp.post_json(VARIANT_URL, variant, status=201).json['@graph'][0]  # only one item posted
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'hms-dbmi'
            sample['institution'] = 'hms-dbmi'
            sample['variant'] = res['@id']  # make link
            es_testapp.post_json(VARIANT_SAMPLE_URL, sample, status=201)
