import gzip
import json
import pytest

from pkg_resources import resource_filename
from tempfile import NamedTemporaryFile
from unittest import mock
from .. import loadxl
from ..commands.run_upgrader_on_inserts import get_inserts
from ..commands.load_data import load_data_should_proceed


pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_load_data_endpoint(testapp):
    data = {'fdn_dir': 'master-inserts',
            'itype': ['project', 'institution', 'user']}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=200)
        assert res.json['status'] == 'success'


def test_load_data_endpoint_returns_error_if_incorrect_keyword(testapp):
    data = {'mdn_dir': 'master-inserts',
            'itype': ['user']}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=422)
        assert res.json['status'] == 'error'
        assert res.json['@graph']


def test_load_data_endpoint_returns_error_if_incorrect_data(testapp):
    data = {'fdn_dir': 'master-inserts',
            'itype': ['user']}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=422)
        assert res.json['status'] == 'error'
        assert res.json['@graph']


def test_load_data_user_specified_config(testapp):
    data = {'fdn_dir': 'master-inserts',
            'itype': ['user', 'institution', 'project']}
    config_uri = 'test.ini'
    data['config_uri'] = config_uri
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=200)
        assert res.json['status'] == 'success'
        mocked_app.assert_called_once_with(config_uri, 'app')


def test_load_data_local_dir(testapp):
    expected_dir = resource_filename('encoded', 'tests/data/perf-testing/')
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        with mock.patch.object(loadxl, 'load_all') as load_all:
            mocked_app.return_value = testapp.app
            load_all.return_value = None
            res = testapp.post_json('/load_data', {'fdn_dir': 'perf-testing'}, status=200)
            assert res.json['status'] == 'success'
            load_all.assert_called_once_with(mock.ANY, expected_dir, None, itype=None, overwrite=False, from_json=False)


def test_load_data_from_json(testapp):
    user_inserts = list(get_inserts('master-inserts', 'user'))
    institution_inserts = list(get_inserts('master-inserts', 'institution'))
    project_inserts = list(get_inserts('master-inserts', 'project'))
    data = {'store': {'user': user_inserts, 'institution': institution_inserts, 'project': project_inserts},
            'itype': ['user', 'institution', 'project']}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=200)
        assert res.json['status'] == 'success'


def test_load_data_local_path(testapp):
    local_path = resource_filename('encoded', 'tests/data/master-inserts/')
    data = {'local_path': local_path, 'itype': ['user', 'institution', 'project']}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=200)
        assert res.json['status'] == 'success'


def test_load_data_iter_response(testapp):
    """
    Use iter_response=True in the request json to return a Pyramid Response
    that leverages app.iter. The output here will be directly from the
    generator
    """
    user_inserts = list(get_inserts('master-inserts', 'user'))
    institution_inserts = list(get_inserts('master-inserts', 'institution'))
    project_inserts = list(get_inserts('master-inserts', 'project'))
    # the total number of items we expect
    expected = len(user_inserts) + len(institution_inserts) + len(project_inserts)
    data = {'store': {'user': user_inserts, 'institution': institution_inserts, 'project': project_inserts},
            'itype': ['user', 'institution', 'project'], 'iter_response': True}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=200)
        assert res.content_type == 'text/plain'
        # this is number of successfully POSTed items
        assert res.text.count('POST:') == expected
        # this is number of successfully PATCHed items
        assert res.text.count('PATCH:') == expected
        # this is the number of items that were skipped completely
        assert res.text.count('SKIP:') == 0
        assert res.text.count('ERROR:') == 0


def test_load_data_iter_response_fail(testapp):
    """
    Use iter_response=True in the request json to return a Pyramid Response
    that leverages app.iter. The output here will be directly from the
    generator
    For this test, expect a validation error because we use incomplete data
    """
    user_inserts = list(get_inserts('master-inserts', 'user'))
    # the total number of items we expect
    expected = len(user_inserts)
    data = {'store': {'user': user_inserts}, 'itype': ['user'], 'iter_response': True}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        res = testapp.post_json('/load_data', data, status=200)
        assert res.content_type == 'text/plain'
        # this is number of successfully POSTed items
        assert res.text.count('POST:') == expected
        # no users should be successfully PATCHed due to missing links
        assert res.text.count('PATCH:') == 0
        assert res.text.count('SKIP:') == 0
        # one exception should be encountered
        assert res.text.count('ERROR:') == 1
        assert 'Bad response: 422 Unprocessable Entity' in res.text


