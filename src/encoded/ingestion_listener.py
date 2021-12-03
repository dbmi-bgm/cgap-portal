import argparse
import atexit
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
from dcicutils.misc_utils import VirtualApp, ignored, check_true, full_class_name, environ_bool, PRINT
from pyramid import paster
from pyramid.httpexceptions import HTTPNotFound, HTTPMovedPermanently  # , HTTPServerError
from pyramid.request import Request
# Possibly still needed by some commented-out code.
# from pyramid.response import Response
from pyramid.view import view_config
from snovault.util import debug_log
from vcf import Reader
from .ingestion.vcf_utils import VCFParser, StructuralVariantVCFParser
from .commands.reformat_vcf import runner as reformat_vcf
from .commands.add_altcounts_by_gene import main as add_altcounts
from .ingestion.common import metadata_bundles_bucket, get_parameter, IngestionReport
from .ingestion.exceptions import UnspecifiedFormParameter, SubmissionFailure  # , BadParameter
from .ingestion.processors import get_ingestion_processor
# from .types.base import get_item_or_none
from .types.ingestion import SubmissionFolio, IngestionSubmission
from .util import (
    resolve_file_path, gunzip_content,
    debuglog, get_trusted_email, beanstalk_env_from_request,
    subrequest_object, register_path_content_type, vapp_for_email, vapp_for_ingestion,
    make_s3_client
)
from .ingestion.queue_utils import IngestionQueueManager
from .ingestion.variant_utils import VariantBuilder, StructuralVariantBuilder
from .root import SettingsKey


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
STRUCTURAL_VARIANT_SCHEMA = resolve_file_path("./schemas/structural_variant.json")
STRUCTURAL_VARIANT_SAMPLE_SCHEMA = resolve_file_path(
    "./schemas/structural_variant_sample.json"
)


def includeme(config):
    # config.add_route('process_ingestion', '/process_ingestion')
    config.add_route('queue_ingestion', '/queue_ingestion')
    config.add_route('ingestion_status', '/ingestion_status')
    config.add_route('submit_for_ingestion', '/submit_for_ingestion')
    config.registry[INGESTION_QUEUE] = IngestionQueueManager(config.registry)
    config.scan(__name__)


SUBMISSION_PATTERN = re.compile(r'^/ingestion-submissions/([0-9a-fA-F-]+)(|/.*)$')

register_path_content_type(path='/submit_for_ingestion', content_type='multipart/form-data')


def extract_submission_info(request):
    matched = SUBMISSION_PATTERN.match(request.path_info)
    if matched:
        submission_id = matched.group(1)
    else:
        raise SubmissionFailure("request.path_info is not in the expected form: %s" % request.path_info)

    instance = subrequest_object(request, submission_id)
    return submission_id, instance


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
    parameters = dict(request.POST)  # Convert to regular dictionary, which is also a copy
    parameters['datafile'] = filename

    # Other parameters, like validate_only, will ride in on parameters via the manifest on s3

    submission_id, instance = extract_submission_info(request)

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

    # We might need to extract some additional information from the GAC
    s3_client = make_s3_client()

    upload_time = datetime.datetime.utcnow().isoformat()
    success = True
    message = "Uploaded successfully."

    class ExtraArgs:
        SERVER_SIDE_ENCRYPTION = "ServerSideEncryption"
        SSE_KMS_KEY_ID = "SSEKMSKeyId"

    # Set up potentially useful additional args
    extra_kwargs = {}
    s3_encrypt_key_id = request.registry.settings.get(SettingsKey.S3_ENCRYPT_KEY_ID)
    if s3_encrypt_key_id:
        log.error(f"submit_for_ingestion adding SSEKMSKeyId ({s3_encrypt_key_id}) arguments in upload_fileobj call.")
        extra_kwargs["ExtraArgs"] = {
            ExtraArgs.SERVER_SIDE_ENCRYPTION: "aws:kms",
            ExtraArgs.SSE_KMS_KEY_ID: s3_encrypt_key_id,
        }
    else:
        log.error(f"submit_for_ingestion found no s3 encrypt key id ({SettingsKey.S3_ENCRYPT_KEY_ID})"
                    f" in request.registry.settings.")

    additional_info = ""
    if extra_kwargs:
        additional_info = f" (with SSEKMSKeyId: {s3_encrypt_key_id})"
    else:
        additional_info = " (no SSEKMSKeyId)"

    try:
        # Make sure to pass any extra args.
        s3_client.upload_fileobj(input_file_stream, Bucket=bundles_bucket, Key=object_name, **extra_kwargs)

    except botocore.exceptions.ClientError as e:

        log.error(e)

        success = False
        message = f"{full_class_name(e)}: {str(e)}{additional_info}"

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
                s3_client.upload_fileobj(fp, Bucket=bundles_bucket, Key=manifest_name, **extra_kwargs)

        except botocore.exceptions.ClientError as e:

            log.error(e)

            message = f"{full_class_name(e)} (while uploading metadata): {str(e)}{additional_info}"

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


