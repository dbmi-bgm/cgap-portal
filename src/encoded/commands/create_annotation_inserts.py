import csv
import sys
import six
import json
import logging
from collections import OrderedDict, Mapping

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
                if field_name in ['field_priority', 'column_priority', 'facet_priority']:
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
                        field_type = row[3] # hardcoded, must change if field_type is moved on mapping table
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
            insert['project'] = '12a92962-8265-4fc0-b2f8-cf14f05db58b'
            insert['institution'] = 'hms-dbmi'
            insert['submitted_by'] = 'koray_kirli@hms.harvard.edu'
            inserts.append(insert)
    return inserts


def generate_sample_json(inserts):
    """
    Generates sample JSON given the inserts, which are first pruned and sorted
    based on priority.
    """
    sample_props = OrderedDict()
    mvp_list = [i for i in inserts if i.get('mvp')]
    samples = [i for i in mvp_list if i.get('scope') == 'sample']
    samples = sorted(samples, key = lambda i: i.get('field_priority', 1000000))

    def get_prop(item):
        update = OrderedDict()
        prop_name = item['field_name']
        features = OrderedDict()
        features.update({
            "title": item['schema_title'],
            "vcf_name": item['vcf_name'],
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
        for a_field in ['scale', 'domain', 'method', 'seperator', 'source_name', 'source_version']:
            if item.get(a_field):
                features[a_field] = item[a_field]

        # convert array structure
        if item.get('is_list'):
            array_item = OrderedDict()
            array_item.update( {
                "title": item['schema_title'],
                "type": "array",
                "vcf_name": item['vcf_name']
            })
            if item.get('schema_description'):
                array_item['description'] = item['schema_description']
            if item.get('field_priority'):
                array_item['lookup'] = item['field_priority']
            array_item['items'] = features
            update[prop_name] = array_item
            return update
        else:
            update[prop_name] = features
            return update

    for sample in samples:
        if sample.get('sub_embedding_group'):
            continue
        sample_props.update(get_prop(sample))
    return sample_props


def generate_variant_json(inserts):
    """
    Generates variant JSON, similarly to above
    Given inserts generates var_props, columns and facets as a 3 tuple
    """
    var_props = OrderedDict()
    cols = OrderedDict()
    facs = OrderedDict()
    mvp_list = [i for i in inserts if i.get('mvp')]
    variants = [i for i in mvp_list if i.get('scope') != 'sample']

    def get_prop(item):
        temp = OrderedDict()
        prop_name = item['field_name']
        features = OrderedDict()
        features.update({
            "title": item['schema_title'],
            "vcf_name": item['vcf_name'],
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

        for a_field in ['scale', 'domain', 'method', 'seperator', 'source_name', 'source_version']:
            if item.get(a_field):
                features[a_field] = item[a_field]

        # handle sub_embedded object
        if item.get('sub_embedding_group'):
            assert item['is_list'] == True
            sub_temp = OrderedDict()
            prop = OrderedDict()
            prop[prop_name] = features
            sum_ob_name = item['sub_embedding_group']
            sub_title = sum_ob_name.replace("_", " ").title()
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
                "title": item['schema_title'],
                "type": "array",
                "vcf_name": item['vcf_name']
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

    for variant in variants:
        update(var_props, get_prop(variant))
        if variant.get('facet_priority'):
            facs[variant['field_name']] = {'title': variant['schema_title']}
        if variant.get('column_priority'):
            cols[variant['field_name']] = {'title': variant['schema_title']}

    return var_props, cols, facs


def main():
    """ Works with mp.csv, downloaded 10-25 """
    logging.basicConfig()
    if len(sys.argv) < 2:
        logger.error('Mapping table file not specified, exiting\n')
        exit(1)
    logger.info('Building annotations from mapping table: %s\n' % sys.argv[1])
    VERSION, DATE, FIELDS = read_mapping_table(sys.argv[1])
    if FIELDS is None:
        logger.error('Failed to process mapping table. Exiting.\n')
        exit(1)
    inserts = process_inserts(sys.argv[1], FIELDS)
    # XXX: Post inserts below
    # from ff_utils import post_metadata
    # for entry in inserts:
    #     ff_utils.post_metadata(entry, 'annotation_field', auth_key)
    logger.info('Successfully created/posted annotations\n')
    sample_props = generate_sample_json(inserts)
    logger.info('Successfully generated sample JSON\n')
    var_props, cols, facs = generate_variant_json(inserts)
    logger.info('Successfully generated variant JSON\n')


if __name__ == '__main__':
    main()
