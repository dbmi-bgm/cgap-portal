from contextlib import contextmanager
from requests import Request
from typing import Any, List, Mapping, Optional, Sequence, Union
from unittest import mock
from uuid import uuid4

import pytest
from webtest import TestApp

from .. import pipeline_view as pipeline_view_module
from ..pipeline_view import (
    Item,
    PipelineRetriever,
    PipelineToDisplay,
    RecursivePipelineRetriever,
)


class Mocks:
    @staticmethod
    def autospec_instance_with_attributes(
        item_to_mock: object, attributes: Optional[Mapping[str, Any]] = None
    ) -> mock.NonCallableMagicMock:
        mocked_item = mock.create_autospec(item_to_mock, instance=True)
        if attributes:
            for attribute, value in attributes.items():
                setattr(mocked_item, attribute, value)
        return mocked_item

    @staticmethod
    def mock_context(
        attributes: Optional[Mapping[str, Any]] = None
    ) -> mock.NonCallableMagicMock:
        return Mocks.autospec_instance_with_attributes(Item, attributes)

    @staticmethod
    def mock_request(
        attributes: Optional[Mapping[str, Any]] = None
    ) -> mock.NonCallableMagicMock:
        return Mocks.autospec_instance_with_attributes(Request, attributes)

    @staticmethod
    def mock_pipeline_to_display(
        attributes: Optional[Mapping[str, Any]] = None
    ) -> mock.NonCallableMagicMock:
        return Mocks.autospec_instance_with_attributes(PipelineToDisplay, attributes)


class Patches:
    @staticmethod
    @contextmanager
    def patch_context(
        object_to_patch: object,
        attribute_to_patch: str,
        return_value: Optional[Any] = None,
    ) -> mock.MagicMock:
        with mock.patch.object(object_to_patch, attribute_to_patch) as mocked_item:
            if return_value:
                mocked_item.return_value = return_value
            yield mocked_item

    @staticmethod
    @contextmanager
    def get_item_with_embeds(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module.PipelineRetriever, "get_item_with_embeds", **kwargs
        ) as mocked_item:
            yield mocked_item

    @staticmethod
    @contextmanager
    def get_pipelines(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module.PipelineRetriever, "get_pipelines", **kwargs
        ) as mocked_item:
            yield mocked_item

    @staticmethod
    @contextmanager
    def get_pipeline_properties(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            PipelineRetriever, "get_pipeline_properties", **kwargs
        ) as result:
            yield result

    @staticmethod
    @contextmanager
    def custom_embed(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module.custom_embed, "CustomEmbed", **kwargs
        ) as result:
            yield result

    @staticmethod
    @contextmanager
    def get_pipelines_for_pipeline_property(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module.PipelineRetriever,
            "get_pipelines_for_pipeline_property",
            **kwargs
        ) as result:
            yield result

    @staticmethod
    @contextmanager
    def recursive_pipeline_retriever(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module, "RecursivePipelineRetriever", **kwargs
        ) as result:
            yield result

    @staticmethod
    @contextmanager
    def pipeline_to_display(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module, "PipelineToDisplay", **kwargs
        ) as result:
            yield result

    @staticmethod
    @contextmanager
    def recursive_get_pipelines_from_dict(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module.RecursivePipelineRetriever,
            "recursive_get_pipelines_from_dict",
            **kwargs
        ) as result:
            yield result

    @staticmethod
    @contextmanager
    def recursive_get_pipelines_from_item(**kwargs) -> mock.MagicMock:
        with Patches.patch_context(
            pipeline_view_module.RecursivePipelineRetriever,
            "recursive_get_pipelines_from_item",
            **kwargs
        ) as result:
            yield result


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


