import re

from dcicutils.misc_utils import ignored
from pyramid.view import view_config
from snovault.util import debug_log

from encoded.types.base import get_item_or_none


ATID_PATTERN = re.compile("/[a-zA-Z-]+/[a-zA-Z0-9-_:]+/")
GENELIST_ATID = re.compile("/gene-lists/[a-zA-Z0-9-]+/")
MINIMAL_EMBEDS = ["projects", "institutions", "users"]
MINIMAL_EMBED_ATID = re.compile("/(" + "|".join(MINIMAL_EMBEDS) + ")/[a-zA-Z0-9-_:]+/")


def includeme(config):
    config.add_route('embed', '/embed')
    config.scan(__name__)


def _minimal_embed(request, item_id):
    """
    Embed minimal item info. Helpful for preventing deep recursions for
    items for which detailed info is commonly not needed.

    :param request:
    :param item_id: string uuid or @id
    :return item_embed: dict with item title and @id
    """
    item_object = get_item_or_none(request, item_id)
    item_title = item_object.get("title", "")
    item_atid = item_object.get("@id", "")
    item_embed = {"title": item_title, "@id": item_atid}
    return item_embed


def _embed_genelist(request, genelist_atid):
    """
    Embed limited gene list information from raw view to avoid costly
    object view of large gene lists.

    :param request:
    :param genelist_atid: string of gene list @id
    :return genelist_embed: dictionary with limited gene list information
    """
    genelist_raw = get_item_or_none(request, genelist_atid, frame="raw")
    title = genelist_raw.get("title", "")
    project_uuid = genelist_raw.get("project")
    project_embed = _minimal_embed(request, project_uuid)
    genelist_embed = {"title": title, "project": project_embed}
    return genelist_embed


def _embed(request, item, depth, embed_props):
    """
    Provide full embedded view of items excluding gene list full embed
    by recursively finding @ids and embedding corresponding object views.
    Stores @id with embedded view in cache should @id come up again, which
    tends to be common with project and institution particularly.

    :param request:
    :param item: object of interest to handle
    :param depth: int of current embed depth
    :param embed_props: dict of embedding properties
    :return item, new_embed: object of interest processed and bool for state of
        newly embedded @id
    """
    new_embed = True
    while new_embed:
        if depth == embed_props["embed_depth"]:
            new_embed = False
        elif isinstance(item, dict) and item:
            for key in item:
                if key in embed_props["ignored_keys"]:
                    new_embed = False
                    continue
                item[key], new_embed = _embed(request, item[key], depth, embed_props)
        elif isinstance(item, list) and item:
            for idx in range(len(item)):
                item[idx], new_embed = _embed(request, item[idx], depth, embed_props)
        elif isinstance(item, str):
            if ATID_PATTERN.match(item):
                if embed_props["desired_embeds"]:
                    if item.split("/")[1] in embed_props["desired_embeds"]:
                        item = get_item_or_none(request, item)
                        depth += 1
                    else:
                        new_embed = False
                else:
                    if item.split("/")[1] in embed_props["ignored_embeds"]:
                        new_embed = False
                    elif item in embed_props["cache"]:
                        item = embed_props["cache"][item]
                        new_embed = False
                    elif GENELIST_ATID.match(item):
                        cache_item = item
                        item = _embed_genelist(request, item)
                        embed_props["cache"][cache_item] = item
                        new_embed = False
                    elif MINIMAL_EMBED_ATID.match(item):
                        cache_item = item
                        item = _minimal_embed(request, item)
                        embed_props["cache"][cache_item] = item
                        new_embed = False
                    else:
                        cache_item = item
                        item = get_item_or_none(request, item)
                        embed_props["cache"][cache_item] = item
                        depth += 1
            else:
                new_embed = False
        else:
            new_embed = False
    return item, new_embed


@view_config(route_name='embed', request_method='POST', permission="admin")
@debug_log
def embed(context, request):
    """
    Custom API to return pseudo-embedded view of object posted to endpoint
    with in url.

    NOTE: Only grabs one level of depth for user, project, and institution
    to prevent infinite recursion.

    :param context:
    :param request:
    :return results: dict containing pseduo-embedded view of item
    """
    ids = []
    ignored_embeds = []
    desired_embeds = []
    cache = {}
    results = []
    depth = 0
    embed_depth = 5  # Arbritary standard depth to search.
    ignored(context)
    ignored_keys = [
        "@id", "@type", "principals_allowed", "uuid", "status", "title",
        "display_title", "schema_version", "date_created"
    ]
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
        "ignored_keys": ignored_keys,
        "ignored_embeds": ignored_embeds,
        "desired_embeds": desired_embeds,
        "embed_depth": embed_depth,
        "cache": cache
    }
    for item_id in ids:
        item_info = get_item_or_none(request, item_id)
        item_result, _ = _embed(request, item_info, depth, embed_props)
        results.append(item_result)
    return results
