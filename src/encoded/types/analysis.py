from abc import ABC
from typing import List, Optional, Union

from snovault import calculated_property, display_title_schema

from .base import Item


def _build_abstract_analysis_embedded_list() -> List[str]:
    return []


class AbstractAnalysis(ABC, Item):

    embedded_list = _build_abstract_analysis_embedded_list()

    @calculated_property(schema=display_title_schema)
    def display_title(
        self, accession: str, external_identifier: Optional[str] = None
    ) -> Union[str, None]:
        if external_identifier:
            result = external_identifier
        else:
            result = accession
        return result
