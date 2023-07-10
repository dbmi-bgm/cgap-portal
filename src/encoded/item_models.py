import math
from dataclasses import dataclass
from typing import Iterable, List, Union

from snovault.util import simple_path_ids

from .util import JsonObject


LinkTo = Union[str, JsonObject]


@dataclass(frozen=True)
class Item:
    ATID = "@id"
    PROJECT = "project"

    properties: JsonObject

    @property
    def _atid(self) -> str:
        return self.properties.get(self.ATID, "")

    @property
    def _project(self) -> LinkTo:
        return self.properties.get(self.PROJECT, "")

    def get_properties(self) -> JsonObject:
        return self.properties

    def get_atid(self) -> str:
        return self._atid

    def get_project(self) -> LinkTo:
        return self._project


@dataclass(frozen=True)
class VariantConsequence(Item):
    # Schema constants
    IMPACT = "impact"
    IMPACT_HIGH = "HIGH"
    IMPACT_LOW = "LOW"
    IMPACT_MODERATE = "MODERATE"
    IMPACT_MODIFIER = "MODIFIER"
    VAR_CONSEQ_NAME = "var_conseq_name"

    DOWNSTREAM_GENE_CONSEQUENCE = "downstream_gene_variant"
    FIVE_PRIME_UTR_CONSEQUENCE = "5_prime_UTR_variant"
    THREE_PRIME_UTR_CONSEQUENCE = "3_prime_UTR_variant"
    UPSTREAM_GENE_CONSEQUENCE = "upstream_gene_variant"

    @property
    def _name(self) -> str:
        return self.properties.get(self.VAR_CONSEQ_NAME, "")

    @property
    def _impact(self) -> str:
        return self.properties.get(self.IMPACT, "")

    def get_name(self) -> str:
        return self._name

    def get_impact(self) -> str:
        return self._impact

    def is_downstream(self) -> str:
        return self._name == self.DOWNSTREAM_GENE_CONSEQUENCE

    def is_upstream(self) -> str:
        return self._name == self.UPSTREAM_GENE_CONSEQUENCE

    def is_three_prime_utr(self) -> str:
        return self._name == self.THREE_PRIME_UTR_CONSEQUENCE

    def is_five_prime_utr(self) -> str:
        return self._name == self.FIVE_PRIME_UTR_CONSEQUENCE


