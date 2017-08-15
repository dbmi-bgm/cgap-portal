import pytest
# pytestmark = pytest.mark.working


@pytest.fixture
def biosource_1(award, lab):
    return{
        "schema_version": '1',
        "award": award['@id'],
        "lab": lab['@id'],
        "biosource_type": "immortalized cell line",
        "cell_line": "GM12878",
        "cell_line_termid": "EFO:0000001"
    }


@pytest.fixture
def biosource_2(biosource_1):
    item = biosource_1.copy()
    item['cell_line'] = 'blah'
    return item


def test_biosource_convert_cell_line_to_link_to_ontology_term(
        registry, biosource_1, gm12878_oterm):
    from snovault import UPGRADER
    upgrader = registry[UPGRADER]
    value = upgrader.upgrade('biosource', biosource_1, registry=registry,
                             current_version='1', target_version='2')
    assert value['schema_version'] == '2'
    assert value['cell_line'] == gm12878_oterm['uuid']
    assert 'cell_line_termid' not in value


def test_biosource_convert_cell_line_w_no_ontology_term(
        registry, biosource_2):
    from snovault import UPGRADER
    upgrader = registry[UPGRADER]
    value = upgrader.upgrade('biosource', biosource_2, registry=registry,
                             current_version='1', target_version='2')
    assert value['schema_version'] == '2'
    assert 'cell_line' not in value
    assert 'cell_line_termid' not in value


def test_biosource_convert_cell_line_to_link_to_minor_version(
        registry, biosource_1, gm12878_oterm):
    from snovault import UPGRADER
    upgrader = registry[UPGRADER]
    biosource_1['schema_version'] = "1.1"
    value = upgrader.upgrade('biosource', biosource_1, registry=registry,
                             current_version='1.1', target_version='2')
    assert value['schema_version'] == "2"
    assert value['cell_line'] == gm12878_oterm['uuid']
    assert 'cell_line_termid' not in value


def test_biosource_do_not_convert_cell_line_to_link_to_downgrade_version(
        registry, biosource_1, gm12878_oterm):
    from snovault import UPGRADER
    upgrader = registry[UPGRADER]
    biosource_1['schema_version'] = "1.1"
    try:
        upgrader.upgrade('biosource', biosource_1, registry=registry,
                         current_version='1.1', target_version='1')
    except Exception as e:
        assert "'Biosource' from '1.1' to '1'" in e.__str__()


def test_biosource_upgrade_skip_version(
        registry, biosource_1, gm12878_oterm):
    from snovault import (
        UPGRADER,
    )
    upgrader = registry[UPGRADER]
    biosource_1['schema_version'] = "3"

    value = upgrader.upgrade('biosource', biosource_1, registry=registry,
                             current_version='3', target_version='5')
    assert value['schema_version'] == '5'
    assert value['cell_line'] == "Well will you lookee there!"
