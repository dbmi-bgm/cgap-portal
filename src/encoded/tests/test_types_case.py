import pytest

from ..types.case import CaseQcMetricsCollector
from .utils import make_atid

pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


VCF_FILE_TYPE_PATCH = {"file_type": "full annotated VCF", "vcf_to_ingest": False}
VCF_PROPERTY_PATCH = {"file_type": "foo bar", "vcf_to_ingest": True}
VCF_NOT_FOUND_PATCH = {"file_type": "foo bar", "vcf_to_ingest": False}


@pytest.fixture
def second_fam(testapp, project, institution, mother, father, sister):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "title": "Smith family 2",
        "proband": mother["@id"],
        "members": [father["@id"], sister["@id"], mother["@id"]],
    }
    return testapp.post_json("/family", item).json["@graph"][0]


def test_case_case_title(testapp, proband_case, mother_case):
    proband_title = "proband_boy WGS-Group"
    mother_title = "mother_person WGS-Group - in proband_boyp"
    assert proband_title == proband_case["case_title"]
    assert mother_title == mother_case["case_title"]


def test_case_display_title(testapp, proband_case, mother_case):
    proband_title = "proband_boy WGS-Group (GAPCAP4E4GMG)"
    mother_title = "mother_person WGS-Group - in proband_boyp (GAPCAU1K3F5A)"
    assert proband_title == proband_case["display_title"]
    assert mother_title == mother_case["display_title"]


def test_case_case_title_with_institution_id(testapp, proband_case, mother_case):
    # add external id to proband ind
    testapp.patch_json("/individual/GAPIDPROBAND/", {"individual_id": "HMS_Proband01"})
    testapp.patch_json("/individual/GAPIDMOTHER1/", {"individual_id": "HMS_Mother01"})
    updated_proband_case = testapp.get(proband_case["@id"]).json
    updated_mother_case = testapp.get(mother_case["@id"]).json
    new_proband_title = "HMS_Proband01 WGS-Group"
    new_mother_title = "HMS_Mother01 WGS-Group - in HMS_Proband01p"
    new_proband_d_title = "HMS_Proband01 WGS-Group (GAPCAP4E4GMG)"
    new_mother_d_title = "HMS_Mother01 WGS-Group - in HMS_Proband01p (GAPCAU1K3F5A)"
    assert new_proband_title == updated_proband_case["case_title"]
    assert new_mother_title == updated_mother_case["case_title"]
    assert new_proband_d_title == updated_proband_case["display_title"]
    assert new_mother_d_title == updated_mother_case["display_title"]


def test_case_sample(testapp, proband_case, mother_case, sample_proc_fam):
    proband_sample = "/samples/GAPSAPROBAND/"
    mother_sample = "/samples/GAPSAMOTHER1/"
    assert proband_sample == proband_case["sample"]
    assert mother_sample == mother_case["sample"]

    # Remove mother sample from associated Individual
    mother_individual = testapp.get(
        mother_case["individual"], params="frame=object", status=200
    ).json
    mother_individual_samples = mother_individual["samples"]
    samples_without_mother_sample = list(
        set(mother_individual_samples).difference(set([mother_sample]))
    )
    patch_body = {"samples": samples_without_mother_sample}
    testapp.patch_json(mother_individual["@id"], patch_body, status=200)
    updated_mother_case = testapp.get(mother_case["@id"], status=200).json
    assert updated_mother_case.get("sample") == {}

    # Add proband and mother samples to mother individual
    # Since already on sample processing, intersection now > 1
    patch_body = {"samples": [proband_sample, mother_sample]}
    testapp.patch_json(mother_individual["@id"], patch_body, status=200)
    updated_mother_case = testapp.get(mother_case["@id"], status=200).json
    assert updated_mother_case.get("sample") == {}

    # Remove proband sample from shared SampleProcessing
    all_samples = sample_proc_fam["samples"]
    all_samples_except_proband = list(
        set(all_samples).difference(set([proband_sample]))
    )
    patch_body = {"samples": all_samples_except_proband}
    testapp.patch_json(sample_proc_fam["@id"], patch_body, status=200)
    updated_proband_case = testapp.get(proband_case["@id"], {}, status=200).json
    assert updated_proband_case.get("sample") == {}


