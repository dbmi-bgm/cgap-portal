import pytest
import copy

from uuid import uuid4


ORDER = [
    'user', 'project', 'institution', 'file_format', 'variant_consequence', 'cohort', 'individual',
    'sample', 'workflow', 'access_key', 'disorder', 'document', 'file_fastq',
    'file_processed', 'file_reference', 'gene', 'sample_processing',
    'page', 'phenotype', 'quality_metric_fastqc',
    'quality_metric_bamcheck', 'quality_metric_qclist', 'quality_metric_wgs_bamqc',
    'quality_metric_vcfcheck', 'quality_metric_workflowrun', 'software', 'static_section',
    'tracking_item', 'workflow_mapping', 'workflow_run_awsem',
    'workflow_run'
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
def human_individual(testapp, project, institution, human):
    item = {
        "accession": "4DNINOOOAAQ1",
        "age": 53,
        "age_units": "year",
        'project': project['@id'],
        'institution': institution['@id'],
        'organism': human['@id'],
        "ethnicity": "Caucasian",
        "health_status": "unknown",
        "life_stage": "adult",
        "sex": "female",
        "status": "released",
        "url": "http://ccr.coriell.org/Sections/BrowseCatalog/FamilyTypeSubDetail.aspx?PgId=402&fam=1463&coll=GM",
        # "uuid": "44d24e3f-bc5b-469a-8500-7ebd728f8ed5"
    }
    return testapp.post_json('/individual_human', item).json['@graph'][0]


@pytest.fixture
def worthington_biochemical(testapp, project, institution):
    item = {
        "title": "Worthington Biochemical",
        "name": "worthington-biochemical",
        "description": "",
        "url": "http://www.worthington-biochem.com",
        'project': project['@id'],
        'institution': institution['@id'],
        'status': 'current'
    }
    return testapp.post_json('/vendor', item).json['@graph'][0]


@pytest.fixture
def mboI(testapp, worthington_biochemical, institution, project):
    item = {
        "name": "MboI",
        "enzyme_source": worthington_biochemical['@id'],
        'status': 'current',
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/enzyme', item).json['@graph'][0]


@pytest.fixture
def lung_biosource(testapp, institution, project, lung_oterm):
    item = {
        "biosource_type": "tissue",
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/biosource', item).json['@graph'][0]


@pytest.fixture
def biosample_cc_wo_diff(testapp, institution, project):
    item = {
        "culture_start_date": "2018-01-01",
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/biosample_cell_culture', item).json['@graph'][0]


@pytest.fixture
def tissue_biosample(testapp, lung_biosource, institution, project):
    item = {
        'description': "Tissue Biosample",
        'biosource': [lung_biosource['uuid']],
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/biosample', item).json['@graph'][0]


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
def F123_biosource(testapp, institution, project, f123_oterm):
    item = {
        "accession": "4DNSROOOAAQ2",
        "biosource_type": "stem cell",
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/biosource', item).json['@graph'][0]


@pytest.fixture
def GM12878_biosource(testapp, institution, project, gm12878_oterm):
    item = {
        "accession": "4DNSROOOAAQ1",
        "biosource_type": "immortalized cell line",
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/biosource', item).json['@graph'][0]


@pytest.fixture
def tier1_biosource(testapp, protocol, institution, project, gm12878_oterm):
    item = {
        'description': 'Tier 1 cell line Biosource',
        'biosource_type': 'immortalized cell line',
        'SOP_cell_line': protocol['@id'],
        'cell_line_tier': 'Tier 1',
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/biosource', item).json['@graph'][0]


@pytest.fixture
def human_biosource(testapp, human_individual, worthington_biochemical, gm12878_oterm, institution, project):
    item = {
        "description": "GM12878 cells",
        "biosource_type": "immortalized cell line",
        "individual": human_individual['@id'],
        "biosource_vendor": worthington_biochemical['@id'],
        "status": "current",
        'project': project['@id'],
        'institution': institution['@id']
    }
    return testapp.post_json('/biosource', item).json['@graph'][0]


@pytest.fixture
def human_data():
    return {
        'uuid': '7745b647-ff15-4ff3-9ced-b897d4e2983c',
        'name': 'human',
        'scientific_name': 'Homo sapiens',
        'taxon_id': '9606',
        'genome_assembly': 'GRCh38'
    }


@pytest.fixture
def human(testapp, human_data):
    return testapp.post_json('/organism', human_data).json['@graph'][0]


@pytest.fixture
def mouse(testapp):
    item = {
        'uuid': '3413218c-3d86-498b-a0a2-9a406638e786',
        'name': 'mouse',
        'scientific_name': 'Mus musculus',
        'taxon_id': '10090',
        'genome_assembly': 'GRCm38'
    }
    return testapp.post_json('/organism', item).json['@graph'][0]


@pytest.fixture
def organism(human):
    return human


@pytest.fixture
def experiment_set(testapp, institution, project):
    item = {
        'institution': institution['@id'],
        'project': project['@id'],
        'experimentset_type': 'replicates',
        'status': 'in review'
    }
    return testapp.post_json('/experiment_set', item).json['@graph'][0]


# fixtures for testing calculated experiment_sets property in experiment_set
# and also for _update method of experiment_set_replicate (and experiment_set)
@pytest.fixture
def experiment(testapp, experiment_data):
    return testapp.post_json('/experiment_hi_c', experiment_data).json['@graph'][0]


@pytest.fixture
def experiment_data(institution, project, human_biosample, mboI, exp_types):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'biosample': human_biosample['@id'],
        'experiment_type': exp_types['hic']['@id'],
        'digestion_enzyme': mboI['@id'],
        'status': 'in review'
    }


@pytest.fixture
def exp_types(testapp, institution, project):
    experiment_types = {}
    title_dict = {
        'hic': ('in situ Hi-C', ["ExperimentHiC"]),
        'microc': ('Micro-C', ["ExperimentHiC"]),
        'capc': ('Capture Hi-C', ["ExperimentCaptureC"]),
        'rnaseq': ('RNA-seq', ["ExperimentSeq"]),
        'fish': ('DNA FISH', ["ExperimentMic"]),
        'dnase': ('DNase Hi-C', ["ExperimentHiC"]),
        'dam': ('DamID-seq', ["ExperimentDamid"]),
        'chia': ('ChIA-PET', ["ExperimentChiapet"]),
        'repliseq': ('2-stage Repli-seq', ["ExperimentRepliseq"]),
        'multi': ('Multi-stage Repli-seq', ["ExperimentRepliseq"]),
        'chipseq': ('ChIP-seq', ["ExperimentSeq"]),
        'dilution': ('Dilution Hi-C', ["ExperimentHiC"]),
        'atacseq': ('ATAC-seq', ["ExperimentAtacseq"]),
        'tsaseq': ('TSA-seq', ["ExperimentTsaseq"])
    }
    for k, v in title_dict.items():
        data = {
            'uuid': str(uuid4()),
            'title': v[0],
            'institution': institution['@id'],
            'project': project['@id'],
            'status': 'released',
            'valid_item_types': v[1]
        }
        experiment_types[k] = testapp.post_json('/experiment_type', data, status=201).json['@graph'][0]
    return experiment_types


@pytest.fixture
def experiment_project_release(testapp, institution, project, human_biosample, exp_types):
    item = {
        'institution': institution['@id'],
        'project': project['@id'],
        'biosample': human_biosample['@id'],
        'experiment_type': exp_types['microc']['@id'],
        'status': 'released to project'
    }
    return testapp.post_json('/experiment_hi_c', item).json['@graph'][0]


@pytest.fixture
def base_experiment(testapp, experiment_data):
    return testapp.post_json('/experiment_hi_c', experiment_data).json['@graph'][0]


@pytest.fixture
def experiments(testapp, experiment_data):
    expts = []
    for i in range(4):
        experiment_data['description'] = 'Experiment ' + str(i)
        expts.append(testapp.post_json('/experiment_hi_c', experiment_data).json['@graph'][0])
    return expts


@pytest.fixture
def rep_set_data(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'description': 'Test replicate set',
    }


@pytest.fixture
def empty_replicate_set(testapp, rep_set_data):
    return testapp.post_json('/experiment_set_replicate', rep_set_data).json['@graph'][0]


@pytest.fixture
def two_experiment_replicate_set(testapp, rep_set_data, experiments):
    rep_set_data['description'] = 'Two one BioRep Experiment Replicate Set'
    rep_set_data['replicate_exps'] = [
        {'replicate_exp': experiments[0]['@id'],
         'bio_rep_no': 1,
         'tec_rep_no': 1},
        {'replicate_exp': experiments[1]['@id'],
         'bio_rep_no': 1,
         'tec_rep_no': 2}
    ]
    return testapp.post_json('/experiment_set_replicate', rep_set_data).json['@graph'][0]


@pytest.fixture
def file_formats(testapp, institution, project):
    formats = {}
    ef_format_info = {
        'pairs_px2': {'standard_file_extension': 'pairs.gz.px2',
                      "valid_item_types": ["FileProcessed"]},
        'pairsam_px2': {'standard_file_extension': 'sam.pairs.gz.px2',
                        "valid_item_types": ["FileProcessed"]},
        'bai': {'standard_file_extension': 'bam.bai',
                "valid_item_types": ["FileProcessed"]},
        'beddb': {"standard_file_extension": "beddb",
                  "valid_item_types": ["FileProcessed", "FileReference"]},
    }
    format_info = {
        'fastq': {'standard_file_extension': 'fastq.gz',
                  'other_allowed_extensions': ['fq.gz'],
                  "valid_item_types": ["FileFastq"]},
        'pairs': {'standard_file_extension': 'pairs.gz',
                  "extrafile_formats": ['pairs_px2', 'pairsam_px2'],
                  "valid_item_types": ["FileProcessed"]},
        'bam': {'standard_file_extension': 'bam',
                'extrafile_formats': ['bai'],
                "valid_item_types": ["FileProcessed"]},
        'mcool': {'standard_file_extension': 'mcool',
                  "valid_item_types": ["FileProcessed", "FileVistrack"]},
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
def rnai(testapp, institution, project):
    item = {
        'project': project['@id'],
        'institution': institution['@id'],
        'target_sequence': 'TATATGGGGAA',
        'rnai_type': 'shRNA',
    }
    return testapp.post_json('/treatment_rnai', item).json['@graph'][0]


@pytest.fixture
def construct(testapp, institution, project):
    item = {
        'name': 'Awesome_Construct',
        'construct_type': 'tagging construct',
        'protein_tags': ['eGFP, C-terminal'],
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/construct', item).json['@graph'][0]


@pytest.fixture
def publication(testapp, institution, project):
    item = {
        'uuid': '8312fc0c-b241-4cb2-9b01-1438910550ad',
        'project': project['@id'],
        'institution': institution['@id'],
        'ID': "PMID:22955616",
    }
    return testapp.post_json('/publication', item).json['@graph'][0]


@pytest.fixture
def publication_tracking(testapp, institution, project):
    item = {
        'uuid': '8312fc0c-b241-4cb2-9b01-1438910550ac',
        'project': project['@id'],
        'institution': institution['@id'],
        'PMID': "PMID:12345678",
    }
    return testapp.post_json('/publication_tracking', item).json['@graph'][0]


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
def workflow_run_sbg(testapp, institution, project, workflow_bam):
    item = {'run_platform': 'SBG',
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
    return testapp.post_json('/workflow_run_sbg', item).json['@graph'][0]


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
def human_biosample(testapp, human_biosource, institution, project):
    item = {
        "description": "GM12878 prepared for Hi-C",
        "biosource": [human_biosource['@id'], ],
        "status": "in review",
        'project': project['@id'],
        'institution': institution['@id']
        # "biosample_protocols": ["131106bc-8535-4448-903e-854af460b212"],
        # "modifications": ["431106bc-8535-4448-903e-854af460b254"],
        # "treatments": ["686b362f-4eb6-4a9c-8173-3ab267307e3b"]
    }
    return testapp.post_json('/biosample', item).json['@graph'][0]


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
def basic_genomic_region(testapp, institution, project):
    item = {
        "genome_assembly": "GRCh38",
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/genomic_region', item).json['@graph'][0]


@pytest.fixture
def genome_info(institution, project):
    return {
        "genome_assembly": "GRCh38",
        "chromosome": "X",
        "start_coordinate": 1,
        "end_coordinate": 3,
        'project': project['@id'],
        'institution': institution['@id']
    }


@pytest.fixture
def genomic_region_w_chrloc(testapp, genome_info):
    return testapp.post_json('/genomic_region', genome_info).json['@graph'][0]


@pytest.fixture
def genomic_region_2(testapp, genome_info):
    genome_info['chromosome'] = '9'
    genome_info['start_coordinate'] = 50
    genome_info['start_coordinate'] = 300
    return testapp.post_json('/genomic_region', genome_info).json['@graph'][0]


@pytest.fixture
def target_w_genes(testapp, institution, project):
    item = {
        "targeted_genes": ["eeny", "meeny"],
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/target', item).json['@graph'][0]


@pytest.fixture
def targ_w_alias(testapp, target_w_genes):
    return testapp.patch_json(target_w_genes['@id'], {'aliases': ['institution:test_targ']}, status=200).json['@graph'][0]


@pytest.fixture
def targ_gr_w_alias(testapp, target_w_region):
    return testapp.patch_json(target_w_region['@id'], {'aliases': ['institution:test_targ_gr']}, status=200).json['@graph'][0]


@pytest.fixture
def targ_agr_w_alias(testapp, another_target_w_region):
    return testapp.patch_json(another_target_w_region['@id'], {'aliases': ['institution:test_another_gr']}, status=200).json['@graph'][0]


@pytest.fixture
def gene_item(testapp, institution, project):
    return testapp.post_json('/gene', {'institution': institution['@id'], 'project': project['@id'], 'geneid': '5885'}).json['@graph'][0]


@pytest.fixture
def gene_bio_feature(testapp, institution, project, gene_term, gene_item):
    item = {'project': project['@id'],
            'institution': institution['@id'],
            'description': 'Test Gene BioFeature',
            'feature_type': gene_term['@id'],
            'relevant_genes': [gene_item['@id']]}
    return testapp.post_json('/bio_feature', item).json['@graph'][0]


@pytest.fixture
def prot_bio_feature(testapp, institution, project, protein_term, gene_item):
    item = {'project': project['@id'],
            'institution': institution['@id'],
            'description': 'Test Protein BioFeature',
            'feature_type': protein_term['@id'],
            'relevant_genes': [gene_item['@id']]}
    return testapp.post_json('/bio_feature', item).json['@graph'][0]


@pytest.fixture
def biofeat_w_alias(testapp, gene_bio_feature):
    return testapp.patch_json(gene_bio_feature['@id'], {'aliases': ['institution:test_targ_bf']}, status=200).json['@graph'][0]


@pytest.fixture
def gr_biofeat_w_alias(testapp, genomic_region_bio_feature):
    return testapp.patch_json(
        genomic_region_bio_feature['@id'], {'aliases': ['institution:test_targ_gr_bf']}, status=200).json['@graph'][0]


@pytest.fixture
def some_genomic_region(testapp, institution, project):
    item = {'project': project['@id'],
            'institution': institution['@id'],
            'genome_assembly': 'GRCh38',
            'chromosome': '1',
            'start_coordinate': 17,
            'end_coordinate': 544}
    return testapp.post_json('/genomic_region', item).json['@graph'][0]


@pytest.fixture
def vague_genomic_region(testapp, institution, project):
    item = {'project': project['@id'],
            'institution': institution['@id'],
            'genome_assembly': 'GRCm38',
            'chromosome': '5',
            'start_location': 'beginning',
            'end_location': 'centromere'}
    return testapp.post_json('/genomic_region', item).json['@graph'][0]


@pytest.fixture
def vague_genomic_region_w_desc(testapp, institution, project):
    item = {'project': project['@id'],
            'institution': institution['@id'],
            'genome_assembly': 'GRCm38',
            'chromosome': '5',
            'start_location': 'beginning',
            'end_location': 'centromere',
            'location_description': 'gene X enhancer'}
    return testapp.post_json('/genomic_region', item).json['@graph'][0]


@pytest.fixture
def basic_region_bio_feature(testapp, institution, project, region_term):
    item = {'project': project['@id'],
            'institution': institution['@id'],
            'description': 'Test Region BioFeature with minimal info',
            'feature_type': region_term['@id']}
    return testapp.post_json('/bio_feature', item).json['@graph'][0]


@pytest.fixture
def genomic_region_bio_feature(testapp, institution, project, region_term, some_genomic_region):
    item = {'project': project['@id'],
            'institution': institution['@id'],
            'description': 'Test Region BioFeature',
            'feature_type': region_term['@id'],
            'genome_location': [some_genomic_region['@id']]}
    return testapp.post_json('/bio_feature', item).json['@graph'][0]


@pytest.fixture
def target_w_region(testapp, genomic_region_w_chrloc, institution, project):
    item = {
        "targeted_genome_regions": [genomic_region_w_chrloc['@id']],
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/target', item).json['@graph'][0]


@pytest.fixture
def another_target_w_region(testapp, genomic_region_2, institution, project):
    item = {
        "targeted_genome_regions": [genomic_region_2['@id']],
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/target', item).json['@graph'][0]


@pytest.fixture
def target_w_desc(testapp, institution, project):
    item = {
        "description": "I'm a region",
        'project': project['@id'],
        'institution': institution['@id'],
    }
    return testapp.post_json('/target', item).json['@graph'][0]


@pytest.fixture
def mod_basic_info(institution, project):
    return {
        'institution': institution['@id'],
        'project': project['@id'],
        'description': 'minimal modification',
        'modification_type': 'Crispr',
    }


@pytest.fixture
def basic_modification(testapp, mod_basic_info):
    return testapp.post_json('/modification', mod_basic_info).json['@graph'][0]


@pytest.fixture
def mod_w_genomic_change(testapp, mod_basic_info):
    mod = copy.deepcopy(mod_basic_info)
    mod['description'] = 'mod with genomic change'
    mod['genomic_change'] = "deletion"
    return testapp.post_json('/modification', mod).json['@graph'][0]


@pytest.fixture
def mod_w_target(testapp, mod_basic_info, gene_bio_feature):
    mod = copy.deepcopy(mod_basic_info)
    mod['description'] = 'mod with target'
    mod['target_of_mod'] = [gene_bio_feature['@id']]
    return testapp.post_json('/modification', mod).json['@graph'][0]


@pytest.fixture
def mod_w_change_and_target(testapp, mod_basic_info, gene_bio_feature):
    mod = copy.deepcopy(mod_basic_info)
    mod['description'] = 'mod with target and genomic change'
    mod['target_of_mod'] = [gene_bio_feature['@id']]
    mod['genomic_change'] = "deletion"
    return testapp.post_json('/modification', mod).json['@graph'][0]


@pytest.fixture
def quality_metric_fastqc(testapp, project, institution):
    item = {
        "uuid": "ed80c2a5-ae55-459b-ba1d-7b0971ce2613",
        "project": project['@id'],
        "institution": institution['@id']
    }
    return testapp.post_json('/quality_metric_fastqc', item).json['@graph'][0]
