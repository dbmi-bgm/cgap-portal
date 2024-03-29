import pytest

from dcicutils.qa_utils import notice_pytest_fixtures
from .helpers import workbook_lookup


pytestmark = [pytest.mark.working, pytest.mark.workbook]


def wait_for_index(testapp):
    testapp.post_json("/index", {"record": False})


@pytest.fixture
def static_help_page_default():
    return workbook_lookup(item_type='Page', name='help/user-guide/rest-api')


def test_static_help_page_default(static_help_page_default):
    assert static_help_page_default['name'] == 'help/user-guide/rest-api'


@pytest.fixture
def static_help_page_in_review():
    return workbook_lookup(item_type='Page', name='help/user-guide/rest-api-in-review')


@pytest.fixture
def static_help_page_deleted():
    return workbook_lookup(item_type='Page', name='help/user-guide/rest-api-deleted')


def test_get_help_page(workbook, es_testapp, static_help_page_default):
    help_page_url = '/' + static_help_page_default['name']
    res = es_testapp.get(help_page_url, status=200)
    assert res.json['@id'] == help_page_url
    assert res.json['@context'] == help_page_url
    assert 'HelpPage' in res.json['@type']
    assert 'StaticPage' in res.json['@type']
    # assert res.json['content'] == help_page['content'] # No longer works latter is set to an @id of static_section
    # Instead lets check what we have embedded on GET request is inside our doc file (rest_api_submission.md).
    assert 'Accession and uuid are automatically assigned during initial posting' in res.json['content'][0]['content']
    assert res.json['toc'] == static_help_page_default['table-of-contents']


@pytest.mark.skip
def test_get_help_page_in_review(workbook, anon_html_es_testapp, html_es_testapp, static_help_page_in_review):
    help_page_url = '/' + static_help_page_in_review['name']
    anon_html_es_testapp.get(help_page_url, status=403)
    html_es_testapp.get(help_page_url, status=200)


@pytest.mark.skip
@pytest.mark.broken
def test_get_help_page_deleted(workbook, anon_html_es_testapp, html_es_testapp, static_help_page_deleted):
    help_page_url = '/' + static_help_page_deleted['name']
    anon_html_es_testapp.get(help_page_url, status=403)
    # The page is still in DB (and accessible by admins at its URL) but has status=deleted (so we get back status=200)
    # Might be worth considering making it 404 for both admins & non-admins
    # and then also ensuring is not accessible aside by its named path, only from by `/pages/<uuid>`?
    html_es_testapp.get(help_page_url, status=200)


@pytest.mark.skip
@pytest.mark.broken
def test_get_help_page_no_access(workbook, anon_es_testapp, es_testapp, anon_html_es_testapp, html_es_testapp,
                                 static_help_page_default, static_help_page_in_review, static_help_page_deleted):
    notice_pytest_fixtures(workbook)
    success = True
    for app_name, testapp, role in [("anon_es", anon_es_testapp, 'anon'),
                                    ("es", es_testapp, 'system'),
                                    ("anon_html_es", anon_html_es_testapp, 'anon'),
                                    ("html_es", html_es_testapp, 'system')]:
        for help_page, is_public in [(static_help_page_default, False),
                                     (static_help_page_in_review, False),
                                     (static_help_page_deleted, False)]:
            expected_code = 200 if is_public else (403 if role == 'anon' else 200)
            page_name = help_page['name']
            help_page_url = "/" + page_name
            res = testapp.get(help_page_url, status=(200, 301, 403, 404)).maybe_follow()
            actual_code = res.status_code
            if actual_code == expected_code:
                print("%s => %s: SUCCESS (%s)" % (app_name, page_name, actual_code))
            else:
                print("%s => %s: FAILED (%s, not %s): %s..."
                      % (app_name, page_name, actual_code, expected_code, res.body[:20]))
                success = False
    assert success, "Test failed."


def check_page_unique_name(testapp, conflicting_page, page_to_patch):
    # POST again with same name and expect validation error
    conflicting_document = {'name': conflicting_page['name']}
    conflict_message = "%s already exists with name '%s'" % (conflicting_page['uuid'], conflicting_page['name'])

    def check_conflict(res):
        actual_error_description = res.json['errors'][0]['description']
        print("expected:", conflict_message)
        print("actual:", actual_error_description)
        assert conflict_message in actual_error_description

    # Test that POST of a new page with the same name as an existing page is not allowed.
    check_conflict(testapp.post_json('/page', conflicting_document, status=422))
    # Also test PATCH of an existing page with the same name as another existing page is not allowed.
    page_to_patch_uuid_url = '/' + page_to_patch['uuid']
    check_conflict(testapp.patch_json(page_to_patch_uuid_url, conflicting_document, status=422))
    actual_page_to_patch = testapp.get(page_to_patch_uuid_url).maybe_follow().json
    check_conflict(testapp.patch_json(actual_page_to_patch['@id'], conflicting_document, status=422))


def test_page_unique_name(workbook, es_testapp, static_help_page_in_review, static_help_page_default):
    check_page_unique_name(testapp=es_testapp,
                           conflicting_page=static_help_page_default,
                           page_to_patch=static_help_page_in_review)


def test_page_unique_name_deleted(workbook, es_testapp, static_help_page_in_review, static_help_page_deleted):
    check_page_unique_name(testapp=es_testapp,
                           conflicting_page=static_help_page_deleted,
                           page_to_patch=static_help_page_in_review)
