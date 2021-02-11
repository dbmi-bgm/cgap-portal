import pytest
import mock
from dcicutils.misc_utils import VirtualApp
from ..ingestion.variant_utils import VariantBuilder
from ..ingestion.vcf_utils import VCFParser


pytestmark = [pytest.mark.working, pytest.mark.ingestion]


@pytest.fixture
def mocked_familial_relations():
    return [{'samples_pedigree': [
                {
                    'sample_name': 'sample_one',
                    'relationship': 'mother',
                    'sex': 'F'
                },
                {
                    'sample_name': 'sample_two',
                    'relationship': 'father',
                    'sex': 'M'
                },
                {
                    'sample_name': 'sample_three',
                    'relationship': 'proband',
                    'sex': 'M'
                }
    ]}]


def test_ingestion_listener_build_familial_relations(testapp, mocked_familial_relations):
    """ Tests that we correctly extract familial relations from a mocked object that has the correct structure """
    with mock.patch.object(VariantBuilder, 'search_for_sample_relations',
                           new=lambda x: mocked_familial_relations):
        builder = VariantBuilder(testapp, None, None)
        relations = builder.extract_sample_relations()
        assert relations['sample_one']['samplegeno_role'] == 'mother'
        assert relations['sample_two']['samplegeno_role'] == 'father'
        assert relations['sample_three']['samplegeno_role'] == 'proband'
        assert relations['sample_one']['samplegeno_sex'] == 'F'
        assert relations['sample_two']['samplegeno_sex'] == 'M'
        assert relations['sample_three']['samplegeno_sex'] == 'M'
