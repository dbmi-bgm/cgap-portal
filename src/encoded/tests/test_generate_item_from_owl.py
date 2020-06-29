import json
import os
import pytest
import copy
from io import StringIO

from collections import OrderedDict
from rdflib import URIRef
from ..commands import generate_items_from_owl as gifo
from ..commands.owltools import Owler


pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_gifo_get_args_defaults():
    args = ['Disorder']
    args = gifo.get_args(args)
    assert args.env == 'local'
    assert args.keyfile == os.path.expanduser("~/keypairs.json")
    assert args.load is False
    assert args.post_report is False
    assert args.pretty is False
    assert args.full is False


@pytest.fixture
def owler(mocker):
    return mocker.patch.object(gifo, 'Owler')


@pytest.fixture
def uberon_owler():
    return Owler('src/encoded/tests/data/documents/test_uberon.owl')


@pytest.fixture
def uberon_owler2():
    return Owler('src/encoded/tests/data/documents/test_uberon2.owl')


@pytest.fixture
def uberon_owler3():
    return Owler('src/encoded/tests/data/documents/test_uberon3.owl')


@pytest.fixture
def uberon_owler4():
    return Owler('src/encoded/tests/data/documents/test_uberon4.owl')


@pytest.fixture
def uberon_owler5():
    return Owler('src/encoded/tests/data/documents/test_uberon5.owl')


@pytest.fixture
def ll_class():
    return gifo.convert2URIRef('http://purl.obolibrary.org/obo/UBERON_0000101')


@pytest.fixture
def mkd_class():
    return gifo.convert2URIRef('http://purl.obolibrary.org/obo/HP_0000003')


@pytest.mark.skip  # XXX: will echo production admin access key if mock fails! DO NOT RE-ENABLE UNTIL REFACTORED - Will
def test_connect2server_w_env(mocker, connection):
    # parameters we pass in don't really matter
    key = "{'server': 'https://cgap.hms.harvard.edu/', 'key': 'testkey', 'secret': 'testsecret'}"
    mocker.patch('encoded.commands.generate_items_from_owl.get_authentication_with_server', return_value=connection)
    retval = gifo.connect2server('fourfront-cgap')
    assert retval == connection


def test_connect2server_w_key(mocker, connection):
    # TODO need to mock file open read etc to get this to work
    mocker.patch('encoded.commands.generate_items_from_owl.os.path.isfile', return_value=True)
    pass


def test_prompt_check_for_output_options_w_load_y_and_file(monkeypatch, mock_logger):
    monkeypatch.setattr('builtins.input', lambda _: 'y')
    ofile, loadit = gifo.prompt_check_for_output_options(True, 'test.out', 'Disorder', 'test_server', mock_logger)
    assert ofile == 'test.out'
    assert loadit


def test_prompt_check_for_output_options_w_load_y_and_no_file(monkeypatch, mock_logger):
    monkeypatch.setattr('builtins.input', lambda _: 'y')
    ofile, loadit = gifo.prompt_check_for_output_options(True, None, 'Disorder', 'test_server', mock_logger)
    assert not ofile
    assert loadit


def test_prompt_check_for_output_options_w_load_y_and_no_file_but_wantit(mocker, mock_logger):
    mocker.patch('builtins.input', side_effect=['y', 'n'])
    ofile, loadit = gifo.prompt_check_for_output_options(True, None, 'Disorder', 'test_server', mock_logger)
    assert ofile == 'Disorder.json'
    assert loadit


def test_prompt_check_for_output_options_wo_load_nofile(mock_logger):
    ofile, loadit = gifo.prompt_check_for_output_options(None, None, 'Disorder', 'test_server', mock_logger)
    assert ofile == 'Disorder.json'
    assert not loadit


def test_prompt_check_for_output_options_wo_load_w_file(mock_logger):
    ofile, loadit = gifo.prompt_check_for_output_options(None, 'test.out', 'Disorder', 'test_server', mock_logger)
    assert ofile == 'test.out'
    assert not loadit


@pytest.fixture
def disorder_gen(rel_disorders):
    return iter(rel_disorders)


