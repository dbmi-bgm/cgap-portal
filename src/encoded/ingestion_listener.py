import argparse
import atexit
import boto3
import botocore.exceptions
import cgi
import datetime
import elasticsearch
import io
import json
import os
import psycopg2
import re
import requests  # XXX: C4-211 should not be needed but is // KMP needs this, too, until subrequest posts work
import signal
import structlog
import threading
import time
import webtest
import tempfile

from dcicutils.env_utils import is_stg_or_prd_env
from dcicutils.misc_utils import VirtualApp, ignored, check_true, full_class_name
from pyramid import paster
from pyramid.httpexceptions import HTTPNotFound, HTTPMovedPermanently, HTTPServerError
from pyramid.request import Request
# Possibly still needed by some commented-out code.
# from pyramid.response import Response
from pyramid.view import view_config
from snovault.util import debug_log
from vcf import Reader
from .ingestion.vcf_utils import VCFParser
from .commands.reformat_vcf import runner as reformat_vcf
from .ingestion.common import metadata_bundles_bucket, get_parameter
from .ingestion.exceptions import UnspecifiedFormParameter, SubmissionFailure
from .ingestion.processors import get_ingestion_processor
from .types.ingestion import SubmissionFolio, IngestionSubmission
from .util import (
    resolve_file_path, gunzip_content, debuglog, get_trusted_email, beanstalk_env_from_request,
    subrequest_object, register_path_content_type,
)
from .ingestion.queue_utils import IngestionQueueManager
from .ingestion.variant_utils import VariantBuilder


log = structlog.getLogger(__name__)
EPILOG = __doc__
INGESTION_QUEUE = 'ingestion_queue'
VARIANT_SCHEMA = resolve_file_path('./schemas/variant.json')
VARIANT_SAMPLE_SCHEMA = resolve_file_path('./schemas/variant_sample.json')
STATUS_QUEUED = 'Queued'
STATUS_INGESTED = 'Ingested'
STATUS_DISABLED = 'Ingestion disabled'
STATUS_ERROR = 'Error'
STATUS_IN_PROGRESS = 'In progress'
SHARED = 'shared'


def includeme(config):
    config.add_route('queue_ingestion', '/queue_ingestion')
    config.add_route('ingestion_status', '/ingestion_status')
    # config.add_route('prompt_for_ingestion', '/prompt_for_ingestion')
    config.add_route('submit_for_ingestion', '/submit_for_ingestion')
    config.registry[INGESTION_QUEUE] = IngestionQueueManager(config.registry)
    config.scan(__name__)


# The new protocol requires a two-phase action, first creating the IngestionSubmission
# and then using that object to do the submission. We don't need this for debugging right now,
# so I've just disabled it to avoid confusion. We should decide later whether to fix this or
# just flush it as having served its purpose. -kmp 2-Dec-2020
#
# # This endpoint is intended only for debugging. Use the command line tool.
# @view_config(route_name='prompt_for_ingestion', request_method='GET')
# @debug_log
# def prompt_for_ingestion(context, request):
#     ignored(context, request)
#     return Response(PROMPT_FOR_INGESTION)


SUBMISSION_PATTERN = re.compile(r'^/ingestion-submissions/([0-9a-fA-F-]+)(|/.*)$')

register_path_content_type(path='/submit_for_ingestion', content_type='multipart/form-data')


@view_config(name='submit_for_ingestion', request_method='POST', context=IngestionSubmission,
             # Apparently adding this 'accept' causes discrimination on incoming requests not to find this method.
             # We do want this type, and instead we check the request to make sure we got it, but we omit it here
             # for practical reasons. -kmp 10-Sep-2020
             # accept='multipart/form-data',
             permission='edit')
