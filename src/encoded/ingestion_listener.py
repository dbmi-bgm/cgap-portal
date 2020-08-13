import os
import boto3
import time
import socket
import argparse
import structlog
import datetime
import json
import atexit
import threading
import signal
import psycopg2
import webtest
import elasticsearch
import requests  # XXX: C4-211 should not be needed but is
from vcf import Reader
from pyramid import paster
from dcicutils.misc_utils import VirtualApp
from pyramid.view import view_config
from pyramid.httpexceptions import HTTPConflict, HTTPNotFound
from pyramid.request import Request
from snovault.util import debug_log
from .util import resolve_file_path, gunzip_content
from .commands.ingest_vcf import VCFParser
from .types.variant import build_variant_display_title, ANNOTATION_ID_SEP


log = structlog.getLogger(__name__)
EPILOG = __doc__
INGESTION_QUEUE = 'ingestion_queue'
VARIANT_SCHEMA = resolve_file_path('./schemas/variant.json')
VARIANT_SAMPLE_SCHEMA = resolve_file_path('./schemas/variant_sample.json')
STATUS_QUEUED = 'Queued'
STATUS_INGESTED = 'Ingested'


def includeme(config):
    config.add_route('queue_ingestion', '/queue_ingestion')
    config.add_route('ingestion_status', '/ingestion_status')
    config.registry[INGESTION_QUEUE] = IngestionQueueManager(config.registry)
    config.scan(__name__)


@view_config(route_name='ingestion_status', request_method='GET', permission='index')
@debug_log
def ingestion_status(context, request):
    """ Status route, essentially identical to indexing_status. """
    queue_manager = request.registry[INGESTION_QUEUE]
    n_waiting, n_inflight = queue_manager.get_counts()
    return {
        'title': 'Ingestion Status',
        'waiting': n_waiting,
        'inflight': n_inflight
    }


def patch_vcf_file_status(request, uuids):
    """ Patches VCF File status to 'Queued'
        NOTE: This process makes queue_ingestion not scale terribly well.
              Batching above a certain number may result in 504. There are
              also permissions concerns here that are not dealt with.
    """
    for uuid in uuids:
        kwargs = {
            'method': 'PATCH',
            'content_type': 'application/json',
            'POST': json.dumps({
                'file_ingestion_status': STATUS_QUEUED
            }).encode('utf-8')
        }
        subreq = Request.blank('/' + uuid, **kwargs)
        resp = None
        try:
            resp = request.invoke_subrequest(subreq)
        except HTTPNotFound:
            log.error('Tried to patch %s but item does not exist: %s' % (uuid, resp))


