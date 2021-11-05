import io
import json
import os

from dcicutils.misc_utils import VirtualApp
from pyramid.paster import get_app
from ..submit import digest_xlsx, xls_to_json, validate_all_items, post_and_patch_all_items
from ..tests.data import DBMI_INSTITUTION_ID, DBMI_PROJECT_ID, METADATA_BUNDLE_PATH


TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "submission_test_data")

TEST_FILE_TO_VALIDATE = os.path.join(TEST_DATA_DIR, "to_validate.json")
TEST_FILE_TO_PATCH = os.path.join(TEST_DATA_DIR, "to_patch.json")
TEST_FILE_TO_POST = os.path.join(TEST_DATA_DIR, "to_post.json")
TEST_FILE_POST_OUTPUT = os.path.join(TEST_DATA_DIR, "post_output.json")
TEST_FILE_PATCH_OUTPUT = os.path.join(TEST_DATA_DIR, "patch_output.json")
TEST_FILE_TO_UPLOAD = os.path.join(TEST_DATA_DIR, "to_upload.json")

with io.open(TEST_FILE_TO_VALIDATE, 'r') as fp:
    TEST_DATA_TO_VALIDATE = json.load(fp)

with io.open(TEST_FILE_TO_POST, 'r') as fp:
    TEST_DATA_TO_POST = json.load(fp)

with io.open(TEST_FILE_TO_PATCH, 'r') as fp:
    TEST_DATA_TO_PATCH = json.load(fp)

with io.open(TEST_FILE_POST_OUTPUT, 'r') as fp:
    TEST_DATA_POST_OUTPUT = json.load(fp)

with io.open(TEST_FILE_PATCH_OUTPUT, 'r') as fp:
    TEST_DATA_PATCH_OUTPUT = json.load(fp)

with io.open(TEST_FILE_TO_UPLOAD, 'r') as fp:
    TEST_DATA_TO_UPLOAD = json.load(fp)


def main():
    """
    This does a simple test of the data pipeline used for metadata bundle submission.

    This does not test the submission endpoints, but DOES call server endpoints to
    inquire about current state and based on that state to decide to post or patch the data.
    (As such, the exact action of this script is dependent on the state of the db when it is run.)

    The server called will be the one defined by the development environment.
    As such, that means we won't be using this test as part of unit tests,
    though perhaps variations of this will be adopted for that purpose.
    """

    app = get_app('development.ini', 'app')
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
    virtualapp = VirtualApp(app, environ)
    proj = virtualapp.get(DBMI_PROJECT_ID).json
    inst = virtualapp.get(DBMI_INSTITUTION_ID).json
    rows = digest_xlsx(METADATA_BUNDLE_PATH)
    json_data, passing = xls_to_json(rows, proj, inst)
    print('JSON data (to validate):', json.dumps(json_data))
    assert json_data == TEST_DATA_TO_VALIDATE
    print('JSON data to validate matches contents of %s' % TEST_FILE_TO_VALIDATE)
    final_json, validation_log, passing = validate_all_items(virtualapp, json_data)
    print('Validation Log:\n'.join(validation_log))
    print("Passing (after validation):", passing)
    print("Final JSON (to post, after validation):", json.dumps(final_json, indent=4))
    if final_json == TEST_DATA_TO_PATCH:
        # NOTE: There are more possible intermediate states than just "it's all been done" and "none has been done",
        #  but this simple script does not anticipate those and will just fail if one of those other states is in play.
        #  -kmp 8-Sep-2020
        posting = False
        print("JSON data has already been posted. Light patching is expected.")
        print("(To test posting at this point would require wiping the database or adjusting numerous items.)")
        print('JSON data to patch matches contents of %s' % TEST_FILE_TO_PATCH)
    else:
        posting = True
        assert final_json == TEST_DATA_TO_POST
        print('JSON data to post matches contents of %s' % TEST_FILE_TO_POST)
    output, passing, files = post_and_patch_all_items(virtualapp, final_json)
    print('Post Output:\n', '\n'.join(output))
    print('Passing (after post and patch):', passing)
    if posting:
        assert output == TEST_DATA_POST_OUTPUT
        print('JSON data to post matches contents of %s' % TEST_FILE_POST_OUTPUT)
    else:
        assert output == TEST_DATA_PATCH_OUTPUT
        print('JSON data to post matches contents of %s' % TEST_FILE_PATCH_OUTPUT)
    print('Files:', json.dumps(files, indent=4))
    assert files == TEST_DATA_TO_UPLOAD
    print('JSON data to upload matches contents of %s' % TEST_FILE_TO_UPLOAD)
    print("SUCCESS! All done.")


if __name__ == '__main__':
    main()
