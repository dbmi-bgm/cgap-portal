import argparse
import logging
import re
from pathlib import Path

from dcicutils.misc_utils import snake_case_to_camel_case
from snovault import load_schema


log = logging.getLogger(__name__)


ENCODED_DIR = Path(__file__).parents[1]
SCHEMAS_DIR = ENCODED_DIR.joinpath("schemas").absolute()
SCHEMA_CONSTANTS_FILE = ENCODED_DIR.joinpath("schema_constants.py").absolute()


class SchemaConstantCollector:

    # Schema constants
    TYPE = "type"
    STRING = "string"
    ENUM = "enum"
    ARRAY = "array"
    ITEMS = "items"
    OBJECT = "object"
    PROPERTIES = "properties"

    # Class constants
    NAME_JOINER = "_"
    # Some reasonable replacements for current schema; modify as needed
    TO_UNDERSCORE_REGEX = re.compile(r"[ ]+|[/]+|[-]+|[.]+|[+]+|_{2,}|[:]+")
    CONSTANT_REPLACEMENTS = {"%": "percent ", "@": "at "}
    ENDING_CONSTANT_REPLACEMENTS = {".": "dot", "+": "plus", "-": "minus"}

    def __init__(self, schema):
        """Initialize the class.

        :param schema: Schema for item
        :type schema: dict

        :var schema_properties: Schema properties
        :vartype schema_properties: dict
        :var constants: Mapping attribute names --> values for constant
            class
        :vartype constants: dict
        """
        self.schema_properties = schema.get(self.PROPERTIES, {})
        self.constants = {}

    def collect_schema_constants(self):
        """Collect constant attributes and values for all properties.

        Primary method on class.

        :return: Mapping of constant class attributes to values
        :rtype: dict
        """
        for property_name, property_value in self.schema_properties.items():
            self.add_constant(property_name)
            self.collect_subembedded_values(property_name, property_value)
        return self.constants

    def collect_subembedded_values(self, property_name, property_object):
        """Recursively collect schema constants.

        Move through each item in an array, collect property names in
        objects as constants, and collect string enums as constants.

        :param property_name: Current property name
        :type property_name: str
        :param property_object: Current property object
        :type property_object: dict
        """
        property_type = property_object.get(self.TYPE)
        if property_type == self.ARRAY:
            items = property_object.get(self.ITEMS)
            self.collect_subembedded_values(property_name, items)
        elif property_type == self.OBJECT:
            subembedded_properties = property_object.get(self.PROPERTIES, {})
            for (
                subembedded_name,
                subembedded_object,
            ) in subembedded_properties.items():
                self.add_constant(subembedded_name)
                self.collect_subembedded_values(subembedded_name, subembedded_object)
        elif property_type == self.STRING:
            enum = property_object.get(self.ENUM, [])
            for option in enum:
                constant_name = property_name + self.NAME_JOINER + option
                self.add_constant(constant_name, constant_value=option)

    def add_constant(self, constant_name, constant_value=None):
        """Format and add constant name and value to self.constants.

        If no value given, assume constant value is the name as well.

        :param constant_name: Unformatted constant name
        :type constant_name: str
        :param constant_value: Value for constant name
        :type constant_value: str or None
        """
        class_constant = self.format_constant_name(constant_name)
        if not constant_value:
            constant_value = constant_name
        self.constants[class_constant] = constant_value

    def format_constant_name(self, constant_name):
        """Format constant name to use as attribute.

        Attempt sensible substitutions and replacements, but may
        require periodic updates.

        NOTE: improperly formatted attribute names may make resulting
        constant class unable to be imported.

        :param constant_name: Unformatted name for constant
        :type constant_name: str
        :return: Formatted constant name
        :rtype: str
        """
        result = constant_name
        for term, replacement in self.CONSTANT_REPLACEMENTS.items():
            result = result.replace(term, replacement)
        for ending, ending_replacement in self.ENDING_CONSTANT_REPLACEMENTS.items():
            if result.endswith(ending):
                result = result[:-1] + self.NAME_JOINER + ending_replacement
        result = re.sub(self.TO_UNDERSCORE_REGEX, self.NAME_JOINER, result)
        return result.upper()


