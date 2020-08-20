import pytest
from ..inheritance_mode import InheritanceMode


@pytest.mark.parametrize('gts', [
    ['./.'],
    ['0/0'],
    ['0/1'],
    ['1/1'],
    ['1/0']
])
def test_inheritance_mode_is_multiallelic_site_is_false(gts):
    """ Tests basic truths about the multiallelic site function """
    assert InheritanceMode.is_multiallelic_site(gts) is False


@pytest.mark.parametrize('gts', [
    ['2/2'],
    ['2/0'],
    ['1/2'],
    ['0/2'],
    ['4/17'],
    ['0/0', '2/2']
])
def test_inheritance_mode_is_multiallelic_site_is_true(gts):
    """ Tests basic truths about the multiallelic site function """
    assert InheritanceMode.is_multiallelic_site(gts) is True
