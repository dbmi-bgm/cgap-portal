import pytest
pytestmark = [pytest.mark.work, pytest.mark.schema]


@pytest.fixture
def MIndividual():
    return {
        'project': 'encode-project',
        'institution': 'encode-institution',
        'sex': 'M'
    }


@pytest.fixture
def WIndividual():
    return {
        'project': 'encode-project',
        'institution': 'encode-institution',
        'sex': 'F'
    }


def test_post_valid_individuals(testapp, project, institution, MIndividual, WIndividual):
    """ Posts valid individuals """
    testapp.post_json('/individual', MIndividual, status=201)
    res = testapp.post_json('/individual', WIndividual, status=201)
    assert 'display_title' in res


def test_patch_invalid_sex(testapp, project, institution, MIndividual):
    """ Checks 'U' first then tries 'Y' which should fail """
    res = testapp.post_json('/individual', MIndividual, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'sex': 'U'}, status=200)
    testapp.patch_json(res['@id'], {'sex': 'Y'}, status=422)


def test_patch_invalid_project_inst(testapp, project, institution, MIndividual):
    """ Tries to patch invalid projects and institutions """
    res = testapp.post_json('/individual', MIndividual, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'project': 'does not exist'}, status=422)
    testapp.patch_json(res['@id'], {'institution': 'does not exist'}, status=422)


def test_individual_children(testapp, project, institution, MIndividual, WIndividual):
    res_m = testapp.post_json('/individual', MIndividual, status=201).json['@graph'][0]
    WIndividual['father'] = res_m['@id']
    res_f = testapp.post_json('/individual', WIndividual, status=201).json['@graph'][0]
    assert testapp.get(res_m['@id']).json.get('children') == [res_f['@id']]
