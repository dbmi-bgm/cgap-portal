import pytest

from dcicutils.misc_utils import ignored
from unittest import mock
from ..commands import load_data as load_data_module
from ..commands.load_data import load_data_should_proceed, main as load_data_main


def test_load_data_should_proceed():

    cgap_envs = ['fourfront-cgap', 'fourfront-cgapdev', 'fourfront-cgaptest', 'fourfront-cgapwolf',
                 'cgap-blue', 'cgap-green', 'cgap-dev', 'cgap-test', 'cgap-wolf']

    # This shows concisely what's going on...

    for cgap_env in cgap_envs:
        for allow_prod in [True, False]:
            expected = True if cgap_env == 'fourfront-cgaptest' else allow_prod
            assert load_data_should_proceed(cgap_env, allow_prod=allow_prod) == expected

    # This is redundant, doing it longhand for review...

    assert load_data_should_proceed('fourfront-cgap', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgap', allow_prod=False) is False

    assert load_data_should_proceed('fourfront-cgapdev', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgapdev', allow_prod=False) is False

    assert load_data_should_proceed('fourfront-cgaptest', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgaptest', allow_prod=False) is True

    assert load_data_should_proceed('fourfront-cgapwolf', allow_prod=True) is True
    assert load_data_should_proceed('fourfront-cgapwolf', allow_prod=False) is False

    assert load_data_should_proceed('cgap-blue', allow_prod=True) is True
    assert load_data_should_proceed('cgap-blue', allow_prod=False) is False

    assert load_data_should_proceed('cgap-green', allow_prod=True) is True
    assert load_data_should_proceed('cgap-green', allow_prod=False) is False

    assert load_data_should_proceed('cgap-dev', allow_prod=True) is True
    assert load_data_should_proceed('cgap-dev', allow_prod=False) is False

    assert load_data_should_proceed('cgap-test', allow_prod=True) is True
    assert load_data_should_proceed('cgap-test', allow_prod=False) is False

    assert load_data_should_proceed('cgap-wolf', allow_prod=True) is True
    assert load_data_should_proceed('cgap-wolf', allow_prod=False) is False


def test_load_data_main():

    with mock.patch.object(load_data_module, "get_app") as mock_get_app:
        with mock.patch.object(load_data_module, "configure_dbsession") as mock_configure_dbsession:
            ignored(mock_configure_dbsession)
            with mock.patch.object(load_data_module, "load_data_should_proceed") as mock_load_data_should_proceeed:

                class MockRegistry:
                    def __init__(self, loader, envname):
                        self.settings = {'env.name': envname, 'load_test_data': loader}

                class MockApp:
                    def __init__(self, loader, envname):
                        self.registry = MockRegistry(loader=loader, envname=envname)

                expect_overwrite = False

                class MockLoader:
                    LOAD_COUNT = 0

                    @classmethod
                    def load_test_data(cls, app, overwrite):
                        assert app == mocked_app  # forward reference - defined below
                        assert overwrite == expect_overwrite
                        cls.LOAD_COUNT += 1

                with mock.patch.object(load_data_module, "DottedNameResolver") as mock_dotted_name_resolver:

                    class MockDottedNameResolver:
                        """To mock DottedNameResolver().resolve('my.load_test_data) => MockLoader.load_test_data"""
                        def resolve(name):
                            assert name == 'my.load_test_data'
                            return MockLoader.load_test_data

                    mock_dotted_name_resolver.return_value = MockDottedNameResolver

                    mocked_app = MockApp(loader='my.load_test_data', envname='fourfront-anything')

                    expected_app_name = 'some-app-name'
                    expected_uri = 'some-config-uri'

                    def mocked_get_app(uri, app_name):
                        assert uri == expected_uri
                        assert app_name == expected_app_name
                        return mocked_app

                    mock_get_app.side_effect = mocked_get_app

                    count = MockLoader.LOAD_COUNT
                    mock_load_data_should_proceeed.return_value = False
                    load_data_main(['some-config-uri', '--app-name', 'some-app-name'])
                    assert MockLoader.LOAD_COUNT == count  # We expect it not to be called

                    count = MockLoader.LOAD_COUNT
                    mock_load_data_should_proceeed.return_value = True
                    load_data_main(['some-config-uri', '--app-name', 'some-app-name'])
                    assert MockLoader.LOAD_COUNT == count + 1 # We expect it to be called

                    expect_overwrite = True

                    count = MockLoader.LOAD_COUNT
                    mock_load_data_should_proceeed.return_value = False
                    load_data_main(['some-config-uri', '--app-name', 'some-app-name', '--overwrite'])
                    assert MockLoader.LOAD_COUNT == count  # We expect it not to be called

                    count = MockLoader.LOAD_COUNT
                    mock_load_data_should_proceeed.return_value = True
                    load_data_main(['some-config-uri', '--app-name', 'some-app-name', '--overwrite'])
                    assert MockLoader.LOAD_COUNT == count + 1 # We expect it to be called

                    with pytest.raises(SystemExit):
                        load_data_main([])  # Missing required positional argument

                    with pytest.raises(SystemExit):
                        load_data_main(['--app-name', 'some-app-name'])  # Still missing required positional argument

                    # Missing value of --app-name argument will default to None
                    expected_app_name = None
                    expect_overwrite = False

                    load_data_main(['some-config-uri'])  # Missing --app-name argument pair
                    with pytest.raises(SystemExit):
                        load_data_main(['some-config-uri', '--app-name'])  # Missing --app-name value

                    expect_overwrite = True
                    load_data_main(['some-config-uri', '--overwrite'])  # Missing --app-name argument pair
                    with pytest.raises(SystemExit):
                        load_data_main(['some-config-uri', '--overwrite', '--app-name'])  # Missing --app-name value
                    with pytest.raises(SystemExit):
                        load_data_main(['some-config-uri', '--app-name', '--overwrite'])  # Missing --app-name value
