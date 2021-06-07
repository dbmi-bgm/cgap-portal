import pytest

from encoded.custom_embed import ATID_PATTERN, MINIMAL_EMBEDS, FORBIDDEN_MSG
from encoded.tests.test_permissions import (
    udn_project, admin_user, udn_user, multi_project_user, no_project_user,
    deleted_user, admin_testapp, udn_user_testapp, multi_project_user_testapp,
    no_project_user_testapp, deleted_user_testapp, simple_doc_item, bwh_institution,
)

pytestmark = [pytest.mark.working]

EMBED_URL = "/embed"
KEYS_NOT_INCLUDED = ["@context", "actions", "aggregated-items", "validation-errors"]


@pytest.fixture
def variant_sample_list(
    testapp, variant_sample, variant_sample_2, genelist, project, institution
):
    vs_1 = testapp.post_json("/variant-samples", variant_sample).json["@graph"][0]
    vs_2 = testapp.post_json("/variant-samples", variant_sample_2).json["@graph"][0]
    vs_list = {
        "project": project["@id"],
        "institution": institution["@id"],
        "variant_samples": [
            {"variant_sample_item": vs_1["@id"]},
            {"variant_sample_item": vs_2["@id"]},
        ],
    }
    return testapp.post_json("/variant-sample-lists", vs_list).json["@graph"][0]


def _embed_with_url_params(testapp, embed_string, status="*"):
    """POST to embed endpoint with url parameters."""
    creation_post_data = {}
    creation_post_headers = {
        "Content-type": "application/json",
        "Accept": "application/json",
    }
    response = testapp.post_json(
        embed_string, creation_post_data, headers=creation_post_headers, status=status
    ).json
    if isinstance(response, list):
        response = response[0]
    return response


def _embed_with_json_params(testapp, embed_json, status="*"):
    """POST to embed endpoint with json parameters."""
    creation_post_data = embed_json
    creation_post_headers = {
        "Content-type": "application/json",
        "Accept": "application/json",
    }
    response = testapp.post_json(
        EMBED_URL, creation_post_data, headers=creation_post_headers, status=status
    ).json
    if isinstance(response, list):
        response = response[0]
    return response


def _convert_atid_to_key(atid_name_list):
    """Removes last letter from all strings in list."""
    key_name_list = [atid_name[:-1] for atid_name in atid_name_list]
    return key_name_list


def _contains_atid(item):
    """Returns bool for presence of @id in item."""
    result = False
    if isinstance(item, dict):
        for value in item.values():
            result = _contains_atid(value)
            if result:
                break
    elif isinstance(item, list):
        for list_item in item:
            result = _contains_atid(list_item)
            if result:
                break
    elif isinstance(item, str):
        if ATID_PATTERN.match(item):
            result = True
    return result


