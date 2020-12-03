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
import requests  # XXX: C4-211 should not be needed but is // KMP needs this, too, until subrequest posts work
import signal
import socket
import structlog
import threading
import time
import webtest

from dcicutils.env_utils import is_stg_or_prd_env
from dcicutils.misc_utils import VirtualApp, ignored, check_true
from pyramid import paster
from pyramid.httpexceptions import HTTPNotFound, HTTPMovedPermanently
from pyramid.request import Request
from pyramid.response import Response
from pyramid.view import view_config
from snovault.util import debug_log
from vcf import Reader
from .commands.ingest_vcf import VCFParser
from .ingestion.common import register_path_content_type, metadata_bundles_bucket, get_parameter
from .ingestion.exceptions import UnspecifiedFormParameter, SubmissionFailure
from .ingestion.processors import get_ingestion_processor
from .inheritance_mode import InheritanceMode
from .server_defaults import add_last_modified
from .loadxl import LOADXL_USER_UUID
from .types.ingestion import SubmissionFolio
from .types.variant import build_variant_display_title, ANNOTATION_ID_SEP
from .util import (
    resolve_file_path, gunzip_content, debuglog, get_trusted_email, beanstalk_env_from_request, full_class_name,
)


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
CGAP_CORE_PROJECT = '/projects/cgap-core'
CGAP_CORE_INSTITUTION = '/institutions/hms-dbmi/'
SHARED = 'shared'


def includeme(config):
    config.add_route('queue_ingestion', '/queue_ingestion')
    config.add_route('ingestion_status', '/ingestion_status')
    config.add_route('prompt_for_ingestion', '/prompt_for_ingestion')
    config.add_route('submit_for_ingestion', '/submit_for_ingestion')
    config.registry[INGESTION_QUEUE] = IngestionQueueManager(config.registry)
    config.scan(__name__)


# This endpoint is intended only for debugging. Use the command line tool.
@view_config(route_name='prompt_for_ingestion', request_method='GET')
@debug_log
def prompt_for_ingestion(context, request):
    ignored(context, request)
    return Response(PROMPT_FOR_INGESTION)


register_path_content_type(path='/submit_for_ingestion', content_type='multipart/form-data')


@view_config(route_name='submit_for_ingestion', request_method='POST',
             # Apparently adding this 'accept' causes discrimination on incoming requests not to find this method.
             # We do want this type, and instead we check the request to make sure we got it, but we omit it here
             # for practical reasons. -kmp 10-Sep-2020
             # accept='multipart/form-data',
             permission='add')
@debug_log
def submit_for_ingestion(context, request):
    ignored(context)

    check_true(request.content_type == 'multipart/form-data',  # even though we can't declare we accept this
               "Expected request to have content_type 'multipart/form-data'.", error_class=RuntimeError)

    bs_env = beanstalk_env_from_request(request)
    bundles_bucket = metadata_bundles_bucket(request.registry)
    ingestion_type = request.POST['ingestion_type']
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
    institution = get_parameter(parameters, 'institution')
    project = get_parameter(parameters, 'project')
    # Other parameters, like validate_only, will ride in on parameters via the manifest on s3

    submission_id = SubmissionFolio.create_item(request,
                                                ingestion_type=ingestion_type,
                                                institution=institution,
                                                project=project)

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


def verify_vcf_file_status_is_not_ingested(request, uuid):
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
    if resp.json.get('file_ingestion_status', None) == STATUS_INGESTED:
        return False
    return True


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


class IngestionError:
    """
    Holds info on an error that occurred in ingestion. Right now this consists of the
    offending request body and the VCF row it occurred on.

    This class doesn't really do much except specify the structure. It must align with that of FileProcessed
    (reproduced as of 12/2/2020 below):

        "file_ingestion_error": {
            "title": "Ingestion Error Report",
            "description": "This field is set when an error occurred in ingestion with all errors encountered",
            "type": "array",
            "items": {
                "title": "Ingestion Error",
                "type": "object",
                "properties": {
                    "body": {
                        "type": "string",
                        "index": false  # the intention is not to index this in the future
                    },
                    "row": {
                        "type": "integer"
                    }
                }
            }
        }

    """

    def __init__(self, body, row):
        self.body = body
        self.row = row

    def to_dict(self):
        return {
            'body': str(self.body),
            'row': self.row
        }