class TestPipelineRetriever:

    SOME_UUID = uuid4()
    SOME_IDENTIFIER = str(SOME_UUID)
    SOME_PIPELINE_PROPERTIES = ["foo", "bar"]
    SOME_ITEM = {"uuid": SOME_IDENTIFIER, "foo": "bar"}
    SOME_EMBED_PARAMETERS = {"requested_fields": ["*", "foo.*", "bar.*"]}
    SOME_PIPELINE_TO_DISPLAY = Mocks.mock_pipeline_to_display()
    SOME_PIPELINES_TO_DISPLAY = [SOME_PIPELINE_TO_DISPLAY, SOME_PIPELINE_TO_DISPLAY]
    REQUEST = Mocks.mock_request()
    CONTEXT = Mocks.mock_context(
        {"uuid": SOME_UUID, "pipeline_properties": SOME_PIPELINE_PROPERTIES}
    )

    def pipeline_retriever(
        self, request: Optional[Request] = None, context: Optional[Item] = None
    ) -> PipelineRetriever:
        return PipelineRetriever(context or self.CONTEXT, request or self.REQUEST)

    def test_get_pipelines_to_display(self) -> None:
        with Patches.get_item_with_embeds(return_value=self.SOME_ITEM):
            with Patches.get_pipelines() as mocked_get_pipelines:
                pipeline_retriever = self.pipeline_retriever()
                result = pipeline_retriever.get_pipelines_to_display()
                mocked_get_pipelines.assert_called_once_with(self.SOME_ITEM)
                assert result == mocked_get_pipelines.return_value

    def test_get_item_with_embeds(self) -> None:
        with Patches.custom_embed() as mock_custom_embed:
            retriever = self.pipeline_retriever()
            result = retriever.get_item_with_embeds()
            assert result == mock_custom_embed.return_value.get_embedded_fields()
            mock_custom_embed.assert_called_once_with(
                self.REQUEST, self.SOME_IDENTIFIER, self.SOME_EMBED_PARAMETERS
            )

    def test_get_item_identifier(self) -> None:
        retriever = self.pipeline_retriever()
        assert retriever.get_item_identifier() == self.SOME_IDENTIFIER

    def test_get_custom_embed_parameters(self) -> None:
        with Patches.get_pipeline_properties(
            return_value=self.SOME_PIPELINE_PROPERTIES
        ):
            retriever = self.pipeline_retriever()
            assert retriever.get_custom_embed_parameters() == self.SOME_EMBED_PARAMETERS

    @pytest.mark.parametrize(
        "pipeline_properties,expected",
        [
            ([], ["*"]),
            (["foo"], ["*", "foo.*"]),
            (["foo", "bar.buz"], ["*", "foo.*", "bar.*", "bar.buz.*"]),
        ],
    )
    def test_get_properties_to_embed(
        self, pipeline_properties: Sequence[str], expected: Sequence[str]
    ) -> None:
        with Patches.get_pipeline_properties(return_value=pipeline_properties):
            retriever = self.pipeline_retriever()
            assert retriever.get_properties_to_embed() == expected

    @pytest.mark.parametrize(
        "item_attributes,expected",
        [
            ({}, []),
            ({"foo": "bar"}, []),
            ({"pipeline_properties": ["foo", "bar"]}, ["foo", "bar"]),
        ],
    )
    def test_get_pipeline_properties(
        self, item_attributes: Mapping[str, Any], expected: Sequence[str]
    ) -> None:
        context = Mocks.mock_context(item_attributes)
        retriever = self.pipeline_retriever(context=context)
        assert retriever.get_pipeline_properties() == expected

    @pytest.mark.parametrize(
        "pipeline_property,expected",
        [
            ("", []),
            ("foo", ["foo.*"]),
            ("foo.bar", ["foo.*", "foo.bar.*"]),
        ],
    )
    def test_get_properties_to_embed_from_pipeline_property(
        self, pipeline_property: str, expected: List[str]
    ) -> None:
        pipeline_retriever = self.pipeline_retriever()
        assert (
            pipeline_retriever.get_properties_to_embed_from_pipeline_property(
                pipeline_property
            )
            == expected
        )

    def test_make_embed_property(self) -> None:
        pipeline_retriever = self.pipeline_retriever()
        assert pipeline_retriever.make_embed_property("foo") == "foo.*"

    def test_get_pipelines(self) -> None:
        item_with_pipelines = self.SOME_ITEM
        pipeline_property_count = len(self.SOME_PIPELINE_PROPERTIES)
        with Patches.get_pipeline_properties(
            return_value=self.SOME_PIPELINE_PROPERTIES
        ):
            with Patches.get_pipelines_for_pipeline_property(
                return_value=self.SOME_PIPELINES_TO_DISPLAY
            ) as mock_get_pipelines_for_pipeline_property:
                retriever = self.pipeline_retriever()
                result = retriever.get_pipelines(item_with_pipelines)
                expected = self.SOME_PIPELINES_TO_DISPLAY * pipeline_property_count
                assert result == expected
                assert (
                    len(mock_get_pipelines_for_pipeline_property.mock_calls)
                    == pipeline_property_count
                )
                for idx in range(pipeline_property_count):
                    mock_get_pipelines_for_pipeline_property.assert_any_call(
                        item_with_pipelines, self.SOME_PIPELINE_PROPERTIES[idx]
                    )

    def test_get_pipelines_for_pipeline_property(self) -> None:
        item_properties = self.SOME_ITEM
        pipeline_property = "foo.bar"
        expected_properties_to_get = ["foo", "bar"]
        expected_call = [item_properties, item_properties, expected_properties_to_get]
        with Patches.recursive_pipeline_retriever() as mock_recursive_retriever:
            pipeline_retriever = self.pipeline_retriever()
            result = pipeline_retriever.get_pipelines_for_pipeline_property(
                item_properties, pipeline_property
            )
            mock_recursive_retriever.assert_called_once_with(*expected_call)
            assert result == mock_recursive_retriever.return_value.get_pipelines()

    @pytest.mark.parametrize(
        "pipeline_property,expected",
        [
            ("", []),
            ("foo", ["foo"]),
            ("foo.bar", ["foo", "bar"]),
        ],
    )
    def test_split_pipeline_property(
        self, pipeline_property: str, expected: Sequence[str]
    ) -> None:
        pipeline_retriever = self.pipeline_retriever()
        assert pipeline_retriever.split_pipeline_property(pipeline_property) == expected


