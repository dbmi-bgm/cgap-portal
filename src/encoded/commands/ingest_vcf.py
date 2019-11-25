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

    def get_annotation_fields(self, list=False):
        """ Getter for annotation fields as list or dict

        Args:
            list: boolean on whether you just want a list of keys

        Returns:
            depends on args - dict by default, could be list
        """
        if not list:
            return self.annotation_keys
        else:
            return self.annotation_keys.keys()

    def get_generic_fields(self, list=False):
        """ Getter for generic fields as list or dict

        Args:
            list: boolean on whether you just want a list of keys

        Returns:
            depends on args - dict by default, could be list
        """
        if not list:
            return self.field_keys
        else:
            return self.field_keys.keys()

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

    @staticmethod
    def parse_standard_vcf_fields(record, result):
        """ Pulls common VCF field information into result

        Args:
            record: vcf record to parse
            result: dict representation of the record
        """
        result['Chrom'] = record.CHROM
        result['Pos'] = record.POS
        result['ID'] = record.ID
        result['Ref'] = record.REF
        result['Alt'] = record.ALT
        result['Qual'] = record.QUAL
        result['Filter'] = record.FILTER
        result['Format'] = record.FORMAT
        result['samples'] = record.samples

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
            except ValueError: # required if casting string->float->int, such as '0.000'
                return int(float(value))
        elif type == 'number':
            return float(value)
        elif type == 'array':
            if sub_type:
                items = value.split('~')
                return list(map(lambda v: self.process_field_value(sub_type, v, sub_type=None), items))
        else:
            raise VCFParserException('type was not one of: string, integer, number, array')

    def process_variant_value(self, field, value, key=''):
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
                raise VCFParserException('Tried to check a variant field that does not exist on the schema')
        else:
            type = props[field]['type']
        return self.process_field_value(type, value, sub_type)

    def parse_vcf_record(self, record):
        """ Produces a dictionary containing all the annotation fields for this record

            Compatible with non-annotation fields like:
                ##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">
            in addition to annoation fields like:
                ##INFO=<ID=ANN,Number=.,Type=String,Description="Functional annotations:
                'Allele | Annotation | Annotation_Impact | Gene_Name | Gene_ID |
                Feature_Type | Feature_ID | Transcript_BioType | Rank | HGVS.c |
                HGVS.p | cDNA.pos / cDNA.length | CDS.pos / CDS.length | AA.pos / AA.length
                | Distance | ERRORS / WARNINGS / INFO' ">

            In the former case the 'result' would contain a single dict entry for 'SVTYPE'
            containing the value in this record. In the latter you would get a dict entry
            for each field in the annotation fields, such as Allele, Annotation etc.
            There could be multiple annotations per variant. These are indexed by group, so
            a entry would look like:
                { 'Allele' : {0 : 'A', 1 : 'G' }, ... }
            which in this case tell us this annotation has two entries

            If a record has no entry for an expected field, that field will not exist
            in result. Oftentimes in the VCF there are gaps in annotations so we just
            drop those fields from the result if we dont see a value

        Args:
            record: a single row in the VCF to parse, grabbed from 'vcf'

        Returns:
            dictionary of parsed VCF entry
        """
        result = {}
        self.parse_standard_vcf_fields(record, result)
        for key in self.format.keys():

            # handle non-annotation fields
            if key not in self.annotation_keys:
                result[key] = record.INFO.get(key, None)
                continue

            # handle annotation fields
            annotations = None
            raw = record.INFO.get(key, None)
            if raw:
                annotations = self.parse_annotation_field(raw)

            # if this annotation field has values, process them
            if annotations:

                # annotation could be multi-valued (VEP), split into groups
                for g_idx, group in enumerate(annotations):

                    # in nearly all cases there are multiple fields. match them
                    # up with format
                    for f_idx, field in enumerate(group):
                        if field:
                            fn = self.format[key][f_idx]
                            if fn == 'DROPPED':  # special marker for non-MVP fields
                                continue

                            # if this annotation is a sub-embedded-grouping, process
                            # it as such
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

def main():
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Ingests a given VCF file",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('vcf', help='path to vcf file')
    parser.add_argument('variant', help='path to variant schema')
    parser.add_argument('sample', help='path to sample variant schema')
    args = parser.parse_args()

    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf, args.variant, args.sample)
    vcf_parser.parse_vcf_fields()
    record = vcf_parser.get_record()
    print(vcf_parser.parse_vcf_record(record))


if __name__ == '__main__':
    main()
