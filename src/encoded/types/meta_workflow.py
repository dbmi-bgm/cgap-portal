"""The type file for the collection MetaWorkflow and MetaWorkflowRun.

moving this out of __init.py__ and into it's own file as
add logic for autopopulating 'name' upon update or create
"""
from snovault import (
    collection,
    load_schema,
)
from .base import (
    Item,
)


def _build_meta_workflow_run_embedded_list():
    """Create embedded list for MetaWorkflowRuns."""
    return [
        # MetaWorkflow linkTo
        "meta_workflow.title",
        "meta_workflow.version",
        # "workflow_runs.workflow_run.input_files.value.workflow_run_inputs.@id",

        # When part of `input_files`, `value` is a File linkTo/embed
        "workflow_runs.workflow_run.input_files.value.workflow_run_outputs.@id",
        "workflow_runs.workflow_run.input_files.value.quality_metric.overall_quality_status",
        "workflow_runs.workflow_run.input_files.value.file_size",
        "workflow_runs.workflow_run.input_files.value.file_format",
        "workflow_runs.workflow_run.input_files.workflow_argument_name",
        "workflow_runs.workflow_run.input_files.*",

        # When part of `parameters`, `value` is a string (maybe number)
        # Removed for now, until we maybe update ReactWorkflowViz to re-use param nodes. Not high priority.
        # "workflow_runs.workflow_run.parameters.value",
        # "workflow_runs.workflow_run.parameters.workflow_argument_name",
        # "workflow_runs.workflow_run.parameters.*",

        "workflow_runs.workflow_run.output_files.value.workflow_run_inputs.@id",
        "workflow_runs.workflow_run.output_files.value.quality_metric.overall_quality_status",
        "workflow_runs.workflow_run.output_files.value.file_size",
        "workflow_runs.workflow_run.output_files.value.file_format",
        "workflow_runs.workflow_run.output_files.workflow_argument_name",
        "workflow_runs.workflow_run.output_files.*",
        # "workflow_runs.workflow_run.output_files.value.workflow_run_outputs.@id"
    ]


@collection(
    name='meta-workflows',
    unique_key='accession',
    properties={
        'title': 'MetaWorkflows',
        'description': 'Listing of MetaWorkflows',
    })
class MetaWorkflow(Item):
    item_type = 'meta_workflow'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/meta_workflow.json')


@collection(
    name='meta-workflow-runs',
    properties={
        'title': 'MetaWorkflowRuns',
        'description': 'Listing of MetaWorkflowRuns',
    })
class MetaWorkflowRun(Item):
    item_type = 'meta_workflow_run'
    embedded_list = _build_meta_workflow_run_embedded_list()
    schema = load_schema('encoded:schemas/meta_workflow_run.json')