@pytest.fixture
def delobs_disorder_gen(delobs_disorders):
    return iter(delobs_disorders)


def test_get_existing_items(mocker, connection, rel_disorders, delobs_disorders):
    ''' Currently this test passes but is not really a unit test and also does not
        quite mock the correct things so should be refactored
    '''
    disorder_ids = [d.get('disorder_id') for d in rel_disorders + delobs_disorders]
    mocker.patch('encoded.commands.generate_items_from_owl.search_metadata', side_effect=[rel_disorders, delobs_disorders])
    dbdiseases = gifo.get_existing_items(connection, 'Disorder')
    assert len(dbdiseases) == len(rel_disorders) + len(delobs_disorders)
    assert all([d in dbdiseases for d in disorder_ids])


def test_get_existing_items_from_db_w_deleted(mocker, connection, disorder_gen, delobs_disorder_gen, rel_disorders, delobs_disorders):
    disorder_ids = [d.get('disorder_id') for d in rel_disorders + delobs_disorders]
    mocker.patch('encoded.commands.generate_items_from_owl.search_metadata', side_effect=[disorder_gen, delobs_disorder_gen])
    dbdiseases = list(gifo.get_existing_items_from_db(connection, 'Disorder'))
    assert len(dbdiseases) == len(rel_disorders) + len(delobs_disorders)
    assert all([dis.get('disorder_id') in disorder_ids for dis in dbdiseases])


def test_get_existing_items_from_db_wo_deleted(mocker, connection, disorder_gen, rel_disorders):
    disorder_ids = [d.get('disorder_id') for d in rel_disorders]
    mocker.patch('encoded.commands.generate_items_from_owl.search_metadata', side_effect=[disorder_gen])
    dbdiseases = list(gifo.get_existing_items_from_db(connection, 'Disorder', include_invisible=False))
    assert len(dbdiseases) == len(rel_disorders)
    assert all([dis.get('disorder_id') in disorder_ids for dis in dbdiseases])


def test_get_existing_items_from_db_w_duplicates(mocker, connection, rel_disorders):
    ''' The tested function is agnostic to duplicates so testing to make sure
        if duplicates are present they are returned
    '''
    rel_disorders.append(rel_disorders[0])  # add the duplicate item
    dgen = iter(rel_disorders)
    disorder_ids = [d.get('disorder_id') for d in rel_disorders]
    mocker.patch('encoded.commands.generate_items_from_owl.search_metadata', side_effect=[dgen])
    dbdiseases = list(gifo.get_existing_items_from_db(connection, 'Disorder', include_invisible=False))
    assert len(dbdiseases) == len(rel_disorders)
    assert all([dis.get('disorder_id') in disorder_ids for dis in dbdiseases])


def test_create_dict_keyed_by_field_from_items_valid_field_for_all(rel_disorders):
    keyfield = 'disorder_id'
    disorder_ids = [d.get(keyfield) for d in rel_disorders]
    disorder_dict = gifo.create_dict_keyed_by_field_from_items(rel_disorders, keyfield)
    assert len(disorder_dict) == len(disorder_ids)
    assert all([d in disorder_dict for d in disorder_ids])


def test_create_dict_keyed_by_field_from_items_valid_field_with_2_empty_1_missing_field(rel_disorders):
    keyfield = 'disorder_id'
    disorder_ids = [d.get(keyfield) for d in rel_disorders]
    rel_disorders.append(None)
    rel_disorders.append({})
    rel_disorders.append({
        'status': 'deleted',
        'disorder_name': 'colored thumbs',
        'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999998'
    })
    disorder_dict = gifo.create_dict_keyed_by_field_from_items(rel_disorders, keyfield)
    assert len(disorder_dict) == len(disorder_ids)
    assert all([d in disorder_dict for d in disorder_ids])


