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
    get_fields_from_line,
    compare_existing_to_newly_generated,
    line2list,
)
from ..commands.load_items import load_items

''' URL for fetching the human gene to disorder annotation file from monarch gene_disease.9606.tsv
'''
MONARCH_G2D_URL = 'https://archive.monarchinitiative.org/latest/tsv/gene_associations/gene_disease.9606.tsv'
DATASOURCE = 'Monarch'
ITEMTYPE = 'EvidenceGeneDisorder'
''' Fields in the annotation file or gene items that can be used for mapping file rows to Gene Items
    from_gene has prefixes used in annotation file for those IDs.
'''
GENEID_FIELDS = {
    'from_file': ['subject', 'subject_label'],
    'from_gene': [('hgnc_id', 'HGNC'), ('entrez_id', 'NCBIGene'), ('gene_symbol', None)]
}
''' Dictionary for field mapping between gene_disease file from monarch and Gene2Disorder Item
'''
FIELD_MAPPING = {
    'subject': {'field_name': 'using_gene_id'},
    'relation_label': {'field_name': 'relationship_name'},
    'evidence_label': {
        'field_name': 'evidence_class',
        'is_array': True,
        'separator': '|'
    },
    'source': {
        'field_name': 'attributed_pubs',
        'is_array': True,
        'separator': '|',
        'unique': True,
        'validate': {'pattern': '^PMID:[0-9]+$'}
    },
    'is_defined_by': {
        'field_name': 'original_source',
        'is_array': True,
        'separator': '|',
        'parse': True,
        'unique': True,
        'validate': {'enum': ['omim', 'orphanet', 'gwascatalog', 'clinvar.nt']}
    }
}


def get_fields_for_item_added_by_file():
    ''' returns a list of all the property names of the item that are generated
        from the file - omits calc prop and other user editable fields like clinic_notes
        fields will be used to compare dbterms to terms from file
    '''
    item_fields = ['subject_item', 'object_item']
    to_add = [v.get('field_name') for v in FIELD_MAPPING.values()]
    item_fields.extend(to_add)
    return item_fields


def gather_validation_info(schema, fieldmap):
    """ If schema is provided gets all fields with an enum or regex to use
        to validate items created from file
    """
    vinfo = {}
    if schema:
        props = schema.get('properties', {})
        for propname, pinfo in props.items():
            if 'items' in pinfo:
                pinfo = pinfo.get('items')
            enum = pinfo.get('enum')
            if enum is not None:
                vinfo.setdefault(propname, {}).update({'enum': enum})
            pattern = pinfo.get('pattern')
            if pattern is not None:
                vinfo.setdefault(propname, {}).update({'pattern': pattern})
    # and add ad hoc specified additional info
    if fieldmap:
        for finfo in fieldmap.values():
            if 'validate' in finfo:
                vinfo.setdefault(finfo.get('field_name'), {}).update(finfo.get('validate'))
    return vinfo


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
    gfield2pre = {v[0]: v[1] for v in GENEID_FIELDS.get('from_gene', [])}
    id2geneuid = {}
    for guid, g in genes.items():
        for f, pre in gfield2pre.items():
            value = g.get(f)
            if value:
                if pre:
                    value = pre + ':' + value
                # safety for different genes sharing same value - should not happen but not guaranteed
                # decide where to best check - probably only when id w/unique value doesn't work first
                id2geneuid.setdefault(value, []).append(guid)
    return id2geneuid


def find_gene_uid_from_file_fields(data, ids2geneuid):
    """ searches IDs (from a couple of different fields using preferred ids)
        used in annotation file and maps to existing gene uuid
        will use the first found
    """
    for field in GENEID_FIELDS.get('from_file', []):
        id2chk = data.get(field)
        geneid = ids2geneuid.get(id2chk)
        if geneid:
            return geneid
    return None


def _parse_vals(vals):
    pvals = []
    for v in vals:
        _, src = v.rsplit('/', 1)
        src = src.replace('#', '')
        pvals.append(src)
    return pvals


def is_valid_g2d(annot, vinfo, problems):
    ''' Use info in vinfo to check fields with enums and validate the values
        If no validation info is provided then assume it's valid
    '''
    if not annot:  # an empty annotation?
        return False
    valid = True
    if not vinfo:
        return valid
    enumprobs = {}
    patternprobs = {}
    for f, val in annot.items():
        if f not in vinfo:
            continue
        # need to determine if val is a string and if so convert to list item
        if isinstance(val, str):
            val = [val]
        vtype = vinfo.get(f)
        if 'enum' in vtype:
            okvals = vtype.get('enum')
            invalid = [v for v in val if v not in okvals]
            if invalid:
                valid = False
                enumprobs[f] = invalid
        if 'pattern' in vtype:
            p = re.compile(vtype.get('pattern'))  # not sure if this will work out of the box
            for v in val:
                if not p.match(v):
                    patternprobs.setdefault(f, []).append(v)
            if f in patternprobs:
                valid = False
    if enumprobs:
        annot['enum_problems'] = enumprobs
        problems.setdefault('enum_invalid', []).append(annot)
    if patternprobs:
        annot['pattern_problem'] = patternprobs
        problems.setdefault('pattern_mismatch', []).append(annot)
    return valid


