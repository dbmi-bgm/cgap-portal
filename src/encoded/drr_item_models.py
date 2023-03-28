from dataclasses import dataclass, field
from typing import Any, Dict, List, Union


JsonObject = Dict[str, Any]


@dataclass(frozen=True)
class ItemProperties:

    ATID = "@id"

    properties: JsonObject

    def get_properties(self) -> JsonObject:
        return self.properties

    def get_atid(self) -> str:
        return self.properties.get(self.ATID, "")


@dataclass(frozen=True)
class VariantConsequence(ItemProperties):
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

    TRANSCRIPT_IMPACT_MAP = {
        IMPACT_HIGH: 0, IMPACT_MODERATE: 1, IMPACT_LOW: 2, IMPACT_MODIFIER: 3
    }

    @property
    def impact(self) -> str:
        return self.properties.get(self.IMPACT, "")

    @property
    def name(self) -> str:
        return self.properties.get(self.VAR_CONSEQ_NAME, "")

    def get_name(self) -> str:
        return self.name

    def is_downstream(self) -> str:
        return self.name == self.DOWNSTREAM_GENE_CONSEQUENCE

    def is_upstream(self) -> str:
        return self.name == self.UPSTREAM_GENE_CONSEQUENCE

    def is_three_prime_utr(self) -> str:
        return self.name == self.THREE_PRIME_UTR_CONSEQUENCE

    def is_five_prime_utr(self) -> str:
        return self.name == self.FIVE_PRIME_UTR_CONSEQUENCE


@dataclass(frozen=True)
class Transcript:
    # Schema constants
    CSQ_CANONICAL = "csq_canonical"
    CSQ_CONSEQUENCE = "csq_consquence"
    CSQ_DISTANCE = "csq_distance"
    CSQ_EXON = "csq_exon"
    CSQ_FEATURE = "csq_feature"
    CSQ_INTRON = "csq_intron"
    CSQ_MOST_SEVERE = "csq_most_severe"

    # Class constants
    FIVE_PRIME_UTR_LOCATION = "5' UTR"
    THREE_PRIME_UTR_LOCATION = "3' UTR"

    properties: JsonObject

    @property
    def canonical(self) -> bool:
        return self.properties.get(self.CSQ_CANONICAL, False)

    @property
    def most_severe(self) -> bool:
        return self.properties.get(self.CSQ_MOST_SEVERE, False)

    @property
    def exon(self) -> str:
        return self.properties.get(self.CSQ_EXON, "")

    @property
    def intron(self) -> str:
        return self.properties.get(self.CSQ_INTRON, "")

    @property
    def distance(self) -> str:
        return self.properties.get(self.CSQ_DISTANCE, "")

    @property
    def feature(self) -> str:
        return self.properties.get(self.CSQ_FEATURE, "")

    @property
    def consequences(self) -> List[VariantConsequence]:
        return [
            VariantConsequence(item)
            for item in self.properties.get(self.CSQ_CONSEQUENCE, [])
        ]

    def is_canonical(self) -> bool:
        return self.canonical

    def is_most_severe(self) -> bool:
        return self.most_severe

    def get_consequence_names(self) -> str:
        return ", ".join([consequence.get_name() for consequence in self.consequences])


@dataclass(frozen=True)
class Variant(ItemProperties):

    # Schema constants
    CSQ_CANONICAL = "csq_canonical"
    CSQ_CONSEQUENCE = "csq_consquence"
    CSQ_FEATURE = "csq_feature"
    CSQ_MOST_SEVERE = "csq_most_severe"
    DISTANCE = "distance"
    EXON = "exon"
    INTRON = "intron"
    MOST_SEVERE_LOCATION = "most_severe_location"
    TRANSCRIPT = "transcript"

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

    @property
    def transcripts(self) -> List[Transcript]:
        return [
            Transcript(transcript)
            for transcript in self.properties.get(self.TRANSCRIPT, [])
        ]

    @property
    def most_severe_location(self) -> str:
        return self.properties.get(self.MOST_SEVERE_LOCATION, "")

    @property
    def _canonical_transcript(self) -> Union[None, Transcript]:
        for transcript in self.transcripts:
            if transcript.is_canonical():
                return transcript

    @property
    def _most_severe_transcript(self) -> Union[None, Transcript]:
        for transcript in self.transcripts:
            if transcript.is_most_severe():
                return transcript

    def get_most_severe_location(self) -> str:
        return self.most_severe_location

    def get_canonical_transcript_feature(self) -> str:
        if self._canonical_transcript:
            return self._canonical_transcript.get_feature()
        return ""

    def get_most_severe_transcript_feature(self) -> str:
        if self._most_severe_transcript:
            return self._most_severe_transcript.get_feature()
        return ""

    def get_canonical_transcript_consequence_names(self) -> str:
        if self._canonical_transcript:
            return self._canonical_transcript.get_consequence_names()
        return ""

    def get_most_severe_transcript_consequence_names(self) -> str:
        if self._most_severe_transcript:
            return self._most_severe_transcript.get_consequence_names()
        return ""


class Note(ItemProperties):

    pass


@dataclass(frozen=True)
class VariantSample(ItemProperties):

    # Schema constants
    VARIANT = "variant"

    @property
    def variant(self) -> Variant:
        return Variant(self.properties.get(self.VARIANT, {}))

    def get_canonical_transcript_feature(self) -> str:
        return self.variant.get_canonical_transcript_feature()

    def get_canonical_transcript_location(self) -> str:
        return self.variant.get_canonical_transcript_location()

    def get_canonical_transcript_consequences_display_titles(self) -> str:
        return self.variant.get_canonical_transcript_consequences_display_titles()

    def get_most_severe_transcript_feature(self) -> str:
        return self.variant.get_most_severe_transcript_feature()

    def get_most_severe_transcript_location(self) -> str:
        return self.variant.get_most_severe_transcript_location()

    def get_most_severe_transcript_consequences_display_titles(self) -> str:
        return self.variant.get_most_severe_transcript_consequences_display_titles()

    def get_gnomad_v3_popmax_population(self) -> str:
        return self.variant.get_gnomad_v3_popmax_population()

    def get_gnomad_v2_popmax_population(self) -> str:
        return self.variant.get_gnomad_v2_popmax_population()

    def get_note_of_same_project(self, note_property_location: str) -> Note:
        return
