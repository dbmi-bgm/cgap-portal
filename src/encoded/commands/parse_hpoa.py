#!/usr/bin/env python3

import argparse
import json
import logging
import logging.config
import os
import re
import requests
import sys

from datetime import datetime
from dcicutils.ff_utils import (
    get_authentication_with_server,
    get_metadata,
    patch_metadata,
    post_metadata,
    search_metadata,
)
from uuid import uuid4
from ..commands.generate_items_from_owl import (
    connect2server,
    get_raw_form,
    prompt_check_for_output_options,
    post_report_document_to_portal,
)
from ..commands.load_items import load_items


'''logging setup
   logging config - to be moved to file at some point
'''
logfile = 'upd_dis2pheno_annot.log'
logger = logging.getLogger(__name__)
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
            'level': 'INFO',
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


''' Dictionary for field mapping between hpoa file and cgap disorder schema
'''
FIELD_MAPPING = {
    'DatabaseID': 'using_id',
    'DiseaseName': 'unused field',
    'Qualifier': 'is_not',
    'HPO_ID': 'phenotype',
    'Reference': 'attribution_id',
    'Evidence': 'evidence_code',
    'Onset': 'onset',
    'Frequency': ['frequency_term', 'frequency_value'],
    'Sex': 'affected_sex',
    'Modifier': 'modifier',
    'Aspect': 'aspect',
    'Biocuration': 'curation_history'
}

RELATION = 'associated with'


def convert2raw(item):
    # need to remove properties not generated from file eg. calc props and others
    fields2remove = ['uuid', '@id', '@type', 'display_title', 'status', 'principals_allowed', 'date_created']
    stripped_item = {k: v for k, v in item.items() if k not in fields2remove}
    return get_raw_form(stripped_item)


def check_fields(data):
    return [f for f in data if (f != 'DiseaseName' and f not in FIELD_MAPPING)]


def get_disorders_from_db(connection):
    q = 'search/?type=Disorder'
    return {d.get('uuid'): d for d in search_metadata(q, connection, page_limit=200, is_generator=True)}


def get_existing_phenotype_uuids(connection):
    q = 'search/?type=Phenotype'
    result = search_metadata(q, connection, page_limit=200, is_generator=True)
    return {r.get('hpo_id'): r.get('uuid') for r in result}


def get_phenotypes_from_db(connection):
    q = 'search/?type=Phenotype'
    result = search_metadata(q, connection, page_limit=200, is_generator=True)
    return {r.get('hpo_id'): r for r in result}


def get_dbxref2disorder_map(disorders):
    xref2dis = {}
    for duid, d in disorders.items():
        xrefs = d.get('dbxrefs')
        if xrefs:
            for x in xrefs:
                if x in xref2dis:
                    logger.warn("For disorder uuid {} have already seen {} linked to {}".format(duid, x, xref2dis[x]))
                else:
                    if x.startswith('OMIM:') or x.lower().startswith('orpha') or x.lower().startswith('decip'):
                        xref2dis[x] = duid
    return xref2dis


def check_hpo_id_and_note_problems(fname, hpoid, hpoid2uuid, problems):
    hpuid = hpoid2uuid.get(hpoid)
    if hpuid:
        return hpuid
    not_found = problems.get('hpo_not_found', [])
    fields = []
    if hpoid in not_found:
        fields = not_found.get(hpoid, [])
        if fname in fields:
            return None
    fields.append(fname)
    problems.setdefault('hpo_not_found', {}).update({hpoid: fields})
    return None


def line2list(line):
    return [d.strip() for d in line.split('\t')]


def write_outfile(terms, filename, pretty=False):
    '''terms is a list of dicts
        write to file by default as a json list or if prett
        then same with indents and newlines
    '''
    with open(filename, 'w') as outfile:
        if pretty:
            json.dump(terms, outfile, indent=4)
        else:
            json.dump(terms, outfile)


def get_input_gen(input):
    ''' depending on what is passed as input will create a generator
        that returns lines from a webrequest or lines of a file
    '''
    if input.startswith('http'):
        try:
            with requests.get(input, timeout=5) as r:
                if r.encoding is None:
                    r.encoding = 'utf-8'
                # res = r.iter_lines(decode_unicode=True)
                res = r.text
                for l in res.split('\n'):
                    yield l
        except Exception as e:
            print(e)
            return []
    elif os.path.isfile(input):
        try:
            with open(input) as r:
                for line in r:
                    line = line.strip()
                    yield line
        except Exception as e:
            print(e)
            return []
    r.close()


