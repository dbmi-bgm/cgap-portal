import json
import os
import pytest
import copy
from io import StringIO

from collections import OrderedDict
from ..commands import parse_hpoa as ph


pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_ph_get_args_defaults():
    args = []
    args = ph.get_args(args)
    assert args.input == 'http://compbio.charite.de/jenkins/job/hpo.annotations.current/lastSuccessfulBuild/artifact/current/phenotype.hpoa'
    assert args.keyfile == os.path.expanduser("~/keypairs.json")
    assert args.outfile == 'disorders2phenotypes.json'
    assert args.load is False
    assert args.post_report is False
    assert args.pretty is False


def test_get_fields_for_item_added_by_file():
    list2chk = ['subject_item', 'object_item', 'relationship_name']
    to_add = [v for k, v in ph.FIELD_MAPPING.items() if k not in ['Frequency', 'DiseaseName', 'HPO_ID']]
    list2chk.extend(to_add)
    list2chk.extend(ph.FIELD_MAPPING.get('Frequency'))
    field_list = ph.get_fields_for_item_added_by_file()
    assert field_list == list2chk


def test_get_dbxref2disorder_map(rel_disorders):
    dbxrefs = [
        ['OMIM:1'],  # first instance of this
        ['Decipher:2', 'omim_1234', 'ICD9:123'],  # only good one is Decipher
        ['ORPHA:3', 'orphanet:3', 'OMIM:1'],  # both orphas OK, OMIM is repeat
        []
    ]
    for i, d in enumerate(rel_disorders):
        d.update({'dbxrefs': dbxrefs[i]})
    disorders = {'uuid' + str(i + 1): d for i, d in enumerate(rel_disorders)}
    map = ph.get_dbxref2disorder_map(disorders)
    import pdb; pdb.set_trace()
    for dx, uid in map.items():
        assert dx[dx.index(':') + 1:] == uid[4:]


def test_line2list():
    line = ' bug\tcat \tdog\t\tbir d\t7\n'
    list = ['bug', 'cat', 'dog', '', 'bir d', '7']
    res = ph.line2list(line)
    assert res == list


def test_has_unexpected_fields_all_ok():
    fm = ph.FIELD_MAPPING
    assert not ph.has_unexpected_fields(fm)


def test_has_unexpected_fields_bad_field():
    fm = ph.FIELD_MAPPING.copy()
    fm['bad_field'] = 'blah'
    assert 'bad_field' in ph.has_unexpected_fields(fm)


@pytest.fixture
def mini_hpoa_lines():
    return [
        '#description: HPO annotations for rare diseases [7623: OMIM; 47: DECIPHER; 3771 ORPHANET]',
        '#date: 2019-11-08',
        '#tracker: https://github.com/obophenotype/human-phenotype-ontology',
        '#HPO-version: http://purl.obolibrary.org/obo/hp.obo/hp/releases/2019-11-08/hp.obo.owl',
        'DatabaseID      DiseaseName     Qualifier       HPO_ID  Reference       Evidence        Onset   Frequency       Sex     Modifier        Aspect  Biocuration',
        'OMIM:210100     BETA-AMINOISOBUTYRIC ACID, URINARY EXCRETION OF         HP:0000007      OMIM:210100     IEA                                     I       HPO:iea[2009-02-17]',
        'OMIM:163600     NIPPLES INVERTED                HP:0000006      OMIM:163600     IEA                                     I       HPO:iea[2009-02-17]',
        'OMIM:163600     NIPPLES INVERTED                HP:0003186      OMIM:163600     IEA                                     P       HPO:iea[2009-02-17]',
        'OMIM:615763     #615763 CORTICAL DYSPLASIA, COMPLEX, WITH OTHER BRAIN MALFORMATIONS 5; CDCBM5           HP:0002365      OMIM:615763     TAS             HP:0040283        P       HPO:skoehler[2014-08-24]',
        'OMIM:615763     #615763 CORTICAL DYSPLASIA, COMPLEX, WITH OTHER BRAIN MALFORMATIONS 5; CDCBM5           HP:0002119      OMIM:615763     TAS             HP:0040283',
    ]


def test_get_header_info_and_field_names(mocker, capsys, mock_logger, mini_hpoa_lines):
    mocker.patch('encoded.commands.parse_hpoa.has_unexpected_fields', return_value=False)
    lfields = ph.line2list(mini_hpoa_lines[4])
    fields, lines = ph.get_header_info_and_field_names(iter(mini_hpoa_lines), mock_logger)
    assert fields == lfields
    assert next(lines).startswith('OMIM:210100')
    out = capsys.readouterr()[0]
    assert out == 'INFO: Annotation file info:\n\tdate: 2019-11-08\n\tdescription: HPO annotations for rare diseases [7623: OMIM; 47: DECIPHER; 3771 ORPHANET]\n'


