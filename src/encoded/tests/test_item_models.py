from contextlib import contextmanager
from typing import Any, Iterator, List, Optional, Union
from unittest import mock

import pytest

from .utils import patch_context
from .. import item_models as item_models_module
from ..item_models import (
    Item, Transcript, Note, Variant, VariantConsequence, VariantSample, VariantSampleList
)
from ..util import JsonObject


@contextmanager
def patch_transcript_get_most_severe_consequence(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.Transcript._get_most_severe_consequence,
        **kwargs
    ) as mock_get_most_severe:
        yield mock_get_most_severe


@contextmanager
def patch_transcript_get_location_by_most_severe_consequence(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.Transcript._get_location_by_most_severe_consequence,
        **kwargs
    ) as mock_get_location_by_most_severe:
        yield mock_get_location_by_most_severe


@contextmanager
def patch_variant_get_transcripts(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.Variant._get_transcripts,
        **kwargs
    ) as mock_get_transcripts:
        yield mock_get_transcripts


@contextmanager
def patch_variant_get_canonical_transcript(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.Variant._get_canonical_transcript,
        **kwargs
    ) as mock_get_canonical_transcript:
        yield mock_get_canonical_transcript


@contextmanager
def patch_variant_get_most_severe_transcript(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.Variant._get_most_severe_transcript,
        **kwargs
    ) as mock_get_most_severe_transcript:
        yield mock_get_most_severe_transcript


@contextmanager
def patch_variant_sample_variant(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.VariantSample._variant, **kwargs
    ) as mock_variant:
        yield mock_variant


@contextmanager
def patch_variant_sample_get_variant(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.VariantSample._get_variant, **kwargs
    ) as mock_get_variant:
        yield mock_get_variant


def mock_variant_consequence(
    is_upstream: bool = False,
    is_downstream: bool = False,
    is_three_prime_utr: bool = False,
    is_five_prime_utr: bool = False,
) -> mock.MagicMock:
    mock_variant_consequence = mock.create_autospec(VariantConsequence, instance=True)
    mock_variant_consequence.is_upstream.return_value = is_upstream
    mock_variant_consequence.is_downstream.return_value = is_downstream
    mock_variant_consequence.is_three_prime_utr.return_value = is_three_prime_utr
    mock_variant_consequence.is_five_prime_utr.return_value = is_five_prime_utr
    return mock_variant_consequence
    

def mock_transcript(
    canonical: bool = False,
    most_severe: bool = False,
) -> mock.MagicMock:
    mock_transcript = mock.create_autospec(Transcript, instance=True)
    mock_transcript.is_canonical.return_value = canonical
    mock_transcript.is_most_severe.return_value = most_severe
    return mock_transcript


def mock_variant() -> mock.MagicMock:
    return mock.create_autospec(Variant, instance=True)


class TestItem:
    SOME_ATID = "/foo/bar"
    SOME_PROJECT = "cgap-core"
    SOME_ITEM_PROPERTIES = {"@id": SOME_ATID, "project": SOME_PROJECT}
    SOME_ITEM = Item(SOME_ITEM_PROPERTIES)
    SOME_EMPTY_ITEM = Item({})

    @pytest.mark.parametrize(
        "item,expected",
        [
            (SOME_ITEM, SOME_ITEM_PROPERTIES),
            (SOME_EMPTY_ITEM, {}),
        ]
    )
    def test_get_properties(self, item: Item, expected: JsonObject) -> None:
        assert item.get_properties() == expected

    @pytest.mark.parametrize(
        "item,expected",
        [
            (SOME_ITEM, SOME_ATID),
            (SOME_EMPTY_ITEM, ""),
        ]
    )
    def test_get_atid(self, item: Item, expected: JsonObject) -> None:
        assert item.get_atid() == expected

    @pytest.mark.parametrize(
        "item,expected",
        [
            (SOME_ITEM, SOME_PROJECT),
            (SOME_EMPTY_ITEM, ""),
        ]
    )
    def test_get_project(self, item: Item, expected: JsonObject) -> None:
        assert item.get_project() == expected


@contextmanager
def patch_variant_consequence_name(**kwargs) -> Iterator[mock.MagicMock]:
    with patch_context(
        item_models_module.VariantConsequence._name, new_callable=mock.PropertyMock, **kwargs
    ) as mock_consequence:
        yield mock_consequence


