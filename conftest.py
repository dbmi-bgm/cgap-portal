import os
import pytest
import tempfile

from dcicutils.env_utils import EnvUtils
from dcicutils.misc_utils import PRINT, override_environ


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


PRINT("=" * 80)
PRINT("Configuring environment variables...")

my_selected_account = os.environ.get("ACCOUNT_NUMBER")

my_selected_env = os.environ.get("ENV_NAME")

if not my_selected_account or my_selected_account == "643366669028":
    PRINT("The legacy account can no longer be used for testing cgap-portal.")
    exit(1)

os.environ['BS_ENV'] = os.environ['ENCODED_BS_ENV'] = os.environ['ENV_NAME'] = 'cgap-devtest'
os.environ['IDENTITY'] = 'C4DatastoreCgapDevtestApplicationConfiguration'

EnvUtils.init(force=True, ecosystem='main')

env_name = f'cgap-testing-{os.environ.get("USER", "testuser")}'
es_namespace = env_name

os.environ['ENCODED_BS_ENV'] = os.environ['BS_ENV'] = env_name
os.environ['ENCODED_ENV_NAME'] = os.environ['ENV_NAME'] = env_name
os.environ['ENCODED_ES_NAMESPACE'] = os.environ['ES_NAMESPACE'] = es_namespace

PRINT("=" * 80)


@pytest.yield_fixture(scope='session', autouse=True)
def bind_env_names():
    with override_environ(ENCODED_BS_ENV=env_name, BS_ENV=env_name, ENCODED_ENV_NAME=env_name, ENV_NAME=env_name,
                          ENCODED_ES_NAMESPACE=es_namespace, ES_NAMESPACE=es_namespace):
        yield
        for env_var in ['ENCODED_BS_ENV', 'BS_ENV', 'ENCODED_ENV_NAME', 'ENV_NAME']:
            assert os.environ.get(env_var) == env_name
        for env_var in ['ENCODED_ES_NAMESPACE', 'ES_NAMESPACE']:
            assert os.environ.get(env_var) == es_namespace