@debug_log
def submit_for_ingestion(context, request):
    ignored(context)

    check_true(request.content_type == 'multipart/form-data',  # even though we can't declare we accept this
               "Expected request to have content_type 'multipart/form-data'.", error_class=SubmissionFailure)

    bs_env = beanstalk_env_from_request(request)
    bundles_bucket = metadata_bundles_bucket(request.registry)
    datafile = request.POST['datafile']
    if not isinstance(datafile, cgi.FieldStorage):
        # e.g., specifically it might be b'' when no file is selected,
        # but IMPORTANTLY, cgi.FieldStorage has no predefined boolean value,
        # so we can't just ask to check 'not datafile'. Sigh. -kmp 5-Aug-2020
        raise UnspecifiedFormParameter('datafile')
    filename = datafile.filename
    override_name = request.POST.get('override_name', None)
    parameters = dict(request.POST)
    parameters['datafile'] = filename

    # Other parameters, like validate_only, will ride in on parameters via the manifest on s3

    matched = SUBMISSION_PATTERN.match(request.path_info)
    if matched:
        submission_id = matched.group(1)
    else:
        raise SubmissionFailure("request.path_info is not in the expected form: %s" % request.path_info)

    instance = subrequest_object(request, submission_id)

    # The three arguments institution, project, and ingestion_type were needed in the old protocol
    # but are not needed in the new protocol because someone will have set up the IngestionSubmission
    # object already with the right values. We tolerate them here, but we insist they be consistent (redundant).
    # Note, too, that we use the 'update=True' option that causes them to be added to our parameters if they are
    # missing, defaulted from the previous item, so that they will be written to the parameter block stored on S3.
    # (We could do that differently now, by looking them up dynamically, but rather than risk making a mistake,
    # I just went with path of least resistance for now.)
    # -kmp 2-Dec-2020

    institution = instance['institution']['@id']
    institution_arg = get_parameter(parameters, "institution", default=institution, update=True)
    if institution_arg != institution:
        # If the "institution" argument was passed, which we no longer require, make sure it's consistent.
        raise SubmissionFailure("'institution' was supplied inconsistently for submit_for_ingestion.")

    project = instance['project']['@id']
    project_arg = get_parameter(parameters, "project", default=project, update=True)
    if project_arg != project:
        # If the "project" argument was passed, which we no longer require, make sure it's consistent.
        raise SubmissionFailure("'project' was supplied inconsistently for submit_for_ingestion.")

    ingestion_type = instance['ingestion_type']
    ingestion_type_arg = get_parameter(parameters, "ingestion_type", default=ingestion_type, update=True)
    if ingestion_type_arg != ingestion_type:
        # If the "ingestion_type" argument was passed, which we no longer require, make sure it's consistent.
        raise SubmissionFailure("'ingestion_type' was supplied inconsistently for submit_for_ingestion.")

    # ``input_file`` contains the actual file data which needs to be
    # stored somewhere.

    input_file_stream = request.POST['datafile'].file
    input_file_stream.seek(0)

    # NOTE: Some reference information about uploading files to s3 is here:
    #   https://boto3.amazonaws.com/v1/documentation/api/latest/guide/s3-uploading-files.html

    # submission.set_item_detail(object_name=manifest['object_name'], parameters=manifest['parameters'],
    #                            institution=institution, project=project)

    # submission_id = str(uuid.uuid4())
    _, ext = os.path.splitext(filename)
    object_name = "{id}/datafile{ext}".format(id=submission_id, ext=ext)
    manifest_name = "{id}/manifest.json".format(id=submission_id)

    s3_client = boto3.client('s3')

    upload_time = datetime.datetime.utcnow().isoformat()
    success = True
    message = "Uploaded successfully."

    try:
        s3_client.upload_fileobj(input_file_stream, Bucket=bundles_bucket, Key=object_name)

    except botocore.exceptions.ClientError as e:

        log.error(e)

        success = False
        message = "{error_type}: {error_message}".format(error_type=full_class_name(e), error_message=str(e))

    # This manifest will be stored in the manifest.json file on on s3 AND will be returned from this endpoint call.
    manifest_content = {
        "filename": filename,
        "object_name": object_name,
        "submission_id": submission_id,
        "submission_uri": SubmissionFolio.make_submission_uri(submission_id),
        "beanstalk_env_is_prd": is_stg_or_prd_env(bs_env),
        "beanstalk_env": bs_env,
        "bucket": bundles_bucket,
        "authenticated_userid": request.authenticated_userid,
        "email": get_trusted_email(request, context="Submission", raise_errors=False),
        "success": success,
        "message": message,
        "upload_time": upload_time,
        "parameters": parameters,
    }

    manifest_content_formatted = json.dumps(manifest_content, indent=2)

    if success:

        try:
            with io.BytesIO(manifest_content_formatted.encode('utf-8')) as fp:
                s3_client.upload_fileobj(fp, Bucket=bundles_bucket, Key=manifest_name)

        except botocore.exceptions.ClientError as e:

            log.error(e)

            message = ("{error_type} (while uploading metadata): {error_message}"
                       .format(error_type=full_class_name(e), error_message=str(e)))

            raise SubmissionFailure(message)

        queue_manager = get_queue_manager(request, override_name=override_name)
        _, failed = queue_manager.add_uuids([submission_id], ingestion_type=ingestion_type)

        if failed:
            # If there's a failure, failed will be a list of one problem description since we only submitted one thing.
            raise SubmissionFailure(failed[0])

    if not success:

        raise SubmissionFailure(message)

    return manifest_content


