import pytest
from unittest import mock
from datetime import datetime
from xml.etree.ElementTree import fromstring
from encoded.types.family import *
pytestmark = [pytest.mark.work, pytest.mark.schema]


@pytest.fixture
def sample_proc(testapp, project, institution, fam):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "families": [fam['@id']]
    }
    return testapp.post_json('/sample_processing', item).json['@graph'][0]


@pytest.fixture
def family_empty(testapp, project, institution):
    family = {
        "project": project['@id'],
        "institution": institution['@id']
    }
    return testapp.post_json('/family', family).json['@graph'][0]


def test_family_analysis_groups(testapp, fam, sample_proc):
    assert fam.get('analysis_groups') is None
    family = testapp.get(fam['@id']).json
    assert [ag['@id'] for ag in family.get('analysis_groups', [])] == [sample_proc['@id']]


def test_family_mother(testapp, fam, mother):
    assert fam.get('mother') == mother['@id']


def test_family_father(testapp, fam, father):
    assert fam.get('father') == father['@id']


def test_relationships_roles(testapp, fam):
    """This is an end to end test for calculating relationships
    Test for roles"""
    calculated_relations = fam.get('relationships', [])
    expected_values = {
        "GAPIDPROBAND": "proband",
        "GAPIDFATHER1": "father",
        "GAPIDMOTHER1": "mother",
        "GAPIDBROTHER": "brother",
        "GAPIDGRANDPA": "grandfather",
        "GAPINGRANDMA": "grandmother",
        "GAPIDHALFSIS": "half-sister",
        "GAPIDUNCLE01": "uncle",
        "GAPIDCOUSIN1": "cousin"
                       }
    for a_relation in calculated_relations:
        assert a_relation['relationship'] == expected_values[a_relation['individual']]


def test_relationships_assosiation(testapp, fam):
    """This is an end to end test for calculating relationships
    Test for paternal maternal associations"""
    calculated_relations = fam.get('relationships', [])
    expected_values = {
        "GAPIDPROBAND": "",
        "GAPIDFATHER1": "",
        "GAPIDMOTHER1": "",
        "GAPIDBROTHER": "",
        "GAPIDGRANDPA": "maternal",
        "GAPINGRANDMA": "maternal",
        "GAPIDHALFSIS": "",
        "GAPIDUNCLE01": "maternal",
        "GAPIDCOUSIN1": "maternal"
                       }
    for a_relation in calculated_relations:
        assert a_relation.get('association', "") == expected_values[a_relation['individual']]


