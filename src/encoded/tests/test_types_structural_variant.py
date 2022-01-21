import pytest

from ..types.structural_variant import (
    build_comma_formatted_position,
    convert_integer_to_comma_string,
)

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


@pytest.mark.parametrize(
    "cytoband_start, cytoband_end, result",
    [
        ("p12", "p12", "1p12"),
        ("p11", "p12", "1p11-1p12"),
        ("p10", "q3", "1p10-1q3"),
        ("p12", None, None),
        (None, "p12", None),
        (None, None, None),
    ],
)
def test_cytoband_display(
    testapp, structural_variant, cytoband_start, cytoband_end, result
):
    """Test rendering of cytoband display."""
    sv_atid = structural_variant["@id"]
    patch_body = {}
    if cytoband_start:
        patch_body["cytoband_start"] = cytoband_start
    if cytoband_end:
        patch_body["cytoband_end"] = cytoband_end
    resp = testapp.patch_json(sv_atid, patch_body, status=200).json["@graph"][0]
    cytoband_display = resp.get("cytoband_display")
    assert cytoband_display == result


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
def test_gene_summary(
    testapp, project, institution, structural_variant, locations, result
):
    """
    Tests gene_summary calcprop output. Posts genes with given
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
    assert resp["gene_summary"] == result


@pytest.mark.parametrize(
    "chromosome,start,end,expected",
    [
        (None, None, None, None),
        ("1", None, None, None),
        (None, 1000, None, None),
        (None, None, 2000, None),
        ("1", 1000, None, None),
        ("1", None, 2000, None),
        (None, 1000, 2000, None),
        ("1", "1000", "2000", None),
        ("1", 1000, 2000, "chr1:1,000-2,000"),
        ("X", 1000000, 2000000, "chrX:1,000,000-2,000,000"),
    ]
)
def test_build_comma_formatted_position(chromosome, start, end, expected):
    """Test making more readable position display for SVs with comma-
    formatted numbers.
    """
    result = build_comma_formatted_position(chromosome, start, end)
    assert result == expected


@pytest.mark.parametrize(
    "value,expected",
    [
        (None, None),
        ({"foo": "bar"}, None),
        ([], None),
        ("foo", None),
        (1.31, None),
        ("1", None),
        (0, "0"),
        (10000, "10,000"),
        (123456789, "123,456,789"),
    ]
)
def test_convert_integer_to_comma_string(value, expected):
    """Test converting integer to comma-formatted string."""
    result = convert_integer_to_comma_string(value)
    assert result == expected


def test_position_displays(testapp, structural_variant, structural_variant_hg19):
    """Test creation of position_display and h19_position_display on
    SVs.
    """
    assert structural_variant.get("position_display") == "chr1:1,000-2,000"
    assert structural_variant.get("hg19_position_display") is None
    assert structural_variant_hg19.get("position_display") == "chr5:123,445-234,556"
    assert structural_variant_hg19.get("hg19_position_display") == "chr5:123,456-234,567"
