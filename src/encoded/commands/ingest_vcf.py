import sys
import vcf
import json
import argparse
import logging
from collections import OrderedDict

logger = logging.getLogger(__name__)
EPILOG = __doc__
ENCODING = {
    '%2C': ',',
    '%20': ' ',
    '%7E': '~',
    '%3D': '=',
    '%7C': '|',
    '%3B': ';'
}


class VCFParserException(Exception):
    """
    Specific type of exception we'd like to be able to throw if we find something
    wrong at this stage of VCF Ingestion
    """
    pass


class VCFParser(object):
    """
    Wrapper class for 'vcf' that enforces but the VCF specific format rules and
    the annotated VCF format rules specified by us
    """

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
        self.annotation_keys = OrderedDict()
        self.field_keys = OrderedDict()
        self.format = OrderedDict()
        self.sub_embedded_mapping = OrderedDict()
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
        for field in self.reader.infos.keys():
            if field not in self.annotation_keys:
                self.field_keys[field] = True

    def parse_vcf_info(self, info):
        """ Helper function for parse_vcf_fields that handles parsing the 'info'
            object containing a header listing the fields
            Only needed for annotations - other fields will work as is

        Args:
            info: INFO header entry to process

        Returns:
            list of fields contained in the INFO tag
        """
        def _strip(s):
            s = s.strip()
            s = s.strip('"')
            s = s.strip("'")
            return s.lower()

        def _verify_in_schema(field, sub_group=None):
            if sub_group:
                if field in self.variant_schema['properties'][sub_group]['items']['properties']:
                    return field
            if field in self.variant_schema['properties'] or field.lower() in self.variant_schema['properties']:
                return field
            return 'DROPPED'

        if 'Subembedded' in info.desc:  # restricted name in INFO description
            sub_embedded = _strip(info.desc.split(':')[1:2][0])
            self.sub_embedded_mapping[info.id] = sub_embedded
            entries = info.desc.split(':')[3:][0].split('|')
            entries = list(map(lambda f: info.id.lower() + '_' + _strip(f), entries))
            entries = list(map(lambda f: _verify_in_schema(f, sub_embedded), entries))
        else:
            entries = info.desc.split(':')[1:][0].split('|')
            entries = list(map(lambda f: info.id.lower() + '_' + _strip(f), entries))
            entries = list(map(_verify_in_schema, entries))
        return entries

    def parse_vcf_fields(self):
        """ Populates self.format with the annotation format
            Called by the constructor
        """
        for key in self.annotation_keys.keys():
            if key in self.reader.infos.keys():
                self.format[key] = self.parse_vcf_info(self.reader.infos[key])
        for key in self.field_keys.keys():
            if key in self.reader.infos.keys():
                self.format[key] = self.reader.infos[key].type

    def get_record(self):
        """ Uses self.reader as an iterator to get the next record

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
    def parse_annotation_field(s):
        """ Helper - parses an annotation field. Returns a list of the field values for this
            annotation. They should all be pipe separated as per specs

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

    def process_field_value(self, type, value, sub_type=None):
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
                for encoded, decoded in ENCODING.items():
                    val = val.replace(encoded, decoded)
                return val
            return fix_encoding(value)
        elif type == 'integer':
            try:
                return int(value)
            except ValueError:  # required if casting string->float->int, such as '0.000'
                return int(float(value))  # throw exception here if need be
        elif type == 'number':
            return float(value)
        elif type == 'array':
            if sub_type:
                if not isinstance(value, list):
                    items = value.split('~')
                else:
                    items = value
                return list(map(lambda v: self.process_field_value(sub_type, v, sub_type=None), items))
            else:
                raise VCFParserException('Got array with no sub-type')
        else:
            raise VCFParserException('type was not one of: string, integer, number, array')

    def process_variant_value(self, field, value, key='', fail=True):
        """ Given a field, check the variant schema for the type of that field and cast
        the given value to that type

        Args:
            field: name of the field we are looking to process. This should exist somewhere
            in the schema properties either at the top level or as a sub-embedded object
            value: value of the field to be cast
            key: annotation field (sub-embedded) that this field is part of

        Returns:
            casted value

        Raises:
            VCFParserException if the given field does not exist
        """
        props = self.variant_schema['properties']
        sub_type = None
        sub_embedded_group = self.sub_embedded_mapping.get(key)
        if field not in props:  # check if sub-embedded field
            if sub_embedded_group and field in props[sub_embedded_group]['items']['properties']:
                type = props[sub_embedded_group]['items']['properties'][field]['type']
                if type == 'array':
                    sub_type = props[sub_embedded_group]['items']['properties'][field]['items']['type']
            else:
                if fail:
                    raise VCFParserException('Tried to check a variant field that does not exist on the schema: %s' % field)
                else:
                    logger.error('Tried to check a variant field that does not exist on the schema: %s' % field)
                    return None
        else:
            type = props[field]['type']
            if type == 'array':
                sub_type = props[field]['items']['type']
        return self.process_field_value(type, value, sub_type)

    def record_to_variant(self, record):
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
        for key in self.format.keys():
            # handle non-annotation fields
            if key not in self.annotation_keys:
                if record.INFO.get(key, None):
                    val = self.process_variant_value(key, record.INFO.get(key), fail=False)
                    if val is not None:
                        result[key] = val
                continue

            # handle annotation fields
            annotations = None
            raw = record.INFO.get(key, None)
            if raw:
                annotations = self.parse_annotation_field(raw)

            # if this annotation field has values, process them
            if annotations:

                # annotation could be multi-valued split into groups
                for g_idx, group in enumerate(annotations):

                    # in nearly all cases there are multiple fields. match them
                    # up with format
                    for f_idx, field in enumerate(group):
                        if field:
                            fn = self.format[key][f_idx]
                            if fn == 'DROPPED':
                                continue

                            # handle sub-embedded
                            if key in self.sub_embedded_mapping:
                                sub_embedded_group = self.sub_embedded_mapping[key]
                                if sub_embedded_group not in result:  # create sub-embedded group if not there
                                    result[sub_embedded_group] = {}
                                if g_idx not in result[sub_embedded_group]:
                                    result[sub_embedded_group][g_idx] = {}
                                result[sub_embedded_group][g_idx][fn] = self.process_variant_value(fn, field, key)
                            else:
                                result[fn] = self.process_variant_value(fn, field, key)
        return result

    @staticmethod
    def format_variant(result):
        """ Does some extra formatting to the variant so it fits the schema
            When we build the item above we index the seo's into a dictionary.
            This function removes that and puts them instead into a list as
            expected by the schema

        Args:
            result: the item to reformat
        """
        acc = []
        for _, vals in result['transcript'].items():
            acc.append(vals)
        result['transcript'] = acc

    @staticmethod
    def parse_samples(result, record):
        """ Parses the samples on the record, adding them to result

        Args:
            result: dict to populate
            record: record to parse
        """
        result['QUAL'] = record.QUAL
        result['FILTER'] = record.FILTER[0]
        sample = record.samples[0].data
        result['GT'] = sample.GT
        result['AD'] = sample.AD
        result['DP'] = sample.DP
        result['GQ'] = sample.GQ
        result['PL'] = sample.PL

    def record_to_sample_variant(self, record):
        """ Parses the given record to produce the sample variant

        Args:
            record: a vcf entry to parse

        Raises:
            VCFParserException from helpers

        Returns:
            a (dict) sample_variant item
        """
        result = {}
        props = self.variant_sample_schema['properties']
        for field in props.keys():  # locate all non-sample included fields
            if record.INFO.get(field, None):
                val = record.INFO.get(field)
                prop_type = props[field]['type']
                if prop_type == 'array':
                    sub_type = props[field]['items']['type']
                    result[field.upper()] = self.process_field_value(prop_type, val, sub_type)
                else:
                    result[field.upper()] = self.process_field_value(prop_type, val)
        self.parse_samples(result, record) # add sample fields, already formatted
        return result

    def run(self, project=None, institution=None):
        """ Runs end-to-end variant ingestion, processing all records and
            accumulating the variants and sample_variants

        Args:
            project: project to post these items under
            institution: institution to post these items under

        Returns:
            2 tuple of arrays containing the variant sample/variant items
        """
        variant_samples, variants = [], []
        for record in self:
            vs = self.record_to_sample_variant(record)
            v = self.record_to_variant(record)
            if project:
                vs['project'] = project
                v['project'] = project
            if institution:
                vs['institution'] = institution
                v['institution'] = institution
            variant_samples.append(vs)
            self.format_variant(v)
            variants.append(v)
        return variant_samples, variants


