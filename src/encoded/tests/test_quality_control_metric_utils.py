from contextlib import contextmanager
from unittest import mock
from typing import Any, Collection, Dict, Iterable, Iterator, List, Optional, Union

import pytest
from dcicutils.testing_utils import patch_context


from .. import tmp_item_models
from ..util import JsonObject
from ..types import qc_report_utils as qc_report_utils_module
from ..types.qc_report_utils import (
    FlatQualityControlMetric,
    NestedQualityControlMetric,
    QcFlagger,
    QcConstants,
    QualityControlMetric,
    QualityControlMetricsForSample,
    get_latest_file_with_quality_metric,
    get_desired_qc_metrics,
    get_formatted_quality_control_metrics,
    get_matched_qc_metrics_for_samples,
    get_qc_metric_with_flag,
    get_qc_metrics_from_files,
    get_qc_metrics_from_samples,
    get_qc_metrics_for_samples_with_flags,
    get_qc_metrics_for_samples_with_summary_qc_metrics,
    get_qc_metrics_with_quality_metric_data,
    get_qc_metrics_with_title_updates,
    get_worst_flag_from_all_flags,
    get_quality_control_metrics_summary,
    #    get_sample_ids_to_samples,
)


SOME_SAMPLE_ID = "a_sample_id"
ANOTHER_SAMPLE_ID = "another_sample_id"
SOME_TITLE = "a_title"
ANOTHER_TITLE = "another_title"
SOME_VALUE = "a_value"
SOME_FLAG = "a_flag"
SOME_LINK = "a_link"
SOME_COMPLETED_QC_STEP = "a_completed_qc_step"
SOME_SPECIMEN_TYPE = "a_specimen_type"
SOME_WORKUP_TYPE = "a_workup_type"
SOME_SEX = "a_sex"
SOME_IDENTIFIER = "a_identifier"
SOME_ACCESSION = "an_accession"
SOME_ANCESTRY = "an_ancestry"
ANOTHER_ANCESTRY = "another_ancestry"
SOME_ANCESTRIES = tuple([SOME_ANCESTRY, ANOTHER_ANCESTRY])
SOME_ATID = "/some/atid/"

# QC_METRIC_TITLE = "a_title"
# QC_METRIC_VALUE = "a_value"
# QC_METRIC_SAMPLE_ID = "a_sample_id"
# QC_METRIC_FLAG = "a_flag"
# QC_METRIC_LINK = "a_link"
# QC_METRIC_COMPLETED_QC_STEP = "a_completed_qc_step"


def get_flat_quality_control_metric(
    sample_id: str = SOME_SAMPLE_ID, title: str = SOME_TITLE, value: str = SOME_VALUE
) -> FlatQualityControlMetric:
    return FlatQualityControlMetric(sample_id, title, value)


def get_nested_quality_control_metric(
    sample_id: str = SOME_SAMPLE_ID,
    title: str = SOME_TITLE,
    value: str = SOME_VALUE,
    flag: str = SOME_FLAG,
    link: str = SOME_LINK,
    completed_qc_step: str = SOME_COMPLETED_QC_STEP,
) -> NestedQualityControlMetric:
    return NestedQualityControlMetric(
        sample_id, title, value, flag=flag, link=link, completed_qc_step=completed_qc_step
    )


def get_mock_qc_flagger(flag: str = "") -> QcFlagger:
    mock_qc_flagger = mock.create_autospec(QcFlagger, instance=True)
    mock_qc_flagger.get_flag.return_value = flag
    return mock_qc_flagger


def get_mock_file(
    is_bam: bool = False,
    is_snv_final_vcf: bool = False,
    is_sv_final_vcf: bool = False,
    quality_metric: Optional[Union[tmp_item_models.QualityMetric, str]] = None,
) -> mock.MagicMock:
    mock_file = mock.create_autospec(tmp_item_models.File, instance=True)
    if quality_metric is None:
        quality_metric = get_mock_quality_metric()
    mock_file.get_quality_metric.return_value = quality_metric
    mock_file.is_bam.return_value = is_bam
    mock_file.is_snv_final_vcf.return_value = is_snv_final_vcf
    mock_file.is_sv_final_vcf.return_value = is_sv_final_vcf
    return mock_file


def get_mock_quality_metric(
    is_qc_list_type: bool = False,
    is_peddy_qc_type: bool = False,
    quality_metric_summaries: Optional[Iterable[tmp_item_models.QualityMetricSummary]] = None,
    qc_list_quality_metrics: Optional[Iterable[tmp_item_models.QualityMetric]] = None,
) -> mock.MagicMock:
    mock_quality_metric = mock.create_autospec(tmp_item_models.QualityMetric, instance=True)
    mock_quality_metric.is_qc_list_type.return_value = is_qc_list_type
    mock_quality_metric.is_peddy_qc_type.return_value = is_peddy_qc_type
    if quality_metric_summaries is None:
        quality_metric_summaries = [get_mock_quality_metric_summary()]
    if qc_list_quality_metrics:
        mock_quality_metric.get_qc_list_quality_metrics.return_value = qc_list_quality_metrics
    mock_quality_metric.get_quality_metric_summaries.return_value = quality_metric_summaries
    mock_quality_metric.get_at_id.return_value = SOME_ATID
    return mock_quality_metric