@view_config(route_name='ingestion_status', request_method='GET', permission='index')
@debug_log
def ingestion_status(context, request):
    """ Status route, essentially identical to indexing_status. """
    ignored(context)
    queue_manager = request.registry[INGESTION_QUEUE]
    n_waiting, n_inflight = queue_manager.get_counts()
    return {
        'title': 'Ingestion Status',
        'waiting': n_waiting,
        'inflight': n_inflight
    }


def verify_vcf_file_status_is_not_ingested(request, uuid, *, expected=True):
    """ Verifies the given VCF file has not already been ingested by checking
        'file_ingestion_status'
    """
    kwargs = {
        'environ': request.environ,
        'method': 'GET',
        'content_type': 'application/json'
    }
    subreq = Request.blank('/' + uuid, **kwargs)
    resp = request.invoke_subrequest(subreq, use_tweens=True)
    if isinstance(resp, HTTPMovedPermanently):  # if we hit a redirect, follow it
        subreq = Request.blank(resp.location, **kwargs)
        resp = request.invoke_subrequest(subreq, use_tweens=True)
    log.error('VCF File Meta: %s' % resp.json)
    verified = bool(expected) is (resp.json.get('file_ingestion_status', None) != STATUS_INGESTED)
    # if not verified:
    #     import pdb; pdb.set_trace()
    return verified


def patch_vcf_file_status(request, uuids):
    """ Patches VCF File status to 'Queued'
        NOTE: This process makes queue_ingestion not scale terribly well.
              Batching above a certain number may result in 504. There are
              also permissions concerns here that are not dealt with.
    """
    for uuid in uuids:
        kwargs = {
            'environ': request.environ,
            'method': 'PATCH',
            'content_type': 'application/json',
            'POST': json.dumps({
                'file_ingestion_status': STATUS_QUEUED
            }).encode('utf-8')
        }
        subreq = Request.blank('/' + uuid, **kwargs)
        resp = None
        try:
            if verify_vcf_file_status_is_not_ingested(request, uuid):
                resp = request.invoke_subrequest(subreq)
        except HTTPNotFound:
            log.error('Tried to patch %s but item does not exist: %s' % (uuid, resp))


@view_config(route_name='queue_ingestion', request_method='POST', permission='index')
@debug_log
def queue_ingestion(context, request):
    """ Queues uuids as part of the request body for ingestion. Can batch as many as desired in a
        single request.
    """
    ignored(context)
    uuids = request.json.get('uuids', [])
    override_name = request.json.get('override_name', None)
    return enqueue_uuids_for_request(request, uuids, override_name=override_name)


def enqueue_uuids_for_request(request, uuids, *, ingestion_type='vcf', override_name=None):
    response = {
        'notification': 'Failure',
        'number_queued': 0,
        'detail': 'Nothing was queued. Make sure to past in a list of uuids in in "uuids" key.'
    }
    if uuids is []:
        return response
    queue_manager = get_queue_manager(request, override_name=override_name)
    _, failed = queue_manager.add_uuids(uuids)
    if not failed:
        response['notification'] = 'Success'
        response['number_queued'] = len(uuids)
        response['detail'] = 'Successfully queued the following uuids: %s' % uuids
        if ingestion_type == 'vcf':
            patch_vcf_file_status(request, uuids)  # extra state management - may not be accurate, hard to get right
    else:
        response['number_queued'] = len(uuids) - len(failed)
        response['detail'] = 'Some uuids failed: %s' % failed
    return response


def get_queue_manager(request, *, override_name):
    return (request.registry[INGESTION_QUEUE]
            if not override_name
            else IngestionQueueManager(request.registry, override_name=override_name))


