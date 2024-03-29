import csv
import six
import io
import json
import logging
from collections.abc import Mapping
from ..util import resolve_file_path

logger = logging.getLogger(__name__)
EPILOG = __doc__


class MappingTableIntakeException(Exception):
    """ Specific type of exception we'd like to throw if we fail in this stage
        due to an error with the table itself
    """
    pass


class GeneTableIntakeException(Exception):
    """ Specific type of exception we'd like to throw if we fail in this stage
        due to an error with the table itself
    """
    pass


class MappingTableHeader:
    """ Constant class that holds information on the structure of the mapping table (csv) that does
        not vary across . """
    HEADER_ROW_INDEX = 2
    INTEGER_FIELDS = ['no', 'maximum_length_of_value', 'default', 'min', 'max']
    BOOLEAN_FIELDS = ['is_list', 'calculated_property', 'embedded_field', 'do_import', 'add_no_value']
    STRING_FIELDS = ['field_name', 'vcf_field', 'source_name', 'source_version', 'sub_embedding_group',
                     'annotation_category', 'separator', 'description',
                     'scope', 'schema_title', 'pattern', 'link', 'abbreviation']
    SPECIAL_FIELDS = ['field_type', 'enum_list', 'links_to']
    ENUM_FIELDS = ['enum_list']
    IGNORED_FIELDS = ['source', 'priority', 'annotation_space_location', 'comments', 'value_example']
    ALL_FIELDS = INTEGER_FIELDS + BOOLEAN_FIELDS + STRING_FIELDS + SPECIAL_FIELDS + ENUM_FIELDS + IGNORED_FIELDS