def get_mock_quality_metric_summary(
    sample: str = SOME_SAMPLE_ID,
    title: str = SOME_TITLE,
    value: str = SOME_VALUE,
) -> mock.MagicMock:
    mock_quality_metric_summary = mock.create_autospec(
        tmp_item_models.QualityMetricSummary, instance=True
    )
    mock_quality_metric_summary.get_sample.return_value = sample
    mock_quality_metric_summary.get_title.return_value = title
    mock_quality_metric_summary.get_value.return_value = value
    return mock_quality_metric_summary


def get_mock_sample(
    bam_sample_id: str = SOME_SAMPLE_ID,
    specimen_type: str = SOME_SPECIMEN_TYPE,
    workup_type: str = SOME_WORKUP_TYPE,
    individual: Optional[Union[tmp_item_models.Individual, str]] = None,
) -> mock.MagicMock:
    mock_sample = mock.create_autospec(tmp_item_models.Sample, instance=True)
    mock_sample.get_bam_sample_id.return_value = bam_sample_id
    mock_sample.get_specimen_type.return_value = specimen_type
    mock_sample.get_workup_type.return_value = workup_type
    if individual is None:
        individual = get_mock_individual()
    mock_sample.get_individual.return_value = individual
    return mock_sample


def get_mock_individual(
    accession: str = SOME_ACCESSION,
    ancestry: Iterable[str] = SOME_ANCESTRIES,
    identifier: str = SOME_IDENTIFIER,
    sex: str = SOME_SEX,
) -> mock.MagicMock:
    mock_individual = mock.create_autospec(tmp_item_models.Individual, instance=True)
    mock_individual.get_accession.return_value = accession
    mock_individual.get_ancestry.return_value = ancestry
    mock_individual.get_submitted_identifier.return_value = identifier
    mock_individual.get_sex.return_value = sex
    return mock_individual


SOME_SAMPLE = get_mock_sample()
ANOTHER_SAMPLE = get_mock_sample(bam_sample_id=ANOTHER_SAMPLE_ID)


def get_qc_metrics_for_sample(
    sample: Optional[tmp_item_models.Sample] = SOME_SAMPLE,
    qc_metrics: Optional[Iterable[QualityControlMetric]] = None,
) -> QualityControlMetricsForSample:
    if qc_metrics is None:
        qc_metrics = [
            get_flat_quality_control_metric(), get_nested_quality_control_metric()
        ]
    return QualityControlMetricsForSample(sample, qc_metrics)


class TestQcFlagger:
    pass


class TestFlatQualityControlMetric:

    @pytest.mark.parametrize(
        "title,expected",
        [
            (None, get_flat_quality_control_metric()),
            (SOME_TITLE, get_flat_quality_control_metric(title=SOME_TITLE)),
        ]
    )
    def test_update(self, title: Union[str, None], expected: FlatQualityControlMetric) -> None:
        quality_control_metric = get_flat_quality_control_metric()
        result = quality_control_metric.update(title=title)
        assert result == expected

    @pytest.mark.parametrize(
        "title,value,expected",
        [
            ("", "", {}),
            ("", SOME_VALUE, {}),
            (SOME_TITLE, "", {}),
            (SOME_TITLE, SOME_VALUE, {SOME_TITLE: SOME_VALUE}),
        ]
    )
    def test_get_formatted_metric(
        self, title: str, value: str, expected: JsonObject
    ) -> None:
        quality_control_metric = get_flat_quality_control_metric(title=title, value=value)
        result = quality_control_metric.get_formatted_metric()
        assert result == expected


class TestNestedQualityControlMetric:
    @pytest.mark.parametrize(
        "title,flag,link,completed_qc_step,expected",
        [
            (None, None, None, None, get_nested_quality_control_metric()),
            (SOME_TITLE, None, None, None, get_nested_quality_control_metric(title=SOME_TITLE)),
            (
                SOME_TITLE,
                SOME_FLAG,
                SOME_LINK,
                SOME_COMPLETED_QC_STEP,
                get_nested_quality_control_metric(
                    title=SOME_TITLE,
                    flag=SOME_FLAG,
                    link=SOME_LINK,
                    completed_qc_step=SOME_COMPLETED_QC_STEP
                )
            ),
        ]
    )
    def test_update(
        self,
        title: Union[str, None],
        flag: Union[str, None],
        link: Union[str, None],
        completed_qc_step: Union[str, None],
        expected: NestedQualityControlMetric,
    ) -> None:
        quality_control_metric = get_nested_quality_control_metric()
        result = quality_control_metric.update(
            title=title, flag=flag, link=link, completed_qc_step=completed_qc_step
        )
        assert result == expected

    @pytest.mark.parametrize(
        "title,value,flag,link,expected",
        [
            ("", "", "", "", {}),
            (SOME_TITLE, "", "", "", {}),
            ("", SOME_VALUE, "", "", {}),
            (
                SOME_TITLE,
                SOME_VALUE,
                "",
                "",
                {SOME_TITLE: {"value": SOME_VALUE}},
            ),
            (
                SOME_TITLE,
                SOME_VALUE,
                SOME_FLAG,
                SOME_LINK,
                {SOME_TITLE: {
                    "value": SOME_VALUE, "flag": SOME_FLAG, "link": SOME_LINK
                }},
            ),
            (
                SOME_TITLE,
                "",
                SOME_FLAG,
                SOME_LINK,
                {},
            ),
        ]
    )
    def test_get_formatted_metric(
        self,
        title: str,
        value: str,
        flag: str,
        link: str,
        expected: JsonObject,
    ) -> None:
        quality_control_metric = get_nested_quality_control_metric(
            title=title, value=value, flag=flag, link=link
        )
        result = quality_control_metric.get_formatted_metric()
        assert result == expected


