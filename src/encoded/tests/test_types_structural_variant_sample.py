import pytest

SV_URL = "/structural_variant"
SV_SAMPLE_URL = "/structural_variant_sample"


@pytest.fixture
def x_structural_variant(testapp, project, institution):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "CHROM": "X",
        "START": 1000,
        "END": 2000,
        "SV_TYPE": "DUP",
    }
    return testapp.post_json(SV_URL, item, status=201).json["@graph"][0]


@pytest.fixture
def mito_structural_variant(testapp, project, institution):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "CHROM": "M",
        "START": 112000,
        "END": 236000,
        "SV_TYPE": "DEL",
    }
    return testapp.post_json(SV_URL, item, status=201).json["@graph"][0]


@pytest.fixture
def x_structural_variant_sample(testapp, project, institution, x_structural_variant):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "structural_variant": x_structural_variant["@id"],
        "CALL_INFO": "some_sample",
        "file": "some_vcf_file",
        "inheritance_modes": ["Dominant (maternal)"],
    }
    return testapp.post_json(SV_SAMPLE_URL, item, status=201).json["@graph"][0]


def test_structural_variant_sample_inheritance(x_structural_variant_sample):
    """Test proband-only inheritance mode calc prop."""
    assert x_structural_variant_sample["proband_only_inheritance_modes"] == ["X-linked"]


def test_associated_genotype_labels(
    testapp, mito_structural_variant, structural_variant_sample
):
    """Ensure associated_genotype_labels calcprop built correctly."""
    # Imitate trio + alien member (not a possible genotype label field)
    structural_variant_sample["samplegeno"] = [
        {
            "samplegeno_sex": "F",
            "samplegeno_role": "proband",
            "samplegeno_numgt": "0/1",
        },
        {"samplegeno_sex": "F", "samplegeno_role": "mother", "samplegeno_numgt": "0/1"},
        {"samplegeno_sex": "F", "samplegeno_role": "father", "samplegeno_numgt": "0/0"},
        {"samplegeno_sex": "F", "samplegeno_role": "alien", "samplegeno_numgt": "0/0"},
    ]
    genotype_labels = [
        {"role": "proband", "labels": ["Heterozygous"]},
        {"role": "mother", "labels": ["Heterozygous"]},
        {"role": "father", "labels": ["Homozygous reference"]},
        {"role": "alien", "labels": ["Homozygous reference"]},
    ]
    structural_variant_sample["genotype_labels"] = genotype_labels
    sample_post = testapp.post_json(
        SV_SAMPLE_URL, structural_variant_sample, status=201
    ).json["@graph"][0]
    associated_labels = sample_post["associated_genotype_labels"]
    assert len(associated_labels) == 3
    for label in genotype_labels[:2]:
        key = label["role"] + "_genotype_label"
        [value] = label["labels"]
        assert associated_labels[key] == value

    # No associated_genotype_labels if mitochondrial variant
    patch_body = {"structural_variant": mito_structural_variant["@id"]}
    sample_patch = testapp.patch_json(sample_post["@id"], patch_body, status=200).json
    assert "associated_genotype_labels" not in sample_patch
