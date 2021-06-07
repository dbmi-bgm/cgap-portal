import re
from uuid import UUID

from dcicutils.misc_utils import ignored
from pyramid.httpexceptions import HTTPBadRequest, HTTPForbidden
from pyramid.security import Authenticated
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
]
FORBIDDEN_MSG = {"error": "no view permissions"}


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
        self.cache = embed_props["cache"]
        depth = -1
        self.result = self.embed(item, depth)

    def _user_embed(self, item_id, depth, frame="object"):
        """
        Use request's embed method to find given item in the database for
        the given frame. If the user who made the call to the API does
        not have permissions to view the item, the item will not be embedded.
        Instead, if the item is the initial ID given to the API, nothing is
        embedded; if the item is to be embedded at a subsequent depth, a
        message stating the item cannot be embedded is inserted instead.

        :param item_id: string uuid or @id
        :param depth: int of current embedding depth
        :param frame: string view to generate of item
        :return item: object to return for embedding
        """
        item = None
        if not item_id.startswith("/"):
            item_id = "/" + item_id
        try:
            item = self.request.embed(item_id, "@@" + frame, as_user=True)
        except HTTPForbidden:
            if depth != -1:
                item = FORBIDDEN_MSG
        except KeyError:
            raise HTTPBadRequest("The item with ID %s could not be found." % item_id)
        return item

    def _minimal_embed(self, item_id, depth):
        """
        Embed minimal item info. Helpful for preventing recursions for
        items for which detailed info is commonly not needed.

        :param item_id: string uuid or @id
        :param depth: int of current embedding depth
        :return item_embed: dict with item title and @id
        """
        item_object = self._user_embed(item_id, depth)
        if isinstance(item_object, str):
            item_embed = item_object
        else:
            item_title = item_object.get("title", "")
            item_atid = item_object.get("@id", "")
            item_embed = {"title": item_title, "@id": item_atid}
        return item_embed

    def _embed_genelist(self, genelist_atid, depth):
        """
        Embed limited gene list information from raw view to avoid costly
        object view of large gene lists.

        :param genelist_atid: string of gene list @id
        :param depth: int of current embedding depth
        :return genelist_embed: dict with gene list title and uuid
        """
        genelist_raw = self._user_embed(genelist_atid, depth, frame="raw")
        if isinstance(genelist_raw, str):
            genelist_embed = genelist_raw
        else:
            title = genelist_raw.get("title", "")
            uuid = genelist_raw.get("uuid", "")
            genelist_embed = {"title": title, "uuid": uuid}
        return genelist_embed

    @staticmethod
    def _valid_uuid(uuid_to_test, version=4):
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
                    if self.desired_embeds:
                        if item.split("/")[1] in self.desired_embeds:
                            if item in self.cache:
                                item = self.cache[item]
                                depth += 1
                            else:
                                cache_item = item
                                item = self._user_embed(item, depth)
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
                            cache_item = item
                            item = self._embed_genelist(item, depth)
                            self.cache[cache_item] = item
                            break
                        elif MINIMAL_EMBED_ATID.match(item):
                            cache_item = item
                            item = self._minimal_embed(item, depth)
                            self.cache[cache_item] = item
                            break
                        else:
                            cache_item = item
                            item = self._user_embed(item, depth)
                            self.cache[cache_item] = item
                            depth += 1
                elif self._valid_uuid(item):
                    item = self._user_embed(item, depth)
                    depth += 1
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
    :return results: dict containing custom-embedded view of item
    """
    ids = []
    ignored_embeds = []
    desired_embeds = []
    cache = {}
    results = []
    embed_depth = 4  # Arbritary standard depth to search.
    ignored(context)
    if request.GET:
        ids += request.GET.dict_of_lists().get("id", [])
        embed_depth = int(request.GET.get("depth", embed_depth))
        ignored_embeds += request.GET.dict_of_lists().get("ignored", [])
        desired_embeds += request.GET.dict_of_lists().get("desired", [])
    elif request.json:
        ids += request.json.get("ids", [])
        ignored_embeds = request.json.get("ignored", [])
        desired_embeds = request.json.get("desired", [])
        embed_depth = request.json.get("depth", embed_depth)
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
        "cache": cache,
    }
    for item_id in ids:
        item_embed = CustomEmbed(request, item_id, embed_props)
        results.append(item_embed.result)
    item_ids_not_found = [item for item in results if isinstance(item, str)]
    if item_ids_not_found:
        raise HTTPBadRequest("One of the item IDs was not valid.")
    return results
