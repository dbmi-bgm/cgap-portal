# This key is best interpreted not as the 'snovault version' but rather the 'version of the app built on snovault'.
# As such, it should be left this way, even though it may appear redundant with the 'eb_app_version' registry key
# that we also have, which tries to be the value eb uses. -kmp 28-Apr-2020
APP_VERSION_REGISTRY_KEY = 'snovault.app_version'

# This order determines order that items will be mapped + added to the queue
# Can use item type (e.g. file_fastq) or class name (e.g. FileFastq)
# XXX: This order is probably not right
ITEM_INDEX_ORDER = [
    'Project',
    'Institution',
    'AccessKey',
    'Cohort',
    'Family',
    'FilterSet',
    'Nexus',
    'User',
    'Workflow',
    'WorkflowMapping',
    'WorkflowRun',
    'WorkflowRunAwsem',
    'MetaWorkflow',
    'MetaWorkflowRun',
    'VariantConsequence',
    'FileFormat',
    'FileFastq',
    'FileProcessed',
    'FileReference',
    'FileSubmitted',
    'Image',
    'NoteTechnicalReview',
    'NoteInterpretation',
    'NoteDiscovery',
    'NoteStandard',
    'Gene',
    'GeneList',
    'Phenotype',
    'Disorder',
    'Individual',
    'Case',
    'Report',
    'Document',
    'QualityMetricBamcheck',
    'QualityMetricFastqc',
    'QualityMetricQclist',
    'QualityMetricWgsBamqc',
    'QualityMetricBamqc',
    'QualityMetricCmphet',
    'QualityMetricWorkflowrun',
    'QualityMetricVcfcheck',
    'QualityMetricVcfqc',
    'QualityMetricPeddyqc',
    'TrackingItem',
    'Software',
    'Sample',
    'SampleProcessing',
    'StaticSection',
    'Page',
    'AnnotationField',
    'Variant',
    'StructuralVariant',
    'VariantSampleList',
    'VariantSample',
    'StructuralVariantSample',
    'EvidenceDisPheno',
    'Page',
    'GeneAnnotationField',
    'HiglassViewConfig',
    'IngestionSubmission',
]

ENV_HOTSEAT = 'fourfront-cgaphot'
ENV_MASTERTEST = 'fourfront-cgaptest'
ENV_PRODUCTION_BLUE = 'fourfront-cgapblue'
ENV_PRODUCTION_GREEN = 'fourfront-cgapgreen'
ENV_STAGING = 'fourfront-cgapstaging'
ENV_WEBDEV = 'fourfront-cgapdev'
ENV_WEBPROD = 'fourfront-cgap'
# ENV_WEBPROD2 doesn't have meaning in old CGAP naming. See ENV_STAGING.
ENV_WOLF = 'fourfront-cgapwolf'

NEW_BEANSTALK_PROD_ENVS = [
    ENV_PRODUCTION_BLUE,
    ENV_PRODUCTION_GREEN,
    ENV_STAGING,
]

BEANSTALK_PROD_ENVS = [
    ENV_WEBPROD,
    # ENV_WEBPROD2,
]

BEANSTALK_TEST_ENVS = [
    ENV_HOTSEAT,
    ENV_MASTERTEST,
    ENV_WEBDEV,
    ENV_WOLF,
]
