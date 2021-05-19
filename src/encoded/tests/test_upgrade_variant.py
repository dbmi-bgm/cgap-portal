import pytest


pytestmark = [pytest.mark.working]


@pytest.fixture
def variant_1():
    return {
        'schema_version': '1',
        'csq_rs_dbsnp151': '5',
        'csq_hg19_chr': 5,
        'csq_hg19_pos': 10,
        'csq_clinvar_clnhgvs': 'blah'
    }


def test_upgrade_variant_to_version_2(app, variant_1):
    upgrader = app.registry['upgrader']
    value = upgrader.upgrade('variant', variant_1, current_version='1', target_version='2')
    assert value['schema_version'] == '2'
    for deleted_field in [
        'csq_rs_dbsnp151',
        'csq_hg19_chr',
        'csq_hg19_pos',
        'csq_clinvar_clnhgvs'
    ]:
        assert deleted_field not in value