#def get_mock_file(uuid: Optional[str] = None, quality_metric: Optional[Any] = None) -> File:
#    mock_file = mock.create_autospec(File, instance=True)
#    if quality_metric is not None:
#        mock_file.get_quality_metric.return_value = quality_metric
#    if uuid is not None:
#        mock_file.get_uuid.return_value = uuid
#    return mock_file
#
#
#SOME_UUID = "some_uuid"
#ANOTHER_UUID = "another_uuid"


def file_evaluator(file: tmp_item_models.File) -> bool:
    return file.is_bam()


def test_get_latest_file_with_quality_metric() -> None:
    file_to_get = get_mock_file(is_bam=True)
    another_file_to_get = get_mock_file(is_bam=True)
    file_evaluating_to_false = get_mock_file(is_bam=False)
    file_without_quality_metric = get_mock_file(quality_metric="", is_bam=True)
    files = [
        file_to_get, file_evaluating_to_false, file_without_quality_metric
    ]
    result = get_latest_file_with_quality_metric(files, file_evaluator)
    assert list(result) == [file_to_get]

    files = [file_to_get, another_file_to_get]
    result = get_latest_file_with_quality_metric(files, file_evaluator)
    assert list(result) == [another_file_to_get]

    files = [file_evaluating_to_false, file_without_quality_metric]
    result = get_latest_file_with_quality_metric(files, file_evaluator)
    assert list(result) == []


@pytest.mark.parametrize(
    "files,expected",
    [
        ([get_mock_file(quality_metric="")], []),
        (
            [get_mock_file()],
            [get_nested_quality_control_metric(flag=None, link=None, completed_qc_step=None)]
        ),
        (
            [
                get_mock_file(is_bam=True),
                get_mock_file(is_sv_final_vcf=True),
                get_mock_file(is_snv_final_vcf=True),
            ],
            [
                get_nested_quality_control_metric(
                    flag=None, link=None, completed_qc_step=QcConstants.COMPLETED_QC_BAM
                ),
                get_nested_quality_control_metric(
                    flag=None, link=None, completed_qc_step=QcConstants.COMPLETED_QC_SV
                ),
                get_nested_quality_control_metric(
                    flag=None, link=None, completed_qc_step=QcConstants.COMPLETED_QC_SNV
                ),
            ]
        ),
    ]
)
def test_get_qc_metrics_from_files(
    files: Iterable[tmp_item_models.File], expected: Iterable[QualityControlMetric]
) -> None:
    result = get_qc_metrics_from_files(files)
    assert list(result) == list(expected)


@pytest.mark.parametrize(
    "qc_metrics,quality_metric,expected",
    [
        (
            [get_nested_quality_control_metric()],
            get_mock_quality_metric(),
            [get_nested_quality_control_metric()]
        ),
        (
            [
                get_nested_quality_control_metric(),
                get_nested_quality_control_metric(title=QcConstants.PREDICTED_SEX),
                get_nested_quality_control_metric(title=QcConstants.PREDICTED_ANCESTRY)
            ],
            get_mock_quality_metric(
                is_qc_list_type=True,
                qc_list_quality_metrics=[
                    get_mock_quality_metric(),
                    get_mock_quality_metric(is_peddy_qc_type=True)
                ],
            ),
            [
                get_nested_quality_control_metric(),
                get_nested_quality_control_metric(
                    title=QcConstants.PREDICTED_SEX, link=f"{SOME_ATID}@@download"
                ),
                get_nested_quality_control_metric(
                    title=QcConstants.PREDICTED_ANCESTRY, link=f"{SOME_ATID}@@download"
                ),
            ]
        ),
    ],
)
def test_get_qc_metrics_with_quality_metric_data(
    qc_metrics: Iterable[QualityControlMetric],
    quality_metric: tmp_item_models.QualityMetric,
    expected: Iterable[QualityControlMetric],
) -> None:
    result = get_qc_metrics_with_quality_metric_data(qc_metrics, quality_metric)
    assert list(result) == list(expected)


