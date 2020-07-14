import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


def test_case_case_title(testapp, proband_case, mother_case):
    proband_title = 'GAPIDPROBAND WGS-Group'
    mother_title = 'GAPIDMOTHER1 WGS-Group - in GAPIDPROBANDp'
    assert proband_title == proband_case['case_title']
    assert mother_title == mother_case['case_title']


def test_case_display_title(testapp, proband_case, mother_case):
    proband_title = 'GAPIDPROBAND WGS-Group (GAPCAP4E4GMG)'
    mother_title = 'GAPIDMOTHER1 WGS-Group - in GAPIDPROBANDp (GAPCAU1K3F5A)'
    assert proband_title == proband_case['display_title']
    assert mother_title == mother_case['display_title']


def test_case_case_title_with_institution_id(testapp, proband_case, mother_case):
    # add external id to proband ind
    testapp.patch_json('/individual/GAPIDPROBAND/', {'individual_id': 'HMS_Proband01'})
    testapp.patch_json('/individual/GAPIDMOTHER1/', {'individual_id': 'HMS_Mother01'})
    updated_proband_case = testapp.get(proband_case['@id']).json
    updated_mother_case = testapp.get(mother_case['@id']).json
    new_proband_title = "HMS_Proband01 WGS-Group"
    new_mother_title = "HMS_Mother01 WGS-Group - in HMS_Proband01p"
    new_proband_d_title = "HMS_Proband01 WGS-Group (GAPCAP4E4GMG)"
    new_mother_d_title = "HMS_Mother01 WGS-Group - in HMS_Proband01p (GAPCAU1K3F5A)"
    assert new_proband_title == updated_proband_case['case_title']
    assert new_mother_title == updated_mother_case['case_title']
    assert new_proband_d_title == updated_proband_case['display_title']
    assert new_mother_d_title == updated_mother_case['display_title']
