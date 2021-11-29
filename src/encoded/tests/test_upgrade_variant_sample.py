import pytest

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
