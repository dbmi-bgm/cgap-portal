import datetime
import os
import pytest
import re
import subprocess

from contextlib import contextmanager
from io import StringIO
from unittest import mock

from .. import generate_production_ini
from ..generate_production_ini import (
    TEMPLATE_DIR,
    build_ini_file_from_template,
    build_ini_stream_from_template,
    environment_template_filename,
    template_environment_names,
    get_local_git_version,
    get_eb_bundled_version,
    get_version
)


@contextmanager
def override_environ(**overrides):
    to_delete = []
    to_restore = {}
    env = os.environ
    try:
        for k, v in overrides.items():
            if k in env:
                to_restore[k] = env[k]
            else:
                to_delete.append(k)
            env[k] = v
        yield
    finally:
        for k in to_delete:
            del os.environ[k]
        for k, v in to_restore.items():
            os.environ[k] = v

def test_environment_template_filename():

    with pytest.raises(ValueError):
        environment_template_filename('foo')

    actual = os.path.abspath(environment_template_filename('cgapdev'))

    assert actual.endswith("/ini_files/cgapdev.ini")
    assert os.path.exists(actual)

    assert environment_template_filename('cgapdev') == environment_template_filename('fourfront-cgapdev')


def test_template_environment_names():

    names = template_environment_names()

    required_names = ['cgap', 'cgapdev', 'cgaptest', 'cgapwolf']

    for required_name in required_names:
        assert required_name in names


def test_build_ini_file_from_template():
    # NOTE: This implicitly also tests build_ini_file_from_stream.

    lines = []
    some_template_file_name = "mydir/whatever"
    some_ini_file_name = "mydir/production.ini"
    some_source_bundle = '/some/source/bundle'
    output_string_stream = StringIO()
    env_vars = dict(RDS_DB_NAME='snow_white', RDS_USERNAME='user', RDS_PASSWORD='my-secret',
                    RDS_HOSTNAME='unittest', RDS_PORT="6543", EB_CONFIG_SOURCE_BUNDLE=some_source_bundle)

    with override_environ(**env_vars):

        for env_var in env_vars:
            assert env_var in os.environ and os.environ[env_var] == env_vars[env_var], (
                    "os.environ[%r] did not get added correctly" % env_var
            )

        class MockFileStream:
            def __init__(self, filename, mode):
                pass
            def __enter__(self):
                return output_string_stream
            def __exit__(self, type, value, traceback):
                lines.extend(output_string_stream.getvalue().strip().split('\n'))

        def mocked_open(filename, mode):
            # In this test there are two opens, one for read and one for write, so we discriminate on that basis.
            print("Enter mock_open", filename, mode)
            if mode == 'r':
                assert filename == some_template_file_name
                return StringIO(
                    '[Foo]\n'
                    'DATABASE = "${RDS_DB_NAME}"\n'
                    'SOME_URL = "http://${RDS_USERNAME}@$RDS_HOSTNAME:$RDS_PORT/"\n'
                    'OOPS = "$NOT_AN_ENV_VAR"\n'
                    'HMMM = "${NOT_AN_ENV_VAR_EITHER}"\n'
                    'SHHH = "$RDS_PASSWORD"\n'
                    'VERSION = "${SOURCE_VERSION}"'
                )
            else:
                assert mode == 'w'
                assert filename == some_ini_file_name
                return MockFileStream(filename, mode)

        with mock.patch("subprocess.check_output") as mock_check_output:
            def mocked_check_output(command):
                assert command == ['unzip', '-z', some_source_bundle]
                return b'v-1234-simulated'
            mock_check_output.side_effect = mocked_check_output
            with mock.patch("io.open", side_effect=mocked_open):
                build_ini_file_from_template(some_template_file_name, some_ini_file_name)

        assert lines == [
            '[Foo]',
            'DATABASE = "snow_white"',
            'SOME_URL = "http://user@unittest:6543/"',
            'OOPS = "$NOT_AN_ENV_VAR"',
            'HMMM = "${NOT_AN_ENV_VAR_EITHER}"',
            'SHHH = "my-secret"',
            # 'VERSION = "unknown-version-at-20000102030456000000"',
            'VERSION = "v-1234-simulated"',
        ]


MOCKED_SOURCE_BUNDLE = "/some/source/bundle"
MOCKED_BUNDLE_VERSION = 'v-12345-simulated'
MOCKED_LOCAL_GIT_VERSION = 'v-67890-simulated'


def make_mocked_check_output_for_get_version(simulate_git_command=True, simulate_git_repo=True):
    def mocked_check_output(command):
        if simulate_git_command and command[0] == 'git':
            assert command == ['git', 'describe', '--dirty']  # This is the only case we handle
            if simulate_git_repo:
                return b'v-67890-simulated\n'  # MOCKED_LOCAL_GIT_VERSION
            else:
                raise subprocess.CalledProcessError(returncode=1, cmd=command)
        else:
            raise FileNotFoundError("Simulated absence of 'git'.")
    return mocked_check_output


def test_get_version():

    with mock.patch('subprocess.check_output') as mock_check_output:

        with mock.patch("os.path.exists") as mock_exists:
            mock_exists.return_value = True
            with mock.patch("io.open") as mock_open:
                mock_open.return_value = StringIO('{"VersionLabel": "%s"}' % MOCKED_BUNDLE_VERSION)
                mock_check_output.side_effect = make_mocked_check_output_for_get_version()
                assert get_version() == MOCKED_BUNDLE_VERSION

        mock_check_output.side_effect = make_mocked_check_output_for_get_version()
        assert get_version() == MOCKED_LOCAL_GIT_VERSION

        # Simulate 'git' command not found.
        mock_check_output.side_effect = make_mocked_check_output_for_get_version(simulate_git_command=False)
        v = get_version()
        assert re.match("^unknown-version-at-[0-9]+$", v)

        assert not os.environ.get('EB_CONFIG_SOURCE_BUNDLE')
        # Simulate 'git' repo not found.
        mock_check_output.side_effect = make_mocked_check_output_for_get_version(simulate_git_repo=False)
        v = get_version()
        assert re.match("^unknown-version-at-[0-9]+$", v)


def test_get_local_git_version():

    with mock.patch('subprocess.check_output') as mock_check_output:

        mock_check_output.side_effect = make_mocked_check_output_for_get_version()
        assert get_local_git_version() == MOCKED_LOCAL_GIT_VERSION

        mock_check_output.side_effect = make_mocked_check_output_for_get_version(simulate_git_command=False)
        with pytest.raises(FileNotFoundError):
            get_local_git_version()

        mock_check_output.side_effect = make_mocked_check_output_for_get_version(simulate_git_repo=False)
        with pytest.raises(subprocess.CalledProcessError):
            get_local_git_version()


def test_get_eb_bundled_version():

    with mock.patch("os.path.exists") as mock_exists:
        mock_exists.return_value = True
        with mock.patch("io.open") as mock_open:
            mock_open.return_value = StringIO('{"VersionLabel": "%s"}' % MOCKED_BUNDLE_VERSION)
            assert get_eb_bundled_version() == MOCKED_BUNDLE_VERSION

    with mock.patch("os.path.exists") as mock_exists:
        mock_exists.return_value = False
        with mock.patch("io.open") as mock_open:
            def mocked_open_error(filename, mode='r'):
                raise Exception("Simulated file error (file not found or permissions problem).")
            mock_open.side_effect = mocked_open_error
            assert get_eb_bundled_version() is None