def test_case_secondary_families(testapp, proband_case, mother_case, fam, second_fam):
    fam1_id = fam["@id"]
    fam2_id = second_fam["@id"]
    proband = testapp.get(proband_case["@id"]).json
    mother = testapp.get(mother_case["@id"]).json
    # assert proband has single family
    assert proband["family"]["@id"] == fam1_id
    assert proband.get("secondary_families") == []
    # assert mother has a second family
    assert mother["family"]["@id"] == fam1_id
    assert len(mother["secondary_families"]) == 1
    assert mother["secondary_families"][0]["@id"] == fam2_id


@pytest.mark.parametrize(
    "patch_body,expect_vcf",
    [
        (VCF_FILE_TYPE_PATCH, True),
        (VCF_PROPERTY_PATCH, True),
        (VCF_NOT_FOUND_PATCH, False),
    ],
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
    ],
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
    ],
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


def test_case_initial_search_href_filter_addon(
    testapp, sample_proc_fam, file_vcf, proband_case, mother_case
):
    # No SNV VCF on SampleProcessing
    assert proband_case.get("initial_search_href_filter_addon") == ""
    assert mother_case.get("initial_search_href_filter_addon") == ""

    # add ann_vcf to sample_processing
    file_id = file_vcf["@id"]
    testapp.patch_json(sample_proc_fam["@id"], {"processed_files": [file_id]})
    proband = testapp.get(proband_case["@id"]).json
    mother = testapp.get(mother_case["@id"]).json
    file_acc = file_id.split("/")[2]
    proband_sample_tag = "ext_id_006"
    mother_sample_tag = "ext_id_003"
    assert proband["initial_search_href_filter_addon"] == "CALL_INFO={}&file={}".format(
        proband_sample_tag, file_acc
    )
    assert mother["initial_search_href_filter_addon"] == "CALL_INFO={}&file={}".format(
        mother_sample_tag, file_acc
    )

    # Remove individual from proband case
    delete_individual_string = "?delete_fields=individual"
    updated_proband_case = testapp.patch_json(
        proband_case["@id"] + delete_individual_string, {}, status=200
    ).json["@graph"][0]
    assert updated_proband_case.get("individual") is None
    assert updated_proband_case.get("initial_search_href_filter_addon") == ""

    # Remove sample ID from mother sample
    mother_sample_atid = mother_case["sample"]
    delete_sample_id_string = "?delete_fields=bam_sample_id"
    updated_sample = testapp.patch_json(
        mother_sample_atid + delete_sample_id_string, {}, status=200
    ).json["@graph"][0]
    assert updated_sample.get("bam_sample_id") is None
    updated_mother_case = testapp.get(mother_case["@id"], status=200).json
    assert updated_mother_case.get("initial_search_href_filter_addon") == ""

    # Restore mother sample ID, then remove sample processing from case
    patch_body = {"bam_sample_id": mother_sample_tag}
    updated_sample = testapp.patch_json(
        mother_sample_atid, patch_body, status=200
    ).json["@graph"][0]
    assert updated_sample.get("bam_sample_id") == mother_sample_tag
    delete_sample_processing_string = "?delete_fields=sample_processing"
    updated_mother_case = testapp.patch_json(
        mother_case["@id"] + delete_sample_processing_string, {}, status=200
    ).json["@graph"][0]
    assert updated_mother_case.get("initial_search_href_filter_addon") == ""


