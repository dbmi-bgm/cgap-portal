"""
Collection for objects related to ingestion submissions.
"""

import json
import logging
import re
import uuid

from dcicutils.misc_utils import ignored, check_true
from snovault import collection, load_schema
from pyramid.request import Request
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
from ..util import debuglog, subrequest_item_creation


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
        self.submission_id = submission_id

    def __str__(self):
        return "<SubmissionFolio(%s) %s>" % (self.ingestion_type, self.submission_id)

    @classmethod
    def make_submission_uri(cls, submission_id):
        return "/ingestion-submissions/" + submission_id

    @property
    def submission_uri(self):
        return self.make_submission_uri(self.submission_id)

    SUBMISSION_PATTERN = re.compile(r'^/ingestion-submissions/([0-9a-fA-F-]+)/?$')

    @classmethod
    def create_item(cls, request, institution, project, ingestion_type):
        json_body = {
            "ingestion_type": ingestion_type,
            "institution": institution,
            "project": project,
            "processing_status": {
                "state": "submitted"
            }
        }
        guid = None
        item_url, res_json = None, None
        try:
            res_json = subrequest_item_creation(request=request, item_type='IngestionSubmission', json_body=json_body)
            [item_url] = res_json['@graph']
            matched = cls.SUBMISSION_PATTERN.match(item_url)
            if matched:
                guid = matched.group(1)
        except Exception as e:
            logging.error("%s: %s" % (e.__class__.__name__, e))
            pass
        check_true(guid, "Guid was not extracted from %s in %s" % (item_url, json.dumps(res_json)))
        return guid

    def patch_item(self, **kwargs):
        res = self.vapp.patch_json(self.submission_uri, kwargs)
        [item] = res.json['@graph']
        debuglog(json.dumps(item))


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
