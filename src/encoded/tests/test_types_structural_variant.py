import pytest

pytestmark = [pytest.mark.working, pytest.mark.schema]


def test_size_display(testapp, structural_variant):
    """Test size_display for rounding and units."""
    # structural_variant fixture comes with START=1000
    test_ends = [1234, 12345, 1234567, 123456789, 12345678912]
    expected_results = ["235 bp", "11.3 Kb", "1.2 Mb", "123.5 Mb", "12.3 Gb"]
    variant_atid = structural_variant["@id"]
    for end, expected_result in zip(test_ends, expected_results):
        patch_body = {"END": end}
        testapp.patch_json(variant_atid, patch_body, status=200)
        result = testapp.get(variant_atid, status=200).json
        assert result["size_display"] == expected_result


def genes(testapp, project, institution, locations):
    """
    Posts a gene for every given location pair.

    NOTE: Gene locations of even index contain OMIM identifiers.
    """
    result = []
    for idx, location_pair in enumerate(locations):
        item = {
            "project": project["@id"],
            "institution": institution["@id"],
            "gene_symbol": "Gene_" + str(idx),
            "ensgid": "ENSG0000000" + str(1000 + idx),
            "spos": location_pair[0],
            "epos": location_pair[1],
        }
        if idx % 2 == 0:
            item["omim_id"] = [str(5000 + idx)]
        result.append(testapp.post_json("/gene", item, status=201).json["@graph"][0])
    return result


def affected_gene_result(total, contained, at_breakpoint, omim_genes):
    """Provides expected result for affected_genes calcprop."""
    result = {
        "contained": str(contained) + "/" + str(total),
        "at_breakpoint": str(at_breakpoint) + "/" + str(total),
        "omim_genes": str(omim_genes) + "/" + str(total),
    }
    return result


@pytest.mark.parametrize(
    "locations, result",
    [
        ([(900, 1500)], affected_gene_result(1, 0, 1, 1)),
        ([(1500, 2500)], affected_gene_result(1, 0, 1, 1)),
        ([(1100, 1600)], affected_gene_result(1, 1, 0, 1)),
        ([(500, 950)], affected_gene_result(0, 0, 0, 0)),
        (
            [(900, 1500), (1500, 2500), (1100, 1600), (500, 950)],
            affected_gene_result(3, 1, 2, 2),
        ),
    ],
)
def test_affected_genes(
    testapp, project, institution, structural_variant, locations, result
):
    """
    Tests affected_genes calcprop output. Posts genes with given
    locations and adds each to the SV item as a separate transcript
    gene.

    NOTE: SV has START=1000, END=2000.
    """
    sv_atid = structural_variant["@id"]
    transcript_genes = genes(testapp, project, institution, locations)
    gene_atids = [gene["@id"] for gene in transcript_genes]
    patch_body = {"transcript": []}
    for gene_atid in gene_atids:
        patch_body["transcript"].append({"csq_gene": gene_atid})
    resp = testapp.patch_json(sv_atid, patch_body, status=200).json["@graph"][0]
    assert resp["affected_genes"] == result