def test_case_sv_initial_search_href_filter_addon(
    testapp, sample_proc_fam, file_vcf_sv, file_vcf_cnv, proband_case, mother_case
):
    property_name = "sv_initial_search_href_filter_addon"
    proband_sample_tag = "ext_id_006"
    mother_sample_tag = "ext_id_003"
    sv_file_id = file_vcf_sv["@id"]
    sv_file_accession = file_vcf_sv["accession"]
    cnv_file_id = file_vcf_cnv["@id"]
    cnv_file_accession = file_vcf_cnv["accession"]

    expected_proband_call_info = f"CALL_INFO={proband_sample_tag}"
    expected_mother_call_info = f"CALL_INFO={mother_sample_tag}"
    expected_sv_file = f"&file={sv_file_accession}"
    expected_cnv_file = f"&file={cnv_file_accession}"
    expected_proband_sv_addon = expected_proband_call_info + expected_sv_file
    expected_proband_cnv_addon = expected_proband_call_info + expected_cnv_file
    expected_proband_sv_cnv_addon = expected_proband_sv_addon + expected_cnv_file
    expected_mother_sv_cnv_addon = (
        expected_mother_call_info + expected_sv_file + expected_cnv_file
    )

    # No VCFs on SampleProcessing originally
    assert proband_case.get(property_name) == ""
    assert mother_case.get(property_name) == ""

    # Add SV VCF to SampleProcessing
    patch_body = {"processed_files": [sv_file_id]}
    testapp.patch_json(sample_proc_fam["@id"], patch_body, status=200)
    proband_case = testapp.get(proband_case["@id"]).json
    assert proband_case.get(property_name) == expected_proband_sv_addon

    # Add CNV VCF to SampleProcessing
    patch_body = {"processed_files": [cnv_file_id]}
    testapp.patch_json(sample_proc_fam["@id"], patch_body, status=200)
    proband_case = testapp.get(proband_case["@id"]).json
    assert proband_case.get(property_name) == expected_proband_cnv_addon

    # Add SV + CNV VCF to SampleProcessing
    patch_body = {"processed_files": [sv_file_id, cnv_file_id]}
    testapp.patch_json(sample_proc_fam["@id"], patch_body, status=200)
    proband_case = testapp.get(proband_case["@id"]).json
    mother_case = testapp.get(mother_case["@id"]).json
    assert proband_case.get(property_name) == expected_proband_sv_cnv_addon

    # Remove individual from proband case
    delete_individual_string = "?delete_fields=individual"
    proband_case = testapp.patch_json(
        proband_case["@id"] + delete_individual_string, {}, status=200
    ).json["@graph"][0]
    assert proband_case.get("individual") is None
    assert proband_case.get(property_name) == ""

    # Remove sample ID from mother sample
    assert mother_case.get(property_name) == expected_mother_sv_cnv_addon
    mother_sample_atid = mother_case["sample"]["@id"]
    delete_sample_id_string = "?delete_fields=bam_sample_id"
    updated_sample = testapp.patch_json(
        mother_sample_atid + delete_sample_id_string, {}, status=200
    ).json["@graph"][0]
    assert updated_sample.get("bam_sample_id") is None
    mother_case = testapp.get(mother_case["@id"], status=200).json
    assert mother_case.get(property_name) == ""

    # Restore mother sample ID, then remove sample processing from case
    patch_body = {"bam_sample_id": mother_sample_tag}
    updated_sample = testapp.patch_json(
        mother_sample_atid, patch_body, status=200
    ).json["@graph"][0]
    assert updated_sample.get("bam_sample_id") == mother_sample_tag
    mother_case = testapp.get(mother_case["@id"], status=200).json
    assert mother_case.get(property_name) == expected_mother_sv_cnv_addon
    delete_sample_processing_string = "?delete_fields=sample_processing"
    mother_case = testapp.patch_json(
        mother_case["@id"] + delete_sample_processing_string, {}, status=200
    ).json["@graph"][0]
    assert mother_case.get(property_name) == ""


