import pytest

@pytest.mark.skip
def test_size_display(testapp, structural_variant):
    """Test size_display for rounding and units."""
    # structural_variant fixture comes with START=1000
    test_ends = [1234, 12345, 1234567, 123456789, 12345678912]
    expected_results = ["235 bp", "11.3 Kb", "1.2 Mb", "123.5 Mb", "12.3 Gb"]
    variant_atid = structural_variant["@id"]
    for end, expected_result in zip(test_ends, expected_results):
        patch_body = {"END": end}
        testapp.patch_json(variant_atid, patch_body, status=200)
        result = testapp.get(variant_atid, status=200).json
        assert result["size_display"] == expected_result

@pytest.fixture
def transcript_ablation(testapp):
    """"""
    consequence = {
        "var_conseq_name": "transcript_ablation",
        "var_conseq_id": "SO:0001893",
    }
    return testapp.post_json("/VariantConsequence", consequence,
    status=201).json["@graph"][0]

@pytest.fixture
def transcript_amplification(testapp):
    """"""
    consequence = {
        "var_conseq_name": "transcript_amplification",
        "var_conseq_id": "SO:0001889",
    }
    return testapp.post_json("/VariantConsequence", consequence,
    status=201).json["@graph"][0]


def test_transcript_breakpoints(testapp, structural_variant, transcript_ablation,
        transcript_amplification):
    """"""
    import pdb; pdb.set_trace()
    variant_atid = structural_variant["@id"]
    patch_body = {"transcript": [{"csq_consequence": [transcript_ablation["uuid"]]}]}
    testapp.patch_json(variant_atid, patch_body, status=200)
    result = testapp.get(structural_variant["@id"] + "?datastore=database").json
    import pdb; pdb.set_trace()
    print("foo")
