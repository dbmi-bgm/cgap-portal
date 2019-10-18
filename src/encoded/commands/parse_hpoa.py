#!/usr/bin/env python3

import sys
import argparse
import json
import re
import ast
from datetime import datetime
from uuid import uuid4
from dcicutils.ff_utils import (
    get_authentication_with_server,
    get_metadata,
    patch_metadata,
    post_metadata,
    search_metadata,
)
from dcicwrangling.functions.script_utils import create_ff_arg_parser, convert_key_arg_to_dict

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


def get_dbxref2disorder_map(disorders):
    xref2dis = {}
    for duid, d in disorders.items():
        xrefs = d.get('dbxrefs')
        if xrefs:
            for x in xrefs:
                if x in xref2dis:
                    print("For disorder uuid {} have already seen {} linked to {}".format(duid, x, xref2dis[x]))
                else:
                    if x.startswith('OMIM:') or x.lower().startswith('orpha') or x.lower().startswith('decip'):
                        xref2dis[x] = duid
    return xref2dis


def line2list(line):
    return [d.strip() for d in line.split('\t')]


def write_outfile(terms, filename, pretty=False):
    '''terms is a list of dicts
        write to file by default as a json list or if pretty
        then same with indents and newlines
    '''
    with open(filename, 'w') as outfile:
        if pretty:
            json.dump(terms, outfile, indent=4)
        else:
            json.dump(terms, outfile)


def convert_key_arg_to_dict(key):
    if all([v in key for v in ['key', 'secret', 'server']]):
        key = ast.literal_eval(key)
    if not isinstance(key, dict):
        print("You included a key argument but it appears to be malformed or missing required info - see --help")
        sys.exit(1)
    return key


def get_args():  # pragma: no cover
    parser = argparse.ArgumentParser(
        description='Given an HPOA file generate phenotype annotations for that disorder as json',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--env',
                        default='local',
                        help="The environment to use i.e. data, webdev, mastertest.\
                        Default is 'local')")
    parser.add_argument('--key',
                        default=None,
                        help="An access key dictionary including key, secret and server.\
                        {'key': 'ABCDEF', 'secret': 'supersecret', 'server': 'https://data.4dnucleome.org'}")
    parser.add_argument('infile',
                        help="the datafile containing object data to import")
    parser.add_argument('--outfile',
                        help="the optional path and file to write output default is disorders.json",
                        default="disorders2phenotypes.json")
    parser.add_argument('--pretty',
                        default=False,
                        action='store_true',
                        help="Default False - set True if you want json format easy to read, hard to parse")
    args = parser.parse_args()
    if args.key:
        args.key = convert_key_arg_to_dict(args.key)
    return args


def main():  # pragma: no cover
    start = datetime.now()
    print(str(start))
    args = get_args()
    try:
        auth = get_authentication_with_server(args.key, args.env)
    except Exception:
        print("Authentication failed")
        sys.exit(1)

    # existing_disorders = get_existing_disorders_from_db(auth)
    hpoid2uuid = get_existing_phenotype_uuids(auth)
    hp_regex = re.compile('^HP:[0-9]{7}')
    disorders = get_disorders_from_db(auth)
    xref2disorder = get_dbxref2disorder_map(disorders)
    assoc_phenos = {}
    problems = {}
    with open(args.infile) as annot:
        fields = []
        while True:
            line = annot.readline()
            if not line.startswith("#"):
                break
        fields = line2list(line)
        bad_fields = check_fields(fields)
        if bad_fields:
            print("UNKNOWN FIELDS FOUND: {}".format(', '.join(bad_fields)))
            sys.exit()
        for line in annot:
            if line.startswith("#"):
                continue
            data_list = line2list(line)
            data = dict(zip(fields, data_list))
            # deal with top level fields for disorder
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
                    hpuid = hpoid2uuid.get(v)
                    if not hpuid:
                        nf_data = data.copy()
                        nf_data.update({'missing_hpo': v})
                        problems.setdefault('hpo_not_found', []).append(nf_data)
                        continue
                    else:
                        v = hpuid
                pheno_annot[cgf] = v

            if pheno_annot:
                dis2pheno = assoc_phenos.get(disorder_id)
                if dis2pheno:
                    if pheno_annot in dis2pheno:
                        ppos = dis2pheno.index(pheno_annot)
                        problems.setdefault('redundant_annot', []).append((data, dis2pheno[ppos]))
                        continue
                assoc_phenos.setdefault(disorder_id, []).append(pheno_annot)
    patches = [{'uuid': uid, 'associated_phenotypes': apa} for uid, apa in assoc_phenos.items()]

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