class VariantTableParser(object):
    """ Class that encapsulates data/functions related to the annotation field mapping table. """
    FIELD_TYPE_INDEX = 10  # XXX: hardcoded, must change if field_type is moved on mapping table
    EMBEDDED_VARIANT_FIELDS = resolve_file_path('schemas/variant_embeds.json')
    EMBEDDED_VARIANT_SAMPLE_FIELDS = resolve_file_path('schemas/variant_sample_embeds.json')  # XXX: unused currently
    EMBEDS_TO_GENERATE = [('variant', EMBEDDED_VARIANT_FIELDS),
                          ('variant_sample', EMBEDDED_VARIANT_SAMPLE_FIELDS)]
    NAME_FIELD = 'field_name'

    def __init__(self, _mp, schema, skip_embeds=False):
        self.mapping_table = _mp
        self.annotation_field_schema = json.load(io.open(schema, 'r'))
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
        fields = {}
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
            with io.open(f, 'w+') as fd:
                json.dump({field: {}}, fd, indent=4)

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
        with io.open(self.mapping_table, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            for row_idx, row in enumerate(reader):
                if row_idx == 0:
                    version = row[1].split('=')[1].strip()
                elif row_idx == 1:
                    date = row[1].split('=')[1].strip()
                elif row_idx == 2:
                    fields = self.process_fields(row)
                else:
                    break  # we are done with this step
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
        with io.open(self.mapping_table, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            for row_idx, row in enumerate(reader):
                insert = {}
                if row_idx <= MappingTableHeader.HEADER_ROW_INDEX:  # skip header rows
                    continue
                for field_name, entry in zip(self.fields, row):
                    if field_name not in self.annotation_field_schema['properties'] or not entry:
                        continue  # IMPORTANT: skip entry not in field schema
                    if field_name in MappingTableHeader.INTEGER_FIELDS:  # handle int fields
                        if entry is not None:  # entry=0 is a normal value
                            insert[field_name] = int(entry)
                    elif field_name in MappingTableHeader.BOOLEAN_FIELDS:  # handle bool fields
                        if entry is not None:
                            if entry == 'Y':
                                insert[field_name] = True
                            else:  # assume False if anything other than 'Y' is present
                                insert[field_name] = False
                    elif field_name in MappingTableHeader.ENUM_FIELDS:  # handle enum fields
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

    def update_embeds(self, item, scope):
        """ Updates the EMBEDDED_FIELDS location JSON containing the embeds for Variant.
            NOTE: the files are overwritten every time you run the process!

        :param item: embedded field to be written
        :param scope: which item type this embed is for
        """
        # XXX: This does NOT work properly if for linkTos, embeds required .keyword!
        for t, f in self.EMBEDS_TO_GENERATE:
            if scope == t:
                with io.open(f, 'rb') as fd:
                    embeds = json.load(fd)
                    link_type = 'embedded_field'
                    prefix = ''
                    if item.get('sub_embedding_group', None):
                        prefix = self.format_sub_embedding_group_name(item.get('sub_embedding_group'), t='key') + '.'
                    if link_type not in embeds[t]:
                        embeds[t][link_type] = [prefix + item[self.NAME_FIELD]]
                    else:
                        embeds[t][link_type].append(prefix + item[self.NAME_FIELD])
                with io.open(f, 'w+') as wfd:
                    json.dump(embeds, wfd, indent=4)
                    wfd.write('\n')  # write newline at EOF

    @staticmethod
    def format_sub_embedding_group_name(json_or_str, t='key'):
        """ Helper method that will extract the appropriate value from sub_embedding_group

        :param json_or_str: entry in mapping table, could be string or json, so we try both
        :param t: one of key or title
        :return: title that you wanted based on inputs
        """
        if t not in ['key', 'title']:
            raise MappingTableIntakeException('Tried to parse sub_embedded_group with'
                                              'key other than "key" or "title": %s ' % t)
        try:
            fmt = json.loads(json_or_str)
        except Exception:  # just a string is given, use for both name and title
            return json_or_str
        else:
            return fmt[t]

    def generate_properties(self, inserts, variant=True):
        """ Generates variant/variant sample properties.

        :param inserts: result of one of the above two functions
        :param variant: whether or not we are generating variant props or sample_variant props
        :return: properties
        """
        # TODO: refactor this process, as it is a little hard to follow - Will 1/21/2021
        props = {}
        cols = {}
        facs = {}

        # inner functions to be used as helper
        def get_prop(item):
            if item.get('embedded_field', False):
                self.update_embeds(item, item.get('scope', 'gene'))  # XXX: HACK - how to get around? -Will
                return {}
            if not item.get('do_import', True):  # DROP fields that explicitly have do_import = False
                return {}

            temp = {}
            prop_name = item[self.NAME_FIELD]
            features = {}
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
            for a_field in MappingTableHeader.BOOLEAN_FIELDS:
                if item.get(a_field) and a_field != 'is_list':
                    features[a_field] = item[a_field]

            # handle string fields
            for a_field in MappingTableHeader.STRING_FIELDS:
                if item.get(a_field) is not None:
                    features[a_field] = item[a_field]

            # handle int fields
            for a_field in MappingTableHeader.INTEGER_FIELDS:
                if item.get(a_field) is not None:
                    features[a_field] = int(item[a_field])

            # handle sub_embedded object
            if item.get('sub_embedding_group'):
                sub_temp = {}
                prop = {}
                sum_ob_name = self.format_sub_embedding_group_name(item['sub_embedding_group'], t='key')
                sub_title = self.format_sub_embedding_group_name(item['sub_embedding_group'], t='title')

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
                        'title': sub_title,
                        'type': 'array',
                        'items': {
                            'title': sub_title,
                            'type': 'object',
                            'properties': prop,
                            }
                        })
                temp[sum_ob_name] = sub_temp
                return temp

            # convert to array structure
            if item.get('is_list'):
                array_item = {}
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

        def is_default_hidden(o):
            return o.get('facet_default_hidden', 'N') == 'Y'

        def insert_column_or_facet(d, o, facet=True):
            val = {'title': o.get('schema_title', o.get(self.NAME_FIELD))}
            if is_default_hidden(o):
                val['default_hidden'] = True
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
                      + o[self.NAME_FIELD] + '.display_title'] = val
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
            'uniqueKey': True,
        }

    @staticmethod
    def add_extra_variant_sample_columns(cols):
        """ Adds href, variant display title to columns (fields not on mapping table) """
        cols['display_title'] = {
            "title": "Position",
            "order": 0,
            "sort_fields" : [
                { "field" : "variant.display_title", "title" : "Variant Display Title" },
                { "field" : "variant.csq_rs_dbsnp151", "title": "dbSNP RS Number" }
            ]
        }
        cols['bam_snapshot'] = {
            "title": 'Genome Snapshot',
            "order": 81
        }
        cols["associated_genotype_labels.proband_genotype_label"] = {
            "title": "Genotype",
            "order": 39,
            "sort_fields": [
                { "field": "associated_genotype_labels.proband_genotype_label", "title": "Proband GT" },
                { "field": "associated_genotype_labels.mother_genotype_label", "title": "Mother GT" },
                { "field": "associated_genotype_labels.father_genotype_label", "title": "Father GT" }
            ]
        }
        # Redundant - display_title column renders this as well.
        # cols['variant.display_title'] = {
        #     'title': 'Variant',
        # }

    @staticmethod
    def extend_variant_sample_columns(cols):

        if "variant.genes.genes_most_severe_gene.display_title" in cols:
            # We combine `genes_most_severe_gene` + `genes_most_severe_transcript` columns in the UI column render func for compactness.
            cols["variant.genes.genes_most_severe_gene.display_title"].update({
                "title": "Gene, Transcript",
                "sort_fields": [
                    { "field": "variant.genes.genes_most_severe_gene.display_title", "title": "Gene" },
                    { "field": "variant.genes.genes_most_severe_transcript", "title": "Most Severe Transcript" }
                ]
            })

        if "DP" in cols:
            # We combine `DP` + `AF` columns in the UI column render func for compactness.
            cols["DP"].update({
                "title": "Coverage, VAF",
                "sort_fields": [
                    { "field": "DP", "title": "Coverage" },
                    { "field": "AF", "title": "VAF" }
                ]
            })

        if "variant.csq_gnomadg_af" in cols:
            # We combine `csq_gnomadg_af` + `csq_gnomadg_af_popmax` columns in the UI column render func for compactness.
            cols["variant.csq_gnomadg_af"].update({
                "title" : "gnomAD",
                "sort_fields": [
                    { "field": "variant.csq_gnomadg_af", "title": "gnomad AF" },
                    { "field": "variant.csq_gnomadg_af_popmax", "title": "gnomad AF Population Max" }
                ]
            })

        if "variant.csq_cadd_phred" in cols:
            cols["variant.csq_cadd_phred"].update({
                "title": "Predictors",
                "sort_fields": [
                    { "field": "variant.csq_cadd_phred", "title": "Cadd Phred Score" },
                    { "field": "variant.spliceaiMaxds", "title": "SpliceAI Max DS"},
                    { "field": "variant.csq_phylop100way_vertebrate", "title": "PhyloP 100 Score"}
                ]
            })

        if "variant.genes.genes_most_severe_hgvsc" in cols:
            cols["variant.genes.genes_most_severe_hgvsc"].update({
                "title": "Variant",
                "sort_fields": [
                    { "field": "variant.genes.genes_most_severe_hgvsc", "title": "Coding Sequence" },
                    { "field": "variant.genes.genes_most_severe_hgvsp", "title": "Protein Sequence" }
                ]
            })

        # Default Hidden Columns:

        if "variant.csq_clinvar" in cols:
            cols["variant.csq_clinvar"].update({
                "default_hidden": True
            })

        if "GT" in cols:
            cols["GT"].update({
                "default_hidden": True
            })

    @staticmethod
    def add_extra_variant_sample_facets(facs):
        """
        Order of a Facet Group within top-level FacetList is determined by `min(grouped facet 1, grouped facet 2, ...)`
        which is then used for sorting relative to all other top-level facets' and facet groups' orders.
        Facets within a group are sorted relative to each other.
        """
        facs["variant.genes.genes_most_severe_gene.display_title"] = {
            "title": "Gene",
            "order": 1,
            "grouping": "Genes",
            "search_type": "sayt_without_terms",    # Enables search-as-you-type via AJAX (SAYT-AJAX) for this facet
            "sayt_item_type": "Gene"                # Required if "search_type" == "sayt_without_terms"
        }
        facs["variant.genes.genes_most_severe_gene.gene_lists.display_title"] = {
            "title": "Gene List",
            "order": 2,
            "grouping": "Genes",
            "description": "Groups of genes that are relevant for a disease or condition"
        }

        facs['inheritance_modes'] = {
            'title': 'Inheritance Modes',
            'order': 15,
        }

        # Range facets using range aggregation_type (ranges will be defined from Q2Q tab in future)
        facs['variant.csq_gnomadg_af'] = {
            "title": "GnomAD Alt Allele Frequency",
            "aggregation_type": "range",
            "number_step": "any",
            "order": 18,
            "grouping": "Population Frequency",
            "ranges": [
                { "from": 0, "to": 0, "label": "unobserved" },
                { "from": 0, "to": 0.001, "label": "ultra-rare" },
                { "from": 0.001, "to": 0.01, "label": "rare" },
                { "from": 0.01, "to": 1, "label": "common" }
            ]
        }
        facs['variant.csq_gnomadg_af_popmax'] = {
            "title": "GnomAD Alt AF - PopMax",
            "aggregation_type": "range",
            "number_step": "any",
            "order": 19,
            "grouping": "Population Frequency",
            "ranges": [
                { "from": 0, "to": 0, "label": "unobserved" },
                { "from": 0, "to": 0.001, "label": "ultra-rare" },
                { "from": 0.001, "to": 0.01, "label": "rare" },
                { "from": 0.01, "to": 1, "label": "common" }
            ]
        }
        facs['variant.csq_phylop100way_vertebrate'] = {
            "title": "PhyloP (100 Vertebrates)",
            "aggregation_type": "range",
            "number_step": "any",
            "order": 22,
            "grouping": "Effect Predictors",
            "ranges": [
                { "from": -20, "to": -3, "label": "strong positive selection" },
                { "from": -3, "to": -2, "label": "positive selection" },
                { "from": -2, "to": 2, "label": "low selection" },
                { "from": 2, "to": 3, "label": "conserved" },
                { "from": 3, "to": 10, "label": "highly conserved"}
            ]
        }
        facs['FS'] = {
            "title": "Strand Fisher Score",
            "aggregation_type": "range",
            "number_step": "any",
            "order": 12,
            "grouping": "Variant Quality",
            "ranges": [
                { "to": 20, "label": "Low Strand Bias (P ≥ 0.01)" },
                { "from": 20, "label": "High Strand Bias (P < 0.01)" }
            ]
        }
        facs['AD_ALT'] = {
            "title": "AD (Alt)",
            "aggregation_type": "range",
            "number_step": 1,
            "order": 10,
            "grouping": "Variant Quality",
            "ranges": [
                { "from": 1, "to": 4, "label": "Very Low" },
                { "from": 5, "to": 9, "label": "Low" },
                { "from": 10, "to": 19, "label": "Medium" },
                { "from": 20, "label": "High" }
            ]
        }
        facs['novoPP'] = {
            "title": "novoCaller PP",
            "aggregation_type": "range",
            "number_step": "any",
            "order": 16,
            "grouping": "Genotype",
            "ranges": [
                { "from": 0.1, "to": 0.9, "label": "de novo candidate (weak)" },
                { "from": 0.9, "to": 1, "label": "de novo candidate (strong)" }
            ]
        }

        # Genotype labels (calculated properties)
        facs.update({
            "associated_genotype_labels.proband_genotype_label": {
                "title": "Proband Genotype",
                "order": 12,
                "grouping": "Genotype"
            },
            "associated_genotype_labels.mother_genotype_label": {
                "title": "Mother Genotype",
                "order": 13,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.father_genotype_label": {
                "title": "Father Genotype",
                "order": 14,
                "grouping": "Genotype",
                "default_hidden": True
            },

            # Below facets are default-hidden unless e.g. additional_facet=associated_genotype_labels.co_parent_genotype_label
            # URL param is supplied in filter block flags or search href.

            "associated_genotype_labels.co_parent_genotype_label": {
                "title": "Co-Parent Genotype",
                "order": 1000,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.sister_genotype_label": {
                "title": "Sister Genotype",
                "order": 1001,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.sister_II_genotype_label": {
                "title": "Sister II Genotype",
                "order": 1002,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.sister_III_genotype_label": {
                "title": "Sister III Genotype",
                "order": 1003,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.sister_IV_genotype_label": {
                "title": "Sister IV Genotype",
                "order": 1004,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.brother_genotype_label": {
                "title": "Brother Genotype",
                "order": 1005,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.brother_II_genotype_label": {
                "title": "Brother II Genotype",
                "order": 1006,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.brother_III_genotype_label": {
                "title": "Brother III Genotype",
                "order": 1007,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.brother_IV_genotype_label": {
                "title": "Brother IV Genotype",
                "order": 1008,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.daughter_genotype_label": {
                "title": "Daughter Genotype",
                "order": 1009,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.daughter_II_genotype_label": {
                "title": "Daughter II Genotype",
                "order": 1010,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.daughter_III_genotype_label": {
                "title": "Daughter III Genotype",
                "order": 1011,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.daughter_IV_genotype_label": {
                "title": "Daughter IV Genotype",
                "order": 1012,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.son_genotype_label": {
                "title": "Son Genotype",
                "order": 1013,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.son_II_genotype_label": {
                "title": "Son II Genotype",
                "order": 1014,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.son_III_genotype_label": {
                "title": "Son III Genotype",
                "order": 1015,
                "grouping": "Genotype",
                "default_hidden": True
            },
            "associated_genotype_labels.son_IV_genotype_label": {
                "title": "Son IV Genotype",
                "order": 1016,
                "grouping": "Genotype",
                "default_hidden": True
            }
        })

    @staticmethod
    def extend_variant_sample_facets(facs):
        pass

    def generate_variant_sample_schema(self, sample_props, cols, facs, variant_cols, variant_facs):
        """ Builds the variant_sample.json schema based on sample_props. Will also add variant columns and
            facets since this information is embedded.

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
        schema['mixinProperties'] = [
            {"$ref": "mixins.json#/schema_version"},
            {"$ref": "mixins.json#/uuid"},
            {"$ref": "mixins.json#/aliases"},
            {"$ref": "mixins.json#/submitted"},
            {"$ref": "mixins.json#/modified"},
            {"$ref": "mixins.json#/status"},
            {"$ref": "mixins.json#/attribution"},
            {"$ref": "mixins.json#/notes"},
            {"$ref": "mixins.json#/static_embeds"},
        ]
        schema['properties'] = sample_props
        schema['properties']['schema_version'] = {'default': '1'}
        schema['properties']['variant'] = {  # link to single variant
            'title': 'Variant',
            'type': 'string',
            'linkTo': 'Variant',
        }
        schema['properties']['gene_notes'] = {
            'title': 'Gene Notes',
            'description': 'Note item related to this Gene',
            'type': 'string',
            'linkTo': 'NoteStandard'
        }
        schema['properties']['variant_notes'] = {
            'title': 'Variant Notes',
            'description': 'Notes related to the relevant Variant',
            'type': 'string',
            'linkTo': 'NoteStandard'
        }
        schema['properties']['interpretation'] = {
            'title': 'Clinical Interpretation',
            'description': 'Clinical Interpretation Note connected to this item',
            'type': 'string',
            'linkTo': 'NoteInterpretation'
        }
        schema['properties']['discovery_interpretation'] = {
            'title': 'Discovery Interpretation',
            'description': 'Gene/Variant Discovery interpretation note connected to this item',
            'type': 'string',
            'linkTo': 'NoteDiscovery'
        }
        schema['properties']['file'] = {  # NOT a linkTo as the ID is sufficient for filtering
            'title': 'File',
            'description': 'String Accession of the vcf file used in digestion',
            'type': 'string',
        }
        schema['properties']['bam_snapshot'] = {
            'title': 'Genome Snapshot',
            'description': 'Link to Genome Snapshot Image',
            'type': 'string',
        }
        schema['properties']['finding_table_tag'] = {
            "title": "Finding Table Classification Tag",
            "description": "The 'finding' category or classification of this VariantSample.",
            "notes": "Need to implement some validation for this field, so that it is always set to one of the options defined in VS project report settings.",
            "type": "string"
        }
        schema['properties']['genotype_labels'] = {
            'title': 'Genotype Labels',
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'role': {
                        'title': 'Role',
                        'type': 'string',
                    },
                    'labels': {
                        'title': 'Genotype Labels',
                        'type': 'array',
                        'items': {
                            'type': 'string'
                        }
                    }
                }
            }
        }
        schema['properties']['inheritance_modes'] = {
            'title': 'Inheritance Modes',
            'type': 'array',
            'items': {
                'type': 'string'
            }
        }
        schema['properties']['samplegeno']['items']['properties']['samplegeno_role'] = {  # noqa structure is there
            'title': 'Familial Relation',
            'description': 'Relationship of the person who submitted this sample relative to the proband',
            'type': 'string',
            'suggested_enum': ['proband', 'father', 'mother', 'brother', 'sister', 'sibling',
                     'half-brother', 'half-sister', 'half-sibling', 'wife', 'husband',
                     'son', 'daughter', 'child', 'grandson', 'granddaughter', 'grandchild',
                     'grandmother', 'family-in-law', 'extended-family', 'not linked'],
        }
        schema['properties']['samplegeno']['items']['properties']['samplegeno_sex'] = {  # noqa structure is there
            'title': 'Sex',
            'description': 'Sex of the donor of this sample ID',
            'type': 'string',
            'enum': ['M', 'F', 'U'],  # XXX: what others should be included?
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
        self.extend_variant_sample_columns(cols)
        self.add_extra_variant_sample_facets(facs)
        self.extend_variant_sample_facets(facs)
        schema['columns'] = cols
        schema['facets'] = facs
        schema['facets'] = self.sort_schema_properties(schema, key='facets')
        schema['columns'] = self.sort_schema_properties(schema, key='columns')
        logger.info('Built variant_sample schema')
        return schema

    def generate_variant_schema(self, var_props, cols, facs):
        """  Builds the variant.json schema based on var_props

        Args:
            var_props: first output of generate_properties for variant
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
        schema['mixinProperties'] = [
            {"$ref": "mixins.json#/schema_version"},
            {"$ref": "mixins.json#/uuid"},
            {"$ref": "mixins.json#/aliases"},
            {"$ref": "mixins.json#/submitted"},
            {"$ref": "mixins.json#/modified"},
            {"$ref": "mixins.json#/status"},
            {"$ref": "mixins.json#/attribution"},
            {"$ref": "mixins.json#/notes"},
            {"$ref": "mixins.json#/interpretation"},
            {"$ref": "mixins.json#/static_embeds"},
        ]
        schema['properties'] = var_props
        schema['properties']['hg19'] = {  # required for testing :( - will 1-8-2021
            "title": "hg19 Coordinates",
            "type": "array",
            "comment": "This property is deprecated but retained for testing",
            "items": {
                "title": "hg19 Coordinates",
                "enable_nested": True,
                "type": "object",
                "properties": {
                    "hg19_hgvsg": {
                        "title": "Variant",
                        "field_name": "hg19_hgvsg",
                        "type": "string",
                        "description": "HGVS genome sequence name (hg19)",
                    },
                    "hg19_chrom": {
                        "title": "Chromosome (hg19)",
                        "field_name": "hg19_chrom",
                        "type": "string",
                        "description": "hg19 coordinate chromosome",
                    },
                    "hg19_pos": {
                        "title": "Position (hg19)",
                        "field_name": "hg19_pos",
                        "type": "integer",
                        "description": "hg19 coordinate position",
                    }
                }
            }
        }
        schema['properties']['variant_notes'] = {
            "title": "Variant Notes",
            "description": "Notes related to this Variant",
            "type": "array",
            "items": {
                "title": "Variant Note",
                "type": "string",
                "linkTo": "NoteStandard"
            }
        }
        schema['properties']['schema_version'] = {'default': '2'}
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
        with io.open(fname, 'w+') as out:
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
        variant_sample_props, _, _ = self.generate_properties(self.filter_fields_by_sample(inserts), variant=False)
        variant_props, _, _ = self.generate_properties(self.filter_fields_by_variant(inserts))
        # as of 3/9/2021, this is now just the 'properties' of the schema
        # columns/facets are edited directly - they are read in here from the
        # output location (read in schema/overwrite when done, don't touch columns/facets)
        new_variant_sample_schema = self.generate_variant_sample_schema(variant_sample_props,
                                                                        cols={}, facs={}, variant_cols={},
                                                                        variant_facs={})
        new_variant_schema = self.generate_variant_schema(variant_props, cols={}, facs={})
        if write:
            if not vs_out or not v_out:
                raise MappingTableIntakeException('Write specified but no output file given')

            # Read/replace columns/facets and update properties
            # NOTE: This will not function correctly if you wipe the schemas!
            # Although this isn't ideal, I'm not convinced it's a good use of time to do
            # the refactoring necessary to pull the column/facet logic out. It's much easier
            # to just ignore that info.
            variant_sample_schema = json.load(io.open(vs_out))
            new_variant_sample_schema['facets'] = variant_sample_schema['facets']
            new_variant_sample_schema['columns'] = variant_sample_schema['columns']
            self.write_schema(new_variant_sample_schema, vs_out)

            variant_schema = json.load(io.open(v_out))
            new_variant_schema['facets'] = variant_schema['facets']
            new_variant_schema['columns'] = variant_schema['columns']
            self.write_schema(new_variant_schema, v_out)
            logger.info('Successfully wrote schemas')
        if project or institution:
            for insert in inserts:
                if project:
                    insert['project'] = project
                if institution:
                    insert['institution'] = institution
        return inserts


