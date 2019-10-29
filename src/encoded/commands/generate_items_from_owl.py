import os
import json
import sys
import argparse
import datetime
import logging
import logging.config
from uuid import uuid4
from collections import Counter
from rdflib.collection import Collection
from encoded.commands.owltools import (
    Namespace,
    Owler,
    splitNameFromNamespace,
    convert2URIRef,
    isURIRef,
    isBlankNode,
    getObjectLiteralsOfType,
    subClassOf,
    Deprecated,
    hasDbXref,
    hasAltId
)
from encoded.commands.load_items import load_items
from dcicutils.ff_utils import (
    get_authentication_with_server,
    get_metadata,
    search_metadata,
    unified_authentication,
    post_metadata
)

EPILOG = __doc__

'''logging setup
   logging config - to be moved to file at some point
'''
LOGFILE = 'process_dp_upd.log'
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
            'level': 'WARN',
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

''' global config '''
ITEM2OWL = {
    'definition_uris': [
        'purl.obolibrary.org/obo/IAO_0000115',
    ],
    'synonym_uris': [
        'www.geneontology.org/formats/oboInOwl#hasExactSynonym',
        'www.geneontology.org/formats/oboInOwl#hasNarrowSynonym',
        'www.geneontology.org/formats/oboInOwl#RelatedSynonym',
    ],
    'Disorder': {
        'download_url': 'http://purl.obolibrary.org/obo/mondo.owl',
        'ontology_prefix': 'MONDO',
        'id_field': 'disorder_id',
        'name_field': 'disorder_name',
        'url_field': 'disorder_url',
    },
    'Phenotype': {
        'download_url': 'http://purl.obolibrary.org/obo/hp.owl',
        'ontology_prefix': 'HP',
        'id_field': 'hpo_id',
        'name_field': 'phenotype_name',
        'url_field': 'hpo_url'
    },
}


def iterative_parents(nodes, terms, data):
    '''returns all the parents traversing the term graph structure
        - (not the direct RDF graph) by iteratively following parents
        until there are no more parents
    '''
    results = []
    while 1:
        newNodes = []
        if len(nodes) == 0:
            break
        for node in nodes:
            if not terms.get(node):
                continue  # deal with a parent not being in the term dict
            results.append(node)
            if terms[node].get(data):
                for parent in terms[node][data]:
                    if parent not in results:
                        newNodes.append(parent)
        nodes = list(set(newNodes))
    return list(set(results))


def get_all_ancestors(term, terms, field, itype):
    '''Adds a list of all the term's ancestors to a term up to the root
        of the ontology and adds to closure fields - used in adding slims
    '''
    closure = 'closure'
    id_field = ITEM2OWL[itype].get('id_field')
    if closure not in term:
        term[closure] = []
    if field in term:
        words = iterative_parents(term[field], terms, field)
        term[closure].extend(words)
    term[closure].append(term[id_field])
    return term  # is this necessary


def _has_human(cols):
    '''True if human taxon is part of the collection'''
    ans = False
    human = HUMAN_TAXON
    if cols:
        if isURIRef(cols[0]):
            human = convert2URIRef(human)
        if human in cols:
            ans = True
    return ans


def get_termid_from_uri(uri):
    '''Given a uri - takes the last part (name) and converts _ to :
        eg. http://www.ebi.ac.uk/efo/EFO_0002784 => EFO:0002784
    '''
    return splitNameFromNamespace(uri)[0].replace('_', ':')


def get_term_name_from_rdf(class_, data):
    '''Looks for label for class in the rdf graph'''
    name = None
    try:
        name = data.rdfGraph.label(class_).__str__()
    except AttributeError:
        pass
    return name


