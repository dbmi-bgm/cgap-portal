import sys
import vcf
import json
import argparse
import logging
from collections import OrderedDict

logger = logging.getLogger(__name__)
EPILOG = __doc__
ANNOTATION_TYPES = ['ANN', 'ANNOVAR', 'ANNOTADD']

# might be useful
class VCFParserException(Exception):
    pass


class VCFParser(object):
    """
    Wrapper class for 'vcf' that handles some additional things for us
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

        XXX: Mismatch return type, probably bad practice
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
        Only needed for annotations - other fields will work as is
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
                if key not in ANNOTATION_TYPES:
                    self.format[key] = key # handle non annotation INFOs
                else:
                    self.format[key] = self.parse_vcf_info(info)

    @staticmethod
    def parse_annovar(raw, n_expected):
        """
        Helper method for parse_vcf_record to handle formatting problems
        with ANNOVAR/ANNOTADD annotations

        XXX: This cannot be necessary. Need to agree on annotation format.
        """
        lst = ','.join(raw).split('|')
        if len(lst) == n_expected:
            return [','.join(raw)]
        else:
            raise VCFParserException


    def parse_vcf_record(self, record):
        """
        Produces a dictionary containing all the annotation fields for this record

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
        """
        result = {}
        for key in self.format.keys():

            # handle non-annotation fields
            if key not in ANNOTATION_TYPES:
                result[key] = record.INFO.get(key, None)
                continue

            # handle annotation fields
            annotations = None
            raw = record.INFO.get(key, None)
            if raw:
                if key in ['ANNOVAR', 'ANNOTADD']: # sometimes come out malformed
                    raw = self.parse_annovar(raw, len(self.format[key]))
                annotations = [r.split('|') for r in raw] # could be many
            if annotations:
                for g_idx, group in enumerate(annotations):
                    for f_idx, field in enumerate(group):
                        if field:
                            field_name = self.format[key][f_idx]
                            if not result.get(field_name):
                                result[field_name] = {}
                            result[field_name][g_idx] = field
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
