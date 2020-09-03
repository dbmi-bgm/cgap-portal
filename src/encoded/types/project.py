"""The type file for the collection Project.
"""

from snovault import (
    collection,
    load_schema,
)
from .base import (
    Item
)


@collection(
    name='projects',
    unique_key='project:name',
    properties={
        'title': 'Projects',
        'description': 'Listing of projects',
    })
class Project(Item):
    """Project class."""

    item_type = 'project'
    schema = load_schema('encoded:schemas/project.json')
    embedded_list = Item.embedded_list


    # def __ac_local_roles__(self):
    #     """ Maybe needs override? """
    #     properties = self.upgrade_properties()
    #     return {
    #         'project.%s' % properties['name']: 'role.project_member'
    #     }
