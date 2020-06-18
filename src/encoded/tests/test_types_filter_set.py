import pytest
from webtest import AppError
from .workbook_fixtures import app, workbook


pytestmark = [pytest.mark.working, pytest.mark.schema]
COMPOUND_SEARCH_URL = '/compound_search'
FILTER_SET_URL = '/filter_set'
COHORT_URL = '/cohort'
VARIANT_URL = '/variant'


@pytest.fixture
def barebones_filter_set():
    """ A filter set with only the flag that designates the type """
    return {
        'type': 'Variant',
        'flags': '?type=Variant',
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


@pytest.fixture
def simple_filter_set():
    """ A filter set with only the flag that designates the type """
    return {
        'type': 'Cohort',
        'filter_blocks': [
            {
                'query': 'families.proband=GAPID5HBSLG6',
                'flag_applied': True
            }
        ],
        'flags': '?type=Cohort',
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


@pytest.fixture
def standard_filter_set():
    """ A filter set with two filter blocks and a flag """
    return {
        'type': 'Cohort',
        'filter_blocks': [
            {
                'query': 'families.proband=GAPID8J9B9CR',
                'flag_applied': True
            },
            {
                'query': 'families.clinic_notes=xyz',
                'flag_applied': True
            }
        ],
        'flags': '?type=Cohort',
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi'
    }


@pytest.fixture
def complex_filter_set():
    """ A filter set with 3 filter_blocks and a flag """
    return {
        'type': 'Variant',
        'filter_blocks': [
            {
                'query': 'ALT=T&hg19.hg19_chrom=chr1',
                'flag_applied': True
            },
            {
                'query': 'REF=G&ALT=A',
                'flag_applied': True
            },
            {
                'query': 'POS.from=0&POS.to=12125898',
                'flag_applied': True
            }
        ],
        'flags': '?type=Variant&CHROM=1',
        'project': 'hms-dbmi',
        'institution': 'hms-dbmi',
        'uuid': '5145195f-c203-41be-9642-7ba6fb4bfb16'
    }


def toggle_filter_blocks(filter_set, on=True):
    """ Helper method for testing that will 'toggle' filter blocks to True if on=True else
        it will disable them with False.

    :param filter_set: set containing filter_blocks we'd like to toggle
    :param on: whether or not to toggle on, default True
    """
    filter_blocks = filter_set.get('filter_blocks', [])
    for block in filter_blocks:
        block['flag_applied'] = True if on else False


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
        'flags': '?type=project',
        'type': 'Project'  # NOTE: will work since we are not actually validating this
    }).json['@graph']
    assert len(compound_search_res) == 1

    # do it again, this time with a type that will return 404
    testapp.post_json(COMPOUND_SEARCH_URL, {
        'flags': '?type=gene',
        'type': 'Gene'
    }, status=404)


def test_filter_set_simple(workbook, testapp, simple_filter_set):
    """ Test posting a non-trivial (but simple) filter set """
    res = testapp.post_json(FILTER_SET_URL, simple_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']
    testapp.post_json('/index', {})

    # execute given filter_blocks only
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {
                                                'filter_blocks': [{
                                                    'query': 'type=variant&CHROM=1',
                                                    'flag_applied': True
                                                }],
                                                'type': 'Variant'
                                            }).json['@graph']
    assert len(compound_search_res) == 4

    # execute given flags only
    compound_search_res = testapp.post_json('/compound_search', {
        'flags': '?type=project',
        'type': 'Project'
    }).json['@graph']
    assert len(compound_search_res) == 1

    # execute the same search using filter_blocks and flags
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {
        'filter_blocks': [{
            'query': 'CHROM=1',
            'flag_applied': True
        }],
        'flags': 'type=variant',
        'type': 'Variant'
    }).json['@graph']
    assert len(compound_search_res) == 4

    # do similar search with @id
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 3


def test_filter_set_complete(workbook, testapp, standard_filter_set):
    """ Executes a filter set with multiple filter blocks """
    res = testapp.post_json(FILTER_SET_URL, standard_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']

    # execute the more complicated filter_set by @id
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 2


def test_filter_set_complex(workbook, testapp, complex_filter_set):
    """ Executes a 'complex' filter set, toggling and re-searching with certain blocks disabled """
    res = testapp.post_json(FILTER_SET_URL, complex_filter_set, status=201).json
    uuid = res['@graph'][0]['@id']
    t = res['@graph'][0]['type']
    filter_blocks = res['@graph'][0]['filter_blocks']
    flags = res['@graph'][0]['flags']

    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, {'@id': uuid}).json['@graph']
    assert len(compound_search_res) == 4  # all variants will match

    # toggle off all the blocks
    filter_set = {
        'type': t,
        'filter_blocks': filter_blocks,
        'flags': flags
    }
    for block in filter_blocks:
        block['flag_applied'] = False
        compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
        assert len(compound_search_res) == 4  # should match in all cases

    # Modify POS
    for block in filter_blocks:
        query = block['query']
        if 'POS' in query:
            block['flag_applied'] = True
            block['query'] = 'POS.from=0&POS.to=100000'  # exclude 3/4
            break
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 1  # should only match the one case

    # Now, toggle the REF=G&ALT=A block, which will re-introduce 1/3
    for block in filter_blocks:
        query = block['query']
        if 'REF' in query:
            block['flag_applied'] = True
            break
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 2


