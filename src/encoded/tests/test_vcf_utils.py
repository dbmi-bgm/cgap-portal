import pytest

from ..ingestion.vcf_utils import VCFParser, StructuralVariantVCFParser
from ..util import resolve_file_path
from .variant_fixtures import (  # noqa
    GENE_URL,
    GENE_WORKBOOK,
    MAX_POSTS_FOR_TESTING,
    VARIANT_SAMPLE_URL,
    VARIANT_URL
)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]
TEST_VCF = resolve_file_path(
    "annotations/GAPFII76KW2T_v0.5.6.reformat.altcounts.vcf.subset"
)
EXPECTED_ANNOTATION_FIELDS = ['comHet', 'CSQ']
VARIANT_SCHEMA = resolve_file_path("schemas/variant.json")
VARIANT_SAMPLE_SCHEMA = resolve_file_path("schemas/variant_sample.json")
TEST_SV_VCF = resolve_file_path("annotations/GAPFIQHD6QAN_v0.0.6.sv.vcf.subset")
TEST_CNV_VCF = resolve_file_path("annotations/GAPFIXRDPDK5_v0.0.6.cnv.vcf.subset")
SV_SCHEMA = resolve_file_path("schemas/structural_variant.json")
SV_SAMPLE_SCHEMA = resolve_file_path("schemas/structural_variant_sample.json")
VEP_IDENTIFIER = 'transcript'
GENE_IDENTIFIER = 'genes'
HG19_IDENTIFIER = 'hg19'


def get_top_level_field(item, field):
    if field not in item:
        return None
    return item[field]


def get_sub_annotation_field(item, idx, identifier, field):
    annotations = get_top_level_field(item, identifier)
    if annotations is None:
        return None
    if idx > len(annotations):
        raise ValueError('Index out of range on annotations %s, idx: %s' % (identifier, idx))
    return annotations[idx].get(field, None)


def get_transcript_field(item, idx, field):
    return get_sub_annotation_field(item, idx, VEP_IDENTIFIER, field)


def get_genes_field(item, idx, field):
    return get_sub_annotation_field(item, idx, GENE_IDENTIFIER, field)


def get_hg19_field(item, idx, field):
    return get_sub_annotation_field(item, idx, HG19_IDENTIFIER, field)


