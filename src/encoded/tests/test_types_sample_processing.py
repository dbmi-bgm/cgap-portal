import pytest
from unittest import mock
from datetime import datetime
from xml.etree.ElementTree import fromstring
from encoded.types.family import *
pytestmark = [pytest.mark.work, pytest.mark.schema]


@pytest.fixture
def sample_proc_fam(testapp, project, institution, fam):
    data = {
        'project': project['@id'],
        'institution': institution['@id'],
        'samples': [
            "GAPSAPROBAND",
            "GAPSAFATHER1",
            "GAPSAMOTHER1",
            "GAPSABROTHER",
            "GAPSAGRANDPA",
            "GAPSAGRANDMA",
            "GAPSAHALFSIS",
            "GAPSAUNCLE01",
            "GAPSACOUSIN1"
            ],
        'families': [fam['@id']]
    }
    return testapp.post_json('/sample_processing', data).json['@graph'][0]


def test_sample_processing_pedigree(testapp, sample_proc_fam):
    """This is an end to end test for calculating relationships
    Test for roles"""
    print(sample_proc_fam['samples_pedigree'])
    assert False
