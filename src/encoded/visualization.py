import uuid

from botocore.exceptions import ClientError
from copy import copy, deepcopy
from dcicutils.misc_utils import print_error_message
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from snovault import CONNECTION
from snovault.util import debug_log

from .types.base import Item, get_item_or_none
from .types.workflow import (
    trace_workflows,
    DEFAULT_TRACING_OPTIONS,
    WorkflowRunTracingException,
    item_model_to_object
)
from .util import make_s3_client


def includeme(config):
    config.add_route(
        'trace_workflow_runs',
        '/trace_workflow_run_steps/{file_uuid}/',
        traverse='/{file_uuid}'
    )
    config.add_route('get_higlass_viewconf', '/get_higlass_viewconf/')
    config.add_route('get_higlass_cohort_viewconf', '/get_higlass_cohort_viewconf/')
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

    viewconf_uuid = "00000000-1111-0000-1111-000000000000"

    if requesting_tab == "bam":
        viewconf_uuid = "9146eeba-ebb8-41aa-93a8-ada8efaff64b"
    elif requesting_tab == "sv":
        viewconf_uuid = "cc459f25-601c-4e00-8404-fc3bd1b3b6c2"

    default_higlass_viewconf = get_item_or_none(request, viewconf_uuid)
    higlass_viewconfig = default_higlass_viewconf["viewconfig"] if default_higlass_viewconf else None

    # If no view config could be found, fail
    if not higlass_viewconfig:
        return {
            "success": False,
            "errors": "No view config found.",
            "viewconfig": None
        }

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

    # THIS NEEDS TO BE REPLACED WHEN TESTING LOCALLY
    s3_bucket = request.registry.settings.get('file_wfout_bucket')
    #s3_bucket = "cgap-mgb-main-application-cgap-mgb-wfoutput"
    #s3_bucket = "cgap-dbmi-main-application-cgap-dbmi-wfoutput"

    if requesting_tab == "bam":

        # This is the id of the variant sample that we are currently looking at.
        # This should be the first file in the Higlass viewconf
        bam_sample_id = request.json_body.get('bam_sample_id', None)

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
            pileup_track_sample['data']['bamUrl'] = create_presigned_url(bucket_name=s3_bucket, object_name=bam_key)
            pileup_track_sample['data']['baiUrl'] = create_presigned_url(bucket_name=s3_bucket, object_name=bai_key)
            top_tracks.append(pileup_track_sample)

    elif requesting_tab == "sv":

        variant_start = request.json_body.get('variant_pos_abs', None)
        variant_end = request.json_body.get('variant_end_abs', None)
        variant_start = variant_start if variant_start else 100000
        variant_end = variant_end if variant_end else variant_start + 1

        window_size_small = round((variant_end - variant_start)/8.0) # window size for the interpretation space
        window_size_large = 6000  # window size for the overview

        # Overview
        higlass_viewconfig['views'][0]['initialXDomain'][0] = variant_start - window_size_large
        higlass_viewconfig['views'][0]['initialXDomain'][1] = variant_end + window_size_large

        # Details
        higlass_viewconfig['views'][1]['initialXDomain'][0] = variant_start - window_size_small
        higlass_viewconfig['views'][1]['initialXDomain'][1] = variant_end + window_size_small

        # Vertical rules
        higlass_viewconfig['views'][0]['tracks']['whole'][0]['x'] = variant_start
        higlass_viewconfig['views'][0]['tracks']['whole'][1]['x'] = variant_end
        higlass_viewconfig['views'][1]['tracks']['whole'][0]['x'] = variant_start
        higlass_viewconfig['views'][1]['tracks']['whole'][1]['x'] = variant_end
        # This is the id of the variant sample that we are currently looking at.
        # This should be the first file in the Higlass viewconf
        bam_sample_id = request.json_body.get('bam_sample_id', None)

        # The samples already come in sorted
        samples_pedigree = request.json_body.get('samples_pedigree', None)
        bam_visibilty = request.json_body.get('bam_visibilty', None)
        sv_vcf_visibilty = request.json_body.get('sv_vcf_visibilty', None)

        top_tracks = higlass_viewconfig['views'][1]['tracks']['top']
        empty_track_a = deepcopy(top_tracks[6]) # track height 10
        text_track = deepcopy(top_tracks[7])
        empty_track_b = deepcopy(top_tracks[8]) # track height 5
        pileup_track = deepcopy(top_tracks[9])
        cgap_sv_track = deepcopy(top_tracks[10])
        cgap_cnv_track = deepcopy(top_tracks[11])
        gnomad_track = deepcopy(top_tracks[12])

        current_viewconf = request.json_body.get('current_viewconf', None)
        original_options = {}
        if current_viewconf is not None:
            higlass_viewconfig = current_viewconf
            top_tracks = higlass_viewconfig['views'][1]['tracks']['top']
            # Store the original options
            for top_track in top_tracks:
                key = top_track['type']
                key = key + top_track['options']['dataSource'] if key == "sv" else key
                if key not in original_options:
                    original_options[key] = top_track['options']

        # Delete original tracks from the insert, replace them with adjusted data
        # from the sample data. If there is no data, we only show the sequence track
        del top_tracks[6:]

        describing_text_track = deepcopy(text_track)
        describing_text_track["options"]["fontSize"] = 11
        describing_text_track["options"]["fontWeight"] = "normal"
        describing_text_track["options"]["textColor"] = "#777777"
        describing_text_track["options"]["backgroundColor"] = "#ffffff"
        describing_text_track["options"]["offsetY"] = 12
        describing_text_track["height"] = 30

        higlass_sv_vcf = request.json_body.get('higlass_sv_vcf', None)
        higlass_sv_vcf_presigned = None
        higlass_sv_tbi_presigned = None
        if higlass_sv_vcf is not None:
            higlass_sv_vcf_presigned = create_presigned_url(bucket_name=s3_bucket, object_name=higlass_sv_vcf)
            higlass_sv_tbi_presigned = create_presigned_url(bucket_name=s3_bucket, object_name=higlass_sv_vcf+".tbi")

        higlass_cnv_vcf = request.json_body.get('higlass_cnv_vcf', None)
        higlass_cnv_vcf_presigned = None
        higlass_cnv_tbi_presigned = None
        if higlass_cnv_vcf is not None:
            higlass_cnv_vcf_presigned = create_presigned_url(bucket_name=s3_bucket, object_name=higlass_cnv_vcf)
            higlass_cnv_tbi_presigned = create_presigned_url(bucket_name=s3_bucket, object_name=higlass_cnv_vcf+".tbi")

        for sample in samples_pedigree:
            accession = sample["sample_accession"]

            # If the accession is not in the option list, something went wrong
            if accession not in bam_visibilty or accession not in sv_vcf_visibilty:
                continue

            if bam_visibilty[accession] or sv_vcf_visibilty[accession]:
                empty_track_sample = deepcopy(empty_track_a)
                empty_track_sample["uid"] = "empty_above_text" + accession
                top_tracks.append(empty_track_sample)

                text_track_sample = deepcopy(text_track)
                text_track_sample["uid"] = "text" + accession
                text_track_sample["options"]["text"] = "%s (%s)" % (sample["relationship"].capitalize(), sample["sample_name"])
                top_tracks.append(text_track_sample)

            if bam_visibilty[accession]:

                empty_track_sample = deepcopy(empty_track_b)
                empty_track_sample["uid"] = "empty_above_pileup" + accession
                top_tracks.append(empty_track_sample)

                pileup_track_sample = deepcopy(pileup_track)
                pileup_track_sample["uid"] = "pileup" + accession
                bam_key = sample["bam_location"]
                bai_key = bam_key + ".bai"

                pileup_track_sample['data']['bamUrl'] = create_presigned_url(bucket_name=s3_bucket, object_name=bam_key)
                pileup_track_sample['data']['baiUrl'] = create_presigned_url(bucket_name=s3_bucket, object_name=bai_key)
                if 'pileup' in original_options:
                    pileup_track_sample['options'] = deepcopy(original_options['pileup'])
                top_tracks.append(pileup_track_sample)

            if sv_vcf_visibilty[accession]:
                text_track_sample = deepcopy(describing_text_track)
                text_track_sample["uid"] = "sv_vcf_text" + accession
                text_track_sample["options"]["text"] = "Structural Variants called by Manta"
                top_tracks.append(text_track_sample)

                if higlass_sv_vcf_presigned is not None:
                    cgap_sv_track_sample = deepcopy(cgap_sv_track)
                    cgap_sv_track_sample['data']['vcfUrl'] = higlass_sv_vcf_presigned
                    cgap_sv_track_sample['data']['tbiUrl'] = higlass_sv_tbi_presigned

                    cgap_sv_track_sample["uid"] = "sv-vcf" + accession
                    if 'cgap-sv' in original_options:
                        cgap_sv_track_sample['options'] = deepcopy(original_options['cgap-sv'])
                        cgap_sv_track_sample['options']['dataSource'] = 'cgap-sv'

                    cgap_sv_track_sample['options']['sampleName'] = sample["sample_name"]
                    top_tracks.append(cgap_sv_track_sample)

                # We are showing the track only for the proband for now, since we are not doing
                # CNV joint calling yet.
                if (higlass_cnv_vcf_presigned is not None) and (bam_sample_id == sample["sample_name"]):
                    text_track_sample = deepcopy(describing_text_track)
                    text_track_sample["uid"] = "cnv_vcf_text" + accession
                    text_track_sample["options"]["text"] = "Copy Number Variants called by BIC-seq2"
                    top_tracks.append(text_track_sample)

                    cgap_cnv_track_sample = deepcopy(cgap_cnv_track)
                    cgap_cnv_track_sample['data']['vcfUrl'] = higlass_cnv_vcf_presigned
                    cgap_cnv_track_sample['data']['tbiUrl'] = higlass_cnv_tbi_presigned

                    cgap_cnv_track_sample["uid"] = "cnv-vcf" + accession
                    if 'cgap-cnv' in original_options:
                        cgap_cnv_track_sample['options'] = deepcopy(original_options['cgap-cnv'])
                        cgap_cnv_track_sample['options']['dataSource'] = 'cgap-cnv'
                    cgap_cnv_track_sample['options']['sampleName'] = sample["sample_name"]
                    top_tracks.append(cgap_cnv_track_sample)

        accession = "gnomad-sv"
        if accession in sv_vcf_visibilty and sv_vcf_visibilty[accession]:
            empty_track_sample = deepcopy(empty_track_a)
            empty_track_sample["uid"] = "empty_above_text" + accession
            top_tracks.append(empty_track_sample)

            text_track_sample = deepcopy(text_track)
            text_track_sample["uid"] = "text" + accession
            text_track_sample["options"]["text"] = "gnomAD-SV"
            top_tracks.append(text_track_sample)

            empty_track_sample = deepcopy(empty_track_b)
            empty_track_sample["uid"] = "empty_above_gnomad" + accession
            top_tracks.append(empty_track_sample)

            if 'svgnomad' in original_options:
                gnomad_track['options'] = deepcopy(original_options['svgnomad'])
                gnomad_track['options']['dataSource'] = 'gnomad'
            top_tracks.append(gnomad_track)

    return {
        "success": True,
        "errors": "",
        "viewconfig": higlass_viewconfig
    }


