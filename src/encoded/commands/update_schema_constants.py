import argparse
import json
import inspect
import re
from pathlib import Path

from dcicutils.misc_utils import snake_case_to_camel_case
from snovault import load_schema

import encoded.constants as constants_module
from encoded.appdefs import ITEM_INDEX_ORDER


ENCODED_DIR = Path(__file__).parents[1]
SCHEMA_DIR = ENCODED_DIR.joinpath("schemas")
SCHEMA_FILES = SCHEMA_DIR.iterdir()
MIXINS_FILE = SCHEMA_DIR.joinpath("mixins.json")
CONSTANTS_CLASS_ADD_ON = "Constants"
SCHEMA_CONSTANTS_FILE = ENCODED_DIR.joinpath("schema_constants.py")
SCHEMA_IDENTIFIER_KEY = "$schema"
SCHEMA_PROPERTIES = "properties"


def collect_schemas():
    schemas = {}
    for schema_path in SCHEMA_FILES:
        schema_type = snake_case_to_camel_case(schema_path.stem)
#        if schema_type in ITEM_INDEX_ORDER:  # Assuming others irrelevant for constants
#            schema = load_schema(schema_path.absolute())
#            schemas[schema_type] = schema
        schema = load_schema(schema_path.absolute())
        if schema.get(SCHEMA_IDENTIFIER_KEY):
            schemas[schema_type] = schema
    return schemas


#def collect_mixins():
#    with MIXINS_FILE.open("r") as file_handle:
#        mixins = json.load(file_handle)
#    return mixins.values()



TYPE = "type"
STRING = "string"
ENUM = "enum"
ARRAY = "array"
ITEMS = "items"
OBJECT = "object"
PROPERTIES = "properties"


class SchemaConstantCollector:

    NAME_JOINER = "_"
    TO_UNDERSCORE_REGEX = re.compile(r"[ ]+|[/]+|[-]+|[.]+|[+]+|_{2,}|[:]+")
    CONSTANT_REPLACEMENTS = {"%": "percent ", "@": "at "}
    ENDING_CONSTANT_REPLACEMENTS = {".": "dot", "+": "plus", "-": "minus"} 

    def __init__(self, constant_class_name, schema_properties):
        self.constant_class_name = constant_class_name
        self.schema_properties = schema_properties
        self.constants = {}

    def collect_schema_constants(self):
        for property_name, property_value in self.schema_properties.items():
            self.add_constant(property_name)
            self.collect_subembedded_values(property_name, property_value)

    def collect_subembedded_values(self, property_name, property_object):
        property_type = property_object.get(TYPE)
        if property_type == ARRAY:
            items = property_object.get(ITEMS)
            self.collect_subembedded_values(property_name, items)
        elif property_type == OBJECT:
            subembedded_properties = property_object.get(PROPERTIES, {})
            for (
                subembedded_name, subembedded_object
            ) in subembedded_properties.items():
                self.add_constant(subembedded_name)
                self.collect_subembedded_values(subembedded_name, subembedded_object)
        elif property_type == STRING:
            enum = property_object.get(ENUM, [])
            for option in enum:
                constant_name = property_name + self.NAME_JOINER + option
                self.add_constant(constant_name, constant_value=option)

    def format_constant_name(self, constant_name):
        result = constant_name
        for term, replacement in self.CONSTANT_REPLACEMENTS.items():
            result = result.replace(term, replacement)
        for ending, ending_replacement in self.ENDING_CONSTANT_REPLACEMENTS.items():
            if result.endswith(ending):
                result = result[:-1] + self.NAME_JOINER + ending_replacement
        result = re.sub(self.TO_UNDERSCORE_REGEX, self.NAME_JOINER, result)
        return result.upper()

    def add_constant(self, constant_name, constant_value=None):
        class_constant = self.format_constant_name(constant_name)
        if not constant_value:
            constant_value = constant_name
        self.constants[class_constant] = constant_value

    def create_constant_class(self):
        class_attributes = {attribute: value for (attribute, value) in self.constants}
        constant_class = type(self.constant_class_name, (object,), class_attributes)
        return constant_class

    def collect_constants(self):
        self.collect_schema_constants()
#        constant_class = self.create_constant_class()
#        return constant_class
        return self.constants


class ClassConstantDiff:

    def __init__(self, constant_class, constants):
        self.constant_class = constant_class
        self.constants = constants
        self.existing_to_delete = []
        self.new_to_add = {}
        self.conflicts = []

    def is_magic(self, attribute_name):
        result = False
        if attribute_name.startswith("__") and attribute_name.endswith("__"):
            result = True
        return result

    def get_constant_attributes(self):
        attributes = inspect.getmembers(
            self.constant_class, lambda member: not inspect.isroutine(member)
        )
        constants = {
            key: value for (key, value) in attributes if not self.is_magic(key)
        }
        return constants

    def get_constant_differences(self):
        for attribute_name, attribute_value in self.constants.items():
            existing_value = getattr(self.constant_class, attribute_name, None)
            if existing_value is None:
                self.new_to_add[attribute_name] = attribute_value
            elif existing_value != attribute_value:
                self.conflicts.append(attribute_name)
        existing_constants = self.get_constant_attributes()
        for existing_constant in existing_constants:
            if existing_constant not in self.constants:
                self.existing_to_delete.append(existing_constant)

    def needs_update(self):
        result = False
        if self.new_to_add or self.conflicts or self.existing_to_delete:
            result = True
        return result


def add_schemas(classes_to_add):
    import pdb; pdb.set_trace()
    module_members = inspect.getmembers(constants_module)
    


def write_constant_classes(constant_classes_info):
    lines_to_write = []
    indent = " " * 4
    for class_name, attributes in sorted(constant_classes_info.items()):
        lines_to_write.append(f"class {class_name}:\n")
        for attribute_name, attribute_value in attributes.items():
            lines_to_write.append(f"{indent}{attribute_name} = \"{attribute_value}\"\n")
        lines_to_write.extend(["\n", "\n"])
    with SCHEMA_CONSTANTS_FILE.open("w") as file_handle:
        file_handle.writelines(lines_to_write[:-2])



def update_schema_constants(schemas, add_new=True, update_existing=True, verbose=False):
    constant_classes_to_add = {}
#    constant_classes_to_update = []
#    constant_classes_up_to_date = []
    for schema_name, schema_contents in schemas.items():
        constants_class_name = schema_name + CONSTANTS_CLASS_ADD_ON
        schema_properties = schema_contents.get(PROPERTIES)
        if not schema_properties:
            # log
            continue
        constant_collector = SchemaConstantCollector(constants_class_name, schema_properties)
        schema_constants = constant_collector.collect_constants()
        constant_classes_to_add[constants_class_name] = schema_constants
    write_constant_classes(constant_classes_to_add)


#        existing_constant_class = getattr(constants_module, constants_class_name, None)
#        if existing_constant_class is None:
#            constant_classes_to_add[constants_class_name] = schema_constants
#        else:
#            constants_diff = ClassConstantDiff(
#                existing_constant_class, schema_constants
#            )
#            constants_diff.get_constant_differences()
#            if constants_diff.needs_update():
#                constant_classes_to_update.append(constants_diff)
#            else:
#                constant_classes_up_to_date.append(constants_class_name)
#    if add_new:
#        add_schemas(constant_classes_to_add)
#    if update_existing:
#        update_schemas(constant_classes_to_update)
#    if verbose:
#        # log up to date constant classes
#        pass


def main():
#    mixins = collect_mixins()
    schemas = collect_schemas()
    update_schema_constants(schemas)


if __name__ == "__main__":
    main()
