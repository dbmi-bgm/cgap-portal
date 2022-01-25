import pytest


pytestmark = [pytest.mark.working, pytest.mark.schema]

UTR_5_CONSEQUENCE = "5_prime_UTR_variant"
UTR_3_CONSEQUENCE = "3_prime_UTR_variant"
DOWNSTREAM_CONSEQUENCE = "downstream_gene_variant"
UPSTREAM_CONSEQUENCE = "upstream_gene_variant"
LOCATION_CONSEQUENCES = [
    {
        "impact": "MODIFIER",
        "status": "shared",
        "location": "UTR",
        "definition": "A UTR variant of the 3 UTR",
        "var_conseq_id": "SO:0001624",
        "var_conseq_name": "3_prime_UTR_variant",
        "severity_order_estimate": 21,
        "uuid": "d2ca7570-10b9-4314-bc2c-fa6d276c21fb",
    },
    {
        "impact": "MODIFIER",
        "status": "shared",
        "location": "UTR",
        "definition": "A UTR variant of the 5 UTR",
        "var_conseq_id": "SO:0001623",
        "var_conseq_name": "5_prime_UTR_variant",
        "severity_order_estimate": 20,
        "uuid": "3bb1eb38-2aee-4232-bc63-dc4690a9b87c",
    },
    {
        "impact": "MODIFIER",
        "status": "shared",
        "location": "downstream",
        "definition": "A sequence variant located 3 of a gene",
        "var_conseq_id": "SO:0001632",
        "var_conseq_name": "downstream_gene_variant",
        "severity_order_estimate": 27,
        "uuid": "a150ec92-01fe-457d-9b84-1655ed68129e",
    },
    {
        "impact": "MODIFIER",
        "status": "shared",
        "location": "upstream",
        "definition": "A sequence variant located 5 of a gene",
        "var_conseq_id": "SO:0001631",
        "var_conseq_name": "upstream_gene_variant",
        "severity_order_estimate": 26,
        "uuid": "b898b66a-c60b-4e00-b63f-5b5e18c34a48",
    },
]


def make_transcript(
    exon=None, intron=None, distance=None, consequences=None, most_severe=False
):
    """Create transcript as dict with given fields."""
    result = {}
    if exon:
        result["csq_exon"] = exon
    if intron:
        result["csq_intron"] = intron
    if distance:
        result["csq_distance"] = distance
    if consequences:
        result["csq_consequence"] = consequences
    result["csq_most_severe"] = most_severe
    return result


@pytest.fixture
def consequence_name_to_atid(testapp, project, institution):
    """POST consequences required for 'most_severe_location' calcprop.

    :returns: Consequence name to @id mapping
    :rtype: dict
    """
    consequence_name_to_atid = {}
    for consequence in LOCATION_CONSEQUENCES:
        consequence["project"] = project["@id"]
        consequence["institution"] = institution["@id"]
        post = testapp.post_json(
            "/variant_consequence", consequence, status=201
        ).json["@graph"][0]
        consequence_name_to_atid[consequence["var_conseq_name"]] = post["@id"]
    return consequence_name_to_atid