class TestVariantConsequence:

    SOME_CONSEQUENCE_IMPACT = "high"
    SOME_CONSEQUENCE_NAME = "gene_affected"
    SOME_VARIANT_CONSEQUENCE_PROPERTIES = {
        "impact": SOME_CONSEQUENCE_IMPACT, "var_conseq_name": SOME_CONSEQUENCE_NAME
    }
    SOME_VARIANT_CONSEQUENCE = VariantConsequence(SOME_VARIANT_CONSEQUENCE_PROPERTIES)
    SOME_EMPTY_VARIANT_CONSEQUENCE = VariantConsequence({})

    @pytest.mark.parametrize(
        "variant_consequence,expected",
        [
            (SOME_VARIANT_CONSEQUENCE, SOME_CONSEQUENCE_NAME),
            (SOME_EMPTY_VARIANT_CONSEQUENCE, ""),
        ]
    )
    def test_get_name(self, variant_consequence: VariantConsequence, expected: str) -> None:
        result = variant_consequence.get_name()
        assert result == expected

    @pytest.mark.parametrize(
        "variant_consequence,expected",
        [
            (SOME_VARIANT_CONSEQUENCE, SOME_CONSEQUENCE_IMPACT),
            (SOME_EMPTY_VARIANT_CONSEQUENCE, ""),
        ]
    )
    def test_get_impact(self, variant_consequence: VariantConsequence, expected: str) -> None:
        result = variant_consequence.get_impact()
        assert result == expected

    @pytest.mark.parametrize(
        "consequence_name,expected",
        [
            ("foo", False),
            ("downstream_gene_variant", True),
        ]
    )
    def test_is_downstream(self, consequence_name: str, expected: bool) -> None:
        with patch_variant_consequence_name(return_value=consequence_name):
            variant_consequence = VariantConsequence({})
            assert variant_consequence.is_downstream() == expected

    @pytest.mark.parametrize(
        "consequence_name,expected",
        [
            ("foo", False),
            ("upstream_gene_variant", True),
        ]
    )
    def test_is_upstream(self, consequence_name: str, expected: bool) -> None:
        with patch_variant_consequence_name(return_value=consequence_name):
            variant_consequence = VariantConsequence({})
            assert variant_consequence.is_upstream() == expected

    @pytest.mark.parametrize(
        "consequence_name,expected",
        [
            ("foo", False),
            ("3_prime_UTR_variant", True),
        ]
    )
    def test_is_three_prime_utr(self, consequence_name: str, expected: bool) -> None:
        with patch_variant_consequence_name(return_value=consequence_name):
            variant_consequence = VariantConsequence({})
            assert variant_consequence.is_three_prime_utr() == expected

    @pytest.mark.parametrize(
        "consequence_name,expected",
        [
            ("foo", False),
            ("5_prime_UTR_variant", True),
        ]
    )
    def test_is_five_prime_utr(self, consequence_name: str, expected: bool) -> None:
        with patch_variant_consequence_name(return_value=consequence_name):
            variant_consequence = VariantConsequence({})
            assert variant_consequence.is_five_prime_utr() == expected


