import pytest


pytestmark = [pytest.mark.working]


def test_schema_constants_import():
    """Ensure schema constants can be imported."""
    from .. import schema_constants


def test_constants_import():
    """Ensure constants can be imported."""
    from .. import constants
