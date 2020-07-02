import pytest
from webtest import AppError
from .workbook_fixtures import app, workbook


pytestmark = [pytest.mark.working, pytest.mark.search]
COMPOUND_SEARCH_URL = '/compound_search'
FILTER_SET_URL = '/filter_set'
VARIANT_URL = '/variant'


@pytest.fixture
def barebones_filter_set():
    """ A filter set with only the flag that designates the type """
    return {
        'search_type': 'Variant',
        'flags': [
            {
                'name': 'variant',
                'query': '?type=Variant'
            }
        ],
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


def test_filter_set_barebones(workbook, testapp, barebones_filter_set):
    """ Tests posting a filter set and executing it through the /compound_search route """
    res = testapp.post_json(FILTER_SET_URL, barebones_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']
    testapp.post_json('/index', {})

    # execute given the @id of a filter_set
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 4

    # execute given flags only
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {
        'flags': [  # should have no effect, since no filter_blocks toggle it
            {
                'name': 'project',
                'query': '?type=Project'
            }
        ],
        'search_type': 'Project'  # NOTE: will work since we are not actually validating this
    }).json['@graph']
    assert len(compound_search_res) == 1

    # do it again, this time with a type that will return 404
    testapp.post_json(COMPOUND_SEARCH_URL, {
        'flags': [  # should have no effect, since no filter_blocks toggle it
            {
                'name': 'gene',
                'query': '?type=Gene'
            }
        ],
        'search_type': 'Gene'
    }, status=404)


@pytest.fixture
def simple_filter_set():
    """ A filter set with only the flag that designates the type """
    return {
        'search_type': 'Variant',
        'filter_blocks': [
            {
                'query': 'REF=G&ALT=A',
                'flags_applied': ['variant']
            }
        ],
        'flags': [
            {
                'name': 'variant',
                'query': '?type=Variant'
            }
        ],
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


def test_filter_set_simple(workbook, testapp, simple_filter_set):
    """ Test posting a non-trivial (but simple) filter set """
    res = testapp.post_json(FILTER_SET_URL, simple_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']
    testapp.post_json('/index', {})

    # execute filter_blocks only
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {
                                                'filter_blocks': [{
                                                    'query': 'type=variant&CHROM=1',
                                                    'flags_applied': []
                                                }],
                                                'search_type': 'Variant'
                                            }).json['@graph']
    assert len(compound_search_res) == 4

    # execute given flags only
    compound_search_res = testapp.post_json('/compound_search', {
        'flags': [  # should have no effect, since no filter_blocks toggle it
            {
                'name': 'project',
                'query': '?type=Project'
            }
        ],
        'search_type': 'Project'
    }).json['@graph']
    assert len(compound_search_res) == 1

    # execute the same search using filter_blocks and flags
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {
        'filter_blocks': [{
            'query': 'CHROM=1',
            'flags_applied': ['variant']
        }],
        'flags': [
            {
                'name': 'variant',
                'query': '?type=Variant'
            }
        ],
        'search_type': 'Variant'
    }).json['@graph']
    assert len(compound_search_res) == 4

    # do similar search with @id
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 1


@pytest.fixture
def typical_filter_set():
    """ A filter set with two filter blocks and a flag """
    return {
        'search_type': 'Variant',
        'filter_blocks': [
            {
                'query': 'ALT=T&hg19.hg19_chrom=chr1',
                'flags_applied': ['variant']
            },
            {
                'query': 'REF=G&ALT=A',
                'flags_applied': ['variant']
            },
        ],
        'flags': [
            {
                'name': 'variant',
                'query': '?type=Variant'
            }
        ],
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


def test_filter_set_typical(workbook, testapp, typical_filter_set):
    """ Executes a filter set with multiple filter blocks """
    res = testapp.post_json(FILTER_SET_URL, typical_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']

    # execute the more complicated filter_set by @id
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 3


@pytest.fixture
def complex_filter_set():
    """ A filter set with 3 filter_blocks and a flag """
    return {
        'search_type': 'Variant',
        'filter_blocks': [
            {
                'query': 'ALT=T&hg19.hg19_chrom=chr1',
                'flags_applied': ['variant_chrom']
            },
            {
                'query': 'REF=G&ALT=A',
                'flags_applied': ['variant_chrom']
            },
            {
                'query': 'POS.from=0&POS.to=12125898',
                'flags_applied': ['variant_chrom']
            }
        ],
        'flags': [
            {
                'name': 'variant_chrom',
                'query': '?type=Variant&CHROM=1'
            }
        ],
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi',
        'uuid': '5145195f-c203-41be-9642-7ba6fb4bfb16'
    }


def test_filter_set_complex(workbook, testapp, complex_filter_set):
    """ Executes a 'complex' filter set, toggling and re-searching with certain blocks disabled """
    res = testapp.post_json(FILTER_SET_URL, complex_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']
    t = res['@graph'][0]['search_type']
    filter_blocks = res['@graph'][0]['filter_blocks']
    flags = res['@graph'][0]['flags']

    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 4  # all variants will match

    # Modify POS
    filter_set = {
        'search_type': t,
        'filter_blocks': filter_blocks,
        'flags': flags
    }
    for block in filter_blocks:
        query = block['query']
        if 'POS' in query:
            block['query'] = 'POS.from=0&POS.to=100000'  # exclude 3/4 variants
            break
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 4


def test_filter_set_intersection(workbook, testapp, complex_filter_set):
    """ Uses the complex filter set with an AND filter_set execution, which should be
        functionally identical but will show slightly different results.
    """
    t = complex_filter_set['search_type']
    filter_blocks = complex_filter_set['filter_blocks']
    flags = complex_filter_set['flags']
    filter_set = {
        'search_type': t,
        'filter_blocks': filter_blocks,
        'flags': flags,
        'intersect': True
    }
    testapp.post_json(COMPOUND_SEARCH_URL, filter_set, status=404)  # AND will eliminate all here


@pytest.fixture
def filter_set_with_many_flags():
    """ A filter set with 2 filter blocks and 3 flags applied differently across blocks """
    return {
        'search_type': 'Variant',
        'filter_blocks': [
            {
                'query': 'REF=A&ALT=T',
                'flags_applied': ['position_lower_bound']
            },
            {
                'query': 'REF=A&ALT=G',
                'flags_applied': ['position_upper_bound']
            }
        ],
        'flags': [
            {
                'name': 'variant_chrom',
                'query': '?type=Variant&CHROM=1'
            },
            {
                'name': 'position_upper_bound',
                'query': 'POS.to=100000'
            },
            {
                'name': 'position_lower_bound',
                'query': 'POS.from=100000'
            },
            {
                'name': 'hg19_chrom_is_two',
                'query': 'hg19.hg19_chrom=chr2'
            }
        ],
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi',
        'uuid': 'de3babdb-68da-4c75-a42d-6428c81392d1'
    }


def test_filter_set_selectively_apply_flags(workbook, testapp, filter_set_with_many_flags):
    """ Executes a complex filter set with multiple flags added selectively across fields """
    filter_set = filter_set_with_many_flags
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 2

    # add chr=2 flag, giving no results
    for filter_block in filter_set['filter_blocks']:
        filter_block['flags_applied'].append('hg19_chrom_is_two')
    testapp.post_json(COMPOUND_SEARCH_URL, filter_set, status=404)

    # disable all flags, still only giving 2 results
    for filter_block in filter_set['filter_blocks']:
        filter_block['flags_applied'] = []
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 2

    # enable multiple flags, which should disqualify 1/2 remaining variants
    for filter_block in filter_set['filter_blocks']:
        filter_block['flags_applied'] = ['variant_chrom', 'position_lower_bound']
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 1


# the following tests are distinct in that they aim to test specific behavior associated with
# the compound_search route, NOT with filter_sets themselves. In particular, we test /search
# redirects for certain types of filter_sets that we know don't need to proceed through the
# entire process. - Will 06/17/2020


def execute_and_verify_generator_search(testapp, filter_set, expected):
    """ Iterates through generator returned in json_response, comparing number of entries
        to the number expected
    """
    filter_set['return_generator'] = True
    count = 0
    for _ in testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json:
        count += 1
    assert count == expected


@pytest.fixture
def filter_set_with_only_flags():
    return {
        'search_type': 'Variant',
        'global_flags': 'CHROM=1'
    }


def test_compound_search_only_global_flags(workbook, testapp, filter_set_with_only_flags):
    """ Tests compound search with a filter set that has only flags
        /search redirect is functioning if we get correct facets on the response, which are checked
        explicitly for correctness in this test.
    """
    resp = testapp.post_json(COMPOUND_SEARCH_URL, filter_set_with_only_flags).json
    assert len(resp['@graph']) == 4

    # do generator search
    execute_and_verify_generator_search(testapp, filter_set_with_only_flags, 4)


@pytest.fixture
def filter_set_with_single_filter_block():
    return {
        'search_type': 'Variant',
        'filter_blocks': [{
            'query': 'POS.from=0&POS.to=10000000',
            'flags_applied': []
        }],
        'global_flags': '?type=Variant'
    }


def test_compound_search_single_filter_block(workbook, testapp, filter_set_with_single_filter_block):
    """ Tests compound search with a filter set with only one filter_block.
        /search redirect is functioning if we get facets on the response.
    """
    resp = testapp.post_json(COMPOUND_SEARCH_URL, filter_set_with_single_filter_block).json
    assert len(resp['@graph']) == 1
    assert 'facets' in resp

    # do generator search
    execute_and_verify_generator_search(testapp, filter_set_with_single_filter_block, 1)


@pytest.fixture
def filter_set_with_single_filter_block_and_flags():
    return {
        'search_type': 'Variant',
        'filter_blocks': [{
            'query': 'POS.from=0&POS.to=10000000',
            'flags_applied': ['chrom']
        }],
        'global_flags': '?type=Variant',
        'flags': [
            {
                'name': 'chrom',
                'query': 'CHROM=1'
            }
        ]
    }


def test_compound_search_filter_and_flags(workbook, testapp, filter_set_with_single_filter_block_and_flags):
    """ Tests compound search with a filter set that has one filter block and flags
        /search redirect is functioning if we get facets on the response.
    """
    resp = testapp.post_json(COMPOUND_SEARCH_URL, filter_set_with_single_filter_block_and_flags).json
    assert len(resp['@graph']) == 1
    assert 'facets' in resp

    # do generator search
    execute_and_verify_generator_search(testapp, filter_set_with_single_filter_block_and_flags, 1)
    filter_set_with_single_filter_block_and_flags['return_generator'] = False  # undo side-effect


@pytest.fixture
def filter_set_with_multiple_disabled_flags():
    return {
        'search_type': 'Variant',
        'filter_blocks': [{
            'query': '?type=Variant&POS.from=0&POS.to=10000000',
            'flags_applied': []
        },
        {
            'query': '?type=Variant&REF=A',
            'flags_applied': []
        }],
        'global_flags': '?type=Variant',
        'flags': [
            {
                'name': 'chrom',
                'query': 'CHROM=1'
            }
        ]
    }


def test_compound_search_disabled_flags(workbook, testapp, filter_set_with_multiple_disabled_flags):
    """ Tests a compound search with all flags disabled (raw filter_blocks + global_flags). """
    resp = testapp.post_json(COMPOUND_SEARCH_URL, filter_set_with_multiple_disabled_flags).json
    assert len(resp['@graph']) == 2

    # do generator search
    execute_and_verify_generator_search(testapp, filter_set_with_multiple_disabled_flags, 2)
    filter_set_with_multiple_disabled_flags['limit'] = 1
    execute_and_verify_generator_search(testapp, filter_set_with_multiple_disabled_flags, 2)


@pytest.fixture
def request_with_lots_of_results():
    return {
        'search_type': 'Item',
    }


def test_compound_search_from_to(workbook, testapp, request_with_lots_of_results):
    """ Tests pagination + generator with compound searches """
    paginated_request = request_with_lots_of_results  # since we have a lot of results, paginate through them

    # first, test failures
    def test_failure(from_, limit):
        paginated_request['from'] = from_
        paginated_request['limit'] = limit
        with pytest.raises(AppError):
            testapp.post_json(COMPOUND_SEARCH_URL, paginated_request)
    test_failure(0, -5)
    test_failure(-5, 0)
    test_failure(-3, 1)

    # attempt to paginate
    paginated_request['from'] = 5
    paginated_request['limit'] = 10
    resp = testapp.post_json(COMPOUND_SEARCH_URL, paginated_request).json
    assert len(resp['@graph']) == 10

    # attempt with generator
    paginated_request['from'] = 0
    paginated_request['limit'] = 10
    execute_and_verify_generator_search(testapp, paginated_request, 10)


def test_compound_search_rejects_malformed_filter_sets(testapp):
    """ Tests passing a bunch of malformed filter_sets raises an error. """
    filter_set_without_filter_block_sub_fields = {
        'search_type': 'Variant',
        'filter_blocks': [
            {
                'query': 'CHROM=1'  # no flags_applied field
            }
        ]
    }
    with pytest.raises(AppError):
        testapp.post_json(COMPOUND_SEARCH_URL, filter_set_without_filter_block_sub_fields)
    filter_set_without_filter_block_sub_fields['filter_blocks'][0]['flags_applied'] = []
    del filter_set_without_filter_block_sub_fields['filter_blocks'][0]['query']  # no query
    with pytest.raises(AppError):
        testapp.post_json(COMPOUND_SEARCH_URL, filter_set_without_filter_block_sub_fields)

    filter_set_without_flag_sub_fields = {
        'search_type': 'Variant',
        'flags': [
            {
                'name': 'something'  # no query
            }
        ]
    }
    with pytest.raises(AppError):
        testapp.post_json(COMPOUND_SEARCH_URL, filter_set_without_flag_sub_fields)
    filter_set_without_flag_sub_fields['flags'][0]['query'] = 'type=Variant'
    del filter_set_without_flag_sub_fields['flags'][0]['name']  # no name
    with pytest.raises(AppError):
        testapp.post_json(COMPOUND_SEARCH_URL, filter_set_without_flag_sub_fields)
