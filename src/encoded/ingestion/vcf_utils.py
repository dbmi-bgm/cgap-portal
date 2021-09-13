import vcf
import json
import logging
from collections import OrderedDict
# from granite.lib import vcf_parser

logger = logging.getLogger(__name__)


class VCFParserException(Exception):
    """
    Specific type of exception we'd like to be able to throw if we find something
    wrong at this stage of Variant Ingestion
    """
    pass


class GraniteVCFParser(object):
    """ Wrapper class for granite.lib.vcf_parser that implements the same functionality
        as VCFParser but using the granite parser instead of the vcf parser.
    """
    pass  # TODO implement me


class VCFParser(object):
    """
    Wrapper class for 'vcf' that enforces but the VCF specific format rules and
    the annotated VCF format rules specified by us
    """
    RESTRICTED_CHARACTER_ENCODING = {
        '%2C': ',',
        '%20': ' ',
        '%7E': '~',
        '%3D': '=',
        '%7C': '|',
        '%3B': ';'
    }
    VEP = 'VEP'  # annotation field from VEP
    CSQ = 'CSQ'  # INFO field that contains VEP annotations
    GRANITE = 'GRANITE'  # annotation field from GRANITE
    CGAP = 'CGAP'  # annotation fields from CGAP itself
    # field names that do not validate our DB and are mapped
    # XXX: this is also being used for fields that differ in vcf_name
    # and we want to maintain consistency across other fields.
    # TODO: walk schemas to determine these fields dynamically
    OVERWRITE_FIELDS = {
        'csq_gerp++_rs_rankscore': 'csq_gerp_rs_rankscore',
        'csq_gerp++_rs': 'csq_gerp_rs',
        'csq_phastcons100verts': 'csq_phastcons100way_vertebrate',
        'csq_phylop100verts': 'csq_phylop100way_vertebrate',
        'csq_phylop30mams': 'csq_phylop30way_mammalian',
        'csq_gnomade2_ac_oth': 'csq_gnomade2_ac-oth',
        'csq_gnomade2_an_oth': 'csq_gnomade2_an-oth',
        'csq_gnomade2_af_oth': 'csq_gnomade2_af-oth',
        'csq_gnomade2_nhomalt_oth': 'csq_gnomade2_nhomalt-oth',
        'csq_gnomade2_ac_sas': 'csq_gnomade2_ac-sas',
        'csq_gnomade2_an_sas': 'csq_gnomade2_an-sas',
        'csq_gnomade2_af_sas': 'csq_gnomade2_af-sas',
        'csq_gnomade2_nhomalt_sas': 'csq_gnomade2_nhomalt-sas',
        'csq_gnomade2_ac_fin': 'csq_gnomade2_ac-fin',
        'csq_gnomade2_an_fin': 'csq_gnomade2_an-fin',
        'csq_gnomade2_af_fin': 'csq_gnomade2_af-fin',
        'csq_gnomade2_nhomalt_fin': 'csq_gnomade2_nhomalt-fin',
        'csq_gnomade2_ac_eas': 'csq_gnomade2_ac-eas',
        'csq_gnomade2_an_eas': 'csq_gnomade2_an-eas',
        'csq_gnomade2_af_eas': 'csq_gnomade2_af-eas',
        'csq_gnomade2_nhomalt_eas': 'csq_gnomade2_nhomalt-eas',
        'csq_gnomade2_ac_amr': 'csq_gnomade2_ac-amr',
        'csq_gnomade2_an_amr': 'csq_gnomade2_an-amr',
        'csq_gnomade2_af_amr': 'csq_gnomade2_af-amr',
        'csq_gnomade2_nhomalt_amr': 'csq_gnomade2_nhomalt-amr',
        'csq_gnomade2_ac_afr': 'csq_gnomade2_ac-afr',
        'csq_gnomade2_an_afr': 'csq_gnomade2_an-afr',
        'csq_gnomade2_af_afr': 'csq_gnomade2_af-afr',
        'csq_gnomade2_nhomalt_afr': 'csq_gnomade2_nhomalt-afr',
        'csq_gnomade2_ac_asj': 'csq_gnomade2_ac-asj',
        'csq_gnomade2_an_asj': 'csq_gnomade2_an-asj',
        'csq_gnomade2_af_asj': 'csq_gnomade2_af-asj',
        'csq_gnomade2_nhomalt_asj': 'csq_gnomade2_nhomalt-asj',
        'csq_gnomade2_ac_nfe': 'csq_gnomade2_ac-nfe',
        'csq_gnomade2_an_nfe': 'csq_gnomade2_an-nfe',
        'csq_gnomade2_af_nfe': 'csq_gnomade2_af-nfe',
        'csq_gnomade2_nhomalt_nfe': 'csq_gnomade2_nhomalt-nfe',
        'csq_gnomade2_ac_female': 'csq_gnomade2_ac-xx',
        'csq_gnomade2_an_female': 'csq_gnomade2_an-xx',
        'csq_gnomade2_af_female': 'csq_gnomade2_af-xx',
        'csq_gnomade2_nhomalt_female': 'csq_gnomade2_nhomalt-xx',
        'csq_gnomade2_ac_male': 'csq_gnomade2_ac-xy',
        'csq_gnomade2_an_male': 'csq_gnomade2_an-xy',
        'csq_gnomade2_af_male': 'csq_gnomade2_af-xy',
        'csq_gnomade2_nhomalt_male': 'csq_gnomade2_nhomalt-xy',
    }
    DISABLED_FIELDS = ['csq_tsl']  # annotation fields that do not validate
    VCF_FIELDS = ['CHROM', 'POS', 'ID', 'REF', 'ALT']
    VCF_SAMPLE_FIELDS = ['FILTER', 'QUAL']
    DROPPED_FIELD = 'DROPPED'
    SUBEMBEDDED = 'Subembedded'
    FORMAT = 'Format'
    GT_REF = '0/0'
    GT_REF_PHASED = '0|0'
    GT_MISSING = './.'
    BOOLEAN_TRUE = ["1", "YES", True]
    BOOLEAN_FALSE = ["0", "-1", ""]

    def __init__(self, _vcf, variant, sample, reader=None):
        """ Constructor for the parser

        :param _vcf: path to vcf to process
        :param variant: path to variant schema to read
        :param sample: path to variant_sample schema to read
        :param reader: if specified will ignore path passed and set reader directly
        :raises: Parsing error within 'vcf' if given VCF is malformed
        """
        if reader is not None:
            self.reader = reader
        else:
            self.reader = vcf.Reader(open(_vcf, 'r'))
        self._initialize(variant, sample)

    def _initialize(self, variant, sample):
        """ Does initialization other than reading/validating the vcf

            :param variant: path to variant schema
            :param sample: path variant_sample schema
        """
        self.variant_schema = json.load(open(variant, 'r'))
        self.variant_sample_schema = json.load(open(sample, 'r'))
        self.annotation_keys = OrderedDict()  # list of INFO fields that contain annotation fields
        self.format = OrderedDict()  # intermediate representation of the item format
        self.sub_embedded_mapping = OrderedDict()  # denotes which INFO fields belong in a SEO
        self.read_vcf_metadata()
        self.parse_vcf_fields()

    def __iter__(self):
        """ Return generator to VCF rows """
        return self.reader

    @property
    def variant_props(self):
        """ Variant schema properties """
        return self.variant_schema['properties']

    @property
    def variant_sample_props(self):
        """ Variant sample schema properties """
        return self.variant_sample_schema['properties']

    @property
    def variant_sub_embedded_fields(self):
        """ Fields in the variant properties that are nested """
        return [prop for prop in self.variant_props.keys()
                if self.variant_props[prop].get('type', None) == 'array' and
                self.variant_props[prop]['items']['type'] == 'object']

    @property
    def variant_sample_sub_embedded_fields(self):
        """ Fields in the variant sample properties that are nested """
        return [prop for prop in self.variant_sample_props.keys()
                if self.variant_sample_props[prop].get('type', None) == 'array' and
                self.variant_sample_props[prop]['items']['type'] == 'object']

    @property
    def variant_defaults(self):
        """ Acquires all default values for *top-level* fields on variant """
        _defaults = {}
        for name, props in self.variant_props.items():
            if name == 'schema_version':
                continue
            if 'default' in props:
                _defaults[name] = props['default']
        return _defaults

    @property
    def variant_sample_defaults(self):
        """ Acquires all default values for *top-level* fields on variant sample """
        _defaults = {}
        for name, props in self.variant_sample_props.items():
            if name == 'schema_version':
                continue
            if 'default' in props:
                _defaults[name] = props['default']
        return _defaults

    def read_vcf_metadata(self):
        """ Parses VCF file meta data to get annotation fields under VEP/GRANITE """
        granite_header = self.reader.metadata.get(self.GRANITE, [])
        vep_header = self.reader.metadata.get(self.VEP, [])
        cgap_header = self.reader.metadata.get(self.CGAP, [])
        if granite_header:
            for entry in granite_header:
                self.annotation_keys[entry['ID']] = True
        if vep_header:  # only one entry, CSQ
            self.annotation_keys[self.CSQ] = True
        if cgap_header:
            for entry in cgap_header:
                self.annotation_keys[entry['ID']] = True

    @staticmethod
    def _strip(s):
        """ Strips whitespace and quotation characters and lowercases the given string s

        :param s: String to strip
        :return: processed string
        """
        if not isinstance(s, str):
            raise VCFParserException('Tried to apply string strip to non-string %s' % s)
        return s.lower().strip(' "\'')

    def verify_in_schema(self, field, sub_group=None):
        """ Helper to verify the given field is in the schema.
            Note: This is where non-mvp fields are dropped if present in the vcf
            and not present on either the variant or variant_sample schemas

        :param field: field to check
        :param sub_group: sub_embedding_group this field is a part of, if any, default None
        :return: field or self.DROPPED_FIELD if this is not a schema field
        """
        field_lower = field.lower()
        if field_lower in self.OVERWRITE_FIELDS:
            field_lower = self.OVERWRITE_FIELDS[field_lower]  # replace with overwrite
        for schema in [self.variant_sample_schema, self.variant_schema]:
            if sub_group and sub_group in schema['properties']:
                if field_lower in schema['properties'][sub_group]['items']['properties']:
                    return field
            if field_lower in schema['properties']:
                return field
        return self.DROPPED_FIELD  # must maintain field order

    def parse_subembedded_info_header(self, hdr):
        """ Parses an individual (sub-embedded) INFO header

        :param hdr: hdr to process, MUST contain 'Subembedded' (see parse_vcf_info below).
                    Format:
        :return: a list of fields on this sub-embedded object
        """
        sub_embedded = self._strip(hdr.desc.split(':')[1:2][0])  # extracts string that comes after 'Subembedded'
        self.sub_embedded_mapping[hdr.id] = sub_embedded
        entries = hdr.desc.split(':')[3:][0].split('|')  # get everything after 'Format', split on field sep
        entries = map(lambda f: hdr.id.lower() + '_' + self._strip(f), entries)  # ID + stripped field name
        entries = list(map(lambda f: self.verify_in_schema(f, sub_embedded), entries))
        return entries

    def parse_info_header(self, hdr):
        """ Parses an individual INFO header

        :param hdr: hdr to process, must NOT contain 'Subembedded'
        :return: list of fields in this annotation grouping (but not part of a sub-embedded object)
        """
        entries = hdr.desc.split(':')[1:][0].split('|')  # extract 'Format' string
        entries = map(lambda f: hdr.id.lower() + '_' + self._strip(f), entries)  # ID + stripped field name
        entries = list(map(self.verify_in_schema, entries))
        return entries

    def parse_vcf_info_header(self, info):
        """ Helper function for parse_vcf_fields that handles parsing the 'info'
            object containing a header listing the fields
            Only needed for annotations - other fields will work as is
            Lots of VCF specific parsing going on here - refer to VCF spec for
            info on the expected format

        Args:
            info: INFO header entry to process

        Returns:
            list of fields contained in the INFO tag
        """
        if 'Subembedded' in info.desc:  # restricted name in INFO description
            return self.parse_subembedded_info_header(info)
        else:
            return self.parse_info_header(info)

    def parse_vcf_fields(self):
        """ Populates self.format with the annotation format
            Called by the constructor
        """
        for key in self.annotation_keys.keys():
            if key in self.reader.infos.keys():
                self.format[key] = self.parse_vcf_info_header(self.reader.infos[key])
            else:
                logger.info('Found key %s that is not in info tag' % key)
        for key in self.reader.infos.keys():
            if key not in self.format:
                self.format[key] = key

    def read_next_record(self):
        """ Uses self.reader as an iterator to get the next record. This function
            is stateful with respect to the VCF reader. To re-iterate you would
            need to re-instantiate the class. There shouldn't be any reason to
            do this unless you require multiple VCF passes.

            NOTE: this also validates the "next" VCF row against the VCF specification since in
                  "reading" it, it is "parsing" it. It does NOT parse or validate the extended
                  specification.

        Returns:
            next record on VCF
        """
        return next(self.reader)

    def get_sub_embedded_label(self, annotation):
        """ Gets the sub_embedded_group of the given annotation type

        Args:
            annotation: name of annotation to check (VEP)

        Returns:
            2-tuple of the annotation grouping and whether it is a variant label. _, True means the given annotation
            is a variant field. _, False indicates an annotation field on variant_sample. None, _ indicates an
            annotation field that doesn't exist.

        Raises:
            VCFParserException if the sub_embedding_group on the VCF does not match
            what we got from the mapping table
        """
        if annotation not in self.sub_embedded_mapping:
            return None, False
        grouping = self.sub_embedded_mapping[annotation]
        if grouping in self.variant_schema['properties']:
            return grouping, True
        elif grouping in self.variant_sample_schema['properties']:
            return grouping, False
        else:
            raise VCFParserException('Sub_embedding_group for %s from the vcf does not match the schema' % annotation)

    @staticmethod
    def parse_annotation_field_value(s):
        """ Helper - parses a raw annotation field value. Returns a list of the
            field values for this annotation. They should all be pipe separated as per specs

        Args:
            s: string annotation field value (ie: raw value in the VCF)

        Returns:
            List of field values in expected order
        """
        if len(s) > 1:
            res = []
            for entry in s:
                res.append(entry.split('|'))
            return res
        else:
            return [s[0].split('|')]

    def fix_encoding(self, val):
        """ Decodes restricted characters from val, returning the result"""
        # uncomment below to enable: tolerate using '.' in vcf spec for single valued fields
        # if isinstance(val, list) and len(val) == 1 and isinstance(val[0], str):
        #     val = val[0]
        for encoded, decoded in self.RESTRICTED_CHARACTER_ENCODING.items():
            val = val.replace(encoded, decoded)
        return val

    def cast_field_value(self, t, value, sub_type=None):
        """ Casts the given value to the type given by 'type'

        Args:
            t: type to cast value to
            value: value for the field we processing
            sub_type: should be present if we're processing an array, otherwise error

        Returns:
            casted value

        Raises:
            VCFParserException if there is a type we did not expect
        """
        if t == 'string':
            return self.fix_encoding(value)
        elif t == 'integer':
            try:
                return int(value)
            except ValueError:  # required if casting string->float->int, such as '0.000'
                return int(float(value))  # throw exception here if need be
        elif t == 'number':
            try:
                return float(value)
            except Exception:
                try:
                    return float(value[0])
                except Exception:  # XXX: This shouldn't happen but does in case of malformed entries, see uk10k_esp_maf
                    return 0.0
        elif t == 'boolean':
            if value in self.BOOLEAN_FALSE:
                return False
            elif value in self.BOOLEAN_TRUE:
                return True
            else:
                raise VCFParserException(
                    "Received an unexpected value for a boolean: %s." % value
                )
        elif t == 'array':
            if sub_type:
                if not isinstance(value, list):
                    items = self.fix_encoding(value).split('&')
                else:
                    items = value
                return list(map(lambda v: self.cast_field_value(sub_type, v, sub_type=None), items))
            else:
                raise VCFParserException('Got array with no sub-type')
        else:
            raise VCFParserException('Type was %s and not one of: string, integer, number, boolean, array' % t)

    def validate_variant_value(self, field, value, key='', exit_on_validation=False):
        """ Given a field, check the variant schema for the type of that field and cast
        the given value to that type. This constitutes our 'validation' step

        Args:
            field: name of the field we are looking to process. This should exist somewhere
            in the schema properties either at the top level or as a sub-embedded object
            value: value of the field to be cast
            key: annotation field (sub-embedded) that this field is part of
            exit_on_validation: boolean flag to determine whether or not we bail if
            we fail validation in this step. Default to False

        Returns:
            casted value

        Raises:
            VCFParserException if the given field does not exist
        """
        props = self.variant_schema['properties']
        sub_type = None
        sub_embedded_group = self.sub_embedded_mapping.get(key)
        if field not in props:  # check if sub-embedded field
            if sub_embedded_group and sub_embedded_group in props:
                item_props = props[sub_embedded_group]['items']['properties']
                if field in item_props:
                    t = item_props[field]['type']
                    if t == 'array':
                        sub_type = item_props[field]['items']['type']
                else:
                    return None  # maybe log as well? Special case where key has sub-embedding group but is not in props
            else:
                if exit_on_validation:
                    raise VCFParserException('Tried to check a variant field that does not exist on the schema: %s'
                                             % field)
                else:
                    # enable later maybe
                    # logger.error('Tried to check a variant field that does not exist on the schema: %s' % field)
                    return None
        else:
            t = props[field]['type']
            if t == 'array':
                sub_type = props[field]['items']['type']

        # if this field is specifically disabled (due to formatting error), drop it here
        if field in self.DISABLED_FIELDS:
            return None
        return self.cast_field_value(t, value, sub_type)

    @staticmethod
    def get_record_attribute(record, field):
        return getattr(record, field, None)

    @staticmethod
    def remove_prefix(prefix, text):
        if not text.startswith(prefix):
            raise ValueError('Prefix %s is not the initial substring of %s' % (prefix, text))
        return text[len(prefix):]

    def create_variant_from_record(self, record):
        """ Produces a dictionary containing all the annotation fields for this record

        Each MUTANNO tag in the annotated VCF corresponds to an annotation field
        entry. Each one will be parsed as an annotation field, the rest will be
        directly cast based on the interpeted type from the INFO field. A MUTANNO
        tag can also designate a sub-embedded object. Record format is validated
        against the variant schema.

        Args:
            record: a single row in the VCF to parse, grabbed from 'vcf'

        Raises:
            VCFParserException from helpers

        Returns:
            dictionary of parsed VCF entry
        """
        result = {}
        for vcf_key in self.VCF_FIELDS:
            if vcf_key == 'ALT':  # requires special care
                val = getattr(record, vcf_key)[0].sequence
                if val == '*':
                    val = '-'  # replace with '-' as '*' is a path character and ALT is part of the pkey
                result[vcf_key] = val
            elif vcf_key == 'CHROM':
                result[vcf_key] = self.remove_prefix('chr', getattr(record, vcf_key))  # splice chr off
            else:
                attr = self.get_record_attribute(record, vcf_key)
                if attr is not None:
                    result[vcf_key] = attr

        for key in self.format.keys():

            # handle non-annotation fields
            if key not in self.annotation_keys:
                if record.INFO.get(key, None):
                    val = self.validate_variant_value(key, record.INFO.get(key), exit_on_validation=False)
                    if val is not None:
                        result[key] = val
                continue

            # drop if variant_sample sub-embedded field
            sub_embedded_group = self.sub_embedded_mapping.get(key, None)
            if sub_embedded_group in self.variant_sample_sub_embedded_fields:
                continue

            # handle annotation fields
            raw = record.INFO.get(key, None)
            if raw:
                annotations = self.parse_annotation_field_value(raw)
            else:
                continue
            # annotation could be multi-valued split into groups
            for g_idx, group in enumerate(annotations):

                # in nearly all cases there are multiple fields. match them
                # up with format
                for f_idx, field in enumerate(group):
                    if field:
                        fn = self.format[key][f_idx]
                        if fn == self.DROPPED_FIELD:
                            continue

                        # if the field we are processing is an overwrite field, apply the overwrite
                        if fn in self.OVERWRITE_FIELDS:
                            fn = self.OVERWRITE_FIELDS[fn]

                        # handle sub-embedded
                        if key in self.sub_embedded_mapping:
                            if sub_embedded_group not in result:  # create sub-embedded group if not there
                                result[sub_embedded_group] = {}
                            if g_idx not in result[sub_embedded_group]:
                                result[sub_embedded_group][g_idx] = {}

                            # XXX: Special Behavior here in light of VEP annotations
                            # VEP duplicates annotations in the same CSQ INFO field, so while some fields
                            # vary by VEP transcript, a large set of others (that are in our data set)
                            # do not and are duplicated in every transcript entry. Detect when this occurs
                            # and place the field value at top level instead of in the transcript object.
                            possible_value = self.validate_variant_value(fn, field, key)
                            if possible_value is not None:
                                if fn in self.variant_props:
                                    result[fn] = self.validate_variant_value(fn, field, key)
                                else:
                                    result[sub_embedded_group][g_idx][fn] = self.validate_variant_value(fn, field, key)
                        else:
                            possible_value = self.validate_variant_value(fn, field, key)
                            if possible_value is not None:
                                result[fn] = possible_value
        return dict(self.variant_defaults, **result)  # copy defaults, merge in result

    @staticmethod
    def format_variant(result, seo='transcript'):
        """ Does some extra formatting to the seo's on the variant so they fit the schema.
            When we build the item above we index the seo's into a dictionary on
            for processing speed/convenience. This function removes that and puts
            them instead into a list as expected by the schema

        Args:
            result: the item to reformat
            seo: sub-embedded-object to re-format, default='transcript' since that
            is the only seo we currently have on the schema
        """
        acc = []
        if not result.get(seo, None):
            return
        for _, vals in result[seo].items():
            acc.append(vals)
        result[seo] = acc

    def format_variant_sub_embedded_objects(self, result):
        """ Applies 'format_variant' for all sub_embedded_object fields (detected) """
        for key in self.sub_embedded_mapping.values():
            if key in self.variant_props:
                self.format_variant(result, seo=key)

    def parse_samples(self, result, sample):
        """ Parses the samples on the record, adding them to result

        Args:
            result: dict to populate
            sample: sample to parse
        """
        result['CALL_INFO'] = sample.sample
        data = sample.data
        for field in sample.data._fields:  # noQA must peek at structure to know which fields to pass
            if hasattr(data, field) and field in self.variant_sample_schema['properties']:
                field_value = data.__getattribute__(field)
                if isinstance(field_value, list):  # could be a list - in this case, force cast to string
                    field_value = ','.join(map(str, field_value))
                if field_value is not None:
                    result[field] = field_value

    def create_sample_variant_from_record(self, record):
        """ Parses the given record to produce the sample variant

        Args:
            record: a vcf entry to parse

        Raises:
            VCFParserException from helpers

        Returns:
            a (dict) sample_variant item
        """
        result = []
        for sample in record.samples:
            s = {}
            for field in self.variant_sample_props.keys():
                if record.INFO.get(field) is not None:  # first check INFO tag, then check record attributes
                    val = record.INFO.get(field)
                    prop_type = self.variant_sample_props[field]['type']
                    if prop_type == 'array':
                        sub_type = self.variant_sample_props[field]['items']['type']
                        s[field] = self.cast_field_value(prop_type, val, sub_type)
                    else:
                        s[field] = self.cast_field_value(prop_type, val)
                if field in self.VCF_SAMPLE_FIELDS:
                    if field == 'FILTER':  # XXX: default to PASS, should handle on all fields generally
                        if getattr(record, field):
                            s[field] = getattr(record, field)[0]
                        else:
                            s[field] = 'PASS'
                    else:
                        s[field] = getattr(record, field) or ''

                # Special variant sample fields
                if field == 'samplegeno':
                    genotypes = record.INFO.get('SAMPLEGENO')
                    s['samplegeno'] = []
                    for gt in genotypes:
                        numgt, gt, ad, sample_id, ac = gt.split('|')
                        tmp = dict()
                        tmp['samplegeno_numgt'] = numgt
                        tmp['samplegeno_gt'] = gt
                        tmp['samplegeno_ad'] = ad
                        tmp['samplegeno_sampleid'] = sample_id
                        tmp['samplegeno_ac'] = int(ac)  # must be cast to int
                        s['samplegeno'].append(tmp)
                elif field == 'cmphet':
                    comhet = record.INFO.get('comHet', None)
                    if comhet:
                        s['cmphet'] = []
                        field_names = self.format['comHet']
                        for group in comhet:
                            annotations = {}
                            for field_name, value in zip(field_names, group.split('|')):
                                if field_name == 'comhet_transcript':  # array field
                                    annotations[field_name] = self.fix_encoding(value).split('&')
                                else:
                                    annotations[field_name] = self.fix_encoding(value)
                            s['cmphet'].append(annotations)

            self.parse_samples(s, sample)  # add sample fields, already formatted
            s.pop('AF', None)  # XXX: comes from VCF but is not actually what we want. Get rid of it.

            # DROP SV's that are REF/REF
            if s.get('GT', None) in [self.GT_REF, self.GT_MISSING, self.GT_REF_PHASED]:
                continue
            result.append(dict(self.variant_sample_defaults, **s))  # copy in defaults, replace with s
        return result

    def run(self, project=None, institution=None):
        """ Runs end-to-end variant ingestion, processing all records and
            accumulating the variants and sample_variants. Note that in order
            to post the items 'project' and 'institution' are required and
            must exist on the portal for the items to validate on insertion.

            NOTE: does not form links. Use the script directly to form them
            This function thus is really only used in testing

        Args:
            project: project to post these items under
            institution: institution to post these items under

        Returns:
            2-tuple of arrays containing the variant sample/variant items
        """
        variant_samples, variants = [], []
        for record in self:
            vs = self.create_sample_variant_from_record(record)
            v = self.create_variant_from_record(record)
            if project:
                for entry in vs:
                    entry['project'] = project
                v['project'] = project
            if institution:
                for entry in vs:
                    entry['institution'] = institution
                v['institution'] = institution
            variant_samples += vs
            self.format_variant_sub_embedded_objects(v)
            variants.append(v)
        return variant_samples, variants


