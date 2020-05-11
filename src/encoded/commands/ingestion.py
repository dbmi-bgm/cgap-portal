import os
import argparse
import logging
from encoded.commands.variant_ingestion import run_variant_table_intake, run_ingest_vcf
from encoded.commands.gene_ingestion import run_gene_table_intake, run_ingest_genes
from dcicutils.misc_utils import VirtualApp
from dcicutils.env_utils import CGAP_ENV_DEV
from pyramid.paster import get_app


logger = logging.getLogger(__name__)
EPILOG = __doc__


def validate_files_exist(args):
    """ Validates that the files we care about (passed through args) are actually present, that way we don't
        run through a (potentially long) step only to File Not Found
    """
    assert os.path.exists(args.variant_table)
    assert os.path.exists(args.variant_annotation_field_schema)
    assert os.path.exists(args.vcf)
    assert os.path.exists(args.gene_table)
    assert os.path.exists(args.gene_annotation_field_schema)
    assert os.path.exists(args.gene_list)


def main():
    """ Main entry point for interacting with ingested items from the annotation server.
        Invokes the variant, then gene ingestion process subject to appropriate options.
        The options allow for significant customization of the process.

        Code Structure in terms of usage
                                    ingestion.py (end-to-end)
                ________________________|___________________________
               |                                                    |
               |                                                    |
          variant_ingestion                                  gene_ingestion.py
               |                                                        |
               |                                                        |
        _______|______________________                         _________|______________
       |                              |                       |                        |
       |                              |                       |                        |
    variant_table_intake.py       ingest_vcf.py      gene_table_intake.py          ingest_genes.py

    The only inheritance occurs in gene_table_intake, who inherits from variant_table_intake.
    Each Python file has a entry point that allows you to run its 'sub-part' of the 'whole'.
    The idea is to provide as many 'knobs' as possible.
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Runs the ingestion process on this server, subject to arguments",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Variant-related required arguments
    # Note that default is not used since these are required arguments, so you still have to provide
    # an argument, but manually combining all 'defaults' will give you an end-to-end
    # run after a fresh "make deploy1" -Will
    parser.add_argument('variant_table', help='path to variant mapping table',
                        default='src/encoded/tests/data/variant_workbook/variant_table.csv')
    parser.add_argument('variant_annotation_field_schema', help='path to variant annotation field schema',
                        default='src/encoded/schemas/annotation_field.json')
    parser.add_argument('variant', help='where to write variant schema',
                        default='src/encoded/schemas/variant.json')
    parser.add_argument('sample', help='where to write sample_variant schema',
                        default='src/encoded/schemas/variant_sample.json')
    parser.add_argument('vcf', help='path to vcf file',
                        default='src/encoded/tests/data/variant_workbook/test_vcf.vcf')
    parser.add_argument('variant_project', help='project to post inserts under',
                        default='hms-dbmi')
    parser.add_argument('variant_institution', help='institution to post inserts under',
                        default='hms-dbmi')

    # Variant-related optional arguments
    parser.add_argument('--write-variant-schemas', action='store_true', default=False,
                        help='If specified will write new variant + variant sample schemas to given locations')
    parser.add_argument('--post-variants', action='store_true', default=False,
                        help='If specified, will post variant/variant sample inserts, by default False.')
    parser.add_argument('--post-variant-consequences', action='store_true', default=False,
                        help='If specified will post all VariantConsequence items. Required only once.')

    # Gene-related required arguments
    parser.add_argument('gene_table', help='path to gene table',
                        default='src/encoded/tests/data/variant_workbook/gene_table.csv')
    parser.add_argument('gene_annotation_field_schema', help='path to gene annotation field schema',
                        default='src/encoded/schemas/gene_annotation_field.json')
    parser.add_argument('gene', help='where to write gene schema',
                        default='src/encoded/schemas/gene.json')
    parser.add_argument('gene_list', help='path to gene_list.json',
                        default='src/encoded/tests/data/variant_workbook/gene_inserts_v0.4.4.json')
    parser.add_argument('gene_project', help='project to post inserts under',
                        default='hms-dbmi')
    parser.add_argument('gene_institution', help='institution to post inserts under',
                        default='hms-dbmi')

    # Gene-related optional arguments
    parser.add_argument('--write-gene-schema', help='provide to write a new gene schema',
                        action='store_true', default=False)
    parser.add_argument('--post-gene-annotation-field-inserts', help='provide to post gene annotation field inserts',
                        action='store_true', default=False)
    parser.add_argument('--post-gene-inserts', action='store_true', default=False,
                        help='If specified will post gene inserts to portal')

    # Required application-level arguments
    parser.add_argument('config_uri', help="path to configfile",
                        default='development.ini')  # to get app

    # Optional application-level arguments
    parser.add_argument('--app-name', help="Pyramid app name in configfile")  # to get app

    args = parser.parse_args()
    validate_files_exist(args)  # throw assertion error here if we gave a bad file anywhere

    # initialize VirtualApp
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
        'indexer': 'false'
    }
    app = get_app(args.config_uri, args.app_name)
    app_bs_env = app.registry.settings.get('env.name', 'local')
    if app_bs_env not in [CGAP_ENV_DEV, 'local']:
        print('Tried to run ingestion not on cgapdev, which is temporarily disabled.')
        exit(1)
    app_handle = VirtualApp(app, environ)
    gene_ingestion_result = run_gene_table_intake(app_handle, args) and run_ingest_genes(app_handle, args)
    if gene_ingestion_result is True:
        variant_ingestion_result = run_variant_table_intake(app_handle, args) and run_ingest_vcf(app_handle, args)
    if variant_ingestion_result is True:
        logger.warning('Successfully finished end-to-end ingestion!')
        exit(0)

    exit(1)  # if we got to this point, something went wrong


if __name__ == '__main__':
    main()
