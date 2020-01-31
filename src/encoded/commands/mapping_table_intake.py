import csv
import sys
import six
import json
import argparse
import logging
from collections import OrderedDict, Mapping

logger = logging.getLogger(__name__)
EPILOG = __doc__


class MappingTableIntakeException(Exception):
    """ Specific type of exception we'd like to throw if we fail in this stage
        due to an error with the table itself
    """
    pass


class MappingTableParser(object):
    """ Class that encapsulates data/functions related to the mapping table.

        XXX: Should Validate the annotation fields against the given schema?
    """
    HEADER_ROW_INDEX = 2
    FIELD_TYPE_INDEX = 5  # XXX: hardcoded, must change if field_type is moved on mapping table
    INTEGER_FIELDS = ['no', 'max_size']
    BOOLEAN_FIELDS = ['is_list']

    def __init__(self, _mp, schema):
        self.mapping_table = _mp
        self.annotation_field_schema = json.load(open(schema, 'r'))
        self.version, self.date, self.fields = self.read_mp_meta()

    @staticmethod
    def process_fields(row):
        """ Takes in the row of field names and processes them. This involves replacing
            spaces, ignoring '#' commented out fields and dropping comments (like this)

        Args:
            row: row of fields to be processed from the mapping table

        Raises:
            MappingTableIntakeException if a duplicate field is detected or no fields
            are detected

        Returns:
            list of fields
        """
        fields = OrderedDict()
        for name in row:
            new_name = name.split('(')[0].strip().lower()
            new_name = new_name.replace(" ", "_")
            if new_name.startswith('#'):
                continue
            if new_name not in fields:
                fields[new_name] = True
            else:
                raise MappingTableIntakeException('Found duplicate field in %s' % row)
        if not fields:
            raise MappingTableIntakeException('Did not find any fields on row %s' % row)
        return fields.keys()

    def read_mp_meta(self):
        """ Reads mapping table from file given to class. First 3 rows of the mapping
            table contain this information. Version and Date are in the second column
            while fields are across the third row, as below:
                ,version=v1.5, ...
                ,date=12/1/2019, ...
                field1, field2, field3, ...

        Returns:
            3 tuple - version, date, fields
        """
        VERSION, DATE, FIELDS = None, None, None
        with open(self.mapping_table, 'r') as f:
            reader = csv.reader(f)
            for row_idx, row in enumerate(reader):
                if row_idx == 0:
                    VERSION = row[1].split('=')[1].strip()
                elif row_idx == 1:
                    DATE = row[1].split('=')[1].strip()
                elif row_idx == 2:
                    FIELDS = self.process_fields(row)
                else:
                    break # we are done with this step
        logger.info('Mapping table Version: %s, Date: %s\n' % (VERSION, DATE))
        logger.info('Mapping table fields: %s\n' % (", ".join(FIELDS)))
        return VERSION, DATE, FIELDS

    def process_mp_inserts(self):
        """ Processes the annotation fields in the mapping table to produce inserts
            Note that project and institution are required fields on the annotation
            field schema and are not set here

        Args:
            fname: mapping table location
            fields: list of fields on the table

        Returns:
            list of annotation field inserts
        """
        inserts = []
        with open(self.mapping_table, 'r') as f:
            reader = csv.reader(f)
            for row_idx, row in enumerate(reader):
                insert = {}
                if row_idx <= self.HEADER_ROW_INDEX: # skip header rows
                    continue
                for field_name, entry in zip(self.fields, row):
                    # handle int fields
                    if field_name in self.INTEGER_FIELDS:
                        if entry:
                            insert[field_name] = int(entry)
                    # handle bool fields
                    elif field_name in self.BOOLEAN_FIELDS:
                        if entry:
                            if entry == 'Y':
                                insert[field_name] = True
                            else:
                                insert[field_name] = False
                    else: # handle all other fields if they exist
                        if entry:
                            insert[field_name] = entry
                inserts.append(insert)
        return inserts


    @staticmethod
    def filter_fields_by_sample(inserts):
        """ Returns annotation fields that belong on the sample variant schema
        :param inserts: annotation field inserts processed from above
        :return: only annotations fields that are part of the sample variant
        """
        return [field for field in inserts if field.get('sub_embedding_group') == 'sample_variant']


    @staticmethod
    def filter_fields_by_variant(inserts):
        """ Returns annotation fields that belong on the variant schema
        :param inserts: all raw annotation field inserts
        :return: only annotation fields that are part of the sample variant
        """
        return [field for field in inserts if field.get('sub_embedding_group', '') != 'sample_variant']


    @staticmethod
    def generate_sample_variant_properties(inserts):
        """ Generates sample variant properties - due to changes in mapping table format this must now
            be handled separately from variants

        :param inserts: (PRE) annotation fields that belong to the sample variant
        :return: dictionary of sample_variant properties
        """
        props = OrderedDict()

        # get all fields first
        for prop in inserts:
            new_prop = OrderedDict()
            new_prop['field_name'] = prop.get('vcf_name')
            new_prop['source_name'] = prop.get('source_name')
            new_prop['source_version'] = prop.get('source_version')
            new_prop['type'] = prop.get('field_type')
            new_prop['is_list'] = prop.get('is_list')
            new_prop['max_size'] = prop.get('max_size')
            new_prop['description'] = prop.get('schema_description')
            new_prop['val_example'] = prop.get('value_example')
            if new_prop['is_list']:
                del new_prop['is_list']  # inner object is not a list
                props[new_prop['field_name']] = {
                    'title': new_prop['field_name'],
                    'type': 'array',
                    'items': new_prop
                }
            else:
                props[new_prop['field_name']] = new_prop

        return props


    @staticmethod
    def generate_variant_properties(inserts):
        """ Generates sample variant or variant schema properties
            This function is quite long and complicated... Should probably be
            refactored

        Args:
            inserts: result of one of the above two functions

        Returns:
            Returns variant item properties
        """
        props = OrderedDict()
        cols = OrderedDict()
        facs = OrderedDict()

        def get_prop(item):
            temp = OrderedDict()
            prop_name = item['vcf_name']
            features = OrderedDict()
            features.update({
                "title": prop_name,
                "vcf_name": prop_name,
                "type": item['field_type']
            })
            if item.get('schema_description'):
                features['description'] = item['schema_description']

            for a_field in ['source_name', 'source_version']:
                if item.get(a_field):
                    features[a_field] = item[a_field]

            for a_field in ['max_size']:  # cast integer field
                if item.get(a_field):
                    features[a_field]= int(item[a_field])

            # handle sub_embedded object
            if item.get('sub_embedding_group'):
                sub_temp = OrderedDict()
                prop = OrderedDict()
                sum_ob_name = item['sub_embedding_group']
                sub_title = sum_ob_name.replace("_", " ").title()

                # handle sub-embedded object that is an array
                if item.get('is_list'):
                    prop[prop_name] = {
                        'title': item.get('vcf_name', 'None provided'),
                        'type': 'array',
                        'items': features
                    }
                    sub_temp.update({
                        'title': sum_ob_name,
                        'type': 'object',
                        'items': {
                            'title': sub_title,
                            'type': 'array',
                            'properties': prop
                            }
                    })
                else:
                    prop[prop_name] = features
                    sub_temp.update({
                        "title": sub_title,
                        "type": "object",
                        "items": {
                            "title": sub_title,
                            "type": "object",
                            "properties": prop
                            }
                        })
                    temp[sum_ob_name] = sub_temp
                    return temp

            # convert to array structure
            if item.get('is_list'):
                array_item = OrderedDict()
                array_item.update( {
                    "title": item.get('vcf_name'),
                    "type": "array",
                    "vcf_name": item['vcf_name']
                })
                if item.get('schema_description'):
                    array_item['description'] = item['schema_description']
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
            update(props, get_prop(obj))
            if obj.get('facet_priority'):
                facs[obj['vcf_name_v0.2']] = {'title': obj['schema_title']}
            if obj.get('column_priority'):
                cols[obj['vcf_name_v0.2']] = {'title': obj['schema_title']}
            props.update(get_prop(obj))

        if not props:
            raise MappingTableIntakeException('Got no properties on schema!')
        return props, cols, facs


    @staticmethod
    def add_default_schema_fields(schema):
        """ Adds default schema fields

        Args:
            schema: schema to add fields to
        """
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

    def generate_variant_sample_schema(self, sample_props):
        """ Builds the variant_sample.json schema based on sample_props

        Args:
            sample_props: first output of generate_properties

        Returns:
            Variant sample schema
        """
        schema = {}
        self.add_default_schema_fields(schema)
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
        logger.info('Built variant_sample schema')
        return schema

    def generate_variant_schema(self, var_props, cols, facs):
        """  Builds the variant.json schema based on var_props

        Args:
            sample_props: first output of generate_properties for variant
            cols: second output of generate_properties for variant
            facs: third output of generate_properties for variant

        Returns:
            Variant schema
        """
        schema = {}
        self.add_default_schema_fields(schema)
        schema['title'] = 'Variants'
        schema['description'] = "Schema for variants"
        schema['id'] = '/profiles/variant.json'
        schema['properties'] = var_props
        schema['properties']['schema_version'] = {'default': '1'}
        schema['facets'] = facs
        schema['columns'] = cols
        logger.info('Build variant schema')
        return schema

    @staticmethod
    def write_schema(schema, fname):
        """ Writes the given schema (JSON) to the given file 'fname'

        Args:
            schema: dictionary to write as json as the schema
            fname: file to write out to
        """
        with open(fname, 'w+') as out:
            json.dump(schema, out, indent=4)
        logger.info('Successfully wrote schema: %s to file: %s\n' % (schema['title'], fname))

    def run(self, vs_out=None, v_out=None, institution=None, project=None, write=True):
        """ Runs the mapping table intake program, generates and writes schemas
            and returns inserts to be posted in main

        Args:
            vs_out: where to write variant_sample schema
            v_out: where to write variant schema
            institution: what institution to attach to these inserts
            project: what project to attach to these inserts
            write: whether to write the schemas - default True

        Returns:
            inserts: annotation field inserts
        """
        inserts = self.process_mp_inserts()
        variant_sample_props, _, _ = self.generate_properties(self.filter_inserts_sample(inserts), variant=False)
        variant_props, cols, facs = self.generate_properties(self.filter_inserts_variant(inserts))
        variant_sample_schema = self.generate_variant_sample_schema(variant_sample_props)
        variant_schema = self.generate_variant_schema(variant_props, cols, facs)
        if write:
            if not vs_out or v_out:
                raise MappingTableIntakeException('Write specified but no output file given')
            self.write_schema(variant_sample_schema, vs_out)
            self.write_schema(variant_schema, v_out)
            logger.info('Successfully wrote schemas')
        if project or institution:
            for insert in inserts:
                if project:
                    insert['project'] = project
                if institution:
                    insert['institution'] = institution
        return inserts