def create_term_dict(class_, termid, data, itype):
    '''Adds basic term info to the dictionary of all terms
    '''
    id_field = ITEM2OWL[itype].get('id_field')
    url_field = ITEM2OWL[itype].get('url_field')
    name_field = ITEM2OWL[itype].get('name_field')
    term = {id_field: termid}
    if url_field:
        term[url_field] = class_.__str__()
    name = get_term_name_from_rdf(class_, data)
    if name is not None and name_field:
        term[name_field] = name
    return term


def process_parents(class_, data, terms):
    '''Gets the parents of the class - direct and those linked via
        specified relationship types
    '''
    termid = get_termid_from_uri(class_)
    for parent in data.get_classDirectSupers(class_, excludeBnodes=False):
        if isBlankNode(parent):
            continue
        else:
            terms[termid].setdefault('parents', []).append(get_termid_from_uri(parent))
    return terms


def get_synonyms(class_, data, synonym_terms):
    '''Gets synonyms for the class as strings
    '''
    return getObjectLiteralsOfType(class_, data, synonym_terms)


def get_definitions(class_, data, definition_terms):
    '''Gets definitions for the class as strings
    '''
    return getObjectLiteralsOfType(class_, data, definition_terms)


def get_dbxrefs(class_, data):
    '''Gets dbxrefs for the class as strings
    '''
    return getObjectLiteralsOfType(class_, data, [hasDbXref])


def get_alternative_ids(class_, data):
        '''Gets alternative IDs for the class as strings
        '''
        return getObjectLiteralsOfType(class_, data, [hasAltId])


def _cleanup_non_fields(terms):
    '''Removes unwanted fields and empty terms from final json'''
    to_delete = 'closure'
    tids2delete = []
    for termid, term in terms.items():
        if not term:
            tids2delete.append(termid)
        else:
            if to_delete in term:
                del term[to_delete]
    for tid in tids2delete:
        del terms[tid]
    return terms


def add_slim_to_term(term, slim_terms, itype):
    '''Checks the list of ancestor terms to see if any are slim_terms
        and if so adds the slim_term to the term in slim_term slot

        for now checking both closure and closure_with_develops_from
        but consider having only single 'ancestor' list
    '''
    id_field = ITEM2OWL[itype].get('id_field')
    if not id_field:
        return term
    slimterms2add = {}
    for slimterm in slim_terms:
        if term.get('closure') and slimterm in term['closure']:
            slimterms2add[slimterm] = slimterm
    if slimterms2add:
        term['slim_terms'] = list(slimterms2add.values())
    return term


def add_slim_terms(terms, slim_terms, itype):
    for termid, term in terms.items():
        term = get_all_ancestors(term, terms, 'parents', itype)
        term = add_slim_to_term(term, slim_terms, itype)
    terms = _cleanup_non_fields(terms)
    return terms


def convert2namespace(uri):
    name, ns = splitNameFromNamespace(uri)

    if '#' in uri:
        ns = ns + '#'
    else:
        ns = ns + '/'
    ns = Namespace(ns)
    return ns[name]


def get_term_uris_as_ns(itype, conf_name):
    ''' will get namespace URIs for synonym or definition terms
        as specified in the config file - will check for general
        case by conf_name and then specific cases in the specific
        item type
    '''
    uris = [convert2namespace(uri) for uri in ITEM2OWL.get(conf_name, [])]
    uris.extend([convert2namespace(uri) for uri in ITEM2OWL[itype].get(conf_name, [])])
    return uris


def get_slim_term_ids_from_db_terms(db_terms, itype):
    '''Retrieves all items from the provided type with 'is_slim_for'
        field populated
    '''
    return [t.get(ITEM2OWL[itype].get('id_field')) for t in db_terms.values() if t.get('is_slim_for')]


