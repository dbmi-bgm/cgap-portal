import json
from contextlib import contextmanager
from unittest import mock
from typing import Any, List, Mapping, Optional, Union

import pytest
from webtest import TestApp
from webtest.response import TestResponse

from .utils import patch_context
from .. import drr_batch_download as drr_batch_download_module
from ..drr_batch_download import (
    CASE_SPREADSHEET_URL,
    VARIANT_SAMPLE_SPREADSHEET_URL,
    CaseSpreadsheet,
)
from ..drr_item_models import JsonObject
from ..util import APPLICATION_FORM_ENCODED_MIME_TYPE


EXPECTED_CASE_SPREADSHEET_COLUMNS = [
    ("# Case identifier", "Case ID", "CASE10254-S1-C1"),
    ("Unique database identifier", "UUID", "165ad0fb-7acb-469e-bc1e-eb2fc6f94c82"),
    ("Individual identifier", "Individual ID", "BRCA proband"),
    ("Sex of associated individual", "Individual sex", "M"),
    ("Whether case is for a proband", "Proband case", "False"),
    ("Family identifier", "Family ID", "BRCA-001"),
    ("Analysis type", "Analysis type", "WES-Group"),
    ("Primary sample identifier", "Sample ID", "BRCA_proband_sample"),
    ("Primary sample sequencing type", "Sequencing", "WES"),
    ("Overall QC flag", "QC flag", "fail"),
    ("Completed QC steps", "Completed QC", "BAM, SNV, SV"),
    (
        "QC steps with warning flags",
        "QC warnings",
        "predicted_sex, heterozygosity_ratio",
    ),
    (
        "QC steps with failure flags",
        "QC failures",
        "coverage, transition_transversion_ratio",
    ),
]
EXPECTED_VARIANT_SAMPLE_FILTERS_ROW = [
    '#',
    'Filters Selected:',
    '',
    (
        "( associated_genotype_labels.proband_genotype_label = Heterozygous"
        " & associated_genelists = Breast Cancer (28)"
        " & variant.genes.genes_most_severe_consequence.impact = [ MODERATE | HIGH ] )"
        " OR ( GQ.from = 60 & GQ.to = 99"
        " & associated_genotype_labels.proband_genotype_label = Heterozygous"
        " & associated_genelists = Familial Cancer (148)"
        " & variant.csq_clinvar_clnsig = [ Uncertain_significance | Pathogenic ]"
        " & variant.csq_gnomadg_af.from = 0 & variant.csq_gnomadg_af.to = 0.001"
        " & variant.genes.genes_most_severe_consequence.impact = [ MODERATE | HIGH ] )"
        " OR ( variant.csq_gnomade2_af.from = 0 & variant.csq_gnomade2_af.to = 0.001"
        " & variant.csq_gnomadg_af.from = 0 & variant.csq_gnomadg_af.to = 0.001 )"
    ),
]
EXPECTED_VARIANT_SAMPLE_SPACER_ROW = [
    '## -------------------------------------------------------'
]
EXPECTED_VARIANT_SAMPLE_SPREADSHEET_COLUMNS = [
    ('# URL path to the variant', 'ID', '/variant-samples/e43be20e-5dda-4db2-bb23-8c103323fc0f/', '/variant-samples/d62836a0-2de3-4970-bf14-eba3ca758a82/'),
    ('Chromosome (hg38)', 'Chrom (hg38)', '1', '16'),
    ('Start position (hg38)', 'Pos (hg38)', '2030666', '23630011'),
    ('Chromosome (hg19)', 'Chrom (hg19)', '1', '16'),
    ('Start position (hg19)', 'Pos (hg19)', '1962105', '23641332'),
    ('Reference Nucleotide', 'Ref', 'G', 'C'),
    ('Alternate Nucleotide', 'Alt', 'A', 'CTTA'),
    ('Proband Genotype', 'Proband genotype', 'Heterozygous', 'Heterozygous'),
    ('Mother Genotype', 'Mother genotype', 'Homozygous alternate', ''),
    ('Father Genotype', 'Father genotype', 'Heterozygous', ''),
    ('HGVS genomic nomenclature', 'HGVSG', 'NC_000001.11:g.2030666G>A', 'NC_000016.10:g.23630011_23630012insTTA'),
    ('HGVS cPos nomenclature', 'HGVSC', 'ENST00000378585.7:c.*384G>A', 'ENST00000261584.9:c.2142_2143insTAA'),
    ('HGVS pPos nomenclature', 'HGVSP', 'ENST00000378585.7:p.V>A', 'ENSP00000261584.4:p.Asp714_Asp715insTer'),
    ('dbSNP ID of variant', 'dbSNP ID', 'rs142404438', 'rs876658855'),
    ('Gene symbol(s)', 'Genes', 'GABRD', 'PALB2'),
    ('Ensembl ID of canonical transcript of gene variant is in', 'Canonical transcript ID', 'ENST00000378585', 'ENST00000261584'),
    ('Number of exon or intron variant is located in canonical transcript, out of total', 'Canonical transcript location', "Exon 9/9 (3' UTR)", 'Exon 5/13'),
    ('Coding effect of variant in canonical transcript', 'Canonical transcript coding effect', '3_prime_UTR_variant', 'stop_gained, inframe_insertion'),
    ('Ensembl ID of transcript with worst annotation for variant', 'Most severe transcript ID', 'ENST00000378585', 'ENST00000261584'),
    ('Number of exon or intron variant is located in most severe transcript, out of total', 'Most severe transcript location', "Exon 9/9 (3' UTR)", 'Exon 5/13'),
    ('Coding effect of variant in most severe transcript', 'Most severe transcript coding effect', '3_prime_UTR_variant', 'stop_gained, inframe_insertion'),
    ('Inheritance Modes of variant', 'Inheritance modes', 'paternal dominant', ''),
    ('Novocaller Posterior Probability', 'NovoPP', '0.5', ''),
    ('Variant ID of mate, if variant is part of a compound heterozygous group', 'Cmphet mate', 'chr11:1016779G>A', ''),
    ('Variant call quality score', 'Variant Quality', '688.12', '261.94'),
    ('Genotype call quality score', 'Genotype Quality', '99', '24'),
    ("Strand bias estimated using Fisher's exact test", 'Strand Bias', '6.249', '0'),
    ('Number of reads with variant allele', 'Allele Depth', '10', '12'),
    ('Total number of reads at position', 'Read Depth', '20', '30'),
    ('Clinvar ID of variant', 'clinvar ID', '89991', '230941'),
    ('Total allele frequency in gnomad v3 (genomes)', 'gnomADv3 total AF', '0.000197078', ''),
    ('Max. allele frequency in gnomad v3 (genomes)', 'gnomADv3 popmax AF', '0.00500192', ''),
    ('Population with max. allele frequency in gnomad v3 (genomes)', 'gnomADv3 popmax population', 'East Asian', ''),
    ('Total allele frequency in gnomad v2 (exomes)', 'gnomADv2 exome total AF', '0.0002', ''),
    ('Max. allele frequency in gnomad v2 (exomes)', 'gnomADv2 exome popmax AF', '0.3', ''),
    ('Population with max. allele frequency in gnomad v2 (exomes)', 'gnomADv2 exome popmax population', 'East Asian', ''),
    ('GERP++ score', 'GERP++', '5.02', ''),
    ('CADD score', 'CADD', '0.613', ''),
    ('phyloP (30 Mammals) score', 'phyloP-30M', '-3.49499988555908', ''),
    ('phyloP (100 Vertebrates) score', 'phyloP-100V', '-0.352999985218048', ''),
    ('phastCons (100 Vertebrates) score', 'phastCons-100V', '0.0', ''),
    ('SIFT prediction', 'SIFT', 'T', ''),
    ('PolyPhen2 prediction', 'PolyPhen2', 'D', ''),
    ('Primate AI prediction', 'PrimateAI', 'D', ''),
    ('REVEL score', 'REVEL', '0.013', ''),
    ('SpliceAI score', 'SpliceAI', '0', '0'),
    ('Loss-of-function observed/expected upper bound fraction', 'LOEUF', '0.245', '1.006'),
    ('Estimates of heterozygous selection (source: Cassa et al 2017 Nat Genet doi:10.1038/ng.3831)', 'S-het', '0.111583011', '0.011004153'),
    ('ACMG classification for variant in this case', 'ACMG classification (current)', 'Uncertain significance', ''),
    ('ACMG rules invoked for variant in this case', 'ACMG rules (current)', 'PM1', ''),
    ('Clinical interpretation notes written for this case', 'Clinical interpretation notes (current)', 'This variant has been reported in the ClinVar database as Unknown Significance.', ''),
    ('Gene candidacy level selected for this case', 'Gene candidacy (current)', 'Strong candidate', ''),
    ('Variant candidacy level selected for this case', 'Variant candidacy (current)', 'Moderate candidate', ''),
    ('Gene/variant discovery notes written for this case', 'Discovery notes (current)', 'This gene is a real discovery!', ''),
    ('Additional notes on variant written for this case', 'Variant notes (current)', 'What a note', ''),
    ('Additional notes on gene written for this case', 'Gene notes (current)', 'What a note', ''),
    ('ACMG classification for variant in previous cases', 'ACMG classification (previous)', 'Pathogenic', ''),
    ('ACMG rules invoked for variant in previous cases', 'ACMG rules (previous)', 'PS1', ''),
    ('Clinical interpretation notes written for previous cases', 'Clinical interpretation (previous)', 'This variant has been reported in the ClinVar database as Pathogenic.', ''),
    ('Gene candidacy level selected for previous cases', 'Gene candidacy (previous)', 'Moderate candidate', ''),
    ('Variant candidacy level selected for previous cases', 'Variant candidacy (previous)', 'Weak candidate', ''),
    ('Gene/variant discovery notes written for previous cases', 'Discovery notes (previous)', 'This gene is not a real discovery...', ''),
    ('Additional notes on variant written for previous cases', 'Variant notes (previous)', 'What a poor note', ''),
    ('Additional notes on gene written for previous cases', 'Gene notes (previous)', 'What a poor note', '')
]


