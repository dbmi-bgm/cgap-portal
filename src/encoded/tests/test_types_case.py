import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def second_fam(testapp, project, institution, mother, father, sister):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "title": "Smith family 2",
        "proband": mother['@id'],
        "members": [
            father['@id'],
            sister['@id'],
            mother['@id']
        ]
    }
    return testapp.post_json('/family', item).json['@graph'][0]


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


def test_case_sample(testapp, proband_case, mother_case):
    proband_sample = '/samples/GAPSAPROBAND/'
    mother_sample = '/samples/GAPSAMOTHER1/'
    assert proband_sample == proband_case['sample']
    assert mother_sample == mother_case['sample']


def test_case_second_family(testapp, proband_case, mother_case, fam, second_fam):
    fam1_id = fam['@id']
    fam2_id = second_fam['@id']
    proband = testapp.get(proband_case['@id']).json
    mother = testapp.get(mother_case['@id']).json
    # assert proband has single family
    assert proband['family']['@id'] == fam1_id
    assert proband['secondary_families'] == []
    # assert mother has a second family
    assert mother['family']['@id'] == fam1_id
    assert len(mother['secondary_families']) == 1
    assert mother['secondary_families'][0]['@id'] == fam2_id


def test_case_vcf(testapp, sample_proc_fam, file_vcf, proband_case, mother_case):
    # add ann_vcf to sample_processing
    file_id = file_vcf['@id']
    testapp.patch_json(sample_proc_fam['@id'], {'processed_files': [file_id]})
    proband = testapp.get(proband_case['@id']).json
    mother = testapp.get(mother_case['@id']).json
    assert proband['vcf_file']['@id'] == file_id
    assert mother['vcf_file']['@id'] == file_id


def test_case_flag(testapp, sample_proc_fam, file_vcf, proband_case, mother_case):
    # add ann_vcf to sample_processing
    file_id = file_vcf['@id']
    testapp.patch_json(sample_proc_fam['@id'], {'processed_files': [file_id]})
    proband = testapp.get(proband_case['@id']).json
    mother = testapp.get(mother_case['@id']).json
    file_acc = file_id.split('/')[2]
    proband_sample_tag = "ext_id_006"
    mother_sample_tag = "ext_id_003"
    assert proband['filter_set_flag_addon'] == "&CALL_INFO={}&file={}".format(proband_sample_tag, file_acc)
    assert mother['filter_set_flag_addon'] == "&CALL_INFO={}&file={}".format(mother_sample_tag, file_acc)


def test_case_proband_case(testapp, proband_case, mother_case):
    assert proband_case['proband_case'] is True
    assert mother_case['proband_case'] is False
