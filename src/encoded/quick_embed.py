import re

from dcicutils.misc_utils import ignored
from pyramid.view import view_config
from snovault.util import debug_log

from encoded.types.base import get_item_or_none

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
        depth = 0
        self.result = self.embed(item, depth)

    def _minimal_embed(self, item_id):
        """
        Embed minimal item info. Helpful for preventing recursions for
        items for which detailed info is commonly not needed.

        :param item_id: string uuid or @id
        :return item_embed: dict with item title and @id
        """
        item_object = get_item_or_none(self.request, item_id)
        item_title = item_object.get("title", "")
        item_atid = item_object.get("@id", "")
        item_embed = {"title": item_title, "@id": item_atid}
        return item_embed

    def _embed_genelist(self, genelist_atid):
        """
        Embed limited gene list information from raw view to avoid costly
        object view of large gene lists.

        :param genelist_atid: string of gene list @id
        :return genelist_embed: dict with gene list title and uuid
        """
        genelist_raw = get_item_or_none(self.request, genelist_atid, frame="raw")
        title = genelist_raw.get("title", "")
        uuid = genelist_raw.get("uuid", "")
        genelist_embed = {"title": title, "uuid": uuid}
        return genelist_embed

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
                                item = get_item_or_none(self.request, item)
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
                            item = self._embed_genelist(item)
                            self.cache[cache_item] = item
                            break
                        elif MINIMAL_EMBED_ATID.match(item):
                            cache_item = item
                            item = self._minimal_embed(item)
                            self.cache[cache_item] = item
                            break
                        else:
                            cache_item = item
                            item = get_item_or_none(self.request, item)
                            self.cache[cache_item] = item
                            depth += 1
                else:
                    break
            else:
                break
        return item


@view_config(route_name="embed", request_method="POST", permission="view")
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
    embed_props = {
        "ignored_embeds": ignored_embeds,
        "desired_embeds": desired_embeds,
        "embed_depth": embed_depth,
        "cache": cache,
    }
    for item_id in ids:
        item_info = get_item_or_none(request, item_id)
        item_embed = CustomEmbed(request, item_info, embed_props)
        item_result = item_embed.result
        results.append(item_result)
    return results
