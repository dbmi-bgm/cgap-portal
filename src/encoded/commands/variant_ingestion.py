import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from ..ingestion.table_utils import VariantTableParser
from ..ingestion.vcf_utils import VCFParser
from ..ingestion.variant_utils import VariantBuilder


logger = logging.getLogger(__name__)
EPILOG = __doc__


def run_variant_table_intake(app_handle, args):
    """ Runs mapping table intake with the given args """
    parser = VariantTableParser(args.variant_table, args.variant_annotation_field_schema)
    inserts = parser.run(args.sample, args.variant, institution=args.variant_institution, project=args.variant_project,
                         write=args.write_variant_schemas)
    # XXX: make configurable
    # for entry in tqdm(inserts, unit='variant_annotation_fields'):
    #     app_handle.post_json('/annotation_field', entry)
    logger.info('Successfully posted annotations')
    return True


def run_ingest_vcf(app_handle, args):
    """ Runs the vcf ingestion step """
    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf, args.variant, args.sample)
    if args.post_variant_consequences:
        vcf_parser.post_variant_consequence_items(app_handle, project=args.variant_project,
                                                  institution=args.variant_institution)
    if args.post_variants:
        VariantBuilder(app_handle, vcf_parser, args.file_name, args.project, args.institution).ingest_vcf(use_tqdm=True)
    return True


def main():
    """
    Variant Ingestion Program. This is a one time operation per VCF. If mapping table changes are made (that are
    incompatible) an upgrader must be written for items on the portal or all VCFs must be re-annotated and re-ingested.

    positional arguments:
        mp              path to variant mapping table
        annotation_field_schema
                        path to annotation field schema
        variant         where to write variant schema
        sample          where to write sample_variant schema
        vcf             path to vcf file
        project         project to post inserts under
        institution     institution to post inserts under
        config_uri      path to configfile

    optional arguments:
        -h, --help      show this help message and exit
        --skip-mp       Skip the mapping table intake step. Do this if no
                        changes have been made to the mapping table
        --write-schemas If specified will write new schemas to given locations
        --app-name APP_NAME   Pyramid app name in configfile
        --post-variants If specified, will post variant/variant sample
                        inserts, by default False.
        --post-variant-consequences
                        If specified will post all VariantConsequence items.
                        Required only once.

    NOTE: This usage will run the entire end to end process
        - poetry run variant-ingestion
            src/encoded/tests/data/variant_workbook/variant_table.csv
            src/encoded/schemas/annotation_field.json
            src/encoded/schemas/variant.json
            src/encoded/schemas/variant_sample.json
            src/encoded/tests/data/variant_workbook/test_vcf.vcf
            hms-dbmi hms-dbmi development.ini
            --post-variants --post-variant-consequences

    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Variant Ingestion Program",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--skip-mp', help='Skip the mapping table intake step. \n \
                                           Do this if no changes have been made to the mapping table',
                        default=False, action='store_true')
    parser.add_argument('variant_table', help='path to mapping table')
    parser.add_argument('variant_annotation_field_schema', help='path to annotation field schema')
    parser.add_argument('variant', help='where to write variant schema')
    parser.add_argument('sample', help='where to write sample_variant schema')
    parser.add_argument('vcf', help='path to vcf file')
    parser.add_argument('variant_project', help='project to post inserts under')
    parser.add_argument('variant_institution', help='institution to post inserts under')
    parser.add_argument('config_uri', help="path to configfile")  # to get app
    parser.add_argument('--write-variant-schemas', action='store_true', default=False,
                        help='If specified will write new schemas to given locations')
    parser.add_argument('--app-name', help="Pyramid app name in configfile")  # to get app
    parser.add_argument('--post-variants', action='store_true', default=False,
                        help='If specified, will post variant/variant sample inserts, by default False.')
    parser.add_argument('--post-variant-consequences', action='store_true', default=False,
                        help='If specified will post all VariantConsequence items. Required only once.')
    args = parser.parse_args()

    # initialize VirtualApp
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
        'indexer': 'false'
    }
    app = get_app(args.config_uri, args.app_name)
    app_handle = VirtualApp(app, environ)

    try:
        if not args.skip_mp:
            run_variant_table_intake(app_handle, args)
        run_ingest_vcf(app_handle, args)
        exit(0)
    except Exception as e:
        logger.error('Got exception in variant ingestion: %s' % e)
    # XXX: Catch more exceptions
    exit(1)


if __name__ == "__main__":
    main()
