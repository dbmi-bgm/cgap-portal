import logging
import os
import argparse
import structlog
from contextlib import contextmanager
from dcicutils.env_utils import is_stg_or_prd_env
from dcicutils.beanstalk_utils import get_beanstalk_environment_variables
from deploy.generate_production_ini import CGAPIniFileManager


logger = structlog.getLogger(__name__)
EPILOG = __doc__


@contextmanager
def secure_environ(env):
    """ Adds the given env to os.environ, restoring original state when yielding back. """
    original_env = os.environ.copy()
    os.environ.update(env)
    yield
    os.environ = original_env


def build_ini_file(environment, use_prod):
    """ Wrapper method for main functionality that can be invoked directly by others. """
    if is_stg_or_prd_env(environment) and not use_prod:
        return False
    beanstalk_env = get_beanstalk_environment_variables(environment)
    template_file_name = CGAPIniFileManager.environment_template_filename(environment)
    with secure_environ(beanstalk_env):
        CGAPIniFileManager.build_ini_file_from_template(template_file_name, 'production.ini')
    return True


def main():
    """ Entry point for this command """
    logging.basicConfig()

    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is specified wrong here.
        description='Clear an item type out of metadata storage',
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('environment', help='environment to simulate')
    parser.add_argument('--prod', help='Must be specified to run this on CGAP production', default=False)
    args = parser.parse_args()

    # check prod
    if not build_ini_file(args.environment, args.prod):
        logger.info('Failed to build production.ini')
        exit(1)

    logger.info('Successfully wrote production.ini')
    exit(0)


if __name__ == '__main__':
    main()
