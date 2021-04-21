import contextlib
import io
import json
import pkg_resources

from dcicutils.misc_utils import find_association, find_associations, ignorable
from dcicutils.lang_utils import string_pluralize


def master_lookup(item_type, multiple=False, **attributes):
    """
    Given an item type and a set of attributes, looks up the master insert of that type matching
    the given attribute details.

    :param item_type: an item type (such as 'User' or 'Project')
    :param multiple: True if the result should be a list of multiple objects, or False if it should be a single object
    :param attributes: a set of keywords and values (or keywords and predicate functions).
    :return: the JSON for a matching insert (if multiple=False) or a list of such items (if multiple=True)
    """

    return any_inserts_lookup('master-inserts', item_type=item_type, multiple=multiple, **attributes)


def workbook_lookup(item_type, multiple=False, **attributes):
    """
    Given an item type and a set of attributes, looks up the workbook insert of that type matching
    the given attribute details.

    :param item_type: an item type (such as 'User' or 'Project')
    :param multiple: True if the result should be a list of multiple objects, or False if it should be a single object
    :param attributes: a set of keywords and values (or keywords and predicate functions).
    :return: the JSON for a matching insert (if multiple=False) or a list of such items (if multiple=True)
    """

    return any_inserts_lookup('workbook-inserts', item_type=item_type, multiple=multiple, **attributes)


def any_inserts_lookup(inserts_directory_name, item_type, multiple=False, **attributes):
    """
    Given an item type and a set of attributes, looks up the master insert of that type matching
    the given attribute details.

    :param inserts_directory_name: The name of an inserts directory (such as 'master-inserts' or 'workbook-inserts')
    :param item_type: an item type (such as 'User' or 'Project')
    :param multiple: True if the result should be a list of multiple objects, or False if it should be a single object
    :param attributes: a set of keywords and values (or keywords and predicate functions).
    :return: the JSON for a matching insert (if multiple=False) or a list of such items (if multiple=True)
    """

    item_filename = pkg_resources.resource_filename('encoded', 'tests/data/' + inserts_directory_name
                                                    + "/" + item_type.lower() + ".json")
    with io.open(item_filename) as fp:
        data = json.load(fp)
        finder = find_associations if multiple else find_association
        return finder(data, **attributes)


def _required_field_set(item_type):
    """
    Returns a list of the required fields for a given item type, taken from the schema's 'required' field.
    (This looks ONLY at schema toplevel, as a heuristic, so may not be suitable for production use.)

    :param item_type: an item type (alphabetic case is unimportant)
    :return: a set of required field names
    """
    schema_filename = pkg_resources.resource_filename('encoded', 'schemas/%s.json' % item_type.lower())
    with io.open(schema_filename) as fp:
        required = set(json.load(fp).get('required', []))
        return required


# When doing an original post for testing (simulating primary and secondary queue posting),
# these are fields that are OK to go ahead and set on the first pass, that don't have to be
# relegated to a secondary queue of things to patch.

_NON_REQUIRED_CORE_FIELDS = {'uuid', 'name'}


def _core_field_set(item_type):
    """
    This returns the set of core fields that should be intially posted when doing pass1 of the two-pass
    technique for instantiating a set of cooperating items during test. Fields not returned should be
    patched, not posted.

    This is similar to required_field_set, but adds back some non-required core fields.
    (This choice is somewhat heuristic, but only used for testing.)

    :param item_type: an item type (alphabetic case is unimportant)
    :return: a set of core field names
    """
    return _required_field_set(item_type) | _NON_REQUIRED_CORE_FIELDS


def _core_portion(item_type, item):
    """
    This returns a stripped down part of an item to be posted on the first passof the two-pass
    technique for instantiating a set of cooperating items during test. It's primary job of this set is
    to get the 'identity' part of the object posted and to not run afoul of required fields in the schema.

    :param item_type: an item type (alphabetic case is unimportant)
    :param item: an item
    :return: the part of the item that has only the core fields of that item
    """
    subset = {}
    required = _core_field_set(item_type)
    for k, v in item.items():
        if k in required:
            subset[k] = v
    return subset


def _trim_item_for_undo(item_type, item, keys):
    # We add back NON_REQUIRED_CORE_FIELDS just in case because we always need the 'uuid' and don't want to
    # take a chance it's not there. In fact, that uuid will not be patched because it is unchanged, but the
    # data flow about the identity of the item is important. -kmp 10-Mar-2021
    key_set_to_keep = (set(keys) - _required_field_set(item_type)) | _NON_REQUIRED_CORE_FIELDS
    trimmed = {}
    for k, v in item.items():
        if k in key_set_to_keep:
            if isinstance(v, dict) and '@id' in v:
                v = v['@id']
            trimmed[k] = v
    return trimmed