def get_existing_items(connection, itype, include_obs_n_del=True):
    '''Retrieves all existing items of itype from db '''
    terms = {}
    search_suffix = 'search/?type={}'.format(itype)
    iid = ITEM2OWL[itype].get('id_field')
    db_terms = search_metadata(search_suffix, connection, page_limit=200, is_generator=True)
    terms = {t[iid]: t for t in db_terms}
    if include_obs_n_del:
        search_suffix += '&status=obsolete&status=deleted'
        more_terms = search_metadata(search_suffix, connection, page_limit=200, is_generator=True)
        terms.update({t[iid]: t for t in more_terms})
    return terms


def connect2server(env=None, key=None, keyfile=None):
    '''Sets up credentials for accessing the server.  Generates a key using info
       from the named keyname in the keyfile and checks that the server can be
       reached with that key.
       Also handles keyfiles stored in s3 using the env param'''
    if key and keyfile:
        keys = None
        if os.path.isfile(keyfile):
            with open(keyfile, 'r') as kf:
                keys_json_string = kf.read()
                keys = json.loads(keys_json_string)
        if keys:
            key = keys.get(key)
    try:
        auth = get_authentication_with_server(key, env)
    except Exception:
        logger.error("Authentication failed")
        sys.exit(1)
    return auth


def remove_obsoletes_and_unnamed(terms, itype):
    name_field = ITEM2OWL[itype].get('name_field')
    terms = {termid: term for termid, term in terms.items()
             if ('parents' not in term) or ('ObsoleteClass' not in term['parents'])}
    terms = {termid: term for termid, term in terms.items()
             if name_field in term and (term[name_field] and not term[name_field].lower().startswith('obsolete'))}
    return terms


def _format_as_raw(val):
    if isinstance(val, dict):
        if 'uuid' in val:
            return val.get('uuid')
        else:
            d = {}
            for f, v in val.items():
                nv = _format_as_raw(v)
                d[f] = nv
            return d
    elif isinstance(val, list):
        nl = []
        for i in val:
            ni = _format_as_raw(i)
            nl.append(ni)
        return nl
    else:
        return val


def get_raw_form(term):
    ''' takes a term dict that could be in embedded or object format
        and transforms to raw (so uuids) are used for linked items
    '''
    raw_term = {}
    for field, val in term.items():
        if isinstance(val, str):
            raw_term[field] = val
        else:
            rawval = _format_as_raw(val)
            if rawval:
                raw_term[field] = rawval

    return raw_term


def compare_terms(t1, t2):
    '''check that all the fields in the first term t1 are in t2 and
        have the same values
    '''
    diff = {}
    for k, val in t1.items():
        if k not in t2:
            diff[k] = val
        elif isinstance(val, list):
            if (len(val) != len(t2[k])) or (Counter(val) != Counter(t2[k])):
                diff[k] = val
        elif val != t2[k]:
            diff[k] = val
    return diff


def check_for_fields_to_keep(term, dbterm):
    ''' see if any of the fields that are not added from the owl
        are present and also check for only other fields that have
        changed
    '''
    patches = {'uuid': term.get('uuid')}
    if 'is_slim_for' in dbterm:
        patches['is_slim_for'] = dbterm['is_slim_for']
    if 'comment' in dbterm:  # should alwawys be true
        patches['comment'] = dbterm['comment']
    return patches


def id_fields2patch(term, dbterm, rm_unch):
    ''' Looks at 2 terms and determines what fields to update
    '''
    rawdbterm = get_raw_form(dbterm)
    diff = compare_terms(term, rawdbterm)
    if rm_unch and not diff:
        return None
    elif rm_unch:
        term = check_for_fields_to_keep(term, rawdbterm)
        term.update(diff)
        return term
    else:
        return term


