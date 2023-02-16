import json
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import (
    Any,
    Callable,
    Dict,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)

from pyramid.request import Request
from pyramid.view import view_config
from snovault.util import debug_log

from .root import CGAPRoot
from .search.compound_search import CompoundSearchBuilder
from .types.base import Item


CASE_SPREADSHEET_ENDPOINT = "case-search-spreadsheet"
CASE_SPREADSHEET_URL = f"/{CASE_SPREADSHEET_ENDPOINT}/"


def includeme(config):
    config.add_route(CASE_SPREADSHEET_ENDPOINT, CASE_SPREADSHEET_URL)
    config.scan(__name__)


@view_config(route_name=CASE_SPREADSHEET_ENDPOINT, request_method="POST")
# Add validator here for file format?
@debug_log
def case_search_spreadsheet(context: CGAPRoot, request: Request) -> Any:
    import pdb

    pdb.set_trace()
    post_parser = SpreadsheetPost(request)


class CaseSpreadsheetColumns:
    pass


class VariantSampleSpreadsheetColumnEvaluators:
    pass


OrderedSpreadsheetColumn = List[str, str, Union[str, Callable]]


@dataclass(frozen=True)
class ItemSpreadsheetTemplate(ABC):

    context: Union[CGAPRoot, Item]
    request: Request

    @abstractmethod
    def get_headers(self) -> None:
        pass

    @abstractmethod
    def get_columns(self) -> None:
        pass

    def convert_column_tuples_to_dataclasses(
        self,
        columns: Sequence[OrderedSpreadsheetColumn],
    ) -> List[SpreadsheetColumn]:
        return [self.assign_column_dataclass(*column) for column in columns]

    @staticmethod
    def assign_column_dataclass(
        title: str, description: str, field: Union[str, Callable]
    ) -> SpreadsheetColumn:
        if isinstance(field, str):
            return SpreadsheetPropertyColumn(title, description, field)
        if callable(field):
            return SpreadsheetComputedColumn(title, description, field)
        raise SpreadsheetCreationError(
            f"Field must be either a string or a callable for column {title}"
        )


