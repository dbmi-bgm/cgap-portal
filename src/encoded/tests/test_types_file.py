import boto3
import os
import pytest
import tempfile

from pyramid.httpexceptions import HTTPForbidden
from .. import source_beanstalk_env_vars
from ..types.file import FileFastq, post_upload, external_creds


pytestmark = [pytest.mark.setone, pytest.mark.working]


# XXX: There are a lot of testing holes here. New datafixtures need to be implemented
# so that the stuff tested in Fourfront can also be tested in CGAP


@pytest.fixture
def file(testapp, project, experiment, institution, file_formats):

    item = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('fastq').get('uuid'),
        'md5sum': '00000000000000000000000000000000',
        'filename': 'my.fastq.gz',
        'status': 'uploaded',
    }
    res = testapp.post_json('/file_fastq', item)
    return res.json['@graph'][0]


def test_external_creds(mocker):
    mocker.patch('encoded.types.file.boto3', autospec=True)

    ret = external_creds('test-wfout-bucket', 'test-key', 'name')
    assert ret['key'] == 'test-key'
    assert ret['bucket'] == 'test-wfout-bucket'
    assert ret['service'] == 's3'
    assert 'upload_credentials' in ret.keys()


def test_force_beanstalk_env(mocker):
    """
    This test is a bit outdated, since env variable loading has moved to
    application __init__ from file.py. But let's keep the test...
    """
    secret = os.environ.get("AWS_SECRET_ACCESS_KEY")
    key = os.environ.get("AWS_ACCESS_KEY_ID")
    os.environ.pop("AWS_SECRET_ACCESS_KEY")
    os.environ.pop("AWS_ACCESS_KEY_ID")

    test_cfg = tempfile.NamedTemporaryFile(mode='w', delete=False)
    test_cfg.write('export AWS_SECRET_ACCESS_KEY="its a secret"\n')
    test_cfg.write('export AWS_ACCESS_KEY_ID="its a secret id"\n')
    test_cfg_name = test_cfg.name
    test_cfg.close()

    # mock_boto
    mock_boto = mocker.patch('encoded.tests.test_types_file.boto3', autospec=True)

    source_beanstalk_env_vars(test_cfg_name)
    boto3.client('sts', aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                 aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"))
    # reset
    os.environ["AWS_SECRET_ACCESS_KEY"] = secret
    os.environ["AWS_ACCESS_KEY_ID"] = key
    # os.remove(test_cfg.delete)

    # ensure boto called with correct arguments
    mock_boto.client.assert_called_once_with('sts', aws_access_key_id='its a secret id',
                                             aws_secret_access_key='its a secret')


@pytest.fixture
def processed_file_data(project, institution, file_formats):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('pairs').get('uuid'),
    }


def test_validate_produced_from_files_no_produced_by_and_filename_no_filename(
        testapp, processed_file_data):
    res = testapp.post_json('/files-processed', processed_file_data, status=201)
    assert not res.json.get('errors')


def test_validate_filename_invalid_file_format_post(testapp, processed_file_data):
    processed_file_data['file_format'] = 'stringy file format'
    processed_file_data['filename'] = 'test_file.pairs.gz'
    res = testapp.post_json('/files-processed', processed_file_data, status=422)
    errors = res.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert 'Problem getting file_format for test_file.pairs.gz' in descriptions


def test_validate_filename_valid_file_format_and_name_post(testapp, processed_file_data):
    processed_file_data['filename'] = 'test_file.pairs.gz'
    res = testapp.post_json('/files-processed', processed_file_data, status=201)
    assert not res.json.get('errors')


def test_validate_filename_invalid_filename_post(testapp, processed_file_data):
    processed_file_data['filename'] = 'test_file_pairs.gz'
    res = testapp.post_json('/files-processed', processed_file_data, status=422)
    errors = res.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert "Filename test_file_pairs.gz extension does not agree with specified file format. Valid extension(s): '.pairs.gz'" in descriptions