def id_post_and_patch(terms, dbterms, itype, rm_unchanged=True, set_obsoletes=True):
    '''compares terms to terms that are already in db - if no change
        removes them from the list of updates, if new adds to post dict,
        if changed adds uuid and add to patch dict
    '''
    to_update = []
    to_post = []
    to_patch = {}
    obsoletes = {}
    tid2uuid = {}  # to keep track of existing uuids
    for tid, term in terms.items():
        if tid not in dbterms:
            # new term
            uid = str(uuid4())
            term['uuid'] = uid
            if tid in tid2uuid:
                logger.warn("HAVE SEEN {} BEFORE!".format(tid))
                logger.warn("PREVIOUS={}; NEW={}".format(tid2uuid[tid], uid))
            to_update.append(term)
            tid2uuid[tid] = uid
            to_post.append(tid)
        else:
            # add uuid to mapping and existing term
            dbterm = dbterms[tid]
            uuid = dbterm['uuid']
            if tid in tid2uuid:
                logger.warn("HAVE SEEN {} BEFORE!".format(tid))
                logger.warn("PREVIOUS={}; NEW={}".format(tid2uuid[tid], uid))
            tid2uuid[tid] = uuid
            term['uuid'] = uuid

    # all terms have uuid - now add uuids to linked terms
    for term in terms.values():
        puuids = _get_uuids_for_linked(term, tid2uuid, itype)
        for rt, uuids in puuids.items():
            term[rt] = list(set(uuids))  # to avoid redundant terms

    # now to determine what needs to be patched for patches
    for tid, term in terms.items():
        if tid in to_post:
            continue  # it's a new term
        dbterm = dbterms[tid]
        term = id_fields2patch(term, dbterm, rm_unchanged)
        if not term:
            continue
        to_update.append(term)
        to_patch[tid] = dbterm

    if set_obsoletes:
        # go through db terms and find which aren't in terms and set status
        # to obsolete by adding to to_patch
        # need a way to exclude our own terms and synonyms and definitions
        id_field = ITEM2OWL[itype].get('id_field')
        for tid, term in dbterms.items():
            if tid not in terms and term.get('status') not in ['obsolete', 'deleted']:
                dbuid = term['uuid']
                # add simple term with only status and uuid to to_patch
                obsoletes[tid] = term
                to_update.append({'status': 'obsolete', 'uuid': dbuid})
                tid2uuid[term[id_field]] = dbuid
    logger.info("{} TERMS ARE NEW".format(len(to_post)))
    logger.info("Will obsolete {} TERMS".format(len(obsoletes)))
    logger.info("{} LIVE TERMS WILL BE PATCHED".format(len(to_patch)))
    logger.info("NEW TERMS")
    for termid in to_post:
        logger.info("\t{}".format(termid))
    logger.info("OBSOLETE TERMS")
    for t, tinfo in obsoletes.items():
        logger.info("\t{}\t{}\t{}".format(t, tinfo.get('uuid'), tinfo.get(ITEM2OWL[itype].get('name_field'))))
    logger.info("PATCHED TERMS")
    for t, term in to_patch.items():
        logger.info("\t{}\t{}\t{}".format(t, term.get('uuid'), term.get(ITEM2OWL[itype].get('name_field'))))
    return to_update


def _get_uuids_for_linked(term, idmap, itype):
    puuids = {}
    for rt in ['parents', 'slim_terms']:
        tlist = term.get(rt)
        if tlist is not None:
            del term[rt]
            for p in tlist:
                if p in idmap:
                    puuids.setdefault(rt, []).append(idmap[p])
                elif p.startswith(ITEM2OWL[itype].get('ontology_prefix')):
                    logger.warn('{} - MISSING FROM IDMAP'.format(p))
    return puuids


def add_additional_term_info(terms, data, synonym_terms, definition_terms, itype):
    url_field = ITEM2OWL[itype].get('url_field')
    if not url_field:
        return terms
    for termid, term in terms.items():
        try:
            termuri = convert2URIRef(term[url_field])
        except Exception as e:
            continue

        # add any missing synonyms
        synonyms = get_synonyms(termuri, data, synonym_terms)
        if synonyms:
            if 'synonyms' not in term:
                term['synonyms'] = []
            for syn in synonyms:
                if syn not in term['synonyms']:
                    term['synonyms'].append(syn)

        # we only want one definition - may want to add some checking if multiple
        if term.get('definition') is None:
            definitions = get_definitions(termuri, data, definition_terms)
            if definitions:
                term['definition'] = definitions[0]

        dbxrefs = get_dbxrefs(termuri, data)
        if dbxrefs:
            term.setdefault('dbxrefs', []).extend(dbxrefs)
        altids = get_alternative_ids(termuri, data)
        if altids:
            term.setdefault('alternative_ids', []).extend(altids)

    return terms


