import boto3
import json
import traceback

from ..ingestion.common import get_parameter
from ..util import debuglog, s3_output_stream, create_empty_s3_file
from ..submit import submit_metadata_bundle
from .exceptions import UndefinedIngestionProcessorType
from ..types.ingestion import SubmissionFolio


INGESTION_UPLOADERS = {}


def ingestion_processor(processor_type):
    """
    @ingestion_uploader(<ingestion-type-name>) is a decorator that declares the upload handler for an ingestion type.
    """

    def ingestion_type_decorator(fn):
        INGESTION_UPLOADERS[processor_type] = fn
        return fn

    return ingestion_type_decorator


def get_ingestion_processor(processor_type):
    handler = INGESTION_UPLOADERS.get(processor_type, None)
    if not handler:
        raise UndefinedIngestionProcessorType(processor_type)
    return handler


def _show_report_lines(lines, fp, default="Nothing to report."):
    for line in lines or ([default] if default else []):
        print(line, file=fp)


@ingestion_processor('data_bundle')
def handle_data_bundle(submission: SubmissionFolio):

    # We originally called it 'data_bundle' and we retained that as OK in the schema
    # to not upset anyone testing with the old name, but this is not the name to use
    # any more, so reject new submissions of this kind. -kmp 27-Aug-2020

    with submission.processing_context(submission):

        raise RuntimeError("handle_data_bundle was called (for ingestion_type=%s). This is always an error."
                           " The ingestion_type 'data_bundle' was renamed to 'metadata_bundle'"
                           " prior to the initial release. Your submission program probably needs to be updated."
                           % submission.ingestion_type)


@ingestion_processor('metadata_bundle')
def handle_metadata_bundle(submission: SubmissionFolio):

    with submission.processing_context(submission) as resolution:

        s3_client = submission.s3_client
        submission_id = submission.submission_id

        institution = get_parameter(submission.parameters, 'institution')
        project = get_parameter(submission.parameters, 'project')
        validate_only = get_parameter(submission.parameters, 'validate_only', as_type=bool, default=False)

        # if isinstance(institution, str):
        #     institution = submission.vapp.get(institution).json
        # if isinstance(project, str):
        #     project = submission.vapp.get(project).json

        bundle_result = submit_metadata_bundle(s3_client=s3_client,
                                                    bucket=submission.bucket,
                                                    key=submission.object_name,
                                                    project=project,
                                                    institution=institution,
                                                    vapp=submission.vapp,
                                                    validate_only=validate_only)

        debuglog(submission_id, "bundle_result:", json.dumps(bundle_result, indent=2))

        resolution["validation_report_key"] = validation_report_key = "%s/validation-report.txt" % submission_id
        resolution["submission_key"] = submission_key = "%s/submission.json" % submission_id
        resolution["submission_response_key"] = submission_response_key = "%s/submission-response.txt" % submission_id
        resolution["upload_info_key"] = upload_info_key = "%s/upload_info.txt" % submission_id

        def note_additional_datum(key, bundle_key=None):
            submission.other_details['additional_data'] = additional_data = (
                submission.other_details.get('additional_data', {})
            )
            additional_data[key] = bundle_result[bundle_key or key]

        with s3_output_stream(s3_client, bucket=submission.bucket, key=validation_report_key) as fp:
            _show_report_lines(bundle_result['validation_output'], fp)
            note_additional_datum('validation_output')

        # Next several files are created only if relevant.

        if bundle_result['result']:
            with s3_output_stream(s3_client, bucket=submission.bucket, key=submission_key) as fp:
                print(json.dumps(bundle_result['result'], indent=2), file=fp)
                submission.other_details['result'] = bundle_result['result']

        if bundle_result['post_output']:
            with s3_output_stream(s3_client, bucket=submission.bucket, key=submission_response_key) as fp:
                _show_report_lines(bundle_result['post_output'], fp)
                note_additional_datum('post_output')

        if bundle_result['upload_info']:
            with s3_output_stream(s3_client, bucket=submission.bucket, key=upload_info_key) as fp:
                print(json.dumps(bundle_result['upload_info'], indent=2), file=fp)
                note_additional_datum('upload_info')

        submission.outcome = "success" if bundle_result['success'] else "failure"
