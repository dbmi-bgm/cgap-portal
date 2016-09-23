from snovault import (
    AfterModified,
    BeforeModified,
    CONNECTION,
    calculated_property,
    collection,
    load_schema,
)
from snovault.schema_utils import schema_validator
from .base import (
    Item,
    paths_filtered_by_status,
)
from pyramid.httpexceptions import (
    HTTPForbidden,
    HTTPTemporaryRedirect,
    HTTPNotFound,
)
from pyramid.response import Response
from pyramid.settings import asbool
from pyramid.traversal import traverse
from pyramid.view import view_config
from urllib.parse import (
    parse_qs,
    urlparse,
)
import boto
import datetime
import json
import pytz
import time


def show_upload_credentials(request=None, context=None, status=None):
    if request is None or status not in ('uploading', 'upload failed'):
        return False
    return request.has_permission('edit', context)


def external_creds(bucket, key, name, profile_name=None):
    policy = {
        'Version': '2012-10-17',
        'Statement': [
            {
                'Effect': 'Allow',
                'Action': 's3:PutObject',
                'Resource': 'arn:aws:s3:::{bucket}/{key}'.format(bucket=bucket, key=key),
            }
        ]
    }
    boto.set_stream_logger('boto')
    conn = boto.connect_sts(profile_name=profile_name)
    token = conn.get_federation_token(name, policy=json.dumps(policy))
    # 'access_key' 'secret_key' 'expiration' 'session_token'
    credentials = token.credentials.to_dict()
    credentials.update({
        'upload_url': 's3://{bucket}/{key}'.format(bucket=bucket, key=key),
        'federated_user_arn': token.federated_user_arn,
        'federated_user_id': token.federated_user_id,
        'request_id': token.request_id,
    })
    return {
        'service': 's3',
        'bucket': bucket,
        'key': key,
        'upload_credentials': credentials,
    }


def property_closure(request, propname, root_uuid):
    # Must avoid cycles
    conn = request.registry[CONNECTION]
    seen = set()
    remaining = {str(root_uuid)}
    while remaining:
        seen.update(remaining)
        next_remaining = set()
        for uuid in remaining:
            obj = conn.get_by_uuid(uuid)
            next_remaining.update(obj.__json__(request).get(propname, ()))
        remaining = next_remaining - seen
    return seen


@collection(
    name='file-sets',
    unique_key='accession',
    properties={
        'title': 'File Sets',
        'description': 'Listing of File Sets',
    })
class FileSet(Item):
    """Collection of files stored under fileset."""

    item_type = 'file_set'
    schema = load_schema('encoded:schemas/file_set.json')
    name_key = 'accession'

    def _update(self, properties, sheets=None):
        # update self first
        super(FileSet, self)._update(properties, sheets)
        fsacc = str(self.uuid)
        if 'files_in_set' in properties.keys():
            for eachfile in properties["files_in_set"]:
                target_file = self.collection.get(eachfile)
                # is there any fileset in the file
                if 'filesets' not in target_file.properties.keys():
                    target_file.properties.update({'filesets': [fsacc, ]})
                    target_file.update(target_file.properties)
                else:
                    # incase file already has the fileset_type
                    if fsacc in target_file.properties['filesets']:
                        break
                    else:
                        target_file.properties['filesets'].append(fsacc)
                        target_file.update(target_file.properties)


@collection(
    name='files',
    unique_key='accession',
    properties={
        'title': 'Files',
        'description': 'Listing of Files',
    })
class File(Item):
    """Collection for individual files."""

    item_type = 'file'
    schema = load_schema('encoded:schemas/file.json')
    name_key = 'accession'

    def _update(self, properties, sheets=None):
        # update self first to ensure 'related_files' are stored in self.properties
        super(File, self)._update(properties, sheets)
        DicRefRelation = {
            "derived from": "parent of",
            "parent of": "derived from",
            "supercedes": "is superceded by",
            "is superceded by": "supercedes",
            "paired with": "paired with"
        }
        acc = str(self.uuid)

        if 'related_files' in properties.keys():
            for relation in properties["related_files"]:
                try:
                    switch = relation["relationship_type"]
                    rev_switch = DicRefRelation[switch]
                    related_fl = relation["file"]
                    relationship_entry = {"relationship_type": rev_switch, "file": acc}
                    rel_dic = {'related_files': [relationship_entry, ]}
                except:
                    print("invalid data, can't update correctly")
                    return

                target_fl = self.collection.get(related_fl)
                # case one we don't have relations
                if 'related_files' not in target_fl.properties.keys():
                    target_fl.properties.update(rel_dic)
                    target_fl.update(target_fl.properties)
                else:
                    # case two we have relations but not the one we need
                    for target_relation in target_fl.properties['related_files']:
                        if target_relation.get('file') == acc:
                            break
                    else:
                        # make data for new related_files
                        target_fl.properties['related_files'].append(relationship_entry)
                        target_fl.update(target_fl.properties)
        # this part is for fileset
        if 'filesets' in properties.keys():
            for fileset in properties['filesets']:
                target_fileset = self.collection.get(fileset)
                # look at the files inside the set
                if acc in target_fileset.properties["files_in_set"]:
                    break
                else:
                    # incase it is not in the list of files
                    target_fileset.properties["files_in_set"].append(acc)
                    target_fileset.update(target_fileset.properties)

    @property
    def __name__(self):
        properties = self.upgrade_properties()
        if properties.get('status') == 'replaced':
            return self.uuid
        return properties.get(self.name_key, None) or self.uuid

    def unique_keys(self, properties):
        keys = super(File, self).unique_keys(properties)
        if properties.get('status') != 'replaced':
            if 'md5sum' in properties:
                value = 'md5:{md5sum}'.format(**properties)
                keys.setdefault('alias', []).append(value)
        return keys

    @calculated_property(schema={
        "title": "Title",
        "type": "string",
    })
    def title(self, accession=None, external_accession=None):
        return accession or external_accession

    @calculated_property(schema={
        "title": "Download URL",
        "type": "string",
    })
    def href(self, request, file_format, accession=None, external_accession=None):
        accession = accession or external_accession
        file_extension = self.schema['file_format_file_extension'][file_format]
        filename = '{}{}'.format(accession, file_extension)
        return request.resource_path(self, '@@download', filename)

    @calculated_property(condition=show_upload_credentials, schema={
        "type": "object",
    })
    def upload_credentials(self):
        external = self.propsheets.get('external', None)
        if external is not None:
            return external['upload_credentials']

    @calculated_property(schema={
        "title": "File type",
        "type": "string"
    })
    def file_type(self, file_format, file_format_type=None):
        if file_format_type is None:
            return file_format
        else:
            return file_format + ' ' + file_format_type

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        if properties.get('status') == 'uploading':
            sheets = {} if sheets is None else sheets.copy()

            bucket = registry.settings['file_upload_bucket']
            mapping = cls.schema['file_format_file_extension']
            file_extension = mapping[properties['file_format']]
            key = '{uuid}/{accession}{file_extension}'.format(
                file_extension=file_extension, uuid=uuid, **properties)

            # remove the path from the file name and only take first 32 chars
            name = properties.get('filename').split('/')[-1][:32]

            profile_name = registry.settings.get('file_upload_profile_name')
            sheets['external'] = external_creds(bucket, key, name, profile_name)
        return super(File, cls).create(registry, uuid, properties, sheets)


