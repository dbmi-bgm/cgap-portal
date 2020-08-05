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
    write_outfile,
    create_dict_keyed_by_field_from_items,
    get_existing_items_from_db
)
from ..commands.parse_hpoa import (
    get_items_from_db_keyed_by_field,
    get_input_gen,
    get_header_info_and_field_name_line,
    get_fields_from_line
)
from ..commands.load_items import load_items

''' URL for fetching the human gene to disorder annotation file from monarch gene_disease.9606.tsv
'''
MONARCH_G2D_URL = 'https://archive.monarchinitiative.org/latest/tsv/gene_associations/gene_disease.9606.tsv'

''' Fields in a Gene Item that are can be used to map rows in the Monarch gene to disorder file
'''
GENEID_FIELDS = {
    'gene_symbol': None,
    'hgnc_id': 'HGNC',
    'entrez_id': 'NCBIGene',
}


''' Dictionary for field mapping between gene_disease file from monarch and Gene2Disorder Item
'''
FIELD_MAPPING = {
    'subject': 'using_gene_id',
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

''' Field that needs to be skipped or only used for logging missing info
'''
DIS_NAME_FIELD_FROM_INPUT = 'DiseaseName'

''' Relationship to use in the Evidence Item for making evidence links between ITEMS
'''
RELATION = 'associated with'


def get_fields_for_item_added_by_file():
    ''' returns a list of all the property names of the item that are generated
        from the file - omits calc prop and other user editable fields like clinic_notes
        fields will be used to compare dbterms to terms from file
    '''
    item_fields = ['subject_item', 'object_item', 'relationship_name']
    to_add = [v for k, v in FIELD_MAPPING.items() if k not in ['Frequency', 'DiseaseName', 'HPO_ID']]
    item_fields.extend(to_add)
    item_fields.extend(FIELD_MAPPING.get('Frequency'))
    return item_fields


ITEM_FIELDS = get_fields_for_item_added_by_file()


def get_logger(lname, logfile):
    """logging setup
       logging config - to be moved to file at some point
    """
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
    return logger


def get_gene2_altid_map(genes):
    ''' for existing db genes gets the various fields that can be used as IDs and maps
        to the uuid of the gene so you can check multiple fields in the file to figure out
        the correct gene item to use in link
        NOTE: using hardcoded fields in a defined list
    '''
    id2geneuid = {}
    for guid, g in genes.items():
        for f, pre in GENEID_FIELDS.items():
            value = g.get(f)
            if value:
                if pre:
                    value = pre + ':' + value
                # safety for different genes sharing same value - should not happen but not guaranteed
                # decide where to best check - probably only when id w/unique value doesn't work first
                id2geneuid.setdefault(value, []).append(guid)
    return id2geneuid


def line2list(line):
    return [d.strip() for d in line.split('\t')]


def find_disorder_uid_using_file_id(data, xref2disorder):
    """ gets the database ID used in annotation file and maps to existing disorder uuid
    """
    using_id = data.get('DatabaseID')
    if not using_id:
        return
    if using_id.startswith('ORPHA'):
        map_id = using_id.replace('ORPHA', 'Orphanet')
    else:
        map_id = using_id
    return xref2disorder.get(map_id)


def check_hpo_id_and_note_problems(fname, hpoid, hpoid2uuid, problems):
    ''' Is the hpo_id in the mapping dict?  If so return uuid.
        If not add info to the problems dict for later reporting
    '''
    hpuid = hpoid2uuid.get(hpoid)
    if hpuid:
        return hpuid
    not_found = problems.get('hpo_not_found', {})
    fields = []
    if hpoid in not_found:
        fields = not_found.get(hpoid, [])
        if fname in fields:
            return None
    fields.append(fname)
    problems.setdefault('hpo_not_found', {}).update({hpoid: fields})
    return None


def create_evi_annotation(data, hpoid2uuid, problems):
    """ Looks at all the fields in the annotation line and
        transforms to EvidenceDisPheno format
    """
    HP_REGEX = re.compile('^HP:[0-9]{7}')
    pheno_annot = {}
    for f, v in data.items():
        if not v or (f == DIS_NAME_FIELD_FROM_INPUT):
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

        if isinstance(v, str) and HP_REGEX.match(v):
            hpuid = check_hpo_id_and_note_problems(f, v, hpoid2uuid, problems)
            if not hpuid:
                continue
            else:
                v = hpuid
        pheno_annot[cgf] = v
    return pheno_annot


def compare_existing_to_newly_generated(logger, connection, evidence_items, itype):
    """ gets all the existing evidence items from database and compares to all the newly
        generated ones from annotations and if found removes from list
    """
    sq = 'search/?type={}&status!=obsolete'.format(itype)
    logger.info("COMPARING FILE ITEMS WITH CURRENT DB CONTENT")
    logger.info("searching: {}".format(datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
    dbitems = search_metadata(sq, connection, is_generator=True, page_limit=500)
    existing = 0
    uids2obsolete = []
    logger.info("comparing: {}".format(datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
    for db_evi in dbitems:
        # import pdb; pdb.set_trace()
        tochk = convert2raw(db_evi)
        if tochk in evidence_items:
            existing += 1
            evidence_items.remove(tochk)
        else:
            uids2obsolete.append(db_evi.get('uuid'))
    logger.info("result: {}".format(datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
    return evidence_items, existing, uids2obsolete


def convert2raw(item):
    # need to remove properties not generated from file eg. calc props and others
    stripped_item = {k: v for k, v in item.items() if k in ITEM_FIELDS}
    return get_raw_form(stripped_item)


def log_problems(logger, problems):
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
        udis = {u.get('DatabaseID'): u.get(DIS_NAME_FIELD_FROM_INPUT) for u in unmapped_dis}
        logger.info("{} disorders from {} annotation lines not found by xref".format(len(udis), len(unmapped_dis)))
        for d in sorted(list(udis.keys())):
            logger.info('{}\t{}'.format(d, udis[d]))


def get_args(args):  # pragma: no cover
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description='Given an Mondarch gene to disorder file or url for download generate EvidenceGeneDisorder items and optionally load',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--input',
                        default=MONARCH_G2D_URL,
                        help="The url or datafile with the disorder to phenotype annotations data to import. URL must begin with http(s): {}".format(MONARCH_G2D_URL))
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
                        default="gene2disorders.json")
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
    return parser.parse_args(args)


def main():  # pragma: no cover
    ITEMTYPE = 'EvidenceGeneDisorder'

    start = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    logfile = '{}_upd_gene2disorder_annot.log'.format(start.replace(':', '-'))
    logger = get_logger(__name__, logfile)
    logger.info('Processing gene to disorder annotations - START:{}'.format(start))

    args = get_args(sys.argv[1:])

    connection = connect2server(args.env, args.key, args.keyfile, logger)
    logger.info('Working with {}'.format(connection.get('server')))

    postfile, loaddb = prompt_check_for_output_options(args.load, args.outfile, ITEMTYPE, connection.get('server'), logger)

    logger.info('Getting existing Items from Database')
    logger.info('Disorders')
    disorders = get_items_from_db_keyed_by_field(connection, 'Disorder', 'disorder_id')
    logger.info('Genes')
    genes = get_items_from_db_keyed_by_field(connection, 'Gene', 'uuid')

    ids2genes = get_gene2_altid_map(genes)
    # this bit just converts to simple 1:1 mapping Dictionary
    ids2genes = {k: v[0] for k, v in ids2genes.items()}
    # bit to check which id maps to more than one gene - currently there are
    # 16 symbol to 2 uuid - genes should be merged but for now just take the first
    # one to make associations
    # count = 0
    # for i, uid in ids2genes.items():
    #     if len(uid) != 1:
    #         count += 1
    #         print(i, uid)
    # print(count)

    evidence_items = []
    problems = {}

    # figure out input and if to save the file
    insrc = args.input
    logger.info("Getting annotation data using: {}".format(insrc))

    # this a generator for all the lines of annotation data
    lines = get_input_gen(insrc)

    # in this case no header and first line is field names
    field_line = get_header_info_and_field_name_line(lines, None, logger)
    fields = get_fields_from_line(field_line, logger)  # currently don't have a mapping
    import pdb; pdb.set_trace()

    for line in lines:
        if line.startswith("#"):
            continue
        data_list = line2list(line)
        data = dict(zip(fields, data_list))

        # find the  disorder_uuid to refer to subject_item
        disorder_id = find_disorder_uid_using_file_id(data, xref2disorder)
        if not disorder_id:
            problems.setdefault('no_map', []).append(data)
            continue
        data['subject_item'] = disorder_id

        # and the HPO_ID to refer to object_item
        hpo_id = data.get('HPO_ID')
        phenotype_id = check_hpo_id_and_note_problems('HPO_ID', hpo_id, hpoid2uuid, problems)
        if not phenotype_id:
            # missing phenotype
            continue
        data['object_item'] = phenotype_id
        del data['HPO_ID']

        pheno_annot = create_evi_annotation(data, hpoid2uuid, problems)

        if pheno_annot:
            pheno_annot['relationship_name'] = RELATION
            if pheno_annot in evidence_items:
                problems.setdefault('redundant_annot', []).append(pheno_annot)  # (data, dis2pheno[ppos]))
                continue
            evidence_items.append(pheno_annot)

    logger.info("after parsing annotation file we have {} evidence items".format(len(evidence_items)))

    evidence_items, existing, uids2obsolete = compare_existing_to_newly_generated(logger, connection, evidence_items, ITEMTYPE)

    logger.info('{} EXISTING DB ITEMS WILL NOT BE CHANGED'.format(existing))
    logger.info('{} EXISTING DB ITEMS WILL BE SET TO OBSOLETE'.format(len(uids2obsolete)))
    logger.info('{} NEW ITEMS TO BE LOADED TO DB'.format(len(evidence_items)))

    # let's add uuids to new items
    [evi.update({'uuid': str(uuid4())}) for evi in evidence_items]
    obs_patch = [{'uuid': uid, 'status': 'obsolete'} for uid in uids2obsolete]

    if evidence_items or obs_patch:
        if postfile:
            write_outfile([evidence_items, obs_patch], postfile, args.pretty)
        if loaddb:
            if evidence_items:
                res = load_items(evidence_items, itypes=[ITEMTYPE], auth=connection, post_only=True, logger=logger)
                logger.info(res)
            if obs_patch:
                res2 = load_items(obs_patch, itypes=[ITEMTYPE], auth=connection, patch_only=True, logger=logger)
                logger.info(res2)
            # logger.info(json.dumps(res, indent=4))
    if problems:
        log_problems(logger, problems)

    end = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    logger.info("FINISHED - START: {}\tEND: {}".format(start, end))
    if args.post_report:
        post_report_document_to_portal(connection, ITEMTYPE, logfile)


if __name__ == '__main__':  # pragma: no cover
    main()
