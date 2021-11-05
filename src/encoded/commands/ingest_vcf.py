import argparse
import logging

from dcicutils.misc_utils import VirtualApp
from pyramid.paster import get_app

from .ingestion.gene_utils import GeneIngestion
from .ingestion.variant_utils import StructuralVariantBuilder, VariantBuilder
from .ingestion.vcf_utils import StructuralVariantVCFParser, VCFParser
from .util import resolve_file_path

logger = logging.getLogger(__name__)
EPILOG = __doc__


def run_vcf_ingestion(
    app,
    vcf_path,
    vcf_accession,
    project,
    institution,
    post_variants=False,
    post_consequence=False,
    post_genes=False,
    structural_variant=False,
):
    """
    Runs VCF ingestion, posting items as indicated by args.

    :param app: VirtualApp
    :param vcf_path: str path of VCF file
    :param vcf_accesion: str VCF accession
    :param project: str project identifier
    :param institution: str institution identifier
    :param post_variants: bool to post variants/variant samples from ingested VCF
    :param post_consequence: bool to post variant consequences
    :param post_genes: bool to post genes
    :param structural_variant: bool if handling SV VCF
    """
    logging.basicConfig()
    logger.info("Ingesting VCF file: %s." % vcf_path)
    if structural_variant:
        vcf_parser = StructuralVariantVCFParser(
            vcf_path,
            resolve_file_path("schemas/structural_variant.json"),
            resolve_file_path("schemas/structural_variant_sample.json"),
        )
        builder = StructuralVariantBuilder(
            app,
            vcf_parser,
            vcf_accession,
            project=project,
            institution=institution,
        )
    else:
        vcf_parser = VCFParser(
            vcf_path,
            resolve_file_path("schemas/variant.json"),
            resolve_file_path("schemas/variant_sample.json"),
        )
        builder = VariantBuilder(
            app, vcf_parser, vcf_accession, project=project, institution=institution
        )
    if post_consequence:
        builder.post_variant_consequence_items()
    if post_genes:
        gene_handler = GeneIngestion(
            resolve_file_path("annotations/gene_inserts_v0.4.5.json")
        )
        gene_handler.upload(
            app, project=project, institution=institution, use_tqdm=True
        )
    if post_variants:
        builder.ingest_vcf(use_tqdm=True)
        logger.info("Succesfully posted VCF entries.")
    exit(0)


def main():
    """Entry point for VCF Ingestion related tasks."""
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Ingests a given VCF file",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("vcf", help="path to vcf file")
    parser.add_argument("vcf_accession", help="accession of VCF file ingesting")
    parser.add_argument("project", help="project to post inserts under")
    parser.add_argument("institution", help="institution to post inserts under")
    parser.add_argument("config_uri", help="path to configfile")  # to get app
    parser.add_argument(
        "--app-name", help="Pyramid app name in configfile"
    )  # to get app
    parser.add_argument(
        "--post-variants",
        action="store_true",
        default=False,
        help="If specified, will post inserts, by default False.",
    )
    parser.add_argument(
        "--post-conseq",
        action="store_true",
        default=False,
        help="Provide if consequences should be uploaded",
    )
    parser.add_argument(
        "--post-genes",
        action="store_true",
        default=False,
        help="Provide if genes should be uploaded",
    )
    parser.add_argument(
        "--structural-variant",
        action="store_true",
        default=False,
        help="Provide if ingestion SV VCF",
    )
    args = parser.parse_args()

    # XXX: Refactor to use IngestionConfig
    app = get_app(args.config_uri, args.app_name)
    environ = {
        "HTTP_ACCEPT": "application/json",
        "REMOTE_USER": "TEST",
    }
    app_handle = VirtualApp(app, environ)
    run_vcf_ingestion(
        app_handle,
        args.vcf,
        args.vcf_accession,
        args.project,
        args.institution,
        post_variants=args.post_variants,
        post_consequence=args.post_conseq,
        post_genes=args.post_genes,
        structural_variant=args.structural_variant,
    )


if __name__ == "__main__":
    main()
