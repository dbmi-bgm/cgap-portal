import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def MIndividual(testapp, project, institution, sample_one):
    ind = {
        'project': 'encode-project',
        'institution': 'encode-institution',
        'sex': 'M'
    }
    return testapp.post_json('/individual', ind, status=201).json['@graph'][0]


@pytest.fixture
def WIndividual(testapp, project, institution):
    ind = {
        'project': 'encode-project',
        'institution': 'encode-institution',
        'sex': 'F'
    }
    return testapp.post_json('/individual', ind, status=201).json['@graph'][0]


@pytest.fixture
def sample_one(project, institution):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'specimen_type': 'blood',
        'date_received': '2018-12-1'
    }


@pytest.fixture
def sample_two(project, institution):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'specimen_type': 'saliva',
        'date_received': '2015-12-7'
    }


@pytest.fixture
def sample_invalid_specimen_type(project, institution, MIndividual):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'specimen_type': 'skin',
        'date_received': '2015-12-7'
    }


@pytest.fixture
def sample_no_project(institution, MIndividual):
    return {
        'project': 'does not exist',
        'institution': institution['@id'],
        'specimen_type': 'tissue',
        'date_received': '2015-12-7'
    }


def test_post_valid_samples(testapp, sample_one, sample_two):
    testapp.post_json('/sample', sample_one, status=201)
    testapp.post_json('/sample', sample_two, status=201)


def test_post_invalid_samples(testapp, sample_invalid_specimen_type, sample_no_project):
    testapp.post_json('/sample', sample_no_project, status=422)
    # testapp.post_json('/sample', sample_invalid_specimen_type, status=422)


def test_post_valid_patch_error(testapp, sample_one):
    res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'date_received': '12-3-2003'}, status=422)
    testapp.patch_json(res['@id'], {'project': 'does_not_exist'}, status=422)
    # testapp.patch_json(res['@id'], {'specimen_type': 'hair'}, status=422)


def test_sample_individual_revlink(testapp, sample_one, MIndividual):
    sample_res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    assert not sample_res.get('individual')
    indiv_res = testapp.patch_json(MIndividual['@id'], {'samples': [sample_res['@id']]}, status=200).json['@graph'][0]
    sample_indiv = testapp.get(sample_res['@id']).json.get('individual')
    assert sample_indiv['@id'] == indiv_res['@id']


def test_sample_requisition_completed_accepted(testapp, sample_one):
    res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    assert not res.get('requisition_completed')
    res2 = testapp.patch_json(res['@id'], {'specimen_accession_date': '2020-01-01'}, status=200).json['@graph'][0]
    assert res2.get('requisition_completed') is False
    res3 = testapp.patch_json(res['@id'], {'requisition_acceptance': {'accepted_rejected': 'Accepted'}},
                              status=200).json['@graph'][0]
    assert res3.get('requisition_completed') is True


def test_sample_requisition_completed_rejected(testapp, sample_one):
    sample_one['requisition_acceptance'] = {'accepted_rejected': 'Rejected'}
    res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    assert res.get('requisition_completed') is False
    patch_info = res.get('requisition_acceptance')
    patch_info['date_completed'] = '2020-03-01'
    res2 = testapp.patch_json(res['@id'], {'requisition_acceptance': patch_info}, status=200).json['@graph'][0]
    assert res2.get('requisition_completed') is True


# Sample Processing Tests
def test_sample_processing_pedigree(testapp, sample_proc_fam):
    """This is an end to end test for calculating relationships
    Test for roles"""
    expected_values = {
        'GAPIDPROBAND': {'sample_accession': 'GAPSAPROBAND', 'sample_name': 'ext_id_006',
                         'parents': ['GAPIDMOTHER1', 'GAPIDFATHER1'], 'relationship': 'proband', 'sex': 'M'},
        'GAPIDFATHER1': {'sample_accession': 'GAPSAFATHER1', 'sample_name': 'ext_id_004',
                         'parents': [], 'relationship': 'father', 'sex': 'M'},
        'GAPIDMOTHER1': {'sample_accession': 'GAPSAMOTHER1', 'sample_name': 'ext_id_003',
                         'parents': ['GAPIDGRANDMA', 'GAPIDGRANDPA'], 'relationship': 'mother', 'sex': 'F'},
        'GAPIDBROTHER': {'sample_accession': 'GAPSABROTHER', 'sample_name': 'ext_id_009',
                         'parents': ['GAPIDMOTHER1', 'GAPIDFATHER1'], 'relationship': 'brother', 'sex': 'M'},
        'GAPIDGRANDPA': {'sample_accession': 'GAPSAGRANDPA', 'sample_name': 'ext_id_002',
                         'parents': [], 'relationship': 'grandfather', 'sex': 'M', 'association': 'maternal'},
        'GAPIDGRANDMA': {'sample_accession': 'GAPSAGRANDMA', 'sample_name': 'ext_id_001',
                         'parents': [], 'relationship': 'grandmother', 'sex': 'F', 'association': 'maternal'},
        'GAPIDHALFSIS': {'sample_accession': 'GAPSAHALFSIS', 'sample_name': 'ext_id_008',
                         'parents': ['GAPIDMOTHER1'], 'relationship': 'half-sister', 'sex': 'F'},
        'GAPIDUNCLE01': {'sample_accession': 'GAPSAUNCLE01', 'sample_name': 'ext_id_005',
                         'parents': ['GAPIDGRANDPA'], 'relationship': 'uncle', 'sex': 'M', 'association': 'maternal'},
        'GAPIDCOUSIN1': {'sample_accession': 'GAPSACOUSIN1', 'sample_name': 'ext_id_007',
                         'parents': ['GAPIDUNCLE01'], 'relationship': 'cousin', 'sex': 'F', 'association': 'maternal'}
    }
    calculated_values = sample_proc_fam['samples_pedigree']

    for a_sample in calculated_values:
        expected_value = expected_values[a_sample['individual']]
        for a_key in expected_value:
            assert a_sample[a_key] == expected_value[a_key]
