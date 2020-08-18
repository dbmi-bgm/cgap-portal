import csv
import six
import json
import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from collections import OrderedDict, Mapping
from ..util import resolve_file_path

logger = logging.getLogger(__name__)
EPILOG = __doc__


class MappingTableIntakeException(Exception):
    """ Specific type of exception we'd like to throw if we fail in this stage
        due to an error with the table itself
    """
    pass


class MappingTableParser(object):
    """ Class that encapsulates data/functions related to the annotation field mapping table. """
    HEADER_ROW_INDEX = 2
    FIELD_TYPE_INDEX = 9  # XXX: hardcoded, must change if field_type is moved on mapping table
    INTEGER_FIELDS = ['no', 'maximum_length_of_value', 'column_order', 'facet_order', 'default', 'min', 'max']
    BOOLEAN_FIELDS = ['is_list', 'calculated_property', 'embedded_field', 'do_import']
    STRING_FIELDS = ['field_name', 'source_name', 'source_version', 'sub_embedding_group',
                     'annotation_category', 'separator', 'description', 'value_example',
                     'scope', 'schema_title', 'pattern', 'link', 'comments']
    SPECIAL_FIELDS = ['field_type', 'enum_list', 'links_to', 'annotation_space_location']
    ALL_FIELDS = INTEGER_FIELDS + BOOLEAN_FIELDS + STRING_FIELDS + SPECIAL_FIELDS
    EMBEDDED_VARIANT_FIELDS = resolve_file_path('schemas/variant_embeds.json')
    EMBEDDED_VARIANT_SAMPLE_FIELDS = resolve_file_path('schemas/variant_sample_embeds.json')  # XXX: unused currently
    EMBEDS_TO_GENERATE = [('variant', EMBEDDED_VARIANT_FIELDS),
                          ('variant_sample', EMBEDDED_VARIANT_SAMPLE_FIELDS)]
    NAME_FIELD = 'field_name'

    def __init__(self, _mp, schema, skip_embeds=False):
        self.mapping_table = _mp
        self.annotation_field_schema = json.load(open(schema, 'r'))
        self.version, self.date, self.fields = self.read_mp_meta()
        if not skip_embeds:  # if calling from gene, do not wipe variant/variant_sample embeds
            self.provision_embeds()

    @staticmethod
    def process_fields(row):
        """ Takes in the row of field names and processes them. At this point fields are all
            lowercased and use underscores, such as 'field_name'

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
            if name not in fields:
                fields[name] = True
            else:
                raise MappingTableIntakeException('Found duplicate field in %s' % row)
        if not fields:
            raise MappingTableIntakeException('Did not find any fields on row %s' % row)
        return fields.keys()

    def provision_embeds(self):
        """ Does setup necessary for writing embeds to JSON files in the schemas directory
            Called by initializer based on EMBEDS_TO_GENERATE, overwrite this to control
            this functionality (for genes).
        """
        for field, f in self.EMBEDS_TO_GENERATE:
            with open(f, 'w+') as fd:
                json.dump({field: {}}, fd)

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
        version, date, fields = None, None, None
        with open(self.mapping_table, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            for row_idx, row in enumerate(reader):
                if row_idx == 0:
                    version = row[1].split('=')[1].strip()
                elif row_idx == 1:
                    date = row[1].split('=')[1].strip()
                elif row_idx == 2:
                    fields = self.process_fields(row)
                else:
                    break # we are done with this step
        logger.info('Mapping table Version: %s, Date: %s\n' % (version, date))
        logger.info('Mapping table fields: %s\n' % (", ".join(fields)))
        return version, date, fields

    def process_annotation_field_inserts(self):
        """ Processes the annotation fields in the mapping table to produce inserts
            Note that project and institution are required fields on the annotation
            field schema and are not set here

        :returns: list of annotation field inserts
        """
        inserts = []
        with open(self.mapping_table, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            for row_idx, row in enumerate(reader):
                insert = {}
                if row_idx <= self.HEADER_ROW_INDEX:  # skip header rows
                    continue
                for field_name, entry in zip(self.fields, row):
                    if field_name not in self.annotation_field_schema['properties'] or not entry:
                        continue
                    if field_name in self.INTEGER_FIELDS:  # handle int fields
                        if entry is not None:  # entry=0 is a normal value
                            insert[field_name] = int(entry)
                    elif field_name in self.BOOLEAN_FIELDS:  # handle bool fields
                        if entry is not None:
                            if entry == 'Y':
                                insert[field_name] = True
                            else:  # assume False if anything other than 'Y' is present
                                insert[field_name] = False
                    elif field_name in ['enum_list']:  # handle enum fields
                        if entry is not None:
                            field_type = row[self.FIELD_TYPE_INDEX]
                            val_list = []
                            if field_type == 'string':
                                val_list = [en.strip() for en in entry.split(',') if en.strip()]
                            elif field_type == 'number':
                                val_list = [float(en.strip()) for en in entry.split(',') if en.strip()]
                            elif field_type == 'integer':
                                val_list = [int(en.strip()) for en in entry.split(',') if en.strip()]
                            insert[field_name] = val_list
                    else:  # handle all other fields with direct copy if they exist
                        if field_name == 'pattern':  # must decode escape characters
                            insert[field_name] = entry.encode().decode('unicode-escape')
                        else:
                            insert[field_name] = entry
                inserts.append(insert)
        return inserts

    @staticmethod
    def filter_fields_by_sample(inserts):
        """ Returns annotation fields that belong on the sample variant schema

        :param inserts: annotation field inserts processed from above
        :return: only annotations fields that are part of the sample variant
        """
        return [field for field in inserts if field.get('scope', '') == 'sample_variant']

    @staticmethod
    def filter_fields_by_variant(inserts):
        """ Returns annotation fields that belong on the variant schema

        :param inserts: all raw annotation field inserts
        :return: only annotation fields that are part of the sample variant
        """
        return [field for field in inserts if field.get('scope', '') == 'variant']

    def update_embeds(self, item, typ):
        """ Updates the EMBEDDED_FIELDS location JSON containing the embeds for Variant.
            NOTE: the files are overwritten everytime you run the process!

            XXX: This does NOT work properly if for linkTos, embeds required .keyword!

        :param item: embedded field to be written
        """
        for t, f in self.EMBEDS_TO_GENERATE:
            if typ == t:
                with open(f, 'rb') as fd:
                    embeds = json.load(fd)
                    link_type = 'embedded_field'
                    prefix = ''
                    if item.get('sub_embedding_group', None):
                        prefix = self.format_sub_embedding_group_name(item.get('sub_embedding_group'), type='key') + '.'
                    if link_type not in embeds[t]:
                        embeds[t][link_type] = [prefix + item[self.NAME_FIELD]]
                    else:
                        embeds[t][link_type].append(prefix + item[self.NAME_FIELD])
                with open(f, 'w+') as wfd:
                    json.dump(embeds, wfd)
                    wfd.write('\n')  # write newline at EOF

    @staticmethod
    def format_sub_embedding_group_name(json_or_str, type='key'):
        """ Helper method that will extract the appropriate value from sub_embedding_group

        :param json_or_str: entry in mapping table, could be string or json, so we try both
        :param type: one of key or title
        :return: title that you wanted based on inputs
        """
        if type not in ['key', 'title']:
            raise MappingTableIntakeException('Tried to parse sub_embedded_group with'
                                              'key other than "key" or "title": %s ' % type)
        try:
            fmt = json.loads(json_or_str)
        except Exception:  # just a string is given, use for both name and title
            return json_or_str
        else:
            return fmt[type]

    def generate_properties(self, inserts, variant=True):
        """ Generates sample variant or variant schema properties
            This function is quite long and complicated... Should probably be
            refactored

        :param inserts: result of one of the above two functions
        :param variant: whether or not we are generating variant props or sample_variant props
        :return: properties
        """
        props = OrderedDict()
        cols = OrderedDict()
        facs = OrderedDict()

        # inner functions to be used as helper
        def get_prop(item):
            if item.get('embedded_field', False):
                self.update_embeds(item, item.get('scope', 'gene'))  # XXX: HACK - how to get around? -Will
                return OrderedDict()
            if not item.get('do_import', True):  # DROP fields that explicitly have do_import = False
                return OrderedDict()

            temp = OrderedDict()
            prop_name = item[self.NAME_FIELD]
            features = OrderedDict()
            features.update({
                "title": item.get('schema_title', prop_name),
                self.NAME_FIELD: prop_name,
                "type": item['field_type']
            })
            # handle fields where key changes directly
            if item.get('schema_description'):
                features['description'] = item['schema_description']
            if item.get('links_to'):
                features['linkTo'] = item['links_to']
            if item.get('enum_list'):
                features['enum'] = item['enum_list']
            if item.get('field_priority'):
                features['lookup'] = item['field_priority']

            # handle boolean fields
            for a_field in self.BOOLEAN_FIELDS:
                if item.get(a_field) and a_field != 'is_list':
                    features[a_field] = item[a_field]

            # handle string fields
            for a_field in self.STRING_FIELDS:
                if item.get(a_field):
                    features[a_field] = item[a_field]

            # handle int fields
            for a_field in self.INTEGER_FIELDS:
                if item.get(a_field) is not None:
                    features[a_field] = int(item[a_field])

            # handle sub_embedded object
            if item.get('sub_embedding_group'):
                sub_temp = OrderedDict()
                prop = OrderedDict()
                sum_ob_name = self.format_sub_embedding_group_name(item['sub_embedding_group'], type='key')
                sub_title = self.format_sub_embedding_group_name(item['sub_embedding_group'], type='title')

                # handle sub-embedded object that is an array
                if item.get('is_list'):
                    prop[prop_name] = {
                        'title': item.get(self.NAME_FIELD, 'None provided'),
                        'type': 'array',
                        'items': features
                    }
                    sub_temp.update({
                        'title': sum_ob_name,
                        'type': 'array',
                        'items': {
                            'title': sub_title,
                            'type': 'object',
                            'properties': prop
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

            # convert to array structure
            if item.get('is_list'):
                array_item = OrderedDict()
                array_item.update({
                    "title": item.get('schema_title', item[self.NAME_FIELD]),
                    "type": "array",
                    self.NAME_FIELD: item[self.NAME_FIELD]
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

        def is_variant(o):
            return o.get('scope') == 'variant'

        def is_sub_embedded_object(o):
            return o.get('sub_embedding_group')

        def is_facet(o):
            return o.get('facet_order', None)

        def is_column(o):
            return o.get('column_order')

        def is_link_to(o):
            return o.get('links_to')

        def is_numbered_field(o):
            return o.get('field_type') in ['integer', 'number']

        def has_grouping(o):
            return o.get('annotation_category', False)

        def insert_column_or_facet(d, o, facet=True):
            val = {'title': o.get('schema_title', o.get(self.NAME_FIELD))}
            if is_numbered_field(o) and is_facet(o):
                val['aggregation_type'] = 'stats'
                if "number_step" in o:
                    val['number_step'] = o["number_step"]
                elif o['field_type'] == "integer":
                    val['number_step'] = 1
                else:
                    # Default. Is assumed to be "any" on frontend if absent,
                    # but adding 'documentation through redundancy', if such thing is a thing.
                    val['number_step'] = "any"

            # add facet (or column) order/grouping
            if facet and is_facet(o) is not None:
                val['order'] = is_facet(o)
                if has_grouping(o) is not False:
                    val['grouping'] = o.get('annotation_category')
            if not facet and is_column(o) is not None:
                val['order'] = is_column(o)

            if is_sub_embedded_object(o):
                if is_link_to(o):  # add .display_title if we are a linkTo
                    d[self.format_sub_embedding_group_name(o.get('sub_embedding_group')) + '.'
                      + o[self.NAME_FIELD] + '.display_title'] = val  # XXX: when new mapping table comes in check embedded field
                else:
                    d[self.format_sub_embedding_group_name(o.get('sub_embedding_group')) + '.'
                      + o[self.NAME_FIELD]] = val
            else:
                if is_link_to(o):
                    d[o[self.NAME_FIELD] + '.display_title'] = val
                else:
                    d[o[self.NAME_FIELD]] = val

        # go through all annotation objects generating schema properties and
        # adding columns/facets as defined by the mapping table
        for obj in inserts:
            update(props, get_prop(obj))
            if variant:  # we are doing variant, so take columns only from variant context
                if is_variant(obj):
                    if is_facet(obj):
                        insert_column_or_facet(facs, obj)
                    if is_column(obj):
                        insert_column_or_facet(cols, obj, facet=False)
            else:  # we are doing variant_sample, so we should take columns/facets from BOTH
                if is_facet(obj):
                    insert_column_or_facet(facs, obj)
                if is_column(obj):
                    insert_column_or_facet(cols, obj, facet=False)

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
        schema['required'] = ['institution', 'project']  # for display_title
        schema['identifyingProperties'] = ['uuid', 'aliases', 'annotation_id']
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

    @staticmethod
    def add_variant_required_fields(schema):
        schema['required'].extend(['CHROM', 'REF', 'ALT', 'POS'])

    @staticmethod
    def add_variant_sample_required_fields(schema):
        schema['required'].extend(['CALL_INFO', 'variant', 'file'])

    @staticmethod
    def add_identifier_field(props):
        """ Adds the 'annotation_id' field, the unique_key constraint on variant/variant_sample which
            is an alias for the display_title.
        """
        props['annotation_id'] = {
            'title': 'Annotation ID',
            'type': 'string',
            'uniqueKey': True
        }

    @staticmethod
    def add_extra_variant_sample_columns(cols):
        """ Adds href, variant display title to columns (fields not on mapping table) """
        cols['bam_snapshot'] = {
            'title': 'Genome Snapshot',
            'order': 81
        }
        cols['variant.display_title'] = {
            'title': 'Variant'
        }

    def generate_variant_sample_schema(self, sample_props, cols, facs, variant_cols, variant_facs):
        """ Builds the variant_sample.json schema based on sample_props. Will also add variant columns and
            facets since this information is embedded

        Args:
            sample_props: first output of generate_properties

        Returns:
            Variant sample schema
        """
        schema = {}
        self.add_default_schema_fields(schema)
        self.add_variant_sample_required_fields(schema)
        schema['title'] = 'Sample Variant'
        schema['description'] = "Schema for variant info for sample"
        schema['id'] = '/profiles/variant_sample.json'
        schema['properties'] = sample_props
        schema['properties']['schema_version'] = {'default': '1'}
        schema['properties']['variant'] = {  # link to single variant
            'title': 'Variant',
            'type': 'string',
            'linkTo': 'Variant'
        }
        schema['properties']['file'] = {  # NOT a linkTo as the ID is sufficient for filtering
            'title': 'File',
            'description': 'String Accession of the vcf file used in digestion',
            'type': 'string'
        }
        schema['properties']['bam_snapshot'] = {
            'title': 'Genome Snapshot',
            'description': 'Link to Genome Snapshot Image',
            'type': 'string'
        }
        schema['properties']['familial_relation'] = {
            'title': 'Familial Relation',
            'description': 'Relationship of the person who submitted this sample relative to the proband',
            'type': 'string',
            'enum': ['proband', 'father', 'mother', 'brother', 'sister', 'sibling', 'half-brother', 'half-sister',
                     'half-sibling', 'wife', 'husband', 'grandson', 'granddaughter', 'grandchild',
                     'grandmother', 'family-in-law', 'extended-family', 'not linked']
        }

        # adds annotation ID field, effectively making display_title a primary key constraint
        self.add_identifier_field(schema['properties'])

        # helper so variant facets work on variant sample
        # XXX: Behavior needs testing
        def format_variant_cols_or_facs(d):
            cp = {}
            for k, v in d.items():
                cp['variant.' + k] = v
            return cp

        variant_cols = format_variant_cols_or_facs(variant_cols)
        variant_facs = format_variant_cols_or_facs(variant_facs)
        cols.update(variant_cols)  # add variant stuff since we are embedding this info
        facs.update(variant_facs)
        self.add_extra_variant_sample_columns(cols)
        schema['columns'] = cols
        schema['facets'] = facs
        schema['facets'] = self.sort_schema_properties(schema, key='facets')
        schema['columns'] = self.sort_schema_properties(schema, key='columns')
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
        self.add_variant_required_fields(schema)
        schema['title'] = 'Variants'
        schema['description'] = "Schema for variants"
        schema['id'] = '/profiles/variant.json'
        schema['properties'] = var_props
        schema['properties']['schema_version'] = {'default': '1'}
        schema['facets'] = facs
        schema['columns'] = cols
        schema['facets'] = self.sort_schema_properties(schema, key='facets')
        schema['columns'] = self.sort_schema_properties(schema, key='columns')
        # adds annotation ID field, effectively making display_title a primary key constraint
        self.add_identifier_field(schema['properties'])
        logger.info('Build variant schema')
        return schema

    @staticmethod
    def sort_schema_properties(schema, key='properties'):
        """ Helper method that sorts schema properties by key by inserting sorted key, values into a new
            dictionary (since in Python3.6>= all dicts are ordered). Schemas from this point forward
            will have their properties sorted alphabetically so it is easier to visualize changes.

        Args:
            schema: schema with key 'properties' to be sorted
            key: optional arg to use as key to resolve dictionary to sort, intended to allow us to sort
            properties, columns and facets
        """
        sorted_properties = {}
        for key, value in sorted(schema[key].items()):
            sorted_properties[key] = value
        return sorted_properties

    def write_schema(self, schema, fname):
        """ Writes the given schema (JSON) to the given file 'fname'

        Args:
            schema: dictionary to write as json as the schema
            fname: file to write out to
        """
        schema['properties'] = self.sort_schema_properties(schema)
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
        inserts = self.process_annotation_field_inserts()
        variant_sample_props, vs_cols, vs_facs = self.generate_properties(self.filter_fields_by_sample(inserts), variant=False)
        variant_props, v_cols, v_facs = self.generate_properties(self.filter_fields_by_variant(inserts))
        variant_sample_schema = self.generate_variant_sample_schema(variant_sample_props, cols=vs_cols, facs=vs_facs,
                                                                    variant_cols=v_cols, variant_facs=v_facs)
        variant_schema = self.generate_variant_schema(variant_props, cols=v_cols, facs=v_facs)
        if write:
            if not vs_out or not v_out:
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

        Args:
            mp: path to mapping table
            annotation_field_schema: path to annotation field schema
            variant: where to write variant schema
            sample: where to write variant_sample schema
            --project: project to post under
            --institution: institution to post under
            --write-schemas: default True, will write schemas to given output files
            --post-inserts: default False, will post inserts using testapp if specified

            config_uri: path to app config (usually production.ini)
            --app-name: app name, usually 'app'

        From commands dir:
            python variant_table_intake.py ../tests/data/variant_workbook/variant_table.csv ../schemas/annotation_field.json ../schemas/variant.json ../schemas/variant_sample.json ../../../production.ini --app-name app
        From top level on server/local (will post inserts):
            bin/mapping-table-intake src/encoded/tests/data/variant_workbook/variant_table.csv src/encoded/schemas/annotation_field.json src/encoded/schemas/variant.json src/encoded/schemas/variant_sample.json development.ini --app-name app --post-inserts

    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Takes in a mapping table and produces inserts/schemas",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('mp', help='path to mapping table')
    parser.add_argument('annotation_field_schema', help='path to annotation field schema')
    parser.add_argument('variant', help='where to write variant schema')
    parser.add_argument('sample', help='where to write sample_variant schema')
    parser.add_argument('config_uri', help="path to configfile")  # to get app
    parser.add_argument('--app-name', help="Pyramid app name in configfile")  # to get app
    parser.add_argument('--project', help='project to post inserts under')
    parser.add_argument('--institution', help='institution to post inserts under')
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
    if args.post_inserts:  # do imports here as they will fail in certain scenarios
        environ = {
            'HTTP_ACCEPT': 'application/json',
            'REMOTE_USER': 'TEST',
        }
        app = get_app(args.config_uri, args.app_name)
        app_handle = VirtualApp(app, environ)
        for entry in inserts:
            app_handle.post_json('/annotation_field', entry)  # XXX: what if something goes wrong?
        logger.info('Successfully posted annotations')


if __name__ == '__main__':
    main()
