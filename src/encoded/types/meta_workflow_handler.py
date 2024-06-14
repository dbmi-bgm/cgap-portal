"""The type file for the collection MetaWorkflowHandler and MetaWorkflowRunHandler.

not in __init.py__ , in its own file as # TODO what
add logic for autopopulating 'name' upon update or create
"""
from snovault import (
    collection,
    load_schema,
)
from .base import (
    Item,
)

@collection(
    name='meta-workflow-handlers',
    unique_key='accession',
    properties={
        'title': 'MetaWorkflowHandlers',
        'description': 'Listing of MetaWorkflowHandlers',
    })
class MetaWorkflowHandler(Item):
    item_type = 'meta_workflow_handler'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/meta_workflow_handler.json')


@collection(
    name='meta-workflow-run-handlers',
    properties={
        'title': 'MetaWorkflowRunHandlers',
        'description': 'Listing of MetaWorkflowRunHandlers',
    })
class MetaWorkflowRunHandler(Item):
    item_type = 'meta_workflow_run_handler'
    schema = load_schema('encoded:schemas/meta_workflow_run_handler.json')