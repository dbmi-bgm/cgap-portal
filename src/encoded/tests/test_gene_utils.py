import gzip
import json
import tempfile
from types import GeneratorType

import mock
import pytest

from ..ingestion.gene_utils import (
    GeneAnnotationParser,
    GeneAnnotationParserError,
    SchemaPropertiesParser,
)


TEST_SCHEMA_FIELD_IDENTIFIER = "identifier"
TEST_SCHEMA_PROPERTIES = {
    "string_field": {
        "type": "string",
        "default": "something",
        TEST_SCHEMA_FIELD_IDENTIFIER: "foo",
    },
    "non_identified_string_field": {
        "type": "string",
    },
    "integer_field": {
        "type": "integer",
        "default": 0,
        TEST_SCHEMA_FIELD_IDENTIFIER: "bar",
    },
    "list_field": {
        "type": "array",
        "items": {
            "type": "string",
            TEST_SCHEMA_FIELD_IDENTIFIER: "fu",
        },
    },
    "list_of_dict_field": {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "sub_embedded_string": {
                    "type": "string",
                    "default": "else",
                    TEST_SCHEMA_FIELD_IDENTIFIER: "bur",
                },
                "sub_embedded_number": {
                    "type": "number",
                },
            },
        },
    },
}
TEST_SCHEMA_PARSED_RESULT = {
    "string_field": {
        "type": "string",
        TEST_SCHEMA_FIELD_IDENTIFIER: "foo",
        "default": "something",
    },
    "integer_field": {
        "type": "integer",
        "default": 0,
        TEST_SCHEMA_FIELD_IDENTIFIER: "bar",
    },
    "list_field": {
        "type": "array",
        "sub_type": "string",
        TEST_SCHEMA_FIELD_IDENTIFIER: "fu",
    },
    "sub_embedded_string": {
        "type": "string",
        "default": "else",
        TEST_SCHEMA_FIELD_IDENTIFIER: "bur",
        "sub_embedding_group": "list_of_dict_field",
    },
}
TEST_ANNOTATION_RECORDS = [
    {"foo": "bar", "bur": ["fi", "fu"]},
    {"bar": "45", "fu": ["123", "something"]},
]
TEST_INSERT_RESULTS = [
    {
        "string_field": "bar",
        "list_of_dict_field": [
            {"sub_embedded_string": "fi"},
            {"sub_embedded_string": "fu"},
        ],
    },
    {
        "string_field": "something",
        "integer_field": 45,
        "list_field": ["123", "something"],
    },
]


@pytest.fixture
def empty_gene_annotation():
    with mock.patch("encoded.ingestion.gene_utils.load_json_file", return_value={}):
        return GeneAnnotationParser(None, None)


