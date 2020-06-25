from pyramid.paster import get_app
from encoded.submit import *
from dcicutils.misc_utils import VirtualApp
import json


def main():
    app = get_app('development.ini', 'app')
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
    virtualapp = VirtualApp(app, environ)
    proj = virtualapp.get('/projects/12a92962-8265-4fc0-b2f8-cf14f05db58b/').json
    inst = virtualapp.get('/institutions/hms-dbmi/').json
    json_data = xls_to_json('src/encoded/tests/data/documents/cgap_submit_test.xlsx', proj, inst)
    final_json, validation_log = validate_all_items(virtualapp, json_data)
    print('\n'.join(validation_log))
    print(json.dumps(final_json, indent=4))
    result = post_and_patch_all_items(virtualapp, final_json)
    print('\n'.join(result))


if __name__ == '__main__':
    main()
