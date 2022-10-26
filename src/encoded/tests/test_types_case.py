import pytest

from ..types.case import Case

pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


VCF_FILE_TYPE_PATCH = {"file_type": "full annotated VCF", "vcf_to_ingest": False}
VCF_PROPERTY_PATCH = {"file_type": "foo bar", "vcf_to_ingest": True}
VCF_NOT_FOUND_PATCH = {"file_type": "foo bar", "vcf_to_ingest": False}
SAMPLE_QC_ALL_PASS = {"fail": [], "warn": []}
SAMPLE_QC_3_FAIL = {"fail": ["foo", "bar", "bu"], "warn": []}
SAMPLE_QC_2_WARN = {"fail": [], "warn": ["foo", "bar"]}
PASSING_QCS = [{}, SAMPLE_QC_ALL_PASS]
FAIL_3_QCS = [SAMPLE_QC_ALL_PASS, SAMPLE_QC_3_FAIL]
WARN_2_QCS = [SAMPLE_QC_ALL_PASS, SAMPLE_QC_2_WARN]
WARN_2_FAIL_3_QCS = [SAMPLE_QC_2_WARN, SAMPLE_QC_ALL_PASS, SAMPLE_QC_3_FAIL]


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
    proband_title = 'proband_boy WGS-Group'
    mother_title = 'mother_person WGS-Group - in proband_boyp'
    assert proband_title == proband_case['case_title']
    assert mother_title == mother_case['case_title']


def test_case_display_title(testapp, proband_case, mother_case):
    proband_title = 'proband_boy WGS-Group (GAPCAP4E4GMG)'
    mother_title = 'mother_person WGS-Group - in proband_boyp (GAPCAU1K3F5A)'
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


@pytest.mark.parametrize(
    "patch_body,expect_vcf",
    [
        (VCF_FILE_TYPE_PATCH, True),
        (VCF_PROPERTY_PATCH, True),
        (VCF_NOT_FOUND_PATCH, False),
    ]
)
def test_case_vcf(
    testapp,
    sample_proc_fam,
    file_vcf,
    file_vcf_sv,
    file_vcf_cnv,
    proband_case,
    mother_case,
    patch_body,
    expect_vcf,
):
    """Test retrieval of SNV VCF from SampleProcessing.

    Ensure file found when VCFs for other variant types also present.
    """
    file_id = file_vcf["@id"]
    testapp.patch_json(file_id, patch_body, status=200)
    all_vcfs = [file_id, file_vcf_sv["@id"], file_vcf_cnv["@id"]]
    testapp.patch_json(
        sample_proc_fam["@id"], {"processed_files": all_vcfs}, status=200
    )
    proband = testapp.get(proband_case["@id"]).json
    mother = testapp.get(mother_case["@id"]).json
    if expect_vcf:
        assert proband["vcf_file"]["@id"] == file_id
        assert mother["vcf_file"]["@id"] == file_id
    else:
        assert proband.get("vcf_file") is None
        assert mother.get("vcf_file") is None


@pytest.mark.parametrize(
    "patch_body,expect_vcf",
    [
        (VCF_FILE_TYPE_PATCH, True),
        (VCF_PROPERTY_PATCH, True),
        (VCF_NOT_FOUND_PATCH, False),
    ]
)
def test_case_sv_vcf(
    testapp,
    sample_proc_fam,
    file_vcf,
    file_vcf_sv,
    file_vcf_cnv,
    proband_case,
    mother_case,
    patch_body,
    expect_vcf,
):
    """Test retrieval of SV VCF from SampleProcessing.

    Ensure file found when VCFs for other variant types also present.
    """
    file_id = file_vcf_sv["@id"]
    testapp.patch_json(file_id, patch_body, status=200)
    all_vcfs = [file_id, file_vcf["@id"], file_vcf_cnv["@id"]]
    testapp.patch_json(
        sample_proc_fam["@id"], {"processed_files": all_vcfs}, status=200
    )
    proband = testapp.get(proband_case["@id"]).json
    mother = testapp.get(mother_case["@id"]).json
    if expect_vcf:
        assert proband["structural_variant_vcf_file"]["@id"] == file_id
        assert mother["structural_variant_vcf_file"]["@id"] == file_id
    else:
        assert proband.get("structural_variant_vcf_file") is None
        assert mother.get("structural_variant_vcf_file") is None