def test_load_all_gen(testapp):
    """
    The load_all_gen generator is pretty thoroughly tested by the other
    tests here, but let's test it a bit more explicitly
    """
    user_inserts = list(get_inserts('master-inserts', 'user'))
    institution_inserts = list(get_inserts('master-inserts', 'institution'))
    project_inserts = list(get_inserts('master-inserts', 'project'))
    # the total number of items we expect
    expected = len(user_inserts) + len(institution_inserts) + len(project_inserts)
    data = {'store': {'user': user_inserts, 'institution': institution_inserts, 'project': project_inserts},
            'itype': ['user', 'institution', 'project']}
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        # successful load items
        gen1 = loadxl.load_all_gen(testapp, data['store'], None,
                                   itype=data['itype'], from_json=True)
        res1 = b''.join([v for v in gen1]).decode()
        assert res1.count('POST:') == expected
        assert res1.count('PATCH:') == expected
        assert res1.count('SKIP:') == 0
        assert res1.count('ERROR:') == 0
        # do the same with LoadGenWrapper
        # items should be SKIP instead of POST, since they were already POSTed
        gen2 = loadxl.load_all_gen(testapp, data['store'], None,
                                   itype=data['itype'], from_json=True)
        catch2 = loadxl.LoadGenWrapper(gen=gen2)
        res2 = b''.join([v for v in catch2]).decode()
        assert catch2.caught is None  # no Exception hit
        assert res2.count('POST:') == 0
        assert res2.count('PATCH:') == expected
        assert res2.count('SKIP:') == expected
        assert res1.count('ERROR:') == 0
        # now handle error cases, both with using LoadGenWrapper and without
        # let's use an bad directory path to cause Exception
        bad_dir = resource_filename('encoded', 'tests/data/not-a-fdn-dir/')
        gen3 = loadxl.load_all_gen(testapp, bad_dir, None)
        res3 = b''.join([v for v in gen3]).decode()
        assert res3.count('POST:') == 0
        assert res3.count('PATCH:') == 0
        assert res3.count('SKIP:') == 0
        assert res3.count('ERROR:') == 1
        assert 'Failure loading inserts' in res3
        # the LoadGenWrapper will give use access to the Exception
        gen4 = loadxl.load_all_gen(testapp, bad_dir, None)
        catch4 = loadxl.LoadGenWrapper(gen=gen4)
        res4 = b''.join([v for v in catch4]).decode()
        assert res4.count('POST:') == 0
        assert res4.count('PATCH:') == 0
        assert res4.count('SKIP:') == 0
        assert res4.count('ERROR:') == 1
        assert 'Failure loading inserts' in res4
        assert isinstance(catch4.caught, str)
        assert 'Failure loading inserts' in catch4.caught


def test_legacy_load_data_should_proceed():
    """
    Tests that load_data_should_proceed does the right thing in various environment scenarios.
    We wire in specific names here because these are how the legacy environment is defined.
    In the future, we'll do this declaratively, so the variables we used to use don't matter
    because the names won't be wired into the functions.
    """
    assert load_data_should_proceed('fourfront-cgaptest', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgaptest', allow_prod=False) is True

    assert load_data_should_proceed('fourfront-cgapwolf', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgapwolf', allow_prod=False) is False

    assert load_data_should_proceed('fourfront-cgapdev', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgapdev', allow_prod=False) is False

    # XXX: Do we really want [a True result from the next expression]? -Will 6/5/20
    #  I think we do, because the argument allow_prod is the result of an explicit --prod,
    #  which is supposed to authorize it to happen. If we don't trust that argument,
    #  we should remove it. I added the keyword argname to help make that clearer. -kmp 4-Oct-2021
    assert load_data_should_proceed('fourfront-cgap', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgap', allow_prod=False) is False


def test_get_json_file_content():
    """Test loading of objects from (compressed) json file."""
    dummy_dict = {"a_key": "a_value"}
    dummy_json_bytes = json.dumps(dummy_dict).encode("utf-8")
    with NamedTemporaryFile(suffix=".json") as tmp:
        tmp.write(dummy_json_bytes)
        tmp.seek(0)
        assert loadxl.get_json_file_content(tmp.name) == dummy_dict
    with NamedTemporaryFile(suffix=".json.gz") as tmp:
        tmp.write(gzip.compress(dummy_json_bytes))
        tmp.seek(0)
        assert loadxl.get_json_file_content(tmp.name) == dummy_dict
    with NamedTemporaryFile() as tmp:  # File path ending not acceptable
        tmp.write(dummy_json_bytes)
        tmp.seek(0)
        with pytest.raises(Exception):
            loadxl.get_json_file_content(tmp.name)