@pytest.fixture
def ptolemaic_pedigree():
    # from https://en.wikipedia.org/wiki/Ptolemaic_dynasty#Ptolemaic_family_tree
    ptolemaic_pedigree = """Ptolemaic_dynasty	4DNFIBERENNI			2	-9
    Ptolemaic_dynasty	4DNFIPTOLEMI			1	-9
    Ptolemaic_dynasty	4DNFIARSINII	4DNFIPTOLEMI	4DNFIBERENNI	2	-9
    Ptolemaic_dynasty	4DNFIPTOLEII	4DNFIPTOLEMI	4DNFIBERENNI	1	-9
    Ptolemaic_dynasty	4DNFIARSINOI			2	-9
    Ptolemaic_dynasty	4DNFIPHILIPP			1	-9
    Ptolemaic_dynasty	4DNFIPTOLIII	4DNFIPTOLEII	4DNFIARSINOI	1	-9
    Ptolemaic_dynasty	4DNFIMAGASCY	4DNFIPHILIPP	4DNFIBERENNI	2	-9
    Ptolemaic_dynasty	4DNFIBERENII		4DNFIMAGASCY	2	-9
    Ptolemaic_dynasty	4DNFIPTOLEIV	4DNFIPTOLIII	4DNFIBERENII	1	-9
    Ptolemaic_dynasty	4DNFIARSNIII	4DNFIPTOLIII	4DNFIBERENII	2	-9
    Ptolemaic_dynasty	4DNFIPTOLEMV	4DNFIPTOLEIV	4DNFIARSNIII	1	-9
    Ptolemaic_dynasty	4DNFICLEOPOI			2	-9
    Ptolemaic_dynasty	4DNFIPTOLEVI	4DNFIPTOLEMV	4DNFICLEOPOI	1	-9
    Ptolemaic_dynasty	4DNFICLEOPII	4DNFIPTOLEMV	4DNFICLEOPOI	2	-9
    Ptolemaic_dynasty	4DNFIPTOVIII	4DNFIPTOLEMV	4DNFICLEOPOI	1	-9
    Ptolemaic_dynasty	4DNFIEIRENEE			2	-9
    Ptolemaic_dynasty	4DNFIPTOLVII	4DNFIPTOLEVI	4DNFICLEOPII	1	-9
    Ptolemaic_dynasty	4DNFICLEOIII	4DNFIPTOLEVI	4DNFICLEOPII	2	-9
    Ptolemaic_dynasty	4DNFIPLOTEMM	4DNFIPTOVIII	4DNFICLEOPII	1	-9
    Ptolemaic_dynasty	4DNFIPLOTEMA	4DNFIPTOVIII	4DNFIEIRENEE	1	-9
    Ptolemaic_dynasty	4DNFICLEOPIV	4DNFIPTOVIII	4DNFICLEOIII	2	-9
    Ptolemaic_dynasty	4DNFIPLOTEIX	4DNFIPTOVIII	4DNFICLEOIII	1	-9
    Ptolemaic_dynasty	4DNFICLOEPAI	4DNFIPTOVIII	4DNFICLEOIII	2	-9
    Ptolemaic_dynasty	4DNFIPTOEMYX	4DNFIPTOVIII	4DNFICLEOIII	1	-9
    Ptolemaic_dynasty	4DNFIBEREIII	4DNFIPLOTEIX	4DNFICLOEPAI	2	-9
    Ptolemaic_dynasty	4DNFIPTOLEXI	4DNFIPTOEMYX	4DNFICLOEPAI	1	-9
    Ptolemaic_dynasty	4DNFIPTOLXII	4DNFIPLOTEIX	4DNFICLEOPIV	1	-9
    Ptolemaic_dynasty	4DNFICLEOPAV	4DNFIPTOEMYX	4DNFIBEREIII	2	-9
    Ptolemaic_dynasty	4DNFICLEOPVI	4DNFIPTOLXII	4DNFICLEOPAV	2	-9
    Ptolemaic_dynasty	4DNFIBERENIV	4DNFIPTOLXII	4DNFICLEOPAV	2	-9
    Ptolemaic_dynasty	4DNFIPTOXIII	4DNFIPTOLXII	4DNFICLEOPAV	1	-9
    Ptolemaic_dynasty	4DNFICLEOPAT	4DNFIPTOLXII	4DNFICLEOPAV	2	2
    Ptolemaic_dynasty	4DNFICLEOXIV	4DNFIPTOLXII	4DNFICLEOPAV	1	-9
    Ptolemaic_dynasty	4DNFIARSINIV	4DNFIPTOLXII	4DNFICLEOPAV	2	-9
    Ptolemaic_dynasty	4DNFIJCAESAR			1	-9
    Ptolemaic_dynasty	4DNFIPTOLEXV	4DNFIJCAESAR	4DNFICLEOPAT	1	-9
    Ptolemaic_dynasty	4DNFIMARKANT			1	-9
    Ptolemaic_dynasty	4DNFIAHELIOS	4DNFIMARKANT	4DNFICLEOPAT	1	-9
    Ptolemaic_dynasty	4DNFIPTOLXVI	4DNFIMARKANT	4DNFICLEOPAT	1	-9
    Ptolemaic_dynasty	4DNFICLEOSII	4DNFIMARKANT	4DNFICLEOPAT	2	-9"""
    return ptolemaic_pedigree


def test_extract_vectors(ptolemaic_pedigree):
    primary_vectors = Family.extract_vectors(ptolemaic_pedigree)
    assert ['4DNFICLEOPAV', '4DNFICLEOPAT'] in primary_vectors['mothers']
    assert ['4DNFIPTOLXII', '4DNFICLEOPAT'] in primary_vectors['fathers']
    assert ['4DNFICLEOSII', '4DNFICLEOPAT'] in primary_vectors['daughters']
    assert ['4DNFIAHELIOS', '4DNFICLEOPAT'] in primary_vectors['sons']
    assert primary_vectors['children'] == []


def test_construct_links(ptolemaic_pedigree):
    primary_vectors = Family.extract_vectors(ptolemaic_pedigree)
    # create links from Cleopatra's perspective
    all_links = Family.construct_links(primary_vectors, '4DNFICLEOPAT')
    # look at links to cleopatra III - wow
    con_to_4DNFICLEOIII = all_links['4DNFICLEOIII']
    assert 'p-f-m-m' in con_to_4DNFICLEOIII
    assert 'p-f-f-m' in con_to_4DNFICLEOIII
    assert 'p-m-f-m' in con_to_4DNFICLEOIII

    # try looking at same person (4DNFICLEOIII) from 4DNFIPTOLIII perspective
    all_links = Family.construct_links(primary_vectors, '4DNFIPTOLIII')
    # look at links to cleopatra III - wow
    con_to_4DNFICLEOIII = all_links['4DNFICLEOIII']
    print(con_to_4DNFICLEOIII)
    assert 'p-d-s-s-d' in con_to_4DNFICLEOIII
    assert 'p-d-s-d-d' in con_to_4DNFICLEOIII


