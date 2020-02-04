import argparse
import structlog
import logging

from pyramid.paster import get_app
from snovault.elasticsearch.create_mapping import run as run_create_mapping
from dcicutils.log_utils import set_logging
from dcicutils.beanstalk_utils import whodaman

log = structlog.getLogger(__name__)
EPILOG = __doc__

# This order determines order that items will be mapped + added to the queue
# Can use item type (e.g. file_fastq) or class name (e.g. FileFastq)
# XXX: This order is probably not right
ITEM_INDEX_ORDER = [
    'Project',
    'Institution',
    'AccessKey',
    'Cohort',
    'User',
    'Workflow',
    'WorkflowMapping',
    'WorkflowRun',
    'WorkflowRunAwsem',
    'VariantClassifier',
    'Disorder',
    'FileFormat',
    'FileFastq',
    'FileProcessed',
    'FileReference',
    'Image',
    'Gene',
    'Phenotype',
    'Individual',
    'Document',
    'QualityMetricBamcheck',
    'QualityMetricFastqc',
    'QualityMetricQclist',
    'QualityMetricWgsBamqc',
    'QualityMetricWorkflowrun',
    'QualityMetricVcfcheck',
    'TrackingItem',
    'Software',
    'Sample',
    'SampleProcessing',
    'StaticSection',
    'Document',
    'Page'
]

ENV_PROD = 'fourfront-cgap'
ENV_DEV = 'fourfront-cgapdev'
ENV_TEST = 'fourfront-cgaptest'
ENV_WOLF = 'fourfront-cgapwolf'

BEANSTALK_PROD_ENVS = [
    ENV_PROD,
]

BEANSTALK_TEST_ENVS = [
    ENV_DEV,
    ENV_TEST,
    ENV_WOLF,
]


def get_my_env(app):
    """
    Gets the env name of the currently running environment

    :param app: handle to Pyramid app
    :return: current env, one of the above
    """
    return app.registry.settings.get('env.name')


def get_deployment_config(app):
    """
    Gets deployment configuration based on what env we are on. Right now we wipe ES on all except
    CGAP prod

    :param app: handle to Pyramid app
    :return: dict of config options
    """
    deploy_cfg = {}
    current_prod_env = ENV_PROD  # this could change depending on how we do this in the future
    my_env = get_my_env(app)
    deploy_cfg['ENV_NAME'] = my_env
    if current_prod_env == my_env:
        log.info('This looks like our production environment -- do not wipe ES')
        deploy_cfg['WIPE_ES'] = False
    elif my_env in BEANSTALK_PROD_ENVS:  # unused but could be used in future
        log.info('This looks like our staging environment -- do not wipe ES')
        deploy_cfg['WIPE_ES'] = False
    elif my_env in BEANSTALK_TEST_ENVS:
        log.info('This looks like a test environment -- WIPE ES')
        deploy_cfg['WIPE_ES'] = True
    else:
        log.warning('This environment is not recognized: %s' % my_env)
        log.warning('Proceeding without wiping ES')
        deploy_cfg['WIPE_ES'] = False
    return deploy_cfg


def _run_create_mapping(app, args):
    """
    Runs create mapping with arguments based on args or deployment config based on env

    :param app: handle to Pyramid app
    :param args: args from Argparse in main
    :return: None
    """
    try:
        deploy_cfg = get_deployment_config(app)
        if args.wipe_es:  # override deploy_cfg WIPE_ES option
            log.info('Overriding deploy_cfg and wiping ES')
            deploy_cfg['WIPE_ES'] = True
        if deploy_cfg['WIPE_ES']:
            run_create_mapping(app, check_first=False, item_order=ITEM_INDEX_ORDER)
        else:
            run_create_mapping(app, check_first=True, item_order=ITEM_INDEX_ORDER)
    except Exception as e:
        log.error('Exception encountered while gathering deployment information or running create_mapping')
        log.error(str(e))
        exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Create Elasticsearch mapping on deployment", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('config_uri', help="path to configfile")
    parser.add_argument('--app-name', help="Pyramid app name in configfile")
    parser.add_argument('--wipe-es', help="Specify to wipe ES", action='store_true', default=False)

    args = parser.parse_args()
    app = get_app(args.config_uri, args.app_name)
    # Loading app will have configured from config file. Reconfigure here:
    set_logging(in_prod=app.registry.settings.get('production'), log_name=__name__, level=logging.DEBUG)
    # set_logging(app.registry.settings.get('elasticsearch.server'), app.registry.settings.get('production'), level=logging.DEBUG)

    _run_create_mapping(app, args)