def test_validate_filename_valid_filename_patch(testapp, processed_file_data):
    processed_file_data['filename'] = 'test_file1.pairs.gz'
    res1 = testapp.post_json('/files-processed', processed_file_data, status=201)
    assert not res1.json.get('errors')
    res1_props = res1.json['@graph'][0]
    assert res1_props['filename'] == 'test_file1.pairs.gz'
    filename2patch = 'test_file2.pairs.gz'
    res2 = testapp.patch_json(res1_props['@id'], {'filename': filename2patch}, status=200)
    assert not res2.json.get('errors')
    assert res2.json['@graph'][0]['filename'] == 'test_file2.pairs.gz'


def test_validate_filename_invalid_filename_patch(testapp, processed_file_data):
    processed_file_data['filename'] = 'test_file1.pairs.gz'
    res1 = testapp.post_json('/files-processed', processed_file_data, status=201)
    assert not res1.json.get('errors')
    res1_props = res1.json['@graph'][0]
    assert res1_props['filename'] == 'test_file1.pairs.gz'
    filename2patch = 'test_file2.bam'
    res2 = testapp.patch_json(res1_props['@id'], {'filename': filename2patch}, status=422)
    errors = res2.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert "Filename test_file2.bam extension does not agree with specified file format. Valid extension(s): '.pairs.gz'" in descriptions


def test_validate_produced_from_files_invalid_post(testapp, processed_file_data):
    fids = ['not_a_file_id', 'definitely_not']
    processed_file_data['produced_from'] = fids
    res = testapp.post_json('/files-processed', processed_file_data, status=422)
    errors = res.json['errors']
    descriptions = [e['description'] for e in errors]
    for fid in fids:
        desc = "'%s' not found" % fid
        assert desc in descriptions


def test_validate_extra_files_no_extra_files(testapp, processed_file_data):
    res = testapp.post_json('/files-processed', processed_file_data, status=201)
    assert not res.json.get('errors')


def test_validate_extra_files_extra_files_good_post(testapp, processed_file_data):
    extf = {'file_format': 'pairs_px2'}
    processed_file_data['extra_files'] = [extf]
    res = testapp.post_json('/files-processed', processed_file_data, status=201)
    assert not res.json.get('errors')


def test_validate_extra_files_extra_files_bad_post_extra_same_as_primary(testapp, processed_file_data):
    extf = {'file_format': 'pairs'}
    processed_file_data['extra_files'] = [extf]
    res = testapp.post_json('/files-processed', processed_file_data, status=422)
    assert res.json['errors'][0]['name'] == 'File: invalid extra_file formats'
    assert "'pairs' format cannot be the same for file and extra_file" == res.json['errors'][0]['description']


def test_validate_extra_files_extra_files_bad_patch_extra_same_as_primary(testapp, processed_file_data):
    extf = {'file_format': 'pairs'}
    res1 = testapp.post_json('/files-processed', processed_file_data, status=201)
    pfid = res1.json['@graph'][0]['@id']
    res2 = testapp.patch_json(pfid, {'extra_files': [extf]}, status=422)
    assert res2.json['errors'][0]['name'] == 'File: invalid extra_file formats'
    assert "'pairs' format cannot be the same for file and extra_file" == res2.json['errors'][0]['description']


def test_validate_extra_files_extra_files_bad_post_existing_extra_format(testapp, processed_file_data):
    extfs = [{'file_format': 'pairs_px2'}, {'file_format': 'pairs_px2'}]
    processed_file_data['extra_files'] = extfs
    res = testapp.post_json('/files-processed', processed_file_data, status=422)
    assert res.json['errors'][0]['name'] == 'File: invalid extra_file formats'
    assert "Multple extra files with 'pairs_px2' format cannot be submitted at the same time" == res.json['errors'][0]['description']


def test_validate_extra_files_extra_files_ok_patch_existing_extra_format(testapp, processed_file_data):
    extf = {'file_format': 'pairs_px2'}
    processed_file_data['extra_files'] = [extf]
    res1 = testapp.post_json('/files-processed', processed_file_data, status=201)
    pfid = res1.json['@graph'][0]['@id']
    res2 = testapp.patch_json(pfid, {'extra_files': [extf]}, status=200)
    assert not res2.json.get('errors')


