import csv
import sys
import six
import json
import argparse
import logging
from collections import OrderedDict, Mapping

logger = logging.getLogger(__name__)
EPILOG = __doc__


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
                VERSION = row[1].split('=')[1].strip()
            elif row_idx == 1:
                DATE = row[1].split('=')[1].strip()
            elif row_idx == 2:
                FIELDS = process_fields(row)
            else:
                break # we are done with this step
    logger.info('Mapping table Version: %s, Date: %s\n' % (VERSION, DATE))
    logger.info('Mapping table fields: %s\n' % (", ".join(FIELDS)))
    return VERSION, DATE, FIELDS


def process_inserts(fname, fields):
    """
        Processes the annotation fields in the mapping table to produce inserts
        Creates a list of inserts
        Currently should create 887 inserts based on latest MP
    """
    inserts = []
    with open(fname, 'r') as f:
        reader = csv.reader(f)
        for row_idx, row in enumerate(reader):
            insert = {}
            if row_idx < 3: # skip header rows
                continue
            for field_name, entry in zip(fields, row):
                # handle int fields
                if field_name in ['field_priority', 'column_priority', 'facet_priority', 'no']:
                    if entry:
                        insert[field_name] = int(entry)
                # handle bool fields
                elif field_name in ['is_list', 'mvp']:
                    if entry:
                        if entry == 'Y':
                            insert[field_name] = True
                        else:
                            insert[field_name] = False
                elif field_name in ['enum_list']:
                    if entry:
                        field_type = row[5] # hardcoded, must change if field_type is moved on mapping table
                        val_list = []
                        if field_type == 'string':
                            val_list = [en.strip() for en in entry.split(',') if en.strip()]
                        elif field_type == 'number':
                            val_list = [float(en.strip()) for en in entry.split(',') if en.strip()]
                        elif field_type == 'integer':
                            val_list = [int(en.strip()) for en in entry.split(',') if en.strip()]
                        insert[field_name] = val_list
                else: # handle all other fields if they exist
                    if entry:
                        insert[field_name] = entry
            if not insert.get('mvp', False):  # ignore non-mvp items for now
                continue
            insert['project'] = 'encode-project' # XXX: Test
            insert['institution'] = 'encode-institution' # XXX: Test
            # insert['submitted_by'] = 'koray_kirli@hms.harvard.edu'
            # XXX: Hard coded stripping of prefix, see vep in mapping table
            # if insert.get('sub_embedding_group', None):
            #     insert['vcf_name_v0.2'] = ''.join(insert['vcf_name_v0.2'].split('_')[1:])
            inserts.append(insert)
    return inserts


def get_sample_inserts(inserts):
    """
        Filters inserts for those that are mvp and sample
        Meant to be passed to generate_properties
    """
    mvp_list = [i for i in inserts if i.get('mvp')]
    samples = [i for i in mvp_list if i.get('scope') == 'sample']
    samples = sorted(samples, key = lambda i: i.get('field_priority', 1000000))
    return samples


def get_variant_inserts(inserts):
    """
        Filters inserts for those that are mvp and not sample
        Meant to be passed to generate_properties
    """
    mvp_list = [i for i in inserts if i.get('mvp')]
    variants = [i for i in mvp_list if i.get('scope') != 'sample']
    return variants


def generate_properties(inserts, variant=True):
    """ Generates sample variant or variant schema properties """
    props = OrderedDict()
    cols = OrderedDict()
    facs = OrderedDict()

    def get_prop(item):
        temp = OrderedDict()
        prop_name = item['vcf_name_v0.2']
        features = OrderedDict()
        features.update({
            "title": item.get('schema_title', 'None provided'),
            "vcf_name": prop_name,
            "type": item['field_type']
        })
        if item.get('schema_description'):
            features['description'] = item['schema_description']
        if item.get('links_to'):
            features['linkTo'] = item['links_to']
        if item.get('enum_list'):
            features['enum'] = item['enum_list']
        if item.get('field_priority'):
            features['lookup'] = item['field_priority']

        for a_field in ['scale', 'domain', 'method', 'separator', 'source_name', 'source_version']:
            if item.get(a_field):
                features[a_field] = item[a_field]

        # handle sub_embedded object if we are doing variant
        if variant:
            if item.get('sub_embedding_group'):
                sub_temp = OrderedDict()
                prop = OrderedDict()
                sum_ob_name = item['sub_embedding_group']
                sub_title = sum_ob_name.replace("_", " ").title()

                # handle sub-embedded object that is an array
                if item.get('is_list'):
                    prop[prop_name] = {
                        'title': item.get('schema_title', 'None provided'),
                        'type': 'array',
                        'vcf_name': item['vcf_name_v0.2'],
                        'items': features
                    }
                    sub_temp.update({
                        "title": sum_ob_name,
                        "type": "array",
                        "items": {
                            "title": sub_title,
                            "type": "array",
                            "properties": prop
                            }
                        })
                else:
                    prop[prop_name] = features
                    sub_temp.update({
                        "title": sub_title,
                        "type": "array",
                        "items": {
                            "title": sub_title,
                            "type": "object",
                            "properties": prop
                            }
                        })
                temp[sum_ob_name] = sub_temp
                return temp

        # convert to array sturcutre
        if item.get('is_list'):
            array_item = OrderedDict()
            array_item.update( {
                "title": item.get('schema_title', 'None provided'),
                "type": "array",
                "vcf_name": item['vcf_name_v0.2']
            })
            if item.get('schema_description'):
                array_item['description'] = item['schema_description']
            if item.get('field_priority'):
                array_item['lookup'] = item['field_priority']
            array_item['items'] = features
            temp[prop_name] = array_item
            return temp
        else:
            temp[prop_name] = features
            return temp

    def update(d, u):
        for k, v in six.iteritems(u):
            dv = d.get(k, {})
            if not isinstance(dv, Mapping):
                d[k] = v
            elif isinstance(v, Mapping):
                d[k] = update(dv, v)
            else:
                d[k] = v
        return d

    for obj in inserts:
        if variant:
            update(props, get_prop(obj))
            if obj.get('facet_priority'):
                facs[obj['field_name']] = {'title': obj['schema_title']}
            if obj.get('column_priority'):
                cols[obj['field_name']] = {'title': obj['schema_title']}
        else:
            if obj.get('sub_embedding_group'):
                continue
            props.update(get_prop(obj))

    return props, cols, facs


