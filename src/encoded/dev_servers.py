"""\
Examples
For the development.ini you must supply the paster app name:

    %(prog)s development.ini --app-name app --init --clear

"""

import argparse
import atexit
import logging
import os.path
import select
import shutil
import subprocess
import sys

from pkg_resources import resource_filename
from pyramid.paster import get_app, get_appsettings
from pyramid.path import DottedNameResolver
from snovault.elasticsearch import create_mapping
from snovault.tests import elasticsearch_fixture, postgresql_fixture


EPILOG = __doc__

logger = logging.getLogger(__name__)


def nginx_server_process(prefix='', echo=False):
    args = [
        os.path.join(prefix, 'nginx'),
        '-c', resource_filename('encoded', 'nginx-dev.conf'),
        '-g', 'daemon off;'
    ]
    process = subprocess.Popen(
        args,
        close_fds=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    if not echo:
        process.stdout.close()

    if echo:
        print('Started: http://localhost:8000')

    return process


def ingestion_listener_compute_command(config_uri, app_name):
    return [
        'poetry', 'run', 'ingestion-listener', config_uri, '--app-name', app_name
    ]


def ingestion_listener_process(config_uri, app_name, echo=True):
    """ Uses Popen to start up the ingestion-listener. """
    args = ingestion_listener_compute_command(config_uri, app_name)

    process = subprocess.Popen(
        args,
        close_fds=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    if echo:
        print('Starting Ingestion Listener...')

    return process


def main():
    parser = argparse.ArgumentParser(
        description="Run development servers", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--app-name', help="Pyramid app name in configfile")
    parser.add_argument('config_uri', help="path to configfile")
    parser.add_argument('--clear', action="store_true", help="Clear existing data")
    parser.add_argument('--init', action="store_true", help="Init database")
    parser.add_argument('--load', action="store_true", help="Load test set")
    parser.add_argument('--datadir', default='/tmp/snovault', help="path to datadir")
    parser.add_argument('--no_ingest', action="store_true", default=False, help="Don't start the ingestion process.")
    parser.add_argument('--ingest_only', action="store_true", default=False, help="Only start the ingestion engine.")
    args = parser.parse_args()

    run(app_name=args.app_name, config_uri=args.config_uri, datadir=args.datadir,
        clear=args.clear, init=args.init, load=args.load, no_ingest=args.no_ingest, ingest_only=args.ingest_only)

def run(app_name, config_uri, datadir, clear=False, init=False, load=False, no_ingest=False, ingest_only=False):

    if ingest_only:
        clear = False
        init = False
        load = False

    logging.basicConfig(format='')
    # Loading app will have configured from config file. Reconfigure here:
    logging.getLogger('encoded').setLevel(logging.INFO)

    # get the config and see if we want to connect to non-local servers
    # TODO: This variable seems to not get used? -kmp 25-Jul-2020
    config = get_appsettings(config_uri, app_name)

    datadir = os.path.abspath(datadir)
    pgdata = os.path.join(datadir, 'pgdata')
    esdata = os.path.join(datadir, 'esdata')
    ### comment out from HERE...
    if clear:
        for dirname in [pgdata, esdata]:
            if os.path.exists(dirname):
                shutil.rmtree(dirname)
    if init:
        postgresql_fixture.initdb(pgdata, echo=True)
    ### ... to HERE to disable recreation of test db
    ### may have to `rm /tmp/snovault/pgdata/postmaster.pid`

    if ingest_only:
        print("Do this instead: ",
              "SNOVAULT_DB_TEST_PORT=" + os.environ["SNOVAULT_DB_TEST_PORT"],
              " ".join(ingestion_listener_compute_command(config_uri, app_name)))
        return

    processes = []
    if not ingest_only:
        postgres = postgresql_fixture.server_process(pgdata, echo=True)
        processes.append(postgres)
        elasticsearch = elasticsearch_fixture.server_process(esdata, echo=True)
        processes.append(elasticsearch)
        nginx = nginx_server_process(echo=True)
        processes.append(nginx)
    if not no_ingest:
        ingestion_listener = ingestion_listener_process(config_uri, app_name)
        processes.append(ingestion_listener)

    @atexit.register
    def cleanup_process():
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                for line in process.stdout:
                    sys.stdout.write(line.decode('utf-8'))
            except IOError:
                pass
            process.wait()

    if init:
        app = get_app(config_uri, app_name)
    else:
        app = None


    # clear queues and initialize indices before loading data. No indexing yet.
    # this is needed for items with properties stored in ES
    if init:
        create_mapping.run(app, skip_indexing=True, purge_queue=False)

    if init and load:
        load_test_data = app.registry.settings.get('load_test_data')
        load_test_data = DottedNameResolver().resolve(load_test_data)
        load_res = load_test_data(app)
        if load_res:  # None if successful
            raise(load_res)

        # now clear the queues and queue items for indexing
        create_mapping.run(app, check_first=True, strict=True, purge_queue=False)

    print('Started. ^C to exit.')

    stdouts = [p.stdout for p in processes]

    # Ugly should probably use threads instead
    while True:
        readable, writable, err = select.select(stdouts, [], stdouts, 5)
        for stdout in readable:
            for line in iter(stdout.readline, b''):
                sys.stdout.write(line.decode('utf-8'))
        if err:
            for stdout in err:
                for line in iter(stdout.readline, b''):
                    sys.stdout.write(line.decode('utf-8'))
            break

if __name__ == '__main__':
    main()