@view_config(route_name='get_higlass_cohort_viewconf', request_method='POST')
@debug_log
def get_higlass_cohort_viewconf(context, request):
    """ Get the Higlass cohort viewconf, given the file locations on S3
    Args:
        request(obj): Http request object. Assumes request's request is JSON and contains these keys:
            cohort_variant_test_results(str) : location of the variant VCF file on S3
            cohort_gene_test_results(str) : location of the gene VCF file on S3
            cohort_density(str) : location of the density bigwig file on S3
            variant_detail_source(str): location of the affected samples VCF

    Returns:
        A dictionary.
            success(bool)       : Boolean indicating success.
            errors(str)         : A string containing errors. Will be None if this is successful.
            viewconfig(dict)    : Dict representing the new viewconfig.
    """

    viewconf_uuid = "b87c03bb-6c14-496c-9826-896257ae783f"
    default_higlass_viewconf = get_item_or_none(request, viewconf_uuid)
    higlass_viewconfig = default_higlass_viewconf["viewconfig"] if default_higlass_viewconf else None

    # If no view config could be found, fail
    if not higlass_viewconfig:
        return {
            "success": False,
            "errors": "No view config found.",
            "viewconfig": None
        }

    cohort_variant_test_results = request.json_body.get('cohort_variant_test_results', None)
    cohort_gene_test_results = request.json_body.get('cohort_gene_test_results', None)
    cohort_density = request.json_body.get('cohort_density', None)
    variant_detail_source = request.json_body.get('variant_detail_source', None)

    if not cohort_variant_test_results or not cohort_density or not cohort_gene_test_results:
        return {
            "success": False,
            "errors": "Some data files have not been specified.",
            "viewconfig": None
        }

    views = higlass_viewconfig['views']
    for view in views:
        top_tracks = view['tracks']['top']
        for track in top_tracks:
            if track['uid'] == "cohort_track":
                track['data']['vcfUrl'] = cohort_variant_test_results
                track['data']['tbiUrl'] = cohort_variant_test_results + ".tbi"
                if variant_detail_source:
                    track['options']['variantDetailSource']['vcfUrl'] = variant_detail_source
                    track['options']['variantDetailSource']['tbiUrl'] = variant_detail_source + ".tbi"
            elif track['uid'] == "gene_list_track":
                track['data']['vcfUrl'] = cohort_gene_test_results
                track['data']['tbiUrl'] = cohort_gene_test_results + ".tbi"
            elif track['uid'] == "density_track":
                track['data']['url'] = cohort_density

    return {
        "success": True,
        "errors": "",
        "viewconfig": higlass_viewconfig
    }


def create_presigned_url(bucket_name, object_name, expiration=3600):
    """Generate a presigned URL to share an S3 object

    :param bucket_name: string
    :param object_name: string
    :param expiration: Time in seconds for the presigned URL to remain valid
    :return: Presigned URL as string. If error, returns None.
    """
    s3_client = make_s3_client()
    try:
        params = {'Bucket': bucket_name, 'Key': object_name}
        response = s3_client.generate_presigned_url('get_object', Params=params, ExpiresIn=expiration)
    except ClientError as e:
        print_error_message(e)
        return None

    # The response contains the presigned URL
    return response
