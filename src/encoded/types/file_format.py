from pyramid.view import view_config
from pyramid.security import Authenticated
from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from snovault.util import debug_log
from snovault.attachment import ItemWithAttachment
from .base import (
    Item,
)


@collection(
    name='file-formats',
    unique_key='file_format:file_format',
    lookup_key='file_format',
    properties={
        'title': 'File Formats',
        'description': 'Listing of file formats used by 4DN'
    }
)
class FileFormat(Item, ItemWithAttachment):
    """The class to store information about 4DN file formats"""
    item_type = 'file_format'
    schema = load_schema('encoded:schemas/file_format.json')
    name_key = 'file_format'

    @calculated_property(schema={
        "title": "Display Title",
        "description": "File Format name or extension.",
        "type": "string"
    })
    def display_title(self, file_format):
        return file_format


@view_config(route_name='get_file_formats', request_method='GET', effective_principals=Authenticated)
@debug_log
def get_file_formats(context, request):
    """ Gets all file format items from the database. """
    pass
