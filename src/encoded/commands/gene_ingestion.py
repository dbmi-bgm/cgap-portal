import sys
import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from encoded.commands.gene_table_intake import GeneTableParser, GeneTableIntakeException
from encoded.commands.ingest_genes import GeneIngestion
from tqdm import tqdm

logger = logging.getLogger(__name__)
EPILOG = __doc__


def run_gene_table_intake(app_handle, args):
    """ Wrapper method that runs the gene_table_intake step """
    # read/process gene table, build inserts
    logger.info('Building gene annotation fields from mapping table %s' % args.gene_table)
    parser = GeneTableParser(args.gene_table, args.gene_annotation_field_schema)
    inserts = parser.run(gs_out=args.gene, write=args.write_gene_schema)

    # if desired, post annotation fields
    if args.post_gene_annotation_field_inserts:
        for entry in tqdm(inserts, unit='gene_annotation_fields'):
            try:
                app_handle.post_json('/gene_annotation_field', entry)
            except GeneTableIntakeException as e:
                logger.error('Parsing exception encountered while posting annotation field: %s\n '
                             'Error: %s\n' % (entry, str(e)))
                return False
            except Exception as e:
                logger.error('Generic exception encountered while posting annotation field: %s\n '
                             'Error: %s\n' % (entry, str(e)))
                return False
        logger.info('Successfully posted gene annotations')
    return True


def run_ingest_genes(app_handle, args):
    """ Wrapper method that contains the main functionality needed to post genes """
    # if desired (not doing a dry run), post inserts
    if args.post_gene_inserts:
        logger.info('Ingesting gene file: %s' % args.gene_list)
        gene_parser = GeneIngestion(args.gene_list)
        try:
            gene_parser.upload(app_handle, project=args.gene_project, institution=args.gene_institution, use_tqdm=True)
        except Exception as e:
            logger.error('Generic exception encountered while uploading genes: %s' % str(e))
            return False
    return True


def main():
    """
    Gene Ingestion Program

    positional arguments:
        mp              path to gene mapping table
        annotation_field_schema
                        path to *gene* annotation field schema
        gene            where to write gene schema
        gene_list       path to gene_list.json
        project         project to post inserts under
        institution     institution to post inserts under
        config_uri      path to configfile

    To run on local (after make deploy1 + make deploy2):
        poetry run gene-ingestion
        src/encoded/tests/data/variant_workbook/gene_table.csv
        src/encoded/schemas/gene_annotation_field.json
        src/encoded/schemas/gene.json
        src/encoded/tests/data/variant_workbook/gene_inserts_v0.4.4.json
        development.ini hms-dbmi hms-dbmi
        --app-name app --post-annotation-field-inserts --post-inserts
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Takes in a gene mapping table and produces inserts/schemas",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('gene_table', help='path to gene table')
    parser.add_argument('gene_annotation_field_schema', help='path to gene annotation field schema')
    parser.add_argument('gene', help='where to write gene schema')
    parser.add_argument('gene_list', help='path to gene_list.json')
    parser.add_argument('config_uri', help='path to app configfile')  # to get app
    parser.add_argument('project', help='project to post inserts under')
    parser.add_argument('institution', help='institution to post inserts under')
    parser.add_argument('--app-name', help='Pyramid app name in configfile')  # to get app
    parser.add_argument('--write-gene-schema', help='provide to write a new gene schema',
                        action='store_true', default=False)
    parser.add_argument('--post-gene-annotation-field-inserts', help='provide to post gene annotation field inserts',
                        action='store_true', default=False)
    parser.add_argument('--post-gene-inserts', action='store_true', default=False,
                        help='If specified will post gene inserts to portal')
    args = parser.parse_args()

    # initialize VirtualApp
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
        'indexer': 'false'
    }
    app = get_app(args.config_uri, args.app_name)
    app_handle = VirtualApp(app, environ)
    sys.exit(run_gene_table_intake(app_handle, args) and run_ingest_genes(app_handle, args))

if __name__ == '__main__':
    main()