def test_relationships_vocabulary(ptolemaic_pedigree):
    primary_vectors = Family.extract_vectors(ptolemaic_pedigree)
    # create links from Cleopatra's perspective
    all_links = Family.construct_links(primary_vectors, '4DNFICLEOPAT')
    relations = Family.relationships_vocabulary(all_links)
    # assert all members have a calculated relationships
    for rel in relations:
        assert rel[1]
    # look at links to cleopatra III
    rel_to_4DNFICLEOIII = [i for i in relations if i[0] == '4DNFICLEOIII'][0][1]
    assert rel_to_4DNFICLEOIII == 'great-grandmother'
    # try looking at same person (4DNFICLEOIII) from 4DNFIPTOLIII perspective
    all_links = Family.construct_links(primary_vectors, '4DNFIPTOLIII')
    relations = Family.relationships_vocabulary(all_links)
    # look at links to cleopatra III
    rel_to_4DNFICLEOIII = [i for i in relations if i[0] == '4DNFICLEOIII'][0][1]
    assert rel_to_4DNFICLEOIII == 'great-great-granddaughter'


##########################
# PROCESS PEDIGREE TESTS #
##########################
@pytest.fixture
def pedigree_ref_data(testapp):
    return {
        'refs': {
            '0': {'proband': '0', 'relationships': {'@ref': '1'}, 'sex': 'M'},
            '2': {'proband': '0', 'relationships': {'@ref': '1'}, 'sex': 'F'},
            '3': {'proband': '1', 'relationships': None, 'descendancy': {'@ref': '1'}, 'sex': 'U', 'affected1': '1'},
            '1': {'active': '1', 'managedObjectID': '1', 'members': [{'@ref': '2'}, {'@ref': '0'}]},
            'affected1': {'ageAtDx': None, 'causeOfDeath': None, 'id': 'HP:0002315', 'name': 'Headache', 'ontology': 'HPO'}
        },
        'uuids_by_ref': {
            '0': '52e90271-2fac-4140-a0fb-16aa4697d6fe',
            '2': '05c65bb7-9fe0-47d1-8d8c-717f583c20fb',
            '3': 'b87b2fe9-54e0-402a-b2c6-c66d9796d3a9'
        }
    }


@pytest.fixture
def death_info(testapp):
    return [
        {'causeOfDeathOntologyId': 'HP:0100651', 'causeOfDeathOntology': 'HPO', 'explicitlySetBiologicalMother': None,
         'diagnoses': [
             {'ageAtDx': '25', 'ageAtDxUnits': 'Y', 'causeOfDeath': None, 'modeOfInheritance': None, 'ontology': 'HPO', 'carrier': None,
              'name': 'Type I diabetes mellitus', 'id': 'HP:0100651', 'order': '1', 'ontologyVersion': '2014-02-15 BUILD #889'}
         ],
         'sex': 'M', 'proband': '0', 'causeOfDeath': 'Type I diabetes mellitus', 'relationships': {'@ref': '11'},
         'note': 'Date of death is 20s-30s', 'managedObjectID': '13', 'annotations': {'@ref': '14'}, 'ageAtDeathUnits': 'Y',
         'ageAtDeath': '55', 'deceased': '1'
         }
    ]


def test_create_family_proband(testapp, family_empty):
    with open('src/encoded/tests/data/documents/sm_fam_w_headache.pbxml') as testfile:
        content = testfile.read()
    refs = {}
    xml_data = etree_to_dict(fromstring(content), refs, 'managedObjectID')
    for meta_key, meta_val in xml_data.get('meta', {}).items():
        if meta_key.startswith('affected'):
            refs[meta_key] = meta_val
    result = create_family_proband(testapp, xml_data, refs, 'managedObjectID', family_empty['@id'],
                                   xml_extra={'ped_datetime': datetime(2020, 1, 1, 16, 28, 35, 133549)})
    assert 'proband' in result
    assert len(result.get('members')) == 3


def test_family_descendancy_xml_ref_to_parents(testapp, family_empty, pedigree_ref_data):
    data = {}
    descendancy_xml_ref_to_parents(testapp, '1', pedigree_ref_data['refs'], data,
                                   family_empty['@id'], pedigree_ref_data['uuids_by_ref'])
    assert 'mother' in data
    assert 'father' in data


