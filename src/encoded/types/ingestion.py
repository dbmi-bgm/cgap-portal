"""
Collection for objects related to ingestion submissions.
"""

import json
import logging

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


class SubmissionFolio:

    INGESTION_SUBMISSION_URI = '/IngestionSubmission'

    def __init__(self, *, vapp, ingestion_type, submission_id, log=None):
        self.vapp = vapp
        self.ingestion_type = ingestion_type
        self.log = log or logging
        self.folio_id = None  # This will be more properly initialized in _create_item()
        self.submission_id = submission_id
        self._create_item()

    @property
    def folio_uri(self):
        if not self.folio_id:
            raise RuntimeError("%s.folio_id has not been set." % self)
        return "/" + self.folio_id

    def _create_item(self):
        res = self.vapp.post_json(self.INGESTION_SUBMISSION_URI, {
            "ingestion_type": self.ingestion_type,
            "submission_id": self.submission_id,
            "processing_status": {
                "state": "submitted"
            }
        })
        [item] = res.json['@graph']
        print(json.dumps(item, indent=2))
        self.folio_id = item['uuid']

    def set_item_detail(self, object_name, parameters, institution, project):
        res = self.vapp.patch_json(self.folio_uri, {
            "object_name": object_name,
            "ingestion_type": self.ingestion_type,
            "submission_id": self.submission_id,
            "parameters": parameters,
            "institution": institution,
            "project": project,
            "processing_status": {
                "state": "processing",
            }
        })
        [item] = res.json['@graph']
        print(json.dumps(item, indent=2))


    def patch_item(self, **kwargs):
        res = self.vapp.patch_json(self.folio_uri, kwargs)
        [item] = res.json['@graph']
        print(json.dumps(item, indent=2))


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
