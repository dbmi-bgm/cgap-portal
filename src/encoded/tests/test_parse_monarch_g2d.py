import json
import os
import pytest
import copy
from io import StringIO
from unittest import mock

from collections import OrderedDict
from ..commands import parse_monarch_g2d as pmg2d


pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_pmg2d_get_args_defaults():
    args = []
    args = pmg2d.get_args(args)
    assert args.input == pmg2d.MONARCH_G2D_URL
    assert args.keyfile == os.path.expanduser("~/keypairs.json")
    assert args.outfile == 'gene2disorders.json'
    assert args.load is False
    assert args.post_report is False
    assert args.pretty is False


def test_get_fields_for_item_added_by_file_g2d():
    list2chk = [v.get('field_name') for v in pmg2d.FIELD_MAPPING.values()]
    list2chk.extend(['subject_item', 'object_item'])
    field_list = pmg2d.get_fields_for_item_added_by_file()
    assert all([f in list2chk for f in field_list])


@pytest.fixture
def genes_w_altid_fields():
    return {
        'uuid1': {'hgnc_id': '1'},
        'uuid2': {'entrez_id': '2'},
        'uuid3': {'gene_symbol': 'gene3'},
        'uuid4': {'hgnc_id': '4', 'entrez_id': '4', 'gene_symbol': 'gene4'},
        'uuid5': {'hgnc_id': '5'},
        'uuid6': {'hgnc_id': '5'},
        'uuid7': {'blah': 'blah'}
    }


@pytest.fixture
def id2guid():
    return {
        'HGNC:1': ['uuid1'],
        'NCBIGene:2': ['uuid2'],
        'gene3': ['uuid3'],
        'HGNC:4': ['uuid4'],
        'NCBIGene:4': ['uuid4'],
        'gene4': ['uuid4'],
        'HGNC:5': ['uuid5', 'uuid6']
    }


def test_get_gene2_altid_map(genes_w_altid_fields, id2guid):
    map = pmg2d.get_gene2_altid_map(genes_w_altid_fields)
    assert map == id2guid


def test_find_uid_from_file_fields():
    pass


@pytest.fixture
def hpoa_data():
    return {
        'DatabaseID': 'OMIM:163600',
        'DiseaseName': 'NIPPLES INVERTED',
        'Qualifier': None,
        'Reference': 'OMIM:163600',
        'Evidence': 'IEA',
        'Frequency': 'HP:0040283',
        'Sex': 'male',
        'Aspect': 'I',
        'Biocuration': 'HPO:iea[2009-02-17]',
        'subject_item': 'dis_uuid1',
        'object_item': 'phe_uuid1'
    }


def test_create_evi_annotation_no_data(hpo2uid_map):
    assert not ph.create_evi_annotation({}, hpo2uid_map, {})


def test_create_evi_annotation_with_data(hpoa_data, hpo2uid_map):
    evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
    map = ph.FIELD_MAPPING
    revmap = {v: k for k, v in map.items() if k != 'Frequency'}
    for f, v in evi.items():
        if f.endswith('_item'):
            assert v == hpoa_data[f]
        elif f == 'frequency_term':
            assert v == 'phe_uuid2'
        elif f == 'affected_sex':
            assert v == 'M'
        elif f in revmap:
            assert v == hpoa_data.get(revmap[f])


# the following test specific field cases

def test_create_evi_annotation_with_qual(hpoa_data, hpo2uid_map):
    hpoa_data['Qualifier'] = 'NOT'
    evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
    assert evi.get('is_not')


def test_create_evi_annotation_with_female(hpoa_data, hpo2uid_map):
    hpoa_data['Sex'] = 'Female'
    evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
    assert evi.get('affected_sex') == 'F'


def test_create_evi_annotation_with_freq_str(hpoa_data, hpo2uid_map):
    freq = '1 in 10'
    hpoa_data['Frequency'] = freq
    evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
    assert evi.get('frequency_value') == freq


def test_create_evi_annotation_with_hp_modifier(hpoa_data, hpo2uid_map):
    mod_phe = 'HP:0500252'
    phe_uuid = '05648474-44de-4cdb-b35b-18f5362b8281'
    hpoa_data['Modifier'] = mod_phe
    with mock.patch.object(ph, 'check_hpo_id_and_note_problems', return_value=phe_uuid):
        evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
        assert evi.get('modifier') == phe_uuid