class IngestionListener:
    """ Organizes helper functions for the ingestion listener """
    POLL_INTERVAL = 10  # seconds between each poll

    def __init__(self, vapp, _queue_manager=None, _update_status=None):
        self.vapp = vapp

        # Get queue_manager
        registry = None
        if isinstance(self.vapp, (webtest.TestApp, VirtualApp)):  # TestApp in testing or VirtualApp in production
            registry = self.vapp.app.registry
        elif _queue_manager is None:  # if we got here, we cannot succeed in starting
            raise Exception('Bad arguments given to IngestionListener: %s, %s, %s' %
                            (self.vapp, _queue_manager, _update_status))
        self.queue_manager = IngestionQueueManager(registry) if not _queue_manager else _queue_manager
        self.update_status = _update_status
        self.ingestion_report = IngestionReport()  # collect all errors

    @staticmethod
    def should_remain_online(override=None):
        """ A function that says whether 'run' should continue. This is provided because it
            can be mocked in testing.

            :param override: a lambda that will execute when evaluating if specified
            :return: True if should stay running, False otherwise
        """
        if not override:
            return True
        return override()

    def get_messages(self):
        """ Sleeps (as to not hit SQS too frequently) then requests messages,
            returning the result bodies.

            NOTE: THIS FUNCTION SHOULD NOT BE USED OUTSIDE OF THIS CODE SINCE
            IT BLOCKS FOR RATE LIMITING REASONS

        :return: messages available on SQS
        """
        time.sleep(self.POLL_INTERVAL)  # sleep here before polling again
        return self.queue_manager.receive_messages()

    def delete_messages(self, messages):
        """ Deletes messages from SQS (after they have been processed). Does not return
            anything but will log if messages fail deletion.

        :param messages: messages to be deleted
        """
        failed = self.queue_manager.delete_messages(messages)
        while True:
            debuglog("Trying to delete messages")
            tries = 3
            if failed:
                debuglog("Failed to delete messages")
                if tries > 0:
                    failed = self.queue_manager.delete_messages(failed)  # try again
                    tries -= 1
                else:
                    log.error('Failed to delete messages from SQS: %s' % failed)
                    break
            else:
                debuglog("Deleted messages")
                break

    def _patch_value(self, uuid, field, value):
        """ Patches field with value on item uuid """
        self.vapp.patch_json('/' + uuid, {field: value})

    def patch_ingestion_report(self, uuid):
        """ Sets the file_ingestion_error field of the given uuid """
        if self.ingestion_report is None:
            log.error('Tried to set IngestionReport but one was not created!')
            return
        self._patch_value(uuid, 'file_ingestion_error', self.ingestion_report.get_errors())
        self.ingestion_report = None  # reset this field

    def set_status(self, uuid, status):
        """ Sets the file_ingestion_status of the given uuid """
        self._patch_value(uuid, 'file_ingestion_status', status)

    def run(self):
        """ Main process for this class. Runs forever doing ingestion as needed.

            HIGH LEVEL LOGIC:
                while True:
                    while there are messages available:
                        for each message:
                            download, decompress, ingest, patch file status to "Ingested"
                        delete processed messages
        """
        log.info('Ingestion listener successfully online.')

        debuglog("Ingestion listener started.")

        messages = []  # This'll get a better value below in each loop iteration. This is just a declaration of intent.

        def discard(msg):
            self.delete_messages([msg])
            # Assuming we didn't get an error trying to remove it,
            # it should also get removed from our to-do list.
            messages.remove(msg)

        while self.should_remain_online():

            debuglog("About to get messages.")

            messages = self.get_messages()  # wait here

            debuglog("Got", len(messages), "messages.")

            # ingest each VCF file
            for message in messages:

                debuglog("Message:", message)

                body = json.loads(message['Body'])
                uuid = body['uuid']
                ingestion_type = body.get('ingestion_type', 'vcf')  # Older protocol doesn't yet know to expect this
                log.info('Ingesting uuid %s' % uuid)

                if ingestion_type != 'vcf':
                    # Let's minimally disrupt things for now. We can refactor this later
                    # to make all the parts work the same -kmp
                    submission = SubmissionFolio(vapp=self.vapp, ingestion_type=ingestion_type, submission_id=uuid)
                    handler = get_ingestion_processor(ingestion_type)
                    try:
                        debuglog("HANDLING:", uuid)
                        handler(submission)
                        debuglog("HANDLED:", uuid)
                    except Exception as e:
                        log.error(e)
                    # If we suceeded, we don't need to do it again, and if we failed we don't need to fail again.
                    discard(message)
                    continue

                debuglog("Did NOT process", uuid, "as", ingestion_type)

                # locate file meta data
                try:
                    file_meta = self.vapp.get('/' + uuid).follow().json
                    location = self.vapp.get(file_meta['href']).location
                    log.info('Got vcf location: %s' % location)
                except Exception as e:
                    log.error('Could not locate uuid: %s with error: %s' % (uuid, e))
                    continue

                # if this file has been ingested (or explicitly disabled), do not do anything with this uuid
                if file_meta.get('file_ingestion_status', 'N/A') in [STATUS_INGESTED, STATUS_DISABLED]:
                    log.error('Skipping ingestion of file %s due to disabled ingestion status' % uuid)
                    continue

                # attempt download with workaround
                try:
                    raw_content = requests.get(location).content
                except Exception as e:
                    log.error('Could not download file uuid: %s with error: %s' % (uuid, e))
                    continue

                # gunzip content, pass to parser, post variants/variant_samples
                # patch in progress status
                self.set_status(uuid, STATUS_IN_PROGRESS)
                decoded_content = gunzip_content(raw_content)
                debuglog('Got decoded content: %s' % decoded_content[:20])

                # reformat VCF
                formatted = tempfile.TemporaryFile()
                reformat_args = {
                    'inputfile': Reader(fsock=decoded_content.split('\n')),
                    'outputfile': formatted,
                    'verbose': False
                }
                reformat_vcf(reformat_args)
                parser = VCFParser(None, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA,
                                   reader=formatted)
                variant_builder = VariantBuilder(self.vapp, parser, file_meta['accession'],
                                                 project=file_meta['project']['@id'],
                                                 institution=file_meta['institution']['@id'])
                success, error = variant_builder.ingest_vcf()

                # if we had no errors, patch the file status to 'Ingested'
                if error > 0:
                    self.set_status(uuid, STATUS_ERROR)
                    self.patch_ingestion_report(uuid)
                else:
                    self.set_status(uuid, STATUS_INGESTED)

                # report results in error_log regardless of status
                msg = self.ingestion_report.brief_summary()
                log.error(msg)
                self.update_status(msg=msg)

                discard(message)

            # This is just fallback cleanup in case messages weren't cleaned up within the loop.
            # In normal operation, they will be.
            self.delete_messages(messages)


