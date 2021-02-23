import pytest
import requests  # XXX: C4-211
import random
from .variant_fixtures import VARIANT_SAMPLE_URL


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
def test_bam_snapshot_download(workbook, es_testapp, test_variant_sample):
    """ Tests that we can correctly download an IGV image from the wfoutput bucket. """
    test_variant_sample['file'] += str(random.choice(range(0,100)))
    res = es_testapp.post_json(VARIANT_SAMPLE_URL, test_variant_sample, status=[201, 409]).json
    uuid = res['@graph'][0]['uuid']
    bam_snapshot_location = res['@graph'][0]['bam_snapshot']
    assert bam_snapshot_location == test_variant_sample['file'] + '/bamsnap/chr1_12125898.png'
    download = es_testapp.get('/' + uuid + '/@@download').location
    print(download)
    resp = requests.get(download)
    assert 'hello world' in resp.content.decode('utf-8')
