import pytest

from encoded.custom_embed import ATID_PATTERN, MINIMAL_EMBEDS, FORBIDDEN_MSG
from encoded.tests.test_permissions import (
    deleted_user, deleted_user_testapp, bwh_institution
)

pytestmark = [pytest.mark.working]

EMBED_URL = "/embed"
KEYS_NOT_INCLUDED = ["@context", "actions", "aggregated-items", "validation-errors"]


def _embed_with_url_params(testapp, embed_string, status=200):
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
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&ignored=variant-sample-lists"
        vsl_embed_url = _embed_with_url_params(testapp, url_params)
        json_to_post = {"ids": [vsl_uuid], "ignored": ["variant-sample-lists"]}
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
        ignored = ["projects", "variant-sample-lists"]
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
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&ignored=variant-sample-lists"
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
        testapp.patch_json(vsl_atid, {"status": "shared"}, status=200)
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&ignored=variant-sample-lists"
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

    def test_no_items(self, testapp):
        """Test POST with no ID info results in bad request."""
        api_call = _embed_with_url_params(testapp, EMBED_URL, status=400)
        assert api_call["status"] == "error"

    def test_invalid_item_id(self, testapp):
        """Test call to API with invalid uuid or @id results in bad request."""
        nonexistent_uuid = "c1649409-9cb5-4887-8dde-e72feca80059"
        nonexistent_atid = "/projects/not-a-real-project/"
        not_uuid_or_atid = "dog"
        bad_ids = [nonexistent_uuid, nonexistent_atid, not_uuid_or_atid]
        for item_id in bad_ids:
            url_params = EMBED_URL + "?id=" + item_id
            api_call = _embed_with_url_params(testapp, url_params, status=400)
            assert api_call["status"] == "error"
        url_params = EMBED_URL + "?id=" + "&id=".join(bad_ids)
        api_call = _embed_with_url_params(testapp, url_params, status=400)
        assert api_call["status"] == "error"
        for item_id in bad_ids:
            assert item_id in api_call["detail"]

    def test_actions_field(self, testapp, bgm_user_testapp, variant_sample_list):
        """
        Test "actions" field embedded identically to that of a GET request
        for an item.
        """
        vsl_uuid = variant_sample_list["uuid"]
        vsl_atid = variant_sample_list["@id"]
        testapp.patch_json(vsl_atid, {"status": "shared"}, status=200)
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&ignored=variant-sample-lists"
        bgm_vsl_embed_url = _embed_with_url_params(bgm_user_testapp, url_params)
        admin_vsl_embed_url = _embed_with_url_params(testapp, url_params)
        bgm_embedded = bgm_user_testapp.get(vsl_atid).json
        admin_embedded = testapp.get(vsl_atid).json
        assert bgm_vsl_embed_url["actions"] != admin_vsl_embed_url["actions"]
        assert bgm_embedded["actions"] == bgm_vsl_embed_url["actions"]
        assert len(admin_embedded["actions"]) == len(admin_vsl_embed_url["actions"])
        for action in admin_embedded["actions"]:
            assert action in admin_vsl_embed_url["actions"]

    def test_field_embed(self, testapp, variant_sample_list):
        """
        Test POSTs with requested fields return equivalent information for
        URL query and JSON. Also, ensure "*" wildcard working appropriately
        and embedded fields are in fact present.
        """
        vsl_uuid = variant_sample_list["uuid"]
        vsl_atid = variant_sample_list["@id"]
        fields = [
            "variant_samples.variant_sample_item.variant.display_title",
            "*",
        ]
        url_params = EMBED_URL + "?id=" + vsl_uuid + "&field=" + "&field=".join(fields)
        json_params = {"ids": [vsl_uuid], "fields": fields}
        vsl_embed_url = _embed_with_url_params(testapp, url_params)
        vsl_embed_json = _embed_with_json_params(testapp, json_params)
        vsl_object = testapp.get(vsl_atid + "?frame=object", status=200).json
        assert vsl_embed_url == vsl_embed_json
        for key, value in vsl_object.items():
            if key in ["variant_samples", "actions"]:
                continue
            assert vsl_embed_url[key] == value
        for variant_sample in vsl_embed_url["variant_samples"]:
            variant = variant_sample["variant_sample_item"]["variant"]
            assert len(variant.keys()) == 1
            assert "display_title" in variant.keys()

    def test_field_embed_actions(self, testapp, variant_sample_list):
        """
        Test that "actions" correctly added to dict of requested item ID.
        Also, test that if "actions" is requested for an embedded field
        that is not a CGAP item, an HTTPBadRequest error is raised.
        """
        vsl_uuid = variant_sample_list["uuid"]
        vsl_atid = variant_sample_list["@id"]
        fields = ["variant_samples.variant_sample_item.actions"]
        json_params = {"ids": [vsl_uuid], "fields": fields}
        vsl_embed_json = _embed_with_json_params(testapp, json_params)
        vsl_embedded = testapp.get(vsl_atid).json
        num_actions = len(vsl_embedded["actions"])
        assert "actions" in vsl_embed_json
        assert len(vsl_embed_json["actions"]) == num_actions
        for variant_sample in vsl_embed_json["variant_samples"]:
            assert "actions" in variant_sample["variant_sample_item"]
            assert len(variant_sample["variant_sample_item"]["actions"]) == num_actions

        fields = ["variant_samples.actions"]
        json_params = {"ids": [vsl_uuid], "fields": fields}
        assert _embed_with_json_params(testapp, json_params, status=400)

    def test_field_embed_wrong_field(self, testapp, variant_sample_list):
        """
        Test that no error thrown if requested field does not exist in
        item. Rather, the "closest" existing upstream field should be embedded
        with empty fields.
        """
        vsl_uuid = variant_sample_list["uuid"]
        fields = ["variant_samples.some_field.another_field"]
        json_params = {"ids": [vsl_uuid], "fields": fields}
        vsl_embed_json = _embed_with_json_params(testapp, json_params, status=200)
        for field in vsl_embed_json["variant_samples"]:
            assert not field

    def test_field_embed_permissions(
        self, testapp, bgm_user_testapp, variant_sample_list
    ):
        """
        Test for accurate permissions handling for field embeddings.
        Items to which the user does not have access should be embedded
        with the forbidden message and no downstream fields should be
        embedded within.
        """
        vsl_atid = variant_sample_list["@id"]
        testapp.patch_json(vsl_atid, {"status": "shared"}, status=200)
        fields = [
            "variant_samples.variant_sample_item.variant.display_title",
            "*"
        ]
        json_params = {"ids": [vsl_atid], "fields": fields}
        admin_embed = _embed_with_json_params(testapp, json_params)
        bgm_embed = _embed_with_json_params(bgm_user_testapp, json_params)
        bgm_variant_samples = bgm_embed["variant_samples"]
        for key, value in admin_embed.items():
            if key not in ["variant_samples", "actions"]:
                assert bgm_embed[key] == value
        for variant_sample in bgm_variant_samples:
            assert variant_sample["variant_sample_item"] == FORBIDDEN_MSG