class TestTranscript:

    SOME_EXON = "4/5"
    SOME_INTRON = "4/4"
    SOME_DISTANCE = "1234"
    SOME_FEATURE = "amazing"
    SOME_HIGH_IMPACT_CONSEQUENCE_NAME = "a_big_one"
    SOME_LOW_IMPACT_CONSEQUENCE_NAME = "no_big_deal"
    SOME_HIGH_IMPACT_CONSEQUENCE = {"impact": "HIGH", "var_conseq_name": SOME_HIGH_IMPACT_CONSEQUENCE_NAME}
    SOME_LOW_IMPACT_CONSEQUENCE = {"impact": "LOW", "var_conseq_name": SOME_LOW_IMPACT_CONSEQUENCE_NAME}
    SOME_TRANSCRIPT_PROPERTIES = {
        "csq_exon": SOME_EXON,
        "csq_feature": SOME_FEATURE,
        "csq_consequence": [SOME_HIGH_IMPACT_CONSEQUENCE, SOME_LOW_IMPACT_CONSEQUENCE],
    }
    SOME_CANONICAL_TRANSCRIPT_PROPERTIES = {"csq_canonical": True}
    SOME_MOST_SEVERE_TRANSCRIPT_PROPERTIES = {"csq_most_severe": True}
    SOME_INTRON_TRANSCRIPT_PROPERTIES = {"csq_intron": SOME_INTRON}
    SOME_DISTANCE_TRANSCRIPT_PROPERTIES = {"csq_distance": SOME_DISTANCE}

    def get_transcript(self, properties: JsonObject) -> Transcript:
        return Transcript(properties)

    @pytest.mark.parametrize(
        "transcript_properties,expected",
        [
            (SOME_TRANSCRIPT_PROPERTIES, False),
            (SOME_CANONICAL_TRANSCRIPT_PROPERTIES, True),
        ]
    )
    def test_is_canonical(self, transcript_properties: JsonObject, expected: bool) -> None:
        transcript = self.get_transcript(transcript_properties)
        assert transcript.is_canonical() == expected

    @pytest.mark.parametrize(
        "transcript_properties,expected",
        [
            (SOME_TRANSCRIPT_PROPERTIES, False),
            (SOME_MOST_SEVERE_TRANSCRIPT_PROPERTIES, True),
        ]
    )
    def test_is_most_severe(self, transcript_properties: JsonObject, expected: bool) -> None:
        transcript = self.get_transcript(transcript_properties)
        assert transcript.is_most_severe() == expected

    @pytest.mark.parametrize(
        "transcript_properties,expected",
        [
            (SOME_TRANSCRIPT_PROPERTIES, SOME_FEATURE),
            (SOME_MOST_SEVERE_TRANSCRIPT_PROPERTIES, ""),
        ]
    )
    def test_get_feature(self, transcript_properties: JsonObject, expected: str) -> None:
        transcript = self.get_transcript(transcript_properties)
        assert transcript.get_feature() == expected

    @pytest.mark.parametrize(
        "most_severe_consequence", [None, "some_consequence"]
    )
    def test_get_location(self, most_severe_consequence: Any) -> None:
        with patch_transcript_get_most_severe_consequence(return_value=most_severe_consequence):
            with patch_transcript_get_location_by_most_severe_consequence() as mock_get_location_by_consequence:
                transcript = self.get_transcript({})
                result = transcript.get_location()
                if most_severe_consequence:
                    mock_get_location_by_consequence.assert_called_once_with(
                        most_severe_consequence
                    )
                    assert result == mock_get_location_by_consequence.return_value
                else:
                    mock_get_location_by_consequence.assert_not_called()
                    assert result == ""

    @pytest.mark.parametrize(
        "transcript_properties,expected",
        [
            (SOME_MOST_SEVERE_TRANSCRIPT_PROPERTIES, None), 
            (SOME_TRANSCRIPT_PROPERTIES, SOME_HIGH_IMPACT_CONSEQUENCE),
        ]
    )
    def test_get_most_severe_consequence(
        self, transcript_properties: JsonObject, expected: Union[JsonObject, None]
    ) -> None:
        transcript = self.get_transcript(transcript_properties)
        consequence = transcript._get_most_severe_consequence()
        if not expected:
            assert consequence == expected
        else:
            assert consequence.get_properties() == expected

    @pytest.mark.parametrize(
        (
            "transcript_properties,consequence_upstream,consequence_downstream,"
            "consequence_3_utr,consequence_5_utr,expected"
        ),
        [
            ({}, False, False, False, False, ""),
            (SOME_TRANSCRIPT_PROPERTIES, False, False, False, False, f"Exon {SOME_EXON}"),
            (SOME_TRANSCRIPT_PROPERTIES, False, False, True, False, f"Exon {SOME_EXON} (3' UTR)"),
            (SOME_TRANSCRIPT_PROPERTIES, False, False, False, True, f"Exon {SOME_EXON} (5' UTR)"),
            (SOME_INTRON_TRANSCRIPT_PROPERTIES, False, False, False, False, f"Intron {SOME_INTRON}"),
            (SOME_INTRON_TRANSCRIPT_PROPERTIES, False, False, True, False, f"Intron {SOME_INTRON} (3' UTR)"),
            (SOME_INTRON_TRANSCRIPT_PROPERTIES, False, False, False, True, f"Intron {SOME_INTRON} (5' UTR)"),
            (SOME_DISTANCE_TRANSCRIPT_PROPERTIES, False, False, False, False, ""),
            (SOME_DISTANCE_TRANSCRIPT_PROPERTIES, True, False, False, False, f"{SOME_DISTANCE} bp upstream"),
            (SOME_DISTANCE_TRANSCRIPT_PROPERTIES, False, True, False, False, f"{SOME_DISTANCE} bp downstream"),
            (SOME_DISTANCE_TRANSCRIPT_PROPERTIES, False, False, False, True, ""),
        ]
    )
    def test_get_location_by_most_severe_consequence(
        self, transcript_properties: JsonObject, consequence_upstream: bool,
        consequence_downstream: bool, consequence_3_utr: bool,
        consequence_5_utr: bool, expected: str,
    ) -> None:
        transcript = self.get_transcript(transcript_properties)
        variant_consequence = mock_variant_consequence(
            is_upstream=consequence_upstream,
            is_downstream=consequence_downstream,
            is_three_prime_utr=consequence_3_utr,
            is_five_prime_utr=consequence_5_utr,
        )
        result = transcript._get_location_by_most_severe_consequence(variant_consequence)
        assert result == expected

    @pytest.mark.parametrize(
        "transcript_properties,expected",
        [
            ({}, ""),
            (SOME_TRANSCRIPT_PROPERTIES, f"{SOME_HIGH_IMPACT_CONSEQUENCE_NAME}, {SOME_LOW_IMPACT_CONSEQUENCE_NAME}"),
        ]
    )
    def test_get_consequence_names(self, transcript_properties: JsonObject, expected: str) -> None:
        transcript = self.get_transcript(transcript_properties)
        result = transcript.get_consequence_names()
        assert result == expected


