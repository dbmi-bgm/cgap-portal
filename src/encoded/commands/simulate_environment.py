import logging
import os
import argparse
import structlog
from contextlib import contextmanager
from dcicutils.env_utils import is_stg_or_prd_env
from dcicutils.beanstalk_utils import get_beanstalk_environment_variables
from deploy.generate_production_ini import CGAPDeployer


logger = structlog.getLogger(__name__)
EPILOG = __doc__


@contextmanager
def secure_environ(env):
    """ Adds the given env to os.environ, restoring original state when yielding back. """
    original_env = os.environ.copy()
    os.environ.update(env)
    yield
    os.environ = original_env


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
    if is_stg_or_prd_env(args.environment) and not args.prod:
        logger.error('Specified CGAP production without prod argument!')
        exit(1)

    # get env, invoke deployer
    beanstalk_env = get_beanstalk_environment_variables(args.environment)
    with secure_environ(beanstalk_env):
        CGAPDeployer.main()
    logger.info('Successfully wrote production.ini')
    exit(0)


if __name__ == '__main__':
    main()