class StructuralVariantTableParser(VariantTableParser):
    """
    Subclass of VariantTableParser used for intake of SV mapping table.

    Main differences from the parent class are:
        - Explicitly updates methods only related to "properties" field
            of the relevant schema; all other fields in schema will
            be same as in existing schema.
        - Searches schema "properties" objects and embedded objects for
            field indicative of the property coming from the mapping
            table as implied by presence of VCF_FIELD_KEY
        - All "properties" objects that do not come from the mapping
            table are included in the new schema, while those from
            previous mapping table ingestion are dropped and will
            only be re-generated if present in current mapping table.
    """
    SV_SCHEMA_PATH = resolve_file_path("schemas/structural_variant.json")
    SV_SAMPLE_SCHEMA_PATH = resolve_file_path("schemas/structural_variant_sample.json")
    EMBEDDED_VARIANT_FIELDS = resolve_file_path("schemas/structural_variant_embeds.json")
    EMBEDDED_VARIANT_SAMPLE_FIELDS = resolve_file_path(
        "schemas/structural_variant_sample_embeds.json"
    )
    EMBEDS_TO_GENERATE = [
        ("variant", EMBEDDED_VARIANT_FIELDS),
        ("variant_sample", EMBEDDED_VARIANT_SAMPLE_FIELDS),
    ]
    VCF_FIELD_KEY = "vcf_field"

    def __init__(self, *args, **kwargs):
        super(StructuralVariantTableParser, self).__init__(*args, **kwargs)
        self.sv_non_vcf_props = {}
        self.sv_sample_non_vcf_props = {}
        self.get_vcf_props()

    @property
    def old_sv_schema(self):
        """Explicit property for easier mocking."""
        return json.load(io.open(self.SV_SCHEMA_PATH))

    @property
    def old_sv_sample_schema(self):
        """Explicit property for easier mocking."""
        return json.load(io.open(self.SV_SAMPLE_SCHEMA_PATH))


    def get_vcf_props(self):
        """
        Searches through existing SV and SV sample schemas to identify
        existing "properties" objects that did not come from previous
        mapping table ingestion, as indicated by lack of VCF_FIELD_KEY
        on the object. 

        Updates self.sv_non_vcf_props and self.sv_sample_non_vcf_props
        dicts with keys as top-level "properties" fields to keep and
        values as list of sub-embedded fields to keep if applicable.

        Expects sub-embedded objects from previous mapping table
        ingestion to be one-layer deep, e.g. an array of objects that
        are not themselves arrays of objects. 

        NOTE: This will obviously fail if the VCF_FIELD_KEY is dropped
        from the mapping table.
        """
        for key, value in self.old_sv_schema["properties"].items():
            vcf_field = self._is_vcf_field(key, value)
            if not vcf_field:
                self.sv_non_vcf_props[key] = ""
            else:
                sub_embeds_to_keep = self._collect_non_vcf_sub_embeds(key, value)
                if sub_embeds_to_keep:
                    self.sv_non_vcf_props[key] = sub_embeds_to_keep
        for key, value in self.old_sv_sample_schema["properties"].items():
            vcf_field = self._is_vcf_field(key, value)
            if not vcf_field:
                self.sv_sample_non_vcf_props[key] = ""
            else:
                sub_embeds_to_keep = self._collect_non_vcf_sub_embeds(key, value)
                if sub_embeds_to_keep:
                    self.sv_sample_non_vcf_props[key] = sub_embeds_to_keep
               
    def _is_vcf_field(self, key, value):
        """
        Helper function to self.get_vcf_props() to identify 
        "properties" fields that stem from previous mapping table
        ingestion as indicated by VCF_FIELD_KEY.

        :param key: str field name
        :param value: dict corresponding to key
        :return result: bool if key corresponds to a vcf field
        """
        result = False
        item_type = value.get("type", "")
        vcf_field = value.get(self.VCF_FIELD_KEY, "")
        if not vcf_field:
            if item_type == "array":
                item_dict = value["items"]
                if "properties" in item_dict:  # Array of objects
                    for item_key, item_value in item_dict["properties"].items():
                        result = self._is_vcf_field(item_key, item_value)
                        if result:
                            break
                else:
                    result = self._is_vcf_field(key, item_dict)
        else:
            result = True
        return result

    def _collect_non_vcf_sub_embeds(self, key, value):
        """
        Helper function to self.get_vcf_props that collects non-vcf
        fields nested within an object that contains at least one vcf field.

        :param key: str field name
        :param value: dict corresponding to key
        :return result: list of nested non-vcf fields
        """
        result = []
        item_type = value.get("type", "")
        vcf_field = value.get(self.VCF_FIELD_KEY, "")
        if not vcf_field:
            if item_type == "array":
                item_dict = value["items"]
                if "properties" in item_dict:  # Array of objects
                    for item_key, item_value in item_dict["properties"].items():
                        sub_item_type = item_value.get("type", "")
                        sub_item_vcf_field = item_value.get(self.VCF_FIELD_KEY, "")
                        if sub_item_type == "array":
                            sub_item_vcf_field = (
                                item_value["items"].get(self.VCF_FIELD_KEY, "")
                            )
                        if not sub_item_vcf_field:
                            result.append(item_key)
        return result

    def provision_embeds(self):
        """ 
        Does setup necessary for writing embeds to JSON files in the
        schemas directory.

        Called by initializer based on EMBEDS_TO_GENERATE.
        """
        for field, f in self.EMBEDS_TO_GENERATE:
            field = "structural_" + field
            with open(f, 'w+') as fd:
                json.dump({field: {}}, fd, indent=4)

    def update_embeds(self, item, scope):
        """ 
        Updates the EMBEDDED_FIELDS location JSON containing the embeds
        for structural variant.
        NOTE: the files are overwritten every time you run the process!

        :param item: embedded field to be written
        :param scope: which item type this embed is for
        """
        # XXX: This does NOT work properly if for linkTos, embeds required .keyword!
        for t, f in self.EMBEDS_TO_GENERATE:
            if scope == t:
                t = "structural_" + t
                with open(f, 'rb') as fd:
                    embeds = json.load(fd)
                    link_type = 'embedded_field'
                    prefix = ''
                    if item.get('sub_embedding_group', None):
                        prefix = self.format_sub_embedding_group_name(
                            item.get('sub_embedding_group'), t='key'
                        ) + '.'
                    if link_type not in embeds[t]:
                        embeds[t][link_type] = [prefix + item[self.NAME_FIELD]]
                    else:
                        embeds[t][link_type].append(prefix + item[self.NAME_FIELD])
                with open(f, 'w+') as wfd:
                    json.dump(embeds, wfd, indent=4)
                    wfd.write('\n')  # write newline at EOF


    @staticmethod
    def generate_schema(var_props, old_schema, props_to_keep):
        """
        Generate new schema by updating the properties of the old schema
        according to the new mapping table, leaving the remainder of the
        schema the same. 

        :param var_props: dict of new props from mapping table ingested
        :param old_schema: dict of existing schema
        :param props_to_keep: dict of non-vcf fields and sub-embedded
            non-vcf fields to keep, if applicable
        :return schema: dict of updated schema with "properties" field
            containing all new props and existing non-vcf fields
        """
        schema = {}
        old_schema_props = old_schema["properties"]
        for field in props_to_keep:
            sub_embeds_to_keep = props_to_keep[field]
            if not sub_embeds_to_keep:
                var_props[field] = old_schema_props[field]
            else:
                if field in var_props:
                    try:
                        var_prop_sub_embeds = var_props[field]["items"]["properties"]
                        old_schema_prop_sub_embeds = (
                            old_schema_props[field]["items"]["properties"]
                        )
                        for sub_embed in sub_embeds_to_keep:
                            var_prop_sub_embeds[sub_embed] = (
                                old_schema_prop_sub_embeds[sub_embed]
                            )
                    except KeyError:
                        # Field went from array of objects to other type, so don't
                        # attempt to sub-embed previous non-vcf fields
                        continue
                else:
                    var_props[field] = old_schema_props[field]
                    tmp = [
                        key for key in old_schema_props[field]["items"]["properties"]
                    ]
                    for sub_embed in tmp:
                        if sub_embed not in sub_embeds_to_keep:
                            del var_props[field]["items"]["properties"][sub_embed]
        for key in old_schema:
            if key == "properties":
                schema["properties"] = var_props
            else:
                schema[key] = old_schema[key]
        return schema

    def run(self, project=None, institution=None, write=True):
        """
        Runs mapping table intake for SVs, writing new 'properties' fields
        for structural variants and structural variant samples.

        :param project: str project identifier
        :param institution: str institution identifier
        :param write: bool to write new schema
        :return inserts: list of dicts corresponding to props of ingested
            mapping table
        """
        inserts = self.process_annotation_field_inserts()
        sv_props, _, _ = self.generate_properties(
            self.filter_fields_by_variant(inserts)
        )
        sv_sample_props, _, _ = self.generate_properties(
            self.filter_fields_by_sample(inserts), variant=False
        )
        new_sv_schema = self.generate_schema(
            sv_props, self.old_sv_schema, self.sv_non_vcf_props
        )
        new_sv_sample_schema = self.generate_schema(
            sv_sample_props, self.old_sv_sample_schema, self.sv_sample_non_vcf_props
        )
        if write:
            self.write_schema(new_sv_schema, self.SV_SCHEMA_PATH)
            self.write_schema(new_sv_sample_schema, self.SV_SAMPLE_SCHEMA_PATH)
            logger.info("Successfully wrote schemas")
        if project or institution:
            for insert in inserts:
                if project:
                    insert['project'] = project
                if institution:
                    insert['institution'] = institution
        return inserts