@dataclass(frozen=True)
class Transcript:
    # Schema constants
    CSQ_CANONICAL = "csq_canonical"
    CSQ_CONSEQUENCE = "csq_consequence"
    CSQ_DISTANCE = "csq_distance"
    CSQ_EXON = "csq_exon"
    CSQ_FEATURE = "csq_feature"
    CSQ_INTRON = "csq_intron"
    CSQ_MOST_SEVERE = "csq_most_severe"

    # Class constants
    LOCATION_EXON = "Exon"
    LOCATION_INTRON = "Intron"
    LOCATION_DOWNSTREAM = "bp downstream"
    LOCATION_UPSTREAM = "bp upstream"
    LOCATION_FIVE_PRIME_UTR = "5' UTR"
    LOCATION_THREE_PRIME_UTR = "3' UTR"
    IMPACT_RANKING = {
        VariantConsequence.IMPACT_HIGH: 0,
        VariantConsequence.IMPACT_MODERATE: 1,
        VariantConsequence.IMPACT_LOW: 2,
        VariantConsequence.IMPACT_MODIFIER: 3,
    }

    properties: JsonObject

    @property
    def _canonical(self) -> bool:
        return self.properties.get(self.CSQ_CANONICAL, False)

    @property
    def _most_severe(self) -> bool:
        return self.properties.get(self.CSQ_MOST_SEVERE, False)

    @property
    def _exon(self) -> str:
        return self.properties.get(self.CSQ_EXON, "")

    @property
    def _intron(self) -> str:
        return self.properties.get(self.CSQ_INTRON, "")

    @property
    def _distance(self) -> str:
        return self.properties.get(self.CSQ_DISTANCE, "")

    @property
    def _feature(self) -> str:
        return self.properties.get(self.CSQ_FEATURE, "")

    @property
    def _consequences(self) -> List[LinkTo]:
        return self.properties.get(self.CSQ_CONSEQUENCE, [])

    def is_canonical(self) -> bool:
        return self._canonical

    def is_most_severe(self) -> bool:
        return self._most_severe

    def get_feature(self) -> str:
        return self._feature

    def get_location(self) -> str:
        result = ""
        most_severe_consequence = self._get_most_severe_consequence()
        if most_severe_consequence:
            result = self._get_location_by_most_severe_consequence(
                most_severe_consequence
            )
        return result

    def _get_most_severe_consequence(self) -> Union[VariantConsequence, None]:
        result = None
        most_severe_rank = math.inf
        for consequence in self._get_consequences():
            impact = consequence.get_impact()
            impact_rank = self.IMPACT_RANKING.get(impact, math.inf)
            if impact_rank < most_severe_rank:
                most_severe_rank = impact_rank
                result = consequence
        return result

    def _get_consequences(self) -> List[VariantConsequence]:
        return [
            VariantConsequence(item)
            for item in self._consequences
            if isinstance(item, dict)
        ]

    def _get_location_by_most_severe_consequence(
        self, most_severe_consequence: VariantConsequence
    ) -> str:
        if self._exon:
            return self._get_exon_location(most_severe_consequence)
        if self._intron:
            return self._get_intron_location(most_severe_consequence)
        if self._distance:
            return self._get_distance_location(most_severe_consequence)
        return ""

    def _get_exon_location(self, consequence: VariantConsequence) -> str:
        location = f"{self.LOCATION_EXON} {self._exon}"
        return self._add_utr_suffix_if_needed(location, consequence)

    def _get_intron_location(self, consequence: VariantConsequence) -> str:
        location = f"{self.LOCATION_INTRON} {self._intron}"
        return self._add_utr_suffix_if_needed(location, consequence)

    def _get_distance_location(self, consequence: VariantConsequence) -> str:
        if consequence.is_upstream():
            return f"{self._distance} {self.LOCATION_UPSTREAM}"
        if consequence.is_downstream():
            return f"{self._distance} {self.LOCATION_DOWNSTREAM}"
        return ""

    def _add_utr_suffix_if_needed(
        self, location: str, consequence: VariantConsequence
    ) -> str:
        if consequence.is_three_prime_utr():
            return self._add_three_prime_utr_suffix(location)
        if consequence.is_five_prime_utr():
            return self._add_five_prime_utr_suffix(location)
        return location

    def _add_three_prime_utr_suffix(self, location: str) -> str:
        return self._add_utr_suffix(location, self.LOCATION_THREE_PRIME_UTR)

    def _add_five_prime_utr_suffix(self, location: str) -> str:
        return self._add_utr_suffix(location, self.LOCATION_FIVE_PRIME_UTR)

    def _add_utr_suffix(self, location: str, utr_suffix: str) -> str:
        if location:
            return f"{location} ({utr_suffix})"
        return utr_suffix

    def get_consequence_names(self) -> str:
        return ", ".join(
            [consequence.get_name() for consequence in self._get_consequences()]
        )


