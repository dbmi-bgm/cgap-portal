import pytest

from encoded.quick_embed import embed

pytestmark = [pytest.mark.working]

EMBED_URL = "/embed"


@pytest.fixture
def variant_sample_list(testapp, variant_sample, variant_sample_2, genelist, project, institution):
    vs_1 = testapp.post_json("/variant-samples", variant_sample).json["@graph"][0]
    vs_2 = testapp.post_json("/variant-samples", variant_sample_2).json["@graph"][0]
    vs_list = {
        "project": project["@id"],
        "institution": institution["@id"],
        "variant_samples": [
            {"variant_sample_item": vs_1["@id"]},
            {"variant_sample_item": vs_2["@id"]}
        ]
    }
    return testapp.post_json("/variant-sample-lists", vs_list).json["@graph"][0]


def test_interpretation_post(testapp, genelist, variant_sample_list):
    """"""
    vsl_uuid = variant_sample_list["uuid"]
    creation_post_data = {}
    creation_post_headers = {
        "Content-type": "application/json",
        "Accept": "application/json",
    }
    import pdb
    pdb.set_trace()
    vsl_embed_url = testapp.post_json(
        "/embed?uuid=" + vsl_uuid, creation_post_data, headers=creation_post_headers
    ).json[0]
    creation_post_data = {"uuids": [vsl_uuid]}
    vsl_embed_json = testapp.post_json(
        "/embed", creation_post_data, headers=creation_post_headers
    ).json[0]
    vsl_true_embed = testapp.get(variant_sample_list["@id"]).json
    keys_not_embedded = ["@context", "actions", "aggregated-items", "validation-errors"]
    assert vsl_embed_url == vsl_embed_json
    for key, value in vsl_true_embed.items():
        if key not in keys_not_embedded:
            if isinstance(value, dict):
                for keypair in value.items():
                    assert keypair in vsl_embed_url[key].items()
            else:
                assert value == vsl_embed_url[key]
