import io
import json
import pkg_resources
import pytest

from dcicutils.misc_utils import find_association
from dcicutils.qa_utils import notice_pytest_fixtures


pytestmark = [pytest.mark.working]


def workbook_lookup(item_type, **attributes):
    return any_inserts_lookup('workbook-inserts', item_type=item_type, **attributes)


def any_inserts_lookup(inserts_directory_name, item_type, **attributes):
    item_filename = pkg_resources.resource_filename('encoded', 'tests/data/' + inserts_directory_name
                                                    + "/" + item_type.lower() + ".json")
    with io.open(item_filename) as fp:
        data = json.load(fp)
        return find_association(data, **attributes)


def wait_for_index(testapp):
    testapp.post_json("/index", {"record": False})


@pytest.fixture
def posted_help_page_default():  # (workbook, es_testapp):
    return workbook_lookup(item_type='Page', name='help/user-guide/rest-api')


def test_posted_help_page_default(posted_help_page_default):
    return posted_help_page_default['name'] == 'foo'


@pytest.fixture
def posted_help_page_in_review():  # (workbook, es_testapp):
    return workbook_lookup(item_type='Page', name='help/user-guide/rest-api-in-review')


@pytest.fixture
def posted_help_page_deleted():  # (workbook, es_testapp):
    return workbook_lookup(item_type='Page', name='help/user-guide/rest-api-deleted')


def test_get_help_page(workbook, es_testapp, posted_help_page_default):
    wait_for_index(es_testapp)
    help_page_url = "/" + posted_help_page_default['name']
    res = es_testapp.get(help_page_url, status=200)
    assert res.json['@id'] == help_page_url
    assert res.json['@context'] == help_page_url
    assert 'HelpPage' in res.json['@type']
    assert 'StaticPage' in res.json['@type']
    # assert res.json['content'] == help_page['content'] # No longer works latter is set to an @id of static_section
    # Instead lets check what we have embedded on GET request is inside our doc file (rest_api_submission.md).
    assert 'Accession and uuid are automatically assigned during initial posting' in res.json['content'][0]['content']
    assert res.json['toc'] == posted_help_page_default['table-of-contents']


def test_get_help_page_in_review(workbook, anon_html_es_testapp, html_es_testapp, posted_help_page_in_review):
    wait_for_index(html_es_testapp)
    help_page_url = "/" + posted_help_page_in_review['name']
    anon_html_es_testapp.get(help_page_url, status=403)
    html_es_testapp.get(help_page_url, status=200)


def test_get_help_page_deleted(workbook, anon_html_es_testapp, html_es_testapp, posted_help_page_deleted):
    wait_for_index(html_es_testapp)
    help_page_url = "/" + posted_help_page_deleted['name']
    anon_html_es_testapp.get(help_page_url, status=403)
    html_es_testapp.get(help_page_url, status=200)  # Why 200 and not 404? -kmp 23-Feb-2021


def test_get_help_page_no_access(workbook, anon_es_testapp, es_testapp, anon_html_es_testapp, html_es_testapp,
                                 posted_help_page_default, posted_help_page_in_review, posted_help_page_deleted):
    notice_pytest_fixtures(workbook)
    wait_for_index(es_testapp)
    success = True
    for app_name, testapp, role in [("anon_es", anon_es_testapp, 'anon'),
                                    ("es", es_testapp, 'system'),
                                    ("anon_html_es", anon_html_es_testapp, 'anon'),
                                    ("html_es", html_es_testapp, 'system')]:
        for help_page, is_public in [(posted_help_page_default, False),
                                     (posted_help_page_in_review, False),
                                     (posted_help_page_deleted, False)]:
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
    wait_for_index(testapp)
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


def test_page_unique_name(workbook, es_testapp, posted_help_page_in_review, posted_help_page_default):
    check_page_unique_name(testapp=es_testapp,
                           conflicting_page=posted_help_page_default,
                           page_to_patch=posted_help_page_in_review)


def test_page_unique_name_deleted(workbook, es_testapp, posted_help_page_in_review, posted_help_page_deleted):
    check_page_unique_name(testapp=es_testapp,
                           conflicting_page=posted_help_page_deleted,
                           page_to_patch=posted_help_page_in_review)
