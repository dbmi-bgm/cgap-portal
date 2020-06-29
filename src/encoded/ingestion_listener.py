import os
import boto3
import socket
import argparse
import structlog
from pyramid.view import view_config
from snovault.util import debug_log
from snovault.elasticsearch.es_index_listener import internal_app


log = structlog.getLogger(__name__)
EPILOG = __doc__


def includeme(config):
    config.add_route('queue_ingestion', '/queue_ingestion')
    config.add_route('ingestion_status', '/ingestion_status')
    env_name = config.registry.settings.get('env.name')
    sqs_url = os.environ.get('SQS_URL', None)


@view_config(route_name='ingestion_status', request_method='POST', permission='index')
@debug_log
def ingestion_status(context, request):
    """ Status route, essentially identical to indexing_status. """
    pass


@view_config(route_name='queue_ingestion', request_method='POST', permission='index')
@debug_log
def queue_ingestion(context, request):
    """ Queues uuids as part of the request body for ingestion. Can batch as many as desired in a
        single request.
    """
    pass


class IngestionQueueManager:
    """
    Similar to QueueManager in snovault in that in manages SQS queues, but that code is not generic
    enough to use here, so it is "duplicated" so to speak here. At a later time the functionality of this
    class and QueueManager should be refactored into a "helper" class, but for now this is sufficient
    and is tested independently here.

    We will use a single queue to keep track of VCF File uuids to be indexed.
    """

    def __init__(self, registry):
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
        self.queue_name = self.env_name + '-vcfs'
        self.queue_attrs = {
            self.queue_name: {
                'DelaySeconds': '1',  # messages initially invisible for 1 sec
                'VisibilityTimeout': '600',
                'MessageRetentionPeriod': '1209600',  # 14 days, in seconds
                'ReceiveMessageWaitTimeSeconds': '2',  # 2 seconds of long polling
            }
        }
        self._initialize()

    def _initialize(self):
        """ Initializes the actual queue - helper method for init """
        pass


def run(vapp):
    """ Entry-point for the ingestion listener. """
    pass


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
