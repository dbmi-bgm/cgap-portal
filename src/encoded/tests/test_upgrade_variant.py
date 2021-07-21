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


@pytest.fixture
def variant_sample_list_1(bgm_user):
    '''Does NOT post to DB'''
    return {
        'schema_version': '1',
        'variant_samples': [
            {
                "userid": bgm_user["uuid"],
                "date_selected": "2021-07-20T22:36:11.302712+00:00",
                "variant_sample_item": "some-uuid-here"
            }
        ]
    }


def test_upgrade_variant_sample_list_to_version_2(app, variant_sample_list_1, bgm_user):
    upgrader = app.registry['upgrader']
    value = upgrader.upgrade('variant_sample_list', variant_sample_list_1, current_version='1', target_version='2')
    assert value['schema_version'] == '2'
    for vs_object in value.get("variant_samples", []):
        assert "userid" not in vs_object
        assert vs_object["selected_by"] == bgm_user["uuid"]

