"""The type file for the collection MetaWorkflow and MetaWorkflowRun.

moving this out of __init.py__ and into it's own file as
add logic for autopopulating 'name' upon update or create
"""
from snovault import (
    # calculated_property,
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


@collection(
    name='meta-workflow-runs',
    properties={
        'title': 'MetaWorkflowRuns',
        'description': 'Listing of MetaWorkflowRuns',
    })
class MetaWorkflowRun(Item):
    item_type = 'meta_workflow_run'
    embedded_list = ['meta_workflow.title', 'meta_workflow.version']
    schema = load_schema('encoded:schemas/meta_workflow_run.json')