@pytest.mark.parametrize(
    "patch_body,expect_vcf",
    [
        (VCF_FILE_TYPE_PATCH, True),
        (VCF_PROPERTY_PATCH, True),
        (VCF_NOT_FOUND_PATCH, False),
    ]
)
def test_case_cnv_vcf(
    testapp,
    sample_proc_fam,
    file_vcf,
    file_vcf_sv,
    file_vcf_cnv,
    proband_case,
    mother_case,
    patch_body,
    expect_vcf,
):
    """Test retrieval of CNV VCF from SampleProcessing.

    Ensure file found when VCFs for other variant types also present.
    """
    file_id = file_vcf_cnv["@id"]
    testapp.patch_json(file_id, patch_body, status=200)
    all_vcfs = [file_id, file_vcf["@id"], file_vcf_sv["@id"]]
    testapp.patch_json(
        sample_proc_fam["@id"], {"processed_files": all_vcfs}, status=200
    )
    proband = testapp.get(proband_case["@id"]).json
    mother = testapp.get(mother_case["@id"]).json
    if expect_vcf:
        assert proband["cnv_vcf_file"]["@id"] == file_id
        assert mother["cnv_vcf_file"]["@id"] == file_id
    else:
        assert proband.get("cnv_vcf_file") is None
        assert mother.get("cnv_vcf_file") is None


def test_case_flag(testapp, sample_proc_fam, file_vcf, proband_case, mother_case):
    # add ann_vcf to sample_processing
    file_id = file_vcf['@id']
    testapp.patch_json(sample_proc_fam['@id'], {'processed_files': [file_id]})
    proband = testapp.get(proband_case['@id']).json
    mother = testapp.get(mother_case['@id']).json
    file_acc = file_id.split('/')[2]
    proband_sample_tag = "ext_id_006"
    mother_sample_tag = "ext_id_003"
    assert proband['initial_search_href_filter_addon'] == "CALL_INFO={}&file={}".format(proband_sample_tag, file_acc)
    assert mother['initial_search_href_filter_addon'] == "CALL_INFO={}&file={}".format(mother_sample_tag, file_acc)


def test_case_sv_flag(
    testapp, sample_proc_fam, file_vcf_sv, file_vcf_cnv, proband_case, mother_case
):
    sv_file_id = file_vcf_sv["@id"]
    sv_file_accession = file_vcf_sv["accession"]
    cnv_file_id = file_vcf_cnv["@id"]
    cnv_file_accession = file_vcf_cnv["accession"]
    patch_body = {"processed_files": [sv_file_id, cnv_file_id]}
    testapp.patch_json(
        sample_proc_fam["@id"], patch_body, status=200
    )
    proband = testapp.get(proband_case["@id"]).json
    mother = testapp.get(mother_case["@id"]).json
    proband_sample_tag = "ext_id_006"
    mother_sample_tag = "ext_id_003"
    proband_flag = "CALL_INFO={}&file={}&file={}".format(
        proband_sample_tag, sv_file_accession, cnv_file_accession
    )
    mother_flag = "CALL_INFO={}&file={}&file={}".format(
        mother_sample_tag, sv_file_accession, cnv_file_accession
    )
    assert proband['sv_initial_search_href_filter_addon'] == proband_flag
    assert mother['sv_initial_search_href_filter_addon'] == mother_flag


@pytest.fixture
def new_sample_processing(testapp, project, institution, fam, file_vcf):
    data = {
        'project': project['@id'],
        'institution': institution['@id'],
        'samples': [
            "GAPSAPROBAND",
            "GAPSAFATHER1",
            "GAPSAMOTHER1",
            "GAPSABROTHER"
            ],
        'families': [fam['@id']],
        'processed_files': [file_vcf['@id']]
    }
    return data


@pytest.fixture
def new_case(testapp, project, institution, fam, new_sample_processing):
    data = {
        "accession": "GAPCAP4E4GMG",
        'project': project['@id'],
        'institution': institution['@id'],
        'family': fam['@id'],
        'individual': 'GAPIDPROBAND'
    }
    return data


