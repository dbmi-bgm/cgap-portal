import logging
import argparse
import structlog
from dcicutils.qa_utils import override_environ
from dcicutils.env_utils import is_stg_or_prd_env
from dcicutils.beanstalk_utils import get_beanstalk_environment_variables
from deploy.generate_production_ini import ProductionIniFileManager


logger = structlog.getLogger(__name__)
EPILOG = __doc__


def build_ini_file(environment, use_prod):
    """ Wrapper method for main functionality that can be invoked directly by others.

        :param environment: environment to simulate
        :param use_prod: an extra value that must be true to simulate staging/production
        :returns: True if successful, False otherwise
    """
    if is_stg_or_prd_env(environment) and not use_prod:
        raise Exception('Tried to run on production env %s without prod identifier!' % environment)
    beanstalk_env = get_beanstalk_environment_variables(environment)
    template_file_name = ProductionIniFileManager.environment_template_filename(environment)
    with override_environ(**beanstalk_env):
        ProductionIniFileManager.build_ini_file_from_template(template_file_name, 'production.ini')
    return True


def main():
    """ Entry point for this command """
    logging.basicConfig()

    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is specified wrong here.
        description='Simulates an environment, checking that the caller has permission',
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('environment', help='environment to simulate')
    parser.add_argument('--prod', help='Must be specified to run this on CGAP production', default=False)
    args = parser.parse_args()
    build_ini_file(args.environment, args.prod)
    logger.info('Successfully wrote production.ini')
    exit(0)


if __name__ == '__main__':
    main()
