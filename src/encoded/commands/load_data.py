import argparse
import logging
import structlog

from dcicutils.env_utils import CGAP_ENV_MASTERTEST
from pyramid.paster import get_app
from pyramid.path import DottedNameResolver
from .. import configure_dbsession


log = structlog.getLogger(__name__)


EPILOG = __doc__


def main():
    logging.basicConfig()
    # Loading app will have configured from config file. Reconfigure here:
    logging.getLogger('encoded').setLevel(logging.DEBUG)

    parser = argparse.ArgumentParser(
        description="Load Test Data", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--app-name', help="Pyramid app name in configfile")
    parser.add_argument('config_uri', help="path to configfile")
    parser.add_argument('--prod', action='store_true',
                        help="must be set to confirm this action is intended to happen on a production server")
    parser.add_argument('--overwrite', action='store_true',
                        help="must be set to update existing uuids with patch")
    args = parser.parse_args()

    # get the pyramids app
    app = get_app(args.config_uri, args.app_name)

    # create db schema
    configure_dbsession(app)

    env = app.registry.settings.get('env.name', '')

    load_test_data = app.registry.settings.get('load_test_data')
    log.info("load_data: load_test_data function is %s" % (load_test_data))
    load_test_data = DottedNameResolver().resolve(load_test_data)

    # run on cgaptest -- this logic should probably be refactored into dcicutils
    if env == CGAP_ENV_MASTERTEST:
        log.info('load_data: proceeding since we are on cgaptest')
        load_test_data(app, args.overwrite)
    elif env and not args.prod:  # old logic, allow run on servers if prod is specified
        log.info('load_data: skipping, since on %s' % env)
    else:  # allow run on local, which will not have env set
        log.info('load_data: proceeding since we are either on local or specified the prod option')
        load_test_data(app, args.overwrite)
    exit(0)

if __name__ == "__main__":
    main()