def _is_deprecated(class_, data):
    dep = list(data.rdfGraph.objects(class_, Deprecated))
    if dep:
        for d in dep:
            if d.datatype and d.datatype.endswith('boolean') and d.value:
                return True
    return False


def download_and_process_owl(itype, input, terms={}, simple=False):
    synonym_terms = get_term_uris_as_ns(itype, 'synonym_uris')
    definition_terms = get_term_uris_as_ns(itype, 'definition_uris')
    data = Owler(input)
    ontv = data.versionIRI
    name_field = ITEM2OWL[itype].get('name_field')
    for class_ in data.allclasses:
        if not _is_deprecated(class_, data):
            if isBlankNode(class_):
                continue
                # terms = process_blank_node(class_, data, terms, simple)
            else:
                termid = get_termid_from_uri(class_)
                if simple and not termid.startswith(ITEM2OWL[itype].get('ontology_prefix')):
                    continue
                if terms.get(termid) is None:
                    terms[termid] = create_term_dict(class_, termid, data, itype)
                else:
                    if name_field not in terms[termid]:
                        terms[termid][name_field] = get_term_name_from_rdf(class_, data)
                    # deal with parents
                terms = process_parents(class_, data, terms)
    # add synonyms and definitions
    terms = add_additional_term_info(terms, data, synonym_terms, definition_terms, itype)
    return terms, ontv


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


