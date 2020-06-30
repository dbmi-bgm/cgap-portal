import pytest

from snovault import COLLECTIONS, TYPES
from snovault.elasticsearch.create_mapping import type_mapping
from snovault.util import add_default_embeds
from unittest.mock import patch, MagicMock
from .datafixtures import ORDER
from ..commands.create_mapping_on_deploy import ITEM_INDEX_ORDER, get_deployment_config


pytestmark = [pytest.mark.setone, pytest.mark.working]


# XXX: Gene does not get 'genomic_region'
@pytest.mark.parametrize('item_type', [k for k in ORDER if k != 'gene'])
def test_create_mapping(registry, item_type):
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


@patch('encoded.commands.create_mapping_on_deploy.get_my_env', MagicMock(return_value='fourfront-cgapdev'))
def test_get_deployment_config_prod():
    """ Tests we correctly configure prod """
    cfg = get_deployment_config(None)
    assert cfg['ENV_NAME'] == 'fourfront-cgapdev'
    assert cfg['WIPE_ES'] is False


@patch('encoded.commands.create_mapping_on_deploy.get_my_env', MagicMock(return_value='fourfront-cgaptest'))
def test_get_deployment_config_test():
    """ Tests we correctly configure cgaptest """
    cfg = get_deployment_config(None)
    assert cfg['ENV_NAME'] == 'fourfront-cgaptest'
    assert cfg['WIPE_ES'] is True


@patch('encoded.commands.create_mapping_on_deploy.get_my_env', MagicMock(return_value='fourfront-cgapother'))
def test_get_deployment_config_other():
    """ Tests we correct configure a different env not listed yet """
    cfg = get_deployment_config(None)
    assert cfg['ENV_NAME'] == 'fourfront-cgapother'
    assert cfg['WIPE_ES'] is False
