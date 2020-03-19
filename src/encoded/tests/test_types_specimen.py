import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def specimen_one(project, institution):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'specimen_type': 'blood',
        'date_received': '2018-12-1'
    }


@pytest.fixture
def specimen_two(project, institution):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'specimen_type': 'saliva',
        'date_received': '2015-12-7'
    }


@pytest.fixture
def specimen_no_proj(institution):
    return {
        'institution': institution['@id'],
        'specimen_type': 'saliva',
        'date_received': '2014-12-7'
    }


def test_post_valid_specimens(testapp, specimen_one, specimen_two):
    testapp.post_json('/specimen', specimen_one, status=201)
    testapp.post_json('/specimen', specimen_two, status=201)


def test_post_invalid_specimens(testapp, specimen_no_proj, specimen_two):
    testapp.post_json('/specimen', specimen_no_proj, status=422)
    specimen_two['workup_type'] = 'WGS'
    testapp.post_json('/specimen', specimen_two, status=422)


def test_post_valid_patch_error(testapp, specimen_one):
    res = testapp.post_json('/specimen', specimen_one, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'date_received': '12-3-2003'}, status=422)
    testapp.patch_json(res['@id'], {'project': 'does_not_exist'}, status=422)
    testapp.patch_json(res['@id'], {'workup_type': 'WGS'}, status=422)


def test_specimen_samples_revlink(testapp, specimen_one, sample_f):
    specimen_res = testapp.post_json('/specimen', specimen_one, status=201).json['@graph'][0]
    assert not specimen_res.get('samples')
    sample_res = testapp.patch_json(sample_f['@id'], {'specimen': specimen_res['@id']}, status=200).json['@graph'][0]
    sample_field = testapp.get(specimen_res['@id']).json.get('samples')
    assert len(sample_field) == 1
    assert sample_field[0]['@id'] == sample_res['@id']