# Is frozen data class inherited? Assuming yes
class VariantSampleSpreadsheetTemplate(ItemSpreadsheetTemplate):

    def get_headers(self) -> None:
        pass

    def get_columns(self) -> List[SpreadsheetColumn]:
        return self.convert_column_tuples_to_dataclasses(self.get_column_tuples())

    def get_column_tuples(self) -> Sequence[OrderedSpreadsheetColumn]:
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
                "Gene type",
                "Type of Gene",
                "variant.genes.genes_most_severe_gene.gene_biotype",
            ),
            (
                "Canonical transcript ID",
                "Ensembl ID of canonical transcript of gene variant is in",
                canonical_transcript_csq_feature,
            ),
            (
                "Canonical transcript location",
                "Number of exon or intron variant is located in canonical transcript, out of total",
                canonical_transcript_location,
            ),
            (
                "Canonical transcript coding effect",
                "Coding effect of variant in canonical transcript",
                canonical_transcript_consequence_display_title,
            ),
            (
                "Most severe transcript ID",
                "Ensembl ID of transcript with worst annotation for variant",
                most_severe_transcript_csq_feature,
            ),
            (
                "Most severe transcript location",
                "Number of exon or intron variant is located in most severe transcript, out of total",
                most_severe_transcript_location,
            ),
            (
                "Most severe transcript coding effect",
                "Coding effect of variant in most severe transcript",
                most_severe_transcript_consequence_display_title,
            ),
            ("Inheritance modes", "Inheritance Modes of variant", "inheritance_modes"),
            ("NovoPP", "Novocaller Posterior Probability", "novoPP"),
            (
                "Cmphet mate",
                "Variant ID of mate, if variant is part of a compound heterozygous group",
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
                gnomadv3_popmax_population,
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
                gnomadv2_popmax_population,
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
                "RVIS (ExAC)",
                "RVIS (Residual Variation Intolerance Score) genome-wide percentile from ExAC",
                "variant.genes.genes_most_severe_gene.rvis_exac"
            ),
            (
                "S-het",
                "Estimates of heterozygous selection (source: Cassa et al 2017 Nat Genet doi:10.1038/ng.3831)",
                "variant.genes.genes_most_severe_gene.s_het"
            ),
            (
                "MaxEntScan",
                "Difference in MaxEntScan scores (Maximum Entropy based scores of splicing strength) between Alt and Ref alleles",
                "variant.genes.genes_most_severe_maxentscan_diff"
            ),
            (
                "ACMG classification (curr)",
                "ACMG classification for variant in this case",
                "interpretation.classification"
            ),
            (
                "ACMG rules (curr)",
                "ACMG rules invoked for variant in this case",
                "interpretation.acmg_rules_invoked.acmg_rule_name"
            ),
            (
                "Clinical interpretation notes (curr)",
                "Clinical interpretation notes written for this case",
                "interpretation.note_text"
            ),
            (
                "Gene candidacy (curr)",
                "Gene candidacy level selected for this case",
                "discovery_interpretation.gene_candidacy"
            ),
            (
                "Variant candidacy (curr)",
                "Variant candidacy level selected for this case",
                "discovery_interpretation.variant_candidacy"
            ),
            (
                "Discovery notes (curr)",
                "Gene/variant discovery notes written for this case",
                "discovery_interpretation.note_text"
            ),
            (
                "Variant notes (curr)",
                "Additional notes on variant written for this case",
                "variant_notes.note_text"
            ),
            (
                "Gene notes (curr)",
                "Additional notes on gene written for this case",
                "gene_notes.note_text"
            ),
            (
                "ACMG classification (prev)",
                "ACMG classification for variant in previous cases",
                own_project_note_factory(
                    "variant.interpretations",
                    "classification"
                )
            ),
            (
                "ACMG rules (prev)",
                "ACMG rules invoked for variant in previous cases",
                own_project_note_factory(
                    "variant.interpretations",
                    "acmg"
                )
            ),
            (
                "Clinical interpretation (prev)",
                "Clinical interpretation notes written for previous cases",
                own_project_note_factory(
                    "variant.interpretations",
                    "note_text"
                )
            ),
            (
                "Gene candidacy (prev)",
                "Gene candidacy level selected for previous cases",
                own_project_note_factory(
                    "variant.discovery_interpretations",
                    "gene_candidacy"
                )
            ),
            (
                "Variant candidacy (prev)",
                "Variant candidacy level selected for previous cases",
                own_project_note_factory(
                    "variant.discovery_interpretations",
                    "variant_candidacy"
                )
            ),
            (
                "Discovery notes (prev)",
                "Gene/variant discovery notes written for previous cases",
                own_project_note_factory(
                    "variant.discovery_interpretations",
                    "note_text"
                )
            ),
            (
                "Variant notes (prev)",
                "Additional notes on variant written for previous cases",
                own_project_note_factory(
                    "variant.variant_notes",
                    "note_text"
                )
            ),
            (
                "Gene notes (prev)",
                "Additional notes on gene written for previous cases",
                own_project_note_factory(
                    "variant.genes.genes_most_severe_gene.gene_notes",
                    "note_text"
                )
            ),
        ]