@view_config(route_name='queue_ingestion', request_method='POST', permission='index')
@debug_log
def queue_ingestion(context, request):
    """ Queues uuids as part of the request body for ingestion. Can batch as many as desired in a
        single request.
    """
    uuids = request.json.get('uuids', [])
    override_name = request.json.get('override_name', None)
    response = {
        'notification': 'Failure',
        'number_queued': 0,
        'detail': 'Nothing was queued. Make sure to past in a list of uuids in in "uuids" key.'
    }
    if uuids is []:
        return response
    queue_manager = (request.registry[INGESTION_QUEUE]
                     if not override_name
                     else IngestionQueueManager(request.registry, override_name=override_name))
    _, failed = queue_manager.add_uuids(uuids)
    if not failed:
        response['notification'] = 'Success'
        response['number_queued'] = len(uuids)
        response['detail'] = 'Successfully queued the following uuids: %s' % uuids
        patch_vcf_file_status(request, uuids)
    else:
        response['number_queued'] = len(uuids) - len(failed)
        response['detail'] = 'Some uuids failed: %s' % failed
    return response


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
        self.queue_name = self.env_name + self.BUCKET_EXTENSION if not override_name else override_name
        self.queue_attrs = {
            self.queue_name: {
                'DelaySeconds': '1',  # messages initially invisible for 1 sec
                'VisibilityTimeout': '600',  # 10 mins
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
        except self.client.exceptions.QueueNameExists as e:
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

    def add_uuids(self, uuids):
        """ Takes a list of string uuids (presumed to be VCF files) and adds them to
            the ingestion queue.

            :precondition: uuids are all of type FileProcessed
            :param uuids: uuids to be added to the queue.
            :returns: 2-tuple: uuids queued, failed messages (if any)
        """
        curr_time = datetime.datetime.utcnow().isoformat()
        msgs = []
        for uuid in uuids:
            current_msg = {
                'uuid': uuid, 'timestamp': curr_time
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
        if isinstance(self.vapp, webtest.TestApp):  # if in testing
            registry = self.vapp.app.registry
        elif isinstance(self.vapp, VirtualApp):  # if in production
            registry = self.vapp.wrapped_app.app.registry
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
            tries = 3
            if failed:
                if tries > 0:
                    failed = self.queue_manager.delete_messages(failed)  # try again
                    tries -= 1
                else:
                    log.error('Failed to delete messages from SQS: %s' % failed)
                    break
            else:
                break

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
        parser.format_variant_sub_embedded_objects(variant)
        try:
            self.vapp.post_json('/variant', variant, status=201)
        except HTTPConflict:
            self.vapp.patch_json('/variant/%s' % build_variant_display_title(
                variant['CHROM'],
                variant['POS'],
                variant['REF'],
                variant['ALT'],
                sep=ANNOTATION_ID_SEP
            ), variant, status=200)
        return variant

    def build_and_post_variant_samples(self, parser, record, project, institution, variant, file):
        """ Helper method that builds and posts all variant_samples associated with a record """
        if variant is None:
            return
        variant_samples = parser.create_sample_variant_from_record(record)
        for sample in variant_samples:
            try:
                sample['project'] = project
                sample['institution'] = institution
                sample['variant'] = self.build_variant_link(variant)  # make links
                sample['file'] = file
                self.vapp.post_json('/variant_sample', sample, status=201)
            except Exception as e:
                log.error('Encountered exception posting variant_sample: %s' % e)
                continue

    def post_variants_and_variant_samples(self, parser, file_meta):
        """ Posts variants and variant_sample items given the parser and relevant
            file metadata.

            NOTE: There are variations of this code throughout other entry points, but
            the version here is THE version that should be used.

        :param parser: VCFParser to be used
        :param file_meta: metadata for the processed VCF file
        :return: 2-tuple of successful, failed number of posts
        """
        success, error = 0, 0
        project, institution, file_accession = (file_meta['project']['uuid'], file_meta['institution']['uuid'],
                                                file_meta['accession'])
        for idx, record in enumerate(parser):
            log.info('Attempting parse on record %s' % record)
            try:
                variant = self.build_and_post_variant(parser, record, project, institution)
                self.build_and_post_variant_samples(parser, record, project, institution, variant, file_accession)
                success += 1
            except Exception as e:  # ANNOTATION spec validation error, recoverable
                log.error('Encountered exception posting variant at row %s: %s ' % (idx, e))
                error += 1

        return success, error

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
        while self.should_remain_online():
            messages = self.get_messages()  # wait here

            # ingest each VCF file
            for message in messages:
                body = json.loads(message['Body'])
                uuid = body['uuid']
                log.info('Ingesting uuid %s' % uuid)

                # locate file meta data
                try:
                    file_meta = self.vapp.get('/' + uuid).follow().json
                    location = self.vapp.get(file_meta['href']).location
                    log.info('Got vcf location: %s' % location)
                except Exception as e:
                    log.error('Could not locate uuid: %s with error: %s' % (uuid, e))
                    continue

                # if this file has been ingested, do not do anything with this message
                if file_meta.get('file_ingestion_status', 'N/A') == STATUS_INGESTED:
                    continue

                # attempt download with workaround
                try:
                    raw_content = requests.get(location).content
                except Exception as e:
                    log.error('Could not download file uuid: %s with error: %s' % (uuid, e))
                    continue

                # gunzip content, pass to parser, post variants/variant_samples
                decoded_content = gunzip_content(raw_content)
                log.info('Got decoded content: %s' % decoded_content[:20])
                parser = VCFParser(None, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA,
                                   reader=Reader(fsock=decoded_content.split('\n')))
                success, error = self.post_variants_and_variant_samples(parser, file_meta)

                # if we had no errors, patch the file status to 'Ingested'
                if error > 0:
                    log.error('Some VCF rows for uuid %s failed to post - not marking VCF '
                              'as ingested.' % uuid)
                else:
                    self.vapp.patch_json('/' + uuid, {'file_ingestion_status': STATUS_INGESTED})

                # report results in error_log regardless of status
                msg = ('INGESTION_REPORT:\n'
                       'Success: %s\n'
                       'Error: %s\n' % (success, error))
                log.error(msg)
                self.update_status(msg=msg)

            self.delete_messages(messages)


def run(vapp=None, _queue_manager=None, _update_status=None):
    """ Entry-point for the ingestion listener for waitress. """
    ingestion_listener = IngestionListener(vapp, _queue_manager=_queue_manager, _update_status=_update_status)
    ingestion_listener.run()


class ErrorHandlingThread(threading.Thread):
    """ Must be duplicated here so logging is correct. """

    def run(self):
        # interval = self._kwargs.get('interval', DEFAULT_INTERVAL)
        interval = 60  # DB polling can and should be slower
        update_status = self._kwargs['_update_status']
        while True:
            try:
                self._target(*self._args, **self._kwargs)
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
        status = '200 OK'
        response_headers = [('Content-type', 'application/json')]
        start_response(status, response_headers)
        return [json.dumps(status_holder['status'])]

    return status_app


# Command Application (for waitress)
def main():
    """ Entry point for the local deployment. """
    parser = argparse.ArgumentParser(
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
