import pytest

from ..commands.clear_db_es_contents import (
    clear_db_tables,
    run_clear_db_es
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


def test_run_clear_db_envs(app, testapp):
    assert run_clear_db_es(app, None, True) is True
    prev_env = app.registry.settings.get('env.name')

    post_res = testapp.post_json('/testing-post-put-patch/', {'required': 'abc'},
                                 status=201)
    testapp.get(post_res.location, status=200)

    # should never run on this env
    app.registry.settings['env.name'] = 'cgap-devtest'
    assert run_clear_db_es(app, None, True) is False  # still false since cgap-devtest is a "prod" env
    testapp.get(post_res.location, status=200)

    # test if we are only running on specific envs
    app.registry.settings['env.name'] = 'fourfront-test-env'
    assert run_clear_db_es(app, 'fourfront-other-env', True) is False
    testapp.get(post_res.location, status=200)
    assert run_clear_db_es(app, 'fourfront-test-env', True) is True
    testapp.get(post_res.location, status=404)

    # reset settings after test
    if prev_env is None:
        del app.registry.settings['env.name']
    else:
        app.registry.settings['env.name'] = prev_env
