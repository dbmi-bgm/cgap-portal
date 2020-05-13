import pytest
import json
from encoded.commands.ingest_genes import (
    GeneIngestion
)


GENES_LOC = './src/encoded/tests/data/variant_workbook/gene_inserts_partial.json'
NUMBER_TO_POST = 5


@pytest.fixture
def test_genes():
    genes = GeneIngestion(GENES_LOC)
    return genes


@pytest.fixture
def genes(testapp, project, institution, test_genes):
    """ Fixture that posts a subset of genes """
    CONNECTION_URL = '/gene'
    for gene in test_genes:
        gene['project'] = 'encode-project'
        gene['institution'] = 'encode-institution'
        testapp.post_json(CONNECTION_URL, gene, status=201)


@pytest.fixture
def gene_workbook(testapp):
    """ Posts Genes required for the first few variants in the test VCF up to NUMBER_TO_POST """
    genes = json.load(open('./src/encoded/tests/data/variant_workbook/gene_workbook.json', 'r'))
    for entry in genes:
        entry['project'] = 'encode-project'
        entry['institution'] = 'encode-institution'
        testapp.post_json('/gene', entry, status=201)


@pytest.fixture
def post_variant_consequence_items(testapp):
    """ Posts VariantConsequence items so we can post variants that link to these """
    vcs = json.load(open('./src/encoded/tests/data/variant_workbook/variant_consequence.json', 'r'))
    for entry in vcs:
        testapp.post_json('/variant_consequence', entry, status=201)


@pytest.fixture
def variants_and_variant_samples(testapp, institution, project, test_vcf, gene_workbook, post_variant_consequence_items):
    """ Will post a small subset of variants + variant samples with links """
    VARIANT_URL, VARIANT_SAMPLE_URL = '/variant', '/variant_sample'
    for idx, record in enumerate(test_vcf):
        if idx == NUMBER_TO_POST:
            break
        variant = test_vcf.create_variant_from_record(record)
        variant['project'] = 'encode-project'
        variant['institution'] = 'encode-institution'
        test_vcf.format_variant_sub_embedded_objects(variant)
        res = testapp.post_json(VARIANT_URL, variant, status=201).json['@graph'][0]  # only one item posted
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'encode-project'
            sample['institution'] = 'encode-institution'
            sample['variant'] = res['@id']  # make link
            testapp.post_json(VARIANT_SAMPLE_URL, sample, status=201)