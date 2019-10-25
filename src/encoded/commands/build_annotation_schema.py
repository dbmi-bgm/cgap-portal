import csv
import sys
import json
import logging
from collections import OrderedDict

logger = logging.getLogger(__name__)


def process_fields(row):
    """
    Takes in the row of field names and processes them
    Based on what Koray did for the current mp.csv
    """
    fields = []
    for name in row:
        new_name = name.split('(')[0].strip().lower()
        new_name = new_name.replace(" ", "_")
        if new_name.startswith('#'):
            continue
        fields.append(new_name)
    return fields


def read_mapping_table(fname):
    """
        Reads mapping table from fname
        Produces: Version, Date, list of fields
    """
    VERSION, DATE, FIELDS = None, None, None
    with open(fname, 'r') as f:
        reader = csv.reader(f)
        for row_idx, row in enumerate(reader):
            if row_idx == 0:
                VERSION = row[0].split('=')[1].strip()
            elif row_idx == 1:
                DATE = row[0].split('=')[1].strip()
            elif row_idx == 2:
                FIELDS = process_fields(row)
            else:
                break # we are done with this step
    logger.info('Mapping table Version: %s, Date: %s\n' % (VERSION, DATE))
    logger.info('Mapping table fields: %s\n' % (", ".join(FIELDS)))
    return VERSION, DATE, FIELDS


def add_annotation_schema_fields(schema):
    """
        Adds schema fields that are present regardless of the content
        of the mapping table.

        XXX: May want to specify this stuff somewhere
    """
    schema['title'] = 'Annotation Field'
    schema['description'] = "Schema for submitting an annotation field"
    schema['id'] = '/profiles/annotation_field.json'
    schema['$schema'] = 'http://json-schema.org/draft-04/schema#'
    schema['type'] = 'object'
    schema['required'] = ['field_name', 'institution', 'project', 'field_type', 'schema_title']
    schema['identifyingProperties'] = ['uuid', 'aliases', 'field_name']
    schema['additionalProperties'] = False
    schema['mixinProperties'] = [
        { "$ref": "mixins.json#/schema_version" },
        { "$ref": "mixins.json#/uuid" },
        { "$ref": "mixins.json#/aliases" },
        { "$ref": "mixins.json#/submitted" },
        { "$ref": "mixins.json#/modified" },
        { "$ref": "mixins.json#/status" },
        { "$ref": "mixins.json#/attribution" },
        { "$ref": "mixins.json#/notes" },
        { "$ref": "mixins.json#/static_embeds" }
    ]
    schema['properties'] = {}
    schema['properties']['schema_version'] = {'default': '1'}
    logger.info('Added default fields to annotation schema\n')


def add_annotation_schema_facets_and_columns(schema):
    """
        Adds facets and columns to the annotation field schema

        XXX: May want to specify this stuff somewhere
    """
    schema['facets'] = {
        "field_type": {
            "title": "Type"
        },
        "source_name": {
            "title": "Source"
        },
        "scope": {
            "title": "Scope"
        },
        "mvp": {
            "title": "MVP"
        }
    }
    schema['columns'] = {
        "schema_title": {
            "title": "Field name"
        },
        "field_type": {
            "title": "Field type"
        },
        "source_name": {
            "title": "Source"
        }
    }