def run(vapp=None, _queue_manager=None, _update_status=None):
    """ Entry-point for the ingestion listener for waitress. """
    ingestion_listener = IngestionListener(vapp, _queue_manager=_queue_manager, _update_status=_update_status)
    try:
        ingestion_listener.run()
    except Exception as e:
        debuglog(str(e))
        raise


class ErrorHandlingThread(threading.Thread):
    """ Must be duplicated here so logging is correct. """

    def run(self):
        # interval = self._kwargs.get('interval', DEFAULT_INTERVAL)
        interval = 60  # DB polling can and should be slower
        update_status = self._kwargs['_update_status']  # noQA - uses private instance variables of parent class
        while True:
            try:
                self._target(*self._args, **self._kwargs)  # noQA - uses private instance variables of parent class
            except (psycopg2.OperationalError, elasticsearch.exceptions.ConnectionError) as e:
                # Handle database restart
                log.warning('Database not there, maybe starting up: %r', e)
                update_status(msg=repr(e))
                log.debug('sleeping')
                time.sleep(interval)
                continue
            except Exception as e:
                # Unfortunately mod_wsgi does not restart immediately
                log.exception('Exception in ingestion listener, restarting process at next request: %s' % e)
                os.kill(os.getpid(), signal.SIGINT)
            break


# Composite Application (for wsgi)
def composite(loader, global_conf, **settings):
    """ This is a composite pyramid app, meant to run components of an application
        or an application extension. In our case we are running the ingestion listener,
        which requires executing a command with application context. This code lives
        in encoded top-level as it is a wsgi entry-point. Note that the local deployment
        does NOT run the listener this way, but runs the run method through main directly.
        This code is heavily based off of the es_index_listener in snovault.
    """
    listener = None

    # Register before app creation.
    @atexit.register
    def join_listener():
        if listener:
            log.debug('joining listening thread')
            listener.join()

    # Composite app is used so we can load the main app
    app_name = settings.get('app', None)
    app = loader.get_app(app_name, global_conf=global_conf)
    username = settings.get('username', 'IMPORT')
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': username,
    }
    vapp = VirtualApp(app, environ)
    timestamp = datetime.datetime.utcnow().isoformat()
    status_holder = {
        'status': {
            'status': 'starting listener',
            'started': timestamp,
            'msgs': []
        },
    }

    def update_status(msg=None, **kw):
        """ Method passed to run to update "global" status. """
        # Setting a value in a dictionary is atomic
        status = status_holder['status'].copy()
        status.update(**kw)  # can hold generic info
        if msg is not None:
            status['msgs'].append(msg)
        status_holder['status'] = status

    kwargs = {
        'vapp': vapp,
        '_update_status': update_status
    }

    # daemon thread that actually executes `run` method to call /index
    listener = ErrorHandlingThread(target=run, name='listener', kwargs=kwargs)
    listener.daemon = True
    log.debug('WSGI Ingestion Listener Started')
    listener.start()

    # Register after virtualapp creation.
    @atexit.register
    def shutdown_listener():
        """ Echo a statement at shutdown """
        log.debug('shutting down listening thread')

    def status_app(environ, start_response):
        """ Allows you to get the status of the ingestion "manager". This will be much
            more useful once multi-processing is thrown at ingestion.
        """
        ignored(environ)
        status = '200 OK'
        response_headers = [('Content-type', 'application/json')]
        start_response(status, response_headers)
        return [json.dumps(status_holder['status'])]

    return status_app


