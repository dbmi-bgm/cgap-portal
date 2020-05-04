import json
import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from tqdm import tqdm


EPILOG = __doc__
logger = logging.getLogger(__name__)


class GeneIngestion(object):
    """ Class that encapsulates data/methods for ingesting genes.
        Note that this consists of nothing except a reference to the file containing
        JSON and some Python operators that make manipulation convenient.
    """
    GENE_ENDPOINT = '/gene'

    def __init__(self, location):
        """ Note that this load could potentially be very expensive. Should not be done
            ever as part of a request.
        """
        self.genes_to_ingest = json.load(open(location, 'r'))

    def __len__(self):
        return len(self.genes_to_ingest)

    def __iter__(self):
        for gene in self.genes_to_ingest:
            yield gene

    def __getitem__(self, item):
        return self.genes_to_ingest[item]

    def upload(self, vapp, project=None, institution=None, use_tqdm=False):
        """ Uploads all (or some if a failure occurs) of the genes

        :param vapp: VirtualApp from dcicutils to post to
        :param project: project to attach to these genes
        :param institution: institution to attach to these genes
        :param use_tqdm: boolean on whether or not to show a progress bar
        :raises: VirtualAppError if a post is unsuccessful
        """
        if use_tqdm:
            _iter = tqdm(self.genes_to_ingest, unit='genes')
        else:
            _iter = self.genes_to_ingest
        for gene in _iter:
            if project:
                gene['project'] = project
            if institution:
                gene['institution'] = institution
            vapp.post_json(self.GENE_ENDPOINT, gene, status=201)


def main():
    """
        Main entry point for gene ingestion.

        Args (viar argparse):
            path_to_genes (str): path to genes to ingest
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Ingests a given gene file containing JSON formatted genes",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('genes', help='path to genes.json')
    parser.add_argument('config_uri', help='path to configfile')  # to get app
    parser.add_argument('--app-name', help='Pyramid app name in configfile')  # to get app
    args = parser.parse_args()

    logger.info('Ingesting gene file: %s' % args.genes)
    gene_parser = GeneIngestion(args.genes)
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',  # XXX: This should be changed
    }
    vapp = VirtualApp(get_app(args.config_uri, args.app_name), environ)
    try:
        gene_parser.upload(vapp)
        logger.info('Successfully posted genes')
    except Exception as e:
        logger.error('Exception encountered during gene ingestion: %s' % str(e))
    exit(0)


if __name__ == '__main__':
    main()
