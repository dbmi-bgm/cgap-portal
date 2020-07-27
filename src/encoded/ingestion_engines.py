import boto3
import json
import traceback

from .common import DATA_BUNDLE_BUCKET, get_parameter
from .util import debuglog, s3_output_stream, create_empty_s3_file
from .submit import submit_data_bundle


INGESTION_UPLOADERS = {}


def ingestion_processor(processor_type):
    """
    @ingestion_uploader(<ingestion-type-name>) is a decorator that declares the upload handler for an ingestion type.
    """

    def ingestion_type_decorator(fn):
        INGESTION_UPLOADERS[processor_type] = fn
        return fn

    return ingestion_type_decorator


class UndefinedIngestionProcessorType(Exception):

    def __init__(self, processor_type):
        self.ingestion_type_name = processor_type
        super().__init__("No ingestion processor type %r is defined." % processor_type)


def get_ingestion_processor(processor_type):
    handler = INGESTION_UPLOADERS.get(processor_type, None)
    if not handler:
        raise UndefinedIngestionProcessorType(processor_type)
    return handler


def _show_report_lines(lines, fp, default="Nothing to report."):
    for line in lines or ([default] if default else []):
        print(line, file=fp)


@ingestion_processor('data_bundle')
def handle_data_bundle(*, uuid, ingestion_type, vapp, log):

    log.info("Processing {uuid} as {ingestion_type}.".format(uuid=uuid, ingestion_type=ingestion_type))

    if ingestion_type != 'data_bundle':
        raise RuntimeError("handle_data_bundle only works for ingestion_type data_bundle.")

    s3_client = boto3.client('s3')
    manifest_key = "%s/manifest.json" % uuid
    response = s3_client.get_object(Bucket=DATA_BUNDLE_BUCKET, Key=manifest_key)
    manifest = json.load(response['Body'])

    data_key = manifest['object_name']
    parameters = manifest['parameters']
    institution = get_parameter(parameters, 'institution')
    project = get_parameter(parameters, 'project')

    debuglog(uuid, "data_key:", data_key)
    debuglog(uuid, "parameters:", parameters)

    started_key = "%s/started.txt" % uuid
    create_empty_s3_file(s3_client, bucket=DATA_BUNDLE_BUCKET, key=started_key)

    # PyCharm thinks this is unused. -kmp 26-Jul-2020
    # data_stream = s3_client.get_object(Bucket=DATA_BUNDLE_BUCKET, Key="%s/manifest.json" % uuid)['Body']

    resolution = {
        "data_key": data_key,
        "manifest_key": manifest_key,
        "started_key": started_key,
    }

    try:

        if isinstance(institution, str):
            institution = vapp.get(institution).json
        if isinstance(project, str):
            project = vapp.get(project).json

        vapp.patch_json("/ingestion-submission", {
            "object_name": manifest['object_name'],
            "ingestion_type": ingestion_type,
            "submission_id": uuid,
            "parameters": manifest['parameters'],
            "institution": institution,
            "project": project,
            "processing_status": {
                "state": "processing",
            }
        })

        validation_log_lines, final_json, result_lines = submit_data_bundle(s3_client=s3_client,
                                                                            bucket=DATA_BUNDLE_BUCKET,
                                                                            key=data_key,
                                                                            project=project,
                                                                            institution=institution,
                                                                            vapp=vapp)

        resolution["validation_report_key"] = validation_report_key = "%s/validation-report.txt" % uuid
        resolution["submission_key"] = submission_key = "%s/submission.json" % uuid
        resolution["submission_response_key"] = submission_response_key = "%s/submission-response.txt" % uuid

        with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=validation_report_key) as fp:
            _show_report_lines(validation_log_lines, fp)

        with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=submission_key) as fp:
            print(json.dumps(final_json, indent=2), file=fp)

        with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=submission_response_key) as fp:
            _show_report_lines(result_lines, fp)

        vapp.patch_json("ingestion-submission", {
            "submission_id": uuid,
            "progress": {
                "state": "done",
                "outcome": "failure" if validation_log_lines else "success",
                "progress": "complete",
            },
        })

    except Exception as e:

        resolution["traceback_key"] = traceback_key = "%s/traceback.json" % uuid
        with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key=traceback_key) as fp:
            traceback.print_exc(file=fp)

        resolution["error_type"] = e.__class__.__name__
        resolution["error_message"] = str(e)

        vapp.patch_json("ingestion-submission", {
            "submission_id": uuid,
            "progress": {
                "state": "done",
                "outcome": "error",
                "progress": "incomplete",
            },
        })

    with s3_output_stream(s3_client, bucket=DATA_BUNDLE_BUCKET, key="%s/resolution.json" % uuid) as fp:
        print(json.dumps(resolution, indent=2), file=fp)
