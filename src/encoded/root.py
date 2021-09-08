import uptime

from collections import OrderedDict
from dcicutils import lang_utils
from dcicutils.s3_utils import s3Utils
from encoded import APP_VERSION_REGISTRY_KEY
from pyramid.decorator import reify
from pyramid.security import ALL_PERMISSIONS, Allow, Authenticated, Deny, Everyone
from snovault import Root, calculated_property, root, COLLECTIONS, STORAGE
from .schema_formats import is_accession


def includeme(config):
    config.include(health_check)
    config.include(item_counts)
    config.include(submissions_page)
    config.scan(__name__)


def item_counts(config):
    config.add_route(
        'item-counts',
        '/counts'
    )

    def counts_view(request):
        response = request.response
        response.content_type = 'application/json; charset=utf-8'

        db_total = 0
        es_total = 0
        # find db and es counts for each item type
        db_es_compare = OrderedDict()
        for item_type in request.registry[COLLECTIONS].by_item_type:
            # use the write (DB) storage with only the specific item_type
            # need to count items with props in ES differently
            db_count = request.registry[STORAGE].write.__len__(item_type)
            es_count = request.registry[STORAGE].read.__len__(item_type)
            db_total += db_count
            es_total += es_count
            warn_str = build_warn_string(db_count, es_count)
            item_name = request.registry[COLLECTIONS][item_type].type_info.name
            db_es_compare[item_name] = ("DB: %s   ES: %s %s" % (str(db_count), str(es_count), warn_str))
        warn_str = build_warn_string(db_total, es_total)
        db_es_total = ("DB: %s   ES: %s %s" %
                       (str(db_total), str(es_total), warn_str))
        response_dict = {
            'title': 'Item Counts',
            'db_es_total': db_es_total,
            'db_es_compare': db_es_compare
        }
        return response_dict

    config.add_view(counts_view, route_name='item-counts')


def uptime_info():
    try:
        return lang_utils.relative_time_string(uptime.uptime())
    except Exception:
        return "unavailable"


# Correspondence with s3Utils tested elsewhere.

class HealthPageKey:
    APPLICATION_BUCKET_PREFIX = 'application_bucket_prefix'
    BEANSTALK_APP_VERSION = 'beanstalk_app_version'
    BEANSTALK_ENV = 'beanstalk_env'
    BLOB_BUCKET = 'blob_bucket'                              # s3Utils.BLOB_BUCKET_HEALTH_PAGE_KEY
    DATABASE = 'database'
    DISPLAY_TITLE = 'display_title'
    ELASTICSEARCH = 'elasticsearch'
    FILE_UPLOAD_BUCKET = 'file_upload_bucket'                # s3Utils.RAW_BUCKET_HEALTH_PAGE_KEY
    FOURSIGHT = 'foursight'
    FOURSIGHT_BUCKET_PREFIX = 'foursight_bucket_prefix'
    IDENTITY = 'identity'
    INDEXER = 'indexer'
    INDEX_SERVER = 'index_server'
    LOAD_DATA = 'load_data'
    METADATA_BUNDLES_BUCKET = 'metadata_bundles_bucket'      # s3Utils.METADATA_BUCKET_HEALTH_PAGE_KEY
    NAMESPACE = 'namespace'
    PROCESSED_FILE_BUCKET = 'processed_file_bucket'          # s3Utils.OUTFILE_BUCKET_HEALTH_PAGE_KEY
    PROJECT_VERSION = 'project_version'
    SNOVAULT_VERSION = 'snovault_version'
    SYSTEM_BUCKET = 'system_bucket'                          # s3Utils.SYS_BUCKET_HEALTH_PAGE_KEY
    TIBANNA_OUTPUT_BUCKET = 'tibanna_output_bucket'          # s3Utils.TIBANNA_OUTPUT_BUCKET_HEALTH_PAGE_KEY
    UPTIME = 'uptime'
    UTILS_VERSION = 'utils_version'


