"""Collection for Phenotypes objects."""
from snovault import (
    calculated_property,
    abstract_collection,
    collection,
    load_schema,
)
from .base import (
    Item,
    get_item_or_none,
    ALLOW_SUBMITTER_ADD,
)


@abstract_collection(
    name='evidences',
    acl=ALLOW_SUBMITTER_ADD,
    properties={
        'title': 'Evidences',
        'description': 'Listing of Evidence Items',
    })
class Evidence(Item):
    """The Phenotype class that holds info on evidence based associations between items."""

    item_type = 'evidence'
    schema = load_schema('encoded:schemas/evidence.json')
    base_types = ['Evidence'] + Item.base_types

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, subject_item, object_item):
        try:
            # using @ids of items as it is less expensive - may want to modify to use dts
            st = [s for s in subject_item.split('/') if s][-1]
            ot = [s for s in object_item.split('/') if s][-1]
            return st + ' -- ' + ot + ' evidence'
        except Exception as e:
            return Item.display_title(self)


@collection(
    name='evidence-dis-phenos',
    properties={
        'title': 'Evidence Linking Disorder to Phenotypes',
        'description': 'Listing Disorder to Phenotype Items',
    })
class EvidenceDisPheno(Evidence):
    item_type = 'evidence_dis_pheno'
    schema = load_schema('encoded:schemas/evidence_dis_pheno.json')
    embedded_list = Evidence.embedded_list


@collection(
    name='evidence-gene-disorders',
    properties={
        'title': 'Evidence Linking Genes to Disorders',
        'description': 'Listing Gene to Disorder Evidence Items',
    })
class EvidenceGeneDisorder(Evidence):
    item_type = 'evidence_gene_disorder'
    schema = load_schema('encoded:schemas/evidence_gene_disorder.json')
    embedded_list = Evidence.embedded_list
