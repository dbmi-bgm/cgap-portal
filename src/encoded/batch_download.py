from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import (
    Callable,
    Iterable,
    Iterator,
    List,
    Optional,
)

import pytz
import structlog
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.request import Request
from pyramid.response import Response
from pyramid.view import view_config
from snovault.util import debug_log, simple_path_ids

from .item_models import Note, VariantSample
from .batch_download_utils import (
    ACCEPTABLE_FILE_FORMATS,
    get_values_for_field,
    human_readable_filter_block_queries,
    FilterSetSearch,
    OrderedSpreadsheetColumn,
    SpreadsheetColumn,
    SpreadsheetFromColumnTuples,
    SpreadsheetCreationError,
    SpreadsheetGenerator,
    SpreadsheetRequest,
)
from .root import CGAPRoot
from .util import APPLICATION_FORM_ENCODED_MIME_TYPE, JsonObject, format_to_url, register_path_content_type


log = structlog.getLogger(__name__)

CASE_SPREADSHEET_ENDPOINT = "case_search_spreadsheet"
CASE_SPREADSHEET_URL = format_to_url(CASE_SPREADSHEET_ENDPOINT)
VARIANT_SAMPLE_SPREADSHEET_ENDPOINT = "variant_sample_search_spreadsheet"
VARIANT_SAMPLE_SPREADSHEET_URL = format_to_url(VARIANT_SAMPLE_SPREADSHEET_ENDPOINT)


def includeme(config):
    config.add_route(CASE_SPREADSHEET_ENDPOINT, CASE_SPREADSHEET_URL)
    config.add_route(VARIANT_SAMPLE_SPREADSHEET_ENDPOINT,
                     VARIANT_SAMPLE_SPREADSHEET_URL)
    config.scan(__name__)


register_path_content_type(
    path=CASE_SPREADSHEET_URL, content_type=APPLICATION_FORM_ENCODED_MIME_TYPE
)


def validate_spreadsheet_file_format(context: CGAPRoot, request: Request) -> None:
    spreadsheet_request = SpreadsheetRequest(request)
    file_format = spreadsheet_request.get_file_format()
    if file_format not in ACCEPTABLE_FILE_FORMATS:
        raise HTTPBadRequest(f"File format not acceptable: {file_format}")


def validate_spreadsheet_search_parameters(context: CGAPRoot, request: Request) -> None:
    spreadsheet_request = SpreadsheetRequest(request)
    search = spreadsheet_request.get_compound_search()
    if not search:
        raise HTTPBadRequest("No search parameters given")


@view_config(
    route_name=VARIANT_SAMPLE_SPREADSHEET_ENDPOINT,
    request_method="POST",
    validators=[validate_spreadsheet_file_format, validate_spreadsheet_search_parameters],
)
@debug_log
def variant_sample_search_spreadsheet(context: CGAPRoot, request: Request) -> Response:
    spreadsheet_request = SpreadsheetRequest(request)
    file_format = spreadsheet_request.get_file_format()
    file_name = get_variant_sample_spreadsheet_file_name(spreadsheet_request)
    items_for_spreadsheet = get_items_from_search(context, request, spreadsheet_request)
    spreadsheet_rows = get_variant_sample_rows(items_for_spreadsheet, spreadsheet_request)
    return get_spreadsheet_response(file_name, spreadsheet_rows, file_format)


@view_config(
    route_name=CASE_SPREADSHEET_ENDPOINT,
    request_method="POST",
    validators=[validate_spreadsheet_file_format, validate_spreadsheet_search_parameters],
)
@debug_log
def case_search_spreadsheet(context: CGAPRoot, request: Request) -> Response:
    spreadsheet_request = SpreadsheetRequest(request)
    file_format = spreadsheet_request.get_file_format()
    file_name = get_case_spreadsheet_file_name()
    items_for_spreadsheet = get_items_from_search(context, request, spreadsheet_request)
    spreadsheet_rows = get_case_rows(items_for_spreadsheet)
    return get_spreadsheet_response(file_name, spreadsheet_rows, file_format)


def get_variant_sample_spreadsheet_file_name(spreadsheet_request: SpreadsheetRequest) -> str:
    case_accession = spreadsheet_request.get_case_accession() or "case"
    timestamp = get_timestamp()
    return f"{case_accession}-filtering-{timestamp}"


def get_timestamp():
    now = datetime.now(pytz.utc).isoformat()[:-13]
    now = now.replace(" ", "-")
    return f"{now}Z"