class IngestionReport:
    """
    A "virtual" item on file_processed that contains detailed information on the ingestion run.
    Not creating an item for this is a design decision. The output of this process is more for
    debugging and not for auditing, so it does not merit an item at this time.
    """
    MAX_ERRORS = 100  # tune this to get more errors, 100 is a lot though and probably more than needed

    def __init__(self):
        self.total = 0
        self.errors = []

    def __str__(self):
        return 'INGESTION REPORT: There were %s total variants detected, of which %s were successful' \
               'and %s failed. Check ProcessedFile for full error output.' % (self.total,
                                                                              self.total_successful(),
                                                                              self.total_error())

    def total_successful(self):
        return self.total - len(self.errors)

    def total_error(self):
        return len(self.errors)

    def get_errors(self, limit=True):
        """Returns a limited number of errors, where limit can be True (self.MAX_ERRORS), False (no limit), or an integer."""
        if limit is True:
            limit = self.MAX_ERRORS
        elif limit is False:
            limit = None
        return self.errors[:limit]

    def mark_success(self):
        """ Marks the current row number as successful, which in this case just involves incrementing the total """
        self.total += 1

    def mark_failure(self, *, body, row):
        """ Marks the current row as failed, creating an IngestionError holding the response body and row. """
        self.total += 1
        self.errors.append(IngestionError(body, row).to_dict())