class TestVariant:

    SOME_CANONICAL_TRANSCRIPT = mock_transcript(canonical=True)
    SOME_MOST_SEVERE_TRANSCRIPT = mock_transcript(most_severe=True)
    SOME_TRANSCRIPTS = [SOME_CANONICAL_TRANSCRIPT, SOME_MOST_SEVERE_TRANSCRIPT]
    SOME_GNOMAD_V3_POPULATION = "csq_gnomadg_af-ami"
    SOME_GNOMAD_V2_POPULATION = "csq_gnomade2_af-amr"
    SOME_VARIANT_PROPERTIES = {
        "csq_gnomadg_af_popmax": 0.123,
        "csq_gnomadg_af-ami": 0.123,
        "csq_gnomadg_af-afr": 0.111,
        "csq_gnomade2_af_popmax": 0.987,
        "csq_gnomade2_af-amr": 0.987,
        "csq_gnomade2_af-asj": 0.9,
    }
    
    def get_variant(self, properties: Optional[JsonObject] = None) -> Variant:
        if properties is None:
            properties = self.SOME_VARIANT_PROPERTIES
        return Variant(properties)

    def test_get_canonical_transcript(self) -> None:
        with patch_variant_get_transcripts(return_value=self.SOME_TRANSCRIPTS):
            variant = self.get_variant()
            assert variant._get_canonical_transcript() == self.SOME_CANONICAL_TRANSCRIPT

    def test_get_most_severe_transcript(self) -> None:
        with patch_variant_get_transcripts(return_value=self.SOME_TRANSCRIPTS):
            variant = self.get_variant()
            assert variant._get_most_severe_transcript() == self.SOME_MOST_SEVERE_TRANSCRIPT

    @pytest.mark.parametrize(
        "canonical_transcript", [None, mock_transcript()]
    )
    def test_get_canonical_transcript_feature(
        self, canonical_transcript: Union[mock.MagicMock, None]
    ) -> None:
        with patch_variant_get_canonical_transcript(return_value=canonical_transcript):
            variant = self.get_variant()
            if canonical_transcript:
                expected = canonical_transcript.get_feature.return_value
            else:
                expected = ""
            assert variant.get_canonical_transcript_feature() == expected

    @pytest.mark.parametrize(
        "most_severe_transcript", [None, mock_transcript()]
    )
    def test_get_most_severe_transcript_feature(
        self, most_severe_transcript: Union[mock.MagicMock, None]
    ) -> None:
        with patch_variant_get_most_severe_transcript(return_value=most_severe_transcript):
            variant = self.get_variant()
            if most_severe_transcript:
                expected = most_severe_transcript.get_feature.return_value
            else:
                expected = ""
            assert variant.get_most_severe_transcript_feature() == expected

    @pytest.mark.parametrize(
        "canonical_transcript", [None, mock_transcript()]
    )
    def test_get_canonical_transcript_consequence_names(
        self, canonical_transcript: Union[mock.MagicMock, None]
    ) -> None:
        with patch_variant_get_canonical_transcript(return_value=canonical_transcript):
            variant = self.get_variant()
            if canonical_transcript:
                expected = canonical_transcript.get_consequence_names.return_value
            else:
                expected = ""
            assert variant.get_canonical_transcript_consequence_names() == expected

    @pytest.mark.parametrize(
        "most_severe_transcript", [None, mock_transcript()]
    )
    def test_get_most_severe_transcript_consequence_names(
        self, most_severe_transcript: Union[mock.MagicMock, None]
    ) -> None:
        with patch_variant_get_most_severe_transcript(return_value=most_severe_transcript):
            variant = self.get_variant()
            if most_severe_transcript:
                expected = most_severe_transcript.get_consequence_names.return_value
            else:
                expected = ""
            assert variant.get_most_severe_transcript_consequence_names() == expected

    @pytest.mark.parametrize(
        "canonical_transcript", [None, mock_transcript()]
    )
    def test_get_canonical_transcript_location(
        self, canonical_transcript: Union[mock.MagicMock, None]
    ) -> None:
        with patch_variant_get_canonical_transcript(return_value=canonical_transcript):
            variant = self.get_variant()
            if canonical_transcript:
                expected = canonical_transcript.get_location.return_value
            else:
                expected = ""
            assert variant.get_canonical_transcript_location() == expected

    @pytest.mark.parametrize(
        "most_severe_transcript", [None, mock_transcript()]
    )
    def test_get_most_severe_transcript_location(
        self, most_severe_transcript: Union[mock.MagicMock, None]
    ) -> None:
        with patch_variant_get_most_severe_transcript(return_value=most_severe_transcript):
            variant = self.get_variant()
            if most_severe_transcript:
                expected = most_severe_transcript.get_location.return_value
            else:
                expected = ""
            assert variant.get_most_severe_transcript_location() == expected

    @pytest.mark.parametrize(
        "variant_properties,expected", [({}, ""), (SOME_VARIANT_PROPERTIES, "Amish")]
    )
    def test_get_gnomad_v3_popmax_population(
        self, variant_properties: JsonObject, expected: str
    ) -> None:
        variant = self.get_variant(properties=variant_properties)
        result = variant.get_gnomad_v3_popmax_population()
        assert result == expected

    @pytest.mark.parametrize(
        "variant_properties,expected", [({}, ""), (SOME_VARIANT_PROPERTIES, "Latino")]
    )
    def test_get_gnomad_v2_popmax_population(
        self, variant_properties: JsonObject, expected: str
    ) -> None:
        variant = self.get_variant(properties=variant_properties)
        result = variant.get_gnomad_v2_popmax_population()
        assert result == expected


