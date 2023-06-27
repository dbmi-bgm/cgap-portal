# utility functions
import os
import re
import structlog
from .types.base import get_item_or_none
from snovault.util import (  # noqa: F401 (imported but unused)
    build_s3_presigned_get_url,
    check_user_is_logged_in,
    convert_integer_to_comma_string,
    deduplicate_list,
    debuglog,
    DEBUGLOG,
    get_trusted_email,
    gunzip_content,
    make_s3_client,
    make_vapp_for_email,
    resolve_file_path as snovault_resolve_file_path,
    s3_local_file,
    SettingsKey,
    vapp_for_email
)
from snovault.embed import (  # noqa: F401 (imported but unused)
    subrequest_item_creation
)

# These are now moved or reused from snovault.utils (May 2023):
# - CONTENT_TYPE_SPECIAL_CASES
# - register_path_content_type
# - content_type_allowed
# - gunzip_content
# - deduplicate_list
# - debuglog
# - make_vapp_for_email
# - vapp_for_email
# - make_vapp_for_ingestion
# - vapp_for_ingestion
# - _app_from_clues
# - make_s3_client
# - build_s3_presigned_get_url
# - convert_integer_to_comma_string
# - ENCODED_ROOT_DIR
# - resolve_file_path
# - subrequest_object
# - subrequest_item_creation
# - s3_output_stream
# - s3_local_file
# - s3_input_stream
# - check_user_is_logged_in
# - create_empty_s3_file
# - get_trusted_email
# - beanstalk_env_from_request
# - beanstalk_env_from_registry
# - customized_delay_rerun
# - delay_rerun
# - customized_delay_rerun
# - SettingsKey
# - ExtraArgs
# - extra_kwargs_for_s3_encrypt_key_id

log = structlog.getLogger(__name__)
ENCODED_ROOT_DIR = os.path.dirname(__file__)
PROJECT_DIR = os.path.dirname(os.path.dirname(ENCODED_ROOT_DIR))  # two levels of hierarchy up


def resolve_file_path(path, file_loc=None):
    return snovault_resolve_file_path(path=path, file_loc=file_loc, root_dir=ENCODED_ROOT_DIR)


# IMPLEMENTATION NOTE:
#
#    We have middleware that overrides various details about content type that are declared in the view_config.
#    It used to work by having a wired set of exceptions, but this facility allows us to do it in a more data-driven
#    way. Really I think we should just rely on the information in the view_config, but I didn't have time to explore
#    why we are not using that.
#
#    See validate_request_tween_factory in renderers.py for where this is used. This declaration info is here
#    rather than there to simplify the load order dependencies.
#
#    -kmp 1-Sep-2020

SPACE_PATTERN = re.compile(r"[ ]+")


def title_to_snake_case(input_string):
    """Convert string title case (e.g. "Some Title") to snake case.

    TODO: Move to dcicutils
    
    :param input_string: String to convert
    :type input_string: str
    :return: String in snake case
    :rtype: str
    """
    lower_string = input_string.lower()
    no_dash_string = lower_string.replace("-", " ").replace("_", " ")
    no_space_string = re.sub(SPACE_PATTERN, "_", no_dash_string)
    result = no_space_string.strip("_")
    return result


def get_item(request, item_atid):
    """Get item from database via its @id.

    For @ids, essentially get_item_or_none that always returns dict
    for consistency and does not require specifying collection. Useful
    when working within calculated properties.

    NOTE: Only useful for @ids; other identifiers will NOT work as is.

    :param request: Web request
    :type request: class:`pyramid.request.Request`
    :param item_atid: Item @id
    :type item_atid: str
    :return: Item in object view, if found
    :rtype: dict
    """
    if isinstance(item_atid, str):
        item_collection = item_atid.split("/")[0]
        result = get_item_or_none(request, item_atid, item_collection)
        if result is None:
            log.exception(f"Could not find expected item for identifer: {item_atid}.")
            result = {}
    else:
        result = {}
    return result


def transfer_properties(source, target, properties, property_replacements=None):
    """Transfer dictionary properties, leaving source as is.

    Also replace source keys if replacements provided.

    :param source: Source with properties to transfer
    :type source: dict
    :param target: Target to receive properties
    :type target: dict
    :param properties: Keys of properties to transfer
    :type properties: list[str]
    :param property_replacements: Source property keys to replace,
        mapping key --> replacement key
    :type property_replacements: dict
    """
    for property_name in properties:
        property_value = source.get(property_name)
        if property_value is not None:
            if property_replacements:
                property_name = property_replacements.get(property_name, property_name)
            target[property_name] = property_value