def test_add_to_clinic_notes(testapp, family_empty, pedigree_ref_data):
    data = {'clinic_notes': 'Patient presented with headache'}
    add_to_clinic_notes(testapp, 'Extra note', pedigree_ref_data['refs'], data,
                        family_empty['@id'], pedigree_ref_data['uuids_by_ref'])
    assert data['clinic_notes'] == 'Patient presented with headache\nExtra note'


def test_annotations_xml_ref_to_clinic_notes(testapp, family_empty, pedigree_ref_data):
    pedigree_ref_data['refs']['5'] = {'text': 'This is an annotation'}
    data = {'clinic_notes': 'Patient presented with headache'}
    annotations_xml_ref_to_clinic_notes(testapp, ['5'], pedigree_ref_data['refs'],
                                        data, family_empty['@id'], pedigree_ref_data['uuids_by_ref'])
    assert data['clinic_notes'] == 'Patient presented with headache\nThis is an annotation'


def test_diagnoses_xml_to_phenotypic_features_term_not_found(testapp, family_empty, pedigree_ref_data, death_info):
    data = {}
    diagnosis = death_info[0]['diagnoses']
    diagnoses_xml_to_phenotypic_features(testapp, diagnosis, {}, data, family_empty['@id'], {})
    assert data.get('clinic_notes')
    assert 'HPO term {} not found'.format(diagnosis[0]['id']) in data.get('clinic_notes')
    assert not data.get('phenotypic_features')


def test_diagnoses_xml_to_phenotypic_features_term_found(testapp, family_empty, pedigree_ref_data, death_info):
    res = testapp.post_json('/phenotype', {'phenotype_name': 'Diabetes', 'hpo_id': 'HP:0100651'}, status=201).json
    data = {'phenotypic_features': [{'phenotypic_feature': '00000000-0000-0000-0000-000000000000'}]}
    diagnosis = death_info[0]['diagnoses']
    diagnoses_xml_to_phenotypic_features(testapp, diagnosis, {}, data, family_empty['@id'], {})
    assert not data.get('clinic_notes')
    assert len(data['phenotypic_features']) == 2
    assert res['@graph'][0]['uuid'] in [pf['phenotypic_feature'] for pf in data.get('phenotypic_features')]


def test_affected_xml_to_phenotypic_features_affected(testapp, family_empty, pedigree_ref_data):
    # affected_xml_to_phenotypic_features(testapp, ref_vals, refs, data, family_item, uuids_by_ref)
    data = {}
    affected = [{'meta': 'affected1', 'affected': '1'}]
    affected_xml_to_phenotypic_features(testapp, affected, pedigree_ref_data['refs'], data, family_empty['@id'], {})
    assert 'Headache' in data.get('clinic_notes')


def test_affected_xml_to_phenotypic_features_nonaffected(testapp, family_empty, pedigree_ref_data):
    data = {}
    affected = [{'meta': 'affected1', 'affected': '0'}]
    affected_xml_to_phenotypic_features(testapp, affected, pedigree_ref_data['refs'], data, family_empty['@id'], {})
    assert not data.get('clinic_notes')
    assert not data.get('phenotypic_features')


def test_cause_of_death_xml_to_phenotype_term_not_found(testapp, family_empty, pedigree_ref_data, death_info):
    data = {}
    cause_of_death_xml_to_phenotype(testapp, death_info, {}, data, family_empty['@id'], {})
    assert data.get('clinic_notes')
    assert '(HPO term {} not found)'.format(death_info[0]['causeOfDeathOntologyId']) in data['clinic_notes']


def test_cause_of_death_xml_to_phenotype_term_found(testapp, family_empty, pedigree_ref_data, death_info):
    res = testapp.post_json('/phenotype', {'phenotype_name': 'Diabetes', 'hpo_id': 'HP:0100651'}, status=201).json
    data = {}
    cause_of_death_xml_to_phenotype(testapp, death_info, {}, data, family_empty['@id'], {})
    assert not data.get('clinic_notes')
    assert data.get('cause_of_death') == res['@graph'][0]['uuid']


def test_etree_to_dict(testapp):
    with open('src/encoded/tests/data/documents/sm_fam_w_headache.pbxml') as testfile:
        content = testfile.read()
    refs = {}
    xml_data = etree_to_dict(fromstring(content), refs, 'managedObjectID')
    assert all(key in xml_data for key in ['people', 'relationships', 'annotations', 'meta'])
    assert len(xml_data['people']) == 3
    assert 'affected1' in xml_data['meta']
