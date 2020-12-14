import pytest
import requests  # XXX: C4-211
from .variant_fixtures import VARIANT_SAMPLE_URL


pytestmark = [pytest.mark.working, pytest.mark.schema]


@pytest.mark.integrated  # uses s3
def test_bam_snapshot_download(workbook, es_testapp, test_variant_sample):
    """ Tests that we can correctly download an IGV image from the wfoutput bucket. """
    res = es_testapp.post_json(VARIANT_SAMPLE_URL, test_variant_sample, status=201).json
    uuid = res['@graph'][0]['uuid']
    bam_snapshot_location = res['@graph'][0]['bam_snapshot']
    assert bam_snapshot_location == 'dummy-file-name/bamsnap/chr1:12125898.png'
    download = es_testapp.get('/' + uuid + '/@@download').location
    resp = requests.get(download)
    assert 'hello world' in resp.content.decode('utf-8')


@pytest.fixture
def variant_sample_list1():
    return {
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi',
        'created_for_case': 'GAPCAP4E4GMG'
    }


variant_uuid = "f6aef055-4c88-4a3e-a306-d37a71535d8b"


@pytest.fixture
def test_variant_sample2(test_variant_sample):
    test_variant_sample['file'] = 'other-file-name'
    return test_variant_sample


def test_variant_sample_list_post(workbook, es_testapp, variant_sample_list1):
    es_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201)


def test_variant_sample_list_patch_success(workbook, es_testapp, variant_sample_list1, test_variant_sample2):
    vsl = es_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    vs = es_testapp.post_json('/variant_sample', test_variant_sample2, status=201).json['@graph'][0]
    patch = {
        'variant_samples': [vs['@id']]
    }
    resp = es_testapp.patch_json(vsl['@id'], patch, status=200).json['@graph'][0]
    assert resp['variant_samples'][0] == vs['@id']


def test_variant_sample_list_patch_fail(workbook, es_testapp, variant_sample_list1):
    vsl = es_testapp.post_json('/variant_sample_list', variant_sample_list1, status=201).json['@graph'][0]
    patch = {
        'variant_samples': [variant_uuid]  # wrong item type
    }
    es_testapp.patch_json(vsl['@id'], patch, status=422)