def create_gene2disorder_evi_annotation(data, problems, dt_time, valid_info=None):
    """ Looks at all the fields in the data line and
        transforms to GeneDisorderEvidence format
        fields we care about
        * datasource - constant Monarch
        * datasource_version - date run
        * subject_item - gene uuid obtained by a function from subject or subject_label
        * object_item - disorder uuid obtained by a function from object (mondo id)
        * subject -> using_gene_id
        * relation_label -> relationship_name
        * evidence_label (| separated values) -> evidence_class items
        * source (| separated PMIDS) -> attributed_pubs items
        * is_defined_by (| separated url form) -> original_source items

        At this point we know we have a valid subject_item and object_item
        So validation only need be done for relationship_name
    """
    g2d_annot = {}
    for f, v in data.items():
        vals = []
        finfo = {}
        if not v:  # skip empty fields
            continue
        if f in ['subject_item', 'object_item']:
            # these fields are guaranteed to exist at this point
            g2d_annot[f] = v
        elif f in FIELD_MAPPING:
            finfo = FIELD_MAPPING.get(f)
            if finfo.get('is_array'):
                vals = [val.strip() for val in v.split(finfo.get('separator'))]
                if finfo.get('unique'):
                    # ensure unique values as required by schema
                    vals = list(set(vals))
            else:
                vals = [v.strip()]

            if finfo.get('parse'):
                # for now we only have special parsing with the url field so this
                # is not a general case
                vals = _parse_vals(vals)
        if vals and finfo:
            if not finfo.get('is_array'):
                vals = vals[0]
            g2d_annot[finfo.get('field_name')] = vals
    if g2d_annot:  # only add these constant fields if there is other info
        g2d_annot.update({'datasource': DATASOURCE, 'datasource_version': dt_time})

    # do some basic validation and add problems to list
    if is_valid_g2d(g2d_annot, valid_info, problems):
        return g2d_annot
    else:
        logger.warn("PROBLEM - NO annotation returned for\n\t{}".format(data))
        return {}


def get_item_schema(connection, itype, logger):
    sname = re.sub(r'(?<!^)(?=[A-Z])', '_', itype).lower()  # convert to snake_case
    q = 'profiles/' + sname + '.json'
    schema = None
    try:
        schema = get_metadata(q, connection)
    except Exception as e:
        logger.warn("Can't retrieve schema for {} - will be unable to fully validate the created items prior to load".format(itype))
        logger.warn(e)
    return schema


def log_problems(logger, problems):
    pass


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
    start = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    logfile = '{}_upd_gene2disorder_annot.log'.format(start.replace(':', '-'))
    logger = get_logger(__name__, logfile)
    logger.info('Processing gene to disorder annotations - START:{}'.format(start))

    # initial setup and queries to get database items and schema
    args = get_args(sys.argv[1:])

    connection = connect2server(args.env, args.key, args.keyfile, logger)
    logger.info('Working with {}'.format(connection.get('server')))

    postfile, loaddb = prompt_check_for_output_options(args.load, args.outfile, ITEMTYPE, connection.get('server'), logger)

    logger.info('Getting schema for {} item type from db'.format(ITEMTYPE))
    evi_g2d_schema = get_item_schema(connection, ITEMTYPE, logger)
    # set up for later validation - doing it once here to avoid unnecessary work later
    validation_info = gather_validation_info(evi_g2d_schema, FIELD_MAPPING)

    logger.info('Getting existing Items from Database')
    logger.info('Disorders')
    disorders = get_items_from_db_keyed_by_field(connection, 'Disorder', 'disorder_id')
    logger.info('Genes')
    genes = get_items_from_db_keyed_by_field(connection, 'Gene', 'uuid')

    ids2genes = get_gene2_altid_map(genes)
    # this bit just converts to simple 1:1 mapping Dictionary
    ids2genes = {k: v[0] for k, v in ids2genes.items()}
    # lookup table key mondo id - value disorder uuid
    mondo2disuid = {k: v.get('uuid') for k, v in disorders.items()}

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
    if not fields:
        logger.warn("Can't get field names - bailing!")
        sys.exit(1)

    for line in lines:
        if line.startswith("#"):
            continue
        data_list = line2list(line)
        data = dict(zip(fields, data_list))

        # find the gene uuid
        gene_uid = find_gene_uid_from_file_fields(data, ids2genes)
        if not gene_uid:
            problems.setdefault('no_gene_in_cgap', []).append(data)
            continue
        data['subject_item'] = gene_uid

        # and the disorder uuid - based on MONDO id in object
        disorder_uid = mondo2disuid.get(data.get('object'))
        if not disorder_uid:
            problems.setdefault('no_disorder_in_cgap', []).append(data)
            continue
        data['object_item'] = disorder_uid

        g2d_evi = create_gene2disorder_evi_annotation(data, problems, start, validation_info)

        if g2d_evi:
            if g2d_evi in evidence_items:
                problems.setdefault('redundant_annot', []).append(pheno_annot)  # (data, dis2pheno[ppos]))
                continue
            evidence_items.append(g2d_evi)

    logger.info("after parsing annotation file we have {} evidence items".format(len(evidence_items)))

    # get only the fields added from the file
    item_fields = get_fields_for_item_added_by_file()
    evidence_items, existing, uids2obsolete = compare_existing_to_newly_generated(logger, connection, evidence_items, ITEMTYPE, item_fields)

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
