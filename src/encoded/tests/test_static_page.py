import pytest
import webtest


pytestmark = [pytest.mark.working]


@pytest.fixture()  # (scope='session')
def help_page_section_json():
    return {
        "title": "",
        "name": "help.user-guide.rev-links.rev",
        "file": "/src/encoded/tests/data/documents/test-static-section.rst",
        "uuid": "442c8aa0-dc6c-43d7-814a-854af460c020"
    }


@pytest.fixture()  # (scope='session')
def help_page_json():
    return {
        "name": "help/user-guide/rev-links",
        "title": "Reverse Links",
        "content": ["442c8aa0-dc6c-43d7-814a-854af460c020"],
        "uuid": "a2aa8bb9-9dd9-4c80-bdb6-2349b7a3540d",
        "table-of-contents": {
            "enabled": True,
            "header-depth": 4,
            "list-styles": ["decimal", "lower-alpha", "lower-roman"]
        }
    }


@pytest.fixture()  # (scope='session')
def help_page_json_in_review():
    return {
        "name": "help/user-guide/rev-links-in-review",
        "title": "Reverse Links",
        "content": ["442c8aa0-dc6c-43d7-814a-854af460c020"],
        "uuid": "a2aa8bb9-9dd9-4c80-bdb6-2349b7a3540c",
        "table-of-contents": {
            "enabled": True,
            "header-depth": 4,
            "list-styles": ["decimal", "lower-alpha", "lower-roman"]
        },
        "status": "in review"
    }


@pytest.fixture()  # (scope='session')
def help_page_json_deleted():
    return {
        "name": "help/user-guide/rev-links-deleted",
        "title": "Reverse Links",
        "content": ["442c8aa0-dc6c-43d7-814a-854af460c020"],
        "uuid": "a2aa8bb9-9dd9-4c80-bdb6-2349b7a3540a",
        "table-of-contents": {
            "enabled": True,
            "header-depth": 4,
            "list-styles": ["decimal", "lower-alpha", "lower-roman"]
        },
        "status": "deleted"
    }


@pytest.fixture()  # ()
def posted_help_page_section(es_testapp, workbook, help_page_section_json):
    try:
        res = es_testapp.post_json('/static-sections/', help_page_section_json, status=201)
        val = res.json['@graph'][0]
    except webtest.AppError:
        res = es_testapp.get('/' + help_page_section_json['uuid'], status=301).follow()
        val = res.json
    return val


@pytest.fixture()
def help_page(es_testapp, workbook, posted_help_page_section, help_page_json):
    try:
        res = es_testapp.post_json('/pages/', help_page_json, status=201)
        val = res.json['@graph'][0]
    except webtest.AppError:
        res = es_testapp.get('/' + help_page_json['uuid'], status=301).follow()
        val = res.json
    return val


@pytest.fixture()
def help_page_deleted(es_testapp, workbook, posted_help_page_section, help_page_json_deleted):
    try:
        res = es_testapp.post_json('/pages/', help_page_json_deleted, status=201)
        val = res.json['@graph'][0]
    except webtest.AppError:
        res = es_testapp.get('/' + help_page_json_deleted['uuid'], status=301).follow()
        val = res.json
    return val


@pytest.fixture()
def help_page_in_review(es_testapp, workbook, posted_help_page_section, help_page_json_in_review):
    try:
        res = es_testapp.post_json('/pages/', help_page_json_in_review, status=201)
        val = res.json['@graph'][0]
    except webtest.AppError:
        res = es_testapp.get('/' + help_page_json_in_review['uuid'], status=301).follow()
        val = res.json
    return val


def test_get_help_page(es_testapp, workbook, help_page):
    help_page_url = "/" + help_page['name']
    res = es_testapp.get(help_page_url, status=200)
    assert res.json['@id'] == help_page_url
    assert res.json['@context'] == help_page_url
    assert 'HelpPage' in res.json['@type']
    assert 'StaticPage' in res.json['@type']
    # check what we have embedded on GET request is inside our doc file (test-static-section.rst).
    assert ('Reverse links\n============================\n\nReverse (rev) links are actually a pretty cool thing.'
            in res.json['content'][0]['content'])
    assert res.json['toc'] == help_page['table-of-contents']


def test_get_help_page_deleted(workbook, anon_html_es_testapp, help_page_deleted):
    help_page_url = "/" + help_page_deleted['name']
    anon_html_es_testapp.get(help_page_url, status=403)


def test_get_help_page_no_access(workbook, anon_html_es_testapp, es_testapp, help_page_in_review):
    help_page_url = "/" + help_page_in_review['name']
    anon_html_es_testapp.get(help_page_url, status=403)
    es_testapp.get(help_page_url, status=200)


def test_page_unique_name(workbook, es_testapp, help_page, help_page_deleted):
    # POST again with same name and expect validation error
    new_page = {'name': help_page['name']}
    res = es_testapp.post_json('/page', new_page, status=422)
    expected_val_err = "%s already exists with name '%s'" % (help_page['uuid'], new_page['name'])
    actual_error_description = res.json['errors'][0]['description']
    print("expected:", expected_val_err)
    print("actual:", actual_error_description)
    assert expected_val_err in actual_error_description

    # also test PATCH of an existing page with another name
    res = es_testapp.patch_json(help_page_deleted['@id'], {'name': new_page['name']}, status=422)
    assert expected_val_err in res.json['errors'][0]['description']
