import json
from contextlib import contextmanager
from copy import deepcopy
from unittest import mock
from typing import Any, Iterable, Iterator, List, Optional, Union

import pytest
from pyramid.httpexceptions import HTTPBadRequest
from webtest.app import TestApp
from webtest.response import TestResponse

from .utils import patch_context
from .. import batch_download as batch_download_module, batch_download_utils as batch_download_utils_module
from ..batch_download import (
    CASE_SPREADSHEET_URL,
    VARIANT_SAMPLE_SPREADSHEET_URL,
    CaseSpreadsheet,
    VariantSampleSpreadsheet,
    validate_spreadsheet_file_format,
    validate_spreadsheet_search_parameters,
)
from ..batch_download_utils import (
    OrderedSpreadsheetColumn, SpreadsheetColumn, SpreadsheetCreationError, SpreadsheetRequest
)
from ..item_models import Note, VariantSample
from ..util import APPLICATION_FORM_ENCODED_MIME_TYPE, JsonObject


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
SOME_TITLE = "title"
SOME_DESCRIPTION = "description"
SOME_PROPERTY_COLUMN_TUPLE = (SOME_TITLE, SOME_DESCRIPTION, "fu")
SOME_CALLABLE_COLUMN_TUPLE = (SOME_TITLE, SOME_DESCRIPTION, print)
SOME_COLUMN_TUPLES = [SOME_PROPERTY_COLUMN_TUPLE, SOME_CALLABLE_COLUMN_TUPLE]
SOME_SPREADSHEET_COLUMNS = [SpreadsheetColumn(*column) for column in SOME_COLUMN_TUPLES]


@contextmanager
def patch_variant_sample_spreadsheet_column_tuples(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet._get_column_tuples,
        **kwargs,
    ) as mock_get_column_tuples:
        yield mock_get_column_tuples


@contextmanager
def patch_variant_sample_spreadsheet_columns(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet._spreadsheet_columns,
        **kwargs,
    ) as mock_get_columns:
        yield mock_get_columns


@contextmanager
def patch_variant_sample_spreadsheet_evaluate_item(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet._evaluate_item_with_column,
        **kwargs
    ) as mock_evaluate_item:
        yield mock_evaluate_item


@contextmanager
def patch_variant_sample_spreadsheet_get_header_lines(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet._get_available_header_lines,
        **kwargs,
    ) as mock_get_available_header_lines:
        yield mock_get_available_header_lines


@contextmanager
def patch_variant_sample_spreadsheet_add_embeds(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet._add_embeds,
        **kwargs,
    ) as mock_add_embeds:
        yield mock_add_embeds


@contextmanager
def patch_variant_sample_spreadsheet_get_note_by_subrequest(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet._get_note_by_subrequest,
        **kwargs,
    ) as mock_get_note_by_subrequest:
        yield mock_get_note_by_subrequest


@contextmanager
def patch_variant_sample_spreadsheet_get_note_properties(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSampleSpreadsheet._get_note_properties,
        **kwargs,
    ) as mock_get_note_properties:
        yield mock_get_note_properties


@contextmanager
def patch_variant_sample(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.VariantSample,
        **kwargs,
    ) as mock_variant_sample:
        yield mock_variant_sample


@contextmanager
def patch_get_values_for_field(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_module.get_values_for_field,
        **kwargs
    ) as mock_get_values_for_field:
        yield mock_get_values_for_field


@contextmanager
def patch_spreadsheet_request_case_accession(**kwargs: Any) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.SpreadsheetRequest.get_case_accession, **kwargs
    ) as mock_get_case_accession:
        yield mock_get_case_accession


@contextmanager
def patch_spreadsheet_request_case_title(**kwargs: Any) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.SpreadsheetRequest.get_case_title, **kwargs
    ) as mock_get_case_title:
        yield mock_get_case_title


@contextmanager
def patch_spreadsheet_request_file_format(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.SpreadsheetRequest.get_file_format, **kwargs
    ) as mock_get_file_format:
        yield mock_get_file_format


@contextmanager
def patch_spreadsheet_request_compound_search(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        batch_download_utils_module.SpreadsheetRequest.get_compound_search, **kwargs
    ) as mock_get_file_format:
        yield mock_get_file_format


def mock_spreadsheet_request() -> mock.MagicMock:
    return mock.create_autospec(SpreadsheetRequest, instance=True)