class SchemaConstantWriter:

    SCHEMA_IDENTIFIER_KEY = "$schema"
    CONSTANTS_CLASS_ADD_ON = "Constants"

    def __init__(
        self,
        file_to_write,
        schema_directory,
        types_to_include=None,
        types_to_exclude=None,
    ):
        """Initialize class and set all attributes.

        :param file_to_write: Path to file to write constants
        :type file_to_write: str
        :param schema_directory: Path to schema directory
        :type schema_directory: str
        :param types_to_include: Item types to use for constant classes
        :type types_to_include: list[str] or None
        :param types_to_exclude: Item types to exclude for constant
            classes
        :type types_to_exclude: list[str] or None

        :var file_to_write: Path of file to write
        :vartype file_to_write: pathlib.Path
        :var schema_files: Paths of schema files in schema directory
        :vartype: list[pathlib.Path]
        :var schemas: Mapping item types to their schemas
        :vartype: dict
        :var classes_to_write: Mapping constant class names to
            attributes
        :vartype classes_to_write: dict
        """
        self.file_to_write = Path(file_to_write)
        self.schema_files = Path(schema_directory).iterdir()
        self.types_to_include = self.ensure_camel_case(types_to_include)
        self.types_to_exclude = self.ensure_camel_case(types_to_exclude)
        self.schemas = {}
        self.classes_to_write = {}

    def ensure_camel_case(self, item_types):
        """Ensure item types are in camel case.

        :param item_types: Item names
        :type item_types: list[str] or None
        :return: Camel case item names
        :rtype: list[str] or None
        """
        result = None
        if item_types:
            result = [snake_case_to_camel_case(item) for item in item_types]
        return result

    def collect_and_write_schema_classes(self):
        """Process schemas and write output to file.

        Primary method for the class.
        """
        self.collect_schemas()
        self.collect_classes_to_write()
        self.write_constant_classes()

    def collect_schemas(self):
        """Add schemas to use for constant classes to self.schemas.

        Inclusion depends on presence of schema identifier key to exclude
        mixins, embeds, etc. Limit to given item types, if provided.
        """
        for schema_path in self.schema_files:
            schema_type = snake_case_to_camel_case(schema_path.stem)
            if self.types_to_include:
                if schema_type not in self.types_to_include:
                    continue
            if self.types_to_exclude:
                if schema_type in self.types_to_exclude:
                    continue
            schema = load_schema(schema_path.absolute())
            if schema.get(self.SCHEMA_IDENTIFIER_KEY):
                self.schemas[schema_type] = schema
        log.info(f"Found {len(self.schemas)} schemas to process")

    def collect_classes_to_write(self):
        """Add class names and attributes to self.classes_to_write."""
        log.info(f"Collecting constants for {len(self.schemas)} item types")
        for item_type, schema in self.schemas.items():
            item_constants = SchemaConstantCollector(schema).collect_schema_constants()
            class_name = item_type + self.CONSTANTS_CLASS_ADD_ON
            self.classes_to_write[class_name] = item_constants

    def write_constant_classes(self):
        """Format and write classes to file.

        Overwrites contents of file.
        """
        lines_to_write = []
        indent = " " * 4
        log.info(
            f"Writing {len(self.classes_to_write)} constant classes to"
            f" {self.file_to_write.name}"
        )
        for class_name, attributes in sorted(self.classes_to_write.items()):
            lines_to_write.append(f"class {class_name}:\n")
            for attribute_name, attribute_value in attributes.items():
                lines_to_write.append(
                    f'{indent}{attribute_name} = "{attribute_value}"\n'
                )
            lines_to_write.extend(["\n", "\n"])
        with self.file_to_write.open("w") as file_handle:
            file_handle.writelines(lines_to_write[:-2])  # Leave off last two newlines


def main():
    parser = argparse.ArgumentParser(
        description="Write schema constant classes to a file",
    )
    parser.add_argument(
        "-f",
        "--filepath",
        help="path to file to write constant classes",
        default=SCHEMA_CONSTANTS_FILE,
    )
    parser.add_argument(
        "-s", "--schemas", help="path to schemas directory", default=SCHEMAS_DIR
    )
    parser.add_argument(
        "-i",
        "--include-types",
        help="item types to include (defaults to all)",
        action="extend",
        nargs="+",
        type=str,
    )
    parser.add_argument(
        "-e",
        "--exclude-types",
        help="item types to exclude (defaults to none)",
        action="extend",
        nargs="+",
        type=str,
    )
    parser.add_argument("-v", "--verbose", help="verbose logging", action="store_true")

    args = parser.parse_args()
    if args.verbose:
        log.setLevel(logging.DEBUG)
    SchemaConstantWriter(
        args.filepath, args.schemas, args.include_types, args.exclude_types
    ).collect_and_write_schema_classes()


if __name__ == "__main__":
    main()
