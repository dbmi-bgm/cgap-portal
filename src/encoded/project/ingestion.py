from snovault.project.ingestion import SnovaultProjectIngestion
import structlog
from pyramid.httpexceptions import HTTPNotFound, HTTPMovedPermanently
from snovault.ingestion.ingestion_listener_base import STATUS_INGESTED, STATUS_QUEUED


log = structlog.getLogger(__name__)


class CgapProjectIngestion(SnovaultProjectIngestion):
    def note_ingestion_enqueue_uuids_for_request(self, ingestion_type, request, uuid):
        if ingestion_type == 'vcf':
            patch_vcf_file_status(request, uuids)  # extra state management - may not be accurate, hard to get right


def patch_vcf_file_status(request, uuids):
    """ Patches VCF File status to 'Queued'
        NOTE: This process makes queue_ingestion not scale terribly well.
              Batching above a certain number may result in 504. There are
              also permissions concerns here that are not dealt with.
    """
    for uuid in uuids:
        kwargs = {
            'environ': request.environ,
            'method': 'PATCH',
            'content_type': 'application/json',
            'POST': json.dumps({
                'file_ingestion_status': STATUS_QUEUED
            }).encode('utf-8')
        }
        subreq = Request.blank('/' + uuid, **kwargs)
        resp = None
        try:
            if verify_vcf_file_status_is_not_ingested(request, uuid):
                resp = request.invoke_subrequest(subreq)
        except HTTPNotFound:
            log.error('Tried to patch %s but item does not exist: %s' % (uuid, resp))


def verify_vcf_file_status_is_not_ingested(request, uuid, *, expected=True):
    """ Verifies the given VCF file has not already been ingested by checking
        'file_ingestion_status'
    """
    kwargs = {
        'environ': request.environ,
        'method': 'GET',
        'content_type': 'application/json'
    }
    subreq = Request.blank('/' + uuid, **kwargs)
    resp = request.invoke_subrequest(subreq)
    if isinstance(resp, HTTPMovedPermanently):  # if we hit a redirect, follow it
        subreq = Request.blank(resp.location, **kwargs)
        resp = request.invoke_subrequest(subreq)
    log.info('VCF File Meta: %s' % resp.json)
    verified = bool(expected) is (resp.json.get('file_ingestion_status', None) != STATUS_INGESTED)
    # if not verified:
    #     import pdb; pdb.set_trace()
    return verified