class TestCustomEmbed:
    def test_post_methods(self, testapp, variant_sample_list):
        """
        Ensure equal results by posting to endpoint with item ID in URL
        or in json body.
        """
        vsl_uuid = variant_sample_list["uuid"]
        vsl_embed_url = _embed_with_url_params(testapp, EMBED_URL + "?id=" + vsl_uuid)
        json_to_post = {"ids": [vsl_uuid]}
        vsl_embed_json = _embed_with_json_params(testapp, json_to_post)
        assert vsl_embed_url == vsl_embed_json

    def test_depth_of_zero(self, testapp, variant_sample_list):
        """Test request with depth=0 returns @@object view of item."""
        vsl_uuid = variant_sample_list["uuid"]
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&depth=0"
        vsl_embed = _embed_with_url_params(testapp, url_params)
        for key, value in variant_sample_list.items():
            if key not in KEYS_NOT_INCLUDED:
                assert value == vsl_embed[key]

    def test_desired_keys(self, testapp, variant_sample_list):
        """Test embedding only requested 'desired' keys."""
        vsl_uuid = variant_sample_list["uuid"]
        vsl_atid = variant_sample_list["@id"]
        vsl_true = testapp.get(vsl_atid).json
        desired = ["projects"]
        desired_addon = "&desired=".join(desired)
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&depth=1&desired=" + desired_addon
        vsl_embed_url = _embed_with_url_params(testapp, url_params)
        json_to_post = {"ids": [vsl_uuid], "depth": 1, "desired": desired}
        vsl_embed_json = _embed_with_json_params(testapp, json_to_post)
        desired_keys = _convert_atid_to_key(desired)
        assert vsl_embed_url == vsl_embed_json
        for item in desired_keys:
            for key, value in vsl_true[item].items():
                if key not in KEYS_NOT_INCLUDED:
                    assert value == vsl_embed_url[item][key]
        for key, value in variant_sample_list.items():
            if key not in desired_keys:
                assert value == vsl_embed_url[key]

    def test_ignored_keys(self, testapp, variant_sample_list):
        """Test embedding all keys except requested 'ignored' keys."""
        vsl_uuid = variant_sample_list["uuid"]
        ignored = ["projects"]
        ignored_keys = _convert_atid_to_key(ignored)
        ignored_addon = "&ignored=".join(ignored)
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&depth=1&ignored=" + ignored_addon
        vsl_embed_url = _embed_with_url_params(testapp, url_params)
        json_to_post = {"ids": [vsl_uuid], "depth": 1, "ignored": ignored}
        vsl_embed_json = _embed_with_json_params(testapp, json_to_post)
        assert vsl_embed_url == vsl_embed_json
        for key, value in variant_sample_list.items():
            if key in ignored_keys:
                assert value == vsl_embed_url[key]
            elif key == "@id":
                continue
            elif _contains_atid(value):
                assert vsl_embed_url[key] != value

    def test_minimal_embeds(self, testapp, variant_sample_list):
        """Test default minimal embedding settings work as intended."""
        vsl_uuid = variant_sample_list["uuid"]
        url_params = EMBED_URL + "?id=" + vsl_uuid
        vsl_embed_url = _embed_with_url_params(testapp, url_params)
        minimal_embeds = _convert_atid_to_key(MINIMAL_EMBEDS)
        for key in minimal_embeds:
            if key in vsl_embed_url:
                assert "@id" in vsl_embed_url[key]
                assert "title" in vsl_embed_url[key]

    def test_authenticated_permissions(
        self, deleted_user_testapp, anontestapp, variant_sample_list
    ):
        """Test non-authenticated users cannot POST to API."""
        vsl_uuid = variant_sample_list["uuid"]
        url_params = EMBED_URL + "?id=" + vsl_uuid
        anon_embed = _embed_with_url_params(anontestapp, url_params, status=404)
        deleted_user_embed = _embed_with_url_params(
            deleted_user_testapp, url_params, status=404
        )
        assert anon_embed["status"] == "error"
        assert deleted_user_embed["status"] == "error"

    def test_non_project_user(self, bgm_user_testapp, variant_sample_list):
        """
        Test user from different project cannot call for embed if item
        not accessible (e.g. different project and not "shared").
        API will return None for such a call.
        """
        vsl_uuid = variant_sample_list["uuid"]
        url_params = EMBED_URL + "?id=" + vsl_uuid
        vsl_embed_url = _embed_with_url_params(bgm_user_testapp, url_params)
        assert not vsl_embed_url

    def test_non_project_user_shared_item(
        self, testapp, bgm_user_testapp, variant_sample_list
    ):
        """
        Test user from different project can call for embed if item is
        accessible (e.g. "shared" status) but embedded items that are not
        accessible (e.g. different project and not "shared") are not shown
        within the returned item.
        """
        vsl_uuid = variant_sample_list["uuid"]
        vsl_atid = variant_sample_list["@id"]
        testapp.patch_json(vsl_atid, {"status": "shared"})
        url_params = EMBED_URL + "?id=" + vsl_uuid
        bgm_vsl_embed_url = _embed_with_url_params(bgm_user_testapp, url_params)
        admin_vsl_embed_url = _embed_with_url_params(testapp, url_params)
        for key in admin_vsl_embed_url:
            assert key in bgm_vsl_embed_url
        for variant_sample in bgm_vsl_embed_url["variant_samples"]:
            assert variant_sample["variant_sample_item"] == FORBIDDEN_MSG

    def test_too_many_items(self, testapp, variant_sample_list):
        """Test POST with >5 item IDs results in bad request error."""
        ids = []
        ids.append(variant_sample_list["uuid"])
        ids.append(variant_sample_list["project"])
        ids.append(variant_sample_list["institution"])
        variant_sample_atids = [
            item["variant_sample_item"]
            for item in variant_sample_list["variant_samples"]
        ]
        ids += variant_sample_atids
        variants_atid = [
            variant["@id"] for variant in testapp.get("/variants/").json["@graph"]
        ]
        ids += variants_atid
        json_to_post = {"ids": ids, "depth": 1}
        embed_json = _embed_with_json_params(testapp, json_to_post, status=400)
        assert embed_json["status"] == "error"