def build_annotation_field_schema(fields):
    """
        Takes in fields read from the mapping table and builds the associated
        annotation_field.json file. First it uses the above helper to add some
        default fields, then it processes each field, which is essentially hard
        coded since there is no consistent format.

        XXX: When there is consistent formatting this can be heavily simplified.
    """
    schema = {}
    add_annotation_schema_fields(schema)
    for field in fields:
        if field == 'field_name':
            schema['properties'][field] = {
                'title': 'Field Name',
                'description': 'Name of the annotation field name',
                'type': 'string',
                'uniqueKey': True
            }
        elif field == 'vcf_name':
            schema['properties'][field] = {
                "title": "Field Name on VCF",
                "description": "Original name of the annotaion field name on vcf file",
                "type": "string"
            }
        elif field == 'is_list':
            schema['properties']['is_list'] = {
                "title": "NCBI Entrez Gene ID",
                "type": "boolean",
                "default": False
            }
        elif field == 'enum_list':
            schema['properties']['enum_list'] = {
                "title": "Enum list",
                "description": "you can restrict to set of values",
                "type": "array",
                "uniqueItems": True,
                "items": {
                    "title": "Enum list item",
                    "type":  "string"
                }
            }
        elif field == 'field_type':
            schema['properties']['field_type'] = {
                "title": "Field type",
                "description": "Field type, number, integer, string",
                "type": "string",
                "enum": [
                    "string",
                    "number",
                    "integer",
                    "boolean"
                ]
            }
        elif field == 'sub_embedding_group':
            schema['properties']['sub_embedding_group'] = {
                 "title": "Sub-embedding group",
                 "description": "If field belong to a sub embedded object, add field name",
                 "type": "string"
            }
        elif field == 'scale':
            schema['properties']['scale'] = {
                "title": "Scale",
                "description": "Scale defined by new annotation structure",
                "type": "string"
            }
        elif field == 'domain':
            schema['properties']['domain'] = {
                "title": "Domain",
                "description": "Domain defined by new annotation structure",
                "type": "string"
            }
        elif field == 'method':
            schema['properties']['method'] = {
                "title": "Method",
                "description": "Method defined by new annotation structure",
                "type": "string"
            }
        elif field == 'separator': # XXX: typo?
            schema['properties']['seperator'] = {
                "title": "Seperator",
                "description": "if value is list, use this seperator to split items",
                "type": "string",
                "enum": [
                    "comma",
                    "pipe",
                    "semicolon",
                    "colon",
                    "tab"
                ]
            }
        elif field == 'scope':
            schema['properties']['scope'] = {
                "title": "Scope",
                "description": "Scope that this field belongs to",
                "type": "string",
                "enum": [
                    "variant",
                    "sample",
                    "gene"
                ]
            }
        elif field == 'schema_title':
            schema['properties']['schema_title'] = {
                "title": "Schema Title",
                "description": "Title to be used in the variant schema for the field",
                "type": "string"
            }
        elif field == 'schema_description':
            schema['properties']['schema_description'] = {
                "title": "Description to be used in the variant schema for the field",
                "description": "description inception",
                "type": "string"
            }
        elif field == 'source_name':
            schema['properties']['source_name'] = {
                "title": "Source Name",
                "description": "Source used for collection information in this field",
                "type": "string"
            }
        elif field == 'source_version':
            schema['properties']['source_version'] = {
                "title": "Source Version",
                "description": "Version of source used for collection information in this field",
                "type": "string"
            }
        elif field == 'field_priority':
            schema['properties']['field_priority'] = {
                "title": "Field priority",
                "description": "Ranking number of the field (lower is better)",
                "type": "integer"
            }
        elif field == 'column_priority':
            schema['properties']['column_priority'] = {
                "title": "Column priority",
                "description": "Ranking number of the field for Column in search view (lower is better)",
                "type": "integer"
            }
        elif field == 'facet_priority':
            schema['properties']['facet_priority'] = {
                "title": "Field priority",
                "description": "Ranking number of the field for Facet in search view (lower is better)",
                "type": "integer"
            }
        elif field == 'links_to':
            schema['properties']['links_to'] = {
                "title": "Linking To",
                "description": "If this field can be associated with another item type from CGAP database",
                "type": "string",
                "enum": [
                    "Gene",
                    "Disorder",
                    "Phenotype"
                ]
            }
        elif field == 'mvp':
            schema['properties']['mvp'] = {
                "title": "MVP",
                "description": "Is this field part of MVP",
                "type": "boolean",
                "default": False
            }
        elif field == 'value_example':
            schema['properties']['value_example'] = {
                "title": "Example Value for this field",
                "description": "Example Value for this field, stored as text",
                "type": "string"
            }
        else:
            logger.info('Encountered field with no handler: %s' % field)

    add_annotation_schema_facets_and_columns(schema)
    return json.dumps(schema)


def main():
    """ Works with mp.csv, downloaded 10-25 """
    logging.basicConfig()
    if len(sys.argv) < 2:
        logger.error('Mapping table file not specified, exiting\n')
        exit(1)
    logger.info('Processing mapping table at: %s\n' % sys.argv[1])
    VERSION, DATE, FIELDS = read_mapping_table(sys.argv[1])
    if FIELDS is None:
        logger.error('Failed to process mapping table. Exiting.\n')
        exit(1)

    print(FIELDS)
    ANNOTATION_SCHEMA = build_annotation_field_schema(FIELDS)
    print(ANNOTATION_SCHEMA)
    with open('annotation_field.json', 'w+') as out:
        json.dump(ANNOTATION_SCHEMA, out)
    logger.info('Successfully wrote new annotation_schema.json\n')


if __name__ == '__main__':
    main()
