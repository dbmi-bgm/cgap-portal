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
 