def parse_spreadsheet_response(response: TestResponse) -> List[List[str]]:
    result = []
    for row in response.body.decode().split("\n"):
        if not row:
            continue
        formatted_row = []
        cells = row.strip("\r").split("\t")
        for cell in cells:
            formatted_cell = cell.strip('"')
            formatted_row.append(formatted_cell)
        result.append(formatted_row)
    return result


@pytest.mark.workbook
def test_case_search_spreadsheet(html_es_testapp: TestApp, es_testapp: TestApp, workbook: None) -> None:
    """Integrated test of case search spreadsheet.

    Ensure all fields present on at least one Case included in the
    spreadsheet.

    Test with both a JSON and an HTML form POST; the latter is used by
    front-end in production.
    """
    case_search_compound_filterset = {
        "search_type": "Case", "global_flags": "case_id=CASE10254-S1-C1",
    }
    post_body = {"compound_search_request": json.dumps(case_search_compound_filterset)}
    json_post_response = es_testapp.post_json(
        CASE_SPREADSHEET_URL,
        post_body,
        status=200,
    )
    json_post_rows = parse_spreadsheet_response(json_post_response)

    form_post_response = html_es_testapp.post(
        CASE_SPREADSHEET_URL,
        post_body,
        content_type=APPLICATION_FORM_ENCODED_MIME_TYPE,
        status=200,
    )
    form_post_rows = parse_spreadsheet_response(form_post_response)

    assert json_post_rows == form_post_rows

    rows = json_post_rows
    assert len(rows) == 3

    columns = list(zip(*rows))
    assert columns == EXPECTED_CASE_SPREADSHEET_COLUMNS