class SettingsKey:
    APPLICATION_BUCKET_PREFIX = 'application_bucket_prefix'
    BLOB_BUCKET = 'blob_bucket'
    EB_APP_VERSION = 'eb_app_version'
    ELASTICSEARCH_SERVER = 'elasticsearch.server'
    ENCODED_VERSION = 'encoded_version'
    FILE_UPLOAD_BUCKET = 'file_upload_bucket'
    FILE_WFOUT_BUCKET = 'file_wfout_bucket'
    FOURSIGHT_BUCKET_PREFIX = 'foursight_bucket_prefix'
    IDENTITY = 'identity'
    INDEXER = 'indexer'
    INDEXER_NAMESPACE = 'indexer.namespace'
    INDEX_SERVER = 'index_server'
    LOAD_TEST_DATA = 'load_test_data'
    METADATA_BUNDLES_BUCKET = 'metadata_bundles_bucket'
    SNOVAULT_VERSION = 'snovault_version'
    SQLALCHEMY_URL = 'sqlalchemy.url'
    SYSTEM_BUCKET = 'system_bucket'
    TIBANNA_OUTPUT_BUCKET = 'tibanna_output_bucket'
    UTILS_VERSION = 'utils_version'


def health_check(config):
    """
    Emulate a lite form of Alex's static page routing
    """
    config.add_route(
        'health-check',
        '/health'
    )

    def health_page_view(request):

        h = HealthPageKey
        s = SettingsKey

        response = request.response
        response.content_type = 'application/json; charset=utf-8'
        settings = request.registry.settings

        app_url = request.application_url
        if not app_url.endswith('/'):
            app_url = ''.join([app_url, '/'])

        env_name = settings.get('env.name')
        # TODO: Move this logic to dcicutils.env_utils
        # change when we get a CGAP-specific Foursight
        if env_name and env_name.startswith('fourfront-'):
            fs_env = env_name[len('fourfront-'):]
            foursight_url = 'https://4miof0jxmh.execute-api.us-east-1.amazonaws.com/api/view/' + fs_env
        else:
            foursight_url = None

        response_dict = {

            "@type": ["Health", "Portal"],
            "@context": "/health",
            "@id": "/health",
            "content": None,

            h.APPLICATION_BUCKET_PREFIX: settings.get(s.APPLICATION_BUCKET_PREFIX),
            h.BEANSTALK_APP_VERSION: settings.get(s.EB_APP_VERSION),
            h.BEANSTALK_ENV: env_name,
            h.BLOB_BUCKET: settings.get(s.BLOB_BUCKET),
            h.DATABASE: settings.get(s.SQLALCHEMY_URL).split('@')[1],  # don't show user /password
            h.DISPLAY_TITLE: "CGAP Status and Foursight Monitoring",
            h.ELASTICSEARCH: settings.get(s.ELASTICSEARCH_SERVER),
            h.FILE_UPLOAD_BUCKET: settings.get(s.FILE_UPLOAD_BUCKET),
            h.FOURSIGHT: foursight_url,
            h.FOURSIGHT_BUCKET_PREFIX: settings.get(s.FOURSIGHT_BUCKET_PREFIX),
            h.IDENTITY: settings.get(s.IDENTITY),
            h.INDEXER: settings.get(s.INDEXER),
            h.INDEX_SERVER: settings.get(s.INDEX_SERVER),
            h.LOAD_DATA: settings.get(s.LOAD_TEST_DATA),
            h.METADATA_BUNDLES_BUCKET: settings.get(s.METADATA_BUNDLES_BUCKET),
            h.NAMESPACE: settings.get(s.INDEXER_NAMESPACE),
            h.PROCESSED_FILE_BUCKET: settings.get(s.FILE_WFOUT_BUCKET),
            h.PROJECT_VERSION: settings.get(s.ENCODED_VERSION),
            h.SNOVAULT_VERSION: settings.get(s.SNOVAULT_VERSION),
            h.SYSTEM_BUCKET: settings.get(s.SYSTEM_BUCKET),
            h.TIBANNA_OUTPUT_BUCKET: settings.get(s.TIBANNA_OUTPUT_BUCKET),
            h.UPTIME: uptime_info(),
            h.UTILS_VERSION: settings.get(s.UTILS_VERSION),

        }

        return response_dict

    config.add_view(health_page_view, route_name='health-check')


def build_warn_string(db_count, es_count):
    if db_count > es_count:
        warn_str = '  < DB has %s more items >' % (str(db_count - es_count))
    elif db_count < es_count:
        warn_str = '  < ES has %s more items >' % (str(es_count - db_count))
    else:
        warn_str = ''
    return warn_str


