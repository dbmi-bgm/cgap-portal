import pytest
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
    gene_workbook,
    post_variant_consequence_items,
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
        """ Checks that we can correctly read which fields are annotation """
        annotation_fields = test_vcf.annotation_keys
        for annot_field in EXPECTED_ANNOTATION_FIELDS:
            assert annot_field in annotation_fields
        assert test_vcf.get_sub_embedded_label('VEP') == ('transcript', True)
        assert test_vcf.get_sub_embedded_label('GENES') == ('genes', True)
        assert test_vcf.get_sub_embedded_label('HG19') == ('hg19', True)
        assert test_vcf.get_sub_embedded_label('CLINVAR_SUBMISSION') == ('clinvar_submission', True)
        assert test_vcf.get_sub_embedded_label('ANNOVAR') == (None, False)
        assert test_vcf.get_sub_embedded_label('comHet') == ('cmphet', False)

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
        assert self.get_top_level_field(result, 'cytoband_cytoband') == '1p36.33'
        assert self.get_top_level_field(result, 'conservation_phastcons30') == 0.545
        assert self.get_top_level_field(result, 'dbsnp_rs_number') == 'rs72631890'
        assert self.get_top_level_field(result, 'gnomad_an_raw') == 143376

        # check sub-embedded object fields
        assert len(result['transcript']) == 1
        assert self.get_transcript_field(result, 0, 'vep_consequence') == ['missense_variant']
        assert self.get_transcript_field(result, 0, 'vep_gene') == 'ENSG00000188976'
        assert self.get_transcript_field(result, 0, 'vep_canonical') is True

    def test_build_multiple_variants(self, test_vcf):
        """
        Tests that we can correctly process an annotated VCF with multiple records
        """
        self.test_build_one_variant(test_vcf)  # run previous test

        # check record 2
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)

        # check top level fields
        assert self.get_top_level_field(result, 'mutanno_variant_class') == 'DEL'
        assert self.get_top_level_field(result, 'mutanno_hgvsg') == 'NC_000001.11:g.979035_979037del'
        assert self.get_top_level_field(result, 'conservation_phylop20') == -0.91
        assert self.get_top_level_field(result, 'conservation_phylop30') == -1.239
        assert self.get_top_level_field(result, 'topmed_het') == 67
        assert self.get_top_level_field(result, 'conservation_phastcons100') == 0.0

        # check transcript
        assert len(result['transcript'].keys()) == 2
        assert self.get_transcript_field(result, 0, 'vep_consequence') == ['inframe_deletion']
        assert self.get_transcript_field(result, 0, 'vep_feature') == 'ENST00000341290'
        assert self.get_transcript_field(result, 0, 'vep_domains') == ['PANTHER:PTHR47282']

        # check genes
        assert self.get_genes_field(result, 0, 'genes_ensg') == 'ENSG00000187642'
        assert self.get_genes_field(result, 0, 'genes_most_severe_transcript') == 'ENST00000433179'

        # check hg19
        assert self.get_hg19_field(result, 0, 'hg19_pos') == 914414

        # check record 3 (only a few things)
        record = test_vcf.read_next_record()
        result = test_vcf.create_variant_from_record(record)
        assert len(result[self.VEP_IDENTIFIER].keys()) == 1
        assert self.get_transcript_field(result, 0, 'vep_consequence') == ['5_prime_UTR_variant']
        assert self.get_transcript_field(result, 0, 'vep_feature') == 'ENST00000649529'
        assert self.get_transcript_field(result, 0, 'vep_trembl') == None
        assert self.get_top_level_field(result, 'gnomad_ac_afr_male') == 158
        assert self.get_top_level_field(result, 'topmed_het') == 403

    def test_build_multiple_sample_variants(self, test_vcf):
        """ Generates 3 sample variant items and checks them for correctness """
        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)
        for sample in result:
            assert self.get_top_level_field(sample, 'GT') != '0/0'  # this VCF has one of these that should be dropped
        assert result[0]['FS'] == 1.28

        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]
        assert self.get_top_level_field(result, 'DP') == 38
        assert self.get_top_level_field(result, 'GT') == '0/1'
        assert self.get_top_level_field(result, 'GQ') == 99
        assert self.get_top_level_field(result, 'PL') == '876,0,605'
        record = test_vcf.read_next_record()
        result = test_vcf.create_sample_variant_from_record(record)[0]
        assert self.get_top_level_field(result, 'DP') == 52
        assert len(result['samplegeno']) == 3
        assert 'samplegeno_numgt' in result['samplegeno'][0]
        assert 'samplegeno_ad' in result['samplegeno'][0]
        assert 'samplegeno_gt' in result['samplegeno'][0]

    def test_post_variants(self, testapp, institution, project, test_vcf, gene_workbook, post_variant_consequence_items):
        """ Attempts to post all generated variants without links """
        for idx, record in enumerate(test_vcf):
            if idx == MAX_POSTS_FOR_TESTING:
                break
            variant = test_vcf.create_variant_from_record(record)
            variant['project'] = 'encode-project'
            variant['institution'] = 'encode-institution'
            test_vcf.format_variant_sub_embedded_objects(variant)
            res = testapp.post_json(VARIANT_URL, variant, status=201).json
            assert 'annotation_id' in res['@graph'][0]  # verify annotation_id is added on post

    def test_post_variants_and_samples_with_links(self, testapp, institution, project, test_vcf, gene_workbook,
                                                  post_variant_consequence_items):
        """ Will post all generated variants and samples, forming linkTo's from variant_sample to variant
            NOTE: This is the most important test functionally speaking.
        """
        VARIANT_URL, VARIANT_SAMPLE_URL = '/variant', '/variant_sample'
        for idx, record in enumerate(test_vcf):
            if idx == MAX_POSTS_FOR_TESTING:
                break
            variant = test_vcf.create_variant_from_record(record)
            variant['project'] = 'encode-project'
            variant['institution'] = 'encode-institution'
            test_vcf.format_variant_sub_embedded_objects(variant)
            res = testapp.post_json(VARIANT_URL, variant, status=201).json['@graph'][0]  # only one item posted
            assert 'annotation_id' in res
            variant_samples = test_vcf.create_sample_variant_from_record(record)
            for sample in variant_samples:
                sample['project'] = 'encode-project'
                sample['institution'] = 'encode-institution'
                sample['variant'] = res['@id']  # make link
                sample['file'] = 'dummy-filename'
                res2 = testapp.post_json(VARIANT_SAMPLE_URL, sample, status=201).json
                assert 'annotation_id' in res2['@graph'][0]
                assert 'bam_snapshot' in res2['@graph'][0]
