import pytest
pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]


@pytest.fixture
def qc_metric_fastqc(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'Total Sequences': 123456,
        'Sequences flagged as poor quality': 123,
        'Per base sequence quality': 'PASS'
    }


@pytest.fixture
def qc_metric_fastqc_no_project(institution):
    return {
        'institution': institution['@id'],
        'project': 'not_a_project',
        'Total Sequences': 123456,
        'Sequences flagged as poor quality': 123,
        'Per base sequence quality': 'PASS'
    }


@pytest.fixture
def qc_metric_fastqc_bad_status(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'Total Sequences': 123456,
        'Sequences flagged as poor quality': 123,
        'Per base sequence quality': 'OOF'
    }


@pytest.fixture
def qc_bamcheck_data1(institution, project):
    return {
        "uuid": "af8e47c1-35bd-46fd-8a2e-e5d7b89560aa",
        'institution': institution['@id'],
        'project': project['@id'],
        "number_of_lines": 1234567,
        "quickcheck": "OK"
    }


@pytest.fixture
def qc_bamcheck_data2(institution, project):
    return {
        "uuid": "af8e47c1-35bd-46fd-8a2e-e5d7b89560ab",
        'institution': institution['@id'],
        'project': project['@id'],
        "number_of_lines": 1234568,
        "quickcheck": " not OK"
    }


@pytest.fixture
def vcf_qc(testapp, institution, project):
    item = {
        "uuid": "af8e47c1-35bd-46fd-8a2e-e5d7b8956111",
        'institution': institution['@id'],
        'project': project['@id'],
        "total variants":  [
            {"DEL": 476325, "INS": 427047, "MAV": 0, "MNV": 2962, "SNV": 3855162, "name": "NA12879_sample", "total": 4761496},
            {"DEL": 481574, "INS": 432004, "MAV": 0, "MNV": 2948, "SNV": 3853052, "name": "NA12878_sample", "total": 4769578},
            {"DEL": 486782, "INS": 441348, "MAV": 0, "MNV": 3083, "SNV": 3834002, "name": "NA12877_sample", "total": 4765215}],
        "heterozygosity ratio":  {
            "SNV":  [
                {"name": "NA12879_sample", "ratio": 1.63, "counts": {"het": 2388333, "hom": 1466829, "total": 3855162}},
                {"name": "NA12878_sample", "ratio": 1.63, "counts": {"het": 2386563, "hom": 1466489, "total": 3853052}},
                {"name": "NA12877_sample", "ratio": 1.56, "counts": {"het": 2339204, "hom": 1494798, "total": 3834002}}]
        },
        "overall_quality_status":  "PASS",
        "mendelian errors in trio":  {
            "SNV":   [
                {
                    "name": "NA12879_sample",
                    "counts": {"het": {"miss": 25792, "total": 2388333, "errors": 1223, "de_novo": 48148},
                               "hom": {"miss": 27539, "total": 1466829, "errors": 21467}}}]
        },
        "transition-transversion ratio":  [
            {"name": "NA12879_sample", "ratio": 1.96},
            {"name": "NA12878_sample", "ratio": 1.96},
            {"name": "NA12877_sample", "ratio": 1.96}],
        "uuid": "d918bc25-0888-4658-811b-53c20b944111"
    }
    return testapp.post_json('/quality_metric_vcfqc', item).json['@graph'][0]


@pytest.fixture
def bam_qc(testapp, institution, project):
    item = {
        'institution': institution['@id'],
        'project': project['@id'],
        "status": "in review",
        "coverage": "30x",
        "mapping stats": {"total reads": 467863567},
        "sample": "NA12879_sample",
        "overall_quality_status": "PASS",
        "uuid": "d918bc25-0888-4658-811b-53c20b944122"
    }
    return testapp.post_json('/quality_metric_bamqc', item).json['@graph'][0]


