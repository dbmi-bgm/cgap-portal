import os
import argparse
import logging
from mapping_table_intake import MappingTableParser

logger = logging.getLogger(__name__)
EPILOG = __doc__

FILES_TO_PROVIDE = [
    "mapping_table.csv",
    "annotation_field.json",
    "variant.json",
    "variant_sample.json",
]


FIELDS_TO_PROVIDE = [
    "config_uri",
    "app_name",
    "project",
    "institution",
]


BOOLS_TO_PROVIDE = [
    "skip_mp"
]

def run_func_until_true(func):
    """ Executes func until it returns True """
    while not func():
        continue


def file_exists(f):
    """ Checks if file exists """
    return os.path.exists(f)


def do_interactive():
    """ Interactive variant ingestion program """
    print('Entering interactive mode - CTRL-C to exit')

    # read boolean inputs first
    bools = {}
    for bool_flag in BOOLS_TO_PROVIDE:
        while True:
            flag = input("Enter T or F for boolean flag %s: " % bool_flag)
            print(flag)
            if flag not in ['T', 'F']:
                print('Input was not one of T or F - try again or CTRL-C to exit')
            else:
                bools[bool_flag] = True if flag == 'T' else False
                break

    # read provided file locations next
    files = {}
    for file in FILES_TO_PROVIDE:
        while True:
            location = input("Enter an absolute or relative path to %s: " % file)
            if file_exists(location):
                print('Using %s for file %s' % (location, file))
                files[file] = location
                break
            else:
                print('Provided file does not exist - please try again or CTRL-C to exit')

    # XXX: Do rest if we actually want it
    pass


def run_mapping_table_intake(args):
    """ Runs the mapping table intake step """
    pass


def run_vcf_ingestion(args):
    """ Runs the vcf parsing step """
    pass


def main():
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Variant Ingestion Program",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--interactive', help='Run variant ingestion in interactive mode',
                        default=False, action='store_true')
    parser.add_argument('--skip-mp', help='Skip the mapping table intake step. \n \
                                           Do this if no changes have been made to the mapping table',
                        default=False, action='store_true')
    parser.add_argument('--annotation_field_schema', help='path to annotation field schema',
                        default='./src/encoded/schemas/annotation_field.json')
    parser.add_argument('--variant', help='where to write variant schema \n \
                                           NOTE: By default this will overwrite the current schema')
    parser.add_argument('--sample', help='where to write sample_variant schema \n \
                                          NOTE: By default this will overwrite the current schema')
    args = parser.parse_args()

    if args.interactive:
        try:
            do_interactive()
            exit(0)
        except Exception as e:
            logger.error("Got exception in interactive session, exiting: %s" % str(e))
            exit(1)
    else:
        pass  # handle passing args directly


if __name__ == "__main__":
    main()