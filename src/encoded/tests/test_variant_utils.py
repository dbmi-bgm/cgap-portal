import mock
import pytest
from dcicutils.misc_utils import VirtualApp

from ..ingestion.variant_utils import StructuralVariantBuilder, VariantBuilder
from ..ingestion.vcf_utils import StructuralVariantVCFParser, VCFParser
from .test_vcf_utils import SV_SAMPLE_SCHEMA, SV_SCHEMA, TEST_SV_VCF

pytestmark = [pytest.mark.working, pytest.mark.ingestion]


@pytest.fixture
def mocked_familial_relations():
    return [
        {
            "samples_pedigree": [
                {"sample_name": "sample_one", "relationship": "mother", "sex": "F"},
                {"sample_name": "sample_two", "relationship": "father", "sex": "M"},
                {"sample_name": "sample_three", "relationship": "proband", "sex": "M"},
            ]
        }
    ]


def test_ingestion_listener_build_familial_relations(
    testapp, mocked_familial_relations
):
    """
    Tests that we correctly extract familial relations from a mocked
    object that has the correct structure.
    """
    with mock.patch.object(
        VariantBuilder,
        "search_for_sample_relations",
        new=lambda x: mocked_familial_relations,
    ):
        builder = VariantBuilder(testapp, None, None)
        relations = builder.extract_sample_relations()
        assert relations["sample_one"]["samplegeno_role"] == "mother"
        assert relations["sample_two"]["samplegeno_role"] == "father"
        assert relations["sample_three"]["samplegeno_role"] == "proband"
        assert relations["sample_one"]["samplegeno_sex"] == "F"
        assert relations["sample_two"]["samplegeno_sex"] == "M"
        assert relations["sample_three"]["samplegeno_sex"] == "M"


class TestStructuralVariantBuilder:

    SV_VCF_PARSER = StructuralVariantVCFParser(TEST_SV_VCF, SV_SCHEMA, SV_SAMPLE_SCHEMA)
    RECORD = SV_VCF_PARSER.read_next_record()

    def test_build_structural_variant(self):
        """
        Test for correct build of structural variant, including
        validation checks, formatting of sub-embedded objects, and
        addition of standard fields.
        """
        builder = StructuralVariantBuilder(None, self.SV_VCF_PARSER, None)
        structural_variant = builder.build_variant(self.RECORD)
        assert "project" in structural_variant
        assert "institution" in structural_variant
        assert structural_variant["status"] == "shared"
        assert structural_variant["transcript"]
        assert 0 not in structural_variant["transcript"]
        assert "last_modified" in structural_variant

    def test_build_structural_variant_sample(self):
        """
        Test for correct build of variant samples, including update of
        samplegeno, formatting of sub-embedded objects, inheritance
        mode calculation, and addition of standard fields.

        Note: sample_relations below should work regardless of contents
        of TEST_SV_VCF as long as <= 3 samples (proband or trio).
        """
        builder = StructuralVariantBuilder(None, self.SV_VCF_PARSER, "some_file")
        structural_variant = builder.build_variant(self.RECORD)
        sample_relations = {
            0: {"samplegeno_role": "proband", "samplegeno_sex": "F"},
            1: {"samplegeno_role": "mother", "samplegeno_sex": "F"},
            2: {"samplegeno_role": "father", "samplegeno_sex": "M"},
        }
        for idx in range(len(self.RECORD.samples)):
            sample = self.RECORD.samples[idx].sample
            if idx in sample_relations:
                sample_relations[sample] = sample_relations[idx]
                del sample_relations[idx]
        structural_variant_samples = builder.build_variant_samples(
            structural_variant, self.RECORD, sample_relations
        )
        sv_sample = structural_variant_samples[0]
        assert sv_sample["file"] == "some_file"
        assert 0 not in sv_sample["samplegeno"]
        assert "genotype_labels" in sv_sample
        assert "inheritance_modes" in sv_sample
        assert sv_sample["callers"] == ["Manta"]
        assert sv_sample["caller_types"] == ["SV"]

    def test_post_or_patch(self, testapp, project, institution):
        """
        Test for POST and PATCH handling for structural variants and
        structural variant samples.
        """
        builder = StructuralVariantBuilder(
            testapp,
            self.SV_VCF_PARSER,
            "some_file",
            project=project["uuid"],
            institution=institution["uuid"],
        )
        structural_variant = builder.build_variant(self.RECORD)
        structural_variant_samples = builder.build_variant_samples(
            structural_variant, self.RECORD, {}
        )
        structural_variant_sample = structural_variant_samples[0]
        for key in ["transcript", "last_modified"]:
            del structural_variant[key]
        for key in ["last_modified"]:
            del structural_variant_sample[key]
        variant_post = builder._post_or_patch_variant(structural_variant)
        variant_uuid = variant_post["@graph"][0]["uuid"]
        variant_display_title = variant_post["@graph"][0]["display_title"]
        builder._post_or_patch_variant_sample(structural_variant_sample, variant_uuid)
        variant_patch = builder._post_or_patch_variant(structural_variant)
        builder._post_or_patch_variant_sample(structural_variant_sample, variant_uuid)
        sample_posted = testapp.get("/structural-variant-samples/").json["@graph"][0]
        assert variant_post["status"] == "success"
        assert variant_patch["status"] == "success"
        assert variant_display_title in sample_posted["display_title"]