def get_args():  # pragma: no cover
    parser = argparse.ArgumentParser(
        description='Given an HPOA file or url for download generate EvidenceDisPheno items and optionally load',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--input',
                        default='http://compbio.charite.de/jenkins/job/hpo.annotations.current/lastSuccessfulBuild/artifact/misc_2018/phenotype.hpoa',
                        help="The url or datafile with the disorder to phenotype annotations data to import. URL must begin with http(s)\
                        http://compbio.charite.de/jenkins/job/hpo.annotations.current/lastSuccessfulBuild/artifact/misc_2018/phenotype.hpoa")
    parser.add_argument('--env',
                        help="The environment to use i.e. local, fourfront-cgap")
    parser.add_argument('--key',
                        help="The keypair identifier from the keyfile")
    parser.add_argument('--keyfile',
                        default=os.path.expanduser("~/keypairs.json"),
                        help="The keypair file.  Default is --keyfile=%s" %
                             (os.path.expanduser("~/keypairs.json")))
    parser.add_argument('--outfile',
                        help="the optional path and file to write output",
                        default="disorders2phenotypes.json")
    parser.add_argument('--load',
                        action='store_true',
                        default=False,
                        help="Default False - use to load data directly from json to the server that the connection refers to")
    parser.add_argument('--post_report',
                        action='store_true',
                        default=False,
                        help="Default False - use to post a Document item with a report as attachment")
    parser.add_argument('--pretty',
                        default=False,
                        action='store_true',
                        help="Default False - set True if you want json format easy to read, hard to parse")
    return parser.parse_args()