@pytest.mark.parametrize(
    "qc_metrics,file,expected",
    (
        ([], get_mock_file(), []),
        (
            [
                get_nested_quality_control_metric(),
                get_nested_quality_control_metric(title=QcConstants.FILTERED_VARIANTS)
            ],
            get_mock_file(is_snv_final_vcf=True),
            [
                get_nested_quality_control_metric(),
                get_nested_quality_control_metric(title=QcConstants.FILTERED_VARIANTS)
            ],
        ),
        (
            [
                get_nested_quality_control_metric(),
                get_nested_quality_control_metric(title=QcConstants.FILTERED_VARIANTS)
            ],
            get_mock_file(is_sv_final_vcf=True),
            [
                get_nested_quality_control_metric(),
                get_nested_quality_control_metric(title=QcConstants.FILTERED_STRUCTURAL_VARIANTS)
            ],
        ),
    ),
)
def test_get_qc_metrics_with_title_updates(
    qc_metrics: Iterable[QualityControlMetric],
    file: tmp_item_models.File,
    expected: Iterable[QualityControlMetric],
) -> None:
    result = get_qc_metrics_with_title_updates(qc_metrics, file)
    assert list(result) == list(expected)


@pytest.mark.parametrize(
    "samples,expected",
    [
        ([], []),
        (
            [get_mock_sample()],
            [
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.BAM_SAMPLE_ID,
                    value=SOME_SAMPLE_ID,
                ),
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.SPECIMEN_TYPE,
                    value=SOME_SPECIMEN_TYPE,
                ),
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.SEQUENCING_TYPE,
                    value=SOME_WORKUP_TYPE,
                ),
                get_nested_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.SEX,
                    value=SOME_SEX,
                    flag=None,
                    link=None,
                    completed_qc_step=None,
                ),
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.INDIVIDUAL_ID,
                    value=SOME_IDENTIFIER,
                ),
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.INDIVIDUAL_ACCESSION,
                    value=SOME_ACCESSION,
                ),
                get_nested_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.ANCESTRY,
                    value=", ".join(SOME_ANCESTRIES),
                    flag=None,
                    link=None,
                    completed_qc_step=None,
                ),
            ],
        ),
        (
            [get_mock_sample(individual="")],
            [
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.BAM_SAMPLE_ID,
                    value=SOME_SAMPLE_ID,
                ),
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.SPECIMEN_TYPE,
                    value=SOME_SPECIMEN_TYPE,
                ),
                get_flat_quality_control_metric(
                    sample_id=SOME_SAMPLE_ID,
                    title=QcConstants.SEQUENCING_TYPE,
                    value=SOME_WORKUP_TYPE,
                ),
            ],
        ),
    ]
)
def test_get_qc_metrics_from_samples(
    samples: Iterable[tmp_item_models.Sample],
    expected: Iterable[QualityControlMetric],
) -> None:
    result = get_qc_metrics_from_samples(samples)
    assert list(result) == list(expected)


@pytest.mark.parametrize(
    "qc_metrics,desired_fields,expected",
    [
        ([], [], []),
        ([get_flat_quality_control_metric()], [], []),
        (
            [get_flat_quality_control_metric()],
            [SOME_TITLE],
            [get_flat_quality_control_metric()]
        ),
        (
            [
                get_flat_quality_control_metric(title="foo"),
                get_flat_quality_control_metric()
            ],
            [SOME_TITLE],
            [get_flat_quality_control_metric()]
        ),
    ]
)
def test_get_desired_qc_metrics(
    qc_metrics: Iterable[QualityControlMetric],
    desired_fields: Collection[str],
    expected: Iterable[QualityControlMetric],
) -> None:
    result = get_desired_qc_metrics(qc_metrics, desired_fields)
    assert list(result) == list(expected)


def assert_qc_metrics_for_samples_equal(
    result_qc_metrics_for_samples: Iterable[QualityControlMetricsForSample],
    expected_qc_metrics_for_samples: Iterable[QualityControlMetricsForSample],
) -> None:
    result = list(result_qc_metrics_for_samples)
    expected = list(expected_qc_metrics_for_samples)
    assert len(result) == len(expected)
    for result_item, expected_item in zip(result, expected):
        assert result_item.get_sample() == expected_item.get_sample()
        assert list(result_item.get_quality_control_metrics()) == list(
            expected_item.get_quality_control_metrics()
        )
    

@pytest.mark.parametrize(
    "samples,qc_metrics,expected",
    [
        ([], [], []),
        (
            [SOME_SAMPLE, ANOTHER_SAMPLE],
            [
                get_flat_quality_control_metric(),
                get_nested_quality_control_metric(sample_id=ANOTHER_SAMPLE_ID),
                get_nested_quality_control_metric(sample_id="foo"),
                get_nested_quality_control_metric(),
            ],
            [
                QualityControlMetricsForSample(
                    SOME_SAMPLE,
                    [get_flat_quality_control_metric(), get_nested_quality_control_metric()]
                ),
                QualityControlMetricsForSample(
                    ANOTHER_SAMPLE,
                    [get_nested_quality_control_metric(sample_id=ANOTHER_SAMPLE_ID)],
                ),
            ]
        )
    ]
)
def test_get_matched_qc_metrics_for_samples(
    samples: Iterable[tmp_item_models.Sample],
    qc_metrics: Iterable[QualityControlMetric],
    expected: Iterable[QualityControlMetricsForSample],
) -> None:
    result = get_matched_qc_metrics_for_samples(samples, qc_metrics)
    assert_qc_metrics_for_samples_equal(result, expected)


