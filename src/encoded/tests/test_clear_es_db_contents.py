import contextlib
import pytest

from unittest import mock
from ..commands import clear_db_es_contents as clear_db_es_contents_module
from ..commands.clear_db_es_contents import (
    clear_db_tables,
    run_clear_db_es,
    main as clear_db_es_contents_main
)


pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.indexing]


def test_clear_db_tables(app, testapp):
    # post an item and make sure it's there
    post_res = testapp.post_json('/testing-post-put-patch/', {'required': 'abc'},
                                 status=201)
    testapp.get(post_res.location, status=200)
    clear_res = clear_db_tables(app)
    assert clear_res is True
    # item should no longer be present
    testapp.get(post_res.location, status=404)


@pytest.mark.integratedx
def test_run_clear_db_es_integrated(app, testapp):

    # It works positionally
    assert run_clear_db_es(app, None, True) is True
    # It works by keyword argument
    assert run_clear_db_es(app, only_envs=None, skip_es=True) is True

    prev_env = app.registry.settings.get('env.name')

    try:

        post_res = testapp.post_json('/testing-post-put-patch/', {'required': 'abc'}, status=201)
        testapp.get(post_res.location, status=200)

        # should never run on this env
        app.registry.settings['env.name'] = 'fourfront-cgap'
        assert run_clear_db_es(app, only_envs=None, skip_es=True) is False
        testapp.get(post_res.location, status=200)

        # test if we are only running on specific envs
        app.registry.settings['env.name'] = 'fourfront-test-env'
        assert run_clear_db_es(app, only_envs=['fourfront-other-env'], skip_es=True) is False
        testapp.get(post_res.location, status=200)
        assert run_clear_db_es(app, only_envs=['fourfront-test-env'], skip_es=True) is True
        testapp.get(post_res.location, status=404)

    finally:

        # reset settings after test
        if prev_env is None:
            del app.registry.settings['env.name']
        else:
            app.registry.settings['env.name'] = prev_env


@contextlib.contextmanager
def local_env_name_registry_setting_for_testing(app, envname):
    old_env = app.registry.settings.get('env.name')
    print(f"Remembering old env.name = {old_env}")
    try:
        app.registry.settings['env.name'] = envname
        print(f"Set env.name = {envname}")
        yield
    finally:
        if old_env is None:
            print(f"Removing env.name")
            del app.registry.settings['env.name']
        else:
            print(f"Restoring env.name to {old_env}")
            app.registry.settings['env.name'] = old_env


@pytest.mark.unit
def test_run_clear_db_es_unit(app, testapp):

    def mocked_is_stg_or_prd_env(env):
        result = env.endswith("blue") or env.endswith("green") or env.endswith("cgap")
        print(f"Mocked is_stg_or_prd_env({env}) returning {result}.")
        return result

    with mock.patch.object(clear_db_es_contents_module, "is_stg_or_prd_env") as mock_is_stg_or_prd_env:
        mock_is_stg_or_prd_env.side_effect = mocked_is_stg_or_prd_env
        with mock.patch.object(clear_db_es_contents_module, "clear_db_tables") as mock_clear_db_tables:
            with mock.patch.object(clear_db_es_contents_module, "run_create_mapping") as mock_run_create_mapping:

                expected_db_clears = 0
                expected_es_clears = 0

                assert mock_clear_db_tables.call_count == expected_db_clears
                assert mock_run_create_mapping.call_count == expected_es_clears

                # It works positionally
                assert run_clear_db_es(app, None, True) is True
                expected_db_clears += 1
                expected_es_clears += 0

                assert mock_clear_db_tables.call_count == expected_db_clears
                assert mock_run_create_mapping.call_count == expected_es_clears

                # It works by keyword argument
                assert run_clear_db_es(app, only_envs=None, skip_es=True) is True
                expected_db_clears += 1
                expected_es_clears += 0

                assert mock_clear_db_tables.call_count == expected_db_clears
                assert mock_run_create_mapping.call_count == expected_es_clears

                with local_env_name_registry_setting_for_testing(app, 'fourfront-cgap'):
                    # should never run on this env
                    assert clear_db_es_contents_module.is_stg_or_prd_env('fourfront-cgap') is True
                    assert run_clear_db_es(app, only_envs=None, skip_es=True) is False
                    expected_db_clears += 0
                    expected_es_clears += 0
                    assert mock_clear_db_tables.call_count == expected_db_clears
                    assert mock_run_create_mapping.call_count == expected_es_clears

                with local_env_name_registry_setting_for_testing(app, 'fourfront-test-env'):

                    # test if we are only running on specific envs
                    assert run_clear_db_es(app, only_envs=['fourfront-other-env'], skip_es=True) is False
                    expected_db_clears += 0
                    expected_es_clears += 0
                    assert mock_clear_db_tables.call_count == expected_db_clears
                    assert mock_run_create_mapping.call_count == expected_es_clears

                    # test if we are only running on specific envs
                    assert run_clear_db_es(app, only_envs=['fourfront-other-env'], skip_es=False) is False
                    expected_db_clears += 0
                    expected_es_clears += 0
                    assert mock_clear_db_tables.call_count == expected_db_clears
                    assert mock_run_create_mapping.call_count == expected_es_clears

                    # test if we are only running on specific envs
                    assert run_clear_db_es(app, only_envs=['fourfront-test-env'], skip_es=True) is True
                    expected_db_clears += 1
                    expected_es_clears += 0
                    assert mock_clear_db_tables.call_count == expected_db_clears
                    assert mock_run_create_mapping.call_count == expected_es_clears

                    # test if we are only running on specific envs
                    assert run_clear_db_es(app, only_envs=['fourfront-test-env'], skip_es=False) is True
                    expected_db_clears += 1
                    expected_es_clears += 1
                    assert mock_clear_db_tables.call_count == expected_db_clears
                    assert mock_run_create_mapping.call_count == expected_es_clears