def main():  # pragma: no cover
    start = datetime.now()
    logger.info('Processing disorder to phenotype annotations - START:{}'.format(str(start)))
    args = get_args()
    itype = 'EvidenceDisPheno'

    connection = connect2server(args.env, args.key, args.keyfile)
    logger.info('Working with {}'.format(connection.get('server')))
    postfile, loaddb = prompt_check_for_output_options(args.load, args.outfile, itype, connection.get('server'))
    logger.info('Getting existing Items')
    logger.info('Disorders')
    disorders = get_disorders_from_db(connection)
    logger.info('Phenotypes')
    phenotypes = get_phenotypes_from_db(connection)

    hp_regex = re.compile('^HP:[0-9]{7}')
    hpoid2uuid = {hid: pheno.get('uuid') for hid, pheno in phenotypes.items()}
    xref2disorder = get_dbxref2disorder_map(disorders)
    evidence_items = []  # {}
    problems = {}
    # figure out input and if to save the file
    insrc = args.input
    logger.info("Getting annotation data using: {}".format(insrc))
    lines = get_input_gen(insrc)
    fields = []
    dtag = 'date: '
    fdtag = 'description: '
    date = 'unknown'
    fdesc = 'unknown'
    while True:
        line = next(lines)
        if not line.startswith("#"):
            break
        elif dtag in line:
            # get the date that the file was generated
            _, date = line.split(dtag)
        elif fdtag in line:
            _, fdesc = line.split(fdtag)
    logger.info("Annotation file info:\n\tdate: {}\n\tdescription: {}".format(date, fdesc))
    fields = line2list(line)
    bad_fields = check_fields(fields)
    if bad_fields:
        logger.error("UNKNOWN FIELDS FOUND: {}".format(', '.join(bad_fields)))
        sys.exit()

    for line in lines:
        if line.startswith("#"):
            continue
        data_list = line2list(line)
        data = dict(zip(fields, data_list))
        # find the  disorder_uuid to refer to subject_item
        using_id = data.get('DatabaseID')
        if not using_id:
            continue
        if using_id.startswith('ORPHA'):
            map_id = using_id.replace('ORPHA', 'Orphanet')
        else:
            map_id = using_id
        if map_id not in xref2disorder:
            problems.setdefault('no_map', []).append(data)
            continue
        disorder_id = xref2disorder.get(map_id)
        data['subject_item'] = disorder_id
        # and the HPO_ID to refer to object_item
        hpo_id = data.get('HPO_ID')
        phenotype_id = check_hpo_id_and_note_problems('HPO_ID', hpo_id, hpoid2uuid, problems)
        if not phenotype_id:
            # missing phenotype
            continue
        data['object_item'] = phenotype_id
        del data['HPO_ID']
        pheno_annot = {}
        for f, v in data.items():
            if not v or (f == 'DiseaseName'):
                continue
            if f in ['subject_item', 'object_item']:
                cgf = f
            elif f == 'Frequency':
                if v.startswith('HP:'):
                    cgf = FIELD_MAPPING[f][0]
                else:
                    cgf = FIELD_MAPPING[f][1]
            else:
                cgf = FIELD_MAPPING[f]

            if f == 'Qualifier':
                v = True
            elif f == 'Sex':
                v = v[0:1].upper()

            if isinstance(v, str) and hp_regex.match(v):
                hpuid = check_hpo_id_and_note_problems(f, v, hpoid2uuid, problems)
                if not hpuid:
                    continue
                else:
                    v = hpuid
            pheno_annot[cgf] = v

        if pheno_annot:
            pheno_annot['relationship_name'] = RELATION
            if pheno_annot in evidence_items:
                problems.setdefault('redundant_annot', []).append(pheno_annot)  # (data, dis2pheno[ppos]))
                continue
            evidence_items.append(pheno_annot)
    logger.info("after parsing annotation file we have {} evidence items".format(len(evidence_items)))

    # at this point we've gone through all the lines in the file
    # here we want to compare with what already exists in db
    patches = []
    sq = 'search/?type={}&status!=obsolete'.format(itype)
    logger.info("COMPARING FILE ITEMS WITH CURRENT DB CONTENT")
    logger.info("searching: {}".format(str(datetime.now())))
    res = search_metadata(sq, connection, is_generator=True, page_limit=500)
    existing = 0
    uids2obsolete = []
    logger.info("comparing: {}".format(str(datetime.now())))
    for db_evi in res:
        tochk = convert2raw(db_evi)
        if tochk in evidence_items:
            existing += 1
            evidence_items.remove(tochk)
        else:
            uids2obsolete.append(db_evi.get('uuid'))
    logger.info("result: {}".format(str(datetime.now())))
    logger.info('{} EXISTING DB ITEMS WILL NOT BE CHANGED'.format(existing))
    logger.info('{} EXISTING DB ITEMS WILL BE SET TO OBSOLETE'.format(len(uids2obsolete)))
    logger.info('{} NEW ITEMS TO BE LOADED TO DB'.format(len(evidence_items)))
    # let's add uuids to new items so second round will work
    [evi.update({'uuid': str(uuid4())}) for evi in evidence_items]
    obs_patch = [{'uuid': uid, 'status': 'obsolete'} for uid in uids2obsolete]

    if evidence_items or obs_patch:
        if postfile:
            write_outfile([evidence_items, obs_patch], postfile, args.pretty)
        if loaddb:
            if evidence_items:
                res = load_items(evidence_items, itypes=[itype], auth=connection, post_only=True)
                logger.info(res)
            if obs_patch:
                res2 = load_items(obs_patch, itypes=[itype], auth=connection, patch_only=True)
                logger.info(res2)
            # logger.info(json.dumps(res, indent=4))
    if problems:
        # log problems
        missing_phenos = problems.get('hpo_not_found')
        if missing_phenos:
            logger.info("{} missing HPO terms used in hpoa file".format(len(missing_phenos)))
            for hpoid, fields in missing_phenos.items():
                logger.info("{}\t{}".format(hpoid, fields))
        dup_annots = problems.get('redundant_annot')
        if dup_annots:
            logger.info("{} redundant annotations found".format(len(dup_annots)))
        unmapped_dis = problems.get('no_map')
        if unmapped_dis:
            udis = {u.get('DatabaseID'): u.get('DiseaseName') for u in unmapped_dis}
            logger.info("{} disorders from {} annotation lines not found by xref".format(len(udis), len(unmapped_dis)))
            for d in sorted(list(udis.keys())):
                logger.info('{}\t{}'.format(d, udis[d]))
    end = datetime.now()
    logger.info("FINISHED - START: {}\tEND: {}".format(start, str(end)))
    if args.post_report:
        post_report_document_to_portal(connection, itype, logfile)
    dt = end.strftime("%y-%m-%d-%H-%M-%S")
    os.rename(logfile, dt + logfile)


if __name__ == '__main__':  # pragma: no cover
    main()