@pytest.mark.parametrize(
    "qc_metrics_for_samples,qc_flagger,expected",
    [
        ([], get_mock_qc_flagger(), []),
        (
            [
                get_qc_metrics_for_sample(),
                get_qc_metrics_for_sample(sample=ANOTHER_SAMPLE),
            ],
            get_mock_qc_flagger(flag="pass"),
            [
                get_qc_metrics_for_sample(
                    qc_metrics=[
                        get_flat_quality_control_metric(),
                        get_nested_quality_control_metric(flag="pass"),
                    ]
                ),
                get_qc_metrics_for_sample(
                    sample=ANOTHER_SAMPLE,
                    qc_metrics=[
                        get_flat_quality_control_metric(),
                        get_nested_quality_control_metric(flag="pass"),
                    ]
                ),
            ],
        ),
    ]
)
def test_get_qc_metrics_for_samples_with_flags(
    qc_metrics_for_samples: Iterable[QualityControlMetricsForSample],
    qc_flagger: QcFlagger,
    expected: Iterable[QualityControlMetricsForSample],
) -> None:
    result = get_qc_metrics_for_samples_with_flags(
        qc_metrics_for_samples, qc_flagger
    )
    assert_qc_metrics_for_samples_equal(result, expected)


@pytest.mark.parametrize(
    "qc_metrics_for_samples,desired_fields,expected",
    [
        ([], [], []),
        (
            [
                get_qc_metrics_for_sample(),
                get_qc_metrics_for_sample(
                    sample=ANOTHER_SAMPLE,
                    qc_metrics=[
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_SEX,
                            flag=QcConstants.FLAG_WARN,
                            completed_qc_step=QcConstants.COMPLETED_QC_BAM,
                        ),
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_ANCESTRY,
                            flag=QcConstants.FLAG_FAIL,
                            completed_qc_step=QcConstants.COMPLETED_QC_SNV,
                        ),
                    ]
                )
            ],
            [QcConstants.FLAG_WARN, QcConstants.FLAG_FAIL, QcConstants.COMPLETED_QCS],
            [
                get_qc_metrics_for_sample(
                    qc_metrics=[
                        get_flat_quality_control_metric(),
                        get_nested_quality_control_metric(),
                        get_flat_quality_control_metric(
                            title=QcConstants.COMPLETED_QCS,
                            value=[SOME_COMPLETED_QC_STEP]
                        )
                    ]
                ),
                get_qc_metrics_for_sample(
                    sample=ANOTHER_SAMPLE,
                    qc_metrics=[
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_SEX,
                            flag=QcConstants.FLAG_WARN,
                            completed_qc_step=QcConstants.COMPLETED_QC_BAM,
                        ),
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_ANCESTRY,
                            flag=QcConstants.FLAG_FAIL,
                            completed_qc_step=QcConstants.COMPLETED_QC_SNV,
                        ),
                        get_flat_quality_control_metric(
                            sample_id=ANOTHER_SAMPLE_ID,
                            title=QcConstants.COMPLETED_QCS,
                            value=[QcConstants.COMPLETED_QC_BAM, QcConstants.COMPLETED_QC_SNV],
                        ),
                        get_flat_quality_control_metric(
                            sample_id=ANOTHER_SAMPLE_ID,
                            title=QcConstants.FLAG_WARN,
                            value=[QcConstants.PREDICTED_SEX]
                        ),
                        get_flat_quality_control_metric(
                            sample_id=ANOTHER_SAMPLE_ID,
                            title=QcConstants.FLAG_FAIL,
                            value=[QcConstants.PREDICTED_ANCESTRY]
                        ),
                    ]
                )
            ]
        ),
        (
            [
                get_qc_metrics_for_sample(
                    sample=ANOTHER_SAMPLE,
                    qc_metrics=[
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_SEX,
                            flag=QcConstants.FLAG_WARN,
                            completed_qc_step=QcConstants.COMPLETED_QC_BAM,
                        ),
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_ANCESTRY,
                            flag=QcConstants.FLAG_FAIL,
                            completed_qc_step=QcConstants.COMPLETED_QC_SNV,
                        ),
                    ]
                )
            ],
            [QcConstants.FLAG_FAIL],
            [
                get_qc_metrics_for_sample(
                    sample=ANOTHER_SAMPLE,
                    qc_metrics=[
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_SEX,
                            flag=QcConstants.FLAG_WARN,
                            completed_qc_step=QcConstants.COMPLETED_QC_BAM,
                        ),
                        get_nested_quality_control_metric(
                            title=QcConstants.PREDICTED_ANCESTRY,
                            flag=QcConstants.FLAG_FAIL,
                            completed_qc_step=QcConstants.COMPLETED_QC_SNV,
                        ),
                        get_flat_quality_control_metric(
                            sample_id=ANOTHER_SAMPLE_ID,
                            title=QcConstants.FLAG_FAIL,
                            value=[QcConstants.PREDICTED_ANCESTRY]
                        ),
                    ]
                )
            ]
        ),
        (
            [get_qc_metrics_for_sample()],
            [],
            [get_qc_metrics_for_sample()]
        )
    ]
)
def test_get_qc_metrics_for_samples_with_summary_qc_metrics(
    qc_metrics_for_samples: Iterable[QualityControlMetricsForSample],
    desired_fields: Collection[str],
    expected: Iterable[QualityControlMetricsForSample],
) -> None:
    result = get_qc_metrics_for_samples_with_summary_qc_metrics(
        qc_metrics_for_samples, desired_fields
    )
    assert_qc_metrics_for_samples_equal(result, expected)


