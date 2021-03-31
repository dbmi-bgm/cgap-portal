from dcicutils.misc_utils import VirtualApp
from pyramid.paster import get_app


def make_standalone_app():
    return get_app('development.ini', 'app')


def make_dev_vapp(remote_user=None, environ=None, app=None):

    environ = environ or {'HTTP_ACCEPT': 'application/json'}

    environ['REMOTE_USER'] = remote_user or 'TEST'

    app = app or make_standalone_app()
    return VirtualApp(app, environ)
