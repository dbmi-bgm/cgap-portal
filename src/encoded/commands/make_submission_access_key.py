import argparse
import functools
import json
import os

from dcicutils.misc_utils import PRINT, full_class_name, check_true
from snovault.standalone_dev import make_dev_vapp

EPILOG = __doc__


# TODO: Move to dcicutils
def optionally(fn):
    @functools.wraps(fn)
    def _wrapped_fn(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            return e
    return _wrapped_fn


LOCAL_DEV_ENV_NAME = 'fourfront-cgaplocal'


def run(*, email, authorizing_agent=None, update=False):
    check_true(email, "A non-null email must be given.")
    check_true('@' in email, "Email address missing '@'.")
    vapp = make_dev_vapp(remote_user=authorizing_agent or email)
    me_result = vapp.get("/me", status=307).json
    PRINT("Recognized as user:", me_result['email'])
    result = vapp.post_json('/access-keys', {'user': email}, status=201).json
    access_key_id = result['access_key_id']
    secret_access_key = result['secret_access_key']
    if not update:
        PRINT("Allocated access_key_id, secret_access_key for %s: %s, %s" % (email, access_key_id, secret_access_key))
    else:
        keyfile = os.path.expanduser("~/.cgap-keys.json")
        backupfile = keyfile + ".BAK"
        try:
            with open(keyfile, 'r') as old_keys_fp:
                keys = json.load(old_keys_fp)
        except FileNotFoundError:
            keys = {}
        keys[LOCAL_DEV_ENV_NAME]['key'] = access_key_id
        keys[LOCAL_DEV_ENV_NAME]['secret'] = secret_access_key
        optionally(os.remove)(backupfile)
        saved = optionally(os.rename)(keyfile, backupfile)
        optionally(os.chmod)(backupfile, 0o600)
        with open(keyfile, 'w') as new_keys_fp:
            json.dump(keys, new_keys_fp, indent=4)
        os.chmod(keyfile, 0o600)
        PRINT("Allocated access keys for %s." % email)
        extra = " (Old file saved as: %s)" % backupfile if not isinstance(saved, Exception) else ""
        PRINT("Wrote: %s%s" % (keyfile, extra))


def main():
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is specified wrong here.
        description="Configure Kibana Index", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('email', help='An email address to get access keys for')
    # I don't know a case where this actually ends up being useful, since anyone can allocate their own access keys.
    # But I put it here just in case to illustrate how it would work. -kmp 29-Mar-2021
    # parser.add_argument('--authorizing-agent', help='Whose account to authorize this (not usually needed)')
    parser.add_argument("--update", help='Whether to update ~/.cgap-keys.json', action='store_true')
    args = parser.parse_args()

    try:
        run(email=args.email,
            # authorizing_agent=args.authorizing_agent,
            update=args.update)
        exit(0)
    except Exception as e:
        PRINT("FAILED (%s): %s" % (full_class_name(e), e))
        exit(1)


if __name__ == '__main__':

    main()
