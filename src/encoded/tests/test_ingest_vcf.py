import pytest
import json
from snovault.interfaces import STORAGE
from .data.variant_workbook.expected import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    EXPECTED_ANNOTATION_FIELDS,
    TEST_VCF,
    RAW_INFOTAG_DESCRIPTION,
)
from ..commands.ingest_vcf import (
    VCFParser
)
from .variant_fixtures import (  # noqa
    GENE_URL,
    GENE_WORKBOOK,
    MAX_POSTS_FOR_TESTING,
    VARIANT_SAMPLE_URL,
    VARIANT_URL
)


pytestmark = [pytest.mark.working, pytest.mark.ingestion]


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
        assert self.get_top_level_field(result, 'CHROM') == '1'
        assert self.get_top_level_field(result, 'csq_spliceai_pred_ds_al') == 0.0  # default
        assert self.get_top_level_field(result, 'csq_spliceai_pred_dp_dg') == 7
        assert self.get_top_level_field(result, 'csq_spliceai_pred_dp_ag') == 8

        # check sub-embedded object fields
        assert len(result['transcript']) == 11
        assert self.get_transcript_field(result, 0, 'csq_consequence') == ['intron_variant']
        assert self.get_transcript_field(result, 0, 'csq_gene') == 'ENSG00000187634'
        assert self.get_transcript_field(result, 0, 'csq_feature') == 'ENST00000341065'
        assert self.get_transcript_field(result, 0, 'csq_strand') is True

        # check other indices
        assert self.get_transcript_field(result, 3, 'csq_strand') is True
        assert self.get_transcript_field(result, 3, 'csq_consequence') == ['intron_variant']

    def test_build_multiple_variants(self, test_vcf):
        """
        Tests that we can correctly process an annotated VCF with multiple records
        """
        self.test_build_one_variant(test_vcf)  # run above test

        # check record 2
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)

        # check top level fields
        assert self.get_top_level_field(result, 'csq_cadd_phred') == 24.9
        assert self.get_top_level_field(result, 'csq_spliceai_pred_symbol') == 'NOC2L'
        assert self.get_top_level_field(result, 'csq_gnomadg_ac') == 2
        assert self.get_top_level_field(result, 'csq_spliceai_pred_dp_ag') == -15

        # check transcript
        assert len(result['transcript'].keys()) == 1
        assert self.get_transcript_field(result, 0, 'csq_consequence') == ['missense_variant']
        assert self.get_transcript_field(result, 0, 'csq_feature') == 'ENST00000327044'
        assert self.get_transcript_field(result, 0, 'csq_domains') == ['Pfam:PF03715', 'PANTHER:PTHR12687',
                                                                       'PANTHER:PTHR12687:SF10', 'Superfamily:SSF48371']

        # XXX: check genes (missing)
        # assert self.get_genes_field(result, 0, 'genes_ensg') == 'ENSG00000187642'
        # assert self.get_genes_field(result, 0, 'genes_most_severe_transcript') == 'ENST00000433179'

        # check record 3 (only a few things)
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)
        assert len(result[self.VEP_IDENTIFIER].keys()) == 2
        assert self.get_top_level_field(result, 'csq_spliceai_pred_symbol') == 'PERM1'
        assert self.get_transcript_field(result, 0, 'csq_consequence') == ['inframe_deletion']
        assert self.get_transcript_field(result, 0, 'csq_feature') == 'ENST00000341290'
        assert self.get_transcript_field(result, 0, 'csq_trembl') is None

    def test_build_multiple_sample_variants(self, test_vcf):
        """ Generates 3 sample variant items and checks them for correctness """
        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)
        for sample in result:
            assert self.get_top_level_field(sample, 'GT') != '0/0'  # this VCF has one of these that should be dropped
        assert result[0]['FS'] == 11.761
        assert result[0]['GT'] == '0/1'

        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]  # inspect first
        assert self.get_top_level_field(result, 'DP') == 37
        assert self.get_top_level_field(result, 'GT') == '0/1'
        assert self.get_top_level_field(result, 'GQ') == 99
        assert self.get_top_level_field(result, 'PL') == '375,0,687'
        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]
        assert self.get_top_level_field(result, 'DP') == 38
        # assert len(result['samplegeno']) == 3  # just check field presence
        # assert 'samplegeno_numgt' in result['samplegeno'][0]
        # assert 'samplegeno_ad' in result['samplegeno'][0]
        # assert 'samplegeno_gt' in result['samplegeno'][0]

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


# integrated test, so outside of class
#@pytest.mark.skip  # Comment this out and run directly to test the first 5 variants and variant samples validation
def test_post_variants_and_samples_with_links(workbook, es_testapp, test_vcf):
    """ Will post all generated variants and samples, forming linkTo's from variant_sample to variant
        NOTE: This is the most important test functionally speaking.
    """
    # post gene workbook
    genes = json.load(open(GENE_WORKBOOK, 'r'))
    for entry in genes:
        entry['project'] = 'hms-dbmi'
        entry['institution'] = 'hms-dbmi'
        es_testapp.post_json(GENE_URL, entry, status=201)

    uuids_to_purge = {
        'variant': [],
        'variant_sample': []
    }
    for idx, record in enumerate(test_vcf):
        if idx == MAX_POSTS_FOR_TESTING:
            break
        variant = test_vcf.create_variant_from_record(record)
        assert 'transcript' in variant
        variant['project'] = 'hms-dbmi'
        variant['institution'] = 'hms-dbmi'
        test_vcf.format_variant_sub_embedded_objects(variant)
        res = es_testapp.post_json(VARIANT_URL, variant, status=201).json['@graph'][0]  # only one item posted
        assert 'annotation_id' in res
        uuids_to_purge['variant'].append(res['uuid'])
        variant_samples = test_vcf.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = 'hms-dbmi'
            sample['institution'] = 'hms-dbmi'
            sample['variant'] = res['@id']  # make link
            sample['file'] = 'dummy-filename'
            res2 = es_testapp.post_json(VARIANT_SAMPLE_URL, sample, status=201).json
            uuids_to_purge['variant_sample'].append(res['uuid'])
            assert 'annotation_id' in res2['@graph'][0]
            assert 'bam_snapshot' in res2['@graph'][0]
