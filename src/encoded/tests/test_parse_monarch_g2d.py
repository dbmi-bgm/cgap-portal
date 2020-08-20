import json
import os
import pytest
import copy
from io import StringIO
from unittest import mock

from collections import OrderedDict
from ..commands import parse_monarch_g2d as pmg2d


pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_pmg2d_get_args_defaults():
    args = []
    args = pmg2d.get_args(args)
    assert args.input == pmg2d.MONARCH_G2D_URL
    assert args.keyfile == os.path.expanduser("~/keypairs.json")
    assert args.outfile == 'gene2disorders.json'
    assert args.load is False
    assert args.post_report is False
    assert args.pretty is False


def test_get_fields_for_item_added_by_file_g2d():
    list2chk = [v.get('field_name') for v in pmg2d.FIELD_MAPPING.values()]
    list2chk.extend(['subject_item', 'object_item'])
    field_list = pmg2d.get_fields_for_item_added_by_file()
    assert all([f in list2chk for f in field_list])


@pytest.fixture
def genes_w_altid_fields():
    return {
        'uuid1': {'hgnc_id': '1'},
        'uuid2': {'entrez_id': '2'},
        'uuid3': {'gene_symbol': 'gene3'},
        'uuid4': {'hgnc_id': '4', 'entrez_id': '4', 'gene_symbol': 'gene4'},
        'uuid5': {'hgnc_id': '5'},
        'uuid6': {'hgnc_id': '5'},
        'uuid7': {'blah': 'blah'}
    }


@pytest.fixture
def id2guid():
    return {
        'HGNC:1': ['uuid1'],
        'NCBIGene:2': ['uuid2'],
        'gene3': ['uuid3'],
        'HGNC:4': ['uuid4'],
        'NCBIGene:4': ['uuid4'],
        'gene4': ['uuid4'],
        'HGNC:5': ['uuid5', 'uuid6']
    }


def test_get_gene2_altid_map(genes_w_altid_fields, id2guid):
    map = pmg2d.get_gene2_altid_map(genes_w_altid_fields)
    assert map == id2guid


@pytest.fixture
def data_dicts_from_lines():
    return [
        {'subject': 'HGNC:1'},
        {'subject': 'NCBIGene:2', 'subject_label': 'Gene2'},
        {'subject': 'blah', 'subject_label': 'gene3'},
        {'subject': 'NCBIGene:4', 'subject_label': 'gene4'},
        {'irrelevant_field': 'irr_value'},
        {}
    ]


def test_find_uid_from_file_fields(data_dicts_from_lines, id2guid):
    # need to transform id2guid value to string as that is what is used
    id2geneuid = {k: v[0] for k, v in id2guid.items()}
    # in order to test that subject is used preferentially change value
    # of 'gene4' uuid so we can make sure it is not chosen
    id2geneuid['gene4'] = 'bogus'
    expected = ['uuid1', 'uuid2', 'uuid3', 'uuid4', None, None]
    for i, di in enumerate(data_dicts_from_lines):
        gid = pmg2d.find_gene_uid_from_file_fields(di, id2geneuid)
        assert gid == expected[i]


def test_parse_vals():
    # testing that the specific source vals are being parsed correctly
    # currently not testing generally
    vals = [
        'https://archive.monarchinitiative.org/#omim',
        'https://data.monarchinitiative.org/ttl/clinvar.nt',
        'https://archive.monarchinitiative.org/#gwascatalog',
        'https://archive.monarchinitiative.org/#orphanet'
    ]
    expected = ['omim', 'clinvar.nt', 'gwascatalog', 'orphanet']
    received = pmg2d._parse_vals(vals)
    assert received == expected


@pytest.fixture
def g2devi_schema():
    """ Stripped down version of the schema for testing
        Has mainly values used in this script and most types of fields
        NOTE: added pattern to datasource_version that does not exist in real schema
    """
    return {
        "title": "Association Evidence for Genes to Disorders",
        "type": "object",
        "required": ["object_item", "subject_item", "datasource"],
        "properties": {
            "subject_item": {
                "title": "Gene",
                "type": "string",
                "linkTo": "Gene"
            },
            "object_item": {
                "title": "Disorder",
                "type": "string",
                "linkTo": "Disorder"
            },
            "datasource": {
                "title": "Datasource",
                "type": "string",
                "description": "The data source of the association - ClinGen, Monarch or others",
                "enum": ["ClinGen", "Monarch"]
            },
            "datasource_version": {
                "title": "Datasource Version",
                "description": "The version or date of the datasource",
                "type": "string",
                "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}.*"
            },
            "relationship_name": {
                "enum": [
                    "has curated association",
                    "causes condition",
                    "contributes to",
                    "contributes to condition",
                    "is causal gain of function germline mutation of in",
                    "is causal germline mutation in",
                    "is causal loss of function germline mutation of in",
                    "is causal somatic mutation in",
                    "is causal susceptibility factor for",
                    "is marker for"
                ]
            },
            "evidence_class": {
                "title": "Evidence Classifications",
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": [
                        "genomic context evidence",
                        "imported automatically asserted information used in automatic assertion",
                        "combinatorial evidence used in automatic assertion",
                        "inference from background scientific knowledge used in manual assertion",
                        "imported manually asserted information used in automatic assertion",
                        "sequencing assay evidence"
                    ]
                }
            },
            "original_source": {
                "title": "Originating source(s)",
                "type": "array",
                "items": {
                    "type": "string",
                    "title": "Source DB",
                    "uniqueItems": True
                }
            }
        }
    }


