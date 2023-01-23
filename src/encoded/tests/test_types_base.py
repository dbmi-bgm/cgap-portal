from requests import Request
from typing import Any, List, Mapping, Optional, Sequence
from unittest import mock

import pytest
from webtest import TestApp

from ..types.base import Item, PipelineRetriever


class Mocks:

    @staticmethod
    def mock_item(attributes: Optional[Mapping[str, Any]] = None) -> mock.NonCallableMagicMock:
        item = mock.create_autospec(Item, instance=True)
        if attributes:
            for key, value in attributes.items():
                setattr(item, key, value)
        return item

    @staticmethod
    def mock_request() -> mock.NonCallableMagicMock:
        return mock.create_autospec(Request, instance=True)


class TestPipelineView:

    PIPELINE_VIEW_ADDON = "@@pipelines"

    def assert_pipeline_display_status(
        self, testapp: TestApp, item_to_get: Mapping, status: int
    ) -> None:
        item_pipeline_url = self.get_item_pipeline_display_url(item_to_get)
        testapp.get(item_pipeline_url, status=status)

    def get_item_pipeline_display_url(self, item_to_get: Mapping) -> str:
        item_atid = item_to_get["@id"]
        return item_atid + self.PIPELINE_VIEW_ADDON

    def test_pipeline_display_success(
        self, testapp: TestApp, sample_proc_fam: Mapping
    ) -> None:
        self.assert_pipeline_display_status(testapp, sample_proc_fam, 200)

    def test_pipeline_display_failure(self, testapp: TestApp, project: Mapping) -> None:
        self.assert_pipeline_display_status(testapp, project, 405)


# @pytest.mark.parametrize(
#     "item_attributes,expected",
#     [
#         ({}, []),
#         ({"foo": "bar"}, []),
#         ({"pipeline_properties": ["foo", "bar"]}, ["foo", "bar"]),
#     ]
# )
# def test_get_pipeline_properties(
#     item_attributes: Mapping[str, Any], expected: Sequence[str]
# ) -> None:
#     item = Mocks.mock_item(item_attributes)
#     assert get_pipeline_properties(item) == expected


class TestPipelineRetriever:

    REQUEST = Mocks.mock_request()
    CONTEXT = Mocks.mock_item()
    PIPELINE_PROPERTIES = ["foo", "bar.buz"]

    def pipeline_retriever(self) -> PipelineRetriever:
        return PipelineRetriever(self.CONTEXT, self.REQUEST)


    @pytest.mark.parametrize(
        "pipeline_properties,expected",
        [
            ([], []),
            (["foo"], ["foo.*"]),
            (["foo", "bar.buz"], ["foo.*", "bar.*", "bar.buz.*"]),
        ]
    )
    def test_get_properties_to_embed(
        self, pipeline_properties: Sequence[str], expected: Sequence[str]
    ) -> None:
        retriever = self.pipeline_retriever()
        assert retriever.get_properties_to_embed() == expected

    @pytest.mark.parametrize(
        "pipeline_property,expected",
        [
            ("", []),
            ("foo", ["foo.*"]),
            ("foo.bar", ["foo.*", "foo.bar.*"]),
        ]
    )
    def test_get_properties_to_embed_from_pipeline_property(
            self, pipeline_property: str, expected: List[str]
    ) -> None:
        pipeline_retriever = self.pipeline_retriever()
        assert pipeline_retriever.get_properties_to_embed_from_pipeline_property(
            pipeline_property
        ) == expected