def parse_args(args):
    parser = argparse.ArgumentParser(
        description="Process specified Ontologies and create OntologyTerm inserts for updates",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('item_type',
                        choices=['Disorder', 'Phenotype'],
                        help="Item Types to generate from owl ontology - currently Phenotype or Disorder")
    parser.add_argument('--env',
                        default='local',
                        help="The environment to use i.e. fourfront-cgap, cgap-test ....\
                        Default is 'local')")
    parser.add_argument('--input',
                        help="optional url or path to owlfile - overrides the download_url present in script ITEM2OWL config info \
                        Useful for generating items from a specific verion of ontology - otherwise will use current latest")
    parser.add_argument('--key',
                        help="The keypair identifier from the keyfile")
    parser.add_argument('--keyfile',
                        default=os.path.expanduser("~/keypairs.json"),
                        help="The keypair file.  Default is --keyfile=%s" %
                             (os.path.expanduser("~/keypairs.json")))
    parser.add_argument('--outfile',
                        help="the optional path and file to write output default is ./item_type.json ")
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
    parser.add_argument('--full',
                        default=False,
                        action='store_true',
                        help="Default False - set True to generate full file to load - do not filter out existing unchanged terms")
    return parser.parse_args(args)


def owl_runner(value):
    print('Processing: ', value[0]['ontology_name'])
    return download_and_process_owl(*value)


def post_report_document_to_portal(connection, itype):
    ''' Read the log file and encode it for upload as an attachment (blob) and
        post a Document for the log file

        TD: the institution and project are hard coded.  should get this info
        from the user running script?
    '''
    from base64 import b64encode
    inst = '828cd4fe-ebb0-4b36-a94a-d2e3a36cc989'
    proj = '12a92962-8265-4fc0-b2f8-cf14f05db58b'
    meta = {'institution': inst, 'project': proj}
    mimetype = "text/plain"
    rtype = 'document'
    date = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    attach_fn = None
    if os.path.isfile(LOGFILE):
        attach_fn = '{}_update_report_{}.txt'.format(itype, date)
        try:
            os.rename(LOGFILE, attach_fn)
        except OSError as e:
            logger.warn("Cannot rename {}".format(LOGFILE))
    with open(attach_fn, 'rb') as at:
        data = at.read()
    data_href = 'data:%s;base64,%s' % (mimetype, b64encode(data).decode('ascii'))
    # data_href = 'data:%s;base64,%s' % (use_type, b64encode(request.json['href'].encode()).decode('ascii'))
    attach = {'download': attach_fn, 'type': mimetype, 'href': data_href}
    meta['attachment'] = attach
    try:
        res = post_metadata(meta, rtype, connection)
        assert res.get('status') == 'success'
    except Exception as e:
        print("Problem posting report", e)
    return


def prompt_check_for_output_options(load, outfile, itype, server):
    if load:
        choice1 = str(input("load is True - are you sure you want to directly load the output to {} (y/n)?: ".format(server)))
        if choice1.lower() == 'y':
            logger.info('Will load output directly to {}'.format(server))
            if not outfile:
                choice2 = str(input("No outfile provided! - you OK with no saved json (y/n)?: ".format(server)))
                if choice2.lower() == 'y':
                    logger.info('No intermediate json file will be generated')
                    return None, load
        else:
            load = None
    if not outfile:
        outfile = itype + '.json'
    logger.info('Will store output to {}'.format(outfile))
    return outfile, load


def main():
    ''' Given a item type (Disorder or Phenotype) will process owl file containing ontology terms
        for the given item from a url or file provided in script config or via --input parameter
        and comparing to what is currently in system will generate json to post new items or patch
        existing items and either generate a json file specified with --outfile or load directly
        into system if --load is used.

        logging/tracking info
    '''
    start = datetime.datetime.now()
    args = parse_args(sys.argv[1:])
    itype = args.item_type
    logger.info('Processing {} on {}'.format(itype, start))
    connection = connect2server(args.env, args.key, args.keyfile)
    logger.info('Running on {}'.format(connection.get('server')))
    postfile, loaddb = prompt_check_for_output_options(args.load, args.outfile, itype, connection.get('server'))

    logger.debug('Getting existing items from ', args.env)
    db_terms = get_existing_items(connection, itype)
    logger.debug('Grabbing slim term ids')
    slim_terms = get_slim_term_ids_from_db_terms(db_terms, itype)
    terms = {}

    input = args.input
    if not input:
        input = ITEM2OWL[itype].get('download_url', None)
    if input:
        # get all the terms for an ontology with simple processing
        logger.info("Will get ontology data using = {}".format(input))
        terms, ontv = download_and_process_owl(itype, input, terms, True)
    else:
        # bail out
        logger.error("Need url to download file from")
        sys.exit()

    # at this point we've processed the rdf of all the ontologies
    if not ontv:
        ontv = input
    logger.info("Ontology Version Info: {}".format(ontv))
    if terms:
        terms = add_slim_terms(terms, slim_terms, itype)
        terms = remove_obsoletes_and_unnamed(terms, itype)
        filter_unchanged = True
        if args.full:
            filter_unchanged = False
        items2upd = id_post_and_patch(terms, db_terms, itype, filter_unchanged)
        pretty = False
        if args.pretty:
            pretty = True
        write_outfile(items2upd, postfile, pretty)
        if loaddb:
            env = args.env if args.env else 'local'  # may want to change to use key/secret as option to get env
            res = 'TESTING'
            # res = load_items(env, items2upd, itypes=[itype])
            logger.info(res)
            logger.info(json.dumps(items2upd, indent=4))
    stop = datetime.datetime.now()
    logger.info('STARTED: {}'.format(str(start)))
    logger.info('END: {}'.format(str(stop)))
    if args.post_report:
        post_report_document_to_portal(connection, itype)


if __name__ == '__main__':
    main()