@pytest.fixture
def test_vcf():
    parser = VCFParser(TEST_VCF, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
    return parser


class TestIngestVCF:

    def test_parser_meta(self, test_vcf):
        """ Checks that we can correctly read which fields are annotation fields
            Apparantly that is only comHet now?
        """
        annotation_fields = test_vcf.annotation_keys
        for annot_field in EXPECTED_ANNOTATION_FIELDS:
            assert annot_field in annotation_fields
        assert test_vcf.get_sub_embedded_label('comHet') == ('cmphet', False)

    @pytest.mark.skip  # invoked by below test
    def test_build_one_variant(self, test_vcf):
        """
        Tests that we can correctly process a single VCF variant
        Checks many specific things about the record for correctness
        For all the following tests we check a 'representative subset' of information
        """
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)

        # check top level fields
        assert get_top_level_field(result, 'CHROM') == '8'
        assert get_top_level_field(result, 'csq_spliceai_pred_ds_al') == 0.0  # default
        assert get_top_level_field(result, 'csq_spliceai_pred_dp_dg') == 38
        assert get_top_level_field(result, 'csq_spliceai_pred_dp_ag') == -47

        # check sub-embedded object fields
        assert len(result['transcript']) == 1
        assert get_transcript_field(result, 0, 'csq_consequence') == ['splice_region_variant']
        assert get_transcript_field(result, 0, 'csq_gene') == 'ENSG00000261236'
        assert get_transcript_field(result, 0, 'csq_feature') == 'ENST00000569669'
        assert get_transcript_field(result, 0, 'csq_strand') is False

    def test_build_multiple_variants(self, test_vcf):
        """
        Tests that we can correctly process an annotated VCF with multiple records
        """
        self.test_build_one_variant(test_vcf)  # run above test

        # check record 2
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)

        # check top level fields
        assert get_top_level_field(result, 'csq_cadd_phred') == 2.692
        assert get_top_level_field(result, 'csq_spliceai_pred_symbol') == 'SAMD11'
        assert get_top_level_field(result, 'csq_gnomadg_ac') == 340
        assert get_top_level_field(result, 'csq_spliceai_pred_dp_ag') == 8
        assert get_top_level_field(result, "hgvsg") == (
            "NC_000001.11:g.943547_943549del"
        )
        assert get_top_level_field(result, "hgvsg_hg19") == (
            "NC_000001.10:g.878927_878929del"
        )
        assert get_top_level_field(result, "hg19_chr") == "1"
        assert get_top_level_field(result, "hg19_pos") == 878926

        # check transcript
        assert len(result['transcript'].keys()) == 11
        assert get_transcript_field(result, 0, 'csq_consequence') == ['intron_variant']
        assert get_transcript_field(result, 0, 'csq_feature') == 'ENST00000341065'
        assert get_transcript_field(result, 0, "csq_strand") is True

        # check genes
        assert get_genes_field(result, 0, 'genes_most_severe_gene') == 'ENSG00000187634'
        assert get_genes_field(result, 0, 'genes_most_severe_transcript') == 'ENST00000342066'

        # check record 3 (only a few things)
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)
        assert len(result[VEP_IDENTIFIER].keys()) == 1
        assert get_top_level_field(result, 'spliceaiMaxds') == 0
        assert get_top_level_field(result, 'variantClass') == 'SNV'
        assert get_top_level_field(result, 'csq_spliceai_pred_symbol') == 'NOC2L'
        assert get_transcript_field(result, 0, 'csq_consequence') == ['missense_variant']
        assert get_transcript_field(result, 0, 'csq_feature') == 'ENST00000327044'
        assert get_transcript_field(result, 0, 'csq_trembl') is None
        assert get_transcript_field(result, 0, 'csq_domains') == ['Pfam:PF03715', 'PANTHER:PTHR12687',
                                                                       'PANTHER:PTHR12687:SF10', 'Superfamily:SSF48371']
        assert get_genes_field(result, 0, 'genes_most_severe_gene') == 'ENSG00000188976'
        assert get_genes_field(result, 0, 'genes_most_severe_hgvsc') == 'ENST00000327044.7:c.1528A>C'

        # check record 4 (new gnomade2 fields)
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)
        for field_name in test_vcf.OVERWRITE_FIELDS.values():
            if 'gnomade2' in field_name:
                assert field_name in result

    def test_build_multiple_sample_variants(self, test_vcf):
        """ Generates 3 sample variant items and checks them for correctness """
        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)
        for sample in result:
            assert get_top_level_field(sample, 'GT') != '0/0'  # this VCF has one of these that should be dropped
            assert get_top_level_field(sample, 'MQ') == 60.0
        assert result[0]['FS'] == 0.0
        assert result[0]['GT'] == '0/1'

        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]  # inspect first
        assert get_top_level_field(result, 'DP') == 12
        assert get_top_level_field(result, 'GT') == '0/1'
        assert get_top_level_field(result, 'GQ') == 63
        assert get_top_level_field(result, 'PL') == '63,0,226'
        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]
        assert get_top_level_field(result, 'DP') == 37
        assert len(result['samplegeno']) == 3  # just check field presence
        assert result['samplegeno'][0]['samplegeno_numgt'] == '0/0'
        assert result['samplegeno'][0]['samplegeno_ad'] == '36/0'
        assert result['samplegeno'][0]['samplegeno_gt'] == 'T/T'

    # Tests a subset of the last test
    # def test_post_variants(self, es_testapp, test_vcf, gene_workbook, post_variant_consequence_items):
    #     """ Attempts to post all generated variants without links """
    #     for idx, record in enumerate(test_vcf):
    #         if idx == MAX_POSTS_FOR_TESTING:
    #             break
    #         variant = test_vcf.create_variant_from_record(record)
    #         variant['project'] = 'hms-dbmi'
    #         variant['institution'] = 'hms-dbmi'
    #         test_vcf.format_variant_sub_embedded_objects(variant)
    #         res = es_testapp.post_json(VARIANT_URL, variant, status=201).json
    #         assert 'annotation_id' in res['@graph'][0]  # verify annotation_id is added on post