def get_case_spreadsheet_file_name() -> str:
    timestamp = get_timestamp()
    return f"case_spreadsheet-filtering-{timestamp}"


def get_items_from_search(
    context: CGAPRoot, request: Request, spreadsheet_request: SpreadsheetRequest
) -> Iterator[JsonObject]:
    search_to_perform = spreadsheet_request.get_compound_search()
    return FilterSetSearch(context, request, search_to_perform).get_search_results()


def get_variant_sample_rows(
    items_for_spreadsheet: Iterable[JsonObject],
    spreadsheet_request: SpreadsheetRequest,
    embed_additional_items: Optional[bool] = True,
) -> Iterator[Iterable[str]]:
    return VariantSampleSpreadsheet(
        items_for_spreadsheet, spreadsheet_request, embed_additional_items=embed_additional_items
    ).yield_rows()


def get_case_rows(
    items_for_spreadsheet: Iterable[JsonObject],
) -> Iterator[Iterable[str]]:
    return CaseSpreadsheet(items_for_spreadsheet).yield_rows()


def get_spreadsheet_response(
    file_name: str, spreadsheet_rows: Iterator[List[str]], file_format: str
) -> Response:
    return SpreadsheetGenerator(
        file_name, spreadsheet_rows, file_format=file_format
    ).get_streaming_response()


