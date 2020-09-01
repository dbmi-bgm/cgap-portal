import json

from dcicutils.misc_utils import VirtualApp
from pyramid.paster import get_app
from ..submit import digest_xls, xls_to_json, validate_all_items, post_and_patch_all_items


def main():
    app = get_app('development.ini', 'app')
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
    virtualapp = VirtualApp(app, environ)
    proj = virtualapp.get('/projects/12a92962-8265-4fc0-b2f8-cf14f05db58b/').json
    inst = virtualapp.get('/institutions/hms-dbmi/').json
    rows = digest_xls('/Users/sarah/cgap/437-UDN_2020-08-28.xlsx')
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
