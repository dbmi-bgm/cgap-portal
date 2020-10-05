import pytest
from ..search.lucene_builder import LuceneBuilder


@pytest.fixture
def type_query_facet_filters():
    """ Simple query that just searches on Variant Sample """
    return {'bool': {
                'must': [{'terms': {'embedded.@type.raw': ['VariantSample']}}],
                'must_not': [
                    {'terms': {'embedded.@type.raw': ['TrackingItem', 'OntologyTerm']}},
                    {'terms': {'embedded.status.raw': ['deleted', 'replaced']}}
                ]
    }}


@pytest.fixture
def non_nested_query_facet_filters():
    """ Query that makes a single selection - should remove the inheritance mode filter """
    return {'bool': {
                'must': [
                    {'terms': {'embedded.@type.raw': ['VariantSample']}},
                    {'terms': {'embedded.inheritance_modes.raw': ['Recessive']}}],
                'must_not': [
                    {'terms': {'embedded.@type.raw': ['TrackingItem', 'OntologyTerm']}},
                    {'terms': {'embedded.status.raw': ['deleted', 'replaced']}}
                ]
    }}


VARIANT_SAMPLE_FACETS = ['embedded.AF', 'embedded.DP', 'embedded.FS', 'embedded.GQ',
                         'embedded.associated_genotype_labels.father_genotype_label.raw',
                         'embedded.associated_genotype_labels.mother_genotype_label.raw',
                         'embedded.associated_genotype_labels.proband_genotype_label.raw',
                         'embedded.cmphet.comhet_impact_gene.raw', 'embedded.inheritance_modes.raw', 'embedded.novoPP',
                         'embedded.variant.CHROM.raw', 'embedded.variant.POS', 'embedded.variant.cadd_phred',
                         'embedded.variant.clinvar_clnsig.raw', 'embedded.variant.conservation_phylop100',
                         'embedded.variant.cytoband_cytoband.raw',
                         'embedded.variant.genes.genes_ensg.gene_lists.display_title.raw',
                         'embedded.variant.genes.genes_ensg.oe_lof',
                         'embedded.variant.genes.genes_ensg.oe_lof_upper', 'embedded.variant.genes.genes_ensg.oe_mis',
                         'embedded.variant.genes.genes_ensg.s_het',
                         'embedded.variant.genes.genes_most_severe_consequence.coding_effect.raw',
                         'embedded.variant.genes.genes_most_severe_consequence.impact.raw',
                         'embedded.variant.genes.genes_most_severe_consequence.location.raw',
                         'embedded.variant.genes.genes_most_severe_maxentscan_diff',
                         'embedded.variant.genes.genes_most_severe_polyphen_score',
                         'embedded.variant.genes.genes_most_severe_sift_score', 'embedded.variant.gnomad_af',
                         'embedded.variant.gnomad_an', 'embedded.variant.gnomad_nhomalt',
                         'embedded.variant.max_pop_af_af_popmax', 'embedded.variant.mutanno_variant_class.raw',
                         'embedded.variant.spliceai_maxds', 'embedded.validation_errors.name.raw', ]


@pytest.mark.parametrize('facet', VARIANT_SAMPLE_FACETS)
def test_lucene_builder_aggregations_basic(type_query_facet_filters, facet):
    """ Tests the generate_filters_for_terms_agg_from_search_filters function in Lucene builder with a simple case
        that does not require modifying the source facet filters since no options are selected in the source search.
    """
    assert (LuceneBuilder.generate_filters_for_terms_agg_from_search_filters(facet, type_query_facet_filters, None) ==
            type_query_facet_filters['bool'])


@pytest.mark.parametrize('facet', ['embedded.inheritance_modes.raw', 'embedded.novoPP'])  # first should change filter
def test_lucene_builder_aggregations_complex(non_nested_query_facet_filters, facet):
    """ Tests that when building an aggregation for a field that is selected in the source search correctly removes
        the filter from the aggregation
    """
    filter = LuceneBuilder.generate_filters_for_terms_agg_from_search_filters(facet,
                                                                              non_nested_query_facet_filters, None)
    if facet == 'embedded.inheritance_modes.raw':
        assert filter != non_nested_query_facet_filters['bool']
    else:
        assert filter == non_nested_query_facet_filters['bool']
