#!/usr/bin/env python3
import argparse
import logging
import logging.config
import os
import json
from datetime import datetime
from dcicutils import ff_utils

# '''logging setup
#    logging config - to be moved to file at some point
# '''
# date = datetime.now().strftime("%y-%m-%d-%H-%M-%S")
# logfile = 'load_items.log'
# logger = logging.getLogger(__name__)
# logging.config.dictConfig({
#     'version': 1,
#     'disable_existing_loggers': False,
#     'formatters': {
#         'standard': {
#             'format': '%(levelname)s:\t%(message)s'
#         },
#         'verbose': {
#             'format': '%(levelname)s:\t%(message)s\tFROM: %(name)s'
#         }
#     },
#     'handlers': {
#         'stdout': {
#             'level': 'INFO',
#             'formatter': 'verbose',
#             'class': 'logging.StreamHandler'
#         },
#         'logfile': {
#             'level': 'INFO',
#             'formatter': 'standard',
#             'class': 'logging.FileHandler',
#             'filename': logfile
#         }
#     },
#     'loggers': {
#         '': {
#             'handlers': ['stdout', 'logfile'],
#             'level': 'INFO',
#             'propagate': True
#         }
#     }
# })

EPILOG = __doc__


def get_logger(lname, logfile):
    """logging setup"""
    logger = logging.getLogger(lname)

    logging.config.dictConfig({
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'standard': {
                'format': '%(levelname)s:\t%(message)s'
            },
            'verbose': {
                'format': '%(levelname)s:\t%(message)s\tFROM: %(name)s'
            }
        },
        'handlers': {
            'stdout': {
                'level': 'WARN',
                'formatter': 'verbose',
                'class': 'logging.StreamHandler'
            },
            'logfile': {
                'level': 'INFO',
                'formatter': 'standard',
                'class': 'logging.FileHandler',
                'filename': logfile
            }
        },
        'loggers': {
            '': {
                'handlers': ['stdout', 'logfile'],
                'level': 'INFO',
                'propagate': True
            }
        }
    })
    return logger