class TestRecursivePipelineRetriever:

    SOME_NON_ITEM = {"foo": "bar"}
    SOME_ITEM = {"foo": "bar", "@type": ["Item"]}
    ANOTHER_NON_ITEM = [SOME_ITEM]
    SOME_PIPELINE = {"@id": "/pipelines/1/", "@type": ["MetaWorkflowRun", "Item"]}
    ANOTHER_PIPELINE = {"@id": "/pipelines/2/", "@type": ["MetaWorkflowRun", "Item"]}
    SOME_ITEM_WITH_PIPELINE = {"foo": {"bar": SOME_PIPELINE}, "@type": ["Item"]}
    SOME_LIST_WITH_ITEM_WITH_PIPELINE = [SOME_ITEM_WITH_PIPELINE, SOME_ITEM]
    SOME_PIPELINE_PROPERTIES = ["foo", "bar"]

    def default_arg(self, arg: Any, default: Any) -> Any:
        if arg is None:
            return default
        return arg

    def recursive_pipeline_retriever(
        self,
        parent_item: Optional[Mapping] = None,
        item: Optional[any] = None,
        pipeline_properties: Optional[Sequence[str]] = None,
    ) -> RecursivePipelineRetriever:
        return RecursivePipelineRetriever(
            self.default_arg(parent_item, self.SOME_ITEM),
            self.default_arg(item, self.SOME_NON_ITEM),
            self.default_arg(pipeline_properties, self.SOME_PIPELINE_PROPERTIES),
        )

    @pytest.mark.parametrize(
        "item,pipeline_properties,expected",
        [
            ("", None, []),
            (5, None, []),
            (None, None, []),
            (SOME_NON_ITEM, None, []),
            (
                SOME_ITEM_WITH_PIPELINE,
                None,
                [PipelineToDisplay(SOME_ITEM, SOME_PIPELINE)],
            ),
            (SOME_ITEM_WITH_PIPELINE, ["foo"], []),
            (SOME_PIPELINE, None, []),
            (SOME_PIPELINE, [], [PipelineToDisplay(SOME_ITEM, SOME_PIPELINE)]),
            (
                SOME_LIST_WITH_ITEM_WITH_PIPELINE,
                None,
                [PipelineToDisplay(SOME_ITEM_WITH_PIPELINE, SOME_PIPELINE)],
            ),
        ],
    )
    def test_get_pipelines(
        self,
        item: Any,
        pipeline_properties: Union[Sequence[str], None],
        expected: Sequence[PipelineToDisplay],
    ) -> None:
        retriever = self.recursive_pipeline_retriever(
            item=item, pipeline_properties=pipeline_properties
        )
        assert retriever.get_pipelines() == expected

    @pytest.mark.parametrize(
        "item,pipeline_properties,expected_recursive_call,expected_pipeline_to_display",
        [
            (SOME_NON_ITEM, SOME_PIPELINE_PROPERTIES, True, False),
            (SOME_ITEM, SOME_PIPELINE_PROPERTIES, True, False),
            (SOME_ITEM, [], False, False),
            (SOME_PIPELINE, SOME_PIPELINE_PROPERTIES, True, False),
            (SOME_PIPELINE, [], False, True),
        ],
    )
    def test_get_pipelines_from_dict(
        self,
        item: Mapping,
        pipeline_properties: Sequence[str],
        expected_recursive_call: bool,
        expected_pipeline_to_display: bool,
    ) -> None:
        with Patches.recursive_get_pipelines_from_dict(
            return_value=[self.SOME_PIPELINE]
        ) as mock_recursive_get_pipelines_from_dict:
            with Patches.pipeline_to_display() as mock_pipeline_to_display:
                recursive_pipeline_retriever = self.recursive_pipeline_retriever(
                    item=item, pipeline_properties=pipeline_properties
                )
                result = recursive_pipeline_retriever.get_pipelines_from_dict()
                if expected_recursive_call:
                    mock_recursive_get_pipelines_from_dict.assert_called_once_with()
                    assert result == [self.SOME_PIPELINE]
                    mock_pipeline_to_display.assert_not_called()
                elif expected_pipeline_to_display:
                    mock_recursive_get_pipelines_from_dict.assert_not_called()
                    assert result == [mock_pipeline_to_display.return_value]
                    mock_pipeline_to_display.assert_called_once_with(
                        self.SOME_ITEM, item
                    )
                else:
                    mock_recursive_get_pipelines_from_dict.assert_not_called()
                    mock_pipeline_to_display.assert_not_called()
                    assert result == []

    @pytest.mark.parametrize(
        "item,expected",
        [
            (SOME_NON_ITEM, False),
            (SOME_ITEM, False),
            (SOME_PIPELINE, True),
        ],
    )
    def test_is_pipeline_item(self, item: Mapping, expected: bool) -> None:
        retriever = self.recursive_pipeline_retriever(item=item)
        assert retriever.is_pipeline_item() == expected

    @pytest.mark.parametrize(
        "item,properties_to_get,expected_call",
        [
            (SOME_PIPELINE, SOME_PIPELINE_PROPERTIES, []),
            (SOME_NON_ITEM, SOME_PIPELINE_PROPERTIES, ["bar", ["bar"]]),
            (SOME_NON_ITEM, ["foo"], ["bar", []]),
        ],
    )
    def test_recursive_get_pipelines_from_dict(
        self,
        item: Mapping,
        properties_to_get: Sequence[str],
        expected_call: Sequence,
    ) -> None:
        retriever = self.recursive_pipeline_retriever(
            item=item, pipeline_properties=properties_to_get
        )
        with Patches.recursive_get_pipelines_from_item(
            return_value=[self.SOME_PIPELINE]
        ) as mocked_get_pipelines_from_item:
            result = retriever.get_pipelines_from_dict()
            if expected_call:
                assert result == [self.SOME_PIPELINE]
                mocked_get_pipelines_from_item.assert_called_once_with(*expected_call)
            else:
                assert result == []
                mocked_get_pipelines_from_item.assert_not_called()

    @pytest.mark.parametrize(
        "item",
        [
            (ANOTHER_NON_ITEM),
            (SOME_PIPELINE_PROPERTIES),
        ],
    )
    def test_recursive_get_pipelines_from_list(
        self,
        item: Sequence,
    ) -> None:
        with Patches.recursive_get_pipelines_from_item(
            return_value=[self.SOME_PIPELINE]
        ) as mocked_get_pipelines_from_item:
            recursive_pipeline_retriever = self.recursive_pipeline_retriever(item=item)
            result = recursive_pipeline_retriever.recursive_get_pipelines_from_list()
            for sub_item in item:
                mocked_get_pipelines_from_item.assert_any_call(sub_item)
            assert mocked_get_pipelines_from_item.call_count == len(item)
            assert len(result) == len(item)
            for pipeline in result:
                assert pipeline == self.SOME_PIPELINE

    @pytest.mark.parametrize(
        "item,properties_to_get,expected_call_args",
        [
            (SOME_NON_ITEM, None, [SOME_ITEM, SOME_NON_ITEM, SOME_PIPELINE_PROPERTIES]),
            (SOME_NON_ITEM, ["foo"], [SOME_ITEM, SOME_NON_ITEM, ["foo"]]),
            (
                SOME_PIPELINE,
                None,
                [SOME_PIPELINE, SOME_PIPELINE, SOME_PIPELINE_PROPERTIES],
            ),
            (SOME_PIPELINE, [], [SOME_ITEM, SOME_PIPELINE, []]),
            (SOME_PIPELINE, ["foo"], [SOME_PIPELINE, SOME_PIPELINE, ["foo"]]),
        ],
    )
    def test_recursive_get_pipelines_from_item(
        self,
        item: Any,
        properties_to_get: Union[Sequence[str], None],
        expected_call_args: Sequence,
    ) -> None:
        """Test that method creates new parent class recursively.

        Since recursive, mock the class only after intialization.
        """
        recursive_pipeline_retriever = self.recursive_pipeline_retriever()
        with Patches.recursive_pipeline_retriever() as mock_recursive_pipeline_retriever:
            result = recursive_pipeline_retriever.recursive_get_pipelines_from_item(
                item, properties_to_get
            )
            mock_recursive_pipeline_retriever.assert_called_once_with(
                *expected_call_args
            )
            assert (
                result == mock_recursive_pipeline_retriever.return_value.get_pipelines()
            )

    @pytest.mark.parametrize(
        "item,properties_to_get,expected",
        [
            (SOME_NON_ITEM, [], SOME_ITEM),
            (SOME_NON_ITEM, SOME_PIPELINE_PROPERTIES, SOME_ITEM),
            (SOME_PIPELINE, [], SOME_ITEM),
            (SOME_PIPELINE, SOME_PIPELINE_PROPERTIES, SOME_PIPELINE),
        ],
    )
    def test_get_parent_item_to_pass(
        self, item: Any, properties_to_get: Sequence[str], expected: Mapping
    ) -> None:
        recursive_pipeline_retriever = self.recursive_pipeline_retriever()
        assert (
            recursive_pipeline_retriever.get_parent_item_to_pass(
                item, properties_to_get
            )
            == expected
        )

    @pytest.mark.parametrize(
        "item,expected",
        [
            (SOME_NON_ITEM, False),
            (ANOTHER_NON_ITEM, False),
            (SOME_ITEM, True),
        ],
    )
    def test_is_item(self, item: Any, expected: bool) -> None:
        retriever = self.recursive_pipeline_retriever()
        assert retriever.is_item(item) == expected
