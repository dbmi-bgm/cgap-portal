import pytest


from .test_search import MockedRequest
from ..authorization import is_admin_request


pytestmark = [pytest.mark.working]


@pytest.mark.parametrize('mock_request, expected', [
    [MockedRequest(), False],
    [MockedRequest(principals_allowed=[
        'group.admin'
    ]), True],
    [MockedRequest(principals_allowed=[
        'lots', 'of', 'other', 'perms', 'but', 'not', 'group', 'dot', 'admin'
    ]), False]
])
def test_authorization_is_admin_request(mock_request, expected):
    """ Checks that the request tests correctly resolve. """
    assert is_admin_request(mock_request) is expected
