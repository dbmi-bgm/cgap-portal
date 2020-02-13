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
