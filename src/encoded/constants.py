from pathlib import Path

from dcicutils.misc_utils import snake_case_to_camel_case
from snovault import load_schema

from .appdefs import ITEM_INDEX_ORDER
from .schema_constants import *


#schema_constants = SchemaConstants()
#
#
#class SchemaConstants:
#    ENCODED_DIR = Path(__file__).parents[1]
#    SCHEMA_DIR = ENCODED_DIR.joinpath("schemas")
#    SCHEMA_FILES = SCHEMA_DIR.iterdir()
#    MIXINS_FILE = SCHEMA_DIR.joinpath("mixins.json")
#    CONSTANTS_CLASS_ADD_ON = "Constants"
#    SCHEMA_PROPERTIES = "properties"
#
#    def __init__(self):
#        self.schemas = []
#        self.constant_classes = {}
#
#    def collect_schemas(self):
#        schemas = {}
#        for schema_path in SCHEMA_FILES:
#            schema_type = snake_case_to_camel_case(schema_path.stem)
#            if schema_type in ITEM_INDEX_ORDER:  # Assuming others irrelevant for constants
#                schema = load_schema(schema_path.absolute())
#                schemas[schema_type] = schema
#    return schemas