def test_create_dict_keyed_by_field_from_items_duplicates_present_last_returned(rel_disorders):
    keyfield = 'disorder_id'
    chk_id = 'MONDO:0400004'
    alt_name = 'changed'
    disorder_ids = [d.get(keyfield) for d in rel_disorders]
    rel_disorders.append(rel_disorders[0])  # straight duplicate
    alt_disorder = rel_disorders[1].copy()
    alt_disorder['disorder_name'] = alt_name
    rel_disorders.append(alt_disorder)
    disorder_dict = gifo.create_dict_keyed_by_field_from_items(rel_disorders, keyfield)
    assert len(disorder_dict) == len(disorder_ids)
    to_chk = disorder_dict.get(chk_id)
    assert to_chk.get('disorder_name') == alt_name


def test_create_dict_keyed_by_field_from_items_bad_field(rel_disorders):
    keyfield = 'hpo_id'
    disorder_dict = gifo.create_dict_keyed_by_field_from_items(rel_disorders, keyfield)
    assert not disorder_dict


def test_remove_obsoletes_and_unnamed_obsoletes(rel_disorders):
    # add a couple of terms that should be removed - can use existing fixture
    # though in real case won't have status property so ignore
    okids = [d.get('disorder_id') for d in rel_disorders]
    obsoletes_or_unamed = [
        {'disorder_id': 'MONDO:9999997', 'disorder_name': 'Obsolete: defunct', 'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999997'},
        {'disorder_id': 'MONDO:9999996', 'disorder_name': 'whoopy', 'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999996', 'parents': ['ObsoleteClass']},
        {'disorder_id': 'MONDO:9999995', 'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999995'}
    ]
    badids = [d.get('disorder_id') for d in obsoletes_or_unamed]
    rel_disorders.extend(obsoletes_or_unamed)
    # now convert to a dict as expected by the function
    terms = {d.get('disorder_id'): d for d in rel_disorders}
    assert len(terms) == len(okids + badids)
    terms = gifo.remove_obsoletes_and_unnamed(terms, 'Disorder')
    assert len(terms) == len(okids)
    assert all([d in okids for d in terms.keys()])
    assert not any([d in badids for d in terms.keys()])


def test_get_slim_term_ids_from_db_terms(phenotypes):
    okslimids = ['HP:0001507', 'HP:0040064']
    phenos = {p.get('hpo_id'): p for p in phenotypes}
    slimterms = gifo.get_slim_term_ids_from_db_terms(phenos, 'Phenotype')
    assert len(slimterms) == 2
    assert all([st in okslimids for st in slimterms])


def test_get_slim_term_ids_from_db_terms_no_slims(rel_disorders):
    disorders = {p.get('disorder_id'): p for p in rel_disorders}
    slimterms = gifo.get_slim_term_ids_from_db_terms(disorders, 'Disorder')
    assert not slimterms


def test_get_term_uris_as_ns_from_conf():
    # this test getting shared info - we don't yet have a case
    # where there is a specific URI for an item_type
    # also not really unit as depending on convert2namespace function
    uri_cases = {
        'definition_uris': ['http://purl.obolibrary.org/obo/IAO_0000115'],
        'synonym_uris': [
            'http://www.geneontology.org/formats/oboInOwl#hasExactSynonym',
            'http://www.geneontology.org/formats/oboInOwl#hasNarrowSynonym',
            'http://www.geneontology.org/formats/oboInOwl#RelatedSynonym',
        ]
    }
    itype = 'Disorder'  # doesn't matter
    for case in uri_cases.keys():
        uris = gifo.get_term_uris_as_ns(itype, case)
        assert all([str(u) in uri_cases[case] for u in uris])


def test_get_termid_from_uri_no_uri():
    uri = ''
    assert not gifo.get_termid_from_uri(uri)


def test_get_termid_from_uri_valid_uri():
    uri = 'http://www.ebi.ac.uk/efo/EFO_0002784'
    tid = gifo.get_termid_from_uri(uri)
    assert tid == 'EFO:0002784'


def test_get_termid_from_uri_funky_uri1():
    uri = 'http://www.ebi.ac.uk/efo/EFO_UFO_0002784'
    tid = gifo.get_termid_from_uri(uri)
    assert tid == 'EFO:UFO:0002784'


def test_get_termid_from_uri_funky_uri2():
    uri = 'http://www.ebi.ac.uk/efo/EFO0002784'
    tid = gifo.get_termid_from_uri(uri)
    assert tid == 'EFO0002784'


