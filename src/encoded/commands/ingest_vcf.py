import csv
import sys
import vcf
import json
import argparse
import logging
from collections import OrderedDict

logger = logging.getLogger(__name__)
EPILOG = __doc__


class VCFParser(object):
    """
    VCF Parser that wraps some methods and data associated with a single
    VCF File
    """

    def __init__(self, _vcf, variant, sample):
        self.reader = vcf.Reader(open(_vcf, 'r'))
        self.variant_schema = json.load(open(variant, 'r'))
        self.variant_sample_schema = json.load(open(sample, 'r'))
        self.annotation_keys = self.reader.infos.keys()
        self.format = OrderedDict()

    def get_record(self):
        """ Uses self.reader as an iterator to get the next record """
        return next(self.reader)

    def read_vcf_metadata(self):
        """
        Parses VCF file meta data (nothing very useful).
        """
        return self.reader.metadata

    def read_vcf_fields(self, key='ALL'):
        """
        Returns fields associated with the given VCF in fname. If a key is specified
        meta data associated with that key will be returned
        examples: ANN, LOF, NMD, ANNOVAR, ANOTADD
        """
        if key == 'ALL':
            return self.reader.infos
        else:
            return self.reader.infos.get(key)

    @staticmethod
    def parse_vcf_info(info):
        """
        Helper function for parse_vcf_fields that handles parsing the 'info'
        object containing a header listing the fields
        """
        def _strip(s):
            s = s.strip()
            s = s.strip('"')
            s = s.strip("'")
            return s
        entries = info.desc.split(':')[1:][0].split('|') # specific to format
        return list(map(_strip, entries))

    def parse_vcf_fields(self):
        """
        Populates self.format into a dictionary containing annotation keys
        mapped to a list of fields and returns self.format when done
        """
        for key in self.annotation_keys:
            info = self.reader.infos.get(key, None)
            if info:
                self.format[key] = self.parse_vcf_info(info)

    def parse_vcf_record(self, record):
        """
        Parses an individual vcf record
        """
        result = {}
        for key in self.format.keys():
            annotations = None
            raw = record.INFO.get(key, None)
            if raw:
                annotations = raw[0].split('|') # which annotation is the right one?
            if annotations:
                for idx, field in enumerate(annotations):
                    if field:
                        field_name = self.format[key][idx]
                        result[field_name] = field
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
