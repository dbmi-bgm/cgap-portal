import pytest
from copy import deepcopy

from ..upgrade.variant_sample import MALE_ONLY_REPLACEMENTS_1_2, REPLACEMENTS_1_2


def modes_to_change_1_2():
    """Inheritance modes that should/may be upgraded on a (Structural)
    VariantSample.

    Not a fixture so can be used within parametrize call.
    """
    return [x[0] for x in (REPLACEMENTS_1_2 + MALE_ONLY_REPLACEMENTS_1_2)]


def stable_modes_1_2():
    """Inheritance modes that should remain identical from schema 1 to 2.

    Not a fixture so can be used within parametrize call.
    """
    return [
        "de novo (weak)",
        "Homozygous recessive",
        "X-linked dominant (Maternal)",
        "Low relevance, homozygous in a parent",
    ]


@pytest.mark.parametrize(
    "inheritance_modes,is_male",
    [
        ([], True),
        ([], False),
        (stable_modes_1_2(), True),
        (stable_modes_1_2(), False),
        (modes_to_change_1_2(), True),
        (modes_to_change_1_2(), False),
        (stable_modes_1_2() + modes_to_change_1_2(), True),
        (stable_modes_1_2() + modes_to_change_1_2(), False),
    ],
)
def test_upgrade_variant_sample_1_2(inheritance_modes, is_male, app, variant_sample):
    """Test upgrading inheritance modes on VariantSamples.

    Assign proband sex in samplegeno according to incoming parameter to
    ensure male-only replacement correct.
    """
    existing_inheritance_modes = inheritance_modes[:]
    samplegeno = [
        {
            "samplegeno_role": "father",
            "samplegeno_sex": "M",
        },
        {
            "samplegeno_role": "mother",
            "samplegeno_sex": "F",
        },
        {
            "samplegeno_role": "proband",
            "samplegeno_sex": ("M" if is_male else "F"),
        },
    ]
    variant_sample["inheritance_modes"] = inheritance_modes
    variant_sample["samplegeno"] = samplegeno
    upgrader = app.registry["upgrader"]
    upgrader.upgrade(
        "variant_sample", variant_sample, current_version="1", target_version="2"
    )
    assert variant_sample["schema_version"] == "2"
    assert len(inheritance_modes) == len(existing_inheritance_modes)
    for item in existing_inheritance_modes:
        if item not in modes_to_change_1_2():
            assert item in inheritance_modes
    for existing_value, replacement_value in REPLACEMENTS_1_2:
        if existing_value in existing_inheritance_modes:
            assert existing_value not in inheritance_modes
            assert replacement_value in inheritance_modes
    if is_male:
        for existing_value, replacement_value in MALE_ONLY_REPLACEMENTS_1_2:
            if existing_value in existing_inheritance_modes:
                assert replacement_value in inheritance_modes
    else:
        for existing_value, replacement_value in MALE_ONLY_REPLACEMENTS_1_2:
            if existing_value in existing_inheritance_modes:
                assert existing_value in inheritance_modes



@pytest.fixture
def variant_sample_list_2_3():
    """Filter set containing query to upgrade in second filter block."""
    return {
        "schema_version": "2",
        "status": "current",
        "project": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
        "institution": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
        "variant_samples": [
            {
                "selected_by": "834559db-a3f6-462c-81a4-f5d7e5e65707",
                "date_selected": "2021-07-09T16:42:23.694711+00:00",
                "variant_sample_item": "013bcc47-3885-4682-99c2-800b95765524",
                "filter_blocks_used": {
                    "filter_blocks": [
                        {
                            "name": "Breast Cancer",
                            "query": "associated_genotype_labels.proband_genotype_label=Heterozygous&associated_genelists=Breast+Cancer+%2828%29&variant.genes.genes_most_severe_consequence.impact=MODERATE&variant.genes.genes_most_severe_consequence.impact=HIGH"
                        }
                    ],
                    "intersect_selected_blocks": False
                }
            },
            {
                "selected_by": "834559db-a3f6-462c-81a4-f5d7e5e65707",
                "date_selected": "2021-07-09T16:42:23.696554+00:00",
                "variant_sample_item": "ac62850f-6f77-4d3b-9644-41699238d0e2",
                "filter_blocks_request_at_time_of_selection": "some-gibberish"
            }
        ],
        "created_for_case": "GAPCAJQ1L99X",
        "uuid": "292250e7-5cb7-4543-85b2-80cd318287b2"
    }

def test_upgrade_variant_sample_list_2_3(app, variant_sample_list_2_3):
    """Test filter set upgrader to update inheritance mode strings."""
    vsl_to_upgrade = deepcopy(variant_sample_list_2_3)
    upgrader = app.registry["upgrader"]
    upgrader.upgrade(
        "variant_sample_list", vsl_to_upgrade, current_version="2", target_version="3"
    )
    assert variant_sample_list_2_3["schema_version"] == "2"
    assert vsl_to_upgrade["schema_version"] == "3"
    all_selections = vsl_to_upgrade.get("variant_samples", []) + vsl_to_upgrade.get("structual_variant_samples", [])
    assert len(all_selections) == 2
    for selection in all_selections:
        assert "filter_blocks_request_at_time_of_selection" not in selection
