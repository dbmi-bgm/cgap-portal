"""
Collection for objects related to ingestion submissions.
"""

import boto3
import contextlib
import json
import logging
import re
import traceback

from dcicutils.misc_utils import ignored, check_true
from snovault import collection, load_schema
from pyramid.request import Request
from pyramid.security import Allow, Deny, Everyone
from .base import (
    Item,
    # TODO: Maybe collect all these permission styles into a single file, give them symbolic names,
    #       and permit only the symbolic names to be used in each situation so we can curate a full inventory of modes.
    #       -kmp 26-Jul-2020
    # Ticket C4-332
    ALLOW_PROJECT_MEMBER_ADD_ACL,
)
from .base import (
    ONLY_ADMIN_VIEW_ACL,
)
from ..util import (
    debuglog, subrequest_item_creation, beanstalk_env_from_registry, create_empty_s3_file, s3_output_stream
)
from ..ingestion.common import metadata_bundles_bucket, get_parameter

ALLOW_SUBMITTER_VIEW_ACL = (
    # TODO: There is an issue here where we want a logged in user remotely only to view this
    #       but if we are proxying for them internall we want to be able to view OR edit.
    #       There is never reason for a user outside the system to update this status. -kmp 26-Jul-2020
    []  # Special additional permissions might go here.
    + ALLOW_PROJECT_MEMBER_ADD_ACL  # Is this right? See note above.
    + ONLY_ADMIN_VIEW_ACL     # Slightly misleading name. Allows admins to edit, too, actually. But only they can view.
)


class SubmissionFolio:

    INGESTION_SUBMISSION_URI = '/IngestionSubmission'

    def __init__(self, *, vapp, ingestion_type, submission_id, log=None):
        self.vapp = vapp
        self.ingestion_type = ingestion_type
        self.log = log or logging
        self.bs_env = beanstalk_env_from_registry(vapp.app.registry)
        self.bucket = metadata_bundles_bucket(vapp.app.registry)
        self.s3_client = boto3.client('s3')
        self.other_details = {}
        self.outcome = 'unknown'
        self.submission_id = submission_id
        # These next two are initialized later by s3 lookup, and the result is cached here.
        # In particular, the values will be made available in time for the body of 'with folio.processing_context(...)'
        # Setting them to None here makes PyCharm and other code analysis tools happier in knowing
        # that accesses to these instance variables are legit. -kmp 27-Aug-2020
        self.object_name = None
        self.parameters = None

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

    @contextlib.contextmanager
    def processing_context(self, submission):

        submission.log.info("Processing {submission_id} as {ingestion_type}."
                            .format(submission_id=submission.submission_id, ingestion_type=submission.ingestion_type))

        submission_id = submission.submission_id
        manifest_key = "%s/manifest.json" % submission_id
        response = submission.s3_client.get_object(Bucket=submission.bucket, Key=manifest_key)
        manifest = json.load(response['Body'])

        self.object_name = object_name = manifest['object_name']
        self.parameters = parameters = manifest['parameters']

        debuglog(submission_id, "object_name:", object_name)
        debuglog(submission_id, "parameters:", parameters)

        started_key = "%s/started.txt" % submission_id
        create_empty_s3_file(submission.s3_client, bucket=submission.bucket, key=started_key)

        # PyCharm thinks this is unused. -kmp 26-Jul-2020
        # data_stream = submission.s3_client.get_object(Bucket=submission.bucket, Key="%s/manifest.json" % submission_id)['Body']

        resolution = {
            "data_key": object_name,
            "manifest_key": manifest_key,
            "started_key": started_key,
        }

        try:
            submission.patch_item(submission_id=submission_id,
                                  object_name=object_name,
                                  parameters=parameters,
                                  processing_status={"state": "processing"})

            yield resolution

            submission.patch_item(processing_status={"state": "done", "outcome": submission.outcome, "progress": "complete"},
                                  **submission.other_details)

        except Exception as e:

            resolution["traceback_key"] = traceback_key = "%s/traceback.txt" % submission_id
            with s3_output_stream(submission.s3_client, bucket=submission.bucket, key=traceback_key) as fp:
                traceback.print_exc(file=fp)

            resolution["error_type"] = e.__class__.__name__
            resolution["error_message"] = str(e)

            submission.patch_item(
                errors=["%s: %s" % (e.__class__.__name__, e)],
                processing_status={
                    "state": "done",
                    "outcome": "error",
                    "progress": "incomplete"
                }
            )

        with s3_output_stream(submission.s3_client,
                              bucket=submission.bucket,
                              key="%s/resolution.json" % submission_id) as fp:
            print(json.dumps(resolution, indent=2), file=fp)


@collection(
    name='ingestion-submissions',
    acl=ALLOW_SUBMITTER_VIEW_ACL,
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