# integrated test, so outside of class XXX: Refactor to use variant_utils
# Also, if not fully uncommented, the setup still occurs ???
# @pytest.mark.skip  # Comment this out and run directly to test the first 5 variants and variant samples validation
# def test_post_variants_and_samples_with_links(workbook, es_testapp, test_vcf):
#     """ Will post all generated variants and samples, forming linkTo's from variant_sample to variant
#         NOTE: This is the most important test functionally speaking.
#     """
#     # post gene workbook
#     genes = json.load(open(GENE_WORKBOOK, 'r'))
#     for entry in genes:
#         entry['project'] = 'hms-dbmi'
#         entry['institution'] = 'hms-dbmi'
#         es_testapp.post_json(GENE_URL, entry, status=201)
#
#     for idx, record in enumerate(test_vcf):
#         if idx == MAX_POSTS_FOR_TESTING:
#             break
#         variant = test_vcf.create_variant_from_record(record)
#         assert 'transcript' in variant
#         variant['project'] = 'hms-dbmi'
#         variant['institution'] = 'hms-dbmi'
#         test_vcf.format_variant_sub_embedded_objects(variant)
#         res = es_testapp.post_json(VARIANT_URL, variant, status=201).json['@graph'][0]  # only one item posted
#         assert 'annotation_id' in res
#         variant_samples = test_vcf.create_sample_variant_from_record(record)
#         for sample in variant_samples:
#             sample['project'] = 'hms-dbmi'
#             sample['institution'] = 'hms-dbmi'
#             sample['variant'] = res['@id']  # make link
#             sample['file'] = 'dummy-filename'
#             res2 = es_testapp.post_json(VARIANT_SAMPLE_URL, sample, status=201).json
#             assert 'annotation_id' in res2['@graph'][0]
#             assert 'bam_snapshot' in res2['@graph'][0]

@pytest.fixture
def test_sv_vcf():
    parser = StructuralVariantVCFParser(TEST_SV_VCF, SV_SCHEMA, SV_SAMPLE_SCHEMA)
    return parser


@pytest.fixture
def test_cnv_vcf():
    parser = StructuralVariantVCFParser(TEST_CNV_VCF, SV_SCHEMA, SV_SAMPLE_SCHEMA)
    return parser


