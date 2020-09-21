# Declarations of constants used in the inserts so they can be used more abstractly in testing.

import os

# Available in master_inserts, workbook_inserts, demo-inserts

DBMI_INSTITUTION = '/institutions/hms-dbmi/'

# Available in master_inserts, workbook_inserts

TEST_PROJECT = "/projects/12a92962-8265-4fc0-b2f8-cf14f05db58b/"

# This gives variable names to refer to various files in this hierarchy.

TEST_DATA_DIR = os.path.dirname(__file__)

METADATA_BUNDLE_PATH = os.path.join(TEST_DATA_DIR, 'documents/cgap_submit_test.xlsx')
METADATA_BUNDLE_PATH_WITH_ERRORS = os.path.join(TEST_DATA_DIR, 'documents/cgap_submit_test_with_errors.xlsx')

