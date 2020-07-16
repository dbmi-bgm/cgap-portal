import pytest
import requests  # XXX: C4-211
from .test_ingest_vcf import VARIANT_SAMPLE_URL
from .workbook_fixtures import app, workbook


pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.fixture  # NOTE: variant_sample is unused in workbook so this is ok, later on there should be default inserts
def test_variant_sample():
    return {
        'variant': 'f6aef055-4c88-4a3e-a306-d37a71535d8b',
        'AD': '1,3',
        'CALL_INFO': 'my_test_sample',
        'file': 'dummy-file-name',
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


@pytest.mark.integrated  # uses s3
def test_bam_snapshot_download(workbook, testapp, test_variant_sample):
    """ Tests that we can correctly download an IGV image from the wfoutput bucket. """
    res = testapp.post_json(VARIANT_SAMPLE_URL, test_variant_sample, status=201).json
    uuid = res['@graph'][0]['uuid']
    bam_snapshot_location = res['@graph'][0]['bam_snapshot']
    assert bam_snapshot_location == 'dummy-file-name/bamsnap/chr1:12125898.png'
    download = testapp.get('/' + uuid + '/@@download').location
    resp = requests.get(download)
    assert 'hello world' in resp.content.decode('utf-8')
