import logging
import argparse
from ..ingestion.vcf_utils import VCFParser


logger = logging.getLogger(__name__)
EPILOG = __doc__


def main():
    """ Main, ingests VCF and posts if args specified.

        NOTE: is currently a no-op if inserts are not being posted

        Args (via argparse):
            vcf: path to vcf file to parse
            variant: path to variant.json schema
            sample: path to variant_sample.json schema
            project: project to post inserts under
            institution: institution to post inserts under
            --post-inserts: If specified, will post inserts, by default False

            config_uri: path to app config, usually 'production.ini'
            --app-name: app name, usually 'app'

        local update:
            python src/encoded/commands/ingest_vcf.py \
                src/encoded/tests/data/variant_workbook/vcf_v0.4.6_subset.vcf \
                src/encoded/schemas/variant.json \
                src/encoded/schemas/variant_sample.json \
                hms-dbmi hms-dbmi development.ini --app-name app --post-inserts

        To load a vcf on the server:
            ingest-vcf src/encoded/tests/data/variant_workbook/test_vcf.vcf \
            src/encoded/schemas/variant.json \
            src/encoded/schemas/variant_sample.json \
            hms-dbmi hms-dbmi production.ini --app-name app --post-inserts
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Ingests a given VCF file",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('vcf', help='path to vcf file')
    parser.add_argument('variant', help='path to variant schema')
    parser.add_argument('sample', help='path to sample variant schema')
    parser.add_argument('project', help='project to post inserts under')
    parser.add_argument('institution', help='institution to post inserts under')
    parser.add_argument('config_uri', help="path to configfile")  # to get app
    parser.add_argument('--app-name', help="Pyramid app name in configfile")  # to get app
    parser.add_argument('--post-inserts', action='store_true', default=False,
                        help='If specified, will post inserts, by default False.')
    parser.add_argument('--post-variant-consequences', action='store_true', default=False,
                        help='If specified will post all VariantConsequence items.')
    args = parser.parse_args()

    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf, args.variant, args.sample)

    # get app, form links then post items
    if args.post_inserts:
        environ = {
            'HTTP_ACCEPT': 'application/json',
            'REMOTE_USER': 'TEST',
        }
        app = get_app(args.config_uri, args.app_name)
        app_handle = VirtualApp(app, environ)
        if args.post_variant_consequences:
            vcf_parser.post_variant_consequence_items(app_handle, project=args.project, institution=args.institution)
        for idx, record in enumerate(vcf_parser):
            variant = vcf_parser.create_variant_from_record(record)
            variant['project'] = args.project
            variant['institution'] = args.institution
            vcf_parser.format_variant_sub_embedded_objects(variant)
            try:
                res = app_handle.post_json('/variant', variant, status=201).json['@graph'][0]  # only one item posted
            except Exception as e:
                print('Failed validation at row: %s\n'
                      'Exception: %s' % (idx, e))  # some variant gene linkTos do not exist
                continue
            variant_samples = vcf_parser.create_sample_variant_from_record(record)
            for sample in variant_samples:
                sample['project'] = args.project
                sample['institution'] = args.institution
                sample['variant'] = res['@id']  # make link
                sample['file'] = 'dummy-file'  # XXX: loading this way is just for testing!
                app_handle.post_json('/variant_sample', sample, status=201)

        logger.info('Succesfully posted VCF entries')
    exit(0)


if __name__ == '__main__':
    main()
