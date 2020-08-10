import json

from dcicutils.misc_utils import VirtualApp
from ..submit import xls_to_json, validate_all_items, post_and_patch_all_items
from pyramid.paster import get_app


def main():
    app = get_app('development.ini', 'app')
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
    virtualapp = VirtualApp(app, environ)
    proj = virtualapp.get('/projects/12a92962-8265-4fc0-b2f8-cf14f05db58b/').json
    inst = virtualapp.get('/institutions/hms-dbmi/').json
    json_data, passing = xls_to_json('src/encoded/tests/data/documents/cgap_submit_test.xlsx', proj, inst)
    final_json, validation_log, passing = validate_all_items(virtualapp, json_data)
    print('Validation Log:\n'.join(validation_log))
    print(json.dumps(final_json, indent=4))
    output, no_errors, files = post_and_patch_all_items(virtualapp, final_json)
    print('Post Output:\n', '\n'.join(output))
    print('No Errors:', no_errors)
    print('Files:', files)


if __name__ == '__main__':
    main()
