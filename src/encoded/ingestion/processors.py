import boto3
import json
import traceback

from encoded.ingestion.common import DATA_BUNDLE_BUCKET, get_parameter
from encoded.util import debuglog, s3_output_stream, create_empty_s3_file
from encoded.submit import submit_data_bundle
from .exceptions import UndefinedIngestionProcessorType


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
def handle_data_bundle(submission):

    submission.log.info("Processing {submission_id} as {ingestion_type}."
                        .format(submission_id=submission.submission_id, ingestion_type=submission.ingestion_type))

    if submission.ingestion_type != 'data_bundle':
        raise RuntimeError("handle_data_bundle only works for ingestion_type data_bundle.")

    submission_id = submission.submission_id
    s3_client = boto3.client('s3')
    manifest_key = "%s/manifest.json" % submission_id
    response = s3_client.get_object(Bucket=DATA_BUNDLE_BUCKET, Key=manifest_key)
    manifest = json.load(response['Body'])

    object_name = manifest['object_name']
    parameters = manifest['parameters']
    institution = get_parameter(parameters, 'institution')
    project = get_parameter(parameters, 'project')
    validate_only = get_parameter(parameters, 'validate_only', as_type=bool, default=False)

    debuglog(submission_id, "object_name:", object_name)
    debuglog(submission_id, "parameters:", parameters)

    started_key = "%s/started.txt" % submission_id
    create_empty_s3_file(s3_client, bucket=DATA_BUNDLE_BUCKET, key=started_key)

    # PyCharm thinks this is unused. -kmp 26-Jul-2020
    # data_stream = s3_client.get_object(Bucket=DATA_BUNDLE_BUCKET, Key="%s/manifest.json" % submission_id)['Body']

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

        # if isinstance(institution, str):
        #     institution = submission.vapp.get(institution).json
        # if isinstance(project, str):
        #     project = submission.vapp.get(project).json

        data_bundle_result = submit_data_bundle(s3_client=s3_client,
                                                bucket=DATA_BUNDLE_BUCKET,
                                                key=object_name,
                                                project=project,
                                                institution=institution,
                                                vapp=submission.vapp,
                                                validate_only=validate_only)

        debuglog(submission_id, "data_bundle_result:", json.dumps(data_bundle_result, indent=2))

        resolution["validation_report_key"] = validation_report_key = "%s/validation-report.txt" % submission_id
        resolution["submission_key"] = submission_key = "%s/submission.json" % submission_id
        resolution["submission_response_key"] = submission_response_key = "%s/submission-response.txt" % submission_id
        resolution["upload_info_key"] = upload_info_key = "%s/upload_info.txt" % submission_id

        other_details = {}

        def note_additional_datum(key, bundle_key=None):
            other_details['additional_data'] = additional_data = other_details.get('additional_data', {})
            additional_data[key] = data_bundle_result[bundle_key or key]

        with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=validation_report_key) as fp:
            _show_report_lines(data_bundle_result['validation_output'], fp)
            note_additional_datum('validation_output')

        # Next several files are created only if relevant.

        if data_bundle_result['result']:
            with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=submission_key) as fp:
                print(json.dumps(data_bundle_result['result'], indent=2), file=fp)
                other_details['result'] = data_bundle_result['result']

        if data_bundle_result['post_output']:
            with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=submission_response_key) as fp:
                _show_report_lines(data_bundle_result['post_output'], fp)
                note_additional_datum('post_output')

        if data_bundle_result['upload_info']:
            with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=upload_info_key) as fp:
                print(json.dumps(data_bundle_result['upload_info'], indent=2), file=fp)
                note_additional_datum('upload_info')

        outcome = "success" if data_bundle_result['success'] else "failure"

        submission.patch_item(processing_status={"state": "done", "outcome": outcome, "progress": "complete"},
                              **other_details)

    except Exception as e:

        resolution["traceback_key"] = traceback_key = "%s/traceback.txt" % submission_id
        with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=traceback_key) as fp:
            traceback.print_exc(file=fp)

        resolution["error_type"] = e.__class__.__name__
        resolution["error_message"] = str(e)

        submission.patch_item(processing_status={"state": "done", "outcome": "error", "progress": "incomplete"})

    with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key="%s/resolution.json" % submission_id) as fp:
        print(json.dumps(resolution, indent=2), file=fp)
