import re
import vcf
import json
import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from collections import OrderedDict
from encoded.util import resolve_file_path

logger = logging.getLogger(__name__)
EPILOG = __doc__


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
    VARIANT_SAMPLE_SUBEMBEDDED = ['SAMPLEGENO']
    VCF_FIELDS = ['CHROM', 'POS', 'ID', 'REF', 'ALT']
    VCF_SAMPLE_FIELDS = ['FILTER', 'QUAL']
    DROPPED_FIELD = 'DROPPED'
    SUBEMBEDDED = 'Subembedded'
    FORMAT = 'Format'
    GT_REF = '0/0'
    GT_MISSING = './.'

    def __init__(self, _vcf, variant, sample):
        """ Constructor for the parser

        Args:
            _vcf: path to vcf to process
            variant: path to variant schema to read
            sample: path to variant_sample schema to read

        Raises:
            Parsing error within 'vcf' if given VCF is malformed
        """
        self.reader = vcf.Reader(open(_vcf, 'r'))
        self.variant_schema = json.load(open(variant, 'r'))
        self.variant_sample_schema = json.load(open(sample, 'r'))
        self.regex = re.compile(r"""(\s+$|["]|['])""")  # for stripping
        self.annotation_keys = OrderedDict()  # list of INFO fields that contain annotation fields
        self.format = OrderedDict()  # intermediate representation of the item format
        self.sub_embedded_mapping = OrderedDict()  # denotes which INFO fields belong in a SEO
        self.read_vcf_metadata()
        self.parse_vcf_fields()

    def __iter__(self):
        """ Return generator to VCF rows """
        return self.reader

    def read_vcf_metadata(self):
        """ Parses VCF file meta data to get annotation fields under MUTANNO
        """
        for field in self.reader.metadata['MUTANNO']:
            self.annotation_keys[field['ID']] = True

    def _strip(self, s):
        """ Strips whitespace and quotation characters and also lowercases the given string s

        :param s: String to strip
        :return: processed string
        """
        return re.sub(self.regex, '', s).lower()

    def verify_in_schema(self, field, sub_group=None):
        """ Helper to verify the given field is in the schema.
            Note: This is where non-mvp fields are dropped if present in the vcf
            and not present on either the variant or variant_sample schemas

        :param field: field to check
        :param sub_group: sub_embedding_group this field is a part of, if any, default None
        :return: field or self.DROPPED_FIELD if this is not a schema field
        """
        field_lower = field.lower()
        for schema in [self.variant_sample_schema, self.variant_schema]:
            if sub_group and sub_group in schema['properties']:
                if field in schema['properties'][sub_group]['items']['properties']:
                    return field
            if field in schema['properties'] or field_lower in schema['properties']:
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
            sub_embedding_group on the variant schema

        Raises:
            VCFParserException if the sub_embedding_group on the VCF does not match
            what we got from the mapping table
        """
        if annotation not in self.sub_embedded_mapping:
            return None
        grouping = self.sub_embedded_mapping[annotation]
        if grouping not in self.variant_schema['properties']:
            raise VCFParserException('Sub_embedding_group for %s from the vcf does not match the schema' % annotation)
        return grouping

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
            def fix_encoding(val):  # decode restricted characters
                for encoded, decoded in self.RESTRICTED_CHARACTER_ENCODING.items():
                    val = val.replace(encoded, decoded)
                return val
            return fix_encoding(value)
        elif type == 'integer':
            try:
                return int(value)
            except ValueError:  # required if casting string->float->int, such as '0.000'
                return int(float(value))  # throw exception here if need be
        elif type == 'number':
            try:
                return float(value)
            except Exception:
                return float(value[0])
        elif type == 'boolean':
            if value == '0':
                return False
            return True
        elif type == 'array':
            if sub_type:
                if not isinstance(value, list):
                    items = value.split('~')
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
        return self.cast_field_value(type, value, sub_type)

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
                result[vcf_key] = getattr(record, vcf_key)[0].sequence
            elif vcf_key == 'CHROM':
                result[vcf_key] = getattr(record, vcf_key)[3:]  # XXX: splice chr off for now
            else:
                result[vcf_key] = getattr(record, vcf_key) or ''
        for key in self.format.keys():
            # Skip Sample fields
            if key in self.VARIANT_SAMPLE_SUBEMBEDDED:
                continue

            # handle non-annotation fields
            if key not in self.annotation_keys:
                if record.INFO.get(key, None):
                    val = self.validate_variant_value(key, record.INFO.get(key), exit_on_validation=False)
                    if val is not None:
                        result[key] = val
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

                        # handle sub-embedded
                        if key in self.sub_embedded_mapping:
                            sub_embedded_group = self.sub_embedded_mapping[key]
                            if sub_embedded_group not in result:  # create sub-embedded group if not there
                                result[sub_embedded_group] = {}
                            if g_idx not in result[sub_embedded_group]:
                                result[sub_embedded_group][g_idx] = {}
                            result[sub_embedded_group][g_idx][fn] = self.validate_variant_value(fn, field, key)
                        else:
                            result[fn] = self.validate_variant_value(fn, field, key)
        return result

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
            if key not in self.VARIANT_SAMPLE_SUBEMBEDDED:
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
        props = self.variant_sample_schema['properties']
        for sample in record.samples:
            s = {}
            for field in props.keys():
                if record.INFO.get(field, None):  # first check INFO tag, then check record attributes
                    val = record.INFO.get(field)
                    prop_type = props[field]['type']
                    if prop_type == 'array':
                        sub_type = props[field]['items']['type']
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
                if field == 'samplegeno':  # XXX: should be refactored
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

            self.parse_samples(s, sample)  # add sample fields, already formatted
            s.pop('AF', None)  # XXX: comes from VCF but is not actually what we want. Get rid of it.

            # DROP SV's that are REF/REF
            if s.get('GT', None) in [self.GT_REF, self.GT_MISSING]:
                continue
            result.append(s)
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

    @staticmethod
    def post_variant_consequence_items(virtualapp, project=None, institution=None):
        """ Posts variant_consequence items under the given project/institution. Required for poasting variants.

        :param virtualapp: application_handle to post under
        :param project: project to post under
        :param institution: institution to post under
