from copy import (
    copy,
    deepcopy
)
from pyramid.view import view_config
from pyramid.httpexceptions import HTTPBadRequest
from snovault import CONNECTION
from snovault.util import debug_log
from .types.base import Item
from .types.workflow import (
    trace_workflows,
    DEFAULT_TRACING_OPTIONS,
    WorkflowRunTracingException,
    item_model_to_object
)
from dcicutils.env_utils import CGAP_ENV_WEBPROD, CGAP_ENV_MASTERTEST, CGAP_ENV_DEV, CGAP_PUBLIC_URL_PRD
import boto3
from botocore.exceptions import ClientError
import json
import uuid

from .types.base import get_item_or_none

def includeme(config):
    config.add_route(
        'trace_workflow_runs',
        '/trace_workflow_run_steps/{file_uuid}/',
        traverse='/{file_uuid}'
    )
    config.add_route('get_higlass_viewconf', '/get_higlass_viewconf/')
    config.scan(__name__)


# TODO: figure out how to make one of those cool /file/ACCESSION/@@download/-like URLs for this.
@view_config(route_name='trace_workflow_runs', request_method='GET', permission='view', context=Item)
@debug_log
def trace_workflow_runs(context, request):
    '''
    Traces workflow runs from context (an Item instance), which may be one of the following @types:
    `ExperimentSet`, `File`, or `Experiment`.
    Gets @@object representation of files from which to trace, then passes them to `trace_workflow_runs`.
    @@object representation is needed currently because trace_workflow_runs grabs `output_of_workflow_runs` from
    the files and requires them in UUID form. THIS SHOULD BE IMPROVED UPON AT EARLIEST CONVENIENCE.
    Requires that all files and workflow runs which are part of trace be indexed in ElasticSearch, else a
    WorkflowRunTracingException will be thrown.
    URI Paramaters:
        all_runs            If true, will not group similar workflow_runs
        track_performance   If true, will record time it takes for execution
    Returns:
        List of steps (JSON objects) with inputs and outputs representing IO nodes / files.
    '''

    # Default opts += overrides
    options = copy(DEFAULT_TRACING_OPTIONS)
    if request.params.get('all_runs'):
        options['group_similar_workflow_runs'] = False
    if request.params.get('track_performance'):
        options['track_performance'] = True

    item_types = context.jsonld_type()
    item_model_obj = item_model_to_object(context.model, request)

    files_objs_to_trace = []

    if 'File' in item_types:
        files_objs_to_trace.append(item_model_obj)

    elif 'Sample' in item_types:
        for file_uuid in item_model_obj.get('processed_files', []):
            file_model = request.registry[CONNECTION].storage.get_by_uuid(file_uuid)
            file_obj = item_model_to_object(file_model, request)
            files_objs_to_trace.append(file_obj)
        files_objs_to_trace.reverse()

    #elif 'ExperimentSet' in item_types:
    #    file_uuids_to_trace_from_experiment_set = item_model_obj.get('processed_files', [])
    #    file_uuids_to_trace_from_experiments    = []
    #    for exp_uuid in item_model_obj.get('experiments_in_set', []):
    #        experiment_model    = request.registry[CONNECTION].storage.get_by_uuid(exp_uuid)
    #        experiment_obj      = item_model_to_object(experiment_model, request)
    #        file_uuids_to_trace_from_experiments.extend(experiment_obj.get('processed_files', []))
    #
    #    for file_uuid in file_uuids_to_trace_from_experiments + file_uuids_to_trace_from_experiment_set:
    #        file_model = request.registry[CONNECTION].storage.get_by_uuid(file_uuid)
    #        file_obj = item_model_to_object(file_model, request)
    #        files_objs_to_trace.append(file_obj)
    #    files_objs_to_trace.reverse()

    else:
        raise HTTPBadRequest(detail="This type of Item is not traceable: " + ', '.join(item_types))

    try:
        return trace_workflows(files_objs_to_trace, request, options)
    except WorkflowRunTracingException as e:
        raise HTTPBadRequest(detail=e.args[0])