class TestGeneAnnotationParser:
    @pytest.mark.parametrize(
        "value_type,value,sub_type,error,expected",
        [
            (None, None, None, True, None),
            ("string", None, None, True, None),
            ("string", "foo", None, False, "foo"),
            ("string", ["foo"], None, False, "foo"),
            ("string", ["foo", "bar"], None, True, None),
            ("integer", 1, None, False, 1),
            ("integer", "1", None, False, 1),
            ("integer", "1.00", None, False, 1),
            ("integer", 1.00, None, False, 1),
            ("integer", 1.001, None, False, 1),
            ("integer", [1], None, True, None),
            ("number", 1, None, False, 1),
            ("number", "1", None, False, 1),
            ("number", 1.001, None, False, 1.001),
            ("number", "1.001", None, False, 1.001),
            ("number", [1.001], None, True, None),
            ("boolean", True, None, False, True),
            ("boolean", False, None, False, False),
            ("boolean", "1", None, False, True),
            ("boolean", "0", None, False, False),
            ("boolean", "Foo", None, True, None),
            ("array", ["foo"], None, True, None),
            ("array", ["foo"], "string", False, ["foo"]),
            ("array", "foo", "string", False, ["foo"]),
            ("array", "foo", "integer", True, None),
            ("array", [1, 2, 3], "integer", False, [1, 2, 3]),
            ("object", {"foo": "bar"}, None, True, None),
        ],
    )
    def test_cast_field_value(
        self, value_type, value, sub_type, error, expected, empty_gene_annotation
    ):
        """Test conversion of value to desired type."""
        if error:
            with pytest.raises(GeneAnnotationParserError):
                empty_gene_annotation.cast_field_value(value_type, value, sub_type)
        else:
            result = empty_gene_annotation.cast_field_value(value_type, value, sub_type)
            assert result == expected

    @pytest.mark.parametrize(
        "schema_key,schema_props,field_value,index,expected",
        [
            (None, {}, None, None, {}),
            ("foo", {}, None, None, {}),
            ("foo", {"type": "string"}, "bar", None, {"foo": "bar"}),
            ("foo", {"type": "string"}, None, None, {}),
            ("foo", {"type": "string", "default": "bur"}, None, None, {"foo": "bur"}),
            (
                "foo",
                {"type": "array", "sub_type": "string"},
                ["bar"],
                None,
                {"foo": ["bar"]},
            ),
            (
                "foo",
                {"type": "array", "sub_type": "string", "sub_embedding_group": "fu"},
                ["bar"],
                None,
                {"fu": {"foo": ["bar"]}},
            ),
            (
                "foo",
                {"type": "array", "sub_type": "string", "sub_embedding_group": "fu"},
                ["bar"],
                0,
                {"fu": {0: {"foo": ["bar"]}}},
            ),
        ],
    )
    def test_add_property_to_item(
        self,
        schema_key,
        schema_props,
        field_value,
        index,
        expected,
        empty_gene_annotation,
    ):
        """Test adding property value to result in type expected from
        schema.
        """
        result = {}
        empty_gene_annotation.add_property_to_item(
            result, schema_key, schema_props, field_value, index
        )
        assert result == expected

    @pytest.mark.parametrize(
        "item,field_to_get,expected",
        [
            ({}, "foo", None),
            ({"foo": "bar"}, "foo", "bar"),
            ({"foo": "bar"}, "fu", None),
            ({"foo": ["bar"]}, "foo", ["bar"]),
            ({"foo": {"fu": ["bar"]}}, "fu", None),
            ({"foo": {"fu": ["bar"]}}, "foo", {"fu": ["bar"]}),
            ({"foo": {"fu": ["bar"]}}, "foo.fu", ["bar"]),
            ({"foo": [{"fu": "bar"}]}, "foo.fu", "bar"),
            ({"foo": [{"fu": "bar"}, {"fu": "bur"}]}, "foo.fu", ["bar", "bur"]),
            (
                {"foo": [{"fu": "bur"}, {"fu": "bar"}, {"fu": "bur"}]},
                "foo.fu",
                ["bur", "bar"],
            ),
        ],
    )
    def test_nested_getter(self, item, field_to_get, expected, empty_gene_annotation):
        """Test retrieval of (nested) fields from dict."""
        result = empty_gene_annotation.nested_getter(item, field_to_get)
        assert result == expected

    @pytest.mark.parametrize(
        "item,expected",
        [
            ({}, {}),
            ({"foo": "bar"}, {"foo": "bar"}),
            ({"foo": {0: {"fu": "bur"}}}, {"foo": [{"fu": "bur"}]}),
            (
                {"foo": {0: {"fu": "bur"}, 1: {"fu": "bir"}}},
                {"foo": [{"fu": "bur"}, {"fu": "bir"}]},
            ),
            (
                {"foo": {0: {"fu": "bur"}, 1: {"fi": "bir"}}},
                {"foo": [{"fu": "bur"}, {"fi": "bir"}]},
            ),
        ],
    )
    def test_reformat_array_of_objects(self, item, expected, empty_gene_annotation):
        """Test conversion of dict of lists to list of dicts."""
        empty_gene_annotation.reformat_array_of_objects(item)
        assert item == expected

    @pytest.mark.parametrize(
        "annotation_records,annotation_properties,expected",
        [
            ([], {}, []),
            (TEST_ANNOTATION_RECORDS, {}, []),
            ([], TEST_SCHEMA_PARSED_RESULT, []),
            (TEST_ANNOTATION_RECORDS, TEST_SCHEMA_PARSED_RESULT, TEST_INSERT_RESULTS),
        ],
    )
    def test_get_inserts(
        self, annotation_records, annotation_properties, expected, empty_gene_annotation
    ):
        """Test generation of inserts from annotations."""
        empty_gene_annotation.annotation_records = annotation_records
        empty_gene_annotation.annotation_properties = annotation_properties
        empty_gene_annotation.ANNOTATION_FIELD = TEST_SCHEMA_FIELD_IDENTIFIER
        result = empty_gene_annotation.get_inserts()
        assert isinstance(result, GeneratorType)
        result = list(result)
        assert result == expected

    @pytest.mark.parametrize("gzip_file", [True, False])
    def test_write_inserts(self, gzip_file, empty_gene_annotation):
        """Test writing of inserts to file."""
        inserts_to_write = [{"foo": "bar"}]
        expected_keys = ["status", "project", "institution"]
        with mock.patch(
            "encoded.tests.test_gene_utils.GeneAnnotationParser.get_inserts",
            return_value=inserts_to_write,
        ):
            empty_gene_annotation.gzip_file = gzip_file
            suffix = ".gz"
            if not gzip_file:
                suffix = None
            with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
                empty_gene_annotation.inserts_path = tmp.name
                empty_gene_annotation.write_inserts()
                if suffix:
                    file_contents = json.loads(gzip.decompress(tmp.file.read()))
                else:
                    file_contents = json.loads(tmp.file.read())
                assert len(file_contents) == 1
                insert = file_contents[0]
                for key in expected_keys:
                    assert key in insert


