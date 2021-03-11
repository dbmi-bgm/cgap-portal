# Declarations of constants used in the inserts so they can be used more abstractly in testing.

import os

from ..helpers import master_lookup

# Available in master_inserts, workbook_inserts, demo-inserts

DBMI_INSTITUTION = master_lookup('Institution', name='hms-dbmi')
DBMI_INSTITUTION_UUID = DBMI_INSTITUTION['uuid']
DBMI_INSTITUTION_NAME = DBMI_INSTITUTION['name']
DBMI_INSTITUTION_ID = '/institutions/%s/' % DBMI_INSTITUTION_NAME

# Available in master_inserts, workbook_inserts

DBMI_PROJECT = master_lookup('Project', name='hms-dbmi')
DBMI_PROJECT_UUID = DBMI_PROJECT['uuid']
DBMI_PROJECT_NAME = DBMI_PROJECT['name']
DBMI_PROJECT_ID = '/projects/%s/' % DBMI_PROJECT_NAME

TEST_PROJECT_NAME = 'cgap-backend-testing'
TEST_PROJECT = master_lookup('Project', name=TEST_PROJECT_NAME)
TEST_PROJECT_UUID = TEST_PROJECT['uuid']
TEST_PROJECT_NAME = TEST_PROJECT['name']
TEST_PROJECT_ID = '/projects/%s/' % TEST_PROJECT_NAME

DBMI_PI = master_lookup('User', email=DBMI_INSTITUTION['pi'])
DBMI_PI_UUID = DBMI_PI['uuid']
DBMI_PI_EMAIL = DBMI_PI['email']

# This gives variable names to refer to various files in this hierarchy.

TEST_DATA_DIR = os.path.dirname(__file__)

METADATA_BUNDLE_PATH = os.path.join(TEST_DATA_DIR, 'documents/cgap_submit_test.xlsx')
METADATA_BUNDLE_PATH_WITH_ERRORS = os.path.join(TEST_DATA_DIR, 'documents/cgap_submit_test_with_errors.xlsx')