def test_validate_extra_files_parent_should_not_have_extras(
        testapp, processed_file_data, file_formats):
    extf = {'file_format': 'pairs_px2'}
    processed_file_data['file_format'] = file_formats.get('mcool').get('uuid')
    processed_file_data['extra_files'] = [extf]
    res1 = testapp.post_json('/files-processed', processed_file_data, status=422)
    errors = res1.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert "File with format mcool should not have extra_files" in descriptions


def test_validate_extra_files_bad_extras_format(
        testapp, processed_file_data, file_formats):
    extf = {'file_format': 'whosit'}
    processed_file_data['extra_files'] = [extf]
    res1 = testapp.post_json('/files-processed', processed_file_data, status=422)
    errors = res1.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert "'whosit' not a valid or known file format" in descriptions


def test_validate_file_format_validity_for_file_type_allows(testapp, file_formats, project, institution):
    my_fastq_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('fastq').get('uuid'),
    }
    my_proc_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('pairs').get('uuid'),
    }
    res1 = testapp.post_json('/files-fastq', my_fastq_file, status=201)
    res2 = testapp.post_json('/files-processed', my_proc_file, status=201)
    assert not res1.json.get('errors')
    assert not res2.json.get('errors')


def test_validate_file_format_validity_for_file_type_fires(testapp, file_formats, project, institution):
    my_fastq_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('pairs').get('uuid'),
    }
    my_proc_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('fastq').get('uuid'),
    }
    res1 = testapp.post_json('/files-fastq', my_fastq_file, status=422)
    errors = res1.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert "File format pairs is not allowed for FileFastq" in descriptions
    res2 = testapp.post_json('/files-processed', my_proc_file, status=422)
    errors = res2.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert "File format fastq is not allowed for FileProcessed" in descriptions


def test_file_format_does_not_exist(testapp, file_formats, project, institution):
    my_fastq_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': 'waldo',
    }
    res1 = testapp.post_json('/files-fastq', my_fastq_file, status=422)
    errors = res1.json['errors']
    descriptions = ''.join([e['description'] for e in errors])
    assert "'waldo' not found" in descriptions


def test_filename_patch_fails_wrong_format(testapp, file_formats, project, institution):
    my_fastq_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('fastq').get('uuid'),
        'filename': 'test.fastq.gz'
    }
    res1 = testapp.post_json('/files-fastq', my_fastq_file, status=201)
    resobj = res1.json['@graph'][0]
    patch_data = {"file_format": file_formats.get('pairs').get('uuid')}
    res2 = testapp.patch_json('/files-fastq/' + resobj['uuid'], patch_data, status=422)
    errors = res2.json['errors']
    error1 = "Filename test.fastq.gz extension does not agree with specified file format. Valid extension(s): '.pairs.gz'"
    error2 = "File format pairs is not allowed for FileFastq"
    descriptions = ''.join([e['description'] for e in errors])
    assert error1 in descriptions
    assert error2 in descriptions


def test_filename_patch_works_with_different_format(testapp, file_formats, project, institution):
    my_proc_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('pairs').get('uuid'),
        'filename': 'test.pairs.gz'
    }
    res1 = testapp.post_json('/files-processed', my_proc_file, status=201)
    resobj = res1.json['@graph'][0]
    patch_data = {"file_format": file_formats.get('bam').get('uuid'), 'filename': 'test.bam'}
    res2 = testapp.patch_json('/files-processed/' + resobj['uuid'], patch_data, status=200)
    assert not res2.json.get('errors')


def test_file_format_patch_works_if_no_filename(testapp, file_formats, project, institution):
    my_proc_file = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('pairs').get('uuid')
    }
    res1 = testapp.post_json('/files-processed', my_proc_file, status=201)
    resobj = res1.json['@graph'][0]
    patch_data = {"file_format": file_formats.get('bam').get('uuid')}
    res2 = testapp.patch_json('/files-processed/' + resobj['uuid'], patch_data, status=200)
    assert not res2.json.get('errors')


@pytest.fixture
def custom_experiment_set_data(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'description': 'test experiment set',
        'experimentset_type': 'custom',
        'status': 'in review'
    }
