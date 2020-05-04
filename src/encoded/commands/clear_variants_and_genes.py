import argparse
import structlog
import logging
from encoded.commands.purge_item_type import purge_item_type_from_storage
from pyramid.paster import get_app


logger = structlog.getLogger(__name__)
EPILOG = __doc__
ORDER = [  # this must be modified if object relationships change! -Will 05/04/2020
    'variant_sample',
    'variant',
    'annotation_field',
    'gene',
    'gene_annotation_field',
    'variant_consequence'
]


def main():
    """ Wipes the variant + gene items in appropriate order """
    logging.basicConfig()

    parser = argparse.ArgumentParser(
        description='Clear an item type out of metadata storage',
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('config_uri', help='path to configfile')
    parser.add_argument('--app-name', help='name of app', default='app')
    parser.add_argument('--prod', help='Whether or not to proceed if we are on a production server',
                        action='store_true', default=False)
    args = parser.parse_args()

    app = get_app(args.config_uri, args.app_name)
    for item_type in ORDER:
        try:
            purge_item_type_from_storage(app, item_type, prod=args.prod)
        except Exception as e:
            logger.error('Encountered exception purging item_type: %s from storage with error: %s'
                         % (item_type, str(e)))
            exit(1)
    exit(0)


if __name__ == '__main__':
    main()