class StructuralVariantVCFParser(VCFParser):
    """
    Class for parsing SV VCFs with constants/methods that differ
    from parsing SNV VCFs.

    The main differences here are:
        - Variants and variant samples are parsed with the same method,
            rather than the two different approaches for SNVs
        - Record parsing gathers fields that should come from the VCF
            from the schema, similar to SNV variant sample parsing
        - Sub-embedded VCF fields are identified from the schema and
            handled accordingly, eliminating the need for VCF
            reformatters to generate separate headers.

    The class is backwards-compatible, in the sense that it will still
    successfully process annotation fields with sub-embedded info as
    found in SNV VCFs.
    """
    SCHEMA_VCF_FIELD_KEY = "vcf_field"
    SCHEMA_SUB_EMBED_KEY = "sub_embedding_group"
    SAMPLE_ID_VCF_FIELD = "sample"

    @property
    def variant_vcf_props(self):
        """
        Dictionary of VCF fields in variant schema with key, value
        pairs of schema field name and select properties of the field.

        Explicit property to facilitate mocking.
        """
        return self.parse_props_for_vcf_info(self.variant_props)

    @property
    def variant_sample_vcf_props(self):
        """
        Dictionary of VCF fields in variant sample schema with key,
        value pairs of schema field name and select properties of the
        field.

        Explicit property to facilitate mocking.
        """
        return self.parse_props_for_vcf_info(self.variant_sample_props)

    @property
    def variant_sub_embedded_groups(self):
        """
        Extracts all sub-embedded groups present from VCF fields
        from variant schema.

        :return result: list of unique sub-embedded groups
        """
        result = []
        for value in self.variant_vcf_props.values():
            sub_embedded_group = value.get("sub_embedded_group", "")
            if sub_embedded_group and sub_embedded_group not in result:
                result.append(sub_embedded_group)
        return result

    @property
    def variant_sample_sub_embedded_groups(self):
        """
        Extracts all sub-embedded groups present from VCF fields
        from variant sample schema.

        :return result: list of unique sub-embedded groups
        """
        result = []
        for value in self.variant_sample_vcf_props.values():
            sub_embedded_group = value.get("sub_embedded_group", "")
            if sub_embedded_group and sub_embedded_group not in result:
                result.append(sub_embedded_group)
        return result

    def _add_schema_vcf_field(self, key, value, result, array=False):
        """
        Helper function to self.parse_props_for_vcf_info that parses
        a given schema field, checks if it comes from the VCF, and
        updates result with the schema field and some of its properties
        as applicable.

        :param key: str schema field name
        :param value: dict of schema field properties
        :param result: dict of VCF schema fields/properties to update
        :param array: bool if schema field nested in array of objects
        """
        value_type = value.get("type", "")
        vcf_field = value.get(self.SCHEMA_VCF_FIELD_KEY, "")
        sub_embedded_field = value.get(self.SCHEMA_SUB_EMBED_KEY, "")
        field_default = value.get("default", None) 
        if vcf_field:
            result[key] = {"vcf_field": vcf_field, "type": value_type}
            if sub_embedded_field:
                sub_embedded_group = json.loads(sub_embedded_field)["key"]
                result[key]["sub_embedded_group"] = sub_embedded_group
            if array:
                result[key]["sub_type"] = value_type
                result[key]["type"] = "array"
            if field_default is not None:
                result[key]["default"] = field_default

    def parse_props_for_vcf_info(self, schema_props): 
        """
        Searches through schema "properties" fields and extracts those
        that come from the VCF.

        Note: Assumes all VCF fields in schema are at most nested as
        array of objects. If the fields can be arbitrarily nested,
        consider making function recursive.

        :param schema_props: dict of schema "properties" field
        :return result: dict of VCF fields from schema with key,
            value pairs of schema field name and certain properties
            of the field (e.g. "type", "vcf_field", etc.)
        """
        result = {}
        for key, value in schema_props.items():
            value_type = value.get("type", "")
            if value_type not in ["array", "object"]:
                self._add_schema_vcf_field(key, value, result)
            elif value_type == "array":
                item_dict = value["items"]
                if "properties" in item_dict:  # Array of objects
                    for item_key, item_value in item_dict["properties"].items():
                        item_type = item_value.get("type")
                        if item_type not in ["array"]:
                            self._add_schema_vcf_field(item_key, item_value, result)
                        elif item_type == "array":
                            item_sub_dict = item_value["items"]
                            self._add_schema_vcf_field(
                                item_key, item_sub_dict, result, array=True
                            )
                else:
                    self._add_schema_vcf_field(key, item_dict, result, array=True)
        return result

    def parse_subembedded_info_header(self, hdr):
        """
        Parses an individual (sub-embedded) INFO header.
        For SV class, no need to verify fields in schema since only
        fields from schema are searched for in record.

        :param hdr: hdr to process, MUST contain 'Subembedded'
        :return: a list of fields on this sub-embedded object
        """
        sub_embedded = self._strip(hdr.desc.split(':')[1:2][0])
        self.sub_embedded_mapping[hdr.id] = sub_embedded

        # get everything after 'Format', split on field sep
        entries = hdr.desc.split(':')[3:][0].split('|')

        # ID + stripped field name
        entries = list(map(lambda f: hdr.id.lower() + '_' + self._strip(f), entries))
        return entries

    def parse_info_header(self, hdr):
        """
        Parses an individual INFO header.
        For SV class, no need to verify fields in schema since only
        fields from schema are searched for in record.

        :param hdr: hdr to process, must NOT contain 'Subembedded'
        :return: list of fields in this annotation grouping
        """
        entries = hdr.desc.split(':')[1:][0].split('|')  # extract 'Format' string

        # ID + stripped field name
        entries = list(map(lambda f: hdr.id.lower() + '_' + self._strip(f), entries))
        return entries

    def add_result_value(
            self, result, schema_key, schema_props, field_value, index=None
    ):
        """
        Helper function for self.parse_record_for_schema_vcf_fields to
        process value found in record according to its schema properties
        and build variant/variant sample dict accordingly.

        Handles formatting of sub-embedded groups and inserting defaults,
        if present. Calls to self.cast_field_value to format value.

        :param result: dict of variant or variant sample
        :param schema_key: str field in schema
        :param schema_props: dict of schema field properties
        :param field_value: object found in VCF record for the schema field
        :param index: int provided for sub-embedded objects from field
            found in annotations
        """
        vcf_field = schema_props["vcf_field"]
        field_type = schema_props["type"]
        field_sub_type = schema_props.get("sub_type", "")
        sub_embedded_group = schema_props.get("sub_embedded_group", "")
        field_default = schema_props.get("default", None)
        if field_value is None or field_value == "":
            if field_default is not None:  # Re-do but use default
                self.add_result_value(
                    result, schema_key, schema_props, field_default, index=index
                )
        elif sub_embedded_group:
            if sub_embedded_group not in result:
                result[sub_embedded_group] = {}
            if index is not None:
                if index not in result[sub_embedded_group]:
                    result[sub_embedded_group][index] = {}
                result[sub_embedded_group][index][schema_key] = self.cast_field_value(
                    field_type, field_value, sub_type=field_sub_type
                )
            else:
                result[sub_embedded_group][schema_key] = self.cast_field_value(
                    field_type, field_value, sub_type=field_sub_type
                )
        else:
            result[schema_key] = self.cast_field_value(
                field_type, field_value, sub_type=field_sub_type
            )

    def parse_record_for_schema_vcf_fields(
            self, schema_vcf_fields, record, sample=None
    ):
        """
        Process record for all VCF-specific fields from the given schema,
        used to create both variants and variant samples. Once a field is
        found, value extracted and self.add_result_value called to create
        appropriate format according to field type from schema.

        Note: Some SV-specific handling here for ALT key not applicable 
        to SNVs.

        :param schema_vcf_fields: dict of VCF-specific fields from schema
            created by self.parse_props_for_vcf_info
        :param record: class representing one VCF entry
        :param sample: sample object for variant samples
        """
        result = {}
        for schema_key, schema_props in schema_vcf_fields.items():
            vcf_field = schema_props["vcf_field"]
            sub_embedded_group = schema_props.get("sub_embedded_group", "")
            if vcf_field in self.VCF_FIELDS:  # Variant field
                field_value = getattr(record, vcf_field)
                if vcf_field == "CHROM":
                    field_value = self.remove_prefix("chr", field_value)
                elif vcf_field == "ALT":  # Unlikely for SVs, but handled here
                    field_value = field_value[0].type
                self.add_result_value(result, schema_key, schema_props, field_value)
            elif vcf_field in self.VCF_SAMPLE_FIELDS:  # Variant sample field
                if vcf_field == "FILTER":
                    field_value = getattr(record, vcf_field)
                    if not field_value:
                        field_value = "PASS"
                else:
                    field_value = getattr(record, vcf_field)
                self.add_result_value(
                    result, schema_key, schema_props, field_value
                )
            elif (
                sample and vcf_field in (
                    sample.data._fields + tuple([self.SAMPLE_ID_VCF_FIELD])
                )
            ): # Genotype fields
                if sub_embedded_group == "samplegeno":  # Field from all samples
                    for sample_idx, sample_item in enumerate(record.samples):
                        sample_dict = sample_item.data._asdict()
                        if vcf_field in sample_dict:
                            field_value = sample_dict[vcf_field]
                        elif vcf_field == self.SAMPLE_ID_VCF_FIELD:
                            field_value = sample_item.sample
                        self.add_result_value(
                            result,
                            schema_key,
                            schema_props,
                            field_value,
                            index=sample_idx,
                        )
                elif vcf_field == self.SAMPLE_ID_VCF_FIELD:
                    field_value = sample.sample
                    self.add_result_value(
                        result, schema_key, schema_props, field_value
                    )
                else:  # Field only from this sample
                    sample_dict = sample.data._asdict()
                    field_value = sample_dict[vcf_field]
                    if isinstance(field_value, list):
                        field_value = ",".join(map(str, field_value))
                    self.add_result_value(
                        result, schema_key, schema_props, field_value
                    )
            elif vcf_field in record.INFO:  # INFO non-annotation field
                field_value = record.INFO.get(vcf_field)
                self.add_result_value(result, schema_key, schema_props, field_value)
            else:  # INFO annotation fields
                field_not_found = True
                for annotation in self.annotation_keys:
                    if vcf_field in self.format[annotation]:
                        field_not_found = False
                        annotation_items = record.INFO.get(annotation)
                        if not annotation_items:
                            continue
                        annotation_items = self.parse_annotation_field_value(
                            annotation_items
                        )
                        vcf_field_idx = self.format[annotation].index(vcf_field)
                        for idx, annotation_item in enumerate(annotation_items):
                            field_value = annotation_item[vcf_field_idx]
                            self.add_result_value(
                                result,
                                schema_key,
                                schema_props,
                                field_value,
                                index=idx,
                            )
                            if field_value != "" and not sub_embedded_group:
                                # Value will be same or "" for all subsequent
                                # annotation items.
                                break
                        break
                if field_not_found:
                    # vcf_field not found in any areas of the VCF. This shouldn't
                    # happen with an up-to-date mapping table and correctly processed
                    # VCF, but there may be remnant fields that we don't want to
                    # delete. We send out to add_result_value to add the field with
                    # its default, if present.
                    self.add_result_value(result, schema_key, schema_props, None)
        return result
            
    def create_variant_from_record(self, record):
        """
        Process record for variant fields.

        :param record: class representing one VCF entry
        :return result: list of variant sample dicts
        """
        result = self.parse_record_for_schema_vcf_fields(self.variant_vcf_props, record)
        return dict(self.variant_defaults, **result)  # copy defaults, merge in result


    def create_sample_variant_from_record(self, record):
        """
        Process record for variant sample fields, creating variant
        sample items for all samples if sample genotype is appropriate.

        :param record: class representing one VCF entry
        :return result: list of variant sample dicts
        """
        result = []
        for sample in record.samples:
            if sample.data.GT in [self.GT_REF, self.GT_MISSING, self.GT_REF_PHASED]:
                continue
            sample_variant = self.parse_record_for_schema_vcf_fields(
                self.variant_sample_vcf_props, record, sample=sample
            )
            sample_variant = dict(self.variant_sample_defaults, **sample_variant)
            result.append(sample_variant)
        return result

    def format_variant_sub_embedded_objects(self, result, sample=False):
        """
        Reformat sub-embedded dicts of form {0: {...}, 1: {...}, ...} to
        list of dicts of form [{...}, {...}, ...].

        :param result: dict variant/variant sample to reformat
        :param sample: bool if variant sample
        """
        sub_embedded_groups = self.variant_sub_embedded_groups
        if sample:
            sub_embedded_groups = self.variant_sample_sub_embedded_groups
        for key in sub_embedded_groups:
            self.format_variant(result, seo=key)
