from uuid import uuid4

import pytest
import webtest

from encoded.ingestion.common import CGAP_CORE_PROJECT


class MockedLogger(object):

    def info(self, msg):  # noQA - for mock it doesn't matter it could be static
        print('INFO: ' + msg)

    def warn(self, msg):  # noQA - for mock it doesn't matter it could be static
        print('WARNING: ' + msg)

    def error(self, msg):  # noQA - for mock it doesn't matter it could be static
        print('ERROR: ' + msg)


def remote_user_testapp(app, remote_user):
    '''Use this to generate testapp fixtures acting as different users'''
    environ = {
        'HTTP_ACCEPT': 'application/json',
        'REMOTE_USER': str(remote_user),
    }
    return webtest.TestApp(app, environ)


@pytest.fixture
def mock_logger():
    return MockedLogger()


@pytest.fixture
def connection():
    return {
        "server": "https://cgap.hms.harvard.edu/",
        "key": "testkey",
        "secret": "testsecret"
    }


# I'm not even sure this is needed, but can debug that later. -kmp 2-Apr-2021
def post_if_needed(testapp, item_type_url, item):
    http_created = 201
    http_conflict = 409
    res = testapp.post_json(item_type_url, item, status=(http_created, http_conflict))
    if res.status_code == http_conflict:
        return testapp.get(item_type_url + '/' + item['name'] + '/').json
    else:
        return res.json['@graph'][0]


@pytest.fixture
def project(testapp):
    item = {
        'name': 'encode-project',
        'title': 'ENCODE Project'
    }
    return post_if_needed(testapp, '/project', item)
    # return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def institution(testapp):
    item = {
        'name': 'encode-institution',
        'title': 'ENCODE Institution'
    }
    return post_if_needed(testapp, '/institution', item)
    # return testapp.post_json('/institution', item).json['@graph'][0]


@pytest.fixture
def another_institution(testapp):
    item = {
        'name': 'encode-institution2',
        'title': 'ENCODE Institution 2'
    }
    return post_if_needed(testapp, '/institution', item)
    # return testapp.post_json('/institution', item).json['@graph'][0]


@pytest.fixture
def wb_project(es_testapp, workbook):
    search_string = "/search/?type=Project&title=Test+Project"
    project = es_testapp.get(search_string).json["@graph"][0]
    return project


@pytest.fixture
def core_project(es_testapp, workbook):
    search_string = "/search/?type=Project&title=Core+Project"
    project = es_testapp.get(search_string).json["@graph"][0]
    return project


@pytest.fixture
def wb_institution(es_testapp, workbook):
    search_string = "/search/?type=Institution&title=HMS+DBMI"
    institution = es_testapp.get(search_string).json["@graph"][0]
    return institution