def add_default_schema_fields(schema):
    """ Adds default schema fields """
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


def generate_variant_sample_schema(sample_props):
    """
        Builds the variant_sample.json schema based on sample_props
    """
    schema = {}
    add_default_schema_fields(schema)
    schema['title'] = 'Sample Variant'
    schema['description'] = "Schema for variant info for sample"
    schema['id'] = '/profiles/variant_sample.json'
    schema['properties'] = sample_props
    schema['properties']['schema_version'] = {'default': '1'}
    schema['properties']['sample'] = {
        'title': 'Sample',
        'type': 'string',
        'linkTo': 'Sample'
    }
    schema['properties']['variant'] = {
        'title': 'Variant',
        'type': 'string',
        'linkTo': 'Variant'
    }
    schema['columns'] = {}
    schema['facets'] = {}
    logger.info('Built variant_sample schema\n')
    return schema


def generate_variant_schema(var_props, cols, facs):
    """ Creates variant.json schema """
    schema = {}
    add_default_schema_fields(schema)
    schema['title'] = 'Variants'
    schema['description'] = "Schema for variants"
    schema['id'] = '/profiles/variant.json'
    schema['properties'] = var_props
    schema['properties']['schema_version'] = {'default': '1'}
    schema['facets'] = facs
    schema['columns'] = cols
    logger.info('Build variant schema\n')
    return schema


def write_schema(schema, fname):
    """ Writes the given schema (JSON) to the given file 'fname' """
    with open(fname, 'w+') as out:
        json.dump(schema, out, indent=4)
    logger.info('Successfully wrote schema: %s to file: %s\n' % (schema['title'], fname))


def main():
    """
    Works with mp.csv, downloaded 10-25
    Takes in the mapping table and produces annotation field inserts, variant_sample
    schema and variant schema.
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Takes in a mapping table and produces inserts/schemas",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('mp', help='path to mapping table')
    parser.add_argument('variant', help='where to write variant schema')
    parser.add_argument('sample', help='where to write sample_variant schema')
    parser.add_argument('--post-inserts', action='store_true', default=True,
                        help='If specified will post inserts, by default False')
    args = parser.parse_args()

    # read/process mapping table, build inserts
    logger.info('Building annotations from mapping table: %s\n' % args.mp)
    VERSION, DATE, FIELDS = read_mapping_table(args.mp)
    if FIELDS is None:
        logger.error('Failed to process mapping table. Exiting.\n')
        exit(1)
    inserts = process_inserts(args.mp, FIELDS)

    # if not a dry run try to post inserts
    if not args.post_inserts:
        from ff_utils import post_metadata
        for entry in inserts:
            ff_utils.post_metadata(entry, 'annotation_field', None)
    logger.info('Successfully created/posted annotations\n')

    # generate schemas from inserts
    sample_props, _, _ = generate_properties(get_sample_inserts(inserts), variant=False)
    variant_sample_schema = generate_variant_sample_schema(sample_props)
    write_schema(variant_sample_schema, args.sample)
    var_props, cols, facs = generate_properties(get_variant_inserts(inserts))
    variant_schema = generate_variant_schema(var_props, cols, facs)
    write_schema(variant_schema, args.variant)
    logger.info('Successfully wrote schemas\n')


if __name__ == '__main__':
    main()
