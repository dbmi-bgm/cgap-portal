import pytest
pytestmark = [pytest.mark.work, pytest.mark.schema]


# @pytest.fixture
# def grandpa(testapp, project, institution):
#     item = {
#         "age": 53,
#         "age_units": "year",
#         'project': project['@id'],
#         'institution': institution['@id'],
#         "sex": "M",
#         "status": "released"
#     }
#     return testapp.post_json('/individual', item).json['@graph'][0]
#
#
# @pytest.fixture
# def mother(testapp, project, institution, grandpa, female_individual):
#     item = {
#         "age": 33,
#         "age_units": "year",
#         'project': project['@id'],
#         'institution': institution['@id'],
#         "sex": "F",
#         "father": grandpa['@id'],
#         "mother": female_individual['@id']
#     }
#     return testapp.post_json('/individual', item).json['@graph'][0]
#
#
# @pytest.fixture
# def father(testapp, project, institution):
#     item = {
#         "age": 33,
#         "age_units": "year",
#         'project': project['@id'],
#         'institution': institution['@id'],
#         "sex": "M",
#     }
#     return testapp.post_json('/individual', item).json['@graph'][0]
#
#
# @pytest.fixture
# def uncle(testapp, project, institution, grandpa):
#     item = {
#         "age": 35,
#         "age_units": "year",
#         'project': project['@id'],
#         'institution': institution['@id'],
#         "sex": "M",
#         "father": grandpa['@id']
#     }
#     return testapp.post_json('/individual', item).json['@graph'][0]
#
#
# @pytest.fixture
# def child(testapp, project, institution, mother, father):
#     item = {
#         "age": 7,
#         "age_units": "year",
#         'project': project['@id'],
#         'institution': institution['@id'],
#         "sex": "M",
#         "mother": mother['@id'],
#         "father": father['@id']
#     }
#     return testapp.post_json('/individual', item).json['@graph'][0]
#
#
# @pytest.fixture
# def cousin(testapp, project, institution, uncle):
#     item = {
#         "age": 11,
#         "age_units": "year",
#         'project': project['@id'],
#         'institution': institution['@id'],
#         "sex": "F",
#         "father": uncle['@id']
#     }
#     return testapp.post_json('/individual', item).json['@graph'][0]
#
#
# @pytest.fixture
# def sister(testapp, project, institution, mother):
#     item = {
#         "age": 11,
#         "age_units": "year",
#         'project': project['@id'],
#         'institution': institution['@id'],
#         "sex": "F",
#         "mother": mother['@id']
#     }
#     return testapp.post_json('/individual', item).json['@graph'][0]
#
#
# @pytest.fixture
# def fam(testapp, project, female_individual, institution, grandpa, mother, father, uncle, child, cousin, sister):
#     item = {
#         "project": project['@id'],
#         "institution": institution['@id'],
#         "title": "Smith family",
#         "proband": child['@id'],
#         "members": [
#             child['@id'],
#             sister['@id'],
#             mother['@id'],
#             father['@id'],
#             uncle['@id'],
#             cousin['@id'],
#             grandpa['@id'],
#             female_individual['@id']
#         ]
#     }
#     return testapp.post_json('/family', item).json['@graph'][0]


@pytest.fixture
def sample_proc(testapp, project, institution, fam):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "families": [fam['@id']]
    }
    return testapp.post_json('/sample_processing', item).json['@graph'][0]


def test_family_analysis_groups(testapp, fam, sample_proc):
    assert fam.get('analysis_groups') == None
    family = testapp.get(fam['@id']).json
    assert [ag['@id'] for ag in family.get('analysis_groups', [])] == [sample_proc['@id']]


def test_family_mother(testapp, fam, mother):
    assert fam.get('mother') == mother['@id']


def test_family_father(testapp, fam, father):
    assert fam.get('father') == father['@id']


def test_family_siblings(testapp, fam, sister, father):
    assert fam.get('half_siblings') == [sister['@id']]
    res = testapp.patch_json(sister['@id'], {'father': father['@id']}, status=200)
    result = testapp.get(fam['@id']).json
    assert not result.get('half_siblings')
    assert result.get('siblings') == [sister['@id']]


def test_family_grandparents(testapp, fam, grandpa, female_individual):
    assert len(fam.get('grandparents')) == 2
    assert grandpa['@id'] in fam.get('grandparents')
    assert female_individual['@id'] in fam.get('grandparents')


def test_family_aunts_and_uncles(testapp, fam, uncle):
    assert fam.get('aunts_and_uncles') == [uncle['@id']]


def test_family_cousins(testapp, fam, cousin):
    assert fam.get('cousins') == [cousin['@id']]


def test_family_children(testapp, fam, mother, child, sister):
    res = testapp.patch_json(fam['@id'], {'proband': mother['@id']}, status=200).json['@graph'][0]
    assert len(res.get('children')) == 2
    assert child['@id'] in res.get('children')
    assert sister['@id'] in res.get('children')
