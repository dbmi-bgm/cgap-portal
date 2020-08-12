import pytest

from uuid import uuid4



ORDER = [
    'user', 'project', 'institution', 'filter_set', 'nexus',
    'file_format', 'variant_consequence', 'phenotype',
    'cohort', 'family', 'individual', 'sample', 'workflow',
    'access_key', 'disorder', 'document', 'file_fastq',
    'file_processed', 'file_reference', 'gene', 'sample_processing',
    'case', 'report', 'page', 'quality_metric_fastqc', 'evidence_dis_pheno', 'evidence_gene_disorder',
    'quality_metric_bamcheck', 'quality_metric_qclist', 'quality_metric_wgs_bamqc',
    'quality_metric_cmphet', 'quality_metric_vcfcheck', 'quality_metric_workflowrun',
    'quality_metric_vcfqc', 'quality_metric_bamqc',
    'software', 'static_section', 'tracking_item', 'workflow_mapping',
    'workflow_run_awsem', 'workflow_run', 'annotation_field', 'variant_sample',
    'variant', 'gene_annotation_field', 'gene',
]


class MockedLogger(object):

    def info(self, msg):
        print('INFO: ' + msg)

    def warn(self, msg):
        print('WARNING: ' + msg)

    def error(self, msg):
        print('ERROR: ' + msg)


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
        'title': 'ENCODE Project'
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


# ADD SAMPLES FOR FAMILY MEMBERS
@pytest.fixture
def female_individual_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAGRANDMA",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_001",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def grandpa_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAGRANDPA",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_002",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def mother_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAMOTHER1",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_003",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def father_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAFATHER1",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_004",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def uncle_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAUNCLE01",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_005",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def child_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAPROBAND",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_006",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def cousin_sample(testapp, project, institution):
    item = {
        "accession": "GAPSACOUSIN1",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_007",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def sister_sample(testapp, project, institution):
    item = {
        "accession": "GAPSAHALFSIS",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_008",
        "status": "released"
    }
    return testapp.post_json('/sample', item).json['@graph'][0]


@pytest.fixture
def brother_sample(testapp, project, institution):
    item = {
        "accession": "GAPSABROTHER",
        'project': project['@id'],
        'institution': institution['@id'],
        "bam_sample_id": "ext_id_009",
        "status": "released"
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
        "status": "released"
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
        "status": "released"
    }
    return testapp.post_json('/individual', item).json['@graph'][0]


@pytest.fixture
def mother(testapp, project, institution, grandpa, female_individual, mother_sample):
    item = {
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
def fam(testapp, project, female_individual, institution, grandpa, mother, father, uncle,
        child, cousin, sister, brother):
    item = {
        "project": project['@id'],
        "institution": institution['@id'],
        "title": "Smith family",
        "proband": child['@id'],
        "members": [
            child['@id'],
            sister['@id'],
            brother['@id'],
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
def file_vcf(testapp, institution, project, file_formats):
    item = {
        'file_format': file_formats.get('vcf_gz').get('@id'),
        'md5sum': 'd41d8cd9f00b204e9800998ecf84211',
        'institution': institution['@id'],
        'project': project['@id'],
        'status': 'uploaded',  # avoid s3 upload codepath
    }
    return testapp.post_json('/file_processed', item).json['@graph'][0]


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


@pytest.fixture
def rel_disorders():
    return [
        {
            'disorder_id': 'MONDO:0400005',
            'status': 'released',
            'disorder_name': 'refeeding syndrome',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0400005',
        },
        {
            'disorder_id': 'MONDO:0400004',
            'status': 'released',
            'disorder_name': 'phrynoderma',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0400004',
        },
        {
            'disorder_id': 'MONDO:0300000',
            'status': 'released',
            'disorder_name': 'SSR3-CDG',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0300000',
        },
        {
            'disorder_id': 'MONDO:0200000',
            'status': 'released',
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
            'status': 'released',
            'phenotype_name': 'growth abnormality',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_00001507',
            'is_slim_for': 'Phenotype abnormality'
        },
        {
            'hpo_id': 'HP:0040064',
            'status': 'released',
            'phenotype_name': 'Abnormality of limbs',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_0040064',
            'is_slim_for': 'Phenotype abnormality'
        },
        {
            'hpo_id': 'HP:3000008',
            'status': 'released',
            'phenotype_name': 'Abnormality of mylohyoid muscle',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_3000008'
        },
        {
            'hpo_id': 'HP:0010708',
            'status': 'released',
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
