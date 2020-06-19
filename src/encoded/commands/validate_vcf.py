import os
import vcf
import argparse


EPILOG = __doc__


class VCFValidator(object):
    """ Wrapper class for 'vcf' that just validates the VCF can be read with no errors
        due to VCF structure
    """

    def __init__(self, _vcf):
        self.reader = vcf.Reader(open(_vcf, 'r'))

    def validate(self):
        """ Validates the VCF ie: tries reading and parsing all VCF fields.
            Note: this will NOT validate INFO subfields. """
        idx = 0
        try:
            for idx, record in enumerate(self.reader):
                print("Record %s validated" % idx)
            return True
        except Exception:  # catch all and re-raise, alerting the user to which record
            print("Record %s failed vcf spec validation" % (idx + 1))
            raise


def main():
    parser = argparse.ArgumentParser(
        description="Ingests a given VCF file",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('vcf', help='path to vcf file')
    args = parser.parse_args()

    # do the validation
    if not os.path.exists(args.vcf):
        print('Bad vcf path - got: %s' % args.vcf)
        exit(1)
    validator = VCFValidator(args.vcf)
    exit(validator.validate())


if __name__ == '__main__':
    main()
