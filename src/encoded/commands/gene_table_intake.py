import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from ..ingestion.table_utils import GeneTableParser

logger = logging.getLogger(__name__)
EPILOG = __doc__


def main():
    """ Takes in the gene mapping table, produces + posts gene annotation fields and
        writes the gene schema.

        Below command will post on local machine
        python src/encoded/commands/gene_table_intake.py \
               src/encoded/tests/data/variant_workbook/gene_table.csv \
               src/encoded/schemas/gene_annotation_field.json \
               src/encoded/schemas/gene.json development.ini --app-name app --post-inserts
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Takes in a variant mapping table and produces variant related inserts/schemas",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('gene_table', help='path to gene table')
    parser.add_argument('gene_annotation_field_schema', help='path to gene annotation field schema')
    parser.add_argument('gene', help='where to write gene schema')
    parser.add_argument('config_uri', help='path to app configfile')
    parser.add_argument('--app-name', help='Pyramid app name in configfile')
    parser.add_argument('--write-schema', action='store_true', default=False,
                        help='If specified will write schema to location')
    parser.add_argument('--post-inserts', action='store_true', default=False,
                        help='If specified will post inserts to portal')
    args = parser.parse_args()

    # read/process gene table, build inserts
    logger.info('Building gene annotation fields from mapping table %s' % args.gene_table)
    parser = GeneTableParser(args.gene_table, args.gene_annotation_field_schema)
    inserts = parser.run(gs_out=args.gene, write=args.write_schema)

    # if not a dry run try to post inserts
    if args.post_inserts:
        environ = {
            'HTTP_ACCEPT': 'application/json',
            'REMOTE_USER': 'TEST',
        }
        app = get_app(args.config_uri, args.app_name)
        app_handle = VirtualApp(app, environ)
        for entry in inserts:
            app_handle.post_json('/gene_annotation_field', entry)
        logger.info('Successfully posted gene annotations')


if __name__ == '__main__':
    main()