def test_get_term_name_from_rdf_no_name(uberon_owler):
    name = gifo.get_term_name_from_rdf('pickle', uberon_owler)
    assert not name


def test_get_term_name_from_rdf_has_name(uberon_owler, ll_class):
    name = gifo.get_term_name_from_rdf(ll_class, uberon_owler)
    assert name == 'lobe of lung'


def test_get_term_name_from_rdf_no_term(uberon_owler):
    class_ = gifo.convert2URIRef('http://purl.obolibrary.org/obo/UBERON_0000001')
    name = gifo.get_term_name_from_rdf(class_, uberon_owler)
    assert not name


def test_is_deprecated_deprecated(uberon_owler5):
    class_ = gifo.convert2URIRef('http://purl.obolibrary.org/obo/HP_0000057')
    assert gifo._is_deprecated(class_, uberon_owler5)


def test_is_deprecated_not_deprecated(uberon_owler5):
    class_ = gifo.convert2URIRef('http://purl.obolibrary.org/obo/HP_0000003')
    assert not gifo._is_deprecated(class_, uberon_owler5)


def test_create_term_dict(mocker, mkd_class, uberon_owler5):
    mocker.patch('encoded.commands.generate_items_from_owl.get_term_name_from_rdf',
                 return_value='Multicystic kidney dysplasia')
    term = gifo.create_term_dict(mkd_class, 'HP:0000003', uberon_owler5, 'Phenotype')
    assert term == {'hpo_id': 'HP:0000003', 'hpo_url': 'http://purl.obolibrary.org/obo/HP_0000003', 'phenotype_name': 'Multicystic kidney dysplasia'}


def test_process_parents(uberon_owler4):
    tids = ['HP:0000811', 'HP:0010460', 'HP:0000055', 'HP:0000058']
    terms2parents = {
        'HP:0000055': ['HP:0000811', 'HP:0010460'],
        'HP:0000058': ['HP:0000055']
    }
    terms = {t: {'hpo_id': t} for t in tids}
    for c in uberon_owler4.allclasses:
        terms = gifo.process_parents(c, uberon_owler4, terms)
    print(terms)
    for tid, term in terms.items():
        if tid in terms2parents:
            assert sorted(term.get('parents')) == sorted(terms2parents.get(tid))
        else:
            assert 'parents' not in term


@pytest.fixture
def simple_terms():
    terms = {'t1': {'hpo_id': 't1', 'hpo_url': 'term1'},
             't2': {'hpo_id': 't2', 'hpo_url': 'term2'},
             't3': {'hpo_id': 't3', 'hpo_url': 'term3'}}
    return OrderedDict(sorted(terms.items(), key=lambda t: t[0]))


def test_add_additional_term_info(mocker, simple_terms):
    val_lists = [[], ['val1'], ['val1', 'val2']]
    fields = ['definition', 'synonyms', 'dbxrefs', 'alternative_ids']
    mocker.patch('encoded.commands.generate_items_from_owl.convert2URIRef', return_value='blah')
    mocker.patch('encoded.commands.generate_items_from_owl.get_synonyms', side_effect=val_lists)
    mocker.patch('encoded.commands.generate_items_from_owl.get_definitions', side_effect=val_lists)
    mocker.patch('encoded.commands.generate_items_from_owl.get_dbxrefs', side_effect=val_lists)
    mocker.patch('encoded.commands.generate_items_from_owl.get_alternative_ids', side_effect=val_lists)
    result = gifo.add_additional_term_info(simple_terms, 'data', 'synterms', 'defterms', 'Phenotype')
    for tid, term in result.items():
        for f in fields:
            if tid == 't1':
                assert f not in term
            else:
                if f == 'definition':  # only one added
                    assert term[f] == 'val1'
                elif tid == 't2':
                    assert term[f] == val_lists[1]
                else:
                    assert term[f] == val_lists[2]


@pytest.fixture
def returned_synonyms():
    n = 4
    lists = [[], ['test_val1'], ['test_val1', 'test_val2']]
    copies = []
    for l in lists:
        copies.extend([l.copy() for i in range(n)])
    return copies


