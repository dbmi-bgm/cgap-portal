import csv
import sys
import logging
from collections import OrderedDict

logger = logging.getLogger(__name__)
# these must change if variant_sample changes (not clear how these are specified in MP)
EXPECTED_VARIANT_FIELDS = ['sample', 'variant', 'qual', 'filter', 'call_info',
                           'gt', 'ad', 'dp', 'gq', 'pl', 'pgt', 'pid', 'ps', 'af']


def add_variant_sample_schema_fields(schema):
    """
    Adds schema fields for the variant sample that are essentially constant

    XXX: May want to specify this stuff somewhere
    """
    schema['title'] = 'Sample Variant'
    schema['description'] = "Schema for variant info for sample"
    schema['id'] = '/profiles/variant_sample.json'
    schema['$schema'] = 'http://json-schema.org/draft-04/schema#'
    schema['type'] = 'object'
    schema['required'] = ['institution', 'project']
    schema['identifyingProperties'] = ['uuid', 'aliases']
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
    logger.info('Added default fields to variant_sample schema\n')


def main():
    if len(sys.argv) < 2:
        logger.error('Mapping table file not specified, exiting\n')
        exit(1)
    logger.info('Building variant schema from mapping table: %s\n' % sys.argv[1])
    FIELDS = get_variant_fields(sys.argv[1])



if __name__ == '__main__':
    main()
