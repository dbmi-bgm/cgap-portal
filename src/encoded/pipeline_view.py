from dataclasses import dataclass
from requests import Request
from typing import Any, Dict, List, Mapping, Optional, Sequence

from pyramid.httpexceptions import HTTPMethodNotAllowed
from pyramid.view import view_config
from snovault.util import debug_log

from . import custom_embed
from .types.base import Item


def validate_item_pipelines_get(context: Item, request: Request) -> None:
    pipeline_properties = getattr(context, "pipeline_properties", [])
    if not pipeline_properties:
        raise HTTPMethodNotAllowed(detail="Item cannot display pipelines")


@view_config(
    context=Item,
    permission="view",
    name="pipelines",
    request_method="GET",
    validators=[validate_item_pipelines_get],
)
@debug_log
def pipelines(context: Item, request: Request) -> dict:
    pipeline_retriever = PipelineRetriever(context, request)
    pipelines_to_display = pipeline_retriever.get_pipelines_to_display()
    return PipelineDisplayer(pipelines_to_display).get_display()


@dataclass(frozen=True)
class PipelineToDisplay:

    ATID = "@id"
    COMPLETED = "completed"
    DISPLAY_TITLE = "display_title"
    FINAL_STATUS = "final_status"
    FINAL_STATUS_COMPLETED = "completed"
    FINAL_STATUS_STOPPED = "stopped"
    FINAL_STATUS_QC_ERROR = "quality metric failed"
    NAME = "name"
    RUN_STATUS = "run_status"
    RUNNING = "running"
    STOPPED = "stopped"
    STOPPED_FINAL_STATUSES = [FINAL_STATUS_STOPPED, FINAL_STATUS_QC_ERROR]
    VERSION = "version"

    parent_item: Mapping[str, Any]
    pipeline: Mapping[str, Any]

    def get_parent_item_display(self) -> str:
        return {
            self.ATID: self.get_parent_item_atid(),
            self.NAME: self.get_parent_item_name(),
        }

    def get_parent_item_atid(self) -> str:
        return self.parent_item.get(self.ATID, "")

    def get_parent_item_name(self) -> str:
        return self.parent_item.get(self.DISPLAY_TITLE, "")

    def get_pipeline_display(self) -> Mapping[str, Any]:
        return {
            self.ATID: self.get_pipeline_atid(),
            self.RUN_STATUS: self.get_pipeline_run_status(),
            self.NAME: self.get_pipeline_name(),
            self.VERSION: self.get_pipeline_version(),
        }

    def get_pipeline_run_status(self) -> str:
        final_status = self.get_pipeline_final_status()
        if final_status == self.FINAL_STATUS_COMPLETED:
            return self.COMPLETED
        elif final_status in self.STOPPED_FINAL_STATUSES:
            return self.STOPPED
        else:
            return self.RUNNING

    def get_pipeline_final_status(self) -> str:
        return self.pipeline.get(self.FINAL_STATUS, "")

    def get_pipeline_name(self) -> str:
        return self.pipeline.get(self.NAME, "")

    def get_pipeline_version(self) -> str:
        return self.pipeline.get(self.VERSION, "")

    def get_pipeline_atid(self) -> str:
        return self.pipeline.get(self.ATID, "")