def test_get_syn_def_dbxref_altid(mocker, owler, returned_synonyms):
    mocker.patch('encoded.commands.generate_items_from_owl.getObjectLiteralsOfType',
                 side_effect=returned_synonyms)
    checks = ['test_val1', 'test_val2']
    class_ = 'test_class'
    terms = ['1']
    for i in range(int(len(returned_synonyms) / 4)):
        synonyms = gifo.get_synonyms(class_, owler, terms)
        definitions = gifo.get_definitions(class_, owler, terms)
        dbxrefs = gifo.get_dbxrefs(class_, owler)
        altids = gifo.get_alternative_ids(class_, owler)
        assert synonyms == definitions == dbxrefs == altids
        if i == 0:
            assert not synonyms
        else:
            assert len(synonyms) == i
            for syn in synonyms:
                assert syn in checks


@pytest.fixture
def terms():
    return {
        'hp:1': {
            'hpo_id': 'hp:1',
            'phenotype_name': 'name1',
            'parents': [],
            'is_slim_for': 'Abnormal Phenotype'
        },
        'hp:2': {
            'hpo_id': 'hp:2',
            'phenotype_name': 'name2',
            'parents': ['name1', 'ObsoleteClass'],
        },
        'hp:3': {
            'hpo_id': 'hp:3',
            'phenotype_name': 'name3',
            'parents': ['hp:1'],
        },
        'hp:4': {
            'hpo_id': 'hp:4',
            'phenotype_name': 'name4',
            'parents': ['hp:1', 'hp:2']
        },
        'hp:5': {
            'hpo_id': 'hp:5',
            'phenotype_name': 'name5',
            'parents': ['hp:4']
        },
        'hp:6': {
            'hpo_id': 'hp:6',
            'phenotype_name': 'name6',
            'parents': ['hp:5'],
            'is_slim_for': 'Abnormal Phenotype'
        },
        'hp:7': {
            'hpo_id': 'hp:7',
            'parents': ['hp:6']
        },
        'hp:8': {
            'hpo_id': 'hp:8',
            'parents': ['hp:7', 'hp:3']
        },
        'hp:9': {
            'hpo_id': 'hp:9',
            'parents': ['hp:10']
        }
    }


@pytest.fixture
def tid_w_iparents():
    return {
        'hp:1': [],
        'hp:2': [],
        'hp:3': ['hp:1'],
        'hp:4': ['hp:1', 'hp:2'],
        'hp:5': ['hp:1', 'hp:2', 'hp:4'],
        'hp:6': ['hp:1', 'hp:2', 'hp:4', 'hp:5'],
        'hp:7': ['hp:1', 'hp:2', 'hp:4', 'hp:5', 'hp:6'],
        'hp:8': ['hp:1', 'hp:2', 'hp:3', 'hp:4', 'hp:5', 'hp:6', 'hp:7'],
        'hp:9': []
    }


def test_iterative_parents(terms, tid_w_iparents):
    for tid, term in terms.items():
        iparents = gifo.iterative_parents(term['parents'], terms, 'parents')
        assert tid_w_iparents.get(tid) == sorted(iparents)


def test_get_all_ancestors(terms, tid_w_iparents):
    for tid, term in terms.items():
        term = gifo.get_all_ancestors(term, terms, 'parents', 'Phenotype')
        closure = term['closure']
        assert tid in closure  # checks that the term id is included
        closure.remove(tid)
        assert tid_w_iparents.get(tid) == sorted(closure)


@pytest.fixture
def terms_w_closures(terms, tid_w_iparents):
    for tid, term in terms.items():
        closure = tid_w_iparents[tid]
        closure.append(tid)
        term.update({'closure': closure})
    return terms


def test_add_slim_to_term(terms_w_closures):
    slim_ids = ['hp:1', 'hp:6']
    for term in terms_w_closures.values():
        test_term = gifo.add_slim_to_term(term, slim_ids, 'Phenotype')
        if test_term.get('hpo_id') in ['hp:2', 'hp:9']:
            assert 'slim_terms' not in test_term
        elif test_term.get('hpo_id') in ['hp:6', 'hp:7', 'hp:8']:
            assert sorted(test_term['slim_terms']) == ['hp:1', 'hp:6']
        else:
            assert test_term['slim_terms'][0] == 'hp:1'