# Look into using post_init here to get fields instead of property decorators
# Or, just don't use a dataclass
@dataclass(frozen=True)
class VariantSample:

    CSQ_CANONICAL = "csq_canonical"
    CSQ_CONSEQUENCE = "csq_consquence"
    CSQ_MOST_SEVERE = "csq_most_severe"
    IMPACT = "impact"
    TRANSCRIPT = "transcript"
    VARIANT = "variant"

    POPULATION_SUFFIX_TITLE_TUPLES = [
        ("afr", "African-American/African"),
        ("ami", "Amish"),
        ("amr", "Latino"),
        ("asj", "Ashkenazi Jewish"),
        ("eas", "East Asian"),
        ("fin", "Finnish"),
        ("mid", "Middle Eastern"),
        ("nfe", "Non-Finnish European"),
        ("oth", "Other Ancestry"),
        ("sas", "South Asian"),
    ]
    TRANSCRIPT_IMPACT_MAP = {"HIGH": 0, "MODERATE": 1, "LOW": 2, "MODIFIER": 3}

    properties: Mapping[str, Any]

    @property
    def variant(self) -> Dict[str, Any]:
        return self.properties.get(self.VARIANT, {})

    @property
    def transcripts(self) -> List[Dict[str, Any]]:
        return self.variant.get(self.TRANSCRIPT, [])

    def get_transcript_if_field_is_true(self, field: str) -> Dict[str, Any]:
        result = {}
        for transcript in self.transcripts:
            if transcript.get(field) is True:
                result = transcript
                break
        return result

    @property
    def canonical_transcript(self) -> Dict[str, Any]:
        return self.get_transcript_if_field_is_true(self.CSQ_CANONICAL)

    @property
    def most_severe_transcript(self) -> Dict[str, Any]:
        return self.get_transcript_if_field_is_true(self.CSQ_MOST_SEVERE)

    def get_most_severe_consequence(self, transcript: Mapping[str, Any]) -> str:
        result = ""
        most_severe_impact_rank = math.inf
        consequences = transcript.get(self.CSQ_CONSEQUENCE, [])
        for consequence in consequences:
            impact = consequence.get(self.IMPACT)
            impact_rank = self.CONSEQUENCE_IMPACT_RANKING.get(impact, math.inf)
            if impact_rank < most_severe_impact_rank:
                most_severe_impact_rank = impact_rank
                result = consequence
        return result

    def get_canonical_transcript_feature(self) -> str:
        return self.canonical_transcript.get(self.CSQ_FEATURE, "")

    def get_most_severe_transcript_feature(self) -> str:
        return self.most_severe_transcript.get(self.CSQ_FEATURE, "")

    def get_transcript_most_severe_consequence_location(self, transcript: Mapping[str, Any]) -> str:
        result = ""
        most_severe_consequence = self.get_most_severe_consequence(transcript)
        most_severe_consequence_name = most_severe_consequence.get(
            self.VAR_CONSEQ_NAME, ""
        )
        exon = transcript.get(self.EXON, "")
        intron = transcript.get(self.INTRON, "")
        distance = transcript.get(self.DISTANCE, "")

        if exon:
            result = "Exon " + exon
        elif intron:
            result = "Intron " + intron
        elif distance and most_severe_consequence_name:
            if most_severe_consequence_name == self.DOWNSTREAM_GENE_CONSEQUENCE:
                result = distance + "bp downstream"
            elif most_severe_consequence_name == self.UPSTREAM_GENE_CONSEQUENCE:
                result = distance + "bp upstream"

        if most_severe_consequence_name == self.THREE_PRIME_UTR_CONSEQUENCE:
            if result:
                result += " (3' UTR)"
            else:
                result = "3' UTR"
        elif most_severe_consequence_name == self.FIVE_PRIME_UTR_CONSEQUENCE:
            if result:
                result += " (5' UTR)"
            else:
                result = "5' UTR"

        return result

    def get_canonical_transcript_location(self) -> str:
        return self.get_transcript_most_severe_consequence_location(self.canonical_transcript)

    def get_most_severe_transcript_location(self) -> str:
        return self.get_transcript_most_severe_consequence_location(self.most_severe_transcript)

    def get_transcript_consequence_names(
        self, transcript: Mapping[str, Any]
    ) -> List[Mapping[str, Any]]:
        return self.get_consequence_names(transcript.get(self.CSQ_CONSEQUENCE, []))

    def get_consequences_names(self, consequences: List[Mapping[str, Any]]) -> str:
        return ", ".join(
            [consequence.get(self.DISPLAY_TITLE, "") for consequence in consequences]
        )

    def get_canonical_transcript_consequence_names(self) -> str:
        return self.get_transcript_consequence_names(self.canonical_transcript)

    def get_most_severe_transcript_consequence_names(self) -> str:
        return self.get_transcript_consequence_names(self.most_severe_transcript)