def submissions_page(config):
    """
    Emulate a lite form of Alex's static page routing
    """
    config.add_route(
        'submissions-page',
        '/submissions'
    )

    def submissions_page_view(request):
        response = request.response
        response.content_type = 'application/json; charset=utf-8'

        response_dict = {
            "title": "Submissions",
            "notification": "success",
            "@type": ["Submissions", "Portal"],
            "@context": "/submissions",
            "@id": "/submissions",
            "content": None
        }

        return response_dict

    config.add_view(submissions_page_view, route_name='submissions-page')


def acl_from_settings(settings):
    # XXX Unsure if any of the demo instance still need this
    acl = []
    for k, v in settings.items():
        if k.startswith('allow.'):
            action = Allow
            permission = k[len('allow.'):]
            principals = v.split()
        elif k.startswith('deny.'):
            action = Deny
            permission = k[len('deny.'):]
            principals = v.split()
        else:
            continue
        if permission == 'ALL_PERMISSIONS':
            permission = ALL_PERMISSIONS
        for principal in principals:
            if principal == 'Authenticated':
                principal = Authenticated
            elif principal == 'Everyone':
                principal = Everyone
            acl.append((action, principal, permission))
    return acl


@root
class CGAPRoot(Root):
    properties = {
        'title': 'Home',
        'portal_title': 'CGAP Portal',
    }

    @reify
    def __acl__(self):
        acl = acl_from_settings(self.registry.settings) + [
            (Allow, Everyone, ['list', 'search']),
            (Allow, 'group.admin', ALL_PERMISSIONS),
            (Allow, 'remoteuser.EMBED', 'restricted_fields'),
        ] + [
            (Allow, 'remoteuser.INDEXER', ['view', 'view_raw', 'list', 'index']),
            (Allow, 'remoteuser.EMBED', ['view', 'view_raw', 'expand']),
            (Allow, Everyone, ['visible_for_edit'])
        ]
        return acl

    def get(self, name, default=None):
        resource = super(CGAPRoot, self).get(name, None)
        if resource is not None:
            return resource
        resource = self.connection.get_by_unique_key('page:location', name)
        if resource is not None:
            return resource
        if is_accession(name):
            resource = self.connection.get_by_unique_key('accession', name)
            if resource is not None:
                return resource
        if ':' in name:
            resource = self.connection.get_by_unique_key('alias', name)
            if resource is not None:
                return resource
        return default

    def get_by_uuid(self, uuid, default=None):
        return self.connection.get_by_uuid(uuid, default)

    def jsonld_context(self):
        """Inherits from '@context' calculated property of Resource in snovault/resources.py"""
        return '/home'

    def jsonld_type(self):
        """Inherits from '@type' calculated property of Root in snovault/resources.py"""
        return ['HomePage', 'StaticPage'] + super(CGAPRoot, self).jsonld_type()

    @calculated_property(schema={
        "title": "Static Page Content",
        "type": "array"
    })
    def content(self, request):
        """Returns -object- with pre-named sections"""
        sections_to_get = ['home.introduction']
        user = request._auth0_authenticated if hasattr(request, '_auth0_authenticated') else True
        return_list = []
        for section_name in sections_to_get:
            try:  # Can be caused by 404 / Not Found during indexing
                res = request.embed('/static-sections', section_name, '@@embedded', as_user=user)
                return_list.append(res)
            except KeyError:
                pass
        return return_list

    @calculated_property(schema={
        "title": "Carousel Content",
        "type": "array"
    }, category="page")
    def carousel(self, request):
        '''Returns list of carousel slides'''
        user = request._auth0_authenticated if hasattr(request, '_auth0_authenticated') else True
        try:
            return request.embed('/search/?type=StaticSection&section_type=Home+Page+Slide&sort=name', as_user=user).get('@graph', [])
        except KeyError:  # Can be caused by 404 / Not Found during indexing
            return []

    @calculated_property(schema={
        "title": "Announcements",
        "type": "array"
    }, category="page")
    def announcements(self, request):
        '''Returns list of latest announcements'''
        user = request._auth0_authenticated if hasattr(request, '_auth0_authenticated') else True
        try:
            return request.embed('/search/?type=StaticSection&section_type=Announcement&sort=-date_created', as_user=user).get('@graph', [])
        except KeyError:  # Can be caused by 404 / Not Found during indexing
            return []

    @calculated_property(schema={
        "title": "Application version",
        "type": "string",
    })
    def app_version(self, registry):
        return registry.settings[APP_VERSION_REGISTRY_KEY]
