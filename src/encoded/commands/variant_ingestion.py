import argparse
import logging
from mapping_table_intake import MappingTableParser
from ingest_vcf import VCFParser

logger = logging.getLogger(__name__)
EPILOG = __doc__
environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
}


def run_mapping_table_intake(args):
    """ Runs mapping table intake with the given args """
    from pyramid.paster import get_app
    from webtest import TestApp
    parser = MappingTableParser(args.mp, args.annotation_field_schema)
    inserts = parser.run(args.sample, args.variant, institution=args.institution, project=args.project,
                         write=args.write_schemas)
    app = get_app(args.config_uri, args.app_name)
    testapp = TestApp(app, environ)
    for entry in inserts:
        testapp.post_json('/annotation_field', entry)
    logger.info('Successfully posted annotations')


def run_ingest_vcf(args):
    """ Runs the vcf ingestion step """
    from pyramid.paster import get_app
    from webtest import TestApp
    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf, args.variant, args.sample)
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    app = get_app(args.config_uri, args.app_name)
    testapp = TestApp(app, environ)
    if args.post_variant_consequences:
        vcf_parser.post_variant_consequence_items(testapp, project=args.project, institution=args.institution)
    if args.post_variants:
        for record in vcf_parser:
            variant = vcf_parser.create_variant_from_record(record)
            variant['project'] = args.project
            variant['institution'] = args.institution
            vcf_parser.format_variant(variant)
            res = testapp.post_json('/variant', variant, status=201).json['@graph'][0]  # only one item posted
            variant_samples = vcf_parser.create_sample_variant_from_record(record)
            for sample in variant_samples:
                sample['project'] = args.project
                sample['institution'] = args.institution
                sample['variant'] = res['@id']  # make link
                testapp.post_json('/variant_sample', sample, status=201)

        logger.info('Succesfully posted VCF entries')


def main():
    """ Document me pls """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Variant Ingestion Program",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--skip-mp', help='Skip the mapping table intake step. \n \
                                           Do this if no changes have been made to the mapping table',
                        default=False, action='store_true')
    parser.add_argument('mp', help='path to mapping table')
    parser.add_argument('annotation_field_schema', help='path to annotation field schema')
    parser.add_argument('variant', help='where to write variant schema')
    parser.add_argument('sample', help='where to write sample_variant schema')

    parser.add_argument('vcf', help='path to vcf file')
    parser.add_argument('project', help='project to post inserts under')
    parser.add_argument('institution', help='institution to post inserts under')
    parser.add_argument('config_uri', help="path to configfile")  # to get app
    parser.add_argument('--write-schemas', action='store_true', default=True,
                        help='If specified will write new schemas to given locations')
    parser.add_argument('--app-name', help="Pyramid app name in configfile")  # to get app
    parser.add_argument('--post-variants', action='store_true', default=False,
                        help='If specified, will post variant/variant sample inserts, by default False.')
    parser.add_argument('--post-variant-consequences', action='store_true', default=False,
                        help='If specified will post all VariantConsequence items. Required only once.')
    args = parser.parse_args()

    if not args.skip_mp:
        run_mapping_table_intake(args)
    run_ingest_vcf(args)


if __name__ == "__main__":
    main()