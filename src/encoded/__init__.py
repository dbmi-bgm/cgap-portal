import hashlib
# import json
import logging  # not used in Fourfront, but used in CGAP? -kmp 8-Apr-2020
import mimetypes
import netaddr
import os
import pkg_resources
import subprocess
import sys

from dcicutils.beanstalk_utils import source_beanstalk_env_vars
from dcicutils.log_utils import set_logging
from dcicutils.env_utils import get_mirror_env_from_context
from dcicutils.ff_utils import get_health_page
from pyramid.config import Configurator
from pyramid_localroles import LocalRolesAuthorizationPolicy
from pyramid.settings import asbool
from snovault.app import STATIC_MAX_AGE, session, json_from_path, configure_dbsession, changelogs, json_asset
from snovault.elasticsearch import APP_FACTORY
from webtest import TestApp
from .ingestion_listener import INGESTION_QUEUE
from .loadxl import load_all


if sys.version_info.major < 3:
    raise EnvironmentError("The CGAP encoded library no longer supports Python 2.")


# location of environment variables on elasticbeanstalk
BEANSTALK_ENV_PATH = "/opt/python/current/env"


def static_resources(config):
    mimetypes.init()
    mimetypes.init([pkg_resources.resource_filename('encoded', 'static/mime.types')])
    config.add_static_view('static', 'static', cache_max_age=STATIC_MAX_AGE)
    config.add_static_view('profiles', 'schemas', cache_max_age=STATIC_MAX_AGE)

    # Favicon
    favicon_path = '/static/img/favicon.ico'
    if config.route_prefix:
        favicon_path = '/%s%s' % (config.route_prefix, favicon_path)
    config.add_route('favicon.ico', 'favicon.ico')

    def favicon(request):
        subreq = request.copy()
        subreq.path_info = favicon_path
        response = request.invoke_subrequest(subreq)
        return response

    config.add_view(favicon, route_name='favicon.ico')

    # Robots.txt
    robots_txt_path = None
    if config.registry.settings.get('testing') in [True, 'true', 'True']:
        robots_txt_path = '/static/dev-robots.txt'
    else:
        robots_txt_path = '/static/robots.txt'

    if config.route_prefix:
        robots_txt_path = '/%s%s' % (config.route_prefix, robots_txt_path)

    config.add_route('robots.txt-conditional', '/robots.txt')

    def robots_txt(request):
        subreq = request.copy()
        subreq.path_info = robots_txt_path
        response = request.invoke_subrequest(subreq)
        return response

    config.add_view(robots_txt, route_name='robots.txt-conditional')


def load_workbook(app, workbook_filename, docsdir):
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'IMPORT',
    }
    testapp = TestApp(app, environ)
    load_all(testapp, workbook_filename, docsdir)


# This key is best interpreted not as the 'snovault version' but rather the 'version of the app built on snovault'.
# As such, it should be left this way, even though it may appear redundant with the 'eb_app_version' registry key
# that we also have, which tries to be the value eb uses. -kmp 28-Apr-2020
APP_VERSION_REGISTRY_KEY = 'snovault.app_version'


def app_version(config):
    if not config.registry.settings.get(APP_VERSION_REGISTRY_KEY):
        # we update version as part of deployment process `deploy_beanstalk.py`
        # but if we didn't check env then git
        version = os.environ.get("ENCODED_VERSION")
        if not version:
            try:
                version = subprocess.check_output(
                    ['git', '-C', os.path.dirname(__file__), 'describe']).decode('utf-8').strip()
                diff = subprocess.check_output(
                    ['git', '-C', os.path.dirname(__file__), 'diff', '--no-ext-diff'])
                if diff:
                    version += '-patch' + hashlib.sha1(diff).hexdigest()[:7]
            except Exception:
                version = "test"

        config.registry.settings[APP_VERSION_REGISTRY_KEY] = version

    # Fourfront does GA stuff here that makes no sense in CGAP (yet).


