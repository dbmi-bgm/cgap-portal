import argparse
import logging
from encoded.commands.variant_table_intake import MappingTableParser
from encoded.commands.ingest_vcf import VCFParser
from dcicutils.misc_utils import VirtualApp
from pyramid.paster import get_app
from tqdm import tqdm


logger = logging.getLogger(__name__)
EPILOG = __doc__


def run_variant_table_intake(app_handle, args):
    """ Runs mapping table intake with the given args """
    parser = MappingTableParser(args.variant_table, args.variant_annotation_field_schema)
    inserts = parser.run(args.sample, args.variant, institution=args.variant_institution, project=args.variant_project,
                         write=args.write_variant_schemas)
    for entry in tqdm(inserts, unit='variant_annotation_fields'):
        app_handle.post_json('/annotation_field', entry)
    logger.info('Successfully posted annotations')
    return True


def run_ingest_vcf(app_handle, args):
    """ Runs the vcf ingestion step """
    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf, args.variant, args.sample)
    if args.post_variant_consequences:
        vcf_parser.post_variant_consequence_items(app_handle, project=args.variant_project,
                                                  institution=args.variant_institution)
    success, error = 0, 0
    if args.post_variants:
        for record in tqdm(vcf_parser, unit='variants'):
            try:
                variant = vcf_parser.create_variant_from_record(record)
                variant['project'] = args.variant_project
                variant['institution'] = args.variant_institution
                vcf_parser.format_variant_sub_embedded_objects(variant)
                res = app_handle.post_json('/variant', variant, status=201).json['@graph'][0]  # only one item posted
                success += 1
            except:  # validation error
                import pdb; pdb.set_trace()
                error += 1
                continue
            variant_samples = vcf_parser.create_sample_variant_from_record(record)
            for sample in variant_samples:
                sample['project'] = args.variant_project
                sample['institution'] = args.variant_institution
                sample['variant'] = res['@id']  # make link
                app_handle.post_json('/variant_sample', sample, status=201)

        logger.warning('Succesfully posted %s VCF entries, errors: %s' % (success, error))
    return True


def main():
    """
    Variant Ingestion Program

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
    parser = argparse.ArgumentParser(
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
    parser.add_argument('--write-variant-schemas', action='store_true', default=True,
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
        logger.info('Got exception in variant ingestion: %s' % str(e))
    # XXX: Catch more exceptions
    exit(1)


if __name__ == "__main__":
    main()
