import pytest

from ..ingestion.gene_utils import GeneAnnotationParser

class TestGeneAnnotationParser:

    SCHEMA = {}
    ANNOTATIONS = []

    def test_parse_inserts(self):
        schema_path = "/Users/drioux/CGAP/cgap-portal/src/encoded/schemas/gene.json"
        annotation_records_path = "/Users/drioux/Desktop/trial_annotation.json"
        inserts_path = "/Users/drioux/Desktop/gene_inserts.json.gz"
        import pdb; pdb.set_trace()
        parser = GeneAnnotationParser(schema_path, annotation_records_path,
                inserts_path)
        all_inserts = parser.get_inserts()
        inserts = list(all_inserts)
