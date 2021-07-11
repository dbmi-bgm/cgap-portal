import re
from uuid import UUID

from dcicutils.misc_utils import ignored
from pyramid.httpexceptions import HTTPBadRequest, HTTPForbidden
from pyramid.security import Authenticated
from pyramid.traversal import find_resource
from pyramid.view import view_config
from snovault.util import debug_log

ATID_PATTERN = re.compile("/[a-zA-Z-]+/[a-zA-Z0-9-_:]+/")
GENELIST_ATID = re.compile("/gene-lists/[a-zA-Z0-9-]+/")
MINIMAL_EMBEDS = ["projects", "institutions", "users"]
MINIMAL_EMBED_ATID = re.compile("/(" + "|".join(MINIMAL_EMBEDS) + ")/[a-zA-Z0-9-_:]+/")
KEYS_TO_IGNORE = [
    "@id",
    "@type",
    "principals_allowed",
    "uuid",
    "status",
    "title",
    "display_title",
    "schema_version",
    "date_created",
    "actions",
]
FORBIDDEN_MSG = {"error": "no view permissions"}
DATABASE_ITEM_KEY = "@type"  #Key specific to JSON objects that are CGAP items


def includeme(config):
    config.add_route("embed", "/embed")
    config.scan(__name__)


class CustomEmbed:
    """
    Class to handle custom embedding for /embed API.
    """

    def __init__(self, request, item, embed_props):
        self.request = request
        self.ignored_embeds = embed_props["ignored_embeds"]
        self.desired_embeds = embed_props["desired_embeds"]
        self.embed_depth = embed_props["embed_depth"]
        self.requested_fields = embed_props["requested_fields"]
        self.cache = {}
        self.invalid_ids = []
        if self.requested_fields:
            self.nested_fields = self.fields_to_nested_dict()
            item = self.user_embed(item, initial_item=True)
            self.result = self.field_embed(item, self.nested_fields, initial_item=True)
        else:
            depth = -1
            self.result = self.embed(item, depth)

    def add_actions(self, item):
        """
        Add the "actions" field to an item according to the request's
        permissions, formatted identically to the calc props on items
        for a GET page view.

        :param item: dict item in object view
        :return item: dict item in object view with "actions"
        """
        actions = []
        root_resource = self.request.root
        item_path = item["@id"]
        item_resource = find_resource(root_resource, item_path)
        for action in ["edit", "create"]:
            if self.request.has_permission(action, item_resource):
                actions.append({
                    "name": action,
                    "title": action.capitalize(),
                    "profile": "/profiles/%s.json" % item_resource.type_info.name,
                    "href": "%s?currentAction=%s" % (
                        self.request.resource_path(item_resource), action
                    )
                })
        item["actions"] = actions
        return item

    def user_embed(self, item_id, initial_item=False):
        """
        Use request's embed method to find given item in the database.
        
        If the user who made the call to the API does not have 
        permissions to view the item, the item will not be embedded.
        Instead, if the item is the initial ID given to the API, nothing is
        embedded; if the item is to be embedded at a subsequent depth, a
        message stating the item cannot be embedded is inserted instead.

        Additionally, if the given ID is the initial item to embed, add
        "actions" if item embedded.

        :param item_id: string uuid or @id
        :param initial_item: bool indicative of embedding initial item ID
        :return item: object to return for embedding
        """
        item = None
        given_id = item_id
        if not item_id.startswith("/"):
            item_id = "/" + item_id
        try:
            item = self.request.embed(item_id, "@@object", as_user=True)
        except HTTPForbidden:
            if not initial_item:
                item = FORBIDDEN_MSG
        except KeyError:
            self.invalid_ids.append(given_id)
        if item and initial_item:
            item = self.add_actions(item)
        return item

    def minimal_embed(self, item_id):
        """
        Embed minimal item info. Helpful for preventing recursions for
        items for which detailed info is commonly not needed.

        :param item_id: string uuid or @id
        :return item_embed: dict with item title and @id
        """
        item_object = self.user_embed(item_id)
        if item_object == FORBIDDEN_MSG:
            item_embed = item_object
        elif isinstance(item_object, dict):
            item_title = item_object.get("title", "")
            item_atid = item_object.get("@id", "")
            item_embed = {"title": item_title, "@id": item_atid}
        else:
            item_embed = item_object
        return item_embed

    @staticmethod
    def is_uuid(uuid_to_test, version=4):
        """
        Determine if given string is a valid uuid.

        :param uuid_to_test: string to check
        :param version: int for uuid version
        :return: bool if given string is valid uuid
        """
        try:
            uuid_obj = UUID(uuid_to_test, version=version)
        except ValueError:
            return False
        return str(uuid_obj) == uuid_to_test

    def embed(self, item, depth):
        """
        Embed items recursively according to input parameters. Unpack
        dictionaries and lists to find @ids, which are selectively embedded,
        typically in object view. Store new embeds in cache for look-up.

        :param item: object of interest to expand
        :param depth: int of current embed depth
        :return item: object of interest processed
        """
        while True:
            if depth == self.embed_depth:
                break
            elif isinstance(item, dict) and item:
                for key in item:
                    if key in KEYS_TO_IGNORE:
                        continue
                    item[key] = self.embed(item[key], depth)
                break
            elif isinstance(item, list) and item:
                for idx in range(len(item)):
                    item[idx] = self.embed(item[idx], depth)
                break
            elif isinstance(item, str):
                if ATID_PATTERN.match(item):
                    if depth == -1:
                        cache_item = item
                        item = self.user_embed(item, initial_item=True)
                        self.cache[cache_item] = item
                        depth += 1
                    elif self.desired_embeds:
                        if item.split("/")[1] in self.desired_embeds:
                            if item in self.cache:
                                item = self.cache[item]
                                depth += 1
                            else:
                                cache_item = item
                                item = self.user_embed(item)
                                self.cache[cache_item] = item
                                depth += 1
                        else:
                            break
                    else:
                        if item.split("/")[1] in self.ignored_embeds:
                            break
                        elif item in self.cache:
                            item = self.cache[item]
                            depth += 1
                        elif GENELIST_ATID.match(item):
                            # NOTE: Non-admins forbidden for raw view, so just skip
                            # attempt to embed gene lists for default settings.
                            break
                        elif MINIMAL_EMBED_ATID.match(item):
                            cache_item = item
                            item = self.minimal_embed(item)
                            self.cache[cache_item] = item
                            break
                        else:
                            cache_item = item
                            item = self.user_embed(item)
                            self.cache[cache_item] = item
                            depth += 1
                elif self.is_uuid(item) and depth == -1:
                    item = self.user_embed(item, initial_item=True)
                    depth += 1
                else:
                    break
            else:
                break
        return item

    def fields_to_nested_dict(self):
        """
        Convert list of requested fields into nested dictionary. Each
        nested dictionary contains keys whose values are sub-dictionaries
        to embed as well as a "fields_to_keep" key whose values are the
        terminal fields requested.

        For example, if the requested fields are:
            'variant.gene.title'
            'variant.*'
        the resulting nested dict will be:

        {
            "variant": {
                "gene": {"fields_to_keep": ["title"]},
                "fields_to_keep": ["*"]
            }
        }

        :return field_dict: nested dict of requested fields
        """
        field_dict = {}
        for field in self.requested_fields:
            field_keys = field.split(".")
            field_keys = [x for x in field_keys if x]
            field_dict = self.build_nested_dict(field_dict, field_keys)
        return field_dict

    def build_nested_dict(self, field_dict, field_keys):
        """
        Recursively builds a nested dict for each requested field by
        iterating through the keys of the requested field, adding
        the keys if not present and building a nested dict for the
        remaining keys. The terminal key of the requested field always
        corresponds to a field of an embedded item that should be included
        in the embedding.

        :param field_dict: existing dict of requested fields
        :param field_keys: list of keys of a requested field
        :return field_dict: existing dict updated with new field_keys
        """
        key = field_keys[0]
        if key == field_keys[-1]:
            if "fields_to_keep" in field_dict:
                field_dict["fields_to_keep"].append(key)
            else:
                field_dict["fields_to_keep"] = [key]
            return field_dict
        if key not in field_dict:
            field_dict[key] = {}
        field_keys = field_keys[1:]
        field_dict[key] = self.build_nested_dict(field_dict[key], field_keys)
        return field_dict

    def field_embed(self, item, field_dict, initial_item=False):
        """
        Embed items recursively according to requested fields. Follows
        keys of the nested dict of requested fields, unpacking dictionaries
        and lists and embedding @ids as required to reach the terminal
        requested fields.

        :param item: object of interest to expand
        :param field_dict: nested dict of requested fields
        :param initial_item: bool indicative of embedding initial item ID
        :return item: object of interest processed
        """
        while True:
            if isinstance(item, dict):
                if item == FORBIDDEN_MSG:
                    break
                fields_to_keep = []
                for key in field_dict:
                    if key == "fields_to_keep":
                        fields_to_keep += field_dict[key]
                        continue
                    if key not in item:
                        item_type = item.get("@type", ["given"])[0]
                        raise HTTPBadRequest(
                            "Could not find the requested field '%s' within the"
                            " %s item."
                            % (key, item_type)
                        )
                    fields_to_keep.append(key)
                    item[key] = self.field_embed(item[key], field_dict[key])
                if initial_item:
                    fields_to_keep.append("actions")
                if "*" not in fields_to_keep:
                    if "actions" in fields_to_keep and not initial_item:
                        if DATABASE_ITEM_KEY in item:
                            item = self.add_actions(item)
                        else:
                            raise HTTPBadRequest(
                                "The 'actions' field was requested for a JSON object"
                                " that is not a database item."
                            )
                    culled_item = {}
                    for field in fields_to_keep:
                        try:
                            culled_item[field] = item[field]
                        except KeyError:
                            continue
                    item = culled_item
                break
            if isinstance(item, list):
                for idx in range(len(item)):
                    item[idx] = self.field_embed(item[idx], field_dict)
                break
            elif isinstance(item, str):
                if ATID_PATTERN.match(item):
                    if item in self.cache:
                        item = self.cache[item]
                    else:
                        cache_item = item
                        item = self.user_embed(item)
                        self.cache[cache_item] = item
                else:
                    break
            else:
                break
        return item


