from unittest import mock

import pytest

from ..types import sample as sample_type_module


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
        'specimen_type': 'peripheral blood',
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


def test_post_invalid_samples(testapp, sample_no_project):
    testapp.post_json('/sample', sample_no_project, status=422)


def test_post_valid_patch_error(testapp, sample_one):
    res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    testapp.patch_json(res['@id'], {'date_received': '12-3-2003'}, status=422)
    testapp.patch_json(res['@id'], {'project': 'does_not_exist'}, status=422)


def test_sample_individual_revlink(testapp, sample_one, MIndividual):
    sample_res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    assert not sample_res.get('individual')
    indiv_res = testapp.patch_json(MIndividual['@id'], {'samples': [sample_res['@id']]}, status=200).json['@graph'][0]
    sample_indiv = testapp.get(sample_res['@id']).json.get('individual')
    assert sample_indiv['@id'] == indiv_res['@id']


def test_sample_requisition_completed_accepted(testapp, sample_one):
    res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    assert not res.get('requisition_completed')
    res2 = testapp.patch_json(res['@id'], {'specimen_accession_date': '2020-01-01'}, status=200).json['@graph'][0]
    assert res2.get('requisition_completed') is False
    res3 = testapp.patch_json(res['@id'], {'requisition_acceptance': {'accepted_rejected': 'Accepted'}},
                              status=200).json['@graph'][0]
    assert res3.get('requisition_completed') is True


def test_sample_requisition_completed_rejected(testapp, sample_one):
    sample_one['requisition_acceptance'] = {'accepted_rejected': 'Rejected'}
    res = testapp.post_json('/sample', sample_one, status=201).json['@graph'][0]
    assert res.get('requisition_completed') is False
    patch_info = res.get('requisition_acceptance')
    patch_info['date_completed'] = '2020-03-01'
    res2 = testapp.patch_json(res['@id'], {'requisition_acceptance': patch_info}, status=200).json['@graph'][0]
    assert res2.get('requisition_completed') is True


# Sample Processing Tests
def test_sample_processing_pedigree(testapp, sample_proc_fam):
    """This is an end to end test for calculating relationships
    Test for roles"""
    expected_values = {
        'GAPIDPROBAND': {'sample_accession': 'GAPSAPROBAND', 'sample_name': 'ext_id_006',
                         'parents': ['GAPIDMOTHER1', 'GAPIDFATHER1'], 'relationship': 'proband', 'sex': 'M'},
        'GAPIDFATHER1': {'sample_accession': 'GAPSAFATHER1', 'sample_name': 'ext_id_004',
                         'parents': [], 'relationship': 'father', 'sex': 'M'},
        'GAPIDMOTHER1': {'sample_accession': 'GAPSAMOTHER1', 'sample_name': 'ext_id_003',
                         'parents': ['GAPIDGRANDMA', 'GAPIDGRANDPA'], 'relationship': 'mother', 'sex': 'F'},
        'GAPIDBROTHER': {'sample_accession': 'GAPSABROTHER', 'sample_name': 'ext_id_009',
                         'parents': ['GAPIDMOTHER1', 'GAPIDFATHER1'], 'relationship': 'brother', 'sex': 'M'},
        'GAPIDGRANDPA': {'sample_accession': 'GAPSAGRANDPA', 'sample_name': 'ext_id_002',
                         'parents': [], 'relationship': 'grandfather', 'sex': 'M', 'association': 'maternal'},
        'GAPIDGRANDMA': {'sample_accession': 'GAPSAGRANDMA', 'sample_name': 'ext_id_001',
                         'parents': [], 'relationship': 'grandmother', 'sex': 'F', 'association': 'maternal'},
        'GAPIDHALFSIS': {'sample_accession': 'GAPSAHALFSIS', 'sample_name': 'ext_id_008',
                         'parents': ['GAPIDMOTHER1'], 'relationship': 'half-sister', 'sex': 'F'},
        'GAPIDUNCLE01': {'sample_accession': 'GAPSAUNCLE01', 'sample_name': 'ext_id_005',
                         'parents': ['GAPIDGRANDPA'], 'relationship': 'uncle', 'sex': 'M', 'association': 'maternal'},
        'GAPIDCOUSIN1': {'sample_accession': 'GAPSACOUSIN1', 'sample_name': 'ext_id_007',
                         'parents': ['GAPIDUNCLE01'], 'relationship': 'cousin', 'sex': 'F', 'association': 'maternal'}
    }
    calculated_values = sample_proc_fam['samples_pedigree']

    for a_sample in calculated_values:
        expected_value = expected_values[a_sample['individual']]
        for a_key in expected_value:
            assert a_sample[a_key] == expected_value[a_key]


