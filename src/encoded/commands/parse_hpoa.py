#!/usr/bin/env python3

import sys
import os
import argparse
import json
import re
import requests
import logging
from datetime import datetime
from uuid import uuid4
from dcicutils.ff_utils import (
    get_authentication_with_server,
    get_metadata,
    patch_metadata,
    post_metadata,
    search_metadata,
)
from encoded.commands.load_items import load_items
from encoded.commands.generate_items_from_owl import (
    connect2server,
    get_raw_form
)

'''logging setup
   logging config - to be moved to file at some point
'''
LOGFILE = 'upd_dis2pheno_annot.log'
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
            'filename': LOGFILE
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


def check_fields(data):
    return [f for f in data if (f != 'DiseaseName' and f not in FIELD_MAPPING)]


def get_disorders_from_db(auth):
    q = 'search/?type=Disorder'
    return {d.get('uuid'): d for d in search_metadata(q, auth, page_limit=200, is_generator=True)}


def get_existing_phenotype_uuids(auth):
    q = 'search/?type=Phenotype'
    result = search_metadata(q, auth, page_limit=200, is_generator=True)
    return {r.get('hpo_id'): r.get('uuid') for r in result}


def get_phenotypes_from_db(auth):
    q = 'search/?type=Phenotype'
    result = search_metadata(q, auth, page_limit=200, is_generator=True)
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
    prob = {fname: hpoid}
    not_found = problems.get('hpo_not_found', [])
    if hpo_id in not_found:
        fields = not_found.get(hpo_id, [])
        if fname in fields:
            return None
        fields.append(fname)
    problems.setdefault('hpo_not_found', {}).update({hpo_id: fields})
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
    if input.startswith('http'):
        try:
            with requests.get(input, stream=True) as r:
                if r.encoding is None:
                    r.encoding = 'utf-8'
                res = r.iter_lines(decode_unicode=True)
                for l in res:
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
        description='Given an HPOA file or url for download generate phenotype annotations for that disorder as json and optionally load',
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
    parser.add_argument('--pretty',
                        default=False,
                        action='store_true',
                        help="Default False - set True if you want json format easy to read, hard to parse")
    return parser.parse_args()


def main():  # pragma: no cover
    start = datetime.now()
    logger.info('Processing disorder to phenotype annotations - START:{}'.format(str(start)))
    args = get_args()

    # get connection
    auth = connect2server(args.env, args.key, args.keyfile)
    logger.info('Working with {}'.format(auth.get('server')))
    logger.info('Getting existing Items')
    logger.info('Disorders')
    disorders = get_disorders_from_db(auth)
    logger.info('Phenotypes')
    phenotypes = get_phenotypes_from_db(auth)

    hp_regex = re.compile('^HP:[0-9]{7}')
    hpoid2uuid = {hid: pheno.get('uuid') for hid, pheno in phenotypes.items()}
    xref2disorder = get_dbxref2disorder_map(disorders)
    assoc_phenos = {}
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
        phenotype_id = check_hpo_id_and_note_problems('HPO_ID', hpoid, hpoid2uuid, problems)
        if not phenotype_id:
            # missing phenotype
            continue
        data['object_item'] = phenotype_id
        del data['HPO_ID']
        pheno_annot = {}
        for f, v in data.items():
            if not v or (f == 'DiseaseName'):
                continue
            if f == 'Frequency':
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
            # HERE IS ONE PLACE WHERE WE MAY NEED TO DO CHECKING FOR EXISING AND DUPES
            # COME UP WITH A KEY FOR COMPARISON PURPOSES
            dis2pheno = assoc_phenos.get(disorder_id)
            if dis2pheno:
                if pheno_annot in dis2pheno:
                    ppos = dis2pheno.index(pheno_annot)
                    problems.setdefault('redundant_annot', []).append((data, dis2pheno[ppos]))
                    continue
            assoc_phenos.setdefault(disorder_id, []).append(pheno_annot)
    # at this point we've gone through all the lines in the file
    # here we want to compare with what already exists in db
    patches = []
    for did, pheno_annots in assoc_phenos.items():
        db_annots = []
        db_dis = disorders.get(did)
        if db_dis:
            db_annots = db_dis.get('associated_phenotypes', [])
            db_annots = [get_raw_form(a) for a in db_annots]
        newannot = [ann for ann in pheno_annots if ann not in db_annots]
        existingannot = [ann for ann in pheno_annots if ann in db_annots]
        # we don't need to explicitly get these except for logging purposes
        obsannot = [ann for ann in db_annots if ann not in pheno_annots]
        if newannot:
            print('NEW!!!!', newannot)
            import pdb; pdb.set_trace()
        if obsannot:
            print('OBSOLETE!!!!!', obsannot)
            import pdb; pdb.set_trace()
        patch = newannot + existingannot
        patches.append({'uuid': did, 'associated_phenotypes': patch})

    write_outfile(patches, args.outfile, args.pretty)
    if problems:
        # mini report on problems
        missing_phenos = problems.get('hpo_not_found')
        if missing_phenos:
            print("{} missing HPO terms used in hpoa file".format(len(missing_phenos)))
        dup_annots = problems.get('redundant_annot')
        if dup_annots:
            print("{} redundant annotations found".format(len(dup_annots)))
        unmapped_dis = problems.get('no_map')
        if unmapped_dis:
            udis = {u.get('DatabaseID'): u.get('DiseaseName') for u in unmapped_dis}
            for d in sorted(list(udis.keys())):
                print('{}\t{}'.format(d, udis[d]))
            print("{} disorders from {} annotation lines not found by xref".format(len(udis), len(unmapped_dis)))
        probfile = args.outfile
        rfname, rdir = ''.join(probfile[::-1]).split('/', 1)
        fname = 'problems_' + ''.join(rfname[::-1])
        dir = ''
        if rdir:
            dir = ''.join(rdir[::-1])
            probfile = dir + '/' + fname
        else:
            probfile = fname
        print('PROBLEMS written to {}'.format(probfile))
        write_outfile(problems, probfile, True)
    end = datetime.now()
    print("FINISHED - START: ", str(start), "\tEND: ", str(end))


if __name__ == '__main__':  # pragma: no cover
    main()