def mock_variant_sample() -> mock.MagicMock:
    return mock.create_autospec(VariantSample, instance=True)


def assert_column_tuples(column_tuples: Iterable[OrderedSpreadsheetColumn]) -> None:
    # Should be an easier way to do this with the annotation type directly...
    assert isinstance(column_tuples, Iterable)
    for column_tuple in column_tuples:
        assert len(column_tuple) == 3
        (title, description, evaluator) = column_tuple
        assert isinstance(title, str)
        assert isinstance(description, str)
        assert isinstance(evaluator, str) or callable(evaluator)


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


@pytest.mark.parametrize(
    "file_format,expected_exception",
    [
        ("tsv", False),
        ("csv", False),
        ("foo", True),
    ],
)
def test_validate_spreadsheet_file_format(
    file_format: str, expected_exception: bool
) -> None:
    with patch_spreadsheet_request_file_format(return_value=file_format):
        if expected_exception:
            with pytest.raises(HTTPBadRequest):
                validate_spreadsheet_file_format(None, None)
        else:
            validate_spreadsheet_file_format(None, None)


@pytest.mark.parametrize(
    "compound_search,expected_exception",
    [
        ("", True),
        ("foo", False),
    ]
)
def test_validate_spreadsheet_search_parameters(compound_search: str, expected_exception: bool) -> None:
    with patch_spreadsheet_request_compound_search(return_value=compound_search):
        if expected_exception:
            with pytest.raises(HTTPBadRequest):
                validate_spreadsheet_search_parameters(None, None)
        else:
            validate_spreadsheet_search_parameters(None, None)


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


