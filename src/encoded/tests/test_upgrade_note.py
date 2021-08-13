import pytest


pytestmark = [pytest.mark.working]


@pytest.fixture
def note_item_1():
    '''Does NOT post to DB'''
    return {
        'schema_version': '1',
        'approved_date': "2021-07-20T22:36:11.302712" # Invalid, should have "+00:00" appended to assert UTC timezone.
    }


def test_upgrade_note_to_version_2(app, note_item_1):
    upgrader = app.registry['upgrader']
    value = upgrader.upgrade('note_standard', note_item_1, current_version='1', target_version='2')
    assert value['schema_version'] == '2'
    assert value["date_approved"] == "2021-07-20T22:36:11.302712+00:00"
    assert "approved_date" not in value