@pytest.mark.parametrize(
    "qc_metrics_for_samples,expected",
    [
        ([], []),
        (
            [
                get_qc_metrics_for_sample(
                    qc_metrics=[get_flat_quality_control_metric()]
                ),
                get_qc_metrics_for_sample(
                    sample=ANOTHER_SAMPLE,
                    qc_metrics=[
                        get_flat_quality_control_metric(title=ANOTHER_TITLE),
                        get_nested_quality_control_metric()
                    ]
                )
            ],
            [
                {
                    SOME_TITLE: SOME_VALUE
                },
                {
                    ANOTHER_TITLE: SOME_VALUE,
                    SOME_TITLE: {
                        QcConstants.VALUE: SOME_VALUE,
                        QcConstants.FLAG: SOME_FLAG,
                        QcConstants.LINK: SOME_LINK,
                    }
                }
            ],
        ),
    ]
)
def test_get_formatted_quality_control_metrics(
    qc_metrics_for_samples: Iterable[QualityControlMetricsForSample],
    expected: List[Dict[str, Any]],
) -> None:
    result = get_formatted_quality_control_metrics(qc_metrics_for_samples)
    assert result == expected



@pytest.mark.parametrize(
    "formatted_qc_metrics,expected",
    [
        ([], {QcConstants.FLAG_WARN: 0, QcConstants.FLAG_FAIL: 0}),
        (
            [
                {
                    "foo": {
                        QcConstants.VALUE: "bar",
                        QcConstants.FLAG: QcConstants.FLAG_PASS
                    }
                },
                {"fu": "bur"},
            ],
            {
                QcConstants.FLAG: QcConstants.FLAG_PASS,
                QcConstants.FLAG_WARN: 0,
                QcConstants.FLAG_FAIL: 0
            }
        ),
        (
            [
                {
                    "foo": {
                        QcConstants.VALUE: "bar",
                        QcConstants.FLAG: QcConstants.FLAG_WARN
                    },
                    "fu": {
                        QcConstants.VALUE: "bur",
                        QcConstants.FLAG: QcConstants.FLAG_WARN
                    },
                    "fi": {
                        QcConstants.VALUE: "bir",
                        QcConstants.FLAG: QcConstants.FLAG_FAIL
                    },
                    QcConstants.COMPLETED_QCS: ["step_1", "step_2"],
                },
                {
                    "foo": {
                        QcConstants.VALUE: "bar",
                        QcConstants.FLAG: QcConstants.FLAG_FAIL
                    },
                    "something": {
                        QcConstants.VALUE: "else",
                        QcConstants.FLAG: QcConstants.FLAG_WARN
                    },
                    "another": {
                        QcConstants.VALUE: "thing",
                        QcConstants.FLAG: QcConstants.FLAG_PASS
                    },
                    QcConstants.COMPLETED_QCS: ["step_2", "step_3"],
                },
            ],
            {
                QcConstants.FLAG_WARN: 3,
                QcConstants.FLAG_FAIL: 2,
                QcConstants.FLAG: QcConstants.FLAG_FAIL,
                QcConstants.COMPLETED_QCS: ["step_1", "step_2", "step_3"],
            },
        )
    ]
)
def test_get_quality_control_metrics_summary(
    formatted_qc_metrics: Iterable[Dict[str, Any]],
    expected: Dict[str, Any],
) -> None:
    result = get_quality_control_metrics_summary(formatted_qc_metrics)
    assert result == expected


@pytest.mark.parametrize(
    "flags,expected",
    [
        ([], ""),
        (
            [QcConstants.FLAG_WARN, QcConstants.FLAG_PASS, QcConstants.FLAG_FAIL],
            QcConstants.FLAG_FAIL
        ),
        ([QcConstants.FLAG_WARN, QcConstants.FLAG_PASS], QcConstants.FLAG_WARN),
        ([QcConstants.FLAG_PASS], QcConstants.FLAG_PASS),
    ]
)
def test_get_worst_flag_from_all_flags(flags: Collection[str], expected: str) -> None:
    result = get_worst_flag_from_all_flags(flags)
    assert result == expected


#@contextmanager
#def patch_get_qc_metrics_without_flags(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        qc_report_utils_module.get_qc_metrics_without_flags, **kwargs
#    ) as mock_item:
#        yield mock_item