class TestVariantSampleSpreadsheet:

    SOME_GENE_NOTE_ATID = "/foo/bar/"
    SOME_GENE_NOTE = {"@id": SOME_GENE_NOTE_ATID, "foo": "bar"}
    SOME_UPDATED_GENE_NOTE = {**SOME_GENE_NOTE, "fu": "bur"}
    SOME_VARIANT_SAMPLE_PROPERTIES = {"variant": {"something": "else"}, "gene_notes": [SOME_GENE_NOTE]}
    SOME_VARIANT_SAMPLE_PROPERTIES_WITH_UPDATED_NOTE = {
        **SOME_VARIANT_SAMPLE_PROPERTIES, "gene_notes": [SOME_UPDATED_GENE_NOTE]
    }
    SOME_VARIANT_SAMPLE = VariantSample(SOME_VARIANT_SAMPLE_PROPERTIES)

    def get_variant_sample_spreadsheet(
            self, 
            embed_additional_items: bool = False,
            spreadsheet_request: Optional[mock.Mock] = None,
    ) -> VariantSampleSpreadsheet:
        return VariantSampleSpreadsheet(
            [self.SOME_VARIANT_SAMPLE_PROPERTIES],
            embed_additional_items=embed_additional_items,
            spreadsheet_request=spreadsheet_request,
        )

    @pytest.mark.parametrize(
        "header_lines,expected",
        [
            ([], []),
            ([["foo"]], [["foo"], VariantSampleSpreadsheet.HEADER_SPACER_LINE]),
        ]
    )
    def test_get_headers(self, header_lines: List[List[str]], expected: List[List[str]]) -> None:
        with patch_variant_sample_spreadsheet_get_header_lines(return_value=header_lines):
            spreadsheet = self.get_variant_sample_spreadsheet()
            result = spreadsheet._get_headers()
            assert result == expected

    def test_get_available_header_lines(self) -> None:
        case_accession = case_title = "foo"
        compound_search = {"filter_blocks": [{"search_type": "item"}]}
        expected_filters = "<Any>"
        with patch_spreadsheet_request_case_accession(return_value=case_accession):
            with patch_spreadsheet_request_case_title(return_value=case_title):
                with patch_spreadsheet_request_compound_search(return_value=compound_search):
                    spreadsheet_request = SpreadsheetRequest(None)
                    spreadsheet = self.get_variant_sample_spreadsheet(
                        spreadsheet_request=spreadsheet_request
                    )
                    result = spreadsheet._get_available_header_lines()
                    assert result == [
                        ["#", "Case Accession:", "", case_accession],
                        ["#", "Case Title:", "", case_title],
                        ["#", "Filters Selected:", "", expected_filters],
                    ]

    def test_get_column_titles(self) -> None:
        with patch_variant_sample_spreadsheet_column_tuples(
            return_value=SOME_COLUMN_TUPLES
        ):
            spreadsheet = self.get_variant_sample_spreadsheet()
            result = spreadsheet._get_column_titles()
            assert list(result) == [SOME_TITLE] * 2

    def test_get_column_descriptions(self) -> None:
        with patch_variant_sample_spreadsheet_column_tuples(
            return_value=SOME_COLUMN_TUPLES
        ):
            spreadsheet = self.get_variant_sample_spreadsheet()
            result = spreadsheet._get_column_descriptions()
            assert list(result) == [f"# {SOME_DESCRIPTION}", SOME_DESCRIPTION]

    def test_get_row_for_item(self) -> None:
        expected_result_count = len(SOME_COLUMN_TUPLES)
        with patch_variant_sample_spreadsheet_columns(
            return_value=SOME_SPREADSHEET_COLUMNS
        ):
            with patch_variant_sample_spreadsheet_evaluate_item() as mock_evaluate_item_with_column:
                with patch_variant_sample_spreadsheet_add_embeds() as mock_add_embeds:
                    with patch_variant_sample(
                        return_value=self.SOME_VARIANT_SAMPLE
                    ):
                        spreadsheet = self.get_variant_sample_spreadsheet()
                        result_generator = spreadsheet._get_row_for_item(self.SOME_VARIANT_SAMPLE_PROPERTIES)
                        result = list(result_generator)
                        assert len(result) == expected_result_count
                        assert len(mock_evaluate_item_with_column.call_args_list) == expected_result_count
                        mock_add_embeds.assert_called_once_with(self.SOME_VARIANT_SAMPLE_PROPERTIES)
                        for column in SOME_SPREADSHEET_COLUMNS:
                            mock_evaluate_item_with_column.assert_any_call(
                                column, self.SOME_VARIANT_SAMPLE
                            )

    @pytest.mark.parametrize(
        "embed_additional_items,spreadsheet_request,expected",
        [
            (False, None, SOME_VARIANT_SAMPLE_PROPERTIES),
            (True, None, SOME_VARIANT_SAMPLE_PROPERTIES),
            (False, mock_spreadsheet_request(), SOME_VARIANT_SAMPLE_PROPERTIES),
            (True, mock_spreadsheet_request(), SOME_VARIANT_SAMPLE_PROPERTIES_WITH_UPDATED_NOTE),
        ]
    )
    def test_add_embeds(
        self, embed_additional_items: bool,
        spreadsheet_request: Union[None, mock.Mock],
        expected: JsonObject,
    ) -> None:
        with patch_variant_sample_spreadsheet_get_note_by_subrequest(
            return_value=self.SOME_UPDATED_GENE_NOTE
        ) as mock_get_note:
            spreadsheet = self.get_variant_sample_spreadsheet(
                embed_additional_items=embed_additional_items,
                spreadsheet_request=spreadsheet_request,
            )
            item_to_evaluate = deepcopy(self.SOME_VARIANT_SAMPLE_PROPERTIES)
            spreadsheet._add_embeds(item_to_evaluate)
            assert item_to_evaluate == expected
            if embed_additional_items and spreadsheet_request:
                mock_get_note.assert_called_once_with(self.SOME_UPDATED_GENE_NOTE)
            else:
                mock_get_note.assert_not_called()
            assert item_to_evaluate == expected


    @pytest.mark.parametrize(
        (
            "is_property_evaluator,is_callable_evaluator,expected_exception,"
            "expected_field_for_item_call"
        ),
        [
            (True, False, False, SOME_VARIANT_SAMPLE_PROPERTIES),
            (False, True, False, SOME_VARIANT_SAMPLE),
            (True, True, False, SOME_VARIANT_SAMPLE_PROPERTIES),
            (False, False, True, None),
        ]
    )
    def test_evaluate_item_with_column(
        self, is_property_evaluator: bool, is_callable_evaluator: bool,
        expected_exception: bool, expected_field_for_item_call: Any,
    ) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        column = self.make_mock_column(is_property_evaluator, is_callable_evaluator)
        if expected_exception:
            with pytest.raises(SpreadsheetCreationError):
                spreadsheet._evaluate_item_with_column(column, self.SOME_VARIANT_SAMPLE)
        else:
            result = spreadsheet._evaluate_item_with_column(column, self.SOME_VARIANT_SAMPLE)
            assert result == column.get_field_for_item.return_value
            column.get_field_for_item.assert_called_once_with(expected_field_for_item_call)

    def make_mock_column(
        self, is_property_evaluator: bool, is_callable_evaluator: bool
    ) -> mock.MagicMock:
        column = mock.create_autospec(SpreadsheetColumn, instance=True)
        column.is_property_evaluator.return_value = is_property_evaluator
        column.is_callable_evaluator.return_value = is_callable_evaluator
        return column

    def test_get_column_tuples(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        result = spreadsheet._get_column_tuples()
        assert_column_tuples(result)

    def test_get_canonical_transcript_feature(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_canonical_transcript_feature(variant_sample)
        assert result == variant_sample.get_canonical_transcript_feature.return_value

    def test_get_canonical_transcript_location(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_canonical_transcript_location(variant_sample)
        assert result == variant_sample.get_canonical_transcript_location.return_value

    def test_get_canonical_transcript_consequence_names(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_canonical_transcript_consequence_names(variant_sample)
        assert result == variant_sample.get_canonical_transcript_consequence_names.return_value

    def test_get_most_severe_transcript_feature(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_most_severe_transcript_feature(variant_sample)
        assert result == variant_sample.get_most_severe_transcript_feature.return_value

    def test_get_most_severe_transcript_location(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_most_severe_transcript_location(variant_sample)
        assert result == variant_sample.get_most_severe_transcript_location.return_value

    def test_get_most_severe_transcript_consequence_names(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_most_severe_transcript_consequence_names(variant_sample)
        assert result == variant_sample.get_most_severe_transcript_consequence_names.return_value

    def test_get_gnomad_v3_popmax_population(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_gnomad_v3_popmax_population(variant_sample)
        assert result == variant_sample.get_gnomad_v3_popmax_population.return_value

    def test_get_gnomad_v2_popmax_population(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        variant_sample = mock_variant_sample()
        result = spreadsheet._get_gnomad_v2_popmax_population(variant_sample)
        assert result == variant_sample.get_gnomad_v2_popmax_population.return_value

    def test_get_note_of_same_project(self) -> None:
        spreadsheet = self.get_variant_sample_spreadsheet()
        property_location = "foo"
        property_to_retrieve = "bar"
        with patch_variant_sample_spreadsheet_get_note_properties() as mock_get_note_properties:
            result = spreadsheet._get_note_of_same_project(property_location,
                                                             property_to_retrieve)
            assert callable(result)
            assert result.func == mock_get_note_properties
            assert not result.args
            assert result.keywords == {
                "note_property_location": property_location,
                "note_property_to_retrieve": property_to_retrieve
            }

    @pytest.mark.parametrize(
        "note_found,expected",
        [
            (False, ""), 
            (True, SOME_GENE_NOTE_ATID),
        ]
    )
    def test_get_note_properties(self, note_found: bool, expected: bool) -> None:
        note_property_location = "foo"
        note_property_to_retrieve = "@id"  # Present in SOME_GENE_NOTE
        variant_sample = mock_variant_sample()
        if note_found:
            return_value = Note(self.SOME_GENE_NOTE)
        else:
            return_value = None
        get_note = variant_sample.get_most_recent_note_of_same_project_from_property
        get_note.return_value = return_value
        spreadsheet = self.get_variant_sample_spreadsheet()
        result = spreadsheet._get_note_properties(
            variant_sample,
            note_property_location=note_property_location,
            note_property_to_retrieve=note_property_to_retrieve,
        )
        get_note.assert_called_once_with(note_property_location)
        assert result == expected


class TestCaseSpreadsheet:
    @pytest.mark.parametrize(
        "to_evaluate,expected",
        [
            ({}, CaseSpreadsheet.NO_FLAG_DEFAULT),
            ({"quality_control_flags": {}}, CaseSpreadsheet.NO_FLAG_DEFAULT),
            ({"quality_control_flags": {"flag": "pass"}}, "pass"),
        ],
    )
    def test_get_qc_flag(self, to_evaluate: JsonObject, expected: str) -> None:
        result = CaseSpreadsheet._get_qc_flag(to_evaluate)
        assert result == expected
