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
    'Family',
    'User',
    'Workflow',
    'WorkflowMapping',
    'WorkflowRun',
    'WorkflowRunAwsem',
    'VariantConsequence',
    'Disorder',
    'FileFormat',
    'FileFastq',
    'FileProcessed',
    'FileReference',
    'Image',
    'Gene',
    'Phenotype',
    'Disorder',
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
    'EvidenceDisPheno',
    'Page'
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
#   ENV_WEBPROD2,
]


BEANSTALK_TEST_ENVS = [
    ENV_HOTSEAT,
    ENV_MASTERTEST,
    ENV_WEBDEV,
    ENV_WOLF,
]


def get_my_env(app):
    """
    Gets the env name of the currently running environment

    :param app: handle to Pyramid app
    :return: current env
    """
    # Return value is presumably one of the above-declared environments
    return app.registry.settings.get('env.name')


def get_deployment_config(app):
    """
    Gets deployment configuration for the current environment.

    Sets ENV_NAME and WIPE_ES as side-effects.

    :param app: handle to Pyramid app
    :return: dict of config options
    """
    deploy_cfg = {}
    current_prod_env = ENV_WEBPROD  # this could change for CGAP depending on how we do this in the future
    my_env = get_my_env(app)
    deploy_cfg['ENV_NAME'] = my_env
    if current_prod_env == my_env:
        log.info('This looks like our production environment -- do not wipe ES')
        deploy_cfg['WIPE_ES'] = False
    elif my_env in BEANSTALK_PROD_ENVS:  # unused in CGAP but could be used in future
        log.info('This looks like our staging environment -- do not wipe ES')
        deploy_cfg['WIPE_ES'] = False  # do not wipe ES
    elif my_env in NEW_BEANSTALK_PROD_ENVS:
        log.info('This looks like a new production environment -- do nothing for now')
        exit(0)
    elif my_env in BEANSTALK_TEST_ENVS:
        if my_env == ENV_HOTSEAT:
            log.info('Looks like we are on hotseat -- do not wipe ES')
            deploy_cfg['WIPE_ES'] = False
        else:
            log.info('Looks like we are on webdev or mastertest -- wipe ES')
            deploy_cfg['WIPE_ES'] = True
    else:
        log.warning('This environment is not recognized: %s' % my_env)
        log.warning('Proceeding without wiping ES')
        deploy_cfg['WIPE_ES'] = False
    return deploy_cfg


def _run_create_mapping(app, args):
    """
    Runs create_mapping with deploy options and report errors. Allows args passed from argparse in main to override
    the default deployment configuration

    :param app: pyramid application handle
    :param args: args from argparse
    :return: None
    """
    try:
        deploy_cfg = get_deployment_config(app)
        log.info('Running create mapping on env: %s' % deploy_cfg['ENV_NAME'])
        if args.wipe_es:  # override deploy_cfg WIPE_ES option
            log.info('Overriding deploy_cfg and wiping ES')
            deploy_cfg['WIPE_ES'] = True
        run_create_mapping(app, check_first=(not deploy_cfg['WIPE_ES']), purge_queue=args.clear_queue, item_order=ITEM_INDEX_ORDER)
    except Exception as e:
        log.error("Exception encountered while gathering deployment information or running create_mapping")
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
    parser.add_argument('--clear-queue', help="Specify to clear the SQS queue", action='store_true', default=False)

    args = parser.parse_args()
    app = get_app(args.config_uri, args.app_name)
    # Loading app will have configured from config file. Reconfigure here:
    set_logging(in_prod=app.registry.settings.get('production'), log_name=__name__, level=logging.DEBUG)
    # set_logging(app.registry.settings.get('elasticsearch.server'), app.registry.settings.get('production'), level=logging.DEBUG)

    _run_create_mapping(app, args)
    exit(0)


if __name__ == '__main__':
    main()
