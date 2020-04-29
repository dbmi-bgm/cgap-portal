import pytest
from .workbook_fixtures import app_settings, app, workbook
from encoded.commands.purge_item_type import purge_item_type_from_storage


pytestmark = [pytest.mark.working]


@pytest.fixture
def dummy_static_section(testapp):
    static_section = {  # from workbook_inserts
        "name": "search-info-header.Workflow_copy",
        "uuid": "442c8aa0-dc6c-43d7-814a-854af460b015",
        "section_type": "Search Info Header",
        "title": "Workflow Information",
        "body": "Some text to be rendered as a header"
    }
    testapp.post_json('/static_section', static_section, status=201)


@pytest.fixture
def many_dummy_static_sections(testapp):
    static_section_template = {
        "name": "search-info-header.Workflow",
        "section_type": "Search Info Header",
        "title": "Workflow Information",
        "body": "Some text to be rendered as a header"
    }
    paths = []
    for i in range(6):  # arbitrarily defined
        static_section_template['name'] = 'search-info-header.Workflow:%s' % i
        resp = testapp.post_json('/static_section', static_section_template, status=201).json
        paths.append(resp['@graph'][0]['@id'])
    return paths


@pytest.mark.parametrize('item_type', ['static_section'])  # maybe should test some other types...
def test_purge_item_type_from_db(testapp, dummy_static_section, item_type):
    """ Tests purging all items of a certain item type from the DB """
    assert purge_item_type_from_storage(testapp, [item_type])
    testapp.get('/442c8aa0-dc6c-43d7-814a-854af460b001?datastore=database', status=404)
    testapp.get('/search/?type=StaticSection', status=404)


@pytest.mark.skip  # will run if run individually, but due to indexing slowness it will not on Travis
def test_purge_item_type_from_db_many(testapp, many_dummy_static_sections):
    """ Tests posting/deleting several static sections and checking all are gone """
    paths_to_check = many_dummy_static_sections
    assert purge_item_type_from_storage(testapp, ['static_section'])
    path_string = '%s?datastore=database'
    for path in paths_to_check:
        testapp.get(path_string % path, status=404)
    testapp.get('/search/?type=StaticSection', status=404)


def test_purge_item_type_with_links_fails(testapp, workbook):
    """ Tries to remove Individuals, which when the workbook is indexed will have links so
        deletion will fail
    """
    assert not purge_item_type_from_storage(testapp, ['individual'])
    assert purge_item_type_from_storage(testapp, ['cohort'])  # this one will work since it is not linkedTo
