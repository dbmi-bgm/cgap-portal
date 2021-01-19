import logging
import argparse
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from ..ingestion.vcf_utils import VCFParser
from ..ingestion.variant_utils import VariantBuilder


logger = logging.getLogger(__name__)
EPILOG = __doc__


def main():
    """ Main, ingests VCF and posts if args specified.

        NOTE: is currently a no-op if inserts are not being posted

        Required Args:
            vcf: path to VCF file to ingest
            vcf_accession: the accession of the VCF file on the portal
            project: project to post variants/samples under
            institution: institution to post variants/samples under
            config_uri: standard arg for commands to pass ini file
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Ingests a given VCF file",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('vcf', help='path to vcf file')
    parser.add_argument('vcf_accession', help='accession of VCF file ingesting')
    parser.add_argument('project', help='project to post inserts under')
    parser.add_argument('institution', help='institution to post inserts under')
    parser.add_argument('config_uri', help="path to configfile")  # to get app
    parser.add_argument('--app-name', help="Pyramid app name in configfile")  # to get app
    parser.add_argument('--post-inserts', action='store_true', default=False,
                        help='If specified, will post inserts, by default False.')
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
        builder = VariantBuilder(app_handle, vcf_parser, args.vcf_accession,
                                 project=args.project, institution=args.institution)
        builder.ingest_vcf(use_tqdm=True)
        logger.info('Succesfully posted VCF entries')
    exit(0)


if __name__ == '__main__':
    main()
