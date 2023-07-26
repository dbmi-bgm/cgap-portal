import mock
from contextlib import contextmanager
from typing import Any, Iterator, List, Optional, Union

import pytest
from dcicutils.testing_utils import patch_context

from ..util import JsonObject
from ..tmp_item_models import File, Sample
from ..types import qc_report_utils as qc_report_utils_module
from ..types.qc_report_utils import (
    QualityControlMetric,
    FlatQualityControlMetric,
    NestedQualityControlMetric,
    QcFlagger,
    get_latest_file_with_quality_metric,
    get_nested_qc_metric_with_flag,
    get_qc_metric_with_flag,
    get_qc_metrics,
    get_qc_metrics_with_flags,
    get_qc_metrics_without_flags,
    get_quality_control_metrics,
    get_sample_ids_to_samples,
)


class TestQcFlagger:
    pass


QC_METRIC_TITLE = "a_title"
QC_METRIC_VALUE = "a_value"
QC_METRIC_SAMPLE_ID = "a_sample_id"
QC_METRIC_FLAG = "a_flag"
QC_METRIC_LINK = "a_link"
QC_METRIC_COMPLETED_QC_STEP = "a_completed_qc_step"


def get_flat_quality_control_metric(
        title: Optional[str] = None, value: Optional[str] = None
) -> FlatQualityControlMetric:
    if title is None:
        title = QC_METRIC_TITLE
    if value is None:
        value = QC_METRIC_VALUE
    return FlatQualityControlMetric(QC_METRIC_SAMPLE_ID, title, value)


def get_nested_quality_control_metric(
    sample_id: Optional[str] = None,
    title: Optional[str] = None,
    value: Optional[str] = None,
    flag: Optional[str] = None,
    link: Optional[str] = None,
    completed_qc_step: Optional[str] = None,
) -> NestedQualityControlMetric:
    if sample_id is None:
        sample_id = QC_METRIC_SAMPLE_ID
    if title is None:
        title = QC_METRIC_TITLE
    if value is None:
        value = QC_METRIC_VALUE
    if flag is None:
        flag = QC_METRIC_FLAG
    if link is None:
        link = QC_METRIC_LINK
    if completed_qc_step is None:
        completed_qc_step = QC_METRIC_COMPLETED_QC_STEP
    return NestedQualityControlMetric(
        sample_id, title, value, flag=flag, link=link, completed_qc_step=completed_qc_step
    )


class TestFlatQualityControlMetric:
    SOME_TITLE = "some_title"

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
            ("", QC_METRIC_VALUE, {}),
            (QC_METRIC_TITLE, "", {}),
            (QC_METRIC_TITLE, QC_METRIC_VALUE, {QC_METRIC_TITLE: QC_METRIC_VALUE}),
        ]
    )
    def test_get_formatted_metric(
        self, title: str, value: str, expected: JsonObject
    ) -> None:
        quality_control_metric = get_flat_quality_control_metric(title=title, value=value)
        result = quality_control_metric.get_formatted_metric()
        assert result == expected