class MPIngester(object):
    """ Multiprocessing class for VCF Ingestion. Allows us to multiprocess more
        than one large VCF file

        Thoughts: 3 modes - MP multiple files, MP a large VCF, do both?
    """

    def __init__(self, processes=1):
        """ Creates an MPIngester with 1 process by default """
        self.processes = processes

    def initialize(self):
        """ XXX: stub """
        pass

    def run(self):
        """ XXX: stub """
        pass


def main():
    """ Main, ingests VCF and posts if args specified

    Args (via argparse):
        vcf: path to vcf file to parse
        variant: path to variant.json schema
        sample: path to variant_sample.json schema
        project: project to post inserts under
        institution: institution to post inserts under
        --post-inserts: If specified, will post inserts, by default False
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
    parser.add_argument('--post-inserts', action='store_true', default=False,
                        help='If specified, will post inserts, by default False')
    args = parser.parse_args()

    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf, args.variant, args.sample)

    # post items
    if args.post_inserts:
        from ff_utils import post_metadata
        variant_samples, variants = vcf_parser.run()
        for vs in variant_samples:
            ff_utils.post_metadata(vs, 'variant_sample', None)
        for v in variants:
            ff_utils.post_metadata(v, 'variant', None)

    logger.info('Succesfully posted VCF entries')
    exit(0)

if __name__ == '__main__':
    main()