@dataclass(frozen=True)
class VariantSampleSpreadsheet(SpreadsheetFromColumnTuples):

    NOTE_FIELDS_TO_EMBED = [
        "variant.interpretations",
        "variant.discovery_interpretations",
        "variant.variant_notes",
        "variant.genes.genes_most_severe_gene.gene_notes",
        "interpretation",
        "discovery_interpretation",
        "variant_notes",
        "gene_notes",
    ]

    spreadsheet_request: SpreadsheetRequest
    embed_additional_items: bool = True

    def _get_headers(self) -> List[List[str]]:
        result = []
        result += self._get_available_header_lines()
        if result:
            result += [["## -------------------------------------------------------"]]
        return result

    def _get_available_header_lines(self) -> List[List[str]]:
        result = []
        result += self._get_case_accession_line()
        result += self._get_case_title_line()
        result += self._get_readable_filters_line()
        return result

    def _get_case_accession_line(self) -> List[List[str]]:
        result = []
        case_accession = self.spreadsheet_request.get_case_accession()
        if case_accession:
            result.append(["#", "Case Accession:", "", case_accession])
        return result

    def _get_case_title_line(self) -> List[List[str]]:
        result = []
        case_title = self.spreadsheet_request.get_case_title()
        if case_title:
            result.append(["#", "Case Title:", "", case_title])
        return result

    def _get_readable_filters_line(self) -> List[List[str]]:
        result = []
        search = self.spreadsheet_request.get_compound_search()
        if search:
            readable_filter_blocks = human_readable_filter_block_queries(search)
            result.append(["#", "Filters Selected:", "", readable_filter_blocks])
        return result

    def _get_row_for_item(self, item_to_evaluate: JsonObject) -> List[str]:
        if self.embed_additional_items:
            self._merge_notes(item_to_evaluate)
        variant_sample = VariantSample(item_to_evaluate)
        return [
            self._evaluate_item_with_column(column, variant_sample)
            for column in self._spreadsheet_columns
        ]

    def _merge_notes(self, variant_sample_properties: JsonObject) -> None:
        for note_field in self.NOTE_FIELDS_TO_EMBED:
            existing_notes = simple_path_ids(variant_sample_properties, note_field)
            for existing_note in existing_notes:
                self._update_note(existing_note)

    def _update_note(self, note_properties: JsonObject) -> None:
        all_note_properties = self._get_note_by_subrequest(note_properties)
        note_properties.update(all_note_properties)

    def _get_note_by_subrequest(self, note_properties: JsonObject) -> JsonObject:
        note_identifier = Note(note_properties).get_atid()
        request = self.spreadsheet_request.get_request()
        return request.embed(note_identifier, as_user=True)

    def _evaluate_item_with_column(
        self, column: SpreadsheetColumn, variant_sample: VariantSample,
    ) -> str:
        if column.is_property_evaluator():
            return column.get_field_for_item(variant_sample.get_properties())
        if column.is_callable_evaluator():
            return column.get_field_for_item(variant_sample)
        raise SpreadsheetCreationError(
            "Unable to use column for evaluating item"
        )

    @classmethod
    def _get_column_tuples(cls) -> List[OrderedSpreadsheetColumn]:
        return [
            ("ID", "URL path to the variant", "@id"),
            ("Chrom (hg38)", "Chromosome (hg38)", "variant.CHROM"),
            ("Pos (hg38)", "Start position (hg38)", "variant.POS"),
            ("Chrom (hg19)", "Chromosome (hg19)", "variant.hg19_chr"),
            ("Pos (hg19)", "Start position (hg19)", "variant.hg19_pos"),
            ("Ref", "Reference Nucleotide", "variant.REF"),
            ("Alt", "Alternate Nucleotide", "variant.ALT"),
            (
                "Proband genotype",
                "Proband Genotype",
                "associated_genotype_labels.proband_genotype_label",
            ),
            (
                "Mother genotype",
                "Mother Genotype",
                "associated_genotype_labels.mother_genotype_label",
            ),
            (
                "Father genotype",
                "Father Genotype",
                "associated_genotype_labels.father_genotype_label",
            ),
            ("HGVSG", "HGVS genomic nomenclature", "variant.hgvsg"),
            (
                "HGVSC",
                "HGVS cPos nomenclature",
                "variant.genes.genes_most_severe_hgvsc",
            ),
            (
                "HGVSP",
                "HGVS pPos nomenclature",
                "variant.genes.genes_most_severe_hgvsp",
            ),
            ("dbSNP ID", "dbSNP ID of variant", "variant.ID"),
            (
                "Genes",
                "Gene symbol(s)",
                "variant.genes.genes_most_severe_gene.display_title",
            ),
            (
                "Canonical transcript ID",
                "Ensembl ID of canonical transcript of gene variant is in",
                cls._get_canonical_transcript_feature,
            ),
            (
                "Canonical transcript location",
                (
                    "Number of exon or intron variant is located in canonical"
                    " transcript, out of total"
                ),
                cls._get_canonical_transcript_location,
            ),
            (
                "Canonical transcript coding effect",
                "Coding effect of variant in canonical transcript",
                cls._get_canonical_transcript_consequence_names,
            ),
            (
                "Most severe transcript ID",
                "Ensembl ID of transcript with worst annotation for variant",
                cls._get_most_severe_transcript_feature,
            ),
            (
                "Most severe transcript location",
                (
                    "Number of exon or intron variant is located in most severe"
                    " transcript, out of total"
                ),
                cls._get_most_severe_transcript_location,
            ),
            (
                "Most severe transcript coding effect",
                "Coding effect of variant in most severe transcript",
                cls._get_most_severe_transcript_consequence_names,
            ),
            ("Inheritance modes", "Inheritance Modes of variant", "inheritance_modes"),
            ("NovoPP", "Novocaller Posterior Probability", "novoPP"),
            (
                "Cmphet mate",
                (
                    "Variant ID of mate, if variant is part of a compound heterozygous"
                    " group"
                ),
                "cmphet.comhet_mate_variant",
            ),
            ("Variant Quality", "Variant call quality score", "QUAL"),
            ("Genotype Quality", "Genotype call quality score", "GQ"),
            ("Strand Bias", "Strand bias estimated using Fisher's exact test", "FS"),
            ("Allele Depth", "Number of reads with variant allele", "AD_ALT"),
            ("Read Depth", "Total number of reads at position", "DP"),
            ("clinvar ID", "Clinvar ID of variant", "variant.csq_clinvar"),
            (
                "gnomADv3 total AF",
                "Total allele frequency in gnomad v3 (genomes)",
                "variant.csq_gnomadg_af",
            ),
            (
                "gnomADv3 popmax AF",
                "Max. allele frequency in gnomad v3 (genomes)",
                "variant.csq_gnomadg_af_popmax",
            ),
            (
                "gnomADv3 popmax population",
                "Population with max. allele frequency in gnomad v3 (genomes)",
                cls._get_gnomad_v3_popmax_population,
            ),
            (
                "gnomADv2 exome total AF",
                "Total allele frequency in gnomad v2 (exomes)",
                "variant.csq_gnomade2_af",
            ),
            (
                "gnomADv2 exome popmax AF",
                "Max. allele frequency in gnomad v2 (exomes)",
                "variant.csq_gnomade2_af_popmax",
            ),
            (
                "gnomADv2 exome popmax population",
                "Population with max. allele frequency in gnomad v2 (exomes)",
                cls._get_gnomad_v2_popmax_population,
            ),
            ("GERP++", "GERP++ score", "variant.csq_gerp_rs"),
            ("CADD", "CADD score", "variant.csq_cadd_phred"),
            (
                "phyloP-30M",
                "phyloP (30 Mammals) score",
                "variant.csq_phylop30way_mammalian"
            ),
            (
                "phyloP-100V",
                "phyloP (100 Vertebrates) score",
                "variant.csq_phylop100way_vertebrate"
            ),
            (
                "phastCons-100V",
                "phastCons (100 Vertebrates) score",
                "variant.csq_phastcons100way_vertebrate"
            ),
            (
                "SIFT",
                "SIFT prediction",
                "variant.csq_sift_pred"
            ),
            (
                "PolyPhen2",
                "PolyPhen2 prediction",
                "variant.csq_polyphen2_hvar_pred"
            ),
            (
                "PrimateAI",
                "Primate AI prediction",
                "variant.csq_primateai_pred"
            ),
            (
                "REVEL",
                "REVEL score",
                "variant.csq_revel_score"
            ),
            (
                "SpliceAI",
                "SpliceAI score",
                "variant.spliceaiMaxds"
            ),
            (
                "LOEUF",
                "Loss-of-function observed/expected upper bound fraction",
                "variant.genes.genes_most_severe_gene.oe_lof_upper"
            ),
            (
                "S-het",
                (
                    "Estimates of heterozygous selection (source: Cassa et al 2017 Nat"
                    " Genet doi:10.1038/ng.3831)"
                ),
                "variant.genes.genes_most_severe_gene.s_het"
            ),
            (
                "ACMG classification (current)",
                "ACMG classification for variant in this case",
                "interpretation.classification"
            ),
            (
                "ACMG rules (current)",
                "ACMG rules invoked for variant in this case",
                "interpretation.acmg_rules_invoked.acmg_rule_name"
            ),
            (
                "Clinical interpretation notes (current)",
                "Clinical interpretation notes written for this case",
                "interpretation.note_text"
            ),
            (
                "Gene candidacy (current)",
                "Gene candidacy level selected for this case",
                "discovery_interpretation.gene_candidacy"
            ),
            (
                "Variant candidacy (current)",
                "Variant candidacy level selected for this case",
                "discovery_interpretation.variant_candidacy"
            ),
            (
                "Discovery notes (current)",
                "Gene/variant discovery notes written for this case",
                "discovery_interpretation.note_text"
            ),
            (
                "Variant notes (current)",
                "Additional notes on variant written for this case",
                "variant_notes.note_text"
            ),
            (
                "Gene notes (current)",
                "Additional notes on gene written for this case",
                "gene_notes.note_text"
            ),
            (
                "ACMG classification (previous)",
                "ACMG classification for variant in previous cases",
                cls._get_note_of_same_project(
                    "variant.interpretations",
                    "classification"
                )
            ),
            (
                "ACMG rules (previous)",
                "ACMG rules invoked for variant in previous cases",
                cls._get_note_of_same_project(
                    "variant.interpretations",
                    "acmg_rules_invoked.acmg_rule_name"
                )
            ),
            (
                "Clinical interpretation (previous)",
                "Clinical interpretation notes written for previous cases",
                cls._get_note_of_same_project(
                    "variant.interpretations",
                    "note_text"
                )
            ),
            (
                "Gene candidacy (previous)",
                "Gene candidacy level selected for previous cases",
                cls._get_note_of_same_project(
                    "variant.discovery_interpretations",
                    "gene_candidacy"
                )
            ),
            (
                "Variant candidacy (previous)",
                "Variant candidacy level selected for previous cases",
                cls._get_note_of_same_project(
                    "variant.discovery_interpretations",
                    "variant_candidacy"
                )
            ),
            (
                "Discovery notes (previous)",
                "Gene/variant discovery notes written for previous cases",
                cls._get_note_of_same_project(
                    "variant.discovery_interpretations",
                    "note_text"
                )
            ),
            (
                "Variant notes (previous)",
                "Additional notes on variant written for previous cases",
                cls._get_note_of_same_project(
                    "variant.variant_notes",
                    "note_text"
                )
            ),
            (
                "Gene notes (previous)",
                "Additional notes on gene written for previous cases",
                cls._get_note_of_same_project(
                    "variant.genes.genes_most_severe_gene.gene_notes",
                    "note_text"
                )
            ),
        ]

    @classmethod
    def _get_canonical_transcript_feature(cls, variant_sample: VariantSample) -> str:
        return variant_sample.get_canonical_transcript_feature()

    @classmethod
    def _get_canonical_transcript_location(cls, variant_sample: VariantSample) -> str:
        return variant_sample.get_canonical_transcript_location()

    @classmethod
    def _get_canonical_transcript_consequence_names(
        cls, variant_sample: VariantSample
    ) -> str:
        return variant_sample.get_canonical_transcript_consequence_names()

    @classmethod
    def _get_most_severe_transcript_feature(cls, variant_sample: VariantSample) -> str:
        return variant_sample.get_most_severe_transcript_feature()

    @classmethod
    def _get_most_severe_transcript_location(cls, variant_sample: VariantSample) -> str:
        return variant_sample.get_most_severe_transcript_location()

    @classmethod
    def _get_most_severe_transcript_consequence_names(
        cls, variant_sample: VariantSample
    ) -> str:
        return variant_sample.get_most_severe_transcript_consequence_names()

    @classmethod
    def _get_gnomad_v3_popmax_population(cls, variant_sample: VariantSample) -> str:
        return variant_sample.get_gnomad_v3_popmax_population()

    @classmethod
    def _get_gnomad_v2_popmax_population(cls, variant_sample: VariantSample) -> str:
        return variant_sample.get_gnomad_v2_popmax_population()

    @classmethod
    def _get_note_of_same_project(
        cls, note_property_location: str, note_property_to_retrieve: str
    ) -> Callable:
        note_evaluator = partial(
            cls._get_note_properties,
            note_property_location=note_property_location,
            note_property_to_retrieve=note_property_to_retrieve,
        )
        return note_evaluator

    @classmethod
    def _get_note_properties(
        cls,
        variant_sample: VariantSample,
        note_property_location: str = "",
        note_property_to_retrieve: str = "",
    ) -> str:
        result = ""
        note = variant_sample.get_most_recent_note_of_same_project_from_property(note_property_location)
        if note:
            result = get_values_for_field(note.get_properties(),
                                          note_property_to_retrieve)
        return result