class GeneTableParser(VariantTableParser):
    """ Subclass of MappingTableParser that overrides methods required for any differences across tables. """

    def __init__(self, *args, **kwargs):
        self.FIELD_TYPE_INDEX = 8
        kwargs['skip_embeds'] = True  # do not clear embeds when running gene intake
        super(GeneTableParser, self).__init__(*args, **kwargs)

    @staticmethod
    def add_default_schema_fields(schema):
        """ Adds default schema fields

        Args:
            schema: schema to add fields to
        """
        schema['$schema'] = 'http://json-schema.org/draft-04/schema#'
        schema['type'] = 'object'
        schema['required'] = ['institution', 'project', 'gene_symbol', 'ensgid']
        schema['identifyingProperties'] = ['uuid', 'aliases']
        schema['additionalProperties'] = False
        schema['mixinProperties'] = [
            {"$ref": "mixins.json#/schema_version"},
            {"$ref": "mixins.json#/uuid"},
            {"$ref": "mixins.json#/aliases"},
            {"$ref": "mixins.json#/submitted"},
            {"$ref": "mixins.json#/modified"},
            {"$ref": "mixins.json#/status"},
            {"$ref": "mixins.json#/attribution"},
            {"$ref": "mixins.json#/notes"},
            {"$ref": "mixins.json#/static_embeds"},
            {"$ref": "mixins.json#/interpretation"}
        ]

    def generate_gene_schema(self, gene_props, columns, facets):
        """
        Builds gene.json schema based on gene_props

        :param gene_props: dictionary of 'properties' based on the gene fields
        :param columns: columns to attach
        :param facets: facets to compute
        :return: gene schema
        """
        schema = {}
        self.add_default_schema_fields(schema)
        schema['title'] = 'Genes'
        schema['description'] = "Schema for Genes"
        schema['id'] = '/profiles/gene.json'
        gene_props['ensgid']['uniqueKey'] = True  # XXX: This is required for genes
        schema['properties'] = gene_props
        schema['properties']['schema_version'] = {'default': '1'}
        schema['properties']['gene_notes'] = {
            "title": "Gene Notes",
            "description": "Notes related to this Gene",
            "type": "array",
            "items": {
                "title": "Gene Note",
                "type": "string",
                "linkTo": "NoteStandard"
            }
        }
        schema['facets'] = facets
        schema['columns'] = columns
        logger.info('Build gene schema')
        return schema

    def run(self, gs_out=None, write=False):  # noqa - args are different then in superclass but we don't care
        """
        Ingests the gene table, producing the gene schema

        :param gs_out: path where to write the gene schema
        :param write: whether or not to actually write the schema (can do dry-run)
        :return: gene_annotation_field inserts
        """
        inserts = self.process_annotation_field_inserts()
        gene_props, columns, facets = self.generate_properties(inserts)
        gene_schema = self.generate_gene_schema(gene_props, columns, facets)
        if write:
            if not gs_out:
                raise GeneTableIntakeException('Write specified but no output file given')
            self.write_schema(gene_schema, gs_out)
            logger.info('Successfully wrote gene schema to %s' % gs_out)
        return inserts