def test_create_evi_annotation_with_unknown_hp_modifier(hpoa_data, hpo2uid_map):
    mod_phe = 'HP:0000002'
    hpoa_data['Modifier'] = mod_phe
    with mock.patch.object(ph, 'check_hpo_id_and_note_problems', return_value=None):
        evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
        assert 'modifier' not in evi


def test_convert2raw(embedded_item_dict, raw_item_dict):
    # this is not really testing much as the mocked return value is what is being
    # checked so no way to know if fields are really being stripped as expected
    # first add some fields that should be ignored when getting raw form
    embedded_item_dict['status'] = 'released'
    embedded_item_dict['date_created'] = "2020-03-03T20:08:10.690526+00:00"
    embedded_item_dict['institution'] = '/institution/bwh'
    embedded_item_dict["principals_allowed"] = {"view": ["system.Everyone"], "edit": ["group.admin"]}
    with mock.patch.object(ph, 'get_raw_form', return_value=raw_item_dict):
        raw_item = ph.convert2raw(embedded_item_dict, raw_item_dict.keys())
        assert raw_item == raw_item_dict


@pytest.fixture
def evi_items():
    return [
        {
            'uuid': 'uuid1',
            'subject_item': 'duuid1',
            'object_item': 'puuid1',
            'relationship_name': 'associated with',
        },
        {
            'uuid': 'uuid2',
            'subject_item': 'duuid2',
            'object_item': 'puuid2',
            'relationship_name': 'associated with'
        },
        {
            'uuid': 'uuid3',
            'subject_item': 'duuid3',
            'object_item': 'puuid3',
            'relationship_name': 'associated with'
        }
    ]


def test_compare_existing_to_newly_generated_all_new(mock_logger, connection, evi_items):
    itemcnt = len(evi_items)
    with mock.patch.object(ph, 'search_metadata', return_value=[]):
        evi, exist, to_obs = ph.compare_existing_to_newly_generated(mock_logger, connection, evi_items, 'EvidenceDisPheno', evi_items[0].keys())
        assert evi == evi_items
        assert not to_obs
        assert exist == 0


def test_compare_existing_to_newly_generated_all_same(mock_logger, connection, evi_items):
    itemcnt = len(evi_items)
    with mock.patch.object(ph, 'search_metadata', return_value=iter(evi_items[:])):
        with mock.patch.object(ph, 'get_raw_form', side_effect=evi_items[:]):
            evi, exist, to_obs = ph.compare_existing_to_newly_generated(mock_logger, connection, evi_items, 'EvidenceDisPheno', evi_items[0].keys())
            assert not evi
            assert not to_obs
            assert itemcnt == exist


def test_compare_existing_to_newly_generated_none_same(mock_logger, connection, evi_items):
    dbitems = []
    for e in evi_items:
        dbitems.append({k: v + '9' for k, v in e.items()})
    dbuuids = [d.get('uuid') for d in dbitems]
    with mock.patch.object(ph, 'search_metadata', return_value=iter(dbitems)):
        with mock.patch.object(ph, 'get_raw_form', side_effect=dbitems):
            evi, exist, to_obs = ph.compare_existing_to_newly_generated(mock_logger, connection, evi_items, 'EvidenceDisPheno', evi_items[0].keys())
            assert evi == evi_items
            assert to_obs == dbuuids
            assert exist == 0


@pytest.fixture
def problems(evi_items, hpoa_data):
    not_found = OrderedDict()
    not_found['HP:0000001'] = 'HPO_ID'
    not_found['HP:0202021'] = 'Frequency'
    return {
        'hpo_not_found': not_found,
        'redundant_annot': [evi_items],
        'no_map': [hpoa_data]
    }


def test_log_problems(mock_logger, problems, capsys):
    ph.log_problems(mock_logger, problems)
    out = capsys.readouterr()[0]
    assert out == "INFO: 2 missing HPO terms used in hpoa file\nINFO: HP:0000001	HPO_ID\nINFO: HP:0202021	Frequency\nINFO: 1 redundant annotations found\nINFO: 1 disorders from 1 annotation lines not found by xref\nINFO: OMIM:163600	NIPPLES INVERTED\n"