def test_get_header_info_and_field_names_no_comments(mocker, capsys, mock_logger, mini_hpoa_lines):
    mocker.patch('encoded.commands.parse_hpoa.has_unexpected_fields', return_value=False)
    lfields = ph.line2list(mini_hpoa_lines[4])
    fields, lines = ph.get_header_info_and_field_names(iter(mini_hpoa_lines[4:]), mock_logger)
    assert fields == lfields
    assert next(lines).startswith('OMIM:210100')
    out = capsys.readouterr()[0]
    assert out == 'INFO: Annotation file info:\n\tdate: unknown\n\tdescription: unknown\n'


def test_get_header_info_and_field_names_misformatted(mocker, capsys, mock_logger, mini_hpoa_lines):
    mini_hpoa_lines.insert(2, 'bad stuff')
    mocker.patch('encoded.commands.parse_hpoa.has_unexpected_fields', return_value=['bad'])
    with pytest.raises(SystemExit):
        fields, lines = ph.get_header_info_and_field_names(iter(mini_hpoa_lines[4:]), mock_logger)
    out = capsys.readouterr()[0]
    assert out == 'INFO: Annotation file info:\n\tdate: unknown\n\tdescription: unknown\nERROR: UNKNOWN FIELDS FOUND: bad\n'


@pytest.fixture
def dis_data():
    return {
        'DatabaseID': 'OMIM:163600',
        'DiseaseName': 'NIPPLES INVERTED',
        'HPO_ID': 'HP:0000006',
        'Reference': 'OMIM:163600',
        'Evidence': 'IEA',
        'Aspect': 'P'
    }


@pytest.fixture
def xref2dis_map():
    return {'OMIM:163600': 'uuid1', 'Orphanet:1': 'uuid2'}


def test_find_disorder_uid_using_file_id_no_using_id(dis_data, xref2dis_map):
    del dis_data['DatabaseID']
    assert ph.find_disorder_uid_using_file_id(dis_data, xref2dis_map) is None


def test_find_disorder_uid_using_file_id_OMIM(dis_data, xref2dis_map):
    uid = ph.find_disorder_uid_using_file_id(dis_data, xref2dis_map)
    assert uid == 'uuid1'


def test_find_disorder_uid_using_file_id_ORPHA(dis_data, xref2dis_map):
    dis_data['DatabaseID'] = 'ORPHA:1'
    uid = ph.find_disorder_uid_using_file_id(dis_data, xref2dis_map)
    assert uid == 'uuid2'


def test_find_disorder_uid_using_file_id_using_id_not_found(dis_data, xref2dis_map):
    dis_data['DatabaseID'] = 'ORPHA:2'
    assert ph.find_disorder_uid_using_file_id(dis_data, xref2dis_map) is None


@pytest.fixture
def hpo2uid_map():
    return {
        'HP:3000079': '7158aaec-9e34-4a80-b7d5-6066351a41bf',
        'HP:0500252': '05648474-44de-4cdb-b35b-18f5362b8281',
        'HP:0500249': 'fe6ec882-8af6-402d-ab55-69322519b5ef',
        'HP:0000006': 'phe_uuid1',
        'HP:0040283': 'phe_uuid2'
    }


def test_check_hpo_id_and_note_problems_ok(hpo2uid_map):
    hpoid = 'HP:3000079'
    ans = ph.check_hpo_id_and_note_problems('blah', hpoid, hpo2uid_map, {})
    assert ans == hpo2uid_map.get(hpoid)


def test_check_hpo_id_and_note_problems_new_not_ok(hpo2uid_map):
    hpoid = 'HP:1111111'
    problems = {}
    assert ph.check_hpo_id_and_note_problems('blah', hpoid, hpo2uid_map, problems) is None
    assert problems.get('hpo_not_found').get(hpoid)[0] == 'blah'


def test_check_hpo_id_and_note_problems_new_field_w_existing_prob(hpo2uid_map):
    hpoid = 'HP:1111111'
    problems = {'hpo_not_found': {'HP:1111111': ['blah']}}
    assert ph.check_hpo_id_and_note_problems('ooh', hpoid, hpo2uid_map, problems) is None
    probs = problems.get('hpo_not_found').get(hpoid)
    assert len(probs) == 2
    assert probs[1] == 'ooh'


