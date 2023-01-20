from snovault import upgrade_step

REPLACEMENTS_1_2 = [
    (
        "inheritance_modes=X-linked+recessive+%28Maternal%29",
        "inheritance_modes=X-linked+recessive",
    ),
    (
        "inheritance_modes=Dominant+%28maternal%29",
        "inheritance_modes=Dominant+%28Maternal%29",
    ),
    (
        "inheritance_modes=Dominant+%28paternal%29",
        "inheritance_modes=Dominant+%28Paternal%29",
    ),
    (
        "inheritance_modes=Loss+of+Heteozyogousity",
        "inheritance_modes=Loss+of+Heterozygosity",
    ),
]


@upgrade_step("filter_set", "1", "2")
def filter_set_1_2(value, system):
    """Upgrade FilterSet queries with inheritance modes to match new
    values.

    PR #513 changes some existing inheritance mode labels, so we
    upgrade filter sets to replace such queries with appropriate ones.
    As inheritance modes are also upgraded simultaneously, filter sets
    should work as intended for all existing cases.
    """
    filter_blocks = value.get("filter_blocks", [])
    for filter_block in filter_blocks:
        query = filter_block.get("query")
        if query:
            for existing_value, replacement_value in REPLACEMENTS_1_2:
                query = query.replace(existing_value, replacement_value)
            filter_block["query"] = query