@pytest.fixture
def new_sample_processing(testapp, project, institution, fam, file_vcf):
    data = {
        "project": project["@id"],
        "institution": institution["@id"],
        "samples": ["GAPSAPROBAND", "GAPSAFATHER1", "GAPSAMOTHER1", "GAPSABROTHER"],
        "families": [fam["@id"]],
        "processed_files": [file_vcf["@id"]],
    }
    return data


@pytest.fixture
def new_case(testapp, project, institution, fam, new_sample_processing):
    data = {
        "accession": "GAPCAP4E4GMG",
        "project": project["@id"],
        "institution": institution["@id"],
        "family": fam["@id"],
        "individual": "GAPIDPROBAND",
    }
    return data


@pytest.mark.parametrize(
    "num_samples, analysis_type, proband_only",
    [
        (1, None, True),
        (1, "WGS", True),  # proband only
        (2, "WGS-Group", False),  # proband and father
        (3, "WES-Trio", False),  # proband, father, mother
        (4, "WES-Group", False),
    ],
)  # proband, father, mother, brother
def test_case_additional_facets(
    testapp,
    new_case,
    new_sample_processing,
    num_samples,
    analysis_type,
    proband_only,
):
    """
    tests that additional facets are added to initial_search_href_filter_addon calc prop as appropriate:
    none for proband only, mother and father genotype labels for trio, mother/father/sibling
    genotype labels for quad.
    """
    genotype_relations = ["father", "mother", "brother", "sister"]
    if analysis_type is not None:
        new_sample_processing["analysis_type"] = analysis_type
    # limit samples to size of analysis we want to test
    new_sample_processing["samples"] = new_sample_processing["samples"][:num_samples]
    sample_processing = testapp.post_json(
        "/sample_processing", new_sample_processing, status=201
    ).json["@graph"][0]
    new_case["sample_processing"] = sample_processing["@id"]
    case = testapp.post_json("/case", new_case, status=201).json["@graph"][0]
    additional_vs_facets = case.get("additional_variant_sample_facets")
    if analysis_type is None:
        assert additional_vs_facets == []
    else:
        for relation in genotype_relations:
            if genotype_relations.index(relation) + 2 <= num_samples:
                # genotype labels for this relation should be an additional facet in prop
                assert (
                    f"associated_genotype_labels.{relation}_genotype_label"
                    in additional_vs_facets
                )
            else:
                # genotype labels for this relation should NOT be an additional facet in this prop
                assert (
                    f"associated_genotype_labels.{relation}_genotype_label"
                    not in additional_vs_facets
                )
        if proband_only:
            assert "proband_only_inheritance_modes" in additional_vs_facets
            assert "inheritance_modes" not in additional_vs_facets
        else:
            assert "proband_only_inheritance_modes" not in additional_vs_facets
            assert "inheritance_modes" in additional_vs_facets


def test_case_proband_case(testapp, proband_case, mother_case):
    assert proband_case["proband_case"] is True
    assert mother_case["proband_case"] is False


def test_case_default_title_case_id(testapp, proband_case):
    testapp.patch_json(proband_case["@id"], {"case_id": "proband case from a family"})
    proband = testapp.get(proband_case["@id"]).json
    proband_case_title = "proband case from a family"
    proband_case_d_title = "proband case from a family (GAPCAP4E4GMG)"
    assert proband["case_title"] == proband_case_title
    assert proband["display_title"] == proband_case_d_title