# Command Application (for waitress)
def main():
    """ Entry point for the local deployment. """
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is specified wrong here.
        description='Listen for VCF File uuids to ingest',
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--app-name', help='Pyramid app name in configfile')
    parser.add_argument('--username', '-u', default='IMPORT', help='Import username')
    parser.add_argument('--dry-run', action='store_true', help='Do not post variants, just validate')
    parser.add_argument('config_uri', help="path to configfile")
    args = parser.parse_args()

    app = paster.get_app(args.config_uri, args.app_name)
    config = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': args.username,
    }

    vapp = VirtualApp(app, config)
    return run(vapp)


PROMPT_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Submit for Ingestion</title>
    <style>
  body { background-color: <COLOR>; font-size: 14pt; font-weight: bold; margin-left: 25px; }
  div.banner { margin-bottom: 25px; padding: 10px; text-align: center;
                   border: 1px solid black; background-color: #ffeeff; width: 50%;
         }
      table { border-spacing: 5px; margin-left: 25px; }
      td.formlabel { text-align: right; }
      td.formsubmit { text-align: center; padding-top: 10px; }
      td, input, select { font-size: 14pt; font-weight: bold; }
      select { padding: 4px; }
      input { padding: 10px; }
      input.submit { border: 2px solid black; border-radius: 8px; padding: 10px; width: 100%; }
    </style>
  </head>
  <body>
    <div class="banner">
      <p>This page is a demonstration of the ability to kick off an ingestion by form.</p>
    </div>
    <h1>Submit for Ingestion</h1>
    <form action="<TARGET-URL>" method="post" accept-charset="utf-8"
          enctype="multipart/form-data">
      <table>
        <tr>
          <td class="formlabel">
            <label for="ingestion_type">Ingestion Type:</label>
          </td>
          <td>
            <select id="ingestion_type" name="ingestion_type">
              <option value="metadata_bundle">MetaData Bundle&nbsp;</option>
            </select>
          </td>
        </tr>
        <tr>
          <td class="formlabel">
            <label for="project">Project:</label>
          </td>
          <td>
            <input type="text" id="project" name="project" value="/projects/12a92962-8265-4fc0-b2f8-cf14f05db58b/" />
          </td>
        </tr>
        <tr>
          <td class="formlabel">
            <label for="institution">Institution:</label>
          </td>
          <td>
            <input type="text" id="institution" name="institution" value="/institutions/hms-dbmi/" />
          </td>
        </tr>
        <tr>
          <td class="formlabel">
            <label for="datafile">Submit Datafile:</label>
          </td>
          <td>
            <input type="file" id="datafile" name="datafile" value="" />
          </td>
        </tr>
        <tr>
          <td><i>Special Options:</i><br /></td>
          <td>
            <input type="checkbox" id="validate_only" name="validate_only" value="true" />
            <label for="validate_only"> Validate Only</label>
          </td>
        </tr>
        <tr>
          <td class="formsubmit" colspan="2">
            <input class="submit" id="submit" type="submit" value="Submit" />
          </td>
        </tr>
      </table>
    </form>
  </body>
</html>
"""

PROMPT_FOR_INGESTION = PROMPT_TEMPLATE.replace("<TARGET-URL>", "/submit_for_ingestion").replace("<COLOR>", "#eeddee")
PROMPT_FOR_SUBREQUEST = PROMPT_TEMPLATE.replace("<TARGET-URL>", "/submit_subrequest").replace("<COLOR>", "#ddeedd")

if __name__ == '__main__':
    main()