@dataclass(frozen=True)
class CaseSpreadsheet(SpreadsheetFromColumnTuples):

    NO_FLAG_DEFAULT = "No flag"

    def _get_headers(self) -> List[str]:
        return []

    def _get_row_for_item(self, item_to_evaluate: JsonObject) -> List[str]:
        return [
            self._evaluate_item_with_column(column, item_to_evaluate)
            for column in self._spreadsheet_columns
        ]

    def _evaluate_item_with_column(
        self, column: SpreadsheetColumn, item_to_evaluate: JsonObject
    ):
        if column.is_property_evaluator():
            return column.get_field_for_item(item_to_evaluate)
        if column.is_callable_evaluator():
            return column.get_field_for_item(item_to_evaluate)
        raise SpreadsheetCreationError(
            "Unable to use column for evaluating item"
        )

    @classmethod
    def _get_column_tuples(cls) -> List[OrderedSpreadsheetColumn]:
        return [
            ("Case ID", "Case identifier", "case_title"),
            ("UUID", "Unique database identifier", "uuid"),
            ("Individual ID", "Individual identifier", "individual.individual_id"),
            ("Individual sex", "Sex of associated individual", "individual.sex"),
            ("Proband case", "Whether case is for a proband", "proband_case"),
            ("Family ID", "Family identifier", "family.family_id"),
            ("Analysis type", "Analysis type", "sample_processing.analysis_type"),
            ("Sample ID", "Primary sample identifier", "sample.display_title"),
            ("Sequencing", "Primary sample sequencing type", "sample.workup_type"),
            ("QC flag", "Overall QC flag", cls._get_qc_flag),
            ("Completed QC", "Completed QC steps", "quality_control_flags.completed_qcs"),
            (
                "QC warnings",
                "QC steps with warning flags",
                "sample_processing.quality_control_metrics.warn",
            ),
            (
                "QC failures",
                "QC steps with failure flags",
                "sample_processing.quality_control_metrics.fail",
            ),
        ]

    @classmethod
    def _get_qc_flag(cls, item_to_evaluate: JsonObject) -> str:
        qc_flag = get_values_for_field(item_to_evaluate, "quality_control_flags.flag")
        return qc_flag or cls.NO_FLAG_DEFAULT