def test_sample_processing_pedigree_bam_location(testapp, sample_proc_fam, proband_processed_file):
    """This is an end to end test for calculating relationships Test for roles"""
    bam_upload_key = proband_processed_file['upload_key']
    calculated_values = sample_proc_fam['samples_pedigree']
    proband_info = [i for i in calculated_values if i['individual'] == 'GAPIDPROBAND'][0]
    assert proband_info['bam_location'] == bam_upload_key


@pytest.fixture
def empty_quality_metric_parser():
    """"""
    return sample_type_module.QualityMetricParser(None)


class TestQualityMetricParser:

    SOME_SAMPLES = ["sample_1", "sample_2"]
    VCF_FILE_FORMAT = "/file-formats/vcf_gz/"
    FILE_PROCESSED_SNV_FINAL_VCF_1 = {
        "variant_type": "SNV",
        "vcf_to_ingest": True,
        "file_format": VCF_FILE_FORMAT,
    }
    FILE_PROCESSED_SNV_FINAL_VCF_2 = {
        "variant_type": "SNV",
        "file_type": "full annotated VCF",
        "file_format": VCF_FILE_FORMAT,
    }
    FILE_PROCESSED_SV_FINAL_VCF = {
        "variant_type": "SV",
        "vcf_to_ingest": True,
        "file_format": VCF_FILE_FORMAT,
    }
    SOME_PEDDY_QC_ATID = "/quality-metrics-peddyqc/some_uuid/"
    SOME_PEDDY_QC_DOWNLOAD = SOME_PEDDY_QC_ATID + "@@download"
    SOME_PEDDY_QC_LINK = {"peddy_qc_download": SOME_PEDDY_QC_DOWNLOAD}
    FILE_PROCESSED_SNV_VEP_VCF = {
        "variant_type": "SNV",
        "file_type": "Vep-annotated VCF",
        "file_format": VCF_FILE_FORMAT,
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
            {"qc_type": "quality_metric_peddyqc", "value": SOME_PEDDY_QC_ATID},
        ],
    }
    FILE_PROCESSED_SNV_VEP_VCF_NO_PEDDYQC = {
        "variant_type": "SNV",
        "file_type": "Vep-annotated VCF",
        "file_format": VCF_FILE_FORMAT,
        "qc_list": [
            {"qc_type": "foo", "value": "bar"},
        ],
    }
    FILE_PROCESSED_NON_VCF = {
        "file_format": "foo",
        "file_type": "bar",
    }
    PROCESSED_FILES_1 = [
        FILE_PROCESSED_SNV_FINAL_VCF_1,
        FILE_PROCESSED_SV_FINAL_VCF,
        FILE_PROCESSED_SNV_VEP_VCF,
    ]
    PROCESSED_FILES_2 = [
        FILE_PROCESSED_SNV_VEP_VCF_NO_PEDDYQC,
        FILE_PROCESSED_SV_FINAL_VCF,
        FILE_PROCESSED_NON_VCF,
        FILE_PROCESSED_SNV_FINAL_VCF_1,
    ]

    @pytest.mark.parametrize(
        "samples,processed_files,expected_associate_vcf_metrics_calls",
        [
            ([], [], []),
            (SOME_SAMPLES, [], []),
            (
                SOME_SAMPLES,
                PROCESSED_FILES_1,
                [
                    mock.call(FILE_PROCESSED_SNV_FINAL_VCF_1),
                    mock.call(FILE_PROCESSED_SV_FINAL_VCF),
                    mock.call(FILE_PROCESSED_SNV_VEP_VCF, links=SOME_PEDDY_QC_LINK),
                ]
            ),
            (
                SOME_SAMPLES,
                PROCESSED_FILES_2,
                [
                    mock.call(FILE_PROCESSED_SNV_VEP_VCF_NO_PEDDYQC, links={}),
                    mock.call(FILE_PROCESSED_SV_FINAL_VCF),
                    mock.call(FILE_PROCESSED_SNV_FINAL_VCF_1),
                ]
            ),
        ]
    )
    def test_get_qc_display_results(
        self, empty_quality_metric_parser, samples, processed_files,
        expected_associate_vcf_metrics_calls,
    ):
        """"""
        items_to_get = samples + processed_files
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "collect_sample_data",
        ) as mocked_collect_sample_data:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "get_item",
                side_effect=items_to_get,
            ):
                with mock.patch.object(
                    sample_type_module.QualityMetricParser,
                    "associate_vcf_metrics_with_samples",
                ) as mocked_associate_vcf_metrics:
                    empty_quality_metric_parser.get_qc_display_results(
                        samples, processed_files
                    )
                    collect_sample_calls = mocked_collect_sample_data.call_args_list
                    if samples:
                        expected_sample_calls = [mock.call(item) for item in samples]
                        assert collect_sample_calls == expected_sample_calls
                    else:
                        assert collect_sample_calls == []
                    associate_vcf_calls = mocked_associate_vcf_metrics.call_args_list
                    assert associate_vcf_calls == expected_associate_vcf_metrics_calls

    @pytest.mark.parametrize(
        "item_atid,expected_call,expected_result",
        [
            (None, [], None),
            ("", ["", ""], "foo"),
            ("not_an_atid", ["not_an_atid", "not_an_atid"], "foo"),
            ("/something/a_uuid/", ["/something/a_uuid", "something"], "foo"),
        ]
    )
    def test_get_item(
        self, empty_quality_metric_parser, item_atid, expected_call, expected_result
    ):
        """"""
        mock_get_item_or_none_return_value = "foo"
        with mock.patch.object(
            sample_type_module,
            "get_item_or_none",
            return_value=mock_get_item_or_none_return_value,
        ) as mocked_get_item_or_none:
            result = empty_quality_metric_parser.get_item(item_atid)
            if expected_call:
                expected_call = [empty_quality_metric_parser.request] + expected_call
                assert mocked_get_item_or_none.called_once_with(expected_call)
            assert result == expected_result

    SOME_INDIVIDUAL_ATID = "/individuals/foo/"
    SOME_FILE_ATIDS = ["/files-processed/file_1/", "/files-processed/file_2/"]
    SOME_BAM_SAMPLE_ID = "sample_1"
    SAMPLE_WITHOUT_ID = {
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }
    SAMPLE = {
        "bam_sample_id": SOME_BAM_SAMPLE_ID,
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }
    WGS_SAMPLE = {
        "bam_sample_id": SOME_BAM_SAMPLE_ID,
        "work_up_type": "WGS",
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }
    WES_SAMPLE = {
        "bam_sample_id": SOME_BAM_SAMPLE_ID,
        "work_up_type": "WES",
        "individual": SOME_INDIVIDUAL_ATID,
        "processed_files": SOME_FILE_ATIDS,
    }

    @pytest.mark.parametrize(
        "sample_item,expected_sample_mapping",
        [
            (SAMPLE_WITHOUT_ID, {}),
            (SAMPLE, {SOME_BAM_SAMPLE_ID: {}}),
            (WGS_SAMPLE, {SOME_BAM_SAMPLE_ID: {"sequence_type": "WGS"}}),
            (WES_SAMPLE, {SOME_BAM_SAMPLE_ID: {"sequence_type": "WES"}}),
        ]
    )
    def test_collect_sample_data(
        self, empty_quality_metric_parser, sample_item, expected_sample_mapping
    ):
        """"""
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "collect_individual_data",
        ) as mocked_collect_individual_data:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "collect_processed_files_data",
            ) as mocked_collect_file_data:
                empty_quality_metric_parser.collect_sample_data(sample_item)
                result_sample_mapping = empty_quality_metric_parser.sample_mapping
                assert result_sample_mapping == expected_sample_mapping
                mocked_collect_individual_data.assert_called_once()
                individual_call = mocked_collect_individual_data.call_args[0]
                assert self.SOME_INDIVIDUAL_ATID == individual_call[0]
                mocked_collect_file_data.assert_called_once()
                file_call = mocked_collect_file_data.call_args[0]
                assert self.SOME_FILE_ATIDS == file_call[0]

    SOME_SEX = "some_sex"
    SOME_ANCESTRY = "some_ancestry"
    SOME_INDIVIDUAL = {"sex": SOME_SEX, "ancestry": SOME_ANCESTRY}

    SOME_BAM_FILE = {"@id": "some_atid", "file_format": "/file-formats/bam/"}
    SOME_OTHER_FILE = {"@id": "another_atid", "file_format": "some_file_format"}

    @pytest.mark.parametrize(
        "processed_file_items,expected_get_item_call_count,expected_collect_bam_call",
        [
            ([], 0, False),
            ([SOME_OTHER_FILE], 1, False),
            ([SOME_OTHER_FILE, SOME_BAM_FILE], 2, True),
            ([SOME_BAM_FILE, SOME_OTHER_FILE], 1, True),
        ]
    )
    def test_collect_processed_files_data(
        self,
        empty_quality_metric_parser,
        processed_file_items,
        expected_get_item_call_count,
        expected_collect_bam_call,
    ):
        """"""
        sample_info = {"key": "value"}
        processed_file_atids = [item.get("@id") for item in processed_file_items]
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "get_item",
            side_effect=processed_file_items,
        ) as mocked_get_item:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "collect_bam_quality_metric_values",
            ) as mocked_collect_bam_qc_values:
                empty_quality_metric_parser.collect_processed_files_data(
                    processed_file_atids, sample_info
                )
                get_item_calls = len(mocked_get_item.call_args_list)
                assert get_item_calls == expected_get_item_call_count
                if expected_collect_bam_call:
                    mocked_collect_bam_qc_values.assert_called_once_with(
                        self.SOME_BAM_FILE, sample_info
                    )
                else:
                    mocked_collect_bam_qc_values.assert_not_called()

    SOME_ATID = "/foo/bar/"
    SOME_SAMPLE_1 = "sample_1"
    SAMPLE_1_PROPERTIES = {"fu": "bur"}
    SOME_SAMPLE_2 = "sample_2"
    SOME_SAMPLE_MAPPING = {SOME_SAMPLE_1: SAMPLE_1_PROPERTIES, SOME_SAMPLE_2: {"baz": "fa"}}
    QC_ITEM_SUMMARY_1 = {"sample": SOME_SAMPLE_1}
    QC_ITEM_SUMMARY_2 = {"sample": "some_other_sample"}
    QC_WITH_SUMMARY_1 = {"quality_metric_summary": [QC_ITEM_SUMMARY_1]}
    QC_WITH_SUMMARY_1_2 = {
        "quality_metric_summary": [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]
    }

    @pytest.mark.parametrize(
        "qc_item,expected_get_item_call,expected_add_qc_property_calls",
        [
            (None, 0, []),
            ({"foo": "bar"}, 1, []),
            (QC_WITH_SUMMARY_1, 1, [QC_ITEM_SUMMARY_1]),
            (QC_WITH_SUMMARY_1_2, 1, [QC_ITEM_SUMMARY_1, QC_ITEM_SUMMARY_2]),
        ]
    )
    def test_collect_bam_quality_metric_values(
        self, empty_quality_metric_parser, qc_item, expected_get_item_call,
        expected_add_qc_property_calls,
    ):
        """"""
        file_item = {"quality_metric": qc_item}
        sample_info = {"key": "value"}
        expected_add_qc_property_calls = [
            mock.call(sample_info, item) for item in expected_add_qc_property_calls
        ]
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "get_item",
            return_value=qc_item,
        ) as mocked_get_item:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "add_qc_property_to_sample_info",
            ) as mocked_add_qc_property:
                empty_quality_metric_parser.collect_bam_quality_metric_values(
                    file_item, sample_info
                )
                if expected_get_item_call:
                    mocked_get_item.assert_called_once_with(qc_item)
                else:
                    mocked_get_item.assert_not_called()
                mocked_add_qc_property_calls = mocked_add_qc_property.call_args_list
                assert mocked_add_qc_property_calls == expected_add_qc_property_calls

    @pytest.mark.parametrize(
        "individual_item,sample_info,expected",
        [
            ({}, {}, {}),
            (SOME_INDIVIDUAL, {}, SOME_INDIVIDUAL),
        ]
    )
    def test_collect_individual_data(
        self, empty_quality_metric_parser, individual_item, sample_info, expected
    ):
        """"""
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "get_item",
            return_value=individual_item,
        ):
            empty_quality_metric_parser.collect_individual_data("", sample_info)
            assert sample_info == expected

    @pytest.mark.parametrize(
        "sample_qc_properties,qc_title,qc_value,property_to_evaluate,expected",
        [
            ({}, "some_title", 1, False, None),
            ({}, "some_title", 1, True, True),
        ]
    )
    def test_add_flags_for_qc_value(
        self, empty_quality_metric_parser, sample_qc_properties, qc_title,
        qc_value, property_to_evaluate,
        expected,
    ):
        """"""
        qc_property_to_evaluator = {}
        evaluator = mock.MagicMock(return_value=True)
        if property_to_evaluate:
            qc_property_to_evaluator[qc_title] = evaluator
        empty_quality_metric_parser.QC_PROPERTY_TO_EVALUATOR = qc_property_to_evaluator
        result = empty_quality_metric_parser.add_flags_for_qc_value(
            sample_qc_properties, qc_title, qc_value
        )
        if property_to_evaluate:
            evaluator.assert_called_once_with(qc_title, qc_value, sample_qc_properties)
        else:
            evaluator.assert_not_called()
        assert result == expected

    @pytest.mark.parametrize(
        (
            "qc_links,quality_metric_item,sample_mapping,"
            "expected_add_qc_property_calls"
        ),
        [
            (None, None, SOME_SAMPLE_MAPPING, []),
            (None, QC_WITH_SUMMARY_1, {}, []),
            (
                None, QC_WITH_SUMMARY_1, SOME_SAMPLE_MAPPING,
                [[SAMPLE_1_PROPERTIES, QC_ITEM_SUMMARY_1]],
            ),
            (
                None, QC_WITH_SUMMARY_1_2, SOME_SAMPLE_MAPPING,
                [[SAMPLE_1_PROPERTIES, QC_ITEM_SUMMARY_1]],
            ),
        ]
    )
    def test_associate_vcf_metrics_with_samples(
        self, empty_quality_metric_parser, qc_links, quality_metric_item,
        sample_mapping,
        expected_add_qc_property_calls
    ):
        """"""
        empty_quality_metric_parser.sample_mapping = sample_mapping
        quality_metric_atid = self.SOME_ATID
        vcf_file = {"quality_metric": quality_metric_atid}
        if expected_add_qc_property_calls:
            expected_add_qc_property_calls = [
                mock.call(*expected_call, qc_links=qc_links)
                for expected_call in expected_add_qc_property_calls
            ]
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "get_item",
            return_value=quality_metric_item,
        ) as mocked_get_item:
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "add_qc_property_to_sample_info",
            ) as mocked_add_qc_property:
                empty_quality_metric_parser.associate_vcf_metrics_with_samples(
                    vcf_file, qc_links=qc_links
                )
                mocked_get_item.assert_called_once_with(quality_metric_atid)
                result_call_args = mocked_add_qc_property.call_args_list
                assert result_call_args == expected_add_qc_property_calls

    INCOMPLETE_QC_SUMMARY_ITEM = {
        "title": "some_title",
        "value": "some_value",
    }
    QC_SUMMARY_ITEM = {
        "title": "Some Title",
        "value": "some_value",
        "numberType": "some_number_type",
    }
    SAMPLE_QC_SUMMARY = {
        "some_title": {
            "value": "some_value",
            "number_type": "some_number_type",
        }
    }
    EXISTING_SAMPLE_PROPERTIES = {"foo": {"fu": "bar"}}
    SAMPLE_QC_SUMMARY_WITH_EXISTING_PROPERTIES = {
        key: value for key, value in SAMPLE_QC_SUMMARY.items()
    }
    SAMPLE_QC_SUMMARY_WITH_EXISTING_PROPERTIES.update(EXISTING_SAMPLE_PROPERTIES)
    QC_SUMMARY_ITEM_WITH_LINK = {
        "title": "Some Title With Link",
        "value": "some_value",
        "numberType": "some_number_type",
    }
    SAMPLE_QC_SUMMARY_WITHOUT_LINK = {
        "some_title_with_link": {
            "value": "some_value",
            "number_type": "some_number_type",
        }
    }
    SAMPLE_QC_SUMMARY_WITH_LINK = {
        "some_title_with_link": {
            "value": "some_value",
            "number_type": "some_number_type",
            "link": "an_actual_link",
        }
    }
    SOME_QC_LINK = {"some_link_name": "an_actual_link"}

    @pytest.mark.parametrize(
        (
            "sample_properties,qc_item,qc_links,expected_add_flag_calls,"
            "expected_sample_properties"
        ),
        [
            ({}, {}, None, 0, {}),
            ({}, INCOMPLETE_QC_SUMMARY_ITEM, None, 0, {}),
            ({}, QC_SUMMARY_ITEM, None, 1, SAMPLE_QC_SUMMARY),
            (
                EXISTING_SAMPLE_PROPERTIES,
                QC_SUMMARY_ITEM,
                None,
                1,
                SAMPLE_QC_SUMMARY_WITH_EXISTING_PROPERTIES,
            ),
            ({}, QC_SUMMARY_ITEM_WITH_LINK, None, 1, SAMPLE_QC_SUMMARY_WITHOUT_LINK),
            (
                {},
                QC_SUMMARY_ITEM_WITH_LINK,
                SOME_QC_LINK,
                1,
                SAMPLE_QC_SUMMARY_WITH_LINK,
            ),
        ]
    )
    def test_add_qc_property_to_sample_info(
        self,
        empty_quality_metric_parser,
        sample_properties,
        qc_item,
        qc_links,
        expected_add_flag_calls,
        expected_sample_properties,
    ):
        """"""
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "QC_PROPERTY_NAMES_TO_LINKS",
            new_callable=mock.PropertyMock,
            return_value={"some_title_with_link": "some_link_name"},
        ):
            with mock.patch.object(
                sample_type_module.QualityMetricParser,
                "add_flags_for_qc_value",
                return_value=None,
            ) as mocked_add_flags:
                empty_quality_metric_parser.add_qc_property_to_sample_info(
                    sample_properties, qc_item, qc_links=qc_links
                )
                assert len(mocked_add_flags.call_args_list) == expected_add_flag_calls
                assert sample_properties == expected_sample_properties

    SAMPLE_MAPPING_1 = {
        "foo": {
            "qc_field_1": {},
            "qc_field_2": {"flag": "warn"},
            "qc_field_3": {"flag": "pass"},
        },
        "bar": {
            "qc_field_1": {},
            "qc_field_2": {},
            "qc_field_3": {"flag": "pass"},
        },
        "fu": {
            "qc_field_1": {"flag": "warn"},
            "qc_field_2": {"flag": "fail"},
            "qc_field_3": {"flag": "pass"},
        },
    }
    SAMPLE_MAPPING_2 = {
        "foo": {
            "qc_field_1": {"flag": "warn"},
            "qc_field_2": {"flag": "fu"},
        },
        "bar": {
            "qc_field_1": {},
            "qc_field_2": {},
        },
    }
    SAMPLE_MAPPING_3 = {
        "foo": {
            "non_qc_field_1": "fu",
            "qc_field_1": {"flag": "warn"},
            "non_qc_field_2": 9,
        },
    }

    @pytest.mark.parametrize(
        "sample_mapping,expected_flags_for_samples",
        [
            ({}, []),
            (SAMPLE_MAPPING_1, ["warn", "pass", "fail"]),
            (SAMPLE_MAPPING_2, ["warn", None]),
            (SAMPLE_MAPPING_3, ["warn"]),
        ]
    )
    def test_add_flags_for_samples(
        self, empty_quality_metric_parser, sample_mapping, expected_flags_for_samples
    ):
        """"""
        empty_quality_metric_parser.sample_mapping = sample_mapping
        empty_quality_metric_parser.add_flags_for_samples()
        assert len(sample_mapping.values()) == len(expected_flags_for_samples)
        for idx, sample_info in enumerate(sample_mapping.values()):
            assert sample_info.get("flag") == expected_flags_for_samples[idx]

    SAMPLE_MAPPING_4 = {"foo": {"flag": "warn"}}
    SAMPLE_MAPPING_5 = {"foo": {"flag": "warn"}, "bar": {"flag": "pass"}}
    SAMPLE_MAPPING_6 = {"foo": {"flag": "warn"}, "bar": {"flag": "fail"}}

    @pytest.mark.parametrize(
        "sample_mapping,expected_flag",
        [
            ({}, None),
            (SAMPLE_MAPPING_3, None),
            (SAMPLE_MAPPING_4, "warn"),
            (SAMPLE_MAPPING_5, "warn"),
            (SAMPLE_MAPPING_6, "fail"),
        ]
    )
    def test_add_overall_flag(
        self, empty_quality_metric_parser, sample_mapping, expected_flag
    ):
        """"""
        empty_quality_metric_parser.sample_mapping = sample_mapping
        empty_quality_metric_parser.add_overall_flag()
        assert sample_mapping.get("flag") == expected_flag

    SAMPLE_MAPPING_7 = {"foo": {"sex": "M", "ancestry": "NA"}}

    @pytest.mark.parametrize(
        "sample_mapping,properties_to_keep,expected",
        [
            ({}, set(), None),
            (
                SAMPLE_MAPPING_3,
                set(),
                [{"sample_identifier": "foo", "sample_properties": {}}]
            ),
            (
                SAMPLE_MAPPING_3,
                set(["qc_field_1"]),
                [
                    {
                        "sample_identifier": "foo",
                        "sample_properties": {"qc_field_1": {"flag": "warn"}}
                    },
                ],
            ),
        ]
    )
    def test_reformat_sample_mapping_to_schema(
        self, empty_quality_metric_parser, sample_mapping, properties_to_keep, expected
    ):
        """"""
        with mock.patch.object(
            sample_type_module.QualityMetricParser,
            "SAMPLE_PROPERTIES_TO_KEEP",
            new_callable=mock.PropertyMock,
            return_value=properties_to_keep,
        ):
            empty_quality_metric_parser.sample_mapping = sample_mapping
            result = empty_quality_metric_parser.reformat_sample_mapping_to_schema()
            assert result == expected
