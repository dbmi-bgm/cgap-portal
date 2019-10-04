import pytest
pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def rad21():
    return {
        'gene_id': '5885',
        'institution': 'encode-institution',
        'project': 'encode-project',
        'url': 'https://www.ncbi.nlm.nih.gov/gene/5885',
        'official_symbol': 'RAD21'
    }


def test_post_valid_gene(testapp, project, institution, rad21):
    """ Tests a valid gene can be posted """
    res = testapp.post_json('/gene', rad21, status=201)
    assert 'display_title' in res


def test_patch_gene(testapp, project, institution, rad21):
    """ Tests that we can patch some stuff """
    res = testapp.post_json('/gene', rad21, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'official_symbol': 'RAD22'}, status=200)
    testapp.patch_json(res['@id'], {'url': 'https://www.ncbi.nlm.nih.gov/gene/5885'}, status=200)
    testapp.patch_json(res['@id'], {'gene_id': '5900'}, status=200)


def test_patch_invalid(testapp, project, institution, rad21):
    """ Tries to patch invalid stuff """
    res = testapp.post_json('/gene', rad21, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'official_symbol': 22}, status=422)
    testapp.patch_json(res['@id'], {'url': {}}, status=422)
    testapp.patch_json(res['@id'], {'gene_id': 5900}, status=422)
    testapp.patch_json(res['@id'], {'does not exist': '5'}, status=422)