@dataclass(frozen=True)
class PipelineRetriever:

    PIPELINE_PROPERTIES = "pipeline_properties"
    UUID = "uuid"

    context: Item
    request: Request

    def get_pipelines_to_display(self) -> List[PipelineToDisplay]:
        item_with_embeds = self.get_item_with_embeds()
        return self.get_pipelines(item_with_embeds)

    def get_item_with_embeds(self) -> List[dict]:
        item_identifier = self.get_item_identifier()
        custom_embed_parameters = self.get_custom_embed_parameters()
        return custom_embed.CustomEmbed(
            self.request, item_identifier, custom_embed_parameters
        ).get_embedded_fields()

    def get_item_identifier(self) -> str:
        return str(getattr(self.context, self.UUID, ""))

    def get_custom_embed_parameters(self) -> dict:
        return {custom_embed.REQUESTED_FIELDS: self.get_properties_to_embed()}

    def get_properties_to_embed(self) -> List[str]:
        result = ["*"]
        for pipeline_property in self.get_pipeline_properties():
            result.extend(
                self.get_properties_to_embed_from_pipeline_property(pipeline_property)
            )
        return result

    def get_pipeline_properties(self) -> List[str]:
        return getattr(self.context, self.PIPELINE_PROPERTIES, [])

    def get_properties_to_embed_from_pipeline_property(
        self,
        pipeline_property: str
    ) -> List[str]:
        split_properties = [
            term for term in pipeline_property.split(custom_embed.PROPERTY_SPLITTER)
            if term
        ]
        return [
            self.make_embed_property(
                custom_embed.PROPERTY_SPLITTER.join(split_properties[:idx + 1])
            )
            for idx in range(len(split_properties))
        ]

    @staticmethod
    def make_embed_property(property_to_embed: str) -> str:
        return (
            property_to_embed
            + custom_embed.PROPERTY_SPLITTER
            + custom_embed.EMBED_ALL_FIELDS_MARKER
        )

    def get_pipelines(self, embedded_properties: Mapping) -> List[PipelineToDisplay]:
        result = []
        for pipeline_property in self.get_pipeline_properties():
            result.extend(
                self.get_pipelines_for_pipeline_property(
                    embedded_properties, pipeline_property
                )
            )
        return result

    def get_pipelines_for_pipeline_property(
        self,
        embedded_properties: Mapping,
        pipeline_property: str
    ) -> List[PipelineToDisplay]:
        properties_to_get = self.split_pipeline_property(pipeline_property)
        return RecursivePipelineRetriever(
            embedded_properties, embedded_properties, properties_to_get
        ).get_pipelines()

    @staticmethod
    def split_pipeline_property(pipeline_property: str) -> List[str]:
        return [
            term for term in pipeline_property.split(custom_embed.PROPERTY_SPLITTER)
            if term
        ]


@dataclass(frozen=True)
class RecursivePipelineRetriever:

    TYPES = "@type"
    META_WORKFLOW_RUN_TYPE = "MetaWorkflowRun"

    parent_item: Mapping
    item_to_get_from: Any
    properties_to_get: List[str]

    def get_pipelines(self) -> List[PipelineToDisplay]:
        result = []
        if isinstance(self.item_to_get_from, dict):
            result.extend(self.get_pipelines_from_dict())
        elif isinstance(self.item_to_get_from, list):
            result.extend(self.recursive_get_pipelines_from_list())
        return result

    def get_pipelines_from_dict(self) -> List[PipelineToDisplay]:
        result = []
        if self.properties_to_get:
            result.extend(self.recursive_get_pipelines_from_dict())
        elif self.is_pipeline_item():
            result.append(PipelineToDisplay(self.parent_item, self.item_to_get_from))
        return result

    def is_pipeline_item(self) -> bool:
        return self.META_WORKFLOW_RUN_TYPE in self.item_to_get_from.get(self.TYPES, [])

    def recursive_get_pipelines_from_dict(self) -> List[PipelineToDisplay]:
        result = []
        [property_to_get, *remaining_properties_to_get] = self.properties_to_get
        new_item_to_get_from = self.item_to_get_from.get(property_to_get, {})
        if new_item_to_get_from:
            result.extend(
                self.recursive_get_pipelines_from_item(
                    new_item_to_get_from, remaining_properties_to_get
                )
            )
        return result

    def recursive_get_pipelines_from_list(self) -> List[PipelineToDisplay]:
        result = []
        for item in self.item_to_get_from:
            result.extend(self.recursive_get_pipelines_from_item(item))
        return result

    def recursive_get_pipelines_from_item(
        self, item: Any, properties_to_get: Optional[List[str]] = None
    ) -> List[PipelineToDisplay]:
        if properties_to_get is None:
            properties_to_get = self.properties_to_get
        parent_item_to_pass = self.get_parent_item_to_pass(item, properties_to_get)
        return RecursivePipelineRetriever(
            parent_item_to_pass, item, properties_to_get
        ).get_pipelines()

    def get_parent_item_to_pass(self, item: Any, properties_to_get: List[str]) -> Dict:
        if self.is_item(item) and properties_to_get:
            return item
        return self.parent_item

    def is_item(self, item: Any) -> bool:
        if isinstance(item, dict) and item.get(self.TYPES):
            return True
        return False


@dataclass(frozen=True)
class PipelineDisplayer:

    pipelines_to_display: Sequence[PipelineToDisplay]

    def get_display(self) -> Dict[str, List[Dict]]: 
        result = {}
        for pipeline_to_display in self.pipelines_to_display:
            parent_atid = pipeline_to_display.get_parent_item_atid()
            pipeline_display = pipeline_to_display.get_pipeline_display()
            existing_pipeline_displays = result.get(parent_atid)
            if existing_pipeline_displays is None:
                result[parent_atid] = [pipeline_display]
            else:
                existing_pipeline_displays.append(pipeline_display)
        return result