class TestIngestStructuralVariantVCF():

    def test_build_variants(self, test_sv_vcf):
        """
        Test accurate processing of multiple records for subset of all
        expected fields that can be ingested.
        """

        # record 1 - Basics + Transcript fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_variant_from_record(record)

        assert get_top_level_field(result, "CHROM") == "1"
        assert get_top_level_field(result, "START") == 31908111
        assert get_top_level_field(result, "END") == 31908161
        assert get_top_level_field(result, "SV_TYPE") == "DEL"
        assert get_top_level_field(result, "cytoband_start") == "p35.2"
        assert get_top_level_field(result, "cytoband_end") == "p35.2"
        assert get_top_level_field(result, "unrelated_count") == 1
        assert get_top_level_field(result, "hg19_chr") == "1"
        assert get_top_level_field(result, "hg19_start") == 32373712
        assert get_top_level_field(result, "hg19_end") == 32373762
        assert len(result["transcript"]) == 6
        assert get_transcript_field(result, 0, "csq_consequence") == [
            "downstream_gene_variant"
        ]
        assert get_transcript_field(result, 0, "csq_gene") == "ENSG00000184007"
        assert get_transcript_field(result, 0, "csq_feature") == "ENST00000457805"
        assert get_transcript_field(result, 0, "csq_biotype") == "protein_coding"
        assert get_transcript_field(result, 0, "csq_distance") == "373"
        assert get_transcript_field(result, 0, "csq_strand") is False
        assert not get_transcript_field(result, 0, "csq_canonical")
        assert get_transcript_field(result, 3, "csq_exon") == "5/5"
        assert not get_transcript_field(result, 3, "csq_intron")
        assert get_transcript_field(result, 3, "csq_cdna_position") == "1613-1662"
        assert get_transcript_field(result, 4, "csq_canonical") is True
        assert get_transcript_field(result, 4, "csq_most_severe") is True
        assert get_transcript_field(
            result, 4, "csq_variant_5_prime_location"
        ) == "3_prime_UTR"
        assert get_transcript_field(
            result, 4, "csq_variant_3_prime_location"
        ) == "3_prime_UTR_or_Downstream"
        variant_keys = result.keys()
        for key in variant_keys:
            assert "gnomadg" not in key

        # record 2 - gnomAD-SV values + Transcript strand
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_variant_from_record(record)

        assert get_top_level_field(result, "gnomadg_ac") == 8
        assert get_top_level_field(result, "gnomadg_af-afr") == 0.000757
        assert get_top_level_field(result, "gnomadg_an-eur") == 7608
        assert get_transcript_field(result, 0, "csq_strand") is True

        # record 3 - Additional Transcript fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_variant_from_record(record)

        assert get_transcript_field(result, 0, "csq_cds_position") == "3594-4583"
        assert get_transcript_field(
            result, 0, "csq_protein_position"
        ) == "1198-1528"
        assert get_transcript_field(result, 0, "csq_codons").startswith("agTCTCCC")
        assert get_transcript_field(result, 0, "csq_amino_acids").startswith(
            "SLPSMQGDLK"
        )
        assert get_transcript_field(result, 1, "csq_intron") == "1/2"

    def test_build_variant_samples(self, test_sv_vcf):
        """
        Test accurate processing of multiple records for subset of all
        expected fields that can be ingested.
        """

        # record 1 - Basics + Samplegeno fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_sample_variant_from_record(record)

        assert len(result) == 1
        assert get_top_level_field(result[0], "GT") == "0/1"
        assert get_top_level_field(result[0], "CALL_INFO") == "NA12878_sample"
        assert get_top_level_field(result[0], "GQ") == 41
        assert get_top_level_field(result[0], "PL") == "156,0,38"
        assert not get_top_level_field(result[0], "imprecise")
        assert get_top_level_field(
            result[0], "confidence_interval_start"
        ) == [0, 1]
        assert get_top_level_field(result[0], "confidence_class") == "HIGH"
        assert get_top_level_field(result[0], "paired_reads") == [0, 0]
        assert get_top_level_field(result[0], "split_reads") == [6, 6]
        sample_geno = get_top_level_field(result[0], "samplegeno")
        assert len(sample_geno) == 3
        assert sample_geno[0]["samplegeno_numgt"] == "0/0"
        assert sample_geno[2]["samplegeno_sampleid"] == "NA12877_sample"

        # record 2 - Basics + Samplegeno fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_sample_variant_from_record(record)

        assert len(result) == 2
        sample_geno = get_top_level_field(result[1], "samplegeno")
        assert len(sample_geno) == 3
        assert sample_geno[1]["samplegeno_sampleid"] == "NA12878_sample"
        assert sample_geno[1]["samplegeno_quality"] == 48
        assert sample_geno[2]["samplegeno_numgt"] == "0/1"
        assert sample_geno[2]["samplegeno_likelihood"] == "185,0,13"

        # record 4 - Confidence intervals and Imprecise
        record = test_sv_vcf.read_next_record()
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_sample_variant_from_record(record)

        for idx in range(len(result)):
            assert get_top_level_field(result[idx], "imprecise") is True
            assert get_top_level_field(
                result[idx], "confidence_interval_start"
            ) == [-236, 236]
            assert get_top_level_field(
                result[idx], "confidence_interval_end"
            ) == [-135, 136]
            assert get_top_level_field(result[idx], "quality_score") == 15.0

    def test_build_variant_samples_cnv(self, test_cnv_vcf):
        """Test accurate processing of CNV-specific fields."""

        # record 1 - BIC-seq2 fields
        record = test_cnv_vcf.read_next_record()
        result = test_cnv_vcf.create_sample_variant_from_record(record)

        assert len(result) == 1
        assert get_top_level_field(result[0], "bicseq2_expected_reads") == 1378.15
        assert get_top_level_field(result[0], "bicseq2_observed_reads") == 738
        assert get_top_level_field(
            result[0], "bicseq2_log2_copy_ratio"
        ) == -0.90530749918775
        assert get_top_level_field(result[0], "bicseq2_pvalue") == 4.1426e-52
        assert get_top_level_field(result[0], "confidence_class") == "LOW"
        assert get_top_level_field(result[0], "quality_score") is None