def main(global_config, **local_config):
    """
    This function returns a Pyramid WSGI application.
    """

    settings = global_config
    settings.update(local_config)

    # BEGIN PART THAT'S NOT IN FOURFRONT
    # adjust log levels for some annoying loggers
    lnames = ['boto', 'urllib', 'elasticsearch', 'dcicutils']
    for name in logging.Logger.manager.loggerDict:
        if any(logname in name for logname in lnames):
            logging.getLogger(name).setLevel(logging.WARNING)
    # END PART THAT'S NOT IN FOURFRONT
    set_logging(in_prod=settings.get('production'))
    # set_logging(settings.get('elasticsearch.server'), settings.get('production'))

    # source environment variables on elastic beanstalk
    source_beanstalk_env_vars()

    # settings['snovault.jsonld.namespaces'] = json_asset('encoded:schemas/namespaces.json')
    # settings['snovault.jsonld.terms_namespace'] = 'https://www.encodeproject.org/terms/'
    settings['snovault.jsonld.terms_prefix'] = 'encode'
    # set auth0 keys
    settings['auth0.secret'] = os.environ.get("Auth0Secret")
    settings['auth0.client'] = os.environ.get("Auth0Client")
    # set google reCAPTCHA keys
    settings['g.recaptcha.key'] = os.environ.get('reCaptchaKey')
    settings['g.recaptcha.secret'] = os.environ.get('reCaptchaSecret')
    # set mirrored Elasticsearch location (for staging and production servers)
    mirror = get_mirror_env_from_context(settings)
    if mirror is not None:
        settings['mirror.env.name'] = mirror
        settings['mirror_health'] = get_health_page(ff_env=mirror)
    config = Configurator(settings=settings)

    config.registry[APP_FACTORY] = main  # used by mp_indexer
    config.include(app_version)

    config.include('pyramid_multiauth')  # must be before calling set_authorization_policy
    # Override default authz policy set by pyramid_multiauth
    config.set_authorization_policy(LocalRolesAuthorizationPolicy())
    config.include(session)

    # must include, as tm.attempts was removed from pyramid_tm
    config.include('pyramid_retry')

    # for CGAP, always enable type=nested mapping
    # NOTE: this MUST occur prior to including Snovault, otherwise it will not work
    config.add_settings({'mappings.use_nested': True})
    config.include(configure_dbsession)
    config.include('snovault')
    config.commit()  # commit so search can override listing

    # Render an HTML page to browsers and a JSON document for API clients
    # config.include(add_schemas_to_html_responses)
    config.include('.renderers')
    config.include('.authentication')
    config.include('.server_defaults')
    config.include('.root')
    config.include('.types')
    # Fourfront does this. Do we need that here? -kmp 8-Apr-2020
    # config.include('.batch_download')
    config.include('.loadxl')
    config.include('.visualization')
    config.include('.ingestion_listener')

    if 'elasticsearch.server' in config.registry.settings:
        config.include('snovault.elasticsearch')
        config.include('.search.search')
        config.include('.search.compound_search')  # could make enabling configurable

    # this contains fall back url, so make sure it comes just before static_resoruces
    config.include('.types.page')
    config.include(static_resources)
    config.include(changelogs)

    aws_ip_ranges = json_from_path(settings.get('aws_ip_ranges_path'), {'prefixes': []})
    config.registry['aws_ipset'] = netaddr.IPSet(
        record['ip_prefix'] for record in aws_ip_ranges['prefixes'] if record['service'] == 'AMAZON')

    if asbool(settings.get('testing', False)):
        config.include('.tests.testing_views')

    # Load upgrades last so that all views (including testing views) are
    # registered.
    config.include('.upgrade')

    app = config.make_wsgi_app()

    workbook_filename = settings.get('load_workbook', '')
    load_test_only = asbool(settings.get('load_test_only', False))
    docsdir = settings.get('load_docsdir', None)
    if docsdir is not None:
        docsdir = [path.strip() for path in docsdir.strip().split('\n')]
    if workbook_filename:
        load_workbook(app, workbook_filename, docsdir)

    return app
