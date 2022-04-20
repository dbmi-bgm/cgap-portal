import argparse
import logging
import structlog

from dcicutils.env_utils import permit_load_data
from pyramid.paster import get_app
from pyramid.path import DottedNameResolver


log = structlog.getLogger(__name__)


EPILOG = __doc__


def load_data_should_proceed(env, allow_prod):
    """ Returns True on whether or not load_data should proceed.

    :param env: env we are on
    :param allow_prod: prod argument from argparse, defaults to False
    :return: True if load_data should continue, False otherwise
    """

    return permit_load_data(envname=env, allow_prod=allow_prod, orchestrated_app='cgap')


def main(simulated_args=None):
    logging.basicConfig()
    # Loading app will have configured from config file. Reconfigure here:
    logging.getLogger('encoded').setLevel(logging.DEBUG)

    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is specified wrong here.
        description="Load Test Data", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--app-name', help="Pyramid app name in configfile")
    parser.add_argument('config_uri', help="path to configfile")
    parser.add_argument('--prod', action='store_true',
                        help="must be set to confirm this action is intended to happen on a production server")
    parser.add_argument('--overwrite', action='store_true',
                        help="must be set to update existing uuids with patch")
    parser.add_argument('--indir', help="directory to load items from")
    parser.add_argument('--itype', help="item type to load")
    args = parser.parse_args(simulated_args)

    # get the pyramids app
    app = get_app(args.config_uri, args.app_name)

    env = app.registry.settings.get('env.name', '')

    allow_prod = args.prod
    load_data_by_type = DottedNameResolver().resolve("encoded.loadxl:load_data_by_type")

    if load_data_should_proceed(env, allow_prod):
        load_data_by_type(app, args.indir, args.overwrite, args.itype)


if __name__ == "__main__":
    main()
