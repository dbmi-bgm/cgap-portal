import argparse
import logging

from dcicutils.misc_utils import VirtualApp
from pyramid.paster import get_app

from encoded.ingestion.table_utils import (
    StructuralVariantTableParser, VariantTableParser
)

logger = logging.getLogger(__name__)
EPILOG = __doc__


def run_table_intake(
    mapping_table,
    annotation_schema,
    variant_schema,
    variant_sample_schema,
    app_config,
    project=None,
    institution=None,
    write_schemas=False,
    post_inserts=False,
    structural_variant=False,
    app_name=None,
):
    """
    Intake the given mapping table, writing new schemas and posting
    annotation field inserts as indicated.

    :param mapping_table: str path to mapping table
    :param annotation_schema: str path to annotation field schema
    :param variant_schema: str path to variant schema
    :param variant_sample_schema: str path to variant sample schema
    :param app_config: str path to app config
    :param project: str project identifier
    :param institution: str institution identifier
    :param write_schemas: bool to write variant/variant sample schemas
    :param post_inserts: bool to post annotation inserts
    :param structural_variant: bool if structural variant mapping table
    :param app_name: str app name
    """
    logging.basicConfig()

    # read/process mapping table, build inserts
    logger.info("Building annotations from mapping table: %s." % mapping_table)
    if structural_variant:
        parser = StructuralVariantTableParser(mapping_table, annotation_schema)
        inserts = parser.run(  # Schema locations hard-coded for SVTableParser
            project=project, institution=institution, write=write_schemas
        )
    else:
        parser = VariantTableParser(mapping_table, annotation_schema)
        inserts = parser.run(
            variant_sample_schema,
            variant_schema,
            institution=institution,
            project=project,
            write=write_schemas,
        )

    # if not a dry run try to post inserts
    if post_inserts:  # do imports here as they will fail in certain scenarios
        environ = {
            "HTTP_ACCEPT": "application/json",
            "REMOTE_USER": "TEST",
        }
        app = get_app(app_config, app_name)
        app_handle = VirtualApp(app, environ)
        for entry in inserts:
            app_handle.post_json(
                "/annotation_field", entry
            )  # XXX: what if something goes wrong?
        logger.info("Successfully posted annotations")


def main():
    """Takes in the mapping table and produces annotation field inserts, variant_sample
    schema and variant schema.

    Args:
        mp: path to mapping table
        annotation_field_schema: path to annotation field schema
        variant: where to write variant schema
        sample: where to write variant_sample schema
        --project: project to post under
        --institution: institution to post under
        --write-schemas: default True, will write schemas to given output files
        --post-inserts: default False, will post inserts using testapp if specified
        --structural-variant: default False, will use SV table parser

        config_uri: path to app config (usually production.ini)
        --app-name: app name, usually 'app'

    From commands dir:
        python variant_table_intake.py ../tests/data/variant_workbook/variant_table.csv ../schemas/annotation_field.json ../schemas/variant.json ../schemas/variant_sample.json ../../../production.ini --app-name app
    From top level on server/local (will post inserts):
        bin/mapping-table-intake src/encoded/tests/data/variant_workbook/variant_table.csv src/encoded/schemas/annotation_field.json src/encoded/schemas/variant.json src/encoded/schemas/variant_sample.json development.ini --app-name app --post-inserts

    """
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Takes in a mapping table and produces inserts/schemas",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("mp", help="path to mapping table")
    parser.add_argument(
        "annotation_field_schema", help="path to annotation field schema"
    )
    parser.add_argument("variant", help="where to write variant schema")
    parser.add_argument("sample", help="where to write sample_variant schema")
    parser.add_argument("config_uri", help="path to configfile")  # to get app
    parser.add_argument(
        "--app-name", help="Pyramid app name in configfile"
    )  # to get app
    parser.add_argument("--project", help="project to post inserts under")
    parser.add_argument("--institution", help="institution to post inserts under")
    parser.add_argument(
        "--write-schemas",
        action="store_true",
        default=True,
        help="If specified, will write new schemas to given locations",
    )
    parser.add_argument(
        "--post-inserts",
        action="store_true",
        default=False,
        help=(
            "If specified, will post inserts. By default, False,"
            " resulting in a dry run."
        ),
    )
    parser.add_argument(
        "--structural-variant",
        action="store_true",
        default=False,
        help="If specified, will use SV parser",
    )
    args = parser.parse_args()

    run_table_intake(
        args.mp,
        args.annotation_field_schema,
        args.variant,
        args.sample,
        args.config_uri,
        project=args.project,
        institution=args.institution,
        write_schemas=args.write_schemas,
        post_inserts=args.post_inserts,
        structural_variant=args.structural_variant,
        app_name=args.app_name,
    )


if __name__ == "__main__":
    main()