@view_config(
    route_name="embed", request_method="POST", effective_principals=Authenticated
)
@debug_log
def embed(context, request):
    """
    API to return custom-embedded view of object posted to endpoint. If no
    parameters provided, attempt to return object with embedding done
    per default parameters.

    :param context: pyramid request context
    :param request: pyramid request object
    :return results: list of dicts of custom-embedded views of items
    """
    ids = []
    ignored_embeds = []
    desired_embeds = []
    cache = {}
    requested_fields = []
    results = []
    invalid_ids = []
    embed_depth = 4  # Arbritary standard depth to search.
    ignored(context)
    if request.GET:
        ids += request.GET.dict_of_lists().get("id", [])
        embed_depth = int(request.GET.get("depth", embed_depth))
        ignored_embeds += request.GET.dict_of_lists().get("ignored", [])
        desired_embeds += request.GET.dict_of_lists().get("desired", [])
        requested_fields += request.GET.dict_of_lists().get("field", [])
    elif request.json:
        ids += request.json.get("ids", [])
        ignored_embeds = request.json.get("ignored", [])
        desired_embeds = request.json.get("desired", [])
        embed_depth = request.json.get("depth", embed_depth)
        requested_fields = request.json.get("fields", [])
    ids = list(set(ids))
    if len(ids) > 5:
        raise HTTPBadRequest(
            "Too many items were given for embedding."
            " Please limit to less than 5 items."
        )
    if not ids:
        raise HTTPBadRequest("No item identifier was provided.")
    embed_props = {
        "ignored_embeds": ignored_embeds,
        "desired_embeds": desired_embeds,
        "embed_depth": embed_depth,
        "requested_fields": requested_fields,
    }
    for item_id in ids:
        item_embed = CustomEmbed(request, item_id, embed_props)
        results.append(item_embed.result)
        invalid_ids += item_embed.invalid_ids
    invalid_ids += [item for item in results if isinstance(item, str)]
    if invalid_ids:
        raise HTTPBadRequest(
            "The following IDs were invalid: %s." % ", ".join(invalid_ids)
        )
    return results