def test_filter_set_intersection(workbook, testapp, complex_filter_set):
    """ Uses the complex filter set with an AND filter_set execution, which should be
        functionally identical but will show slightly different results.
    """
    t = complex_filter_set['type']
    filter_blocks = complex_filter_set['filter_blocks']
    flags = complex_filter_set['flags']
    filter_set = {
        'type': t,
        'filter_blocks': filter_blocks,
        'flags': flags,
        'intersect': True
    }
    testapp.post_json(COMPOUND_SEARCH_URL, filter_set, status=404)  # AND will eliminate all here

    # toggle off the REF/ALT requirement, now 2 will match
    for block in filter_blocks:
        if 'REF' in block['query']:
            block['flag_applied'] = False
            break
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 2

    # toggle off hg19 so all match
    for block in filter_blocks:
        if 'hg19' in block['query']:
            block['flag_applied'] = False
            break
    compound_search_res = testapp.post_json(COMPOUND_SEARCH_URL, filter_set).json['@graph']
    assert len(compound_search_res) == 4


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
        'type': 'Variant',
        'flags': 'CHROM=1'
    }


def test_compound_search_only_flags(workbook, testapp, filter_set_with_only_flags):
    """ Tests compound search with a filter set that has only flags
        /search redirect is functioning if we get correct facets on the response, which are checked
        explicitly for correctness in this test.
    """
    resp = testapp.post_json(COMPOUND_SEARCH_URL, filter_set_with_only_flags).json
    assert len(resp['@graph']) == 4

    # do generator search
    execute_and_verify_generator_search(testapp, filter_set_with_only_flags, 4)

    # verify facet values all sum to 4, since we should only be aggregating on the search results
    assert 'facets' in resp
    facets = resp['facets']
    for facet in facets:
        count = 0
        if 'terms' in facet:
            for term in facet['terms']:
                count += term['doc_count']
        else:
            count += facet['total']
        assert count == 4


@pytest.fixture
def filter_set_with_single_filter_block():
    return {
        'type': 'Variant',
        'filter_blocks': [{
            'query': '?type=Variant&POS.from=0&POS.to=10000000',
            'flag_applied': True
        }]
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
        'type': 'Variant',
        'filter_blocks': [{
            'query': '?type=Variant&POS.from=0&POS.to=10000000',
            'flag_applied': True
        }],
        'flags': 'CHROM=1'
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
    filter_set_with_single_filter_block_and_flags['return_generator'] = False

    # disable block, so flag only
    toggle_filter_blocks(filter_set_with_single_filter_block_and_flags, on=False)
    resp = testapp.post_json(COMPOUND_SEARCH_URL, filter_set_with_single_filter_block_and_flags).json
    assert len(resp['@graph']) == 4
    assert 'facets' in resp


@pytest.fixture
def filter_set_with_multiple_disabled_flags():
    return {
        'type': 'Variant',
        'filter_blocks': [{
            'query': '?type=Variant&POS.from=0&POS.to=10000000',
            'flag_applied': False
        },
        {
            'query': '?type=Variant&REF=A',
            'flag_applied': False
        }],
        'flags': 'CHROM=1'
    }


def test_compound_search_disabled_filter_blocks(workbook, testapp, filter_set_with_multiple_disabled_flags):
    """ Tests a compound search with all filter_blocks disabled (so will only execute flags). """
    resp = testapp.post_json(COMPOUND_SEARCH_URL, filter_set_with_multiple_disabled_flags).json
    assert len(resp['@graph']) == 4

    # Test same facet behavior as previously, since we are only executing flags
    assert 'facets' in resp
    facets = resp['facets']
    for facet in facets:
        count = 0
        if 'terms' in facet:
            for term in facet['terms']:
                count += term['doc_count']
        else:
            count += facet['total']
        assert count == 4

    # do generator search
    execute_and_verify_generator_search(testapp, filter_set_with_multiple_disabled_flags, 4)
    filter_set_with_multiple_disabled_flags['limit'] = 2
    execute_and_verify_generator_search(testapp, filter_set_with_multiple_disabled_flags, 2)


@pytest.fixture
def paginated_request():
    return {
        'type': 'Item',
    }


def test_compound_search_from_to(workbook, testapp, paginated_request):
    """ Tests pagination + generator with compound searches """

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