@dataclass(frozen=True)
class Variant(Item):

    # Schema constants
    CSQ_CANONICAL = "csq_canonical"
    CSQ_CONSEQUENCE = "csq_consquence"
    CSQ_FEATURE = "csq_feature"
    CSQ_GNOMADE2_AF_POPMAX = "csq_gnomade2_af_popmax"
    CSQ_GNOMADG_AF_POPMAX = "csq_gnomadg_af_popmax"
    CSQ_MOST_SEVERE = "csq_most_severe"
    DISTANCE = "distance"
    EXON = "exon"
    INTRON = "intron"
    MOST_SEVERE_LOCATION = "most_severe_location"
    TRANSCRIPT = "transcript"

    GNOMAD_V2_AF_PREFIX = "csq_gnomade2_af-"
    GNOMAD_V3_AF_PREFIX = "csq_gnomadg_af-"
    GNOMAD_POPULATION_SUFFIX_TO_NAME = {
        "afr": "African-American/African",
        "ami": "Amish",
        "amr": "Latino",
        "asj": "Ashkenazi Jewish",
        "eas": "East Asian",
        "fin": "Finnish",
        "mid": "Middle Eastern",
        "nfe": "Non-Finnish European",
        "oth": "Other Ancestry",
        "sas": "South Asian",
    }

    @property
    def _transcripts(self) -> List[JsonObject]:
        return self.properties.get(self.TRANSCRIPT, [])

    @property
    def _most_severe_location(self) -> str:
        return self.properties.get(self.MOST_SEVERE_LOCATION, "")

    @property
    def _csq_gnomadg_af_popmax(self) -> Union[float, None]:
        return self.properties.get(self.CSQ_GNOMADG_AF_POPMAX)

    @property
    def _csq_gnomade2_af_popmax(self) -> Union[float, None]:
        return self.properties.get(self.CSQ_GNOMADE2_AF_POPMAX)

    def get_most_severe_location(self) -> str:
        return self._most_severe_location

    def _get_transcripts(self) -> List[Transcript]:
        return [Transcript(transcript) for transcript in self._transcripts]

    def _get_canonical_transcript(self) -> Union[Transcript, None]:
        for transcript in self._get_transcripts():
            if transcript.is_canonical():
                return transcript

    def _get_most_severe_transcript(self) -> Union[Transcript, None]:
        for transcript in self._get_transcripts():
            if transcript.is_most_severe():
                return transcript

    def get_canonical_transcript_feature(self) -> str:
        canonical_transcript = self._get_canonical_transcript()
        if canonical_transcript:
            return canonical_transcript.get_feature()
        return ""

    def get_most_severe_transcript_feature(self) -> str:
        most_severe_transcript = self._get_most_severe_transcript()
        if most_severe_transcript:
            return most_severe_transcript.get_feature()
        return ""

    def get_canonical_transcript_consequence_names(self) -> str:
        canonical_transcript = self._get_canonical_transcript()
        if canonical_transcript:
            return canonical_transcript.get_consequence_names()
        return ""

    def get_most_severe_transcript_consequence_names(self) -> str:
        most_severe_transcript = self._get_most_severe_transcript()
        if most_severe_transcript:
            return most_severe_transcript.get_consequence_names()
        return ""

    def get_canonical_transcript_location(self) -> str:
        canonical_transcript = self._get_canonical_transcript()
        if canonical_transcript:
            return canonical_transcript.get_location()
        return ""

    def get_most_severe_transcript_location(self) -> str:
        most_severe_transcript = self._get_most_severe_transcript()
        if most_severe_transcript:
            return most_severe_transcript.get_location()
        return ""

    def get_gnomad_v3_popmax_population(self) -> str:
        result = ""
        gnomad_v3_af_popmax = self._csq_gnomadg_af_popmax
        if gnomad_v3_af_popmax:
            result = self._get_gnomad_v3_population_for_allele_fraction(
                gnomad_v3_af_popmax
            )
        return result

    def get_gnomad_v2_popmax_population(self) -> str:
        result = ""
        gnomad_v2_af_popmax = self._csq_gnomade2_af_popmax
        if gnomad_v2_af_popmax:
            result = self._get_gnomad_v2_population_for_allele_fraction(
                gnomad_v2_af_popmax
            )
        return result

    def _get_gnomad_v3_population_for_allele_fraction(
        self, allele_fraction: float
    ) -> str:
        return self._get_gnomad_population_for_allele_fraction(
            self.GNOMAD_V3_AF_PREFIX, allele_fraction
        )

    def _get_gnomad_v2_population_for_allele_fraction(
        self, allele_fraction: float
    ) -> str:
        return self._get_gnomad_population_for_allele_fraction(
            self.GNOMAD_V2_AF_PREFIX, allele_fraction
        )

    def _get_gnomad_population_for_allele_fraction(
        self, gnomad_af_prefix: str, allele_fraction: float
    ) -> str:
        result = ""
        for (
            gnomad_suffix,
            population_name,
        ) in self.GNOMAD_POPULATION_SUFFIX_TO_NAME.items():
            population_property_name = gnomad_af_prefix + gnomad_suffix
            allele_frequency = self.properties.get(population_property_name)
            if allele_frequency == allele_fraction:
                result = population_name
                break
        return result


