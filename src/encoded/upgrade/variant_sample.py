from snovault import upgrade_step

REPLACEMENTS_1_2 = [
    ("Dominant (paternal)", "Dominant (Paternal)"),
    ("Dominant (maternal)", "Dominant (Maternal)"),
    ("X-linked recessive (Maternal)", "X-linked recessive"),
    (
        "Low relevance, present in both parent(s)",
        "Low relevance, present in both parents",
    ),
    ("Loss of Heteozyogousity", "Loss of Heterozygosity"),
]
MALE_ONLY_REPLACEMENTS_1_2 = [
    ("X-linked dominant (Paternal)", "Low relevance, hemizygous in a parent"),
]


@upgrade_step("structural_variant_sample", "1", "2")
@upgrade_step("variant_sample", "1", "2")
def variant_sample_1_2(value, system):
    """Upgrade existing inheritance modes on (Structural)VariantSamples
    to match new values.

    PR #513 changes some existing inheritance mode labels to new values,
    so we upgrade these on existing items retroactively here. For males,
    an X-linked dominant paternal label was erroneously applied
    previously, and that is also fixed here.

    NOTE: Accompanying upgrader made on filter sets (version 1 --> 2)
    to keep them aligned.
    """
    proband_is_male = False
    inheritance_modes = value.get("inheritance_modes")
    sample_geno = value.get("samplegeno")
    if inheritance_modes:
        for existing_label, replacement_label in REPLACEMENTS_1_2:
            if existing_label in inheritance_modes:
                index = inheritance_modes.index(existing_label)
                inheritance_modes[index] = replacement_label
        if sample_geno:
            for existing_label, replacement_label in MALE_ONLY_REPLACEMENTS_1_2:
                if existing_label in inheritance_modes:
                    for sample in sample_geno:
                        role = sample.get("samplegeno_role")
                        sex = sample.get("samplegeno_sex")
                        if role == "proband" and sex == "M":
                            proband_is_male = True
                            break
                    if proband_is_male:
                        index = inheritance_modes.index(existing_label)
                        inheritance_modes[index] = replacement_label


@upgrade_step("variant_sample_list", "2", "3")
def variant_sample_list_2_3(value, system):
    """Delete `filter_blocks_request_at_time_of_selection` from selection entries"""
    all_selections = value.get("variant_samples", []) + value.get("structural_variant_samples", [])
    for selection in all_selections:
        if "filter_blocks_request_at_time_of_selection" in selection:
            del selection["filter_blocks_request_at_time_of_selection"]


@upgrade_step("structural_variant_sample", "2", "3")
def structural_variant_sample_2_3(value, system):
    """Set new caller fields for all existing SVSamples."""
    callers = value.get("callers")
    caller_types = value.get("caller_types")
    if callers is None and caller_types is None:
        value["callers"] = ["Manta"]
        value["caller_types"] = ["SV"]