def post_related_items_for_testing(testapp, item_dict, undo_dict):
    """
    This will post a set of items from an item_dict.  It does so in two passes, first by posting the identity,
    then by circling back and patching the details.

    Note that the undo_dict is created outside in advance and passed in to be modified here. That is so that if
    an error occurs during posting, the caller still holds onto a list of partial work to be undone.
    If we had accumulated a full return value it would be all-or-none even in the face of some postings
    having been done and others not. That would lead to confusion in later tests.

    :param testapp: the testapp to patch
    :param item_dict: the item dictionary
    :param undo_dict: a dictionary that will be augmented with undo information to undo patching (but not posting)
                      of the items.
    :return: an item_dict representing the posted objects
    """
    for item_type, items in item_dict.items():
        for item in items:
            already_posted = False
            try:
                # This post is done for side-effect.
                testapp.post_json('/' + item_type, _core_portion(item_type, item))
            except Exception as e:
                already_posted = True
                ignorable(e)
            items_type = string_pluralize(item_type.lower())
            found = testapp.get('/%s/%s/' % (items_type, item['uuid'])).maybe_follow().json
            if already_posted:
                trimmed = _trim_item_for_undo(item_type, found, item.keys())
                if item_type not in undo_dict:
                    undo_dict[item_type] = []
                # If there was data there before, remember how to restore it.
                undo_dict[item_type].append(trimmed)
    return _carefully_patch_related_items_for_testing(testapp=testapp, item_dict=item_dict)


_FIELD_MISSING = object()


def _carefully_patch_related_items_for_testing(testapp, item_dict):
    """
    This assumes that the items exist in some core form so that identity references will not fail and uses
    patch to bring their attributes into alignment for testing.

    Because this is for testing, where time is not quite as much at a premium as production, and it's still
    faster than debugging broken tests, this will poll the current state of the object and only submit a patch
    for things that actually need to change (that's the 'carefully' part).

    Note that the undo_dict is only used to undo patches, but to obliterate objects that did not previously exist.
    If there was a pre-existing object, it should get put back the way it was found. Also, a simplifiying assumption
    is made that any modifications to put back is only to fields initially enumerated. Hopefully that's
    good enough for now in a testing context. (The fear was that patching other parts of the object that were not
    enumerated might break something unexpected. Probably those things are not changed, and it might be entirely
    benign to restore those things, too, but it wasn't certain and wasn't necessary. So for now it does the simpler
    thing.)

    :param testapp: the testapp to patch
    :param item_dict: the item dictionary
    :return: None
    """
    result = {}
    for item_type, items in item_dict.items():
        result[item_type] = []
        for item in items:
            items_type = string_pluralize(item_type.lower())
            url = '/%s/%s/' % (items_type, item['uuid'])
            delta = {}
            current = testapp.get(url).maybe_follow().json
            for k, desired_v in item.items():
                current_v = current.get(k, _FIELD_MISSING)
                if desired_v != current_v:
                    delta[k] = desired_v
            if delta:
                res = testapp.patch_json(url, delta).maybe_follow().json['@graph'][0]
                # print("Patching", url, delta)
                # print(" =>", res)
                result[item_type] = res
            else:
                result[item_type] = current
    return result


@contextlib.contextmanager
def assure_related_items_for_testing(testapp, item_dict):
    """
    A context manager that posts a given set of cooperating items for testing. Something like the workbook,
    but on smaller scale and more modular. But also, upon return it try to undo changes to previously-existing items.

    :param testapp: a testapp or es_testapp to post to
    :param item_dict: an item dict of the form {item_type1: [item1_1, item1_2, ...], item_type2: [item_2_1, ...]}
    :yield: a set of items that have been posted
    """
    # Note that this undo_dict is created in advance and passed in so that if an error occurs during posting,
    # there may be a list of partial attempts that can still be undone.  (If we had accumulated a full return value
    # it would be all-or-none even in the face of some postings having been done and others not. That would lead
    # to confusion in later tests. -kmp 10-Mar-2021
    undo_dict = {}
    try:
        posted = post_related_items_for_testing(testapp=testapp, item_dict=item_dict, undo_dict=undo_dict)
        yield posted
    finally:
        _carefully_patch_related_items_for_testing(testapp=testapp, item_dict=undo_dict)
