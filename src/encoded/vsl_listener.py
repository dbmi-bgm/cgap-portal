from dcicutils.misc_utils import check_true, ignored
from pyramid.view import view_config

from encoded.util import resolve_file_path, register_path_content_type


def includeme(config):
    config.add_route('interpretation', '/interpretation')
    config.scan(__name__)


@view_config(name='interpretation', request_method='GET')
# @debug_log
def interpretation(context, request):
    """"""
    ignored(context)
    return {"Here it is": "Some information"}
