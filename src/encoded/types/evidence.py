"""Collection for Phenotypes objects."""
from snovault import (
    calculated_property,
    abstract_collection,
    collection,
    load_schema,
)
from .base import (
    Item,
    get_item_if_you_can,
    ALLOW_SUBMITTER_ADD,
)


# def get_evidence_linked_items(request, rpaths, direction):
#     """ This function is generally useful for getting the items that are linked to
#         others through an Evidence item so this is where it lives for now.
#         To use it in a calculated property the linked Items in subject_item or object_item
#         must be rev linked to the Evidence item using
#
#         rev = {
#             'as_subject_evidence': ('Evidence', 'subject_item'),
#             'as_object_evidence': ('Evidence', 'object_item'),
#         }
#
#         NOTE if you know that a certain Item type will ever only be either a subject or object
#         you can omit the unneeded item from the rev dict.
#
#         In the calculated property you get a list to the resource paths by calling
#         self.rev_link_atids
#
#         params:
#         request - the request object
#         paths - list of resource paths from the rev links
#         direction - 'either subject or object'
#     """
#     uuids = []
#     for evi in rpaths:
#         ''' cannot use embedded frame so using the object frame and relying on the collection name to match
#             the item type and always be part of the resource_path in the value - a bit hacky and might want
#             to prefer to use another get_item_if_you_can for filtering by type but might not be performant
#         '''
#         dname = direction + '_item'
#         # get frame=raw to stop evidence items from linking each other
#         evi_item = get_item_if_you_can(request, evi, 'evidences', frame='raw')
#         if evi_item:
#             # this will just be a uuid
#             ri_info = evi_item.get(dname)
#             if ri_info:
#                 uuids.append(ri_info)
#     return uuids


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
