import json
import os
import pytest
from io import StringIO

from collections import OrderedDict
from rdflib import URIRef
from ..commands import generate_items_from_owl as gifo
from ..commands.owltools import Owler


pytestmark = [pytest.mark.setone, pytest.mark.working]


class MockedLogger(object):
    def info(self, msg):
        print('INFO: ' + msg)

    def warn(self, msg):
        print('WARNING: ' + msg)

    def error(self, msg):
        print('ERROR: ' + msg)


@pytest.fixture
def mock_logger():
    return MockedLogger()


def test_parse_args_defaults():
    args = ['Disorder']
    args = gifo.parse_args(args)
    assert args.env == 'local'
    assert args.keyfile == os.path.expanduser("~/keypairs.json")
    assert args.load is False
    assert args.post_report is False
    assert args.pretty is False
    assert args.full is False


@pytest.fixture
def connection():
    return {
        "server": "https://cgap.hms.harvard.edu/",
        "key": "testkey",
        "secret": "testsecret"
    }


@pytest.fixture
def owler(mocker):
    return mocker.patch.object(gifo, 'Owler')


@pytest.fixture
def rel_disorders():
    return [
        {
            'disorder_id': 'MONDO:0400005',
            'status': 'released',
            'disorder_name': 'refeeding syndrome',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0400005'
        },
        {
            'disorder_id': 'MONDO:0400004',
            'status': 'released',
            'disorder_name': 'phrynoderma',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0400004'
        },
        {
            'disorder_id': 'MONDO:0300000',
            'status': 'released',
            'disorder_name': 'SSR3-CDG',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0300000'
        },
        {
            'disorder_id': 'MONDO:0200000',
            'status': 'released',
            'disorder_name': 'uterine ligament adenosarcoma',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_0200000'
        }
    ]


@pytest.fixture
def delobs_disorders():
    return [
        {
            'disorder_id': 'MONDO:9999998',
            'status': 'deleted',
            'disorder_name': 'colored thumbs',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999998'
        },
        {
            'disorder_id': 'MONDO:9999999',
            'status': 'obsolete',
            'disorder_name': 'green thumbs',
            'disorder_url': 'http://purl.obolibrary.org/obo/MONDO_9999999'
        }
    ]


@pytest.fixture
def phenotypes():
    return [
        {
            'hpo_id': 'HP:0001507',
            'status': 'released',
            'phenotype_name': 'growth abnormality',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_00001507',
            'is_slim_for': 'Phenotype abnormality'
        },
        {
            'hpo_id': 'HP:0040064',
            'status': 'released',
            'phenotype_name': 'Abnormality of limbs',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_0040064',
            'is_slim_for': 'Phenotype abnormality'
        },
        {
            'hpo_id': 'HP:3000008',
            'status': 'released',
            'phenotype_name': 'Abnormality of mylohyoid muscle',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_3000008'
        },
        {
            'hpo_id': 'HP:0010708',
            'status': 'released',
            'phenotype_name': '1-5 finger syndactyly',
            'hpo_url': 'http://purl.obolibrary.org/obo/HP_0010708'
        }
    ]


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


def test_get_existing_items(mocker, connection, rel_disorders, delobs_disorders):
    disorder_ids = [d.get('disorder_id') for d in rel_disorders + delobs_disorders]
    mocker.patch('encoded.commands.generate_items_from_owl.search_metadata', side_effect=[rel_disorders, delobs_disorders])
    dbdiseases = gifo.get_existing_items(connection, 'Disorder')
    assert len(dbdiseases) == len(rel_disorders) + len(delobs_disorders)
    assert all([d in dbdiseases for d in disorder_ids])


