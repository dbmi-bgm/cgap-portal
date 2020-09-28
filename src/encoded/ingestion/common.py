"""
common.py - tools common to various parts of ingestion
"""

from .exceptions import MissingParameter, BadParameter


def metadata_bundles_bucket(registry):
    return registry.settings.get('metadata_bundles_bucket')


# ==================================================

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

CONTENT_TYPE_SPECIAL_CASES = {
    'application/x-www-form-urlencoded': [
        # Single legacy special case to allow us to POST to metadata TSV requests via form submission.
        # All other special case values should be added using register_path_content_type.
        '/metadata/'
    ]
}


def register_path_content_type(*, path, content_type):
    """
    Registers that endpoints that begin with the specified path use the indicated content_type.

    This is part of an inelegant workaround for an issue in renderers.py that maybe we can make go away in the future.
    See the 'implementation note' in ingestion/common.py for more details.
    """
    exceptions = CONTENT_TYPE_SPECIAL_CASES.get(content_type, None)
    if exceptions is None:
        CONTENT_TYPE_SPECIAL_CASES[content_type] = exceptions = []
    if path not in exceptions:
        exceptions.append(path)


def content_type_allowed(request):
    """
    Returns True if the current request allows the requested content type.

    This is part of an inelegant workaround for an issue in renderers.py that maybe we can make go away in the future.
    See the 'implementation note' in ingestion/common.py for more details.
    """
    if request.content_type == "application/json":
        # For better or worse, we always allow this.
        return True

    exceptions = CONTENT_TYPE_SPECIAL_CASES.get(request.content_type)

    if exceptions:
        for prefix in exceptions:
            if request.path.startswith(prefix):
                return True

    return False

# ==================================================

_NO_DEFAULT = object()


def get_parameter(parameter_block, parameter_name, as_type=None, default=_NO_DEFAULT, update=False):
    """
    Returns the value of a given parameter from a dictionary of parameter values.

    If the parameter is not in the dictionary, the default will be returned if one is given.
    If the parameter is not present but there is no default, an error of type MissingParameter will be raised.

    Args:
        parameter_block (dict): a dictionary whose keys are parameter names and whose values are parameter values
        parameter_name (str): the name of a parameter
        as_type: if supplied, a type coercion to perform on the result
        default (object): a default value to be used if the parameter_name is not present.
        update (bool): if as_type is applied, whether to update the parameter_block
    """

    if isinstance(parameter_block, dict):
        if parameter_name in parameter_block:
            parameter_value = parameter_block[parameter_name]
            result = parameter_value
            if as_type:
                if isinstance(as_type, type) and isinstance(result, as_type):
                    return result
                elif as_type is bool:
                    lower_value = str(result).lower()
                    if lower_value == "true":
                        result = True
                    elif lower_value in ("false", "none", "null", ""):
                        result = False
                    else:
                        raise BadParameter(parameter_name=parameter_name, parameter_value=parameter_value,
                                           extra_detail=("Expected a string representing a boolean, such as"
                                                         " 'true' for True, or 'false' or the empty string for False."))
                else:
                    result = as_type(result)
        elif default is _NO_DEFAULT:
            raise MissingParameter(parameter_name=parameter_name)
        else:
            result = default

        if update:
            parameter_block[parameter_name] = result

        return result

    else:
        raise TypeError("Expected parameter_block to be a dict: %s", parameter_block)
