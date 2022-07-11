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
