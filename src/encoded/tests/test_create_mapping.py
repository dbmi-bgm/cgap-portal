import mock
import pytest

from snovault import COLLECTIONS, TYPES
from snovault.elasticsearch.create_mapping import (
    type_mapping,
    run as run_create_mapping,
)
from snovault.util import add_default_embeds
from unittest.mock import patch, MagicMock
from .conftest_settings import ORDER
from ..commands.create_mapping_on_deploy import ITEM_INDEX_ORDER, get_deployment_config


pytestmark = [pytest.mark.setone, pytest.mark.working]


@pytest.mark.parametrize('item_type', ORDER)
def test_create_mapping_correctly_maps_embeds(registry, item_type):
    """
    This test does not actually use elasticsearch
    Only tests the mappings generated from schemas
    """
    mapping = type_mapping(registry[TYPES], item_type)
    assert mapping
    type_info = registry[TYPES].by_item_type[item_type]
    schema = type_info.schema
    embeds = add_default_embeds(item_type, registry[TYPES], type_info.embedded_list, schema)
    # assert that all embeds exist in mapping for the given type
    for embed in embeds:
        mapping_pointer = mapping
        split_embed = embed.split('.')
        for idx, split_ in enumerate(split_embed):
            # see if this is last level of embedding- may be a field or object
            if idx == len(split_embed) - 1:
                if 'properties' in mapping_pointer and split_ in mapping_pointer['properties']:
                    final_mapping = mapping_pointer['properties']
                else:
                    final_mapping = mapping_pointer
                if split_ != '*':
                    assert split_ in final_mapping
                else:
                    assert 'properties' in final_mapping or final_mapping.get('type') == 'object'
            else:
                assert split_ in mapping_pointer['properties']
                mapping_pointer = mapping_pointer['properties'][split_]


def test_create_mapping_item_order(registry):
    # make sure every item type name is represented in the item ordering
    for i_type in registry[COLLECTIONS].by_item_type:
        # ignore "testing" types
        if i_type.startswith('testing_'):
            continue
        assert registry[COLLECTIONS][i_type].type_info.name in ITEM_INDEX_ORDER


ENV_THAT_DOESNT_WIPES_ES = 'fourfront-cgapdev'


@patch('encoded.commands.create_mapping_on_deploy.get_my_env', MagicMock(return_value=ENV_THAT_DOESNT_WIPES_ES))
def test_get_deployment_config_prod():
    """ Tests we correctly configure prod """
    cfg = get_deployment_config(None)
    assert cfg['ENV_NAME'] == ENV_THAT_DOESNT_WIPES_ES
    assert cfg['WIPE_ES'] is False


ENV_THAT_WIPES_ES = 'fourfront-cgaptest'


@pytest.mark.skip  # cgaptest no longer wipes ES
@patch('encoded.commands.create_mapping_on_deploy.get_my_env', MagicMock(return_value=ENV_THAT_WIPES_ES))
def test_get_deployment_config_test():
    """ Tests we correctly configure cgaptest """
    cfg = get_deployment_config(None)
    assert cfg['ENV_NAME'] == ENV_THAT_WIPES_ES
    assert cfg['WIPE_ES'] is True


@patch('encoded.commands.create_mapping_on_deploy.get_my_env', MagicMock(return_value='fourfront-cgapother'))
def test_get_deployment_config_other():
    """ Tests we correct configure a different env not listed yet """
    cfg = get_deployment_config(None)
    assert cfg['ENV_NAME'] == 'fourfront-cgapother'
    assert cfg['WIPE_ES'] is False

@mock.patch("snovault.elasticsearch.indexer_queue.QueueManager.add_uuids")
def test_run_create_mapping_with_upgrader(mock_add_uuids, es_testapp, workbook):
    """
    Test for catching items in need of upgrading when running
    create_mapping.

    Indexer queue method mocked to check correct calls, so no items
    actually indexed/upgraded.
    """
    app = es_testapp.app
    type_to_upgrade = "Document"

    search_query = "/search/?type=Document&frame=object"
    document_search = es_testapp.get(search_query, status=200).json["@graph"]
    document_uuids = sorted([x["uuid"] for x in document_search])

    # No schema version change, so nothing needs indexing
    run_create_mapping(app, check_first=True)
    (_, uuids_to_index), _ = mock_add_uuids.call_args
    assert not uuids_to_index

    # Change Document schema version in registry so all posted
    # documents "need" to be upgraded
    registry_schema = app.registry[TYPES][type_to_upgrade].schema
    schema_version_default = registry_schema["properties"]["schema_version"]["default"]
    updated_schema_version = str(int(schema_version_default) + 1)
    registry_schema["properties"]["schema_version"]["default"] = updated_schema_version

    run_create_mapping(app, check_first=True)
    (_, uuids_to_index), _ = mock_add_uuids.call_args
    assert sorted(uuids_to_index) == document_uuids

    # Revert Document schema version
    registry_schema["properties"]["schema_version"]["default"] = schema_version_default