@pytest.mark.unit
def test_clear_db_es_contents_main():

    class FakeApp:

        def __init__(self, config_uri, appname):
            self.appname = appname
            self.config_uri = config_uri

        def __str__(self):
            return f"<FakeApp {self.appname} {self.config_uri} {id(self)}>"

        def __repr__(self):
            return str(self)

    class MockDBSession:

        def __init__(self, app):
            self.app = app

    apps = {}

    def mocked_get_app(config_uri, appname):
        key = (config_uri, appname)
        app = apps.get(key)
        if not app:
            apps[key] = app = FakeApp(config_uri, appname)
        return app

    def mocked_configure_dbsession(app):
        return MockDBSession(app)

    with mock.patch.object(clear_db_es_contents_module, "run_clear_db_es") as mock_run_clear_db_es:
        with mock.patch.object(clear_db_es_contents_module, "get_app") as mock_get_app:
            mock_get_app.side_effect = mocked_get_app
            with mock.patch.object(clear_db_es_contents_module, "configure_dbsession") as mock_configure_dbsession:
                mock_configure_dbsession.side_effect = mocked_configure_dbsession

                config_uri = 'production.ini'
                appname = "app"

                clear_db_es_contents_main([config_uri])
                mock_run_clear_db_es.assert_called_with(app=mocked_get_app(config_uri, None),
                                                        only_envs=[],
                                                        skip_es=False)

                clear_db_es_contents_main([config_uri, "--app-name", appname])
                mock_run_clear_db_es.assert_called_with(app=mocked_get_app(config_uri, appname),
                                                        only_envs=[],
                                                        skip_es=False)

                clear_db_es_contents_main([config_uri, "--app-name", appname, '--skip-es'])
                mock_run_clear_db_es.assert_called_with(app=mocked_get_app(config_uri, appname),
                                                        only_envs=[],
                                                        skip_es=True)

                clear_db_es_contents_main([config_uri, "--app-name", appname, "--only-if-env", "cgap-devtest"])
                mock_run_clear_db_es.assert_called_with(app=mocked_get_app(config_uri, appname),
                                                        only_envs=['cgap-devtest'],
                                                        skip_es=False)

                clear_db_es_contents_main([config_uri, "--app-name", appname, "--only-if-env", "cgap-devtest,cgap-foo"])
                mock_run_clear_db_es.assert_called_with(app=mocked_get_app(config_uri, appname),
                                                        only_envs=['cgap-devtest', 'cgap-foo'],
                                                        skip_es=False)
