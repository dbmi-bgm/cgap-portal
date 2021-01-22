import vcf
import json
import logging
from collections import OrderedDict
from ..util import resolve_file_path

logger = logging.getLogger(__name__)


class VCFParserException(Exception):
    """
    Specific type of exception we'd like to be able to throw if we find something
    wrong at this stage of Variant Ingestion
    """
    pass


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
    OVERWRITE_FIELDS = {  # field names that do not validate our DB and are mapped
        'csq_hg19_pos(1-based)': 'csq_hg19_pos',
        'csq_gerp++_rs': 'csq_gerp_rs'
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
        """ Strips whitespace and quotation characters and also lowercases the given string s

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
        for encoded, decoded in self.RESTRICTED_CHARACTER_ENCODING.items():
            val = val.replace(encoded, decoded)
        return val

    def cast_field_value(self, type, value, sub_type=None):
        """ Casts the given value to the type given by 'type'

        Args:
            type: type to cast value to
            value: value for the field we processing
            allow_array: boolean on whether or not we should try to parse an array

        Returns:
            casted value

        Raises:
            VCFParserException if there is a type we did not expect
        """
        if type == 'string':
            return self.fix_encoding(value)
        elif type == 'integer':
            try:
                return int(value)
            except ValueError:  # required if casting string->float->int, such as '0.000'
                return int(float(value))  # throw exception here if need be
        elif type == 'number':
            try:
                return float(value)
            except Exception:
                try:
                    return float(value[0])
                except Exception:  # XXX: This shouldn't happen but does in case of malformed entries, see uk10k_esp_maf
                    return 0.0
        elif type == 'boolean':
            if value == '0':
                return False
            return True
        elif type == 'array':
            if sub_type:
                if not isinstance(value, list):
                    items = self.fix_encoding(value).split('&') if sub_type == 'string' else value
                else:
                    items = value
                return list(map(lambda v: self.cast_field_value(sub_type, v, sub_type=None), items))
            else:
                raise VCFParserException('Got array with no sub-type')
        else:
            raise VCFParserException('Type was %s and not one of: string, integer, number, boolean, array' % type)

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
                    type = item_props[field]['type']
                    if type == 'array':
                        sub_type = item_props[field]['items']['type']
                else:
                    return None  # maybe log as well? Special case where key has sub-embedding group but is not in props
            else:
                if exit_on_validation:
                    raise VCFParserException('Tried to check a variant field that does not exist on the schema: %s' % field)
                else:
                    # enable later maybe
                    # logger.error('Tried to check a variant field that does not exist on the schema: %s' % field)
                    return None
        else:
            type = props[field]['type']
            if type == 'array':
                sub_type = props[field]['items']['type']

        # if this field is specifically disabled (due to formatting error), drop it here
        if field in self.DISABLED_FIELDS:
            return None
        return self.cast_field_value(type, value, sub_type)

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
        for field in sample.data._fields:  # must peek at structure to know which fields to pass
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
                        numgt, gt, ad, sample_id = gt.split('|')
                        tmp = dict()
                        tmp['samplegeno_numgt'] = numgt
                        tmp['samplegeno_gt'] = gt
                        tmp['samplegeno_ad'] = ad
                        tmp['samplegeno_sampleid'] = sample_id
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
                                    annotations[field_name] = self.fix_encoding(value).split('~')
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