@view_config(route_name='get_higlass_viewconf', request_method='POST')
@debug_log
def get_higlass_viewconf(context, request):
    """ Add multiple files to the given Higlass view config.
    Args:
        request(obj): Http request object. Assumes request's request is JSON and contains these keys:
            requesting_tab(str) : "annotation" or "bam"
            variant_pos_abs(int) : Center of the viewconf in abs genome coordinates

    Returns:
        A dictionary.
            success(bool)       : Boolean indicating success.
            errors(str)         : A string containing errors. Will be None if this is successful.
            viewconfig(dict)    : Dict representing the new viewconfig.
    """

    requesting_tab = request.json_body.get('requesting_tab', None)
    requesting_tab = requesting_tab if requesting_tab else "annotation"

    viewconf_uuid = "00000000-1111-0000-1111-000000000000" if requesting_tab == "annotation" else "9146eeba-ebb8-41aa-93a8-ada8efaff64b"

    default_higlass_viewconf = get_item_or_none(request, viewconf_uuid)
    higlass_viewconfig = default_higlass_viewconf["viewconfig"] if default_higlass_viewconf else None

    # If no view config could be found, fail
    if not higlass_viewconfig:
        return {
            "success" : False,
            "errors": "No view config found.",
            "viewconfig": None
        }

    # We need absolute URLs for the BAM and GnomAD Worker
    # XXX: this needs a workaround - Will 6/8/21
    host_url = "http://c4ecstrialalphacgapmastertest-273357903.us-east-1.elb.amazonaws.com"
    if request.registry.settings.get('env.name') == CGAP_ENV_WEBPROD:
        host_url = CGAP_PUBLIC_URL_PRD
    elif request.registry.settings.get('env.name') == CGAP_ENV_MASTERTEST:
        host_url = f"http://{CGAP_ENV_MASTERTEST}.9wzadzju3p.us-east-1.elasticbeanstalk.com"
    elif request.registry.settings.get('env.name') == CGAP_ENV_DEV:
        host_url = f"http://{CGAP_ENV_DEV}.9wzadzju3p.us-east-1.elasticbeanstalk.com"

    if requesting_tab == "annotation":
        variant_pos = request.json_body.get('variant_pos_abs', None)
        variant_pos = variant_pos if variant_pos else 100000
        window_size_small = 20 # window size for the interpretation space
        window_size_large = 5000 # window size for the overview

        # Overview
        higlass_viewconfig['views'][0]['initialXDomain'][0] = variant_pos - window_size_large
        higlass_viewconfig['views'][0]['initialXDomain'][1] = variant_pos + window_size_large

        # Details
        higlass_viewconfig['views'][1]['initialXDomain'][0] = variant_pos - window_size_small
        higlass_viewconfig['views'][1]['initialXDomain'][1] = variant_pos + window_size_small

        # Vertical rules
        higlass_viewconfig['views'][1]['tracks']['whole'][0]['x'] = variant_pos
        higlass_viewconfig['views'][1]['tracks']['whole'][1]['x'] = variant_pos + 1

        wsl = higlass_viewconfig['views'][1]['tracks']['top'][17]['options']['workerScriptLocation']
        higlass_viewconfig['views'][1]['tracks']['top'][17]['options']['workerScriptLocation'] = host_url + wsl

    elif requesting_tab == "bam":
        variant_pos = request.json_body.get('variant_pos_abs', None)
        variant_pos = variant_pos if variant_pos else 100000
        # This is the id of the variant sample that we are currently looking at.
        # This should be the first file in the Higlass viewconf
        bam_sample_id = request.json_body.get('bam_sample_id', None)
        window_size_small = 20 # window size for the interpretation space
        window_size_large = 5000 # window size for the overview

        #s3_bucket = request.registry.settings.get('file_wfout_bucket')
        s3_bucket = "elasticbeanstalk-fourfront-cgap-wfoutput"

        samples_pedigree = request.json_body.get('samples_pedigree', None)
        samples_pedigree.sort(key=lambda x: x['sample_name'] == bam_sample_id, reverse=True)

        top_tracks = higlass_viewconfig['views'][1]['tracks']['top']
        empty_track_a = deepcopy(top_tracks[6])
        text_track = deepcopy(top_tracks[7])
        empty_track_b = deepcopy(top_tracks[8])
        pileup_track = deepcopy(top_tracks[9])

        # Delete original tracks from the insert, replace them with adjusted data
        # from the sample data. If there is no data, we only show the sequence track
        del top_tracks[6:10]
        # print(json.dumps(top_tracks, indent=2))

        for sample in samples_pedigree:
            empty_track_sample = deepcopy(empty_track_a)
            empty_track_sample["uid"] = uuid.uuid4()
            top_tracks.append(empty_track_sample)

            text_track_sample = deepcopy(text_track)
            text_track_sample["uid"] = uuid.uuid4()
            text_track_sample["options"]["text"] = "%s (%s)" % (sample["relationship"].capitalize(),sample["sample_name"])
            top_tracks.append(text_track_sample)

            empty_track_sample = deepcopy(empty_track_b)
            empty_track_sample["uid"] = uuid.uuid4()
            top_tracks.append(empty_track_sample)

            pileup_track_sample = deepcopy(pileup_track)
            pileup_track_sample["uid"] = uuid.uuid4()
            bam_key = sample["bam_location"]
            bai_key = bam_key + ".bai"
            pileup_track_sample['options']['workerScriptLocation'] = host_url + pileup_track_sample['options']['workerScriptLocation']
            pileup_track_sample['data']['bamUrl'] = create_presigned_url(bucket_name=s3_bucket, object_name=bam_key)
            pileup_track_sample['data']['baiUrl'] = create_presigned_url(bucket_name=s3_bucket, object_name=bai_key)
            top_tracks.append(pileup_track_sample)

        # Show the correct location
        higlass_viewconfig['views'][0]['initialXDomain'][0] = variant_pos - window_size_large
        higlass_viewconfig['views'][0]['initialXDomain'][1] = variant_pos + window_size_large

        higlass_viewconfig['views'][1]['initialXDomain'][0] = variant_pos - window_size_small
        higlass_viewconfig['views'][1]['initialXDomain'][1] = variant_pos + window_size_small

        # Vertical rules
        higlass_viewconfig['views'][1]['tracks']['whole'][0]['x'] = variant_pos
        higlass_viewconfig['views'][1]['tracks']['whole'][1]['x'] = variant_pos + 1

    return {
        "success" : True,
        "errors": "",
        "viewconfig" : higlass_viewconfig
    }

def create_presigned_url(bucket_name, object_name, expiration=3600):
    """Generate a presigned URL to share an S3 object

    :param bucket_name: string
    :param object_name: string
    :param expiration: Time in seconds for the presigned URL to remain valid
    :return: Presigned URL as string. If error, returns None.
    """

    # Generate a presigned URL for the S3 object
    s3_client = boto3.client('s3')
    try:
        params = {'Bucket': bucket_name, 'Key': object_name}
        response = s3_client.generate_presigned_url('get_object', Params=params, ExpiresIn=expiration)
    except ClientError as e:
        print(e)
        return None

    # The response contains the presigned URL
    return response

