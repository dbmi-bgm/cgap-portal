import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from ..ingestion.common import CGAP_CORE_INSTITUTION, CGAP_CORE_PROJECT
from ..ingestion.gene_utils import GeneIngestion


EPILOG = __doc__
logger = logging.getLogger(__name__)


def main():
    """
        Main entry point for gene ingestion. Always attributes genes to the CGAP_CORE_PROJECT
        and CGAP_CORE_INSTITUTION as defined in ..ingestion_listener.py

        Args (viar argparse):
            path_to_genes (str): path to genes to ingest
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
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
        gene_parser.upload(vapp, project=CGAP_CORE_PROJECT, institution=CGAP_CORE_INSTITUTION, use_tqdm=True)
        logger.info('Successfully posted genes')
    except Exception as e:
        logger.error('Exception encountered during gene ingestion: %s' % str(e))
    exit(0)


if __name__ == '__main__':
    main()
