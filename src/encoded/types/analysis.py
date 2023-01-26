from abc import ABC

from snovault import calculated_property, display_title_schema

from .base import Item


class AbstractAnalysis(ABC, Item):

    @calculated_property(schema=display_title_schema)
    def display_title(self, accession, external_identifier=None):
        if external_identifier:
            result = external_identifier
        else:
            result = accession
        return result