class TestVariantSample:

    SOME_VARIANT_PROPERTIES = {"foo": "bar"}
    SOME_PROJECT = {"name": "something"}
    SOME_NOTE_OF_SAME_PROJECT_PROPERTIES = {"project": SOME_PROJECT}
    ANOTHER_NOTE_OF_SAME_PROJECT_PROPERTIES = {"project": SOME_PROJECT, "fu": "bur"}
    SOME_NOTE_OF_DIFFERENT_PROJECT_PROPERTIES = {"project": "something"}
    SOME_PROPERTY_FOR_NOTE = "a_note_field"
    SOME_VARIANT_SAMPLE_PROPERTIES = {
        "variant": SOME_VARIANT_PROPERTIES,
        "project": SOME_PROJECT,
    }

    def get_variant_sample(self, properties: Optional[JsonObject] = None) -> VariantSample:
        if properties is None:
            properties = self.SOME_VARIANT_SAMPLE_PROPERTIES
        return VariantSample(properties)

    @pytest.mark.parametrize(
        "variant,expected_variant",
        [("", False), ("something", False), (SOME_VARIANT_PROPERTIES, True)]
    )
    def test_get_variant(self, variant: Union[JsonObject, None], expected_variant: bool) -> None:
        with patch_variant_sample_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample._get_variant()
            if expected_variant:
                assert isinstance(result, Variant)
                assert result.get_properties() == variant
            else:
                assert result is None

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_canonical_transcript_feature(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_canonical_transcript_feature()
            if variant:
                assert result == variant.get_canonical_transcript_feature.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_canonical_transcript_location(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_canonical_transcript_location()
            if variant:
                assert result == variant.get_canonical_transcript_location.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_canonical_transcript_consequence_names(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_canonical_transcript_consequence_names()
            if variant:
                assert result == variant.get_canonical_transcript_consequence_names.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_most_severe_transcript_feature(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_most_severe_transcript_feature()
            if variant:
                assert result == variant.get_most_severe_transcript_feature.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_most_severe_transcript_location(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_most_severe_transcript_location()
            if variant:
                assert result == variant.get_most_severe_transcript_location.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_most_severe_transcript_consequence_names(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_most_severe_transcript_consequence_names()
            if variant:
                assert result == variant.get_most_severe_transcript_consequence_names.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_gnomad_v3_popmax_population(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_gnomad_v3_popmax_population()
            if variant:
                assert result == variant.get_gnomad_v3_popmax_population.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "variant", [None, mock_variant()]
    )
    def test_get_gnomad_v2_popmax_population(self, variant: Union[Variant, None]) -> None:
        with patch_variant_sample_get_variant(return_value=variant):
            variant_sample = self.get_variant_sample()
            result = variant_sample.get_gnomad_v2_popmax_population()
            if variant:
                assert result == variant.get_gnomad_v2_popmax_population.return_value
            else:
                assert result == ""

    @pytest.mark.parametrize(
        "notes_at_property,expected_note",
        [
            ([], None),
            ([SOME_NOTE_OF_DIFFERENT_PROJECT_PROPERTIES], None),
            ([SOME_NOTE_OF_SAME_PROJECT_PROPERTIES, SOME_NOTE_OF_DIFFERENT_PROJECT_PROPERTIES], SOME_NOTE_OF_SAME_PROJECT_PROPERTIES),
            ([ANOTHER_NOTE_OF_SAME_PROJECT_PROPERTIES, SOME_NOTE_OF_SAME_PROJECT_PROPERTIES], SOME_NOTE_OF_SAME_PROJECT_PROPERTIES),
        ]
    )
    def test_get_most_recent_note_of_same_project_project(
        self,
        notes_at_property: List[JsonObject],
        expected_note: Union[JsonObject, None],
    ) -> None:
        variant_sample_properties = {
            **self.SOME_VARIANT_SAMPLE_PROPERTIES,
            self.SOME_PROPERTY_FOR_NOTE: notes_at_property
        }
        variant_sample = self.get_variant_sample(variant_sample_properties)
        result = variant_sample.get_most_recent_note_of_same_project_from_property(
            self.SOME_PROPERTY_FOR_NOTE
        )
        if expected_note is not None:
            assert isinstance(result, Note)
            assert result.get_properties() == expected_note
        else:
            assert result is None


class TestVariantSampleList:

    SOME_UUID = "uuid_1"
    ANOTHER_UUID = "uuid_2"
    SOME_VARIANT_SAMPLE_SELECTION = {"variant_sample_item": SOME_UUID}
    ANOTHER_VARIANT_SAMPLE_SELECTION = {"variant_sample_item": ANOTHER_UUID}
    SOME_VARIANT_SAMPLE_LIST_PROPERTIES = {
        "variant_samples": [SOME_VARIANT_SAMPLE_SELECTION, ANOTHER_VARIANT_SAMPLE_SELECTION]
    }
    
    def get_variant_sample_list(self, properties: Optional[JsonObject] = None) -> VariantSampleList:
        if properties is None:
            properties = self.SOME_VARIANT_SAMPLE_LIST_PROPERTIES
        return VariantSampleList(properties)

    @pytest.mark.parametrize(
        "variant_sample_list_properties,expected",
        [
            ({}, []), (SOME_VARIANT_SAMPLE_LIST_PROPERTIES, [SOME_UUID, ANOTHER_UUID])
        ]
    )
    def test_get_variant_samples(
        self, variant_sample_list_properties: JsonObject, expected: List[str]
    ):
        variant_sample_list = self.get_variant_sample_list(variant_sample_list_properties)
        result = variant_sample_list.get_variant_samples()
        assert result == expected
