import sys
import vcf
import json
import argparse
import logging
from collections import OrderedDict

logger = logging.getLogger(__name__)
EPILOG = __doc__

# might be useful
class VCFParserException(Exception):
    pass


class VCFParser(object):
    """
    Wrapper class for 'vcf' that handles some additional things for us
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

    @staticmethod
    def parse_vcf_info(info):
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
            return s
        entries = info.desc.split(':')[1:][0].split('|')  # specific to format
        return list(map(_strip, entries))

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

    @staticmethod
    def process_field_value(type, value, allow_array=True):
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
            return str(value)
        elif type == 'integer':
            return int(value)
        elif type == 'number':
            return float(value)
        elif type == 'array':
            if allow_array:
                sub_type = props['items']['type']
                items = value.split('~')
                return list(map(lambda v: process_field_value(sub_type, v, allow_array=False)))
        else:
            raise VCFParserException('type was not one of: string, integer, number, array')

    def process_variant_value(self, field, value, key):
        """ Given a field, check the variant schema for the type of that field and cast
        the given value to that type

        Args:
            field: name of the field we are looking to process. This should exist somewhere
            in the schema properties either at the top level or as a sub-embedded object
            value: value of the field to be cast
            key: annotation field that this field is part of (if applicable)

        Returns:
            casted value

        Raises:
            VCFParserException if the given field does not exist
        """
        props = self.variant_schema['properties']
        if field not in props:
            if field not in props[key]['items']['properties']:
                raise VCFParserException('Tried to check a variant field that does not exist on the schema')
        type = props[field]['type']
        return self.process_field_value(type, value)

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
        """ Uses self.reader as an iterator to get the next record """
        return next(self.reader)

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
        """
        result = {}
        self.parse_standard_vcf_fields(record, result)
        for key in self.format.keys():

            # handle non-annotation fields
            if key not in self.annotation_keys:
                result[key] = record.INFO.get(key, None)
                continue

            # handle annotation fields
            result[key] = {}
            annotations = None
            raw = record.INFO.get(key, None)
            if raw:
                annotations = self.parse_annotation_field(raw)
            if annotations:
                for g_idx, group in enumerate(annotations):
                    for f_idx, field in enumerate(group):
                        if field:
                            field_name = self.format[key][f_idx]
                            if not result[key].get(field_name):
                                result[key][field_name] = {}
                            if '~' in field:  # XXX: infer list for now
                                result[key][field_name][g_idx] = field.split('~')
                            else:
                                result[key][field_name][g_idx] = field
        return result

    def format_vcf_record(self, result):
        """
            TODO: process the 'result' generated above into a variant/sample
            variant item
        """
        pass

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