def test_check_hpo_id_and_note_problems_existing_not_ok(hpo2uid_map):
    hpoid = 'HP:1111111'
    problems = {'hpo_not_found': {'HP:1111111': ['ooh', 'blah']}}
    assert ph.check_hpo_id_and_note_problems('blah', hpoid, hpo2uid_map, problems) is None
    probs = problems.get('hpo_not_found').get(hpoid)
    assert len(probs) == 2
    assert probs[1] == 'blah'


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


def test_create_evi_annotation_with_hp_modifier(mocker, hpoa_data, hpo2uid_map):
    mod_phe = 'HP:0500252'
    phe_uuid = '05648474-44de-4cdb-b35b-18f5362b8281'
    hpoa_data['Modifier'] = mod_phe
    mocker.patch('encoded.commands.parse_hpoa.check_hpo_id_and_note_problems', return_value=phe_uuid)
    evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
    assert evi.get('modifier') == phe_uuid


def test_create_evi_annotation_with_unknown_hp_modifier(mocker, hpoa_data, hpo2uid_map):
    mod_phe = 'HP:0000002'
    hpoa_data['Modifier'] = mod_phe
    mocker.patch('encoded.commands.parse_hpoa.check_hpo_id_and_note_problems', return_value=None)
    evi = ph.create_evi_annotation(hpoa_data, hpo2uid_map, {})
    assert 'modifier' not in evi


def test_convert2raw(mocker, embedded_item_dict, raw_item_dict):
    # this is not really testing much as the mocked return value is what is being
    # checked so no way to know if fields are really being stripped as expected
    # first add some fields that should be ignored when getting raw form
    embedded_item_dict['status'] = 'released'
    embedded_item_dict['date_created'] = "2020-03-03T20:08:10.690526+00:00"
    embedded_item_dict['institution'] = '/institution/bwh'
    embedded_item_dict["principals_allowed"] = {"view": ["system.Everyone"], "edit": ["group.admin"]}
    mocker.patch('encoded.commands.parse_hpoa.get_raw_form', return_value=raw_item_dict)
    raw_item = ph.convert2raw(embedded_item_dict)
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


def test_compare_existing_to_newly_generated_all_new(mocker, mock_logger, connection, evi_items):
    itemcnt = len(evi_items)
    mocker.patch('encoded.commands.parse_hpoa.search_metadata', return_value=[])
    evi, exist, to_obs = ph.compare_existing_to_newly_generated(mock_logger, connection, evi_items, 'EvidenceDisPheno')
    assert evi == evi_items
    assert not to_obs
    assert exist == 0


def test_compare_existing_to_newly_generated_all_same(mocker, mock_logger, connection, evi_items):
    itemcnt = len(evi_items)
    mocker.patch('encoded.commands.parse_hpoa.search_metadata', return_value=evi_items[:])
    mocker.patch('encoded.commands.parse_hpoa.get_raw_form', side_effect=evi_items[:])
    evi, exist, to_obs = ph.compare_existing_to_newly_generated(mock_logger, connection, evi_items, 'EvidenceDisPheno')
    assert not evi
    assert not to_obs
    assert itemcnt == exist


def test_compare_existing_to_newly_generated_none_same(mocker, mock_logger, connection, evi_items):
    dbitems = []
    for e in evi_items:
        dbitems.append({k: v + '9' for k, v in e.items()})
    dbuuids = [d.get('uuid') for d in dbitems]
    mocker.patch('encoded.commands.parse_hpoa.search_metadata', return_value=dbitems)
    mocker.patch('encoded.commands.parse_hpoa.get_raw_form', side_effect=dbitems)
    evi, exist, to_obs = ph.compare_existing_to_newly_generated(mock_logger, connection, evi_items, 'EvidenceDisPheno')
    assert evi == evi_items
    assert to_obs == dbuuids
    assert exist == 0


@pytest.fixture
def problems(evi_items, hpoa_data):
    return {
        'hpo_not_found': {
            'HP:0000001': 'HPO_ID',
            'HP:0202021': 'Frequency',
        },
        'redundant_annot': [evi_items],
        'no_map': [hpoa_data]
    }


def test_log_problems(mock_logger, problems, capsys):
    ph.log_problems(mock_logger, problems)
    out = capsys.readouterr()[0]
    assert out == "INFO: 2 missing HPO terms used in hpoa file\nINFO: HP:0000001	HPO_ID\nINFO: HP:0202021	Frequency\nINFO: 1 redundant annotations found\nINFO: 1 disorders from 1 annotation lines not found by xref\nINFO: OMIM:163600	NIPPLES INVERTED\n"
