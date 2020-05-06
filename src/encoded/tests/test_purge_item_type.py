import datetime
import pytest
import time
from .workbook_fixtures import app_settings, app, workbook, show_purge_queue_calls, PurgeQueueData
from encoded.commands.purge_item_type import purge_item_type_from_storage
from dcicutils.misc_utils import ignored

accept_fixtures = ignored


accept_fixtures(app_settings, app, workbook)  # Makes sure the imports in this file don't seem unused


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
    testapp.post_json('/index', {'record': True})


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
    testapp.post_json('/index', {'record': True})
    return paths


# XXX: Maybe parametrize on a few types?
def test_purge_item_type_from_db(testapp, dummy_static_section):
    """ Tests purging all items of a certain item type from the DB """
    testapp.post_json('/index', {'record': True})
    # this will need to work slightly differently when snovault is updated.
    time.sleep(10 + min(60, (datetime.datetime.now() - PurgeQueueData.PURGE_QUEUE_LAST_TIME).total_seconds()))
    assert purge_item_type_from_storage(testapp, ['static_section']) is True
    testapp.post_json('/index', {'record': True})
    testapp.get('/search/?type=StaticSection', status=404)
    testapp.get('/static-sections/442c8aa0-dc6c-43d7-814a-854af460b015?datastore=database', status=404)


def test_purge_item_type_from_db_many(testapp, many_dummy_static_sections):
    """ Tests posting/deleting several static sections and checking all are gone """
    paths_to_check = many_dummy_static_sections
    assert purge_item_type_from_storage(testapp, ['static_section']) is True
    testapp.post_json('/index', {'record': True})
    path_string = '%s?datastore=database'
    for path in paths_to_check:
        testapp.get(path_string % path, status=404)
    testapp.get('/search/?type=StaticSection', status=404)


def test_purge_item_type_with_links_fails(testapp, workbook):
    """ Tries to remove Individuals, which when the workbook is indexed will have links so
        deletion will fail
    """
    accept_fixtures(workbook)
    testapp.post_json('/index', {'record': True})  # must index everything so individual links show up
    time.sleep(5)  # wait for indexing to catch up
    assert not purge_item_type_from_storage(testapp, ['individual'])
    assert purge_item_type_from_storage(testapp, ['cohort']) is True  # this one will work since it is not linkedTo
    testapp.post_json('/index', {'record': True})
    testapp.get('/search/?type=Cohort', status=404)