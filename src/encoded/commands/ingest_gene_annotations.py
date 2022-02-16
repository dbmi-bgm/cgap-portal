import argparse

from encoded.ingestion.gene_utils import GeneAnnotationParser
from encoded.util import resolve_file_path


DEFAULT_GENE_SCHEMA = resolve_file_path("schemas/gene.json")


def run_ingest_gene_annotations(annotation_file_path, inserts_path, schema_path):
    """Make gene inserts from given annotation file.

    :param annotation_file_path: Path to annotation file
    :type annotation_file_path: str
    :param inserts_path: Path to which to write the generated inserts
    :type inserts_path: str
    :param schema_path: Path to gene schema to use for generating
        inserts from annotations
    :type schema_path: str
    """
    parser = GeneAnnotationParser(
        annotation_file_path, inserts_path, schema_path=schema_path
    )
    parser.write_inserts()


def main():
    """Parse args and run the script."""
    parser = argparse.ArgumentParser(
        description="Generate gene inserts from annotations"
    )
    parser.add_argument("annotation_path", help="Path to annotation file")
    parser.add_argument("inserts_path", help="Path to which to write resulting inserts")
    parser.add_argument(
        "--schema_path",
        "-s",
        help="Path to gene schema for creating inserts",
        default=DEFAULT_GENE_SCHEMA,
    )
    args = parser.parse_args()
    run_ingest_gene_annotations(
        args.annotation_path, args.inserts_path, args.schema_path
    )


if __name__ == "__main__":
    main()
