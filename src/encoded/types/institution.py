"""The type file for the collection Institution.

was moved here in 4DN to allow a lab/institution member to edit the
lab/institution info at any time
with simplified permissions may potentially move back
"""
from snovault import (
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='institutions',
    unique_key='institution:name',
    properties={
        'title': 'Institutions',
        'description': 'Listing of Institutions',
    })
class Institution(Item):
    """Institution class."""

    item_type = 'institution'
    schema = load_schema('encoded:schemas/institution.json')
    name_key = 'name'
    embedded_list = Item.embedded_list

    # def __init__(self, registry, models):
    #     super().__init__(registry, models)
    #     if hasattr(self, 'STATUS_ACL'):
    #         self.STATUS_ACL.update(self.__class__.STATUS_ACL)
    #     else:
    #         self.STATUS_ACL = self.__class__.STATUS_ACL

    # def __ac_local_roles__(self):
    #     """This creates roles that the lab item needs so it can be edited & viewed"""
    #     roles = {}
    #     # institution_submitters = 'submits_for.%s' % self.uuid
    #     # roles[institution_submitters] = 'role.institution_submitter'
    #     institution_member = 'lab.%s' % self.uuid
    #     roles[institution_member] = 'role.institution_member'
    #     return roles
