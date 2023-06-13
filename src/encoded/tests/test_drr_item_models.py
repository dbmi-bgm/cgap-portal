from typing import List

from unittest import Mock

from ..drr_item_models import Transcript, Variant, VariantConsequence, VariantSample
from ..util import JsonObject


class TestItemModel:
    pass


class TestVariantConsequence:
    pass


class TestTranscript:

    SOME_CANONICAL_TRANSCRIPT = {}
    SOME_MOST_SEVERE_TRANSCRIPT = {}
    SOME_TRANSCRIPT = {}

    def get_transcript(self, properties: JsonObject):
        pass

    def test_is_canonical(self, transcript_properties: JsonObject, expected: bool) -> None:
        pass


class TestVariant:
    pass


class TestNote:
    pass


class TestVariantSample:
    pass