class TestCaseQcMetricsCollector:

    SAMPLE_QC_NO_FAIL_NO_WARN_NO_PASS = {"foo": ["bar"], "completed_qcs": ["fu"]}
    SAMPLE_QC_PASS = {"foo": {"flag": "pass"}, "completed_qcs": ["fu", "bur"]}
    SAMPLE_QC_FAIL = {
        "fail": ["foo", "bar", "bu"],
        "warn": [],
        "completed_qcs": ["fu", "fur"],
    }
    SAMPLE_QC_WARN = {
        "fail": [],
        "warn": ["foo", "bar"],
        "completed_qcs": ["gur", "fu"],
    }
    SAMPLE_QC_NO_COMPLETED_QCS = {"fail": ["foo"], "warn": ["bar"]}
    SAMPLE_QC_NON_INTERSECTING_COMPLETED_QCS = {"completed_qcs": ["bu"]}

    EMPTY_QCS = []
    NON_PASSING_QCS = [SAMPLE_QC_NO_FAIL_NO_WARN_NO_PASS]
    PASSING_QCS = [SAMPLE_QC_NO_FAIL_NO_WARN_NO_PASS, SAMPLE_QC_PASS]
    WARNING_QCS = [SAMPLE_QC_WARN, SAMPLE_QC_PASS]
    FAILING_QCS = [SAMPLE_QC_FAIL, SAMPLE_QC_PASS]
    FAILING_AND_WARNING_QCS = [SAMPLE_QC_WARN, SAMPLE_QC_PASS, SAMPLE_QC_FAIL]
    FAILING_QCS_NO_COMPLETED_1 = FAILING_AND_WARNING_QCS + [SAMPLE_QC_NO_COMPLETED_QCS]
    FAILING_QCS_NO_COMPLETED_2 = FAILING_AND_WARNING_QCS + [
        SAMPLE_QC_NON_INTERSECTING_COMPLETED_QCS
    ]

    def make_expected_flag_result(flag, warn_count=0, fail_count=0, completed_qcs=None):
        result = {"warn": warn_count, "fail": fail_count}
        if flag:
            result["flag"] = flag
        if completed_qcs:
            result["completed_qcs"] = completed_qcs
        return result

    EMPTY_QCS_RESULT = None
    NON_PASSING_QCS_RESULT = make_expected_flag_result(None, 0, 0, ["fu"])
    PASSING_QCS_RESULT = make_expected_flag_result("pass", 0, 0, ["fu"])
    WARNING_QCS_RESULT = make_expected_flag_result("warn", 2, 0, ["fu"])
    FAILING_QCS_RESULT = make_expected_flag_result("fail", 0, 3, ["fu"])
    FAILING_AND_WARNING_QCS_RESULT = make_expected_flag_result("fail", 2, 3, ["fu"])
    FAILING_QCS_NO_COMPLETED_1_RESULT = make_expected_flag_result("fail", 3, 4)
    FAILING_QCS_NO_COMPLETED_2_RESULT = make_expected_flag_result("fail", 2, 3)

    def empty_case_qc_metrics_collector(self):
        return CaseQcMetricsCollector(self.EMPTY_QCS)

    @pytest.mark.parametrize(
        "qc_metrics,expected",
        [
            (EMPTY_QCS, EMPTY_QCS_RESULT),
            (NON_PASSING_QCS, NON_PASSING_QCS_RESULT),
            (PASSING_QCS, PASSING_QCS_RESULT),
            (WARNING_QCS, WARNING_QCS_RESULT),
            (FAILING_QCS, FAILING_QCS_RESULT),
            (FAILING_AND_WARNING_QCS, FAILING_AND_WARNING_QCS_RESULT),
            (FAILING_QCS_NO_COMPLETED_1, FAILING_QCS_NO_COMPLETED_1_RESULT),
            (FAILING_QCS_NO_COMPLETED_2, FAILING_QCS_NO_COMPLETED_2_RESULT),
        ],
    )
    def test_get_quality_control_flags(self, qc_metrics, expected):
        qc_flag_collector = CaseQcMetricsCollector(qc_metrics)
        result = qc_flag_collector.get_quality_control_flags()
        assert result == expected

    @pytest.mark.parametrize(
        "qc_metric,expected_fail_count,expected_warn_count,expected_pass_flag_present",
        [
            ({}, 0, 0, False),
            (SAMPLE_QC_NO_FAIL_NO_WARN_NO_PASS, 0, 0, False),
            (SAMPLE_QC_PASS, 0, 0, True),
            (SAMPLE_QC_FAIL, 3, 0, False),
            (SAMPLE_QC_WARN, 0, 2, False),
            (SAMPLE_QC_NO_COMPLETED_QCS, 1, 1, False),
        ],
    )
    def test_collect_flags(
        self,
        qc_metric,
        expected_fail_count,
        expected_warn_count,
        expected_pass_flag_present,
    ):
        qc_flag_collector = self.empty_case_qc_metrics_collector()
        qc_flag_collector.collect_flags(qc_metric)
        assert qc_flag_collector.fail_count == expected_fail_count
        assert qc_flag_collector.warn_count == expected_warn_count
        assert qc_flag_collector.pass_flag_present == expected_pass_flag_present

    @pytest.mark.parametrize(
        "qc_metric,expected",
        [({}, False), (SAMPLE_QC_PASS, True), (SAMPLE_QC_FAIL, False)],
    )
    def test_is_pass_flag_present(self, qc_metric, expected):
        qc_flag_collector = self.empty_case_qc_metrics_collector()
        result = qc_flag_collector.is_pass_flag_present(qc_metric)
        assert result == expected

    @pytest.mark.parametrize(
        "sample_completed_steps,expected",
        [
            ([], []),
            ([["foo", "bar"]], ["bar", "foo"]),
            ([["foo"], ["bar"]], []),
            ([["foo", "bar"], ["bar"]], ["bar"]),
        ],
    )
    def test_calculate_completed_steps(self, sample_completed_steps, expected):
        qc_flag_collector = self.empty_case_qc_metrics_collector()
        qc_flag_collector.sample_completed_steps = sample_completed_steps
        qc_flag_collector.calculate_completed_steps()
        assert qc_flag_collector.completed_steps == expected