@contextmanager
def patch_get_qc_metrics_with_flags(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_qc_metrics_with_flags, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_qc_metric_with_flag(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_qc_metric_with_flag, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_sample_ids_to_samples(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_sample_ids_to_samples, **kwargs
    ) as mock_item:
        yield mock_item


#@contextmanager
#def patch_get_qc_metrics(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        qc_report_utils_module.get_qc_metrics, **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_qc_metrics_per_sample(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        qc_report_utils_module.get_qc_metrics_per_sample, **kwargs
#    ) as mock_item:
#        yield mock_item
#
#
#@contextmanager
#def patch_get_sorted_and_formatted_quality_control_metrics(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        qc_report_utils_module.get_sorted_and_formatted_quality_control_metrics, **kwargs
#    ) as mock_item:
#        yield mock_item


@contextmanager
def patch_get_nested_qc_metric_with_flag(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_nested_qc_metric_with_flag, **kwargs
    ) as mock_item:
        yield mock_item


#@contextmanager
#def patch_get_nested_qc_metric_with_flag_update(**kwargs) -> Iterator[mock.MagicMock]:
#    with patch_context(
#        qc_report_utils_module.get_nested_qc_metric_with_flag_update, **kwargs
#    ) as mock_item:
#        yield mock_item


@contextmanager
def patch_get_updated_qc_metric(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_updated_qc_metric, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_qc_metrics_from_files(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_qc_metrics_from_files, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_qc_metrics_from_samples(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_qc_metrics_from_samples, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_chain(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.chain,
        module=qc_report_utils_module,
        **kwargs
    ) as mock_item:
        yield mock_item


#def get_mock_sample(bam_sample_id: Optional[str] = None) -> mock.MagicMock:
#    sample = mock.create_autospec(Sample, instance=True)
#    if bam_sample_id is not None:
#        sample.get_bam_sample_id.return_value = bam_sample_id
#    return sample


SOME_SAMPLE_ID = "some_sample_id"
ANOTHER_SAMPLE_ID = "another_sample_id"
SOME_SAMPLE = get_mock_sample(bam_sample_id=SOME_SAMPLE_ID)
ANOTHER_SAMPLE = get_mock_sample(bam_sample_id=ANOTHER_SAMPLE_ID)
SOME_SAMPLES = [SOME_SAMPLE, ANOTHER_SAMPLE]
SOME_SAMPLE_IDS_TO_SAMPLES = {SOME_SAMPLE_ID: SOME_SAMPLE, ANOTHER_SAMPLE_ID: ANOTHER_SAMPLE}
SOME_FILES = "some_files"
SOME_QC_FLAGGER = get_mock_qc_flagger()
SOME_DESIRED_FIELDS = "some_desired_fields"

# @pytest.mark.parametrize("quality_control_metrics", [[], [{}]]) 
# def test_get_quality_control_metrics(quality_control_metrics: Union[List[JsonObject], None]) -> None:
#     with patch_get_qc_metrics() as mock_get_qc_metrics:
#         with patch_get_qc_metrics_per_sample() as mock_get_qc_metrics_per_sample:
#             with patch_get_sorted_and_formatted_quality_control_metrics(
#                 return_value=quality_control_metrics
#             ) as mock_get_formatted_quality_control_metrics:
#                 result = get_quality_control_metrics(
#                     SOME_SAMPLES, SOME_FILES, SOME_QC_FLAGGER, SOME_DESIRED_FIELDS
#                 )
#                 if quality_control_metrics:
#                     assert result == quality_control_metrics
#                 else:
#                     assert result is None
#                 mock_get_qc_metrics.assert_called_once_with(
#                     SOME_FILES, SOME_SAMPLES, SOME_QC_FLAGGER, SOME_DESIRED_FIELDS
#                 )
#                 mock_get_qc_metrics_per_sample.assert_called_once_with(
#                     SOME_SAMPLES, mock_get_qc_metrics.return_value, SOME_DESIRED_FIELDS
#                 )
#                 mock_get_formatted_quality_control_metrics.assert_called_once_with(
#                     mock_get_qc_metrics_per_sample.return_value
#                 )
# 
# 
# def test_get_qc_metrics() -> None:
#     with patch_get_qc_metrics_without_flags() as mock_get_qc_metrics_without_flags:
#         with patch_get_qc_metrics_with_flags() as mock_get_qc_metrics_with_flags:
#             result = get_qc_metrics(SOME_FILES, SOME_SAMPLES, SOME_QC_FLAGGER, SOME_DESIRED_FIELDS)
#             assert result == mock_get_qc_metrics_with_flags.return_value
#             mock_get_qc_metrics_without_flags.assert_called_once_with(
#                 SOME_FILES, SOME_SAMPLES, SOME_DESIRED_FIELDS
#             )
#             mock_get_qc_metrics_with_flags.assert_called_once_with(
#                 mock_get_qc_metrics_without_flags.return_value,
#                 SOME_SAMPLES,
#                 SOME_QC_FLAGGER,
#             )
# 
# @pytest.mark.parametrize(
#     "qc_metrics_without_flags",
#     [
#         [], [get_flat_quality_control_metric(), get_nested_quality_control_metric()], 
#     ]
# )
# def test_get_qc_metrics_with_flags(qc_metrics_without_flags: List[QualityControlMetric]) -> None:
#     with patch_get_sample_ids_to_samples() as mock_get_sample_ids_to_samples:
#         with patch_get_qc_metric_with_flag() as mock_get_qc_metric_with_flag:
#             result = get_qc_metrics_with_flags(
#                 qc_metrics_without_flags, SOME_SAMPLES, SOME_QC_FLAGGER
#             )
#             if qc_metrics_without_flags:
#                 assert result == [mock_get_qc_metric_with_flag.return_value] * len(
#                     qc_metrics_without_flags
#                 )
#             else:
#                 assert result == []
#             mock_get_sample_ids_to_samples.assert_called_once_with(SOME_SAMPLES)
#             for qc_metric in qc_metrics_without_flags:
#                 mock_get_qc_metric_with_flag.assert_any_call(
#                     qc_metric, mock_get_sample_ids_to_samples.return_value, SOME_QC_FLAGGER
#                 )
#             assert len(mock_get_qc_metric_with_flag.call_args_list) == len(
#                 qc_metrics_without_flags
#             )


#def test_get_sample_ids_to_samples() -> None:
#    result = get_sample_ids_to_samples(SOME_SAMPLES)
#    assert result == SOME_SAMPLE_IDS_TO_SAMPLES


@pytest.mark.parametrize(
    "qc_metric,same_expected",
    [
        (get_flat_quality_control_metric(), True),
        (get_nested_quality_control_metric(), False),
    ]
)
def test_get_qc_metric_with_flag(qc_metric: QualityControlMetric, same_expected: bool) -> None:
    with patch_get_nested_qc_metric_with_flag() as mock_get_nested_qc_metric_with_flag:
        result = get_qc_metric_with_flag(qc_metric, SOME_SAMPLE_IDS_TO_SAMPLES, SOME_QC_FLAGGER)
        if same_expected:
            assert result == qc_metric
            mock_get_nested_qc_metric_with_flag.assert_not_called()
        else:
            assert result == mock_get_nested_qc_metric_with_flag.return_value
            mock_get_nested_qc_metric_with_flag.assert_called_once_with(
                qc_metric, SOME_SAMPLE_IDS_TO_SAMPLES, SOME_QC_FLAGGER
            )


# @pytest.mark.parametrize(
#     "qc_metric,expected_sample,same_expected",
#     [
#         (
#             get_nested_quality_control_metric(sample_id=SOME_SAMPLE_ID),
#             SOME_SAMPLE,
#             False,
#         ),
#         (
#             get_nested_quality_control_metric(sample_id="foo"),
#             None,
#             True,
#         ),
#     ]
# )
# def test_get_nested_qc_metric_with_flag(
#     qc_metric: NestedQualityControlMetric,
#     expected_sample: Union[mock.MagicMock, None],
#     same_expected: bool
# ) -> None:
#     with patch_get_nested_qc_metric_with_flag_update() as mock_get_with_flag_update:
#         result = get_nested_qc_metric_with_flag(
#             qc_metric, SOME_SAMPLE_IDS_TO_SAMPLES, SOME_QC_FLAGGER
#         )
#         if same_expected:
#             assert result == qc_metric
#             mock_get_with_flag_update.assert_not_called()
#         else:
#             assert result == mock_get_with_flag_update.return_value
#             mock_get_with_flag_update.assert_called_once_with(
#                 qc_metric, expected_sample, SOME_QC_FLAGGER
#             )
# 
# 
# @pytest.mark.parametrize(
#     "flag,same_expected",
#     [("", True), (QcConstants.FLAG_PASS, False)]
# )
# def test_get_nested_qc_metric_with_flag_update(flag: str, same_expected: bool) -> None:
#     qc_metric = get_nested_quality_control_metric()
#     sample = get_mock_sample()
#     qc_flagger = get_mock_qc_flagger(flag=flag)
#     with patch_get_updated_qc_metric() as mock_get_updated_qc_metric:
#         result = get_nested_qc_metric_with_flag_update(qc_metric, sample, qc_flagger)
#         if same_expected:
#             assert result == qc_metric
#         else:
#             assert result == mock_get_updated_qc_metric.return_value
#             mock_get_updated_qc_metric.assert_called_once_with(qc_metric, flag=flag)
#         qc_flagger.get_flag.assert_called_once_with(
#             QC_METRIC_TITLE, QC_METRIC_VALUE, sample=sample
#         )
# 
# 
# def test_get_qc_metrics_without_flags() -> None:
#     with patch_chain() as mock_chain:
#         result = get_qc_metrics_without_flags(
#             SOME_FILES, SOME_SAMPLES, SOME_DESIRED_FIELDS
#         )
#         assert result == mock_chain.return_value
#         mock_chain.assert_called_once_with(
#             get_qc_metrics_from_files(SOME_FILES, SOME_DESIRED_FIELDS),
#             get_qc_metrics_from_samples(SOME_SAMPLES, SOME_DESIRED_FIELDS)
#         )
