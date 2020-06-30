import os
import boto3
import time
import socket
import argparse
import structlog
import datetime
import json
from botocore.exceptions import ClientError
from pyramid.view import view_config
from dcicutils.misc_utils import VirtualApp
from snovault.util import debug_log
from snovault.elasticsearch.es_index_listener import internal_app
from snovault.elasticsearch.interfaces import ELASTIC_SEARCH


log = structlog.getLogger(__name__)
EPILOG = __doc__
DEFAULT_INTERVAL = 10  # seconds between each poll
INFLIGHT_INTERVAL = 3  # seconds if we detect messages in flight
INGESTION_QUEUE = 'ingestion_queue'


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
        'waiting': n_waiting,
        'inflight': n_inflight
    }


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
    queue_manager = request.registry[INGESTION_QUEUE] if not override_name \
        else IngestionQueueManager(request.registry, override_name=override_name)
    _, failed = queue_manager.add_uuids(uuids)
    if not failed:
        response['notification'] = 'Success'
        response['number_queued'] = len(uuids)
        response['detail'] = 'Successfully queued the following uuids: %s' % uuids
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

    def __init__(self, registry, override_name=None):
        """ Does initial setup for interacting with SQS """
        self.send_batch_size = 10
        self.receive_batch_size = 10
        self.delete_batch_size = 10
        self.replace_batch_size = 10
        self.env_name = registry.settings.get('env.name', None)
        if not self.env_name:  # replace with something usable
            backup = socket.gethostname()[:80].replace('.', '-')
            self.env_name = backup if backup else 'cgap-backup'
        kwargs = {
            'region_name': 'us-east-1'
        }
        self.client = boto3.client('sqs', **kwargs)
        self.queue_name = self.env_name + '-vcfs' if not override_name else override_name
        self.queue_attrs = {
            self.queue_name: {
                'DelaySeconds': '1',  # messages initially invisible for 1 sec
                'VisibilityTimeout': '600',
                'MessageRetentionPeriod': '1209600',  # 14 days, in seconds
                'ReceiveMessageWaitTimeSeconds': '2',  # 2 seconds of long polling
            }
        }
        self.queue_url = self._initialize()

    def _initialize(self):
        """ Initializes the actual queue - helper method for init """
        queue_url = None
        try:
            response = self.client.create_queue(
                QueueName=self.queue_name,
                Attributes=self.queue_attrs[self.queue_name]
            )
            queue_url = response['QueueUrl']
        # except self.client.exceptions.QueueAlreadyExists:
        #     # try to get queue url again
        #     queue_url = self._get_queue_url(self.queue_name)
        except Exception as e:
            log.error('Could not create queue with error %s' % e)
        return queue_url

    def _get_queue_url(self, queue_name):
        """
        Simple function that returns url of associated queue name
        """
        try:
            response = self.client.get_queue_url(
                QueueName=queue_name
            )
        except Exception:
            response = {}
        return response.get('QueueUrl')

    def _chunk_messages(self, msgs):
        """ Chunks messages into self.send_batch_size batches (for efficiency).

        :param msgs: list of messages to be chunked
        """
        for i in range(0, len(msgs), self.send_batch_size):
            yield msgs[i:i + self.send_batch_size]

    def _send_messages(self, msgs, retries=3):
        """ Sends msgs to the ingestion queue.

        :param msgs: to be sent
        :param retries: number of times to resend failed messages, decremented on recursion
        :return: list of any failed messages
        """
        failed = []
        for msg_batch in self._chunk_messages(msgs):
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

    def add_uuids(self, uuids):
        """ Takes a list of string uuids (presumed to be VCF files) and adds them to
            the ingestion queue.
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
        """
        response = self.client.get_queue_attributes(
            QueueUrl=self.queue_name,
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

    def receive_messages(self):
        """ Returns an array of messages, if any that are waiting """
        response = self.client.receive_message(
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=self.receive_batch_size
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
            if len(messages) == 0:
                break


def should_remain_online(override=None):
    """ A function that says whether 'run' should continue. This is provided because it
        can be mocked in testing.

        :param override: a lambda that will execute when evaluating if specified
        :return: True if should stay running, False otherwise
    """
    if not override:
        return True
    return override()


def run(vapp):
    """ Entry-point for the ingestion listener. """
    log.info('Ingestion Listener starting...')

    # ensure ES is up to date. Note that this operation in effect SLOWS Elasticsearch
    # we should investigate whether this is really necessary -Will 06/30/2020
    es = vapp.app.registry[ELASTIC_SEARCH]
    es.info()

    queue_manager = IngestionQueueManager(vapp.app.registry)

    while should_remain_online():
        n_waiting, n_in_flight = queue_manager.get_counts()
        if n_waiting == 0 and n_in_flight > 0:
            time.sleep(INFLIGHT_INTERVAL)
        elif n_waiting == 0:
            time.sleep(DEFAULT_INTERVAL)
        else:
            messages = queue_manager.receive_messages()

            # ingest each VCF file
            for message in messages:
                # get the uuid
                import pdb; pdb.set_trace()


def main():
    parser = argparse.ArgumentParser(
        description='Listen for VCF File uuids to ingest',
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--app-name', help='Pyramid app name in configfile')
    parser.add_argument('--username', '-u', default='INDEXER', help='Import username')
    parser.add_argument('--dry-run', action='store_true', help='Do not post variants, just validate')
    parser.add_argument('config_uri', help="path to configfile")
    args = parser.parse_args()

    vapp = internal_app(args.config_uri, args.app_name, args.username)
    return run(vapp)


if __name__ == '__main__':
    main()