@pytest.fixture
def terms_w_stuff():
    return {
        'hp:1': {
            'hpo_id': 'id1',
            'phenotype_name': 'term1',
            'parents': ['hp:0'],
            'closure': ['hp:1', 'hp:0'],
        },
        'hp:2': {
            'hpo_id': 'id1',
            'phenotype_name': 'term1',
            'parents': ['hp:0']
        },
        'hp:3': {},
        'hp:4': None
    }


def test_cleanup_non_fields(terms_w_stuff):
    assert len(terms_w_stuff) == 4
    terms = gifo._cleanup_non_fields(terms_w_stuff)
    assert len(terms) == 2
    tvals = list(terms.values())
    assert len(tvals[0]) == 3
    assert tvals[0] == tvals[1]


@pytest.fixture
def object_item_dict():
    return {
        'uuid': 'uuid1',
        'string_field': 'a_string',
        'list_string_field': ['a_string', 'b_string', 'c_string'],
        'int_field': 1,
        'num_field': 1.1,
        'boolean_field': True,
        'list_int_field': [1, 2, 3],
        'list_num_field': [1.1, 2.2, 3.3],
        'linked_item_field': '/item/name1',
        'list_linked_item_field': ['/item/name1', '/item/name2'],
        'sub_embed_obj_field': {'sef1': 'string', 'sef2': '/item/name1'},
        'list_sub_embed_obj_field': [
            {'sef1': 'string', 'sef2': '/item/name1'},
            {'sef1': 'string2', 'sef2': '/item/name2'}
        ]
    }


def test_get_raw_form_raw_and_embedded(raw_item_dict, embedded_item_dict):
    # all term dicts have uuid as it's been added though not included in raw frame view
    raw_item_dict['uuid'] = 'uuid1'
    result1 = gifo.get_raw_form(raw_item_dict)
    result2 = gifo.get_raw_form(embedded_item_dict)
    assert result1 == raw_item_dict
    assert result1 == result2


def test_get_raw_form_does_not_convert_object(raw_item_dict, object_item_dict):
    ''' This may not be necessary but shows object frame of item is not
        converted - and is in fact unchanged
    '''
    rawresult = gifo.get_raw_form(raw_item_dict)
    objresult = gifo.get_raw_form(object_item_dict)
    assert rawresult != objresult
    assert objresult == object_item_dict


def test_compare_terms_no_diff(raw_item_dict):
    t1 = raw_item_dict
    t2 = raw_item_dict.copy()
    assert not gifo.compare_terms(t1, t2)


def test_compare_terms_extra_field_in_t2(raw_item_dict):
    ''' should ignore any extra fields in t2
    '''
    t1 = raw_item_dict
    t2 = raw_item_dict.copy()
    t2['extra_field'] = 'extra_val'
    assert not gifo.compare_terms(t1, t2)


def test_compare_terms_extra_fields_in_t1(raw_item_dict):
    ''' should ignore any extra fields in t2
    '''
    extra_fields = {
        'extra_field1': 'extra_val1',
        'extra_list_field': ['v1', 'v2', 'v3'],
        'extra_obj_field': {'ef1': 'ev1', 'ef2': 'ev2'}
    }
    t1 = raw_item_dict
    t2 = raw_item_dict.copy()
    t1.update(extra_fields)
    result = gifo.compare_terms(t1, t2)
    assert result == extra_fields


def test_check_for_fields_to_keep(raw_item_dict):
    raw_item_dict['uuid'] = 'uuid1'
    fields_to_keep = {
        'is_slim_for': 'Abnormal phenotype',
        'comment': 'some comment'
    }
    added_fields = {'unwanted_field': 'blah'}
    added_fields.update(fields_to_keep)
    dbterm = raw_item_dict.copy()
    dbterm.update(added_fields)
    result = gifo.check_for_fields_to_keep(raw_item_dict, dbterm)
    fields_to_keep['uuid'] = 'uuid1'
    assert result == fields_to_keep