@pytest.mark.workbook
def test_quality_control_flags(es_testapp, workbook):
    """Integrated test of calcprop with workbook inserts.

    Requires cases with exact accessions as defined below.

    Tests calcprop on cases as they exist in inserts, then manipulates
    files on one case and and tests impacts on calcprop.
    """

    case_no_sample_processing_accession = "GAPFIH74RE9U"
    case_no_samples_accession = "GAPFIO67BOS3"
    case_two_samples_accession = "GAPCAJQ1L99X"
    case_one_sample_no_vcfs_accession = "GAPFIM83GOP9"
    case_one_sample_no_files_accession = "GAPFIV50ST2Q"

    case_no_sample_processing_atid = make_atid(
        case_no_sample_processing_accession, item_type="case"
    )
    case_no_samples_atid = make_atid(case_no_samples_accession, item_type="case")
    case_two_samples_atid = make_atid(case_two_samples_accession, item_type="case")
    case_one_sample_no_vcfs_atid = make_atid(
        case_one_sample_no_vcfs_accession, item_type="case"
    )
    case_one_sample_no_files_atid = make_atid(
        case_one_sample_no_files_accession, item_type="case"
    )

    case_no_sample_processing = es_testapp.get(
        case_no_sample_processing_atid, status=200
    ).json
    assert case_no_sample_processing.get("quality_control_flags") is None

    case_no_samples = es_testapp.get(case_no_samples_atid, status=200).json
    assert case_no_samples.get("quality_control_flags") is None

    case_two_samples = es_testapp.get(case_two_samples_atid, status=200).json
    assert case_two_samples.get("quality_control_flags") == {
        "flag": "fail",
        "fail": 2,
        "warn": 3,
        "completed_qcs": ["BAM", "SNV", "SV"],
    }

    case_one_sample_no_vcfs = es_testapp.get(
        case_one_sample_no_vcfs_atid, status=200
    ).json
    assert case_one_sample_no_vcfs.get("quality_control_flags") == {
        "flag": "fail",
        "fail": 1,
        "warn": 0,
        "completed_qcs": ["BAM"],
    }

    case_one_sample_no_files = es_testapp.get(
        case_one_sample_no_files_atid, status=200
    ).json
    assert case_one_sample_no_files.get("quality_control_flags") == {
        "fail": 0,
        "warn": 0,
    }
