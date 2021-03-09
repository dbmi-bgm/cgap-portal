import contextlib
import io
import json
import pkg_resources

from dcicutils.misc_utils import find_association, ignorable


def master_lookup(item_type, **attributes):
    return any_inserts_lookup('master-inserts', item_type=item_type, **attributes)


def workbook_lookup(item_type, **attributes):
    return any_inserts_lookup('workbook-inserts', item_type=item_type, **attributes)


def any_inserts_lookup(inserts_directory_name, item_type, **attributes):
    item_filename = pkg_resources.resource_filename('encoded', 'tests/data/' + inserts_directory_name
                                                    + "/" + item_type.lower() + ".json")
    with io.open(item_filename) as fp:
        data = json.load(fp)
        return find_association(data, **attributes)


NON_REQUIRED_CORE_FIELDS = {'uuid', 'name'}


def required_field_set(item_type):
    schema_filename = pkg_resources.resource_filename('encoded', 'schemas/%s.json' % item_type.lower())
    with io.open(schema_filename) as fp:
        required = set(json.load(fp).get('required', []))
        return required | NON_REQUIRED_CORE_FIELDS


def core_field_set(item_type):
    return required_field_set(item_type) | NON_REQUIRED_CORE_FIELDS


def core_portion(item_type, item):
    subset = {}
    required = core_field_set(item_type)
    for k, v in item.items():
        if k in required:
            subset[k] = v
    return subset


def trim_item_for_undo(item_type, item, keys):
    key_set_to_keep = (set(keys) - required_field_set(item_type)) | NON_REQUIRED_CORE_FIELDS
    trimmed = {}
    for k, v in item.items():
        if k in key_set_to_keep:
            if isinstance(v, dict) and '@id' in v:
                v = v['@id']
            trimmed[k] = v
    return trimmed


def post_related_items_for_testing(testapp, item_dict, undo_dict):
    for item_type, items in item_dict.items():
        for item in items:
            try:
                testapp.post_json('/' + item_type, core_portion(item_type, item))
            except Exception as e:
                ignorable(e)
                try:
                    found = testapp.get('/%ss/%s/' % (item_type.lower(), item['uuid'])).maybe_follow().json
                except Exception as ee:
                    ignorable(ee)
                    found = None
                if found:
                    trimmed = trim_item_for_undo(item_type, found, item.keys())
                    if item_type not in undo_dict:
                        undo_dict[item_type] = []
                    # If there was data there before, remember how to restore it.
                    undo_dict[item_type].append(trimmed)
    carefully_patch_related_items_for_testing(testapp=testapp, item_dict=item_dict)
    return undo_dict


_FIELD_MISSING = object()


def carefully_patch_related_items_for_testing(testapp, item_dict):
    for item_type, items in item_dict.items():
        for item in items:
            url = '/%ss/%s/' % (item_type.lower(), item['uuid'])
            delta = {}
            current = testapp.get(url).maybe_follow().json
            for k, desired_v in item.items():
                current_v = current.get(k, _FIELD_MISSING)
                if desired_v != current_v:
                    delta[k] = desired_v
            if delta:
                testapp.patch_json(url, delta)


@contextlib.contextmanager
def assure_related_items_for_testing(testapp, item_dict):
    undo_dict = {}
    try:
        post_related_items_for_testing(testapp=testapp, item_dict=item_dict, undo_dict=undo_dict)
        yield
    finally:
        carefully_patch_related_items_for_testing(testapp=testapp, item_dict=undo_dict)
