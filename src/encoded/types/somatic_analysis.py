from typing import Any, Dict, Iterable, List, Optional, Set, Union

from pyramid.httpexceptions import HTTPClientError
from pyramid.request import Request
from snovault import calculated_property, collection, load_schema
from snovault.connection import CONNECTION, Connection

from .analysis import Analysis
from .base import Item
from ..util import get_item


def _build_somatic_analysis_embedded_list() -> List[str]:
    return [
        # My embeds (TODO: delete once switch to doug's) Required for Somatic Analysis Item Page UI
        "samples.@id",
        "samples.display_title",
        "samples.accession",
        "samples.specimen_collection_date",
        # "samples.preservation_type", # Does not actually exist right now... should at some point
        "samples.workup_type",
        "samples.tissue_type",
        "samples.specimen_type",
        "samples.bam_sample_id",
        "samples.sequence_id", # accessioning table only
        "samples.individual.@id",
        "samples.individual.individual_id",
        "samples.individual.display_title",
        "samples.individual.accession",
        "samples.individual.sex",
        "samples.individual.age",
        "samples.individual.age_units",
        "samples.individual.date_created", # TODO: Double check this is acceptable as "accession date"
        "samples.individual.disorders.disorder.display_title",
        "samples.individual.disorders.is_primary_diagnosis",
        "samples.individual.families.title",
        "samples.individual.families.family_id",
        "samples.individual.families.accession",
        # Doug's embeds
        "individual.primary_disorders.disorder_name",
        "individual.families.family_id",
    ]


@collection(
    name="somatic-analyses",
    unique_key="accession",
    properties={
        "title": "SomaticAnalysis",
        "description": "Listing of Somatic Analyses",
    },
)
class SomaticAnalysis(Analysis):
    item_type = "somatic_analysis"
    name_key = "accession"
    schema = load_schema("encoded:schemas/somatic_analysis.json")
    embedded_list = Analysis.embedded_list + _build_somatic_analysis_embedded_list()

    @calculated_property(
        schema={
            "title": "Individual",
            "description": "Individual associated with samples of the analysis",
            "type": "string",
            "linkTo": "Individual",
        }
    )
    def individual(self, request: Request, samples: Optional[List[str]] = None) -> Union[str, None]:
        if not samples:
            return
        return self._get_individual_from_samples(request, samples)

    @classmethod
    def _get_individual_from_samples(cls, request: Request, sample_identifiers: List[str]) -> Union[str, None]:
        result = None
        unique_individuals = cls._get_unique_individuals_from_samples_by_request(
            request, sample_identifiers
        )
        if len(unique_individuals) == 1:
            result = unique_individuals[0]
        return result

    @classmethod
    def _get_unique_individuals_from_samples_by_request(cls, request: Request, sample_identifiers: List[str]) -> List[str]:
        result = set()
        for sample_identifier in sample_identifiers:
            sample = get_item(request, sample_identifier)
            individual = sample.get("individual")
            if individual:
                result.add(individual)
        return sorted(list(result))

    def _update(self, properties: Dict[str, Any], sheets: Optional[Dict] = None) -> None:
        connection = self.registry[CONNECTION]
        self._validate_individual_count(connection, properties)
        super(Item, self)._update(properties, sheets=sheets)

    @classmethod
    def _validate_individual_count(cls, connection: Connection, properties: Dict[str, Any]) -> None:
        samples = properties.get("samples", [])
        unique_individuals = cls._get_unique_individuals_from_samples_by_connection(samples, connection)
        if len(unique_individuals) > 1:
            raise HTTPClientError("More than 1 individual associated with samples")

    @classmethod
    def _get_unique_individuals_from_samples_by_connection(cls, sample_uuids: Iterable[str], connection: Connection) -> Set[str]:
        result = set()
        for sample_uuid in sample_uuids:
            individuals = cls._get_individuals_from_sample(sample_uuid, connection)
            result.update(individuals)
        return result

    @classmethod
    def _get_individuals_from_sample(cls, sample_uuid: str, connection: Connection) -> List[str]:
        sample_item = connection.get_by_uuid(sample_uuid)
        return sample_item.get_rev_links(None, "indiv")