@view_config(name='upload', context=File, request_method='GET',
             permission='edit')
def get_upload(context, request):
    external = context.propsheets.get('external', {})
    upload_credentials = external.get('upload_credentials')
    # Show s3 location info for files originally submitted to EDW.
    if upload_credentials is None and external.get('service') == 's3':
        upload_credentials = {
            'upload_url': 's3://{bucket}/{key}'.format(**external),
        }
    return {
        '@graph': [{
            '@id': request.resource_path(context),
            'upload_credentials': upload_credentials,
        }],
    }


@view_config(name='upload', context=File, request_method='POST',
             permission='edit', validators=[schema_validator({"type": "object"})])
def post_upload(context, request):
    properties = context.upgrade_properties()
    if properties['status'] not in ('uploading', 'upload failed'):
        raise HTTPForbidden('status must be "uploading" to issue new credentials')

    accession_or_external = properties.get('accession')
    external = context.propsheets.get('external', None)

    if external is None:
        # Handle objects initially posted as another state.
        bucket = request.registry.settings['file_upload_bucket']
        uuid = context.uuid
        mapping = context.schema['file_format_file_extension']
        file_extension = mapping[properties['file_format']]

        key = '{uuid}/{accession}{file_extension}'.format(
            file_extension=file_extension, uuid=uuid, **properties)

    elif external.get('service') == 's3':
        bucket = external['bucket']
        key = external['key']
    else:
        raise ValueError(external.get('service'))

    # remove the path from the file name and only take first 32 chars
    name = properties.get('filename').split('/')[-1][:32]
    profile_name = request.registry.settings.get('file_upload_profile_name')
    creds = external_creds(bucket, key, name, profile_name)

    new_properties = None
    if properties['status'] == 'upload failed':
        new_properties = properties.copy()
        new_properties['status'] = 'uploading'

    registry = request.registry
    registry.notify(BeforeModified(context, request))
    context.update(new_properties, {'external': creds})
    registry.notify(AfterModified(context, request))

    rendered = request.embed('/%s/@@object' % context.uuid, as_user=True)
    result = {
        'status': 'success',
        '@type': ['result'],
        '@graph': [rendered],
    }
    return result


@view_config(name='download', context=File, request_method='GET',
             permission='view', subpath_segments=[0, 1])
def download(context, request):
    properties = context.upgrade_properties()
    mapping = context.schema['file_format_file_extension']
    file_extension = mapping[properties['file_format']]
    accession_or_external = properties.get('accession') or properties['external_accession']
    filename = accession_or_external + file_extension
    if request.subpath:
        _filename, = request.subpath
        if filename != _filename:
            raise HTTPNotFound(_filename)

    proxy = asbool(request.params.get('proxy')) or 'Origin' in request.headers

    use_download_proxy = request.client_addr not in request.registry['aws_ipset']

    external = context.propsheets.get('external', {})
    if external.get('service') == 's3':
        conn = boto.connect_s3()
        location = conn.generate_url(
            36 * 60 * 60, request.method, external['bucket'], external['key'],
            force_http=proxy or use_download_proxy, response_headers={
                'response-content-disposition': "attachment; filename=" + filename,
            })
    else:
        raise ValueError(external.get('service'))
    if asbool(request.params.get('soft')):
        expires = int(parse_qs(urlparse(location).query)['Expires'][0])
        return {
            '@type': ['SoftRedirect'],
            'location': location,
            'expires': datetime.datetime.fromtimestamp(expires, pytz.utc).isoformat(),
        }

    if proxy:
        return Response(headers={'X-Accel-Redirect': '/_proxy/' + str(location)})

    # We don't use X-Accel-Redirect here so that client behaviour is similar for
    # both aws and non-aws users.
    if use_download_proxy:
        location = request.registry.settings.get('download_proxy', '') + str(location)

    # 307 redirect specifies to keep original method
    raise HTTPTemporaryRedirect(location=location)