def main():
    """ Takes in the mapping table and produces annotation field inserts, variant_sample
        schema and variant schema.
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Takes in a mapping table and produces inserts/schemas",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('mp', help='path to mapping table')
    parser.add_argument('annotation_field_schema', help='path to annotation field schema')
    parser.add_argument('variant', help='where to write variant schema')
    parser.add_argument('sample', help='where to write sample_variant schema')
    parser.add_argument('project', help='project to post inserts under')
    parser.add_argument('institution', help='institution to post inserts under')
    parser.add_argument('--write-schemas', action='store_true', default=True,
                        help='If specified will write new schemas to given locations')
    parser.add_argument('--post-inserts', action='store_true', default=False,
                        help='If specified will post inserts, by default False')
    args = parser.parse_args()

    # read/process mapping table, build inserts
    logger.info('Building annotations from mapping table: %s' % args.mp)
    parser = MappingTableParser(args.mp, args.annotation_field_schema)
    inserts = parser.run(args.sample, args.variant,
                         institution=args.institution, project=args.project,
                         write=args.write_schemas)

    # if not a dry run try to post inserts
    if args.post_inserts:
        from dcicutils import ff_utils
        for entry in inserts:
            ff_utils.post_metadata(entry, 'annotation_field', None)
    logger.info('Successfully posted annotations')


if __name__ == '__main__':
    main()
