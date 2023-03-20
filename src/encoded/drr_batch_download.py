from dataclasses import dataclass
from functools import cached_property, partial
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
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

from .drr_item_models import JsonObject, VariantSample
from .batch_download_utils import (
    FilterSetSearch,
    OrderedSpreadsheetColumn,
    SpreadsheetColumn,
    SpreadsheetCreationError,
    SpreadsheetGenerator,
    SpreadsheetPost,
    SpreadsheetTemplate,
)
from .root import CGAPRoot


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


class VariantSampleSpreadsheet(SpreadsheetTemplate):

    @cached_property
    def _spreadsheet_columns(self) -> List[SpreadsheetColumn]:
        column_tuples = self._get_column_tuples()
        return self._convert_column_tuples_to_spreadsheet_columns(column_tuples)

    def get_column_titles(self) -> List[str]:
        return [column.get_title() for column in self._spreadsheet_columns]

    def get_column_descriptions(self) -> List[str]:
        return [column.get_description() for column in self._spreadsheet_columns]

    def get_row_for_item(self, variant_sample_properties: JsonObject) -> List[str]:
        variant_sample = VariantSample(variant_sample_properties)
        result = []
        for column in self._spreadsheet_columns():
            if column.is_property_evaluator():
                result.append(column.get_field_for_item(variant_sample_properties))
            elif column.is_callable_evaluator():
                result.append(column.get_field_for_item(variant_sample))
            else:
                raise SpreadsheetCreationError(
                    "Unable to use column for evaluating item"
                )
        return result

    def _get_column_tuples(self) -> Sequence[OrderedSpreadsheetColumn]:
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
                self._get_canonical_transcript_feature,
            ),
            (
                "Canonical transcript location",
                "Number of exon or intron variant is located in canonical transcript, out of total",
                self._get_canonical_transcript_location,
            ),
            (
                "Canonical transcript coding effect",
                "Coding effect of variant in canonical transcript",
                self._get_canonical_transcript_consequence_display_title,
            ),
            (
                "Most severe transcript ID",
                "Ensembl ID of transcript with worst annotation for variant",
                self._get_most_severe_transcript_consequence_feature,
            ),
            (
                "Most severe transcript location",
                "Number of exon or intron variant is located in most severe transcript, out of total",
                self._get_most_severe_transcript_location,
            ),
            (
                "Most severe transcript coding effect",
                "Coding effect of variant in most severe transcript",
                self._get_most_severe_transcript_consequence_display_title,
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
                self._get_gnomad_v3_popmax_population,
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
                self._get_gnomadv2_popmax_population,
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
                self._get_own_project_note_factory(
                    "variant.interpretations",
                    "classification"
                )
            ),
            (
                "ACMG rules (prev)",
                "ACMG rules invoked for variant in previous cases",
                self._own_project_note_factory(
                    "variant.interpretations",
                    "acmg"
                )
            ),
            (
                "Clinical interpretation (prev)",
                "Clinical interpretation notes written for previous cases",
                self._own_project_note_factory(
                    "variant.interpretations",
                    "note_text"
                )
            ),
            (
                "Gene candidacy (prev)",
                "Gene candidacy level selected for previous cases",
                self._own_project_note_factory(
                    "variant.discovery_interpretations",
                    "gene_candidacy"
                )
            ),
            (
                "Variant candidacy (prev)",
                "Variant candidacy level selected for previous cases",
                self._own_project_note_factory(
                    "variant.discovery_interpretations",
                    "variant_candidacy"
                )
            ),
            (
                "Discovery notes (prev)",
                "Gene/variant discovery notes written for previous cases",
                self._own_project_note_factory(
                    "variant.discovery_interpretations",
                    "note_text"
                )
            ),
            (
                "Variant notes (prev)",
                "Additional notes on variant written for previous cases",
                self._own_project_note_factory(
                    "variant.variant_notes",
                    "note_text"
                )
            ),
            (
                "Gene notes (prev)",
                "Additional notes on gene written for previous cases",
                self._own_project_note_factory(
                    "variant.genes.genes_most_severe_gene.gene_notes",
                    "note_text"
                )
            ),
        ]

    def _get_canonical_transcript_feature(self, variant_sample: VariantSample) -> str:
        return variant_sample.get_canonical_transcript_feature()

    def _get_canonical_transcript_location(self, variant_sample: VariantSample) -> str:
        return variant_sample.get_canonical_transcript_location()

    def _get_canonical_transcript_consequence_display_title(
        self, variant_sample: VariantSample
    ) -> str:
        return variant_sample.get_canonical_transcript_consequence_display_title()

    def _get_most_severe_transcript_feature(self, variant_sample: VariantSample) -> str:
        return variant_sample.get_most_severe_transcript_feature()

    def _get_most_severe_transcript_location(self, variant_sample: VariantSample) -> str:
        return variant_sample.get_most_severe_transcript_location()

    def _get_most_severe_transcript_consequence_display_title(
        self, variant_sample: VariantSample
    ) -> str:
        return variant_sample.get_most_severe_transcript_consequence_display_title()

    def _get_gnomad_v3_popmax_population(self, variant_sample: VariantSample) -> str:
        return variant_sample.get_gnomad_v3_popmax_population()

    def _get_gnomad_v2_popmax_population(self, variant_sample: VariantSample) -> str:
        return variant_sample.get_gnomad_v2_popmax_population()

    def _get_note_of_same_project(
        self, note_property_location: str, note_property_to_retrieve: str
    ):
        note_evaluator = partial(
            self._get_note_properties,
            note_property_location=note_property_location,
            note_property_to_retrieve=note_property_to_retrieve,
        )
        return note_evaluator

    def _get_note_properties(
        self,
        variant_sample: VariantSample,
        note_property_location="",
        note_property_to_retrieve="",
    ):
        variant_sample_properties = variant_sample.get_properties()
        note_properties = self._get_property(
            variant_sample_properties, note_property_location
        )
        return self._get_property(note_properties, note_property_to_retrieve)

    def _get_property(self, properties: JsonObject, property_to_get: str) -> str:
        pass


@dataclass(frozen=True)
class CaseSpreadsheetTemplate(SpreadsheetTemplate):

    def get_headers(self) -> None:
        pass

    def get_column_titles(self) -> None:
        pass

    def get_column_descriptions(self) -> None:
        pass

    def get_row_for_item(self, item_to_evaluate: JsonObject) -> None:
        pass
