import json

from dcicutils.misc_utils import VirtualApp
from pyramid.paster import get_app
from ..submit import digest_xls, xls_to_json, validate_all_items, post_and_patch_all_items
from ..tests.data import DBMI_INSTITUTION, TEST_PROJECT, METADATA_BUNDLE_PATH


def main():
    app = get_app('development.ini', 'app')
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
    virtualapp = VirtualApp(app, environ)
    proj = virtualapp.get(TEST_PROJECT).json
    inst = virtualapp.get(DBMI_INSTITUTION).json
    rows = digest_xls(METADATA_BUNDLE_PATH)
    json_data, passing = xls_to_json(rows, proj, inst)
    print('JSON data (to validate):', json.dumps(json_data))
    final_json, validation_log, passing = validate_all_items(virtualapp, json_data)
    print('Validation Log:\n'.join(validation_log))
    print("Passing (after validation):", passing)
    print("Final JSON (to post, after validation):", json.dumps(final_json, indent=4))
    output, passing, files = post_and_patch_all_items(virtualapp, final_json)
    print('Post Output:\n', '\n'.join(output))
    print('Passing (after post and patch):', passing)
    print('Files:', json.dumps(files, indent=4))


if __name__ == '__main__':
    main()