@pytest.fixture
def qclist(testapp, institution, project, bam_qc):
    item = {
        'institution': institution['@id'],
        'project': project['@id'],
        "status": "in review",
        "overall_quality_status": "PASS",
        "uuid": "f94b0c13-24f9-4be4-9663-5d2213c5678e",
        "qc_list": [{'qc_type': "quality_metric_bamqc",
                     'value': bam_qc['@id']}]
    }
    return testapp.post_json('/quality_metric_qclist', item).json['@graph'][0]


def test_post_qc_metric(testapp, qc_metric_fastqc):
    res = testapp.post_json('/quality_metric_fastqc', qc_metric_fastqc, status=201)
    assert res.json['@graph'][0]['overall_quality_status'] == "PASS"


def test_post_bad_qc(testapp, qc_metric_fastqc_bad_status, qc_metric_fastqc_no_project):
    testapp.post_json('/quality_metric_fastqc', qc_metric_fastqc_bad_status, status=422)
    testapp.post_json('/quality_metric_fastqc', qc_metric_fastqc_no_project, status=422)


def test_overall_quality_pass(testapp, qc_bamcheck_data1):
    res = testapp.post_json('/quality_metric_bamcheck', qc_bamcheck_data1, status=201)
    assert res.json['@graph'][0]['overall_quality_status'] == "PASS"


def test_overall_quality_fail(testapp, qc_bamcheck_data2):
    res = testapp.post_json('/quality_metric_bamcheck', qc_bamcheck_data2, status=201)
    assert res.json['@graph'][0]['overall_quality_status'] == "FAIL"


def test_quality_metric_summary_vcfqc(vcf_qc):
    summary = vcf_qc['quality_metric_summary']
    expected_summary = [
     {'title': 'Total Variants Called', 'sample': 'NA12879_sample', 'value': '4761496', 'numberType': 'integer'},
     {'title': 'Total Variants Called', 'sample': 'NA12878_sample', 'value': '4769578', 'numberType': 'integer'},
     {'title': 'Total Variants Called', 'sample': 'NA12877_sample', 'value': '4765215', 'numberType': 'integer'},
     {'title': 'Transition-Transversion Ratio', 'sample': 'NA12879_sample', 'value': '1.96', 'numberType': 'float'},
     {'title': 'Transition-Transversion Ratio', 'sample': 'NA12878_sample', 'value': '1.96', 'numberType': 'float'},
     {'title': 'Transition-Transversion Ratio', 'sample': 'NA12877_sample', 'value': '1.96', 'numberType': 'float'},
     {'title': 'Heterozygosity Ratio', 'sample': 'NA12879_sample', 'value': '1.63', 'tooltip': 'Het/Homo ratio', 'numberType': 'float'},
     {'title': 'Heterozygosity Ratio', 'sample': 'NA12878_sample', 'value': '1.63', 'tooltip': 'Het/Homo ratio', 'numberType': 'float'},
     {'title': 'Heterozygosity Ratio', 'sample': 'NA12877_sample', 'value': '1.56', 'tooltip': 'Het/Homo ratio', 'numberType': 'float'},
     {'title': 'De Novo Fraction', 'sample': 'NA12879_sample', 'value': '2.016', 'tooltip': 'Fraction of GATK-based de novo mutations among heterozygous SNVs', 'numberType': 'percent'}]
    for an_exp_info in expected_summary:
        assert an_exp_info in summary


def test_quality_metric_summary_bamqc(bam_qc):
    summary = bam_qc['quality_metric_summary']
    expected_summary = [
        {'title': 'Total Reads', 'sample': 'NA12879_sample', 'value': '467863567', 'numberType': 'integer'},
        {'title': 'Coverage', 'sample': 'NA12879_sample', 'value': '30x', 'numberType': 'string'}
        ]
    for an_exp_info in expected_summary:
        assert an_exp_info in summary


def test_quality_metric_qclist(qclist):
    summary = qclist['quality_metric_summary']
    expected_summary = [
        {'title': 'Total Reads', 'sample': 'NA12879_sample', 'value': '467863567', 'numberType': 'integer'},
        {'title': 'Coverage', 'sample': 'NA12879_sample', 'value': '30x', 'numberType': 'string'}
        ]
    for an_exp_info in expected_summary:
        assert an_exp_info in summary
