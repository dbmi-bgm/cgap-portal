import pytest
import copy


ORDER = [
    'user', 'project', 'institution', 'file_format', 'variant_consequence', 'cohort', 'individual',
    'sample', 'workflow', 'access_key', 'disorder', 'document', 'file_fastq',
    'file_processed', 'file_reference', 'gene', 'sample_processing',
    'page', 'phenotype', 'quality_metric_fastqc', 'evidence_dis_pheno',
    'quality_metric_bamcheck', 'quality_metric_qclist', 'quality_metric_wgs_bamqc',
    'quality_metric_vcfcheck', 'quality_metric_workflowrun', 'software', 'static_section',
    'tracking_item', 'workflow_mapping', 'workflow_run_awsem', 'workflow_run'
]


@pytest.fixture
def wrangler_testapp(wrangler, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, wrangler['uuid'])


@pytest.fixture
def submitter_testapp(submitter, app, external_tx, zsa_savepoints):
    return remote_user_testapp(app, submitter['uuid'])


@pytest.fixture
def project(testapp):
    item = {
        'name': 'encode-project',
        'title': 'ENCODE Project',
        'viewing_group': '4DN'
    }
    return testapp.post_json('/project', item).json['@graph'][0]


@pytest.fixture
def institution(testapp):
    item = {
        'name': 'encode-institution',
        'title': 'ENCODE Institution'
    }
    return testapp.post_json('/institution', item).json['@graph'][0]


@pytest.fixture
def another_institution(testapp):
    item = {
        'name': 'encode-institution2',
        'title': 'ENCODE Institution 2'
    }
    return testapp.post_json('/institution', item).json['@graph'][0]


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
        "comment": "This comment is to test oranges"
    }
    res = testapp.post_json('/disorder', item)
    return testapp.get(res.location).json


@pytest.fixture
def submitter(testapp, institution, project):
    item = {
        'first_name': 'ENCODE',
        'last_name': 'Submitter',
        'email': 'encode_submitter@example.org',
        'submits_for': [institution['@id']],
        'viewing_groups': [project['viewing_group']],
        'status': "current"
    }
    # User @@object view has keys omitted.
    res = testapp.post_json('/user', item)
    return testapp.get(res.location).json


@pytest.fixture
def access_key(testapp, submitter):
    description = 'My programmatic key'
    item = {
        'user': submitter['@id'],
        'description': description,
    }
    res = testapp.post_json('/access_key', item)
    result = res.json['@graph'][0].copy()
    result['secret_access_key'] = res.json['secret_access_key']
    return result


@pytest.fixture
def female_individual(testapp, project, institution):
    item = {
        "accession": "GAPINOOOAAQ1",
        "age": 53,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        "ethnicity": "Caucasian",
        "sex": "F",
        "status": "released",
        "url": "http://ccr.coriell.org/Sections/BrowseCatalog/FamilyTypeSubDetail.aspx?PgId=402&fam=1463&coll=GM"
        # "uuid": "44d24e3f-bc5b-469a-8500-7ebd728f8ed5"
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def sample_f(project, institution, female_individual):
    return {
        'project': project['@id'],
        'institution': institution['@id'],
        'specimen_type': 'saliva',
        'date_received': '2015-12-7'
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
    from uuid import uuid4
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
        'tiff': {'standard_file_extension': 'tiff',
                 'other_allowed_extensions': ['tif'],
                 "valid_item_types": ["FileMicroscopy", "FileCalibration"]},
        'zip': {'standard_file_extension': 'zip',
                "valid_item_types": ["FileProcessed", "FileMicroscopy", "FileCalibration"]},
        'chromsizes': {'standard_file_extension': 'chrom.sizes',
                       "valid_item_types": ["FileReference"]},
        'other': {'standard_file_extension': '',
                  "valid_item_types": ["FileProcessed", "FileMicroscopy", "FileReference", "FileCalibration"]},
        'bw': {'standard_file_extension': 'bw',
               "valid_item_types": ["FileProcessed", "FileVistrack"]},
        'bg': {'standard_file_extension': 'bedGraph.gz',
               "valid_item_types": ["FileProcessed", "FileVistrack"]},
        'bigbed': {'standard_file_extension': 'bb',
                   "valid_item_types": ["FileProcessed", "FileReference"]},
        'bed': {"standard_file_extension": "bed.gz",
                "extrafile_formats": ['beddb'],
                "valid_item_types": ["FileProcessed", "FileReference"]}
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
        "workflow_parameters": [
            {"parameter": "bowtie_index", "value": "some value"}
        ],
        "experiment_parameters": [
            {"parameter": "biosample.biosource.individual.organism", "value": "mouse"}
        ],
        "workflow_parameters": [
            {"parameter": "genome_version", "value": "mm9"}
        ]
    }
    return testapp.post_json('/workflow_mapping', item).json['@graph'][0]


@pytest.fixture
def gene_item(testapp, institution, project):
    return testapp.post_json('/gene', {'institution': institution['@id'], 'project': project['@id'], 'geneid': '5885'}).json['@graph'][0]


@pytest.fixture
def quality_metric_fastqc(testapp, project, institution):
    item = {
        "uuid": "ed80c2a5-ae55-459b-ba1d-7b0971ce2613",
        "project": project['@id'],
        "institution": institution['@id']
    }
    return testapp.post_json('/quality_metric_fastqc', item).json['@graph'][0]