@pytest.fixture
def admin(testapp):
    item = {
        'first_name': 'Test',
        'last_name': 'Admin',
        'email': 'admin@example.org',
        'groups': ['admin'],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def disorder_data():
    return {
        "uuid": "231111bc-8535-4448-903e-854af460b254",
        "disorder_name": "Dummy Disorder",
        "disorder_id": "DD1",
        "comment": "This comment is to test oranges"
    }


@pytest.fixture
def disorder(testapp):
    item = {
        "uuid": "231111bc-8535-4448-903e-854af460b254",
        "disorder_name": "Dummy Disorder",
        "disorder_id": "DD1",
        "comment": "This comment is to test oranges",
        "status": "in review"
    }
    res = testapp.post_json('/disorder', item)
    return testapp.get(res.location).json


@pytest.fixture
def submitter(testapp, institution, project):
    item = {
        'first_name': 'ENCODE',
        'last_name': 'Submitter',
        'email': 'encode_submitter@example.org',
        'status': "current"
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def bgm_project(testapp):
    item = {
        'name': 'bgm-project',
        'title': 'BGM Project',
        'description': 'Brigham Genomic Medicine'
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def bgm_user(testapp, institution, bgm_project):
    item = {
        'first_name': 'BGM',
        'last_name': 'user',
        'email': 'bgmuser@example.org',
        # Does it break tests to add this? -kmp 9-Dec-2020
        'user_institution': institution['name'],
        'institution': institution['name'],
        'project_roles': [
            {
                'project': bgm_project['@id'],
                'role': 'project_member'  # XXX: you probably want this
            }
        ],
        'project': bgm_project['@id'],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def bgm_user_testapp(bgm_user, app, external_tx, zsa_savepoints):
    '''TODO: maybe bring in more permissions-related fixtures into here'''
    return remote_user_testapp(app, bgm_user['uuid'])

@pytest.fixture
def bgm_variant(bgm_user_testapp, bgm_project, institution):
    '''Same thing as workbook inserts, but different project stuff'''
    item = {
        'project': bgm_project['@id'],
        'institution': institution["name"],
        # We do not supply an explicit UUID here anymore because it says we need "permission restricted items"
        # Might be some other way of getting it in here, but idk nor have time to rly explore atm.
        # "uuid": "f6aef055-4c88-4a3e-a306-d37a71535d8b",
        "ID": "rs564328546",
        "ALT": "T",
        "POS": 12125898,
        "REF": "TG",
        "hg19": [
        {
            "hg19_pos": 12185955,
            "hg19_chrom": "chr1",
            "hg19_hgvsg": "NC_000001.11:g.12185956del"
        }
        ],
        "CHROM": "1"
    }
    return bgm_user_testapp.post_json('/variants', item).json['@graph'][0]

@pytest.fixture
def bgm_test_variant_sample(bgm_variant, institution, bgm_project):
    # IS NOT pre-POSTed into DB.
    return {
        'variant': bgm_variant['@id'],
        'AD': '1,3',
        'CALL_INFO': 'my_test_sample',
        'file': 'dummy-file-name',
        'project': bgm_project['@id'],
        'institution': institution['@id']
    }

@pytest.fixture
def access_key(testapp, bgm_user):
    description = 'My programmatic key'
    item = {
        'user': bgm_user['@id'],
        'description': description,
    }
    res = testapp.post_json('/access_key', item)
    result = res.json['@graph'][0].copy()
    result['secret_access_key'] = res.json['secret_access_key']
    return result


@pytest.fixture
def bgm_access_key(access_key):
    # An alias for access_key, useful for emphasis to compare to non_bgm_access_key
    return access_key



@pytest.fixture
def non_bgm_project(testapp):
    item = {
        'name': 'not-bgm-project',
        'title': 'Not BGM Project',
        'description': 'Not Brigham Genomic Medicine'
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def non_bgm_user(testapp, institution, non_bgm_project):
    item = {
        'first_name': 'Not-BGM',
        'last_name': 'user',
        'email': 'notbgmuser@example.org',
        # Whether we have 'user_institution' should depend on whether bgm_user does. -kmp 9-Dec-2020
        'user_institution': institution['name'],  # bgm_project and non_bgm_project are both at same user_institution
        'institution': institution['name'],  # bgm_project and non_bgm_project are both at same institution
        'project_roles': [
            {
                'project': non_bgm_project['@id'],
                'role': 'project_member'  # XXX: you probably want this
            }
        ],
        'project': non_bgm_project['@id'],
        'status': 'current'
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def non_bgm_access_key(testapp, non_bgm_user):
    description = 'My non-BGM programmatic key'
    item = {
        'user': non_bgm_user['@id'],
        'description': description,
    }
    res = testapp.post_json('/access_key', item)
    result = res.json['@graph'][0].copy()
    result['secret_access_key'] = res.json['secret_access_key']
    return result


# ADD SAMPLES FOR FAMILY MEMBERS
@pytest.fixture
def female_individual_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAGRANDMA",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_001",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def grandpa_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAGRANDPA",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_002",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def mother_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAMOTHER1",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_003",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def father_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAFATHER1",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_004",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def uncle_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAUNCLE01",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_005",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def proband_processed_file(testapp, project, institution, file_formats):
    """Add a bam file to test the samples_pedigree"""
    item = {
        'project': project['@id'],
        'institution': institution['@id'],
        'file_format': file_formats.get('bam').get('uuid'),
        'filename': 'test_proband_file.bam'
    }
    return testapp.post_json('/file_processed', item).json['@graph'][0]


@pytest.fixture
def child_sample(testapp, project, institution, proband_processed_file):
    item = {
        "accession": "GAPSAPROBAND",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_006",
        "status": "shared",
        "processed_files": [proband_processed_file['@id'], ]
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def cousin_sample(testapp, project, institution):
    item = {
        "accession": "GAPSACOUSIN1",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_007",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def sister_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAHALFSIS",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_008",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def brother_sample(testapp, project, institution):
    item = {
        "accession": "GAPSABROTHER",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_009",
        "status": "shared"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


# ADD FAMILY MEMBERS
@pytest.fixture
def female_individual(testapp, project, institution, female_individual_sample):
    item = {
        "accession": "GAPIDGRANDMA",
        "samples": [female_individual_sample['@id']],
        "age": 53,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "F",
        "status": "shared"
        # "uuid": "44d24e3f-bc5b-469a-8500-7ebd728f8ed5"
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def grandpa(testapp, project, institution, grandpa_sample):
    item = {
        "accession": "GAPIDGRANDPA",
        "samples": [grandpa_sample['@id']],
        "age": 53,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "M",
        "status": "shared"
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def mother(testapp, project, institution, grandpa, female_individual, mother_sample):
    item = {
        "aliases": ["test-project:indiv-003389"],
        "accession": "GAPIDMOTHER1",
        "samples": [mother_sample['@id']],
        "age": 33,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "F",
        "father": grandpa['@id'],
        "mother": female_individual['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def father(testapp, project, institution, father_sample):
    item = {
        "accession": "GAPIDFATHER1",
        "samples": [father_sample['@id']],
        "age": 33,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "M",
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def uncle(testapp, project, institution, grandpa, uncle_sample):
    item = {
        "accession": "GAPIDUNCLE01",
        "samples": [uncle_sample['@id']],
        "age": 35,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "M",
        "father": grandpa['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def child(testapp, project, institution, mother, father, child_sample):
    item = {
        "accession": "GAPIDPROBAND",
        "samples": [child_sample['@id']],
        "age": 7,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "M",
        "mother": mother['@id'],
        "father": father['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def cousin(testapp, project, institution, uncle, cousin_sample):
    item = {
        "accession": "GAPIDCOUSIN1",
        "samples": [cousin_sample['@id']],
        "age": 11,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "F",
        "father": uncle['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def sister(testapp, project, institution, mother, sister_sample):
    item = {
        "accession": "GAPIDHALFSIS",
        "samples": [sister_sample['@id']],
        "age": 11,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "F",
        "mother": mother['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def brother(testapp, project, institution, mother, father, brother_sample):
    item = {
        "accession": "GAPIDBROTHER",
        "samples": [brother_sample['@id']],
        "age": 13,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "M",
        "mother": mother['@id'],
        "father": father['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def brotherII(testapp, project, institution, mother, father):
    item = {
        "accession": "GAPIDBROTHII",
        "age": 9,
        "age_units": "week",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "M",
        "mother": mother['@id'],
        "father": father['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def brotherIII(testapp, project, institution, mother, father):
    item = {
        "accession": "GAPIDBROTIII",
        "age": 3,
        "age_units": "day",
        'project': project['@id'],
        'institution': institution['@id'],
        "sex": "M",
        "mother": mother['@id'],
        "father": father['@id']
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def fam(testapp, project, female_individual, institution, grandpa, mother, father, uncle,
        child, cousin, sister, brother, brotherII, brotherIII):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "title": "Smith family",
        "proband": child['@id'],
        "members": [
            child['@id'],
            sister['@id'],
            brother['@id'],
            brotherII['@id'],
            brotherIII['@id'],
            mother['@id'],
            father['@id'],
            uncle['@id'],
            cousin['@id'],
            grandpa['@id'],
            female_individual['@id']
        ]
    }
    return testapp.post_json('/family', item).json['@graph'][0]


@pytest.fixture
def sample_proc_fam(testapp, project, institution, fam):
    data = {
        'project': project['@id'],
        'institution': institution['@id'],
        'analysis_type': "WGS-Group",
        'samples': [
            "GAPSAPROBAND",
            "GAPSAFATHER1",
            "GAPSAMOTHER1",
            "GAPSABROTHER",
            "GAPSAGRANDPA",
            "GAPSAGRANDMA",
            "GAPSAHALFSIS",
            "GAPSAUNCLE01",
            "GAPSACOUSIN1"
            ],
        'families': [fam['@id']]
    }
    res = testapp.post_json('/sample_processing', data).json['@graph'][0]
    return res


@pytest.fixture
def proband_case(testapp, project, institution, fam, sample_proc_fam):
    data = {
        "accession": "GAPCAP4E4GMG",
        'project': project['@id'],
        'institution': institution['@id'],
        'family': fam['@id'],
        'individual': 'GAPIDPROBAND',
        'sample_processing': sample_proc_fam['@id']
    }
    res = testapp.post_json('/case', data).json['@graph'][0]
    return res


@pytest.fixture
def mother_case(testapp, project, institution, fam, sample_proc_fam):
    data = {
        "accession": "GAPCAU1K3F5A",
        'project': project['@id'],
        'institution': institution['@id'],
        'family': fam['@id'],
        'individual': 'GAPIDMOTHER1',
        'sample_processing': sample_proc_fam['@id']
    }
    res = testapp.post_json('/case', data).json['@graph'][0]
    return res


@pytest.fixture
def sample_f(testapp, project, institution, female_individual):
    data = {
        'project': project['@id'],
        'institution': institution['@id'],
        'specimen_type': 'saliva',
        'date_received': '2015-12-7'
    }
    return testapp.post_json('/sample', data).json['@graph'][0]


@pytest.fixture
def sample_proc(testapp, project, institution, sample_f, fam):
    data = {
        'project': project['@id'],
        'institution': institution['@id'],
        'samples': [sample_f['@id']],
        'families': [fam['@id']]
    }
    return testapp.post_json('/sample_processing', data).json['@graph'][0]


@pytest.fixture
def a_case(project, institution, child, sample_proc):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'individual': child['@id'],
        'sample_processing': sample_proc['@id']
    }


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


@pytest.fixture
def protocol_data(institution, project):
    return {'description': 'A Protocol',
            'protocol_type': 'Experimental protocol',
            'project': project['@id'],
            'institution': institution['@id']
            }


@pytest.fixture
def protocol(testapp, protocol_data):
    return testapp.post_json('/protocol', protocol_data).json['@graph'][0]


@pytest.fixture
def file_formats(testapp, institution, project):
    formats = {}
    ef_format_info = {
        # 'pairs_px2': {'standard_file_extension': 'pairs.gz.px2',
        #               "valid_item_types": ["FileProcessed"]},
        # 'pairsam_px2': {'standard_file_extension': 'sam.pairs.gz.px2',
        #                 "valid_item_types": ["FileProcessed"]},
        'bai': {'standard_file_extension': 'bam.bai',
                "valid_item_types": ["FileProcessed"]},
        'beddb': {"standard_file_extension": "beddb",
                  "valid_item_types": ["FileProcessed", "FileReference"]},
    }
    format_info = {
        'fastq': {'standard_file_extension': 'fastq.gz',
                  'other_allowed_extensions': ['fq.gz'],
                  "valid_item_types": ["FileFastq"]},
        # 'pairs': {'standard_file_extension': 'pairs.gz',
        #           "extrafile_formats": ['pairs_px2', 'pairsam_px2'],
        #           "valid_item_types": ["FileProcessed"]},
        'bam': {'standard_file_extension': 'bam',
                'extrafile_formats': ['bai'],
                "valid_item_types": ["FileProcessed"]},
        # 'mcool': {'standard_file_extension': 'mcool',
        #           "valid_item_types": ["FileProcessed", "FileVistrack"]},
        # 'tiff': {'standard_file_extension': 'tiff',
        #          'other_allowed_extensions': ['tif'],
        #          "valid_item_types": ["FileMicroscopy", "FileCalibration"]},
        'zip': {'standard_file_extension': 'zip',
                "valid_item_types": ["FileProcessed"]},
        'chromsizes': {'standard_file_extension': 'chrom.sizes',
                       "valid_item_types": ["FileReference"]},
        'other': {'standard_file_extension': '',
                  "valid_item_types": ["FileProcessed", "FileReference"]},
        'bw': {'standard_file_extension': 'bw',
               "valid_item_types": ["FileProcessed"]},
        'bg': {'standard_file_extension': 'bedGraph.gz',
               "valid_item_types": ["FileProcessed"]},
        'bigbed': {'standard_file_extension': 'bb',
                   "valid_item_types": ["FileProcessed", "FileReference"]},
        'bed': {"standard_file_extension": "bed.gz",
                "extrafile_formats": ['beddb'],
                "valid_item_types": ["FileProcessed", "FileReference"]},
        'vcf_gz': {"standard_file_extension": "vcf.gz",
                   "valid_item_types": ["FileProcessed"]}
    }

    for eff, info in ef_format_info.items():
        info['file_format'] = eff
        info['uuid'] = str(uuid4())
        info['institution'] = institution['@id']
        info['project'] = project['@id']
        formats[eff] = testapp.post_json('/file_format', info, status=201).json['@graph'][0]
    for ff, info in format_info.items():
        info['file_format'] = ff
        info['uuid'] = str(uuid4())
        if info.get('extrafile_formats'):
            eff2add = []
            for eff in info.get('extrafile_formats'):
                eff2add.append(formats[eff].get('@id'))
            info['extrafile_formats'] = eff2add
        info['institution'] = institution['@id']
        info['project'] = project['@id']
        formats[ff] = testapp.post_json('/file_format', info, status=201).json['@graph'][0]
    return formats


@pytest.fixture
def file(testapp, institution, project, file_formats):
    item = {
        'file_format': file_formats.get('fastq').get('@id'),
        'md5sum': 'd41d8cd98f00b204e9800998ecf8427e',
        'institution': institution['@id'],
        'project': project['@id'],
        'status': 'uploaded',  # avoid s3 upload codepath
    }
    return testapp.post_json('/file_fastq', item).json['@graph'][0]


@pytest.fixture
def file_fastq(testapp, institution, project, file_formats):
    item = {
        'file_format': file_formats.get('fastq').get('@id'),
        'md5sum': 'd41d8cd9f00b204e9800998ecf8427e',
        'institution': institution['@id'],
        'project': project['@id'],
        'status': 'uploaded',  # avoid s3 upload codepath
    }
    return testapp.post_json('/file_fastq', item).json['@graph'][0]


@pytest.fixture
def file_fastq2(testapp, institution, project, file_formats):
    item = {
        'aliases': ['test-project:file2'],
        'file_format': file_formats.get('fastq').get('@id'),
        'md5sum': 'd41d8cd9f00b204e9800998ecf8429e',
        'institution': institution['@id'],
        'project': project['@id'],
        'status': 'uploaded',  # avoid s3 upload codepath
    }
    return testapp.post_json('/file_fastq', item).json['@graph'][0]


@pytest.fixture
def file_vcf(testapp, institution, project, file_formats):
    item = {
        'file_format': file_formats.get('vcf_gz').get('@id'),
        'md5sum': 'd41d8cd9f00b204e9800998ecf84211',
        'institution': institution['@id'],
        'project': project['@id'],
        'status': 'uploaded',  # avoid s3 upload codepath
        'file_type': 'full annotated VCF',
    }
    return testapp.post_json('/file_processed', item).json['@graph'][0]


@pytest.fixture
def file_vcf_sv(testapp, institution, project, file_formats):
    item = {
        "file_format": file_formats.get("vcf_gz").get("@id"),
        "md5sum": "d41d8cd9f00b204e9800998ecf84212",
        "institution": institution["@id"],
        "project": project["@id"],
        "status": "uploaded",  # avoid s3 upload codepath
        "file_type": "full annotated VCF",
        "variant_type": "SV",
    }
    return testapp.post_json("/file_processed", item).json["@graph"][0]


@pytest.fixture
def file_vcf_cnv(testapp, institution, project, file_formats):
    item = {
        "file_format": file_formats.get("vcf_gz").get("@id"),
        "md5sum": "d41d8cd9f00b204e9800998ecf84213",
        "institution": institution["@id"],
        "project": project["@id"],
        "status": "uploaded",  # avoid s3 upload codepath
        "file_type": "full annotated VCF",
        "variant_type": "CNV",
    }
    return testapp.post_json("/file_processed", item).json["@graph"][0]


RED_DOT = """data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA
AAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO
9TXL0Y4OHwAAAABJRU5ErkJggg=="""


@pytest.fixture
def attachment():
    return {'download': 'red-dot.png', 'href': RED_DOT}


@pytest.fixture
def image_data(attachment, institution, project):
    return {
        'attachment': attachment,
        'caption': 'Test image',
        'project': project['uuid'],
        'institution': institution['uuid'],
    }


@pytest.fixture
def image(testapp, image_data):
    return testapp.post_json('/image', image_data).json['@graph'][0]


@pytest.fixture
def software(testapp, institution, project):
    # TODO: ASK_ANDY do we want software_type to be an array?
    item = {
        "name": "FastQC",
        "software_type": ["indexer", ],
        "version": "1",
        'institution': institution['@id'],
        'project': project['@id']
    }
    return testapp.post_json('/software', item).json['@graph'][0]


@pytest.fixture
def analysis_step(testapp, software, institution, project):
    item = {
        'name': 'fastqc',
        "software_used": software['@id'],
        "version": "1",
        'institution': institution['@id'],
        'project': project['@id']
    }
    return testapp.post_json('/analysis_step', item).json['@graph'][0]


@pytest.fixture
def document(testapp, institution, project):
    item = {
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/document', item).json['@graph'][0]


@pytest.fixture
def workflow_run_awsem(testapp, institution, project, workflow_bam):
    item = {'run_platform': 'AWSEM',
            'parameters': [],
            'workflow': workflow_bam['@id'],
            'title': u'md5 run 2017-01-20 13:16:11.026176',
            'project': project['@id'],
            'awsem_job_id': '1235',
            'institution': institution['@id'],
            'run_status': 'started',
            }
    return testapp.post_json('/workflow_run_awsem', item).json['@graph'][0]


@pytest.fixture
def workflow_run_json(testapp, institution, project, workflow_bam):
    return {'run_platform': 'SBG',
            'parameters': [],
            'workflow': workflow_bam['@id'],
            'title': u'md5 run 2017-01-20 13:16:11.026176',
            'sbg_import_ids': [u'TBCKPdzfUE9DpvtzO6yb9yoIvO81RaZd'],
            'project': project['@id'],
            'sbg_task_id': '1235',
            'institution': institution['@id'],
            'sbg_mounted_volume_ids': ['4dn_s32gkz1s7x', '4dn_s33xkquabu'],
            'run_status': 'started',
            }


@pytest.fixture
def workflow_run_awsem_json(testapp, institution, project, workflow_bam):
    return {'run_platform': 'AWSEM',
            'parameters': [],
            'workflow': workflow_bam['@id'],
            'title': u'md5 run 2017-01-20 13:16:11.026176',
            'project': project['@id'],
            'awsem_job_id': '1235',
            'institution': institution['@id'],
            'run_status': 'started',
            }


@pytest.fixture
def software_bam(testapp, institution, project):
    # TODO: ASK_ANDY do we want software_type to be an array?
    item = {
        "name": "Aligner",
        "software_type": ["indexer", ],
        "version": "1",
        'institution': institution['@id'],
        'project': project['@id']
    }
    return testapp.post_json('/software', item).json['@graph'][0]


@pytest.fixture
def workflow_bam(testapp, institution, project):
    item = {
        'title': "test workflow",
        'name': "test_workflow",
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/workflow', item).json['@graph'][0]


@pytest.fixture
def workflow_mapping(testapp, workflow_bam, institution, project):
    item = {
        "name": "test mapping",
        "workflow_name": "test workflow name",
        "workflow": workflow_bam['@id'],
        "data_input_type": "experiment",
        'institution': institution['@id'],
        'project': project['@id'],
        # TODO: This value of "workflow_parameters" is duplicated and should be removed or merged with the other.
        #       Probably only the second value is being used right now. - Will and Kent 17-Dec-2020
        # "workflow_parameters": [
        #    {"parameter": "bowtie_index", "value": "some value"}
        # ],
        "experiment_parameters": [
            {"parameter": "biosample.biosource.individual.organism", "value": "mouse"}
        ],
        "workflow_parameters": [
            {"parameter": "genome_version", "value": "mm9"}
        ]
    }
    return testapp.post_json('/workflow_mapping', item).json['@graph'][0]


@pytest.fixture
def quality_metric_fastqc(testapp, project, institution):
    item = {
        "uuid": "ed80c2a5-ae55-459b-ba1d-7b0971ce2613",
        "project": project['@id'],
        "institution": institution['@id']
    }
    return testapp.post_json('/quality_metric_fastqc', item).json['@graph'][0]


@pytest.fixture
def rel_disorders():
    return [
        {
            'disorder_id': 'MONDO:0400005',
            'status': 'shared',
            'disorder_name': 'refeeding syndrome',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0400005',
        },
        {
            'disorder_id': 'MONDO:0400004',
            'status': 'shared',
            'disorder_name': 'phrynoderma',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0400004',
        },
        {
            'disorder_id': 'MONDO:0300000',
            'status': 'shared',
            'disorder_name': 'SSR3-CDG',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0300000',
        },
        {
            'disorder_id': 'MONDO:0200000',
            'status': 'shared',
            'disorder_name': 'uterine ligament adenosarcoma',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0200000'
        }
    ]


@pytest.fixture
def delobs_disorders():
    return [
        {
            'disorder_id': 'MONDO:9999998',
            'status': 'deleted',
            'disorder_name': 'colored thumbs',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999998'
        },
        {
            'disorder_id': 'MONDO:9999999',
            'status': 'obsolete',
            'disorder_name': 'green thumbs',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999999'
        }
    ]


@pytest.fixture
def phenotypes():
    return [
        {
            'hpo_id': 'HP:0001507',
            'status': 'shared',
            'phenotype_name': 'growth abnormality',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_00001507',
            'is_slim_for': 'Phenotype abnormality'
        },
        {
            'hpo_id': 'HP:0040064',
            'status': 'shared',
            'phenotype_name': 'Abnormality of limbs',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_0040064',
            'is_slim_for': 'Phenotype abnormality'
        },
        {
            'hpo_id': 'HP:3000008',
            'status': 'shared',
            'phenotype_name': 'Abnormality of mylohyoid muscle',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_3000008'
        },
        {
            'hpo_id': 'HP:0010708',
            'status': 'shared',
            'phenotype_name': '1-5 finger syndactyly',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_0010708'
        }
    ]


@pytest.fixture
def raw_item_dict():
    return {
        'string_field': 'a_string',
        'list_string_field': ['a_string', 'b_string', 'c_string'],
        'int_field': 1,
        'num_field': 1.1,
        'boolean_field': True,
        'list_int_field': [1, 2, 3],
        'list_num_field': [1.1, 2.2, 3.3],
        'linked_item_field': 'uuid1',
        'list_linked_item_field': ['uuid1', 'uuid2'],
        'sub_embed_obj_field': {'sef1': 'string', 'sef2': 'uuid1'},
        'list_sub_embed_obj_field': [
            {'sef1': 'string', 'sef2': 'uuid1'},
            {'sef1': 'string2', 'sef2': 'uuid2'}
        ]
    }


@pytest.fixture
def embedded_item_dict():
    return {
        'uuid': 'uuid1',
        'string_field': 'a_string',
        'list_string_field': ['a_string', 'b_string', 'c_string'],
        'int_field': 1,
        'num_field': 1.1,
        'boolean_field': True,
        'list_int_field': [1, 2, 3],
        'list_num_field': [1.1, 2.2, 3.3],
        'linked_item_field': {
            'uuid': 'uuid1',
            'display_title': 'dt1',
            '@type': ['Item'],
            'embedded_field1': 'val1',
            'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
        },
        'list_linked_item_field': [
            {
                'uuid': 'uuid1',
                'display_title': 'dt1',
                '@type': ['Item'],
                'embedded_field1': 'val1',
                'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
            },
            {
                'uuid': 'uuid2',
                'display_title': 'dt1',
                '@type': ['Item'],
                'embedded_field1': 'val1',
                'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
            }
        ],
        'sub_embed_obj_field': {
            'sef1': 'string',
            'sef2': {
                'uuid': 'uuid1',
                'display_title': 'dt1',
                '@type': ['Item'],
                'embedded_field1': 'val1',
                'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
            }
        },
        'list_sub_embed_obj_field': [
            {
                'sef1': 'string',
                'sef2': {
                    'uuid': 'uuid1',
                    'display_title': 'dt1',
                    '@type': ['Item'],
                    'embedded_field1': 'val1',
                    'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
                }
            },
            {
                'sef1': 'string2',
                'sef2': {
                    'uuid': 'uuid2',
                    'display_title': 'dt2',
                    '@type': ['Item'],
                    'embedded_field1': 'val1',
                    'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
                }
            }
        ]
    }


@pytest.fixture
def cgap_core_project(testapp):
    item = {
        "name": CGAP_CORE_PROJECT.split("/")[-1],
        "title": "cgap core",
        "description": "The CGAP core project",
    }
    return testapp.post_json("/project", item).json["@graph"][0]


@pytest.fixture
def gene(testapp, project, institution):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "gene_symbol": "APC",
        "ensgid": "ENSG00000001111",
    }
    return testapp.post_json("/gene", item).json["@graph"][0]


@pytest.fixture
def gene_2(testapp, project, institution):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "gene_symbol": "FBN1",
        "ensgid": "ENSG00000002222",
    }
    return testapp.post_json("/gene", item).json["@graph"][0]


@pytest.fixture
def cgap_core_genelist(testapp, cgap_core_project, institution, gene):
    item = {
        "project": cgap_core_project["@id"],
        "institution": institution["@id"],
        "title": "CGAP Core gene list",
        "genes": [gene["@id"]],
    }
    return testapp.post_json("/gene-lists", item).json["@graph"][0]


@pytest.fixture
def bgm_genelist(testapp, bgm_project, institution, gene):
    item = {
        "project": bgm_project["@id"],
        "institution": institution["@id"],
        "title": "BGM gene list",
        "genes": [gene["@id"]],
    }
    return testapp.post_json("/gene-lists", item).json["@graph"][0]


@pytest.fixture
def genelist(testapp, project, institution, gene):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "title": "Simple gene list",
        "genes": [gene["@id"]],
    }
    return testapp.post_json("/gene-lists", item).json["@graph"][0]


@pytest.fixture
def genelist_to_post(testapp, project, institution, gene_2):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "title": "Simple gene list",
        "genes": [gene_2["@id"]],
    }
    return item


@pytest.fixture
def variant(testapp, project, institution, gene):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "CHROM": "1",
        "REF": "A",
        "ALT": "C",
        "POS": 12345,
        "genes": [{"genes_most_severe_gene": gene["@id"]}],
    }
    return testapp.post_json("/variant", item).json["@graph"][0]


@pytest.fixture
def variant_2(testapp, project, institution, gene_2):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "CHROM": "2",
        "REF": "T",
        "ALT": "G",
        "POS": 45678,
        "genes": [{"genes_most_severe_gene": gene_2["@id"]}],
    }
    return testapp.post_json("/variant", item).json["@graph"][0]


@pytest.fixture
def variant_sample(project, institution, variant):
    """
    This item is not pre-posted to database so gene list association with
    variant samples can be tested (due to longer process of associating variant
    samples with gene lists when the latter is posted after the former).
    """
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "variant": variant["@id"],
        "CALL_INFO": "some_sample",
        "file": "some_vcf_file",
    }
    return item


@pytest.fixture
def variant_sample_2(project, institution, variant_2):
    """
    This item is not pre-posted to database so gene list association with
    variant samples can be tested (due to longer process of associating variant
    samples with gene lists when the latter is posted after the former).
    """
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "variant": variant_2["@id"],
        "CALL_INFO": "some_sample",
        "file": "some_vcf_file",
    }
    return item


@pytest.fixture
def cgap_core_variant_sample(cgap_core_project, institution, variant):
    """
    This item is not pre-posted to database so gene list association with
    variant samples can be tested (due to longer process of associating variant
    samples with gene lists when the latter is posted after the former).
    """
    item = {
        "project": cgap_core_project["@id"],
        "institution": institution["@id"],
        "variant": variant["@id"],
        "CALL_INFO": "some_cgap_core_sample",
        "file": "some_cgap_core_vcf_file",
    }
    return item


@pytest.fixture
def bgm_variant_sample(bgm_project, institution, variant):
    """
    This item is not pre-posted to database so gene list association with
    variant samples can be tested (due to longer process of associating variant
    samples with gene lists when the latter is posted after the former).
    """
    item = {
        "project": bgm_project["@id"],
        "institution": institution["@id"],
        "variant": variant["@id"],
        "CALL_INFO": "some_bgm_sample",
        "file": "some_bgm_vcf_file",
    }
    return item


@pytest.fixture
def variant_sample_list(
    testapp, variant_sample, variant_sample_2, genelist, project, institution
):
    vs_1 = testapp.post_json(
        "/variant-samples", variant_sample, status=201
    ).json["@graph"][0]
    vs_2 = testapp.post_json(
        "/variant-samples", variant_sample_2, status=201
    ).json["@graph"][0]
    vs_list = {
        "project": project["@id"],
        "institution": institution["@id"],
        "variant_samples": [
            {"variant_sample_item": vs_1["@id"]},
            {"variant_sample_item": vs_2["@id"]},
        ],
        "created_for_case": "GAPCAK111111",
    }
    response = testapp.post_json(
        "/variant-sample-lists", vs_list, status=201
    ).json["@graph"][0]
    return response


@pytest.fixture
def structural_variant(testapp, project, institution, gene):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "CHROM": "1",
        "START": 1000,
        "END": 2000,
        "SV_TYPE": "DEL",
        "transcript": [{"csq_gene": gene["@id"]}],
    }
    return testapp.post_json("/structural_variant", item, status=201).json["@graph"][0]


@pytest.fixture
def structural_variant_2(testapp, project, institution, gene_2):
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "CHROM": "3",
        "START": 34500,
        "END": 56000,
        "SV_TYPE": "DUP",
        "transcript": [{"csq_gene": gene_2["@id"]}],
    }
    return testapp.post_json("/structural_variant", item, status=201).json["@graph"][0]


@pytest.fixture
def structural_variant_hg19(testapp, project, institution):
    """An SV with hg19 coordinates"""
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "CHROM": "5",
        "START": 123445,
        "END": 234556,
        "SV_TYPE": "DUP",
        "hg19_chr": "5",
        "hg19_start": 123456,
        "hg19_end": 234567,
    }
    return testapp.post_json("/structural_variant", item, status=201).json["@graph"][0]


@pytest.fixture
def structural_variant_sample(project, institution, structural_variant):
    """This item is not pre-posted to database."""
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "structural_variant": structural_variant["@id"],
        "CALL_INFO": "some_sample",
        "file": "some_vcf_file",
    }
    return item


@pytest.fixture
def structural_variant_sample_2(project, institution, structural_variant_2):
    """This item is not pre-posted to database."""
    item = {
        "project": project["@id"],
        "institution": institution["@id"],
        "structural_variant": structural_variant_2["@id"],
        "CALL_INFO": "some_sample",
        "file": "some_vcf_file",
    }
    return item


@pytest.fixture
def cgap_core_structural_variant_sample(
    cgap_core_project, institution, structural_variant
):
    """This item is not pre-posted to database."""
    item = {
        "project": cgap_core_project["@id"],
        "institution": institution["@id"],
        "structural_variant": structural_variant["@id"],
        "CALL_INFO": "some_cgap_core_sample",
        "file": "some_cgap_core_vcf_file",
    }
    return item


@pytest.fixture
def bgm_structural_variant_sample(bgm_project, institution, structural_variant):
    """This item is not pre-posted to database."""
    item = {
        "project": bgm_project["@id"],
        "institution": institution["@id"],
        "structural_variant": structural_variant["@id"],
        "CALL_INFO": "some_bgm_sample",
        "file": "some_bgm_vcf_file",
    }
    return item