@dataclass(frozen=True)
class Note(Item):
    pass


@dataclass(frozen=True)
class VariantSample(Item):

    # Schema constants
    VARIANT = "variant"

    @property
    def _variant(self) -> LinkTo:
        return self.properties.get(self.VARIANT, "")

    def _get_variant(self) -> Union[Variant, None]:
        if isinstance(self._variant, dict):
            return Variant(self._variant)
        return

    def get_canonical_transcript_feature(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_canonical_transcript_feature()
        return ""

    def get_canonical_transcript_location(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_canonical_transcript_location()
        return ""

    def get_canonical_transcript_consequence_names(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_canonical_transcript_consequence_names()
        return ""

    def get_most_severe_transcript_feature(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_most_severe_transcript_feature()
        return ""

    def get_most_severe_transcript_location(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_most_severe_transcript_location()
        return ""

    def get_most_severe_transcript_consequence_names(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_most_severe_transcript_consequence_names()
        return ""

    def get_gnomad_v3_popmax_population(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_gnomad_v3_popmax_population()
        return ""

    def get_gnomad_v2_popmax_population(self) -> str:
        variant = self._get_variant()
        if variant:
            return variant.get_gnomad_v2_popmax_population()
        return ""

    def get_most_recent_note_of_same_project_from_property(
        self, note_property_location: str
    ) -> Union[Note, None]:
        result = None
        notes_at_location = list(
            simple_path_ids(self.properties, note_property_location)
        )
        if notes_at_location:
            result = self._get_most_recent_note_of_same_project(notes_at_location)
        return result

    def _get_most_recent_note_of_same_project(
        self, notes_properties: Iterable[JsonObject]
    ) -> Union[Note, None]:
        result = None
        for note_properties in reversed(notes_properties):
            note = Note(note_properties)
            if note.get_project() == self.get_project():
                result = note
                break
        return result


@dataclass(frozen=True)
class VariantSampleListSelection:

    VARIANT_SAMPLE_ITEM = "variant_sample_item"

    properties: JsonObject

    @property
    def _variant_sample(self) -> LinkTo:
        return self.properties.get(self.VARIANT_SAMPLE_ITEM, "")

    def get_variant_sample(self) -> LinkTo:
        return self._variant_sample


@dataclass(frozen=True)
class VariantSampleList(Item):

    CREATED_FOR_CASE = "created_for_case"
    VARIANT_SAMPLES = "variant_samples"

    @property
    def _created_for_case(self) -> str:
        return self.properties.get(self.CREATED_FOR_CASE, "")

    @property
    def _variant_sample_selections(self) -> List[LinkTo]:
        return self.properties.get(self.VARIANT_SAMPLES, [])

    def get_associated_case_accession(self) -> str:
        return self._created_for_case

    def _get_variant_sample_selections(self) -> List[VariantSampleListSelection]:
        return [
            VariantSampleListSelection(variant_sample_selection)
            for variant_sample_selection in self._variant_sample_selections
        ]

    def get_variant_samples(self) -> List[LinkTo]:
        return [
            variant_sample_selection.get_variant_sample()
            for variant_sample_selection in self._get_variant_sample_selections()
        ]
