import os
import json
import sys
import argparse
import datetime
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
    unified_authentication
)
from dcicutils.s3_utils import s3Utils

EPILOG = __doc__

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


def connect2server(env=None, key=None):
    '''Sets up credentials for accessing the server.  Generates a key using info
       from the named keyname in the keyfile and checks that the server can be
       reached with that key.
       Also handles keyfiles stored in s3'''
    if key == 's3':
        assert env
        key = unified_authentication(None, env)

    if all([v in key for v in ['key', 'secret', 'server']]):
        import ast
        key = ast.literal_eval(key)

    try:
        auth = get_authentication_with_server(key, env)
    except Exception:
        print("Authentication failed")
        sys.exit(1)

    print("Running on: {server}".format(server=auth.get('server')))
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
    to_patch = 0
    obsoletes = 0
    tid2uuid = {}  # to keep track of existing uuids
    for tid, term in terms.items():
        if tid not in dbterms:
            # new term
            uid = str(uuid4())
            term['uuid'] = uid
            if tid in tid2uuid:
                print("WARNING HAVE SEEN {} BEFORE!".format(tid))
                print("PREVIOUS={}; NEW={}".format(tid2uuid[tid], uid))
            to_update.append(term)
            tid2uuid[tid] = uid
            to_post.append(tid)
        else:
            # add uuid to mapping and existing term
            dbterm = dbterms[tid]
            uuid = dbterm['uuid']
            if tid in tid2uuid:
                print("WARNING HAVE SEEN {} BEFORE!".format(tid))
                print("PREVIOUS={}; NEW={}".format(tid2uuid[tid], uuid))
            tid2uuid[tid] = uuid
            term['uuid'] = uuid

    # all terms have uuid - now add uuids to linked terms
    for term in terms.values():
        puuids = _get_uuids_for_linked(term, tid2uuid)
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
        to_patch += 1

    if set_obsoletes:
        # go through db terms and find which aren't in terms and set status
        # to obsolete by adding to to_patch
        # need a way to exclude our own terms and synonyms and definitions
        id_field = ITEM2OWL[itype].get('id_field')
        for tid, term in dbterms.items():
            if tid not in terms and term.get('status') not in ['obsolete', 'deleted']:
                if itype == 'OntologyTerm':
                    source_onts = [so.get('uuid') for so in term.get('source_ontologies', [])]
                    if not source_onts or not [o for o in ontids if o in source_onts]:
                        # don't obsolete terms that aren't in one of the ontologies being processed
                        continue
                dbuid = term['uuid']
                # add simple term with only status and uuid to to_patch
                obsoletes += 1
                to_update.append({'status': 'obsolete', 'uuid': dbuid})
                tid2uuid[term[id_field]] = dbuid
                to_patch += 1
    print("Will obsolete {} TERMS".format(obsoletes))
    print("{} TERMS ARE NEW".format(len(to_post)))
    print("{} LIVE TERMS WILL BE PATCHED".format(to_patch - obsoletes))
    return to_update


def _get_uuids_for_linked(term, idmap):
    puuids = {}
    for rt in ['parents', 'slim_terms']:
        tlist = term.get(rt)
        if tlist is not None:
            del term[rt]
            for p in tlist:
                if p in idmap:
                    puuids.setdefault(rt, []).append(idmap[p])
                else:
                    print('WARNING - ', p, ' MISSING FROM IDMAP')
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


def download_and_process_owl(itype, terms, simple=False):
    synonym_terms = get_term_uris_as_ns(itype, 'synonym_uris')
    definition_terms = get_term_uris_as_ns(itype, 'definition_uris')
    data = Owler(ITEM2OWL[itype]['download_url'])
    ontv = data.versionIRI
    if not terms:
        terms = {}
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
    parser.add_argument('--outfile',
                        help="the optional path and file to write output default is ./item_type.json ")
    parser.add_argument('--pretty',
                        default=False,
                        action='store_true',
                        help="Default False - set True if you want json format easy to read, hard to parse")
    parser.add_argument('--full',
                        default=False,
                        action='store_true',
                        help="Default False - set True to generate full file to load - do not filter out existing unchanged terms")
    parser.add_argument('--env',
                        default='fourfront-cgap',
                        help="The environment to use i.e. fourfront-cgap, cgap-test ....\
                        Default is 'fourfront-cgap')")
    parser.add_argument('--key',
                        default='s3',
                        help="An access key dictionary including key, secret and server.\
                        {'key'='ABCDEF', 'secret'='supersecret', 'server'='http://fourfront-cgap.9wzadzju3p.us-east-1.elasticbeanstalk.com/'}")
    return parser.parse_args(args)


def owl_runner(value):
    print('Processing: ', value[0]['ontology_name'])
    return download_and_process_owl(*value)


def main():
    ''' Downloads latest MONDO OWL file
        and Updates Terms by generating json inserts
    '''
    start = datetime.datetime.now()
    print(str(start))
    args = parse_args(sys.argv[1:])
    itype = args.item_type
    postfile = args.outfile
    if not postfile:
        postfile = '{}.json'.format(itype)
    # if '/' not in postfile:  # assume just a filename given
    #    from pkg_resources import resource_filename
    #    postfile = resource_filename('encoded', postfile)

    print('Writing to %s' % postfile)

    # fourfront connection
    connection = connect2server(args.env, args.key)
    print('Getting existing items from ', args.env)
    db_terms = get_existing_items(connection, itype)
    print('Grabbing slim term ids')
    slim_terms = get_slim_term_ids_from_db_terms(db_terms, itype)
    terms = {}

    print('Processing: ', ITEM2OWL[itype].get('ontology_prefix'))
    if ITEM2OWL[itype].get('download_url', None) is not None:
        # want only simple processing
        simple = True
        # get all the terms for an ontology
        terms, ontv = download_and_process_owl(itype, terms, simple)
    else:
        # bail out
        print("Need url to download file from")
        sys.exit()

    # at this point we've processed the rdf of all the ontologies
    if ontv:
        print("Got data from {}".format(ontv))
    if terms:
        terms = add_slim_terms(terms, slim_terms, itype)
        terms = remove_obsoletes_and_unnamed(terms, itype)
        filter_unchanged = True
        if args.full:
            filter_unchanged = False
        terms2write = id_post_and_patch(terms, db_terms, itype, filter_unchanged)
        # terms2write = add_uuids_and_combine(partitioned_terms)
        pretty = False
        if args.pretty:
            pretty = True
        write_outfile(terms2write, postfile, pretty)
    stop = datetime.datetime.now()
    print('STARTED: ', str(start))
    print('END: ', str(stop))


if __name__ == '__main__':
    main()
