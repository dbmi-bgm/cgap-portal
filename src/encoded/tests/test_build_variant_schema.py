import os
import csv
import json
import pytest
from encoded.commands.build_variant_schema import (
    add_variant_sample_schema_fields
)

pytestmark = [pytest.mark.working]
FNAME = './src/encoded/tests/mp.csv' # symlinked from encoded.commands


def test_add_variant_sample_fields():
    """ Tests that fields we expect are added to the variant sample schema """
    schema = {}
    add_variant_sample_schema_fields(schema)
    assert schema['title'] == 'Sample Variant'
    assert schema['type'] == 'object'
    assert schema['additionalProperties'] == False
    assert 'properties' in schema
