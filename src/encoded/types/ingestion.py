"""
Collection for objects related to ingestion submissions.
"""

from snovault import collection, load_schema
from pyramid.security import Allow, Deny, Everyone
from .base import (
    Item,
    # TODO: Maybe collect all these permission styles into a single file, give them symbolic names,
    #       and permit only the symbolic names to be used in each situation so we can curate a full inventory of modes.
    #       -kmp 26-Jul-2020
    ALLOW_SUBMITTER_ADD,
)
from .institution import (
    ONLY_ADMIN_VIEW,
)


ALLOW_SUBMITTER_VIEW = (
    # TODO: There is an issue here where we want a logged in user remotely only to view this
    #       but if we are proxying for them internall we want to be able to view OR edit.
    #       There is never reason for a user outside the system to update this status. -kmp 26-Jul-2020
    []  # Special additional permissions might go here.
    + ALLOW_SUBMITTER_ADD  # Is this right? See note above.
    + ONLY_ADMIN_VIEW      # Slightly misleading name. Allows admins to edit, too, actually. But only they can view.
)


@collection(
    name='ingestion-submissions',
    acl=ALLOW_SUBMITTER_VIEW,
    unique_key='object_name',
    properties={
        'title': 'Ingestion Submissions',
        'description': 'List of Ingestion Submissions',
    })
class IngestionSubmission(Item):
    """The IngestionSubmission class that holds info on requests to ingest data."""

    item_type = 'ingestion_submission'
    schema = load_schema('encoded:schemas/ingestion_submission.json')
    # embedded_list = [...] + Item.embedded_list
