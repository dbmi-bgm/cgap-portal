import csv
import sys
import vcf
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

    def __init__(self, fname):
        self.reader = vcf.Reader(open(fname, 'r'))
        self.annotation_keys = self.reader.infos.keys()

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



def main():
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Ingests a given VCF file",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('vcf', help='path to vcf file')
    args = parser.parse_args()

    logger.info('Ingesting VCF file: %s' % args.vcf)
    vcf_parser = VCFParser(args.vcf)
    print(vcf_parser.read_vcf_metadata())
    print(vcf_parser.read_vcf_fields())



if __name__ == '__main__':
    main()
