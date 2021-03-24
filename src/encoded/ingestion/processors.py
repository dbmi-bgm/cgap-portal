import io
import json

from dcicutils.misc_utils import ignored
from ..ingestion.common import get_parameter
from ..util import debuglog, s3_local_file
from ..submit import submit_metadata_bundle
from ..submit_genelist import submit_genelist
from ..submit_genelist import submit_variant_update
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


@ingestion_processor('data_bundle')
def handle_data_bundle(submission: SubmissionFolio):

    # We originally called it 'data_bundle' and we retained that as OK in the schema
    # to not upset anyone testing with the old name, but this is not the name to use
    # any more, so reject new submissions of this kind. -kmp 27-Aug-2020

    with submission.processing_context():

        raise RuntimeError("handle_data_bundle was called (for ingestion_type=%s). This is always an error."
                           " The ingestion_type 'data_bundle' was renamed to 'metadata_bundle'"
                           " prior to the initial release. Your submission program probably needs to be updated."
                           % submission.ingestion_type)


@ingestion_processor('genelist')
def handle_genelist(submission: SubmissionFolio):

    with submission.processing_context():
        s3_client = submission.s3_client
        submission_id = submission.submission_id
        institution = get_parameter(submission.parameters, 'institution')
        project = get_parameter(submission.parameters, 'project')
        validate_only = get_parameter(
                submission.parameters,
                'validate_only',
                as_type=bool,
                default=False
        )
        genelist_results = submit_genelist(
                s3_client=s3_client,
                bucket=submission.bucket,
                key=submission.object_name,
                project=project,
                institution=institution,
                vapp=submission.vapp,
                validate_only=validate_only
        )
        debuglog(
                submission_id,
                "genelist_result:",
                json.dumps(genelist_results, indent=2)
        )

        with submission.s3_output(key_name='validation_report') as fp:
            submission.show_report_lines(
                    genelist_results.get('validation_output', []),
                    fp
            )
            submission.note_additional_datum(
                    'validation_output',
                    from_dict=genelist_results
            )

        submission.process_standard_bundle_results(genelist_results)

        if not genelist_results.get('success'):
            submission.fail()


@ingestion_processor('variant_update')
def handle_variant_update(submission: SubmissionFolio):

    with submission.processing_context():
        s3_client = submission.s3_client
        submission_id = submission.submission_id
        institution = get_parameter(submission.parameters, 'institution')
        project = get_parameter(submission.parameters, 'project')
        validate_only = get_parameter(
                submission.parameters,
                'validate_only',
                as_type=bool,
                default=False
        )
        variant_update_results = submit_variant_update(
                s3_client=s3_client,
                bucket=submission.bucket,
                key=submission.object_name,
                project=project,
                institution=institution,
                vapp=submission.vapp,
                validate_only=validate_only
        )
        debuglog(
                submission_id,
                "update_result:",
                json.dumps(variant_update_results, indent=2)
        )

        with submission.s3_output(key_name='validation_report') as fp:
            submission.show_report_lines(
                    variant_update_results.get('validation_output', []),
                    fp
            )
            submission.note_additional_datum(
                    'validation_output',
                    from_dict=variant_update_results
            )

        submission.process_standard_bundle_results(variant_update_results)

        if not variant_update_results.get('success'):
            submission.fail()


@ingestion_processor('metadata_bundle')
def handle_metadata_bundle(submission: SubmissionFolio):

    with submission.processing_context():

        s3_client = submission.s3_client
        submission_id = submission.submission_id

        institution = get_parameter(submission.parameters, 'institution')
        project = get_parameter(submission.parameters, 'project')
        validate_only = get_parameter(submission.parameters, 'validate_only', as_type=bool, default=False)

        bundle_results = submit_metadata_bundle(s3_client=s3_client,
                                                bucket=submission.bucket,
                                                key=submission.object_name,
                                                project=project,
                                                institution=institution,
                                                vapp=submission.vapp,
                                                validate_only=validate_only)

        debuglog(submission_id, "bundle_result:", json.dumps(bundle_results, indent=2))

        with submission.s3_output(key_name='validation_report') as fp:
            submission.show_report_lines(bundle_results.get('validation_output', []), fp)
            submission.note_additional_datum('validation_output', from_dict=bundle_results)

        submission.process_standard_bundle_results(bundle_results)

        if not bundle_results.get('success'):
            submission.fail()