@pytest.mark.parametrize('num_samples, analysis_type, proband_only', [
    (1, 'WGS', True),  # proband only
    (2, 'WGS-Group', False),  # proband and father
    (3, 'WES-Trio', False),  # proband, father, mother
    (4, 'WES-Group', False)])  # proband, father, mother, brother
def test_case_additional_facets(testapp, project, institution, new_case,
                                new_sample_processing, num_samples, analysis_type, proband_only):
    """
    tests that additional facets are added to initial_search_href_filter_addon calc prop as appropriate:
    none for proband only, mother and father genotype labels for trio, mother/father/sibling
    genotype labels for quad.
    """
    genotype_relations = ['father', 'mother', 'brother', 'sister']
    new_sample_processing['analysis_type'] = analysis_type
    # limit samples to size of analysis we want to test
    new_sample_processing['samples'] = new_sample_processing['samples'][:num_samples]
    sp = testapp.post_json('/sample_processing', new_sample_processing).json['@graph'][0]
    new_case['sample_processing'] = sp['@id']
    case = testapp.post_json('/case', new_case).json['@graph'][0]
    for relation in genotype_relations:
        if genotype_relations.index(relation) + 2 <= num_samples:
            # genotype labels for this relation should be an additional facet in prop
            assert (f'associated_genotype_labels.{relation}_genotype_label'
                    in case['additional_variant_sample_facets'])
        else:
            # genotype labels for this relation should NOT be an additional facet in this prop
            assert (f'associated_genotype_labels.{relation}_genotype_label'
                    not in case['additional_variant_sample_facets'])
    if proband_only:
        assert 'proband_only_inheritance_modes' in case['additional_variant_sample_facets']
        assert 'inheritance_modes' not in case['additional_variant_sample_facets']
    else:
        assert 'proband_only_inheritance_modes' not in case['additional_variant_sample_facets']
        assert 'inheritance_modes' in case['additional_variant_sample_facets']


def test_case_proband_case(testapp, proband_case, mother_case):
    assert proband_case['proband_case'] is True
    assert mother_case['proband_case'] is False


def test_case_default_title_case_id(testapp, proband_case):
    testapp.patch_json(proband_case['@id'], {'case_id': 'proband case from a family'})
    proband = testapp.get(proband_case['@id']).json
    proband_case_title = 'proband case from a family'
    proband_case_d_title = 'proband case from a family (GAPCAP4E4GMG)'
    assert proband['case_title'] == proband_case_title
    assert proband['display_title'] == proband_case_d_title


def test_quality_control_flags(
    testapp, child_case, sample_processing, sample_proc_fam
):
    """Integrated test of calcprop."""
    child_case_id = child_case["@id"]

    # SampleProcessing with many QCs
    qc_flags = child_case.get("quality_control_flags")
    assert qc_flags == {"flag": "fail", "warn": 3, "fail": 2}

    # SampleProcessing with no QCs
    patch_body = {"sample_processing": sample_proc_fam["@id"]}
    response = testapp.patch_json(
        child_case_id, patch_body, status=200
    ).json["@graph"][0]
    qc_flags = response.get("quality_control_flags")
    assert qc_flags is None

    # No SampleProcessing
    case = testapp.get(child_case["@id"], params="frame=raw", status=200).json
    del case["sample_processing"]
    response = testapp.put_json(
        child_case_id, case, status=200
    ).json["@graph"][0]
    qc_flags = response.get("quality_control_flags")
    assert qc_flags is None


def make_expected_flag_result(flag, warn_count=0, fail_count=0):
    """Helper for making test parameters."""
    return {"flag": flag, "warn": warn_count, "fail": fail_count}


@pytest.mark.parametrize(
    "quality_control_metrics,expected",
    [
        (None, None),
        ([], make_expected_flag_result("pass")),
        (PASSING_QCS, make_expected_flag_result("pass")),
        (FAIL_3_QCS, make_expected_flag_result("fail", fail_count=3)),
        (WARN_2_QCS, make_expected_flag_result("warn", warn_count=2)),
        (WARN_2_FAIL_3_QCS, make_expected_flag_result("fail", fail_count=3,
            warn_count=2)),
    ]
)
def test_get_flags(quality_control_metrics, expected):
    """Unit test for collecting and counting flags from
    SampleProcessing.
    """
    sample_processing = {"quality_control_metrics": quality_control_metrics}
    result = Case._get_flags(sample_processing)
    assert result == expected
