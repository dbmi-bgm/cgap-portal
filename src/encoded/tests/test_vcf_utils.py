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
TEST_VCF = './src/encoded/annotations/GAPFIBVPFEP5_v0.5.4.reformat.altcounts.vcf.subset'
EXPECTED_ANNOTATION_FIELDS = ['comHet', 'CSQ']
VARIANT_SCHEMA = './src/encoded/schemas/variant.json'
VARIANT_SAMPLE_SCHEMA = './src/encoded/schemas/variant_sample.json'
TEST_SV_VCF = resolve_file_path("annotations/GAPFIV4NLMMT_v0.0.3.vcf.subset")
SV_SCHEMA = resolve_file_path("schemas/structural_variant.json")
SV_SAMPLE_SCHEMA = resolve_file_path("schemas/structural_variant_sample.json")


@pytest.fixture
def test_vcf():
    parser = VCFParser(TEST_VCF, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA)
    return parser


class TestIngestVCF:

    VEP_IDENTIFIER = 'transcript'
    GENE_IDENTIFIER = 'genes'
    HG19_IDENTIFIER = 'hg19'

    @staticmethod
    def get_top_level_field(item, field):
        if field not in item:
            return None
        return item[field]

    def _get_sub_annotation_field(self, item, idx, identifier, field):
        annotations = self.get_top_level_field(item, identifier)
        if annotations is None:
            return None
        if idx > len(annotations):
            raise ValueError('Index out of range on annotations %s, idx: %s' % (identifier, idx))
        return annotations[idx].get(field, None)

    def get_transcript_field(self, item, idx, field):
        return self._get_sub_annotation_field(item, idx, self.VEP_IDENTIFIER, field)

    def get_genes_field(self, item, idx, field):
        return self._get_sub_annotation_field(item, idx, self.GENE_IDENTIFIER, field)

    def get_hg19_field(self, item, idx, field):
        return self._get_sub_annotation_field(item, idx, self.HG19_IDENTIFIER, field)

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
        assert self.get_top_level_field(result, 'CHROM') == '8'
        assert self.get_top_level_field(result, 'csq_spliceai_pred_ds_al') == 0.0  # default
        assert self.get_top_level_field(result, 'csq_spliceai_pred_dp_dg') == 38
        assert self.get_top_level_field(result, 'csq_spliceai_pred_dp_ag') == -47

        # check sub-embedded object fields
        assert len(result['transcript']) == 1
        assert self.get_transcript_field(result, 0, 'csq_consequence') == ['splice_region_variant']
        assert self.get_transcript_field(result, 0, 'csq_gene') == 'ENSG00000261236'
        assert self.get_transcript_field(result, 0, 'csq_feature') == 'ENST00000569669'
        assert self.get_transcript_field(result, 0, 'csq_strand') is False

    def test_build_multiple_variants(self, test_vcf):
        """
        Tests that we can correctly process an annotated VCF with multiple records
        """
        self.test_build_one_variant(test_vcf)  # run above test

        # check record 2
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)

        # check top level fields
        assert self.get_top_level_field(result, 'csq_cadd_phred') == 2.692
        assert self.get_top_level_field(result, 'csq_spliceai_pred_symbol') == 'SAMD11'
        assert self.get_top_level_field(result, 'csq_gnomadg_ac') == 340
        assert self.get_top_level_field(result, 'csq_spliceai_pred_dp_ag') == 8

        # check transcript
        assert len(result['transcript'].keys()) == 11
        assert self.get_transcript_field(result, 0, 'csq_consequence') == ['intron_variant']
        assert self.get_transcript_field(result, 0, 'csq_feature') == 'ENST00000341065'
        assert self.get_transcript_field(result, 0, "csq_strand") is True

        # check genes
        assert self.get_genes_field(result, 0, 'genes_most_severe_gene') == 'ENSG00000187634'
        assert self.get_genes_field(result, 0, 'genes_most_severe_transcript') == 'ENST00000342066'

        # check record 3 (only a few things)
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)
        assert len(result[self.VEP_IDENTIFIER].keys()) == 1
        assert self.get_top_level_field(result, 'spliceaiMaxds') == 0
        assert self.get_top_level_field(result, 'variantClass') == 'SNV'
        assert self.get_top_level_field(result, 'csq_spliceai_pred_symbol') == 'NOC2L'
        assert self.get_transcript_field(result, 0, 'csq_consequence') == ['missense_variant']
        assert self.get_transcript_field(result, 0, 'csq_feature') == 'ENST00000327044'
        assert self.get_transcript_field(result, 0, 'csq_trembl') is None
        assert self.get_transcript_field(result, 0, 'csq_domains') == ['Pfam:PF03715', 'PANTHER:PTHR12687',
                                                                       'PANTHER:PTHR12687:SF10', 'Superfamily:SSF48371']
        assert self.get_genes_field(result, 0, 'genes_most_severe_gene') == 'ENSG00000188976'
        assert self.get_genes_field(result, 0, 'genes_most_severe_hgvsc') == 'ENST00000327044.7:c.1528A>C'

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
            assert self.get_top_level_field(sample, 'GT') != '0/0'  # this VCF has one of these that should be dropped
        assert result[0]['FS'] == 0.0
        assert result[0]['GT'] == '0/1'

        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]  # inspect first
        assert self.get_top_level_field(result, 'DP') == 12
        assert self.get_top_level_field(result, 'GT') == '0/1'
        assert self.get_top_level_field(result, 'GQ') == 63
        assert self.get_top_level_field(result, 'PL') == '63,0,226'
        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]
        assert self.get_top_level_field(result, 'DP') == 37
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


