"""The type file for the collection MetaWorkflow and MetaWorkflowRun.

moving this out of __init.py__ and into it's own file as
add logic for autopopulating 'name' upon update or create
"""
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
)

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
    rev = {
        'meta_workflows': ('MetaWorkflow', 'workflows.workflow')
    }

    @calculated_property(schema={
        "title": "Meta Workflows",
        "description": "meta workflows that contain this workflow",
        "type": "array",
        "exclude_from": ["FFedit-create"],
        "items": {
            "title": "Meta Workflow",
            "type": ["string", "object"],
            "linkTo": "MetaWorkflow"
        }
    })
    def meta_workflows(self, request):
        return self.rev_link_atids(request, "meta_workflows")

@collection(
    name='meta-workflow-runs',
    properties={
        'title': 'MetaWorkflowRuns',
        'description': 'Listing of MetaWorkflowRuns',
    })
class MetaWorkflowRun(Item):
    item_type = 'meta_workflow_run'
    schema = load_schema('encoded:schemas/meta_workflow_run.json')
    rev = {
        'meta_workflow_runs': ('MetaWorkflowRun', 'workflow_runs.workflow_run')
    }

    @calculated_property(schema={
        "title": "Meta Workflow Runs",
        "description": "meta workflow runs that contain this workflow run",
        "type": "array",
        "exclude_from": ["FFedit-create"],
        "items": {
            "title": "Meta Workflow Run",
            "type": ["string", "object"],
            "linkTo": "MetaWorkflowRun"
        }
    })
    def meta_workflow_runs(self, request):
        return self.rev_link_atids(request, "meta_workflow_runs")