DEBUG_SUBMISSIONS = environ_bool("DEBUG_SUBMISSIONS", default=False)


def process_submission(*, submission_id, ingestion_type, app, bundles_bucket=None, s3_client=None):
    bundles_bucket = bundles_bucket or metadata_bundles_bucket(app.registry)
    s3_client = s3_client or make_s3_client()
    manifest_name = "{id}/manifest.json".format(id=submission_id)
    data = json.load(s3_client.get_object(Bucket=bundles_bucket, Key=manifest_name)['Body'])
    email = None
    try:
        email = data['email']
    except KeyError as e:
        debuglog("Manifest data is missing 'email' field.")
        if DEBUG_SUBMISSIONS:
            pass
            # import pdb; pdb.set_trace()
    debuglog("processing submission %s with email %s" % (submission_id, email))
    with vapp_for_email(email=email, app=app) as vapp:
        if DEBUG_SUBMISSIONS:
            PRINT("PROCESSING FOR %s" % email)
        submission = SubmissionFolio(vapp=vapp, ingestion_type=ingestion_type, submission_id=submission_id, log=None)
        handler = get_ingestion_processor(ingestion_type)
        result = handler(submission)
        if DEBUG_SUBMISSIONS:
            PRINT("DONE PROCESSING FOR %s" % email)
        return {
            "result": result,
            "ingestion_type": ingestion_type,
            "submission_id": submission_id,
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
    resp = request.invoke_subrequest(subreq)
    if isinstance(resp, HTTPMovedPermanently):  # if we hit a redirect, follow it
        subreq = Request.blank(resp.location, **kwargs)
        resp = request.invoke_subrequest(subreq)
    log.info('VCF File Meta: %s' % resp.json)
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
    INGEST_AS_USER = environ_bool('INGEST_AS_USER', default=True)  # The new way, but possible to disable for now

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

    def patch_ingestion_report(self, report, uuid):
        """ Sets the file_ingestion_error field of the given uuid """
        if isinstance(report, IngestionReport):  # handle normal case
            self._patch_value(uuid, 'file_ingestion_error', report.get_errors())
        elif isinstance(report, list):  # handle when build_ingestion_error_report result is passed
            self._patch_value(uuid, 'file_ingestion_error', report)
        else:
            raise TypeError('Got bad type for ingestion error report: %s' % report)

    def set_status(self, uuid, status):
        """ Sets the file_ingestion_status of the given uuid """
        self._patch_value(uuid, 'file_ingestion_status', status)

    @staticmethod
    def build_ingestion_error_report(msg):
        """ Builds an ingestion error report in case an error is encountered that cannot be recovered from
            in VCF ingestion - see file_processed.json for structure definition. """
        return [
            {
                'body': msg,
                'row': -1  # this exception may have occurred on a particular row but since it could not be recovered
            }              # from we assume the msg has sufficient info to work backwards from - Will 4/9/21
        ]

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
                    if self.INGEST_AS_USER:
                        try:
                            debuglog("REQUESTING RESTRICTED PROCESSING:", uuid)
                            process_submission(submission_id=uuid,
                                               ingestion_type=ingestion_type,
                                               # bundles_bucket=submission.bucket,
                                               app=self.vapp.app)
                            debuglog("RESTRICTED PROCESSING DONE:", uuid)
                        except Exception as e:
                            log.error(e)
                    else:
                        submission = SubmissionFolio(vapp=self.vapp, ingestion_type=ingestion_type,
                                                     submission_id=uuid)
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
                # decoded_content = gunzip_content(raw_content)
                # debuglog('Got decoded content: %s' % decoded_content[:20])

                vcf_type = file_meta.get("variant_type", "SNV")
                if vcf_type == "SNV":
                    # Apply VCF reformat
                    vcf_to_be_formatted = tempfile.NamedTemporaryFile(suffix='.gz')
                    vcf_to_be_formatted.write(raw_content)
                    formatted = tempfile.NamedTemporaryFile()
                    reformat_args = {
                        'inputfile': vcf_to_be_formatted.name,
                        'outputfile': formatted.name,
                        'verbose': False
                    }
                    reformat_vcf(reformat_args)

                    # Add altcounts by gene
                    # Note: you cannot pass this file object to vcf.Reader if it's in rb mode
                    # It's also not guaranteed that it reads utf-8, so pass explicitly
                    formatted_with_alt_counts = tempfile.NamedTemporaryFile(mode='w+', encoding='utf-8')
                    alt_counts_args = {
                        'inputfile': formatted.name,
                        'outputfile': formatted_with_alt_counts.name
                    }
                    add_altcounts(alt_counts_args)
                    parser = VCFParser(None, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA,
                                       reader=Reader(formatted_with_alt_counts))
                    variant_builder = VariantBuilder(self.vapp, parser, file_meta['accession'],
                                                     project=file_meta['project']['@id'],
                                                     institution=file_meta['institution']['@id'])
                elif vcf_type == "SV":
                    # No reformatting necesssary for SV VCF
                    decoded_content = gunzip_content(raw_content)
                    debuglog('Got decoded content: %s' % decoded_content[:20])
                    formatted_vcf = tempfile.NamedTemporaryFile(
                        mode="w+", encoding="utf-8"
                    )
                    formatted_vcf.write(decoded_content)
                    formatted_vcf.seek(0)
                    parser = StructuralVariantVCFParser(
                        None,
                        STRUCTURAL_VARIANT_SCHEMA,
                        STRUCTURAL_VARIANT_SAMPLE_SCHEMA,
                        reader=Reader(formatted_vcf),
                    )
                    variant_builder = StructuralVariantBuilder(
                        self.vapp,
                        parser,
                        file_meta["accession"],
                        project=file_meta["project"]["@id"],
                        institution=file_meta["institution"]["@id"],
                    )
                try:
                    success, error = variant_builder.ingest_vcf()
                except Exception as e:
                    # if exception caught here, we encountered an error reading the actual
                    # VCF - this should not happen but can in certain circumstances. In this
                    # case we need to patch error status and discard the current message.
                    log.error('Caught error in VCF processing in ingestion listener: %s' % e)
                    self.set_status(uuid, STATUS_ERROR)
                    self.patch_ingestion_report(self.build_ingestion_error_report(msg=e), uuid)
                    discard(message)
                    continue

                # report results in error_log regardless of status
                msg = variant_builder.ingestion_report.brief_summary()
                log.error(msg)
                if self.update_status is not None and callable(self.update_status):
                    self.update_status(msg=msg)

                # if we had no errors, patch the file status to 'Ingested'
                if error > 0:
                    self.set_status(uuid, STATUS_ERROR)
                    self.patch_ingestion_report(variant_builder.ingestion_report, uuid)
                else:
                    self.set_status(uuid, STATUS_INGESTED)

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


if __name__ == '__main__':
    main()