def parse_args():
    parser = argparse.ArgumentParser(
        description="Load json formatted Items to Database from a file or a python list or dict", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('json_input', help="File or datastructure containing json of items to load")
    parser.add_argument('--env',
                        help='Environment to update from.')
    parser.add_argument('--key',
                        help="The keypair identifier from the keyfile")
    parser.add_argument('--keyfile',
                        default=os.path.expanduser("~/keypairs.json"),
                        help="The keypair file.  Default is --keyfile=%s" %
                             (os.path.expanduser("~/keypairs.json")))
    parser.add_argument('--patch-only', default=False,
                        action='store_true', help='Use if not posting any new items')
    parser.add_argument('--post-only', default=False,
                        action='store_true', help='Use if only posting new items')
    parser.add_argument('--item_types',
                        nargs='*',
                        help="Type(s) of Item(s) to load - if not provided then a dictionary of jsons keyed by item_type is required \
                              NOTE if you do provide more than one value to item_types then as long as the item_types are keys of the store only \
                              the values of those keys will be loaded")
    return parser.parse_args()


def get_auth(key=None, keyfile=None):
    """Sets up credentials for accessing the server.  Generates a key using info
       from the named keyname in the keyfile and checks that the server can be
       reached with that key.
    """
    auth = None
    if key and keyfile:
        keys = None
        if os.path.isfile(keyfile):
            with open(keyfile, 'r') as kf:
                keys_json_string = kf.read()
                keys = json.loads(keys_json_string)
        if keys:
            auth = keys.get(key)
    if not isinstance(auth, dict) or not {'key', 'secret', 'server'} <= set(auth.keys()):
        logger.error("Authentication failed")
    return auth


def set_load_params(auth, env):
    # authentication with Fourfront
    # auth is dict: key, secret, server - set config appropriately
    if not (auth or env):
        return
    if auth:
        if auth.get('server') == 'http://localhost:8000':
            config_uri = 'development.ini'
        else:
            config_uri = 'production.ini'
    elif env == 'local':
        # prompt access key ID and secret from user
        local_id = input('enter local access key ID: ')
        local_secret = input('enter local access key secret: ')
        auth = {'key': local_id, 'secret': local_secret, 'server': 'http://localhost:8000'}
        config_uri = 'development.ini'
    else:
        auth = ff_utils.get_authentication_with_server(None, env)
        config_uri = 'production.ini'
    return auth, config_uri


def load_json_to_store(json_input, itype=None):
    if isinstance(json_input, str):
        with open(json_input) as infile:
            try:
                json_data = json.load(infile)
            except json.JSONDecodeError:
                logger.error('ERROR - problem reading json file')
                return {}
    else:
        json_data = json_input
    if isinstance(json_data, dict):
        if itype:
            # just make sure the keys exist
            if [i for i in itype if i not in json_data]:
                logger.error('{} type(s) not in dictionary -- abort!!!'.format(', '.join(itype)))
                return {}
        return {'store': json_data}
    elif isinstance(json_data, list):
        if not itype or len(itype) != 1:
            logger.error('you need to pass a single item_type with your json list -- abort!!!')
            return {}
        return {'store': {itype[0]: json_data}}
    else:
        logger.error("I don't understand the data in the file -- abort!!!")
        return{}


def load_items(json_input, itypes=None, env=None, auth=None, patch_only=False, post_only=False, logger=None):
    """
    Load a given JSON file with items inserts or a python dict keyed by item type
    or a list (as long as a single itype param value is provided) to a server using
    the `load_data` endpoint defined in loadxl.
    """
    auth, config_uri = set_load_params(auth, env)
    load_endpoint = '/'.join([auth['server'], 'load_data'])
    logger.info('load_items: Starting POST to %s' % load_endpoint)
    json_data = {'config_uri': config_uri, 'overwrite': True, 'iter_response': True,
                 'patch_only': patch_only, 'post_only': post_only}
    if itypes:
        json_data['itype'] = itypes
    json_data.update(load_json_to_store(json_input, itypes))
    logger.info('Will attempt to load to {}'.format(auth['server']))
    num_to_load = 0
    for iname, idata in json_data.get('store', {}).items():
        num_items = len(idata)
        logger.info('{} {}'.format(num_items, iname))
        num_to_load += num_items
    start = datetime.now()
    if not json_data.get('store'):
        logger.error("No DATA to LOAD!")
        return
    try:
        # sustained by returning Response.app_iter from loadxl.load_data
        res = ff_utils.authorized_request(load_endpoint, auth=auth, verb='POST',
                                          timeout=None, json=json_data)
    except Exception as exc:
        logger.error('Error on POST: %s' % str(exc))
    else:
        # process the individual item responses from the generator.
        # each item should be "POST: <uuid>,", "PATCH: <uuid>,", or "SKIP: <uuid>"
        load_res = {'POST': [], 'PATCH': [], 'SKIP': [], 'ERROR': []}
        for val in res.text.split('\n'):
            if val.startswith('POST') or val.startswith('SKIP'):
                prefix_len = 4  # 'POST' or 'SKIP'
            else:
                prefix_len = 5  # 'PATCH' or 'ERROR'
            # this is a bit weird, but we want to split out the POST/PATCH...
            # and also remove ': ' from the value for each message
            cat, msg = val[:prefix_len], val[prefix_len + 2:]
            if not msg:
                continue
            if cat in load_res:
                load_res[cat].append(msg)
        logger.info("Success! Attempted to load %s items. Result: POSTed %s, PATCHed %s, skipped %s"
                    % (num_to_load, len(load_res['POST']), len(load_res['PATCH']), len(load_res['SKIP'])))
        if load_res['ERROR']:
            logger.error("ERROR encountered during load_data! Error: %s" % load_res['ERROR'])
        if not post_only and (len(load_res['POST']) + len(load_res['SKIP'])) > len(load_res['PATCH']):
            missed = set(load_res['POST'] + load_res['SKIP']) - set(load_res['PATCH'])
            logger.error("The following {} items passed round I (POST/skip) but not round II (PATCH): {}".format(len(missed), missed))
    logger.info("Finished request in %s" % str(datetime.now() - start))


def main():
    logging.basicConfig()
    # Loading app will have configured from config file. Reconfigure here:
    logging.getLogger('encoded').setLevel(logging.INFO)
    args = parse_args()
    start = datetime.now()
    dt = start.strftime("%y-%m-%d-%H-%M-%S")
    logfile = '{}_load_items.log'.format(dt)
    logger = get_logger(__name__, logfile)
    auth = None
    if not args.env and args.key:
        auth = get_auth(args.key, args.keyfile)
    load_items(args.json_input, args.item_types, args.env, auth, args.patch_only, args.post_only, logger)
    end = datetime.now()
    et = end.strftime("%y-%m-%d-%H-%M-%S")
    logger.info("DONE! {}".format(et))



if __name__ == "__main__":
    main()