@dataclass(frozen=True)
class SpreadsheetPost:

    CASE_ACCESSION = "case_accession"
    CASE_TITLE = "case_title"
    COMPOUND_SEARCH_REQUEST = "compound_search_request"
    FILE_FORMAT = "file_format"

    CSV_EXTENSION = "csv"
    TSV_EXTENSION = "tsv"
    ACCEPTABLE_FILE_FORMATS = set([TSV_EXTENSION, CSV_EXTENSION])
    DEFAULT_FILE_FORMAT = TSV_EXTENSION

    request: Request

    @property
    def parameters(self) -> Dict[str, Any]:
        return self.request.params

    def get_file_format(self) -> str:
        return self.parameters.get(self.FILE_FORMAT, self.DEFAULT_FILE_FORMAT)

    def get_case_accession(self) -> str:
        return self.parameters.get(self.CASE_ACCESSION, "")

    def get_case_title(self) -> str:
        return self.parameters.get(self.CASE_TITLE, "")

    def get_associated_compound_search(self) -> Dict:
        # May want to validate this value
        # Going with Alex's format here for json.loading if a string
        # Not sure this should be a dict; might be an array
        compound_search = self.parameters.get(self.COMPOUND_SEARCH_REQUEST, {})
        if isinstance(compound_search, str):
            compound_search = json.loads(compound_search)
        return compound_search


@dataclass(frozen=True)
class FilterSetSearch:

    GLOBAL_FLAGS = "global_flags"
    INTERSECT = "intersect"

    context: CGAPRoot
    request: Request
    compound_search: Mapping

    def get_search_results(self) -> None:
        return CompoundSearchBuilder.execute_filter_set(
            self.context,
            self.request,
            self.get_filter_set(),
            to=CompoundSearchBuilder.ALL,
            global_flags=self.get_global_flags(),
            intersect=self.is_intersect(),
            return_generator=True,
        )

    def get_filter_set(self) -> None:
        return CompoundSearchBuilder.extract_filter_set_from_search_body(
            self.request, self.compound_search
        )

    def get_global_flags(self) -> Union[str, None]:
        return self.compound_search.get(self.GLOBAL_FLAGS)

    def is_intersect(self) -> bool:
        return bool(self.get_intersect())

    def get_intersect(self) -> str:
        return self.compound_search.get(self.INTERSECT, "")


class SpreadsheetCreationError(Exception):
    pass


@dataclass(frozen=True)
class SpreadsheetColumn(ABC):

    title: str
    description: str

    def get_title(self):
        return self.title

    def get_description(self):
        return self.description

    @abstractmethod
    def get_field_for_item(self, item: Mapping) -> None:
        pass


@dataclass(frozen=True)
class SpreadsheetPropertyColumn(SpreadsheetColumn):

    property_to_get: str

    def get_field_for_item(self, item: Mapping) -> str:
        return item.get(self.property_to_get)


@dataclass(frozen=True)
class SpreadsheetComputedColumn(SpreadsheetColumn):

    evaluator: Callable

    def get_field_for_item(self, item: Mapping) -> str:
        return self.evaluator(item)


@dataclass(frozen=True)
class SpreadsheetGenerator:

    headers: Sequence[str]
    items: Sequence[Mapping[str, Any]]
    columns: Sequence[SpreadsheetColumn]

    def yield_rows(self) -> Iterator[List[str]]:
        self.yield_headers()
        self.yield_column_rows()
        self.yield_item_rows()

    def yield_headers(self):
        for header in self.headers:
            yield header

    def yield_column_rows(self):
        column_titles = []
        column_descriptions = []
        for column in self.columns:
            column_titles.append(column.get_title())
            column_descriptions.append(column.get_description())
        yield column_titles
        yield column_descriptions

    def yield_item_rows(self):
        # replace with compound for instead of multiple fors?
        for item in self.items:
            item_row = []
            for column in self.columns:
                item_row.append(column.get_item_data(item))
            yield item_row


@dataclass(frozen=True)
class SpreadsheetResponse:
    pass


@dataclass(frozen=True)
class SpreadsheetMapping:
    pass
