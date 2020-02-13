import pytest
from snovault import UPGRADER
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


def test_upgrade_sample_1_2(registry, project, institution, female_individual, sample_f):
    sample_f['individual'] = female_individual['@id']
    sample_f['schema_version'] = 1
    upgrader = registry[UPGRADER]
    value = upgrader.upgrade('sample', sample_f, registry=registry,
                             current_version='1', target_version='2')
    assert value['schema_version'] == '2'
    assert not value.get('individual')