class TestSchemaPropertiesParser:
    @pytest.mark.parametrize(
        "schema_props,field_identifier,expected",
        [
            ({}, "", {}),
            ({}, TEST_SCHEMA_FIELD_IDENTIFIER, {}),
            (TEST_SCHEMA_PROPERTIES, "foo", {}),
            (
                TEST_SCHEMA_PROPERTIES,
                TEST_SCHEMA_FIELD_IDENTIFIER,
                TEST_SCHEMA_PARSED_RESULT,
            ),
        ],
    )
    def test_parse_schema_properties(self, schema_props, field_identifier, expected):
        """Test parsing of example schema properties to collect those
        containing the field identifier.
        """
        schema_parser = SchemaPropertiesParser(schema_props, field_identifier)
        result = schema_parser.parse_schema_properties()
        assert result == expected

    @pytest.mark.parametrize(
        "key,value,array,parent,expected",
        [
            ("foo", {}, False, None, {}),
            ("foo", {"type": "string"}, False, None, {}),
            ("foo", {"type": "string"}, True, None, {}),
            ("foo", {"type": "string"}, False, "fu", {}),
            (
                "foo",
                {"type": "string", TEST_SCHEMA_FIELD_IDENTIFIER: None},
                False,
                None,
                {},
            ),
            (
                "foo",
                {"type": "string", TEST_SCHEMA_FIELD_IDENTIFIER: "bar"},
                False,
                None,
                {"foo": {"type": "string", TEST_SCHEMA_FIELD_IDENTIFIER: "bar"}},
            ),
            (
                "foo",
                {"type": "string", TEST_SCHEMA_FIELD_IDENTIFIER: "bar"},
                True,
                None,
                {
                    "foo": {
                        "type": "array",
                        TEST_SCHEMA_FIELD_IDENTIFIER: "bar",
                        "sub_type": "string",
                    }
                },
            ),
            (
                "foo",
                {"type": "string", TEST_SCHEMA_FIELD_IDENTIFIER: "bar"},
                False,
                "fu",
                {
                    "foo": {
                        "type": "string",
                        TEST_SCHEMA_FIELD_IDENTIFIER: "bar",
                        "sub_embedding_group": "fu",
                    }
                },
            ),
            (
                "foo",
                {"type": "string", TEST_SCHEMA_FIELD_IDENTIFIER: "bar"},
                True,
                "fu",
                {
                    "foo": {
                        "type": "array",
                        TEST_SCHEMA_FIELD_IDENTIFIER: "bar",
                        "sub_embedding_group": "fu",
                        "sub_type": "string",
                    }
                },
            ),
        ],
    )
    def test_add_schema_property(self, key, value, array, parent, expected):
        """Test addition of schema property with identifier field to
        result dict in expected format.
        """
        result = {}
        schema_parser = SchemaPropertiesParser({}, TEST_SCHEMA_FIELD_IDENTIFIER)
        schema_parser.add_schema_property(
            key, value, result, array=array, parent=parent
        )
        assert result == expected