@ingestion_processor('simulated_bundle')
def handle_simulated_bundle(submission: SubmissionFolio):
    """
    This handler exists for test purposes and as an example of how to write an alternate processor.
    It wants a file that contains data like:
    {
      "success": true,
      "validation_output": ["Some validation stuff"],
      "post_output": ["Some post stuff", "More post stuff"],
      "upload_info": {},
      "result": {"answer": 42},
      "institution": "/institutions/hms-dbmi/",
      "project": "/projects/hms-dbmi/"
    }
    and does several things:
    * Checks that the submission was given a matching institution and project, or else it won't validate.
      Returns the given validation output PLUS information about the validation of those two fields.
    * If validation_only=true is given, then returns the validation result, as the result.
      That includes:
      * success" - either true or false to validation success or failure in the case of validation_only,
                   or always false (of course) in the case validation_only was false but the validation failed.
      * validation_output - a list of output lines explaining validation results. There might be such lines
        whether or not there was validation success.
    * If validation_only is missing or not true, then returns the indicated values for
      * success - either true or false to simulate overall success or failure
      * result - any overall result value
      * post_output - a list of text lines that represent output describing results of posts.
      * upload_info - information about any uploads that need to be done, in the format:
        [{'filename': ..., 'uuid': ...}, ...}
        where filename is the name of the filename that needs to be uploaded, and uuid is the uuid of the item
        for which it needs to be uploaded.
    """
    with submission.processing_context() as resolution:

        ignored(resolution)

        s3_client = submission.s3_client
        submission_id = submission.submission_id

        institution = get_parameter(submission.parameters, 'institution')
        project = get_parameter(submission.parameters, 'project')
        validate_only = get_parameter(submission.parameters, 'validate_only', as_type=bool, default=False)

        bundle_results = simulated_processor(s3_client=s3_client,
                                             bucket=submission.bucket,
                                             key=submission.object_name,
                                             project=project,
                                             institution=institution,
                                             vapp=submission.vapp,
                                             validate_only=validate_only)

        debuglog(submission_id, "bundle_result:", json.dumps(bundle_results, indent=2))

        with submission.s3_output(key_name='validation_report') as fp:
            submission.show_report_lines(bundle_results.get('validation_output', []), fp)
            submission.note_additional_datum('validation_output', from_dict=bundle_results, default=[])

        submission.process_standard_bundle_results(bundle_results)

        if not bundle_results.get('success'):
            submission.fail()


def simulated_processor(s3_client, bucket, key, project, institution, vapp,  # <- Required keyword arguments
                        validate_only=False):  # <-- Optional keyword arguments (with defaults)
    """
    This processor expects the data to contain JSON containing:

    {
      "project": <project>,           # The value to validate the give project against.
      "institution": <institution>,   # The value to validate the given project against.
      "success": <true/false>,        # True if full processing should return success
      "result": <processing-result>,  # Result to return if simulated processing happens
      "post_output": [...],           # Post output to expect if simulated processing happens
      "upload_info": [...]            # Upload info to return if simulated processing happens
    }

    Simulated validation will check that the given project is the same as the project in the file
    and the given institution is the same as the institution in the file.

    * If simulated validation fails, the simulated processing won't occur.
    * If validate_only is True, simulated processing won't occur,
      so the result, post_output, and upload_info will be null.
    """

    ignored(vapp)

    def simulated_validation(data, project, institution):
        # Simulated Validation
        validated = True
        validation_output = data.get("validation_output", [])
        for key, value in [("project", project), ("institution", institution)]:
            if data.get(key) == value:
                validation_output.append("The %s is OK" % key)
            else:

                validation_output.append("Expected %s %s." % (key, value))
                validated = False

        return validated, validation_output

    with s3_local_file(s3_client=s3_client, bucket=bucket, key=key) as filename:

        with io.open(filename) as fp:
            data = json.load(fp)

        result = {}

        validated, validation_output = simulated_validation(data, project, institution)

        result["validation_output"] = validation_output
        if validate_only or not validated:
            result["success"] = validated
            return result

        for key, default in [("success", False),
                             ("result", {}),
                             ("post_output", []),
                             ("upload_info", [])]:
            result[key] = data.get(key, default)

        return result
