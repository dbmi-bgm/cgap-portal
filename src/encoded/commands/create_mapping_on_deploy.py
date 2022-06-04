import argparse
import structlog
import logging

from pyramid.paster import get_app
from snovault.elasticsearch.create_mapping import run as run_create_mapping
from dcicutils.log_utils import set_logging
from ..appdefs import (
    ITEM_INDEX_ORDER, ENV_HOTSEAT, ENV_WEBDEV, ENV_WEBPROD,
    BEANSTALK_TEST_ENVS, BEANSTALK_PROD_ENVS, NEW_BEANSTALK_PROD_ENVS,
)

log = structlog.getLogger(__name__)
EPILOG = __doc__


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
        if my_env == ENV_HOTSEAT or my_env == ENV_WEBDEV:
            log.info('Looks like we are on hotseat/cgapdev -- do not wipe ES')
            deploy_cfg['WIPE_ES'] = False
        else:
            # XXX: enable to force cgaptest reindexing
            log.info('Looks like we are on cgaptest -- normally we would wipe ES but no longer.')
            deploy_cfg['WIPE_ES'] = False
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
        run_create_mapping(app, check_first=(not deploy_cfg['WIPE_ES']), purge_queue=args.clear_queue,
                           item_order=ITEM_INDEX_ORDER)
    except Exception as e:
        log.error("Exception encountered while gathering deployment information or running create_mapping")
        log.error(str(e))
        exit(1)


def main():
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
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
    # set_logging(app.registry.settings.get('elasticsearch.server'), app.registry.settings.get('production'),
    #             level=logging.DEBUG)

    _run_create_mapping(app, args)
    exit(0)


if __name__ == '__main__':
    main()