def test_id_fields2patch_unchanged(mocker, raw_item_dict):
    mocker.patch('encoded.commands.generate_items_from_owl.get_raw_form', return_value=raw_item_dict)
    mocker.patch('encoded.commands.generate_items_from_owl.compare_terms', return_value=None)
    assert not gifo.id_fields2patch(raw_item_dict, raw_item_dict, True)


def test_id_fields2patch_keep_term(mocker, raw_item_dict):
    ''' case when remove unchanged (rm_unch) param is False just returns term
    '''
    mocker.patch('encoded.commands.generate_items_from_owl.get_raw_form', return_value=raw_item_dict)
    mocker.patch('encoded.commands.generate_items_from_owl.compare_terms', return_value=None)
    assert gifo.id_fields2patch(raw_item_dict, raw_item_dict, False) == raw_item_dict


def test_id_fields2patch_find_some_fields(mocker, raw_item_dict):
    ''' case when remove unchanged (rm_unch) param is False just returns term
    '''
    patch = {'uuid': 'uuid1', 'field1': 'val1', 'field2': ['a', 'b']}
    mocker.patch('encoded.commands.generate_items_from_owl.get_raw_form', return_value=raw_item_dict)
    mocker.patch('encoded.commands.generate_items_from_owl.compare_terms', return_value=patch)
    assert gifo.id_fields2patch(raw_item_dict, raw_item_dict, True) == patch


@pytest.fixture
def term_w_slims_and_parents():
    return {
        'uuid': 'uuid1',
        'slim_terms': ['HP:0000001', 'HP0000002'],
        'parents': ['HP:0000003']
    }


def test_get_uuids_for_linked_no_linked(term_w_slims_and_parents, mock_logger):
    idmap = {'HP:0000001': 'uuid10', 'HP0000002': 'uuid11', 'HP:0000003': 'uuid12'}
    del term_w_slims_and_parents['parents']
    del term_w_slims_and_parents['slim_terms']
    assert not gifo._get_uuids_for_linked(term_w_slims_and_parents, idmap, 'Phenotype', mock_logger)


def test_get_uuids_for_linked_all_present(term_w_slims_and_parents, mock_logger):
    idmap = {'HP:0000001': 'uuid10', 'HP0000002': 'uuid11', 'HP:0000003': 'uuid12'}
    uuids = sorted(idmap.values())
    field2uuid = gifo._get_uuids_for_linked(term_w_slims_and_parents, idmap, 'Phenotype', mock_logger)
    sts = field2uuid.get('slim_terms')
    assert sts == uuids[:2]
    pts = field2uuid.get('parents')
    assert pts == uuids[-1:]


def test_get_uuids_for_linked_one_missing(term_w_slims_and_parents, mock_logger, capsys):
    idmap = {'HP:0000001': 'uuid10'}
    del term_w_slims_and_parents['parents']
    uuids = sorted(idmap.values())
    field2uuid = gifo._get_uuids_for_linked(term_w_slims_and_parents, idmap, 'Phenotype', mock_logger)
    sts = field2uuid.get('slim_terms')
    assert sts == uuids
    out = capsys.readouterr()[0]
    assert out == 'WARNING: HP0000002 - MISSING FROM IDMAP\n'


def test_identify_item_updates_no_changes(mocker, terms, mock_logger):
    dbterms = terms.copy()
    for i, tid in enumerate(dbterms.keys()):
        dbterms[tid].update({'uuid': 'uuid' + str(i + 1)})
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', return_value=None)
    assert not gifo.identify_item_updates(terms, dbterms, 'Phenotype', logger=mock_logger)


def test_identify_item_updates_w_new_term(mocker, terms, mock_logger):
    dbterms = copy.deepcopy(terms)
    for i, tid in enumerate(dbterms.keys()):
        dbterms[tid].update({'uuid': 'uuid' + str(i + 1)})
    new_term = {'hpo_id': 'hp:11', 'phenotype_name': 'name11'}
    terms['hp:11'] = new_term
    side_effect = [None] * 9
    side_effect.append(new_term)
    mocker.patch('encoded.commands.generate_items_from_owl.uuid4', return_value='uuid11')
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', side_effect=side_effect)
    to_update = gifo.identify_item_updates(terms, dbterms, 'Phenotype', logger=mock_logger)
    new_term.update({'uuid': 'uuid11'})
    assert to_update[0] == new_term