@pytest.mark.parametrize(
    "to_evaluate,expected",
    [
        ({}, CaseSpreadsheet.NO_FLAG_DEFAULT),
        ({"quality_control_flags": {}}, CaseSpreadsheet.NO_FLAG_DEFAULT),
        ({"quality_control_flags": {"flag": "pass"}}, "pass"),
    ],
)
def test_get_qc_flag(to_evaluate: JsonObject, expected: str) -> None:
    result = CaseSpreadsheet._get_qc_flag(to_evaluate)
    assert result == expected


@pytest.mark.workbook
def test_variant_sample_spreadsheet_download(
    html_es_testapp: TestApp, es_testapp: TestApp, workbook: None
) -> None:
    """Integrated test of variant sample search spreadsheet.

    Ensure all fields present on at least one VariantSample included in
    the spreadsheet.

    Test with both a JSON and an HTML form POST; the latter is used by
    front-end in production.
    """
    compound_filterset = {
        "search_type": "VariantSample",
        "global_flags": (
            "CALL_INFO=SAM10254-S1&file=GAPFI3EBH4X2"
            "&additional_facet=proband_only_inheritance_modes&sort=date_created"
        ),
        "intersect": False,
        "filter_blocks":[
            {
                "query": (
                    "associated_genotype_labels.proband_genotype_label=Heterozygous"
                    "&associated_genelists=Breast+Cancer+%2828%29"
                    "&variant.genes.genes_most_severe_consequence.impact=MODERATE"
                    "&variant.genes.genes_most_severe_consequence.impact=HIGH"
                ),
                "flags_applied": []
            },
            {
                "query": (
                    "GQ.from=60&GQ.to=99"
                    "&associated_genotype_labels.proband_genotype_label=Heterozygous"
                    "&associated_genelists=Familial+Cancer+%28148%29"
                    "&variant.csq_clinvar_clnsig=Uncertain_significance"
                    "&variant.csq_clinvar_clnsig=Pathogenic"
                    "&variant.csq_gnomadg_af.from=0&variant.csq_gnomadg_af.to=0.001"
                    "&variant.genes.genes_most_severe_consequence.impact=MODERATE"
                    "&variant.genes.genes_most_severe_consequence.impact=HIGH"
                ),
                "flags_applied": []
            },
            {
                "query": (
                    "variant.csq_gnomade2_af.from=0&variant.csq_gnomade2_af.to=0.001"
                    "&variant.csq_gnomadg_af.from=0&variant.csq_gnomadg_af.to=0.001"
                ),
                "flags_applied": [],
            }
        ]
    }
    post_body = {"compound_search_request": json.dumps(compound_filterset)}
    json_post_response = es_testapp.post_json(
        VARIANT_SAMPLE_SPREADSHEET_URL,
        post_body,
        status=200,
    )
    json_post_rows = parse_spreadsheet_response(json_post_response)

    form_post_response = html_es_testapp.post(
        VARIANT_SAMPLE_SPREADSHEET_URL,
        post_body,
        content_type=APPLICATION_FORM_ENCODED_MIME_TYPE,
        status=200,
    )
    form_post_rows = parse_spreadsheet_response(form_post_response)

    assert json_post_rows == form_post_rows

    rows = json_post_rows
    assert len(rows) == 6

    filters_row = rows[0]
    assert filters_row == EXPECTED_VARIANT_SAMPLE_FILTERS_ROW

    spacer_row = rows[1]
    assert spacer_row == EXPECTED_VARIANT_SAMPLE_SPACER_ROW

    variant_sample_rows = rows[2:]
    columns = list(zip(*variant_sample_rows))
    assert columns == EXPECTED_VARIANT_SAMPLE_SPREADSHEET_COLUMNS