def test_get_existing_items_wo_obsdel(mocker, connection, rel_disorders):
    disorder_ids = [d.get('disorder_id') for d in rel_disorders]
    mocker.patch('encoded.commands.generate_items_from_owl.search_metadata', return_value=rel_disorders)
    dbdiseases = gifo.get_existing_items(connection, 'Disorder', False)
    assert len(dbdiseases) == len(rel_disorders)
    assert all([d in dbdiseases for d in disorder_ids])


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
def raw_item_dict():
    return {
        'string_field': 'a_string',
        'list_string_field': ['a_string', 'b_string', 'c_string'],
        'int_field': 1,
        'num_field': 1.1,
        'boolean_field': True,
        'list_int_field': [1, 2, 3],
        'list_num_field': [1.1, 2.2, 3.3],
        'linked_item_field': 'uuid1',
        'list_linked_item_field': ['uuid1', 'uuid2'],
        'sub_embed_obj_field': {'sef1': 'string', 'sef2': 'uuid1'},
        'list_sub_embed_obj_field': [
            {'sef1': 'string', 'sef2': 'uuid1'},
            {'sef1': 'string2', 'sef2': 'uuid2'}
        ]
    }


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


@pytest.fixture
def embedded_item_dict():
    return {
        'uuid': 'uuid1',
        'string_field': 'a_string',
        'list_string_field': ['a_string', 'b_string', 'c_string'],
        'int_field': 1,
        'num_field': 1.1,
        'boolean_field': True,
        'list_int_field': [1, 2, 3],
        'list_num_field': [1.1, 2.2, 3.3],
        'linked_item_field': {
            'uuid': 'uuid1',
            'display_title': 'dt1',
            '@type': ['Item'],
            'embedded_field1': 'val1',
            'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
        },
        'list_linked_item_field': [
            {
                'uuid': 'uuid1',
                'display_title': 'dt1',
                '@type': ['Item'],
                'embedded_field1': 'val1',
                'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
            },
            {
                'uuid': 'uuid2',
                'display_title': 'dt1',
                '@type': ['Item'],
                'embedded_field1': 'val1',
                'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
            }
        ],
        'sub_embed_obj_field': {
            'sef1': 'string',
            'sef2': {
                'uuid': 'uuid1',
                'display_title': 'dt1',
                '@type': ['Item'],
                'embedded_field1': 'val1',
                'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
            }
        },
        'list_sub_embed_obj_field': [
            {
                'sef1': 'string',
                'sef2': {
                    'uuid': 'uuid1',
                    'display_title': 'dt1',
                    '@type': ['Item'],
                    'embedded_field1': 'val1',
                    'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
                }
            },
            {
                'sef1': 'string2',
                'sef2': {
                    'uuid': 'uuid2',
                    'display_title': 'dt2',
                    '@type': ['Item'],
                    'embedded_field1': 'val1',
                    'embedded_item_field': {'uuid': 'uuid1', 'display_title': 'dt1', '@type': ['Item']}
                }
            }
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


def test_id_post_and_patch_no_changes(mocker, terms, mock_logger):
    dbterms = terms.copy()
    for i, tid in enumerate(dbterms.keys()):
        dbterms[tid].update({'uuid': 'uuid' + str(i + 1)})
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', return_value=None)
    assert not gifo.id_post_and_patch(terms, dbterms, 'Phenotype', logger=mock_logger)


def test_id_post_and_patch_w_new_term(mocker, terms, mock_logger):
    dbterms = terms.copy()
    for i, tid in enumerate(dbterms.keys()):
        dbterms[tid].update({'uuid': 'uuid' + str(i + 1)})
    new_term = {'hpo_id': 'hp:11', 'phenotype_name': 'name11'}
    terms['hp:11'] = new_term
    side_effect = [None] * 9
    side_effect.append(new_term)
    mocker.patch('encoded.commands.generate_items_from_owl.uuid4', return_value='uuid11')
    mocker.patch('encoded.commands.generate_items_from_owl._get_uuids_for_linked', return_value={})
    mocker.patch('encoded.commands.generate_items_from_owl.id_fields2patch', side_effect=side_effect)
    to_update = gifo.id_post_and_patch(terms, dbterms, 'Phenotype', logger=mock_logger)
    new_term.update({'uuid': 'uuid11'})
    assert to_update[0] == new_term


'''
    Old stuff below
'''


@pytest.fixture
def slim_term_list():
    # see ontology_term schema for full schema
    return [{'term_id': 'a_term1', 'uuid': 'uuida1', 'is_slim_for': 'assay'},
            {'term_id': 'a_term2', 'uuid': 'uuida2', 'is_slim_for': 'assay'},
            {'term_id': 'd_term1', 'uuid': 'uuidd1', 'is_slim_for': 'developmental'}]


@pytest.fixture
def slim_terms_by_ont(slim_term_list):
    return [
        [slim_term_list[0],
         slim_term_list[1]],
        [slim_term_list[2]],
        None,
        None,
        None
    ]



@pytest.fixture
def syn_uris():
    return ['http://www.ebi.ac.uk/efo/alternative_term',
            'http://www.geneontology.org/formats/oboInOwl#hasExactSynonym',
            'http://purl.obolibrary.org/obo/IAO_0000118']


@pytest.fixture
def syn_uris_as_URIRef(syn_uris):
    return [gifo.convert2namespace(uri) for uri in syn_uris]


def test_get_slim_terms(mocker, connection, slim_terms_by_ont):
    present = ['developmental', 'assay']
    absent = ['organ', 'system', 'cell']
    test_slim_terms = slim_terms_by_ont
    with mocker.patch('encoded.commands.generate_ontology.search_metadata',
                      side_effect=test_slim_terms):
        terms = gifo.get_slim_terms(connection)
        assert len(terms) == 3
        for term in terms:
            assert term['is_slim_for'] in present
            assert term['is_slim_for'] not in absent



def test_add_slim_terms(terms, slim_term_list):
    terms = gifo.add_slim_terms(terms, slim_term_list, 'Phenotype')
    print(terms)
    for tid, term in terms.items():
        if tid == 'id6':
            assert len(term['slim_terms']) == 2
            assert 'd_term1' in term['slim_terms']
            assert 'a_term1' in term['slim_terms']
        elif tid == 'id9':
            assert 'slim_terms' not in term
        else:
            assert len(term['slim_terms']) == 1
            if tid in ['a_term1', 'id2', 'id3', 'id4']:
                assert term['slim_terms'][0] == 'a_term1'
            elif tid in ['d_term1', 'id7', 'id8']:
                assert term['slim_terms'][0] == 'd_term1'



def check_if_URIRef(uri):
    return isinstance(uri, URIRef)


def test_convert2namespace(syn_uris):
    for uri in syn_uris:
        ns = gifo.convert2namespace(uri)
        assert check_if_URIRef(ns)
        assert str(ns) == uri


def test_get_syndef_terms_as_uri(mocker, syn_uris):
    asrdf = [True, False]
    for rdf in asrdf:
        uris = gifo.get_syndef_terms_as_uri(all_ontology[2], 'synonym_terms', rdf)
        if rdf:
            for uri in uris:
                assert check_if_URIRef(uri)
                assert str(uri) in syn_uris
        else:
            assert str(uri) in syn_uris


def test_get_synonym_term_uris_no_ontology(mocker):
    with mocker.patch('encoded.commands.generate_ontology.get_syndef_terms_as_uri',
                      return_value=[]):
        synterms = gifo.get_synonym_term_uris('ontologys/FAKE')
        assert not synterms


def test_get_definition_term_uris_no_ontology(mocker):
    with mocker.patch('encoded.commands.generate_ontology.get_syndef_terms_as_uri',
                      return_value=[]):
        synterms = gifo.get_definition_term_uris('ontologys/FAKE')
        assert not synterms


def test_get_synonym_term_uris(mocker, syn_uris, syn_uris_as_URIRef):
    asrdf = [True, False]
    with mocker.patch('encoded.commands.generate_ontology.get_syndef_terms_as_uri',
                      return_value=syn_uris_as_URIRef):
        for rdf in asrdf:
            uris = gifo.get_synonym_term_uris('ontid', rdf)
            if rdf:
                for uri in uris:
                    assert check_if_URIRef(uri)
                    assert str(uri) in syn_uris
            else:
                assert str(uri) in syn_uris


def test_get_definition_term_uris(mocker, syn_uris, syn_uris_as_URIRef):
    asrdf = [True, False]
    with mocker.patch('encoded.commands.generate_ontology.get_syndef_terms_as_uri',
                      return_value=syn_uris_as_URIRef):
        for rdf in asrdf:
            uris = gifo.get_synonym_term_uris('ontid', rdf)
            if rdf:
                for uri in uris:
                    assert check_if_URIRef(uri)
                    assert str(uri) in syn_uris
            else:
                assert str(uri) in syn_uris


def test_combine_all_parents_w_no_parents():
    term = {'term_id': 'id1'}
    term = gifo._combine_all_parents(term)
    assert not term['all_parents']  # both should be empty lists
    assert not term['development']


def test_combine_all_parents_w_empty_parents():
    term = {'term_id': 'id1', 'parents': [], 'relationships': [],
            'develops_from': [], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert not term['all_parents']  # both should be empty lists
    assert not term['development']


def test_combine_all_parents_w_one_parent():
    term = {'term_id': 'id1', 'parents': ['id2'], 'relationships': [],
            'develops_from': [], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 1
    assert term['all_parents'][0] == 'id2'
    assert term['development'] == term['all_parents']


def test_combine_all_parents_w_two_parents():
    term = {'term_id': 'id1', 'parents': ['id2', 'id3'], 'relationships': [],
            'develops_from': [], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 2
    assert 'id2' in term['all_parents']
    assert 'id3' in term['all_parents']
    assert sorted(term['development']) == sorted(term['all_parents'])


def test_combine_all_parents_w_two_same_parents():
    term = {'term_id': 'id1', 'parents': ['id2', 'id2'], 'relationships': [],
            'develops_from': [], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 1
    assert term['all_parents'][0] == 'id2'
    assert term['development'] == term['all_parents']


def test_combine_all_parents_w_parent_and_relationship_diff():
    term = {'term_id': 'id1', 'parents': ['id2'], 'relationships': ['id3'],
            'develops_from': [], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 2
    assert 'id2' in term['all_parents']
    assert 'id3' in term['all_parents']
    assert sorted(term['development']) == sorted(term['all_parents'])


def test_combine_all_parents_w_parent_and_relationship_same():
    term = {'term_id': 'id1', 'parents': ['id2'], 'relationships': ['id2'],
            'develops_from': [], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 1
    assert term['all_parents'][0] == 'id2'
    assert term['development'] == term['all_parents']


def test_combine_all_parents_w_parent_and_develops_from_diff():
    term = {'term_id': 'id1', 'parents': ['id2'], 'relationships': [],
            'develops_from': ['id3'], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 1
    assert len(term['development']) == 2
    assert term['all_parents'][0] == 'id2'
    assert 'id2' in term['development']
    assert 'id3' in term['development']


def test_combine_all_parents_w_parent_and_develops_from_same():
    term = {'term_id': 'id1', 'parents': ['id2'], 'relationships': [],
            'develops_from': ['id2'], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 1
    assert term['all_parents'][0] == 'id2'
    assert term['development'] == term['all_parents']


def test_combine_all_parents_w_only_develops_from():
    term = {'term_id': 'id1', 'parents': [], 'relationships': [],
            'develops_from': ['id2'], 'has_part_inverse': []}
    term = gifo._combine_all_parents(term)
    assert not term['all_parents']
    assert len(term['development']) == 1
    assert term['development'][0] == 'id2'


def test_combine_all_parents_w_has_part_inverse_only():
    term = {'term_id': 'id1', 'parents': [], 'relationships': [],
            'develops_from': [], 'has_part_inverse': ['id2']}
    term = gifo._combine_all_parents(term)
    assert not term['all_parents']  # both should be empty lists
    assert not term['development']


def test_combine_all_parents_w_has_part_inverse_to_exclude():
    term = {'term_id': 'id1', 'parents': [], 'relationships': [],
            'develops_from': ['id2'], 'has_part_inverse': ['id2']}
    term = gifo._combine_all_parents(term)
    assert not term['all_parents']  # both should be empty lists
    assert not term['development']


def test_combine_all_parents_w_has_part_inverse_to_exclude_plus_others():
    term = {'term_id': 'id1', 'parents': ['id2'], 'relationships': [],
            'develops_from': ['id3', 'id4', 'id5'], 'has_part_inverse': ['id4', 'id5', 'id6']}
    term = gifo._combine_all_parents(term)
    assert len(term['all_parents']) == 1
    assert len(term['development']) == 2
    assert term['all_parents'][0] == 'id2'
    assert 'id2' in term['development']
    assert 'id3' in term['development']









def test_add_term_and_info(uberon_owler2):
    testid = 'UBERON:0001772'
    relid = 'UBERON:0010304'
    for c in uberon_owler2.allclasses:
        if gifo.isBlankNode(c):
            test_class = c
    parent = gifo.convert2URIRef('http://purl.obolibrary.org/obo/UBERON_0001772')
    terms = gifo._add_term_and_info(test_class, parent, 'test_rel', uberon_owler2, {})
    assert testid in terms
    term = terms[testid]
    assert term['term_id'] == testid
    assert relid in term['test_rel']


def test_process_intersection_of(uberon_owler3):
    terms = {}
    for c in uberon_owler3.allclasses:
        for i in uberon_owler3.rdfGraph.objects(c, gifo.IntersectionOf):
            terms = gifo.process_intersection_of(c, i, uberon_owler3, terms)
    assert len(terms) == 1
    term = list(terms.values())[0]
    assert len(term['relationships']) == 1
    assert term['relationships'][0] == 'UBERON:1'
    assert len(term['develops_from']) == 1
    assert term['develops_from'][0] == 'UBERON:2'


def test_process_blank_node(uberon_owler3):
    terms = {}
    for c in uberon_owler3.allclasses:
        terms = gifo.process_blank_node(c, uberon_owler3, terms)
    assert len(terms) == 1
    assert 'UBERON:0001772' in terms


def test_find_and_add_parent_of(uberon_owler4):
    tid = 'CL:0002553'
    terms = {tid: {'term_id': tid}}
    relids = ['UBERON:0002048', 'OBI:0000456', 'CL:0000058', 'CL:0000133']
    relation = None
    seen = False
    for c in uberon_owler4.allclasses:
        for _, p in enumerate(uberon_owler4.get_classDirectSupers(c, excludeBnodes=False)):
            if gifo.isBlankNode(p):
                has_part = False
                if not seen:
                    has_part = True
                    seen = True
                terms = gifo._find_and_add_parent_of(p, c, uberon_owler4, terms, has_part, relation)
    assert len(terms) == 2
    print(terms)
    for termid, term in terms.items():
        if termid == tid:
            assert len(term['relationships']) == 3
            for t in term['relationships']:
                assert t in relids
        else:
            assert termid in relids
            assert len(term['has_part_inverse']) == 1
            assert term['has_part_inverse'][0] == tid







@pytest.fixture
def mock_get_synonyms(mocker):
    syn_lists = [[], ['syn1'], ['syn1', 'syn2']]
    return mocker.patch('encoded.commands.generate_ontology.get_synonyms', side_effect=syn_lists)


@pytest.fixture
def mock_get_definitions(mocker):
    def_lists = [[], ['def1'], ['def1', 'def2']]
    return mocker.patch('encoded.commands.generate_ontology.get_synonyms', side_effect=def_lists)





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
    # import pdb; pdb.set_trace()
    print(simple_terms)
    filename = 'tmp_test_file'
    gifo.write_outfile(list(simple_terms.values()), filename)
    with open(filename, 'r') as infile:
        for l in infile:
            result = json.loads(l)
            for v in simple_terms.values():
                assert v in result
    os.remove(filename)


@pytest.fixture
def matches():
    return [{'term_id': 't1', 'a': 1, 'b': 2, 'c': 3}, {'term_id': 't1', 'a': 1, 'b': 2, 'c': 3}]


def test_terms_match_identical(matches):
    assert gifo._terms_match(matches[0], matches[1])


def test_terms_match_w_parents(matches):
    t1 = matches[0]
    t2 = matches[1]
    p1 = ['OBI:01', 'EFO:01']
    p2 = [{'@id': '/ontology-terms/OBI:01/', 'display_title': 'blah'},
          {'@id': '/ontology-terms/EFO:01/', 'display_title': 'hah'}]
    t1['parents'] = p1
    t2['parents'] = p2
    assert gifo._terms_match(t1, t2)


def test_terms_match_unmatched_parents_1(matches):
    t1 = matches[0]
    t2 = matches[1]
    p1 = ['OBI:01', 'EFO:01']
    p2 = [{'@id': '/ontology-terms/OBI:01/', 'display_title': 'blah'}]
    t1['parents'] = p1
    t2['parents'] = p2
    assert not gifo._terms_match(t1, t2)


def test_terms_match_unmatched_parents_2(matches):
    t1 = matches[0]
    t2 = matches[1]
    p1 = ['OBI:01', 'EFO:01']
    p2 = [{'@id': '/ontology-terms/OBI:01/', 'display_title': 'blah'},
          {'@id': '/ontology-terms/EFO:02/', 'display_title': 'hah'}]
    t1['parents'] = p1
    t2['parents'] = p2
    assert not gifo._terms_match(t1, t2)


def test_terms_match_w_ontology(matches):
    t1 = matches[0]
    t2 = matches[1]
    o1 = '530016bc-8535-4448-903e-854af460b254'
    o2 = {'@id': '/ontologys/530016bc-8535-4448-903e-854af460b254/', 'display_title': 'blah'}
    t1['source_ontologies'] = [o1]
    t2['source_ontologies'] = [o2]
    assert gifo._terms_match(t1, t2)


@pytest.fixture
def ont_terms(matches):
    t2 = matches[1]
    t2['term_id'] = 't2'
    t2['parents'] = ['OBI:01', 'EFO:01']
    return {
        't1': matches[0],
        't2': t2,
        't3': {'term_id': 't3', 'x': 7, 'y': 8, 'z': 9}
    }


@pytest.fixture
def ontology_list():
    return [
        {'uuid': '1', 'ontology_name': 'ont1'},
        {'uuid': '2', 'ontology_name': 'ont2'}
    ]


@pytest.fixture
def db_terms(ont_terms):
    db_terms = ont_terms.copy()
    db_terms['t1']['uuid'] = '1234'
    db_terms['t2']['uuid'] = '5678'
    del db_terms['t2']['parents']
    del db_terms['t3']
    return db_terms


def test_id_post_and_patch_filter(ont_terms, db_terms, ontology_list):
    result = gifo.id_post_and_patch(ont_terms, db_terms, ontology_list)
    assert len(result) == 1
    assert 't3' == result[0].get('term_id')
    # assert len(idmap) == 3
    # for k, v in idmap.items():
    #     assert k in ['t1', 't2', 't3']
    #     if k != 't3':  # t1 and t2 already had uuids
    #         assert v in ['1234', '5678']


def test_id_post_and_patch_no_filter(ont_terms, db_terms, ontology_list):
    tids = ['t1', 't2', 't3']
    result = gifo.id_post_and_patch(ont_terms, db_terms, ontology_list, False)
    assert len(result) == 3
    for t in result:
        # assert t.get('term_id') in idmap
        assert t.get('term_id') in tids


# def test_id_post_and_patch_id_obs(ont_terms, db_terms, ontology_list):
#     db_terms['t4'] = {'term_id': 't4', 'source_ontologies': {'uuid': '1', 'ontology_name': 'ont1'}, 'uuid': '7890'}
#     result = gifo.id_post_and_patch(ont_terms, db_terms, ontology_list)
#     assert len(result) == 2
#     assert '7890' in [t.get('uuid') for t in result]
#     # assert 't4' in idmap


def test_id_post_and_patch_donot_obs(ont_terms, db_terms, ontology_list):
    db_terms['t4'] = {'term_id': 't4', 'source_ontologies': {'uuid': '1', 'ontology_name': 'ont1'}, 'uuid': '7890'}
    result = gifo.id_post_and_patch(ont_terms, db_terms, ontology_list, True, False)
    assert 't4' not in [t.get('term_id') for t in result]
    # assert 't4' not in idmap


# def test_id_post_and_patch_ignore_4dn(ont_terms, db_terms, ontology_list):
#     db_terms['t4'] = {'term_id': 't4', 'source_ontologies': {'uuid': '4', 'ontology_name': '4DN ont'}, 'uuid': '7890'}
#     result = gifo.id_post_and_patch(ont_terms, db_terms, ontology_list)
#     print(result)
#     assert 't4' not in [t.get('term_id') for t in result]
#     # assert 't4' not in idmap


def valid_uuid(uid):
    validchars = '0123456789abcdef'
    uid = uid.replace('-', '')
    if len(uid) != 32:
        return False
    for c in uid:
        if c not in validchars:
            return False
    return True


@pytest.fixture
def embedded_dbterm():
    return {
         "synonyms": [
            "renal pelvis uroepithelium",
            "renal pelvis transitional epithelium",
            "pelvis of ureter uroepithelium",
            "renal pelvis urothelium",
            "kidney pelvis uroepithelium",
            "uroepithelium of pelvis of ureter",
            "urothelium of pelvis of ureter",
            "uroepithelium of kidney pelvis",
            "transitional epithelium of kidney pelvis",
            "transitional epithelium of renal pelvis",
            "urothelium of kidney pelvis",
            "uroepithelium of renal pelvis",
            "urothelium of renal pelvis",
            "kidney pelvis transitional epithelium",
            "pelvis of ureter urothelium"
          ],
          "preferred_name": "kidney pelvis urothelium",
          "references": [

          ],
          "external_references": [

          ],
          "status": "released",
          "term_name": "kidney pelvis urothelium",
          "submitted_by": {
            "principals_allowed": {
              "edit": [
                "group.admin",
                "userid.986b362f-4eb6-4a9c-8173-3ab267307e3a"
              ],
              "view": [
                "group.admin",
                "group.read-only-admin",
                "remoteuser.EMBED",
                "remoteuser.INDEXER",
                "userid.986b362f-4eb6-4a9c-8173-3ab267307e3a"
              ]
            },
            "@id": "/users/986b362f-4eb6-4a9c-8173-3ab267307e3a/",
            "@type": [
              "User",
              "Item"
            ],
            "uuid": "986b362f-4eb6-4a9c-8173-3ab267307e3a",
            "display_title": "4dn DCIC"
          },
          "display_title": "kidney pelvis urothelium",
          "schema_version": "1",
          "@type": [
            "OntologyTerm",
            "Item"
          ],
          "parents": [
            {
              "principals_allowed": {
                "edit": [
                  "group.admin"
                ],
                "view": [
                  "system.Everyone"
                ]
              },
              "@id": "/ontology-terms/UBERON:0001254/",
              "@type": [
                "OntologyTerm",
                "Item"
              ],
              "uuid": "38dbff69-aac7-46a4-837e-7340c2c5bcd5",
              "display_title": "urothelium of ureter"
            },
            {
              "principals_allowed": {
                "edit": [
                  "group.admin"
                ],
                "view": [
                  "system.Everyone"
                ]
              },
              "@id": "/ontology-terms/UBERON:0004819/",
              "@type": [
                "OntologyTerm",
                "Item"
              ],
              "uuid": "57ac2905-0533-43c9-988b-9add8c225a78",
              "display_title": "kidney epithelium"
            }
          ],
          "date_created": "2017-05-11T16:00:51.747446+00:00",
          "term_id": "UBERON:0004788",
          "source_ontology": {
            "uuid": "530016bc-8535-4448-903e-854af460b254",
            "display_title": "Uberon",
            "principals_allowed": {
              "edit": [
                "group.admin"
              ],
              "view": [
                "system.Everyone"
              ]
            },
            "@id": "/ontologys/530016bc-8535-4448-903e-854af460b254/",
            "@type": [
              "Ontology",
              "Item"
            ],
            "ontology_name": "Uberon"
          },
          "uuid": "e5e1690a-1a80-4e50-a3cf-58f2f269abd8",
          "term_url": "http://purl.obolibrary.org/obo/UBERON_0004788",
          "last_modified": {
            "date_modified": "2018-07-11T05:05:30.826642+00:00",
            "modified_by": {
              "principals_allowed": {
                "edit": [
                  "group.admin",
                  "userid.986b362f-4eb6-4a9c-8173-3ab267307e3a"
                ],
                "view": [
                  "group.admin",
                  "group.read-only-admin",
                  "remoteuser.EMBED",
                  "remoteuser.INDEXER",
                  "userid.986b362f-4eb6-4a9c-8173-3ab267307e3a"
                ]
              },
              "@id": "/users/986b362f-4eb6-4a9c-8173-3ab267307e3a/",
              "@type": [
                "User",
                "Item"
              ],
              "uuid": "986b362f-4eb6-4a9c-8173-3ab267307e3a",
              "display_title": "4dn DCIC"
            }
          },
          "principals_allowed": {
            "edit": [
              "group.admin"
            ],
            "view": [
              "system.Everyone"
            ]
          },
          "@id": "/ontology-terms/UBERON:0004788/",
          "slim_terms": [
            {
              "principals_allowed": {
                "edit": [
                  "group.admin"
                ],
                "view": [
                  "system.Everyone"
                ]
              },
              "term_name": "endoderm",
              "display_title": "endoderm",
              "is_slim_for": "developmental",
              "@id": "/ontology-terms/UBERON:0000925/",
              "@type": [
                "OntologyTerm",
                "Item"
              ],
              "uuid": "111121bc-8535-4448-903e-854af460a233"
            },
            {
              "principals_allowed": {
                "edit": [
                  "group.admin"
                ],
                "view": [
                  "system.Everyone"
                ]
              },
              "term_name": "kidney",
              "display_title": "kidney",
              "is_slim_for": "organ",
              "@id": "/ontology-terms/UBERON:0002113/",
              "@type": [
                "OntologyTerm",
                "Item"
              ],
              "uuid": "111167bc-8535-4448-903e-854af460a233"
            },
            {
              "principals_allowed": {
                "edit": [
                  "group.admin"
                ],
                "view": [
                  "system.Everyone"
                ]
              },
              "term_name": "ureter",
              "display_title": "ureter",
              "is_slim_for": "organ",
              "@id": "/ontology-terms/UBERON:0000056/",
              "@type": [
                "OntologyTerm",
                "Item"
              ],
              "uuid": "111148bc-8535-4448-903e-854af460a233"
            },
            {
              "principals_allowed": {
                "edit": [
                  "group.admin"
                ],
                "view": [
                  "system.Everyone"
                ]
              },
              "term_name": "renal system",
              "display_title": "renal system",
              "is_slim_for": "system",
              "@id": "/ontology-terms/UBERON:0001008/",
              "@type": [
                "OntologyTerm",
                "Item"
              ],
              "uuid": "111130bc-8535-4448-903e-854af460a233"
            },
            {
              "principals_allowed": {
                "edit": [
                  "group.admin"
                ],
                "view": [
                  "system.Everyone"
                ]
              },
              "term_name": "mesoderm",
              "display_title": "mesoderm",
              "is_slim_for": "developmental",
              "@id": "/ontology-terms/UBERON:0000926/",
              "@type": [
                "OntologyTerm",
                "Item"
              ],
              "uuid": "111120bc-8535-4448-903e-854af460a233"
            }
          ],
          "namespace": "http://purl.obolibrary.org/obo",
          "definition": "the epithelial lining of the luminal space of the kidney pelvis"
        }


def test_get_raw_form(embedded_dbterm):
    raw_term = gifo.get_raw_form(embedded_dbterm)
    print(raw_term)


def test_update_definition():
    prefix = 'EFO'
    tdef = 'here is EFO definition (EFO)'
    dbdef = 'here is outdated definition (EFO, OBI) and another def (SO)'
    newdef = gifo.update_definition(tdef, dbdef, prefix)
    assert tdef in newdef
    assert 'here is outdated definition (EFO, OBI)' not in newdef


@pytest.fixture
def slim_terms():
    return [
        {
            "uuid": "111119bc-8535-4448-903e-854af460a233",
            "term_name": "ectoderm",
            "term_id": "UBERON:0000924",
            "is_slim_for": "developmental",
        },
        {
            "uuid": "111122bc-8535-4448-903e-854af460a233",
            "preferred_name": "3D chromatin structure",
            "term_name": "chromosome conformation identification objective",
            "term_id": "OBI:0001917",
            "is_slim_for": "assay"
        }
    ]
