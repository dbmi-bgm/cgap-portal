import os
import pytest
import tempfile

from dcicutils.misc_utils import PRINT


def pytest_addoption(parser):
    parser.addoption("--es", action="store", default="", dest='es',
        help="use a remote es for testing")
    parser.addoption("--aws-auth", action="store_true",
        help="connect using aws authorization")


@pytest.fixture(scope='session')
def remote_es(request):
    return request.config.getoption("--es")


@pytest.fixture(scope='session')
def aws_auth(request):
    return request.config.getoption("--aws-auth")


def pytest_configure():
    # This adjustment is important to set the default choice of temporary filenames to a nice short name
    # because without it some of the filenames we generate end up being too long, and critical functionality
    # ends up failing. Some socket-related filenames, for example, seem to have length limits. -kmp 5-Jun-2020
    tempfile.tempdir = '/tmp'


my_selected_account = os.environ.get("ACCOUNT_NUMBER")

if not my_selected_account or my_selected_account == "643366669028":
    PRINT("The legacy account can no longer be used for testing cgap-portal.")
    exit(1)

desired_env = 'cgap-devtest'

my_selected_env = os.environ.get("ENV_NAME")
# TODO: Maybe make this test programmable in env_utils sometime. -kmp 21-Jul-2022
if not my_selected_env:
    print("ENV_NAME was not set. It is being set to ")
    os.environ['ENV_NAME'] = desired_env
elif my_selected_env != desired_env:
    PRINT(f"ENV_NAME must be set to {desired_env} (or left unset) for testing. (It is set to {my_selected_env}.)")
    exit(1)

old_identity = os.environ.get("IDENTITY")
new_identity = 'C4DatastoreCgapDevtestApplicationConfiguration'
if old_identity and old_identity != new_identity:
    PRINT(f"IDENTITY is set incompatibly for ENV_NAME={desired_env}.")
    exit(1)

my_aws_access_key_id = os.environ.get("AWS_ACCESS_KEY_ID")

if my_aws_access_key_id.startswith("ASIA"):
    # When short-term federated credentials are in play, need to set up for assuming identity
    PRINT(f"Because you have short-term credentials ({my_aws_access_key_id}),"
          f" the IDENTITY environment variable is being set to {new_identity} so you can assume its credentials.")
    os.environ['IDENTITY'] = new_identity
