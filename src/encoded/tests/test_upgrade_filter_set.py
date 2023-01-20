from copy import deepcopy

import pytest

from ..upgrade.filter_set import REPLACEMENTS_1_2


@pytest.fixture
def filter_set_1_2():
    """Filter set containing query to upgrade in second filter block."""
    return {
        "title": "Test filter set",
        "search_type": "VariantSample",
        "filter_blocks": [
            {
                "name": "Query 1",
                "query": (
                    "inheritance_modes=de+novo+%28strong%29"
                    "&associated_genelists=Familial+Cancer+%28148%29"
                ),
            },
            {
                "name": "Query 2",
                "query": (
                    "variant.csq_gnomade2_af.from=0"
                    "&variant.csq_gnomade2_af.to=0"
                    "&variant.csq_gnomadg_af.to=0.001"
                    "&" + "&".join([x[0] for x in REPLACEMENTS_1_2])
                ),
            },
            {
                "name": "Query 3",
                "query": (
                    "variant.genes.genes_most_severe_consequence.location=CDS"
                    "&variant.genes.genes_most_severe_consequence.location=intron"
                ),
            },
        ],
        "flags": [
            {
                "name": "Case:GAPFIXBHI3",
                "query": "CALL_INFO=NA12345&file=GAPFILLKJH6",
            }
        ],
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
    }


def test_upgrade_filter_set_1_2(app, filter_set_1_2):
    """Test filter set upgrader to update inheritance mode strings."""
    existing_filter_set = deepcopy(filter_set_1_2)
    existing_filter_blocks = existing_filter_set.get("filter_blocks")
    existing_filter_block_queries = [x["query"] for x in existing_filter_blocks]
    upgrader = app.registry["upgrader"]
    upgrader.upgrade(
        "filter_set", filter_set_1_2, current_version="1", target_version="2"
    )
    assert filter_set_1_2["schema_version"] == "2"
    filter_blocks = filter_set_1_2.get("filter_blocks")
    filter_block_queries = [x["query"] for x in filter_blocks]
    assert len(existing_filter_block_queries) == len(filter_block_queries)
    for idx in range(len(filter_block_queries)):
        existing_query_length = len(existing_filter_block_queries[idx].split("&"))
        query_length = len(filter_block_queries[idx].split("&"))
        assert existing_query_length == query_length
        for (string_to_replace, replacement) in REPLACEMENTS_1_2:
            if string_to_replace in existing_filter_block_queries[idx]:
                assert replacement in filter_block_queries[idx]
                assert string_to_replace not in filter_block_queries[idx]
