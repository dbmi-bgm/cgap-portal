import logging
import argparse
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from encoded.util import resolve_file_path
from encoded.ingestion.gene_utils import GeneIngestion
from encoded.ingestion.vcf_utils import VCFParser, StructuralVariantVCFParser
from encoded.ingestion.variant_utils import VariantBuilder, StructuralVariantBuilder


logger = logging.getLogger(__name__)
EPILOG = __doc__


def main():
    """ Entry point for VCF Ingestion related tasks.
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
    parser.add_argument('--post-variants', action='store_true', default=False,
                        help='If specified, will post inserts, by default False.')
    parser.add_argument('--post-conseq', action='store_true', default=False,
                        help='Provide if consequences should be uploaded')
    parser.add_argument('--post-genes', action='store_true', default=False,
                        help='Provide if genes should be uploaded')
    parser.add_argument('--structural_variant', action='store_true', default=False,
                        help='Provide if ingestion SV VCF')
    args = parser.parse_args()

    logger.info('Ingesting VCF file: %s' % args.vcf)

    # XXX: Refactor to use IngestionConfig
    app = get_app(args.config_uri, args.app_name)
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': 'TEST',
    }
    app_handle = VirtualApp(app, environ)
    if args.structural_variant:
        vcf_parser = StructuralVariantVCFParser(
            args.vcf,
            resolve_file_path("schemas/structural_variant.json"),
            resolve_file_path("schemas/structural_variant_sample.json"),
        )
        builder = StructuralVariantBuilder(
            app_handle,
            vcf_parser,
            args.vcf_accession,
            project=args.project,
            institution=args.institution,
        )
    else:
        vcf_parser = VCFParser(args.vcf, resolve_file_path('schemas/variant.json'),
                               resolve_file_path('schemas/variant_sample.json'))
        builder = VariantBuilder(app_handle, vcf_parser, args.vcf_accession,
                                 project=args.project, institution=args.institution)
    if args.post_conseq:
        builder.post_variant_consequence_items()
    if args.post_genes:
        gene_handler = GeneIngestion(resolve_file_path('annotations/gene_inserts_v0.4.5.json'))
        gene_handler.upload(app_handle, project=args.project, institution=args.institution, use_tqdm=True)
    if args.post_variants:
        builder.ingest_vcf(use_tqdm=True)
        logger.info('Succesfully posted VCF entries')
    exit(0)


if __name__ == '__main__':
    main()