def test_identify_item_updates_w_patch_term(mocker, terms, mock_logger):
    dbterms = copy.deepcopy(terms)
    added_field = {'definition': 'this is what it means'}
    for i, tid in enumerate(dbterms.keys()):
        dbterms[tid].update({'uuid': 'uuid' + str(i + 1)})
        if i >= 7:
            terms[tid].update(added_field)
    side_effect = [None] * 7
    for n in ['8', '9']:
        se = copy.deepcopy(added_field)
        se.update({'uuid': 'uuid{}'.format(n)})
        side_effect.append(se)
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', side_effect=side_effect)
    to_update = gifo.identify_item_updates(terms, dbterms, 'Phenotype', logger=mock_logger)
    assert len(to_update) == 2
    for upd in to_update:
        assert 'uuid' in upd
        assert upd['definition'] == 'this is what it means'


def test_identify_item_updates_set_obsolete_true_obsolete(mocker, terms, mock_logger):
    """ if set_obsolete is true (the default) then the extra dbterm should be added
        to patches as a term to set to obsolete
    """
    dbterms = copy.deepcopy(terms)
    added_obs = {'hpo_id': 'hp:10', 'definition': 'soon to be obsolete'}
    dbterms.update({added_obs['hpo_id']: added_obs})
    for tid in dbterms.keys():
        uid = tid.replace('hp:', 'uuid')
        dbterms[tid].update({'uuid': uid})
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', return_value=None)
    to_update = gifo.identify_item_updates(terms, dbterms, 'Phenotype', logger=mock_logger)
    assert len(to_update) == 1
    obsterm = to_update[0]
    assert obsterm['uuid'] == 'uuid10'
    assert obsterm['status'] == 'obsolete'


def test_identify_item_updates_set_obsolete_false_do_not_obsolete_live_term(mocker, terms, mock_logger):
    """ if set_obsolete is false then the extra dbterm should not be added to patches
        as a term to set to obsolete as long as it's status is not obsolete or deleted
    """
    dbterms = copy.deepcopy(terms)
    added_obs = {'hpo_id': 'hp:10', 'definition': 'soon to be obsolete'}
    dbterms.update({added_obs['hpo_id']: added_obs})
    for i, tid in enumerate(dbterms.keys()):
        dbterms[tid].update({'uuid': 'uuid' + str(i + 1)})
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', return_value=None)
    to_update = gifo.identify_item_updates(terms, dbterms, 'Phenotype', set_obsoletes=False, logger=mock_logger)
    assert not to_update


def test_identify_item_updates_set_obsolete_true_do_not_patch_obsolete_term(mocker, terms, mock_logger):
    """ if set_obsolete is True then the extra dbterm should not be added to patches
        if it's already status = obsolete
    """
    dbterms = copy.deepcopy(terms)
    added_obs = {'hpo_id': 'hp:10', 'definition': 'already obsolete', 'status': 'obsolete'}
    dbterms.update({added_obs['hpo_id']: added_obs})
    for i, tid in enumerate(dbterms.keys()):
        dbterms[tid].update({'uuid': 'uuid' + str(i + 1)})
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', return_value=None)
    to_update = gifo.identify_item_updates(terms, dbterms, 'Phenotype', logger=mock_logger)
    assert not to_update


def test_write_outfile_pretty(simple_terms):
    filename = 'tmp_test_file'
    gifo.write_outfile(list(simple_terms.values()), filename, pretty=True)
    infile = open(filename, 'r')
    result = json.load(infile)
    print(result)
    for r in result:
        assert r in simple_terms.values()
    os.remove(filename)


def test_write_outfile_notpretty(simple_terms):
    print(simple_terms)
    filename = 'tmp_test_file'
    gifo.write_outfile(list(simple_terms.values()), filename)
    with open(filename, 'r') as infile:
        for l in infile:
            result = json.loads(l)
            for v in simple_terms.values():
                assert v in result
    os.remove(filename)