class IngestionQueueManager:
    """
    Similar to QueueManager in snovault in that in manages SQS queues, but that code is not generic
    enough to use here, so it is "duplicated" so to speak here. At a later time the functionality of this
    class and QueueManager should be refactored into a "helper" class, but for now this is sufficient
    and is tested independently here.

    We will use a single queue to keep track of VCF File uuids to be indexed.
    """
    BUCKET_EXTENSION = '-vcfs'

    def __init__(self, registry, override_name=None):
        """ Does initial setup for interacting with SQS """
        self.batch_size = 10
        self.env_name = registry.settings.get('env.name', None)
        if not self.env_name:  # replace with something usable
            backup = socket.gethostname()[:80].replace('.', '-')
            self.env_name = backup if backup else 'cgap-backup'
        kwargs = {
            'region_name': 'us-east-1'
        }
        self.client = boto3.client('sqs', **kwargs)
        self.queue_name = override_name or (self.env_name + self.BUCKET_EXTENSION)
        self.queue_attrs = {
            self.queue_name: {
                'DelaySeconds': '1',  # messages initially invisible for 1 sec
                'VisibilityTimeout': '10800',  # 3 hours
                'MessageRetentionPeriod': '604800',  # 7 days, in seconds
                'ReceiveMessageWaitTimeSeconds': '5',  # 5 seconds of long polling
            }
        }
        self.queue_url = self._initialize()

    def _initialize(self):
        """ Initializes the actual queue - helper method for init """
        try:
            response = self.client.create_queue(
                QueueName=self.queue_name,
                Attributes=self.queue_attrs[self.queue_name]
            )
            queue_url = response['QueueUrl']
        except self.client.exceptions.QueueNameExists:
            queue_url = self._get_queue_url(self.queue_name)
        except Exception as e:
            log.error('Error while attempting to create queue: %s' % e)
            queue_url = self._get_queue_url(self.queue_name)
        return queue_url

    def _get_queue_url(self, queue_name):
        """
        Simple function that returns url of associated queue name
        """
        try:
            response = self.client.get_queue_url(
                QueueName=queue_name
            )
        except Exception as e:
            log.error('Cannot resolve queue_url: %s' % e)
            response = {}
        return response.get('QueueUrl', None)

    def _chunk_messages(self, msgs):
        """ Chunks messages into self.send_batch_size batches (for efficiency).

        :param msgs: list of messages to be chunked
        """
        for i in range(0, len(msgs), self.batch_size):
            yield msgs[i:i + self.batch_size]

    def _send_messages(self, msgs, retries=3):
        """ Sends msgs to the ingestion queue (with retries for failed messages).

        :param msgs: to be sent
        :param retries: number of times to resend failed messages, decremented on recursion
        :return: list of any failed messages
        """
        failed = []
        for msg_batch in self._chunk_messages(msgs):
            log.info('Trying to chunk messages: %s' % msgs)
            entries = []
            for msg in msg_batch:
                entries.append({
                    'Id': str(int(time.time() * 1000000)),
                    'MessageBody': json.dumps(msg)
                })
            response = self.client.send_message_batch(
                QueueUrl=self.queue_url,
                Entries=entries
            )
            failed_messages = response.get('Failed', [])

            # attempt resend of failed messages
            if failed_messages and retries > 0:
                msgs_to_retry = []
                for failed_message in failed_messages:
                    fail_id = failed_message.get('Id')
                    msgs_to_retry.extend([json.loads(ent['MessageBody']) for ent in entries if ent['Id'] == fail_id])
                    if msgs_to_retry:
                        failed_messages = self._send_messages(msgs_to_retry, retries=retries - 1)
            failed.extend(failed_messages)
        return failed

    def delete_messages(self, messages):
        """
        Called after a message has been successfully received and processed.
        Removes message from the queue.
        Input should be the messages directly from receive messages. At the
        very least, needs a list of messages with 'Id' and 'ReceiptHandle' as this
        metadata is necessary to identify the message in SQS internals.

        NOTE: deletion does NOT have a retry mechanism

        :param messages: messages to be deleted
        :returns: a list with any failed messages
        """
        failed = []
        for batch in self._chunk_messages(messages):
            # need to change message format, since deleting takes slightly
            # different fields what's return from receiving
            for i in range(len(batch)):
                to_delete = {
                    'Id': batch[i]['MessageId'],
                    'ReceiptHandle': batch[i]['ReceiptHandle']
                }
                batch[i] = to_delete
            response = self.client.delete_message_batch(
                QueueUrl=self.queue_url,
                Entries=batch
            )
            failed.extend(response.get('Failed', []))
        return failed

    def add_uuids(self, uuids, ingestion_type='vcf'):
        """ Takes a list of string uuids and adds them to the ingestion queue.
            If ingestion_type is not specified, it defaults to 'vcf'.

            :precondition: uuids are all of type FileProcessed
            :param uuids: uuids to be added to the queue.
            :param ingestion_type: the ingestion type of the uuids (default 'vcf' for legacy reasons)
            :returns: 2-tuple: uuids queued, failed messages (if any)
        """
        curr_time = datetime.datetime.utcnow().isoformat()
        msgs = []
        for uuid in uuids:
            current_msg = {
                'ingestion_type': ingestion_type,
                'uuid': uuid,
                'timestamp': curr_time
            }
            msgs.append(current_msg)
        failed = self._send_messages(msgs)
        return uuids, failed

    def get_counts(self):
        """ Returns number counts of waiting/inflight messages
            * Makes a boto3 API Call to do so *

            :returns: 2 tuple of waiting, inflight messages
        """
        response = self.client.get_queue_attributes(
            QueueUrl=self.queue_url,
            AttributeNames=[
                'ApproximateNumberOfMessages',
                'ApproximateNumberOfMessagesNotVisible'
            ]
        )
        formatted = {
            'waiting': response.get('Attributes', {}).get('ApproximateNumberOfMessages'),
            'inflight': response.get('Attributes', {}).get('ApproximateNumberOfMessagesNotVisible')
        }
        return formatted['waiting'], formatted['inflight']

    def receive_messages(self, batch_size=None):
        """ Returns an array of messages, if any that are waiting

            :param batch_size: an integer number of messages
            :returns: messages received or [] if no messages were ready to be received
        """
        response = self.client.receive_message(
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=self.batch_size if batch_size is None else batch_size
        )
        return response.get('Messages', [])

    def clear_queue(self):
        """ Clears the queue by receiving all messages. BE CAREFUL as this has potential to
            infinite loop under certain conditions. This risk is preferred to using 'purge', which
            has a long timeout. The guarantees this functions provides are minimal at best - it should
            really only be used in testing.
        """
        while True:
            messages = self.receive_messages()
            self.delete_messages(messages)
            if len(messages) == 0:
                break


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

    @staticmethod
    def build_variant_link(variant):
        """ This function takes a variant record and returns the corresponding UUID of this variant
            in the portal via search.
        """
        annotation_id = build_variant_display_title(variant['CHROM'], variant['POS'], variant['REF'], variant['ALT'],
                                                    sep=ANNOTATION_ID_SEP)
        return annotation_id

    def build_and_post_variant(self, parser, record, project, institution):
        """ Helper method for below that builds and posts a variant item given a record """
        variant = parser.create_variant_from_record(record)
        variant['project'] = project
        variant['institution'] = institution
        variant['status'] = SHARED  # default variant status to shared, so visible to everyone
        parser.format_variant_sub_embedded_objects(variant)
        add_last_modified(variant, userid=LOADXL_USER_UUID)
        try:
            self.vapp.post_json('/variant', variant, status=201)
        except Exception:  # XXX: HTTPConflict is thrown and should be caught but does not work
            self.vapp.patch_json('/variant/%s' % build_variant_display_title(
                variant['CHROM'],
                variant['POS'],
                variant['REF'],
                variant['ALT'],
                sep=ANNOTATION_ID_SEP
            ), variant, status=200)
        return variant

    def build_and_post_variant_samples(self, parser, record, project, institution, variant, file, sample_relations):
        """ Helper method that builds and posts all variant_samples associated with a record

            :param parser: handle to VCF Parser
            :param record: record to parse
            :param project: project to associate with samples
            :param institution: institution to associate with samples
            :param variant: associated variant metadata
            :param file: vcf file accession
            :param sample_relations: dictionary mapping call_info -> familial relation
        """
        if variant is None:
            return
        variant_samples = parser.create_sample_variant_from_record(record)
        for sample in variant_samples:
            try:
                sample['project'] = project
                sample['institution'] = institution
                sample['variant'] = self.build_variant_link(variant)  # make links
                sample['file'] = file

                # add familial relations to samplegeno field
                for geno in sample.get('samplegeno', []):
                    sample_id = geno['samplegeno_sampleid']
                    if sample_id in sample_relations:
                        geno.update(sample_relations[sample_id])

                # add inheritance mode information
                variant_name = sample['variant']
                chrom = variant_name[variant_name.index('chr') + 3]  # find chr* and get *
                sample.update(InheritanceMode.compute_inheritance_modes(sample, chrom=chrom))
                add_last_modified(variant, userid=LOADXL_USER_UUID)
                self.vapp.post_json('/variant_sample', sample, status=201)
            except Exception as e:
                debuglog('Encountered exception posting variant_sample: %s' % e)
                raise  # propagate/report if error occurs here

    def search_for_sample_relations(self, vcf_file_accession):
        """ Helper function for below that handles search aspect (and can be mocked) """
        search_qs = '/search/?type=SampleProcessing&processed_files.accession=%s' % vcf_file_accession
        search_result = []
        try:
            search_result = self.vapp.get(search_qs).json['@graph']
        except Exception as e:
            log.error('No sample_processing found for this VCF! Familial relations will be absent. Error: %s' % e)
        if len(search_result) > 1:
            log.error('Ambiguous sample_processing detected for vcf %s, search: %s' % (vcf_file_accession, search_qs))
        return search_result

    def extract_sample_relations(self, vcf_file_accession):
        """ Extracts a dictionary of sample relationships based on the file metadata given. """
        search_result = self.search_for_sample_relations(vcf_file_accession)
        sample_relations = {}  # should never be None now
        if len(search_result) == 1:
            sample_procesing = search_result[0]
            sample_pedigrees = sample_procesing.get('samples_pedigree', [])
            for entry in sample_pedigrees:
                sample_id = entry['sample_name']
                sample_relations[sample_id] = {}
                for field, key in zip(['relationship', 'sex'], ['samplegeno_role', 'samplegeno_sex']):
                    value = entry.get(field, None)
                    if value is not None:
                        sample_relations[sample_id][key] = value

        return sample_relations

    def post_variants_and_variant_samples(self, parser, file_meta):
        """ Posts variants and variant_sample items given the parser and relevant
            file metadata.

            NOTE: There are variations of this code throughout other entry points, but
            the version here is THE version that should be used.

        :param parser: VCFParser to be used
        :param file_meta: metadata for the processed VCF file
        :return: 2-tuple of successful, failed number of posts
        """
        vs_project, vs_institution, file_accession = (file_meta['project']['uuid'], file_meta['institution']['uuid'],
                                                      file_meta['accession'])
        sample_relations = self.extract_sample_relations(file_accession)
        for idx, record in enumerate(parser):
            log.info('Attempting parse on record %s' % record)
            try:
                variant = self.build_and_post_variant(parser, record,
                                                      CGAP_CORE_PROJECT,  # /projects/cgap-core
                                                      CGAP_CORE_INSTITUTION)  # /institutions/hms-dbmi/
                self.build_and_post_variant_samples(parser, record, vs_project, vs_institution, variant, file_accession,
                                                    sample_relations)
                self.ingestion_report.mark_success()
            except Exception as e:  # ANNOTATION spec validation error, recoverable
                debuglog('Encountered exception posting variant at row %s: %s ' % (idx, e))
                self.ingestion_report.mark_failure(body=str(e), row=idx)

        return self.ingestion_report.total_successful(), self.ingestion_report.total_error()

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
                parser = VCFParser(None, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA,
                                   reader=Reader(fsock=decoded_content.split('\n')))
                success, error = self.post_variants_and_variant_samples(parser, file_meta)

                # if we had no errors, patch the file status to 'Ingested'
                if error > 0:
                    self.set_status(uuid, STATUS_ERROR)
                    self.patch_ingestion_report(uuid)
                else:
                    self.set_status(uuid, STATUS_INGESTED)

                # report results in error_log regardless of status
                msg = str(self.ingestion_report)
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