class TestIngestStructuralVariantVCF(TestIngestVCF):

    VEP_IDENTIFIER = "transcript"  # In case of future divergence from SNV tests

    def test_build_variants(self, test_sv_vcf):
        """
        Test accurate processing of multiple records for subset of all
        expected fields that can be ingested.
        """

        # record 1 - Basics + Transcript fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_variant_from_record(record)

        assert self.get_top_level_field(result, "CHROM") == "1"
        assert self.get_top_level_field(result, "START") == 31908111
        assert self.get_top_level_field(result, "END") == 31908161
        assert self.get_top_level_field(result, "SV_TYPE") == "DEL"
        assert self.get_top_level_field(result, "cytoband_start") == "p35.2"
        assert self.get_top_level_field(result, "cytoband_end") == "p35.2"
        assert self.get_top_level_field(result, "unrelated_count") == 1
        assert len(result["transcript"]) == 9
        assert self.get_transcript_field(result, 0, "csq_consequence") == [
            "downstream_gene_variant"
        ]
        assert self.get_transcript_field(result, 0, "csq_gene") == "ENSG00000184007"
        assert self.get_transcript_field(result, 0, "csq_feature") == "ENST00000457805"
        assert self.get_transcript_field(result, 0, "csq_biotype") == "protein_coding"
        assert self.get_transcript_field(result, 0, "csq_distance") == "373"
        assert self.get_transcript_field(result, 0, "csq_strand") is False
        assert not self.get_transcript_field(result, 0, "csq_canonical")
        assert self.get_transcript_field(result, 6, "csq_exon") == "5/5"
        assert not self.get_transcript_field(result, 6, "csq_intron")
        assert self.get_transcript_field(result, 6, "csq_cdna_position") == "1613-1662"
        assert self.get_transcript_field(result, 7, "csq_canonical") is True
        variant_keys = result.keys()
        for key in variant_keys:
            assert "gnomadg" not in key

        # record 2 - gnomAD-SV values + Transcript intron
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_variant_from_record(record)

        assert self.get_top_level_field(result, "gnomadg_ac") == 8
        assert self.get_top_level_field(result, "gnomadg_af-afr") == 0.000757
        assert self.get_top_level_field(result, "gnomadg_an-eur") == 7608
        assert self.get_transcript_field(result, 5, "csq_intron") == "1/1"
        assert self.get_transcript_field(result, 0, "csq_strand") is True

        # record 3 - Additional Transcript fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_variant_from_record(record)
        
        assert self.get_transcript_field(result, 0, "csq_cds_position") == "3594-4583"
        assert self.get_transcript_field(
            result, 0, "csq_protein_position"
        ) == "1198-1528"
        assert self.get_transcript_field(result, 0, "csq_codons").startswith("agTCTCCC")
        assert self.get_transcript_field(result, 0, "csq_amino_acids").startswith(
            "SLPSMQGDLK"
        )

    def test_build_variant_samples(self, test_sv_vcf):
        """
        Test accurate processing of multiple records for subset of all
        expected fields that can be ingested.
        """

        # record 1 - Basics + Samplegeno fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_sample_variant_from_record(record)
        
        assert len(result) == 1
        assert self.get_top_level_field(result[0], "GT") == "0/1"
        assert self.get_top_level_field(result[0], "CALL_INFO") == "NA12878_sample"
        assert self.get_top_level_field(result[0], "GQ") == 43
        assert self.get_top_level_field(result[0], "PL") == "158,0,40"
        assert not self.get_top_level_field(result[0], "imprecise")
        assert self.get_top_level_field(
            result[0], "confidence_interval_start"
        ) == [0, 1]
        sample_geno = self.get_top_level_field(result[0], "samplegeno")
        assert len(sample_geno) == 3
        assert sample_geno[0]["samplegeno_numgt"] == "0/0"
        assert sample_geno[2]["samplegeno_sampleid"] == "NA12877_sample"

        # record 2 - Basics + Samplegeno fields
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_sample_variant_from_record(record)

        assert len(result) == 2
        sample_geno = self.get_top_level_field(result[1], "samplegeno")
        assert len(sample_geno) == 3
        assert sample_geno[1]["samplegeno_sampleid"] == "NA12878_sample"
        assert sample_geno[1]["samplegeno_quality"] == 48
        assert sample_geno[2]["samplegeno_numgt"] == "0/1"
        assert sample_geno[2]["samplegeno_likelihood"] == "209,0,12"
        
        # record 4 - Confidence intervals and Imprecise
        record = test_sv_vcf.read_next_record()
        record = test_sv_vcf.read_next_record()
        result = test_sv_vcf.create_sample_variant_from_record(record)

        for idx in range(len(result)):
            assert self.get_top_level_field(result[idx], "imprecise") is True
            assert self.get_top_level_field(
                result[idx], "confidence_interval_start"
            ) == [-236, 237]
            assert self.get_top_level_field(
                result[idx], "confidence_interval_end"
            ) == [-136, 136]