def test_gather_validation_info_no_info():
    assert not pmg2d.gather_validation_info(None, None)


def test_gather_validation_info_schema_only(g2devi_schema):
    expected_fields = {'datasource': 2, 'datasource_version': 'pattern', 'relationship_name': 10,
                       'evidence_class': 6}
    vinfo = pmg2d.gather_validation_info(g2devi_schema, None)
    assert len(vinfo) == len(expected_fields)
    for k, v in vinfo.items():
        if k == 'datasource_version':
            assert v.get('pattern') == '^[0-9]{4}-[0-9]{2}-[0-9]{2}.*'
        else:
            assert len(v.get('enum')) == expected_fields.get(k)


def test_gather_validation_info_from_fieldmap_only():
    fmap = pmg2d.FIELD_MAPPING
    expected_fields = {v.get('field_name'): v.get('validate') for v in fmap.values() if 'validate' in v}
    vinfo = pmg2d.gather_validation_info(None, fmap)
    assert len(vinfo) == len(expected_fields)  # assuring no extras
    for f, v in vinfo.items():
        assert expected_fields.get(f) == v


def test_gather_validation_info_from_both(g2devi_schema):
    """ Here we just confirm we get the correct number of fields and to assure that
        we can get both a pattern and an enum we tweak the schema artificially to add pattern to datasource
        not that this is likely to happen in reality
    """
    g2devi_schema['properties']['datasource']['pattern'] = '^[Monarch|ClinGen]$'
    fmap = pmg2d.FIELD_MAPPING
    expected_count = 6
    vinfo = pmg2d.gather_validation_info(g2devi_schema, fmap)
    assert len(vinfo) == expected_count  # assuring no extras
    dsinfo = vinfo.get('datasource')
    assert len(dsinfo) == 2
    assert 'enum' in dsinfo
    assert 'pattern' in dsinfo


def test_is_valid_g2d_no_annot():
    assert not pmg2d.is_valid_g2d({}, None, {})


def test_is_valid_g2d_no_vinfo():
    assert pmg2d.is_valid_g2d({'test': 'minimal'}, None, {})


def test_is_valid_g2d_no_fields_to_validate():
    assert pmg2d.is_valid_g2d({'test': 'minimal'}, {'valid': 'field'}, {})


def test_is_valid_g2d_string_enum_is_valid():
    annot = {'test_field': 'string1'}
    vinfo = {'test_field': {'enum': ['string1']}}
    problems = {}
    assert pmg2d.is_valid_g2d(annot, vinfo, problems)
    assert not problems


def test_is_valid_g2d_string_enum_invalid():
    annot = {'test_field': 'string1'}
    vinfo = {'test_field': {'enum': ['string2']}}
    problems = {}
    assert not pmg2d.is_valid_g2d(annot, vinfo, problems)
    prob_annot = problems['enum_invalid'][0]
    assert 'test_field' in prob_annot
    assert 'enum_problems' in prob_annot


def test_is_valid_g2d_list_enum_valid():
    annot = {'test_field': ['item1', 'item2']}
    vinfo = {'test_field': {'enum': ['item1', 'item2', 'item3']}}
    problems = {}
    assert pmg2d.is_valid_g2d(annot, vinfo, problems)
    assert not problems


def test_is_valid_g2d_list_enum_invalid():
    annot = {'test_field': ['item1', 'item2', 'item3', 'item4']}
    vinfo = {'test_field': {'enum': ['item2', 'item4']}}
    problems = {}
    assert not pmg2d.is_valid_g2d(annot, vinfo, problems)
    prob_annot = problems['enum_invalid'][0]
    assert 'test_field' in prob_annot
    assert all([p for p in prob_annot['enum_problems'] if p in ['item1', 'item3']])


def test_is_valid_g2d_string_pattern_is_valid():
    annot = {'test_field': 'PMID:123'}
    vinfo = {'test_field': {'pattern': '^PMID:[0-9]+$'}}
    problems = {}
    assert pmg2d.is_valid_g2d(annot, vinfo, problems)
    assert not problems


def test_is_valid_g2d_string_pattern_invalid():
    annot = {'test_field': 'PMID:123'}
    vinfo = {'test_field': {'pattern': '^PMID:[A-Z]+$'}}
    problems = {}
    assert not pmg2d.is_valid_g2d(annot, vinfo, problems)
    prob_annot = problems['pattern_mismatch'][0]
    assert 'test_field' in prob_annot
    assert 'pattern_problem' in prob_annot


def test_is_valid_g2d_list_pattern_is_valid():
    annot = {'test_field': ['PMID:123', 'PMID:67812', 'PMID:44444444']}
    vinfo = {'test_field': {'pattern': '^PMID:[0-9]+$'}}
    problems = {}
    assert pmg2d.is_valid_g2d(annot, vinfo, problems)
    assert not problems


def test_is_valid_g2d_list_pattern_invalid():
    annot = {'test_field': ['PMID:123', 'PMID:ABC', 'PMID:44444444', 'AAA AAA']}
    vinfo = {'test_field': {'pattern': '^PMID:[0-9]+$'}}
    problems = {}
    assert not pmg2d.is_valid_g2d(annot, vinfo, problems)
    prob_annot = problems['pattern_mismatch'][0]
    assert 'test_field' in prob_annot
    assert all([p for p in prob_annot['pattern_problem'] if p in ['PMID:ABC', 'AAA AAA']])