@pytest.mark.parametrize(
    "transcripts,expected",
    [
        ([], None),
        ([make_transcript(intron="3/5")], None),
        ([make_transcript(intron="3/5", most_severe=True)], "Intron 3/5"),
        ([make_transcript(exon="2/6")], None),
        ([make_transcript(exon="2/6", most_severe=True)], "Exon 2/6"),
        (
            [
                make_transcript(
                    exon="2/6", most_severe=True, consequences=[UTR_5_CONSEQUENCE]
                )
            ],
            "Exon 2/6 (5' UTR)",
        ),
        (
            [
                make_transcript(
                    exon="2/6", most_severe=True, consequences=[UTR_3_CONSEQUENCE]
                )
            ],
            "Exon 2/6 (3' UTR)",
        ),
        (
            [
                make_transcript(
                    exon="2/6",
                    most_severe=True,
                    consequences=[UTR_3_CONSEQUENCE, DOWNSTREAM_CONSEQUENCE],
                )
            ],
            "Exon 2/6 (3' UTR)",
        ),
        (
            [
                make_transcript(
                    exon="2/6",
                    most_severe=True,
                    consequences=[DOWNSTREAM_CONSEQUENCE, UTR_3_CONSEQUENCE],
                )
            ],
            "Exon 2/6 (3' UTR)",
        ),
        (  # Should not have both 5' and 3' UTR consequences for SNV, but, if so,
            # utilize the first consequence
            [
                make_transcript(
                    exon="2/6",
                    most_severe=True,
                    consequences=[UTR_5_CONSEQUENCE, UTR_3_CONSEQUENCE],
                )
            ],
            "Exon 2/6 (5' UTR)",
        ),
        (  # Should not have both 5' and 3' UTR consequences for SNV, but, if so,
            # utilize the first consequence
            [
                make_transcript(
                    exon="2/6",
                    most_severe=True,
                    consequences=[UTR_3_CONSEQUENCE, UTR_5_CONSEQUENCE],
                )
            ],
            "Exon 2/6 (3' UTR)",
        ),
        ([make_transcript(distance="1000")], None),
        ([make_transcript(distance="1000", most_severe=True)], None),
        (
            [
                make_transcript(
                    distance="1000",
                    most_severe=True,
                    consequences=[UPSTREAM_CONSEQUENCE],
                )
            ],
            "1000 bp upstream",
        ),
        (
            [
                make_transcript(
                    distance="1000",
                    most_severe=True,
                    consequences=[DOWNSTREAM_CONSEQUENCE],
                )
            ],
            "1000 bp downstream",
        ),
        ([make_transcript(intron="3/5"), make_transcript(exon="2/6")], None),
        (
            [
                make_transcript(intron="3/5", most_severe=True),
                make_transcript(exon="2/6"),
            ],
            "Intron 3/5",
        ),
        (
            [
                make_transcript(intron="3/5"),
                make_transcript(exon="2/6", most_severe=True),
            ],
            "Exon 2/6",
        ),
        (  # Should never have multiple most severe transcripts, but, if so, use the
            # first one.
            [
                make_transcript(intron="3/5", most_severe=True),
                make_transcript(exon="2/6", most_severe=True),
            ],
            "Intron 3/5",
        ),
        (  # Should never have multiple most severe transcripts, but, if so, use the
            # first one.
            [
                make_transcript(exon="2/6", most_severe=True),
                make_transcript(intron="3/5", most_severe=True),
            ],
            "Exon 2/6",
        ),
    ],
)
def test_most_severe_location(
    transcripts, expected, testapp, variant, consequence_name_to_atid
):
    """Patch given transcripts to variant and test 'most_severe_location'
    calc prop.

    For consequences in transcripts, convert to linkTo prior to patching
    variant.
    """
    for transcript in transcripts:
        consequences = transcript.get("csq_consequence")
        if consequences:
            for idx, consequence in enumerate(consequences):
                consequences[idx] = consequence_name_to_atid[consequence]
    variant_atid = variant.get("@id")
    patch_body = {"transcript": transcripts}
    patch_response = testapp.patch_json(
        variant_atid, patch_body, status=200
    ).json["@graph"][0]
    most_severe_location = patch_response.get("most_severe_location")
    assert most_severe_location == expected


@pytest.mark.parametrize(
    "POS,expected",
    [
        (1, "1"),
        (100, "100"),
        (1000, "1,000"),
        (1000000, "1,000,000"),
    ]
)
def test_alternate_display_title(POS, expected, testapp, variant):
    """Test building variant display title with comma-separated position."""
    variant_atid = variant.get("@id")
    chromosome = variant.get("CHROM")
    reference = variant.get("REF")
    alternate = variant.get("ALT")
    patch_body = {"POS": POS}
    patch_response = testapp.patch_json(
        variant_atid, patch_body, status=200
    ).json["@graph"][0]
    result = patch_response.get("alternate_display_title")
    assert result == "chr%s:%s%s>%s" % (chromosome, expected, reference, alternate)