=        """
        vcs = json.load(open(resolve_file_path('annotations/variant_consequence.json'), 'r'))
        for entry in vcs:
            if project:
                entry['project'] = project
            if institution:
                entry['institution'] = institution
            try:
                virtualapp.post_json('/variant_consequence', entry, status=201)
            except Exception as e:  # can happen with master-inserts collision
                logger.info('Failed to post variant consequence %s' % str(e))


def main():
    """ Main, ingests VCF and posts if args specified.

        NOTE: is currently a no-op if inserts are not being posted

        Args (via argparse):
            vcf: path to vcf file to parse
            variant: path to variant.json schema
            sample: path to variant_sample.json schema
            project: project to post inserts under
            institution: institution to post inserts under
            --post-inserts: If specified, will post inserts, by default False

            config_uri: path to app config, usually 'production.ini'
            --app-name: app name, usually 'app'

        local update:
            python src/encoded/commands/ingest_vcf.py \
                src/encoded/tests/data/variant_workbook/vcf_v0.4.6_subset.vcf \
                src/encoded/schemas/variant.json \
                src/encoded/schemas/variant_sample.json \
                hms-dbmi hms-dbmi development.ini --app-name app --post-inserts

        To load a vcf on the server:
            ingest-vcf src/encoded/tests/data/variant_workbook/test_vcf.vcf \
            src/encoded/schemas/variant.json \
            src/encoded/schemas/variant_sample.json \
            hms-dbmi hms-dbmi production.ini --app-name app --post-inserts
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Ingests a given VCF file",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('vcf', help='path to vcf file')
    parser.add_argument('variant', help='path to variant schema')
    parser.add_argument('sample', help='path to sample variant schema')
    parser.add_argument('project', help='project to post inserts under')
    parser.add_argument('institution', help='institution to post inserts under')
    parser.add_argument('config_uri', help="path to configfile")  # to get app
    parser.add_argument('--app-name', help="Pyramid app name in configfile")  # to get app
    parser.add_argument('--post-inserts', action='store_true', default=False,
                        help='If specified, will post inserts, by default False.')
    parser.add_argument('--post-variant-consequences', action='store_true', default=False,
                        help='If specified will post all VariantConsequence items.')
    args = parser.parse_args()

    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf, args.variant, args.sample)

    # get app, form links then post items
    if args.post_inserts:
        environ = {
            'HTTP_ACCEPT': 'application/json',
            'REMOTE_USER': 'TEST',
        }
        app = get_app(args.config_uri, args.app_name)
        app_handle = VirtualApp(app, environ)
        if args.post_variant_consequences:
            vcf_parser.post_variant_consequence_items(app_handle, project=args.project, institution=args.institution)
        for record in vcf_parser:
            variant = vcf_parser.create_variant_from_record(record)
            variant['project'] = args.project
            variant['institution'] = args.institution
            vcf_parser.format_variant_sub_embedded_objects(variant)
            try:
                res = app_handle.post_json('/variant', variant, status=201).json['@graph'][0]  # only one item posted
            except Exception:
                print('Failed validation')  # some variant gene linkTos do not exist
                continue
            variant_samples = vcf_parser.create_sample_variant_from_record(record)
            for sample in variant_samples:
                sample['project'] = args.project
                sample['institution'] = args.institution
                sample['variant'] = res['@id']  # make link
                app_handle.post_json('/variant_sample', sample, status=201)

        logger.info('Succesfully posted VCF entries')
    exit(0)


if __name__ == '__main__':
    main()