class TestNestedQualityControlMetric:
    SOME_TITLE = "some_title"
    SOME_FLAG = "some_flag"
    SOME_LINK = "some_link"
    SOME_QC_STEP = "some_qc_step"

    @pytest.mark.parametrize(
        "title,flag,link,completed_qc_step,expected",
        [
            (None, None, None, None, get_nested_quality_control_metric()),
            (SOME_TITLE, None, None, None, get_nested_quality_control_metric(title=SOME_TITLE)),
            (SOME_TITLE, SOME_FLAG, SOME_LINK, SOME_QC_STEP, get_nested_quality_control_metric(
                title=SOME_TITLE, flag=SOME_FLAG, link=SOME_LINK, completed_qc_step=SOME_QC_STEP)),
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
            (QC_METRIC_TITLE, "", "", "", {}),
            ("", QC_METRIC_VALUE, "", "", {}),
            (
                QC_METRIC_TITLE,
                QC_METRIC_VALUE,
                "",
                "",
                {QC_METRIC_TITLE: {"value": QC_METRIC_VALUE}},
            ),
            (
                QC_METRIC_TITLE,
                QC_METRIC_VALUE,
                QC_METRIC_FLAG,
                QC_METRIC_LINK,
                {QC_METRIC_TITLE: {
                    "value": QC_METRIC_VALUE, "flag": QC_METRIC_FLAG, "link": QC_METRIC_LINK
                }},
            ),
            (
                QC_METRIC_TITLE,
                "",
                QC_METRIC_FLAG,
                QC_METRIC_LINK,
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


def get_mock_file(uuid: Optional[str] = None, quality_metric: Optional[Any] = None) -> File:
    mock_file = mock.create_autospec(File, instance=True)
    if quality_metric is not None:
        mock_file.get_quality_metric.return_value = quality_metric
    if uuid is not None:
        mock_file.get_uuid.return_value = uuid
    return mock_file


SOME_UUID = "some_uuid"
ANOTHER_UUID = "another_uuid"


def evaluate_file_uuid(file: File) -> bool:
    return file.get_uuid() == SOME_UUID


def test_get_latest_file_with_quality_metric() -> None:
    file_to_get = get_mock_file(quality_metric=True, uuid=SOME_UUID)
    another_file_to_get = get_mock_file(quality_metric=True, uuid=SOME_UUID)
    file_evaluating_to_false = get_mock_file(quality_metric=True, uuid=ANOTHER_UUID)
    file_without_quality_metric = get_mock_file(quality_metric=False, uuid=SOME_UUID)
    files = [
        file_to_get, file_evaluating_to_false, file_without_quality_metric
    ]
    result = get_latest_file_with_quality_metric(files, evaluate_file_uuid)
    assert result == file_to_get

    files = [file_to_get, another_file_to_get]
    result = get_latest_file_with_quality_metric(files, evaluate_file_uuid)
    assert result == another_file_to_get

    files = [file_evaluating_to_false, file_without_quality_metric]
    result = get_latest_file_with_quality_metric(files, evaluate_file_uuid)
    assert result is None


@contextmanager
def patch_get_qc_metrics_without_flags(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_qc_metrics_without_flags, **kwargs
    ) as mock_item:
        yield mock_item


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


@contextmanager
def patch_get_qc_metrics(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_qc_metrics, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_qc_metrics_per_sample(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_qc_metrics_per_sample, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_sorted_and_formatted_quality_control_metrics(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_sorted_and_formatted_quality_control_metrics, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_nested_qc_metric_with_flag(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_nested_qc_metric_with_flag, **kwargs
    ) as mock_item:
        yield mock_item


@contextmanager
def patch_get_nested_qc_metric_with_flag_update(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        qc_report_utils_module.get_nested_qc_metric_with_flag_update, **kwargs
    ) as mock_item:
        yield mock_item



def get_mock_sample(bam_sample_id: Optional[str] = None) -> mock.MagicMock:
    sample = mock.create_autospec(Sample, instance=True)
    if bam_sample_id is not None:
        sample.get_bam_sample_id.return_value = bam_sample_id
    return sample


def get_mock_qc_flagger() -> mock.MagicMock:
    return mock.create_autospec(QcFlagger, instance=True)


SOME_SAMPLE_ID = "some_sample_id"
ANOTHER_SAMPLE_ID = "another_sample_id"
SOME_SAMPLE = get_mock_sample(bam_sample_id=SOME_SAMPLE_ID)
ANOTHER_SAMPLE = get_mock_sample(bam_sample_id=ANOTHER_SAMPLE_ID)
SOME_SAMPLES = [SOME_SAMPLE, ANOTHER_SAMPLE]
SOME_SAMPLE_IDS_TO_SAMPLES = {SOME_SAMPLE_ID: SOME_SAMPLE, ANOTHER_SAMPLE_ID: ANOTHER_SAMPLE}
SOME_FILES = "some_files"
SOME_QC_FLAGGER = get_mock_qc_flagger()
SOME_DESIRED_FIELDS = "some_desired_fields"

@pytest.mark.parametrize("quality_control_metrics", [[], [{}]]) 
def test_get_quality_control_metrics(quality_control_metrics: Union[List[JsonObject], None]) -> None:
    with patch_get_qc_metrics() as mock_get_qc_metrics:
        with patch_get_qc_metrics_per_sample() as mock_get_qc_metrics_per_sample:
            with patch_get_sorted_and_formatted_quality_control_metrics(
                return_value=quality_control_metrics
            ) as mock_get_formatted_quality_control_metrics:
                result = get_quality_control_metrics(
                    SOME_SAMPLES, SOME_FILES, SOME_QC_FLAGGER, SOME_DESIRED_FIELDS
                )
                if quality_control_metrics:
                    assert result == quality_control_metrics
                else:
                    assert result is None
                mock_get_qc_metrics.assert_called_once_with(
                    SOME_FILES, SOME_SAMPLES, SOME_QC_FLAGGER, SOME_DESIRED_FIELDS
                )
                mock_get_qc_metrics_per_sample.assert_called_once_with(
                    SOME_SAMPLES, mock_get_qc_metrics.return_value, SOME_DESIRED_FIELDS
                )
                mock_get_formatted_quality_control_metrics.assert_called_once_with(
                    mock_get_qc_metrics_per_sample.return_value
                )


def test_get_qc_metrics() -> None:
    with patch_get_qc_metrics_without_flags() as mock_get_qc_metrics_without_flags:
        with patch_get_qc_metrics_with_flags() as mock_get_qc_metrics_with_flags:
            result = get_qc_metrics(SOME_FILES, SOME_SAMPLES, SOME_QC_FLAGGER, SOME_DESIRED_FIELDS)
            assert result == mock_get_qc_metrics_with_flags.return_value
            mock_get_qc_metrics_without_flags.assert_called_once_with(
                SOME_FILES, SOME_SAMPLES, SOME_DESIRED_FIELDS
            )
            mock_get_qc_metrics_with_flags.assert_called_once_with(
                mock_get_qc_metrics_without_flags.return_value,
                SOME_SAMPLES,
                SOME_QC_FLAGGER,
            )

@pytest.mark.parametrize(
    "qc_metrics_without_flags",
    [
        [], [get_flat_quality_control_metric(), get_nested_quality_control_metric()], 
    ]
)
def test_get_qc_metrics_with_flags(qc_metrics_without_flags: List[QualityControlMetric]) -> None:
    with patch_get_sample_ids_to_samples() as mock_get_sample_ids_to_samples:
        with patch_get_qc_metric_with_flag() as mock_get_qc_metric_with_flag:
            result = get_qc_metrics_with_flags(
                qc_metrics_without_flags, SOME_SAMPLES, SOME_QC_FLAGGER
            )
            if qc_metrics_without_flags:
                assert result == [mock_get_qc_metric_with_flag.return_value] * len(
                    qc_metrics_without_flags
                )
            else:
                assert result == []
            mock_get_sample_ids_to_samples.assert_called_once_with(SOME_SAMPLES)
            for qc_metric in qc_metrics_without_flags:
                mock_get_qc_metric_with_flag.assert_any_call(
                    qc_metric, mock_get_sample_ids_to_samples.return_value, SOME_QC_FLAGGER
                )
            assert len(mock_get_qc_metric_with_flag.call_args_list) == len(
                qc_metrics_without_flags
            )


def test_get_sample_ids_to_samples() -> None:
    result = get_sample_ids_to_samples(SOME_SAMPLES)
    assert result == SOME_SAMPLE_IDS_TO_SAMPLES


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


@pytest.mark.parametrize(
    "qc_metric,expected_sample,same_expected",
    [
        (
            get_nested_quality_control_metric(sample_id=SOME_SAMPLE_ID),
            SOME_SAMPLE,
            False,
        ),
        (
            get_nested_quality_control_metric(sample_id="foo"),
            None,
            True,
        ),
    ]
)
def test_get_nested_qc_metric_with_flag(
    qc_metric: NestedQualityControlMetric,
    expected_sample: Union[mock.MagicMock, None],
    same_expected: bool
) -> None:
    with patch_get_nested_qc_metric_with_flag_update() as mock_get_with_flag_update:
        result = get_nested_qc_metric_with_flag(
            qc_metric, SOME_SAMPLE_IDS_TO_SAMPLES, SOME_QC_FLAGGER
        )
        if same_expected:
            assert result == qc_metric
            mock_get_with_flag_update.assert_not_called()
        else:
            assert result == mock_get_with_flag_update.return_value
            mock_get_with_flag_update.assert_called_once_with(
                qc_metric, expected_sample, SOME_QC_FLAGGER
            )


@pytest.mark.parametrize(
def test_get_nested_qc_metric_with_flag_update(flag: str, same_expected: bool) -> None:
    with patch_get_flag_for_qc_metric()

