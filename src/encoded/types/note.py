import datetime
from pyramid.view import view_config
from snovault.util import debug_log
from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema,
)
from snovault.validators import (
    validate_item_content_patch,
    no_validate_item_content_patch
)
from snovault.crud_views import item_edit as sno_item_edit
from .base import (
    Item
)


@abstract_collection(
    name='notes',
    properties={
        'title': 'Notes',
        'description': 'Listing of Notes',
    })
class Note(Item):
    """Note class."""

    item_type = 'note'
    base_types = ['Note'] + Item.base_types
    schema = load_schema('encoded:schemas/note.json')
    embedded_list = []




@view_config(context=Note, permission='edit', request_method='PATCH',
             validators=[validate_item_content_patch])
@debug_log
def note_edit(context, request, render=None):
    previous_status = context.properties.get("status")
    next_status = request.validated.get("status")
    if next_status != previous_status and next_status == "current":
        request.validated["approved_date"] = datetime.datetime.utcnow().isoformat() + "+00:00"
        request.validated["approved_by"] = request.user_info["details"]["uuid"]

    return sno_item_edit(context, request, render)



@collection(
    name='notes-standard',
    properties={
        'title': 'Standard Notes',
        'description': 'Listing of Standard Notes',
    })
class NoteStandard(Note):
    """NoteStandard class."""

    item_type = 'note_standard'
    schema = load_schema('encoded:schemas/note_standard.json')
    embedded_list = [
        'last_modified.date_modified',
        'last_modified.modified_by.display_title'
    ]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Note's display title",
        "type": "string"
    })
    def display_title(self, date_created):
        try:
            type_date = "Note from " + date_created[:10]
            return type_date
        # last resort, use uuid
        except Exception:
            properties = self.upgrade_properties()
            return properties.get('uuid', None)


@collection(
    name='notes-interpretation',
    properties={
        'title': 'Interpretation Notes',
        'description': 'Listing of Interpretation Notes',
    })
class NoteInterpretation(Note):
    """NoteInterpretation class."""

    item_type = 'note_interpretation'
    schema = load_schema('encoded:schemas/note_interpretation.json')
    embedded_list = [
        'last_modified.date_modified',
        'last_modified.modified_by.display_title'
    ]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Note's display title",
        "type": "string"
    })
    def display_title(self, date_created):
        try:
            type_date = "Clinical Interpretation from " + date_created[:10]
            return type_date
        # last resort, use uuid
        except Exception:
            properties = self.upgrade_properties()
            return properties.get('uuid', None)


@collection(
    name='notes-discovery',
    properties={
        'title': 'Discovery Notes',
        'description': 'Listing of Discovery Notes',
    })
class NoteDiscovery(Note):
    """NoteDiscovery class."""

    item_type = 'note_discovery'
    schema = load_schema('encoded:schemas/note_discovery.json')

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Note's display title",
        "type": "string"
    })
    def display_title(self, date_created):
        try:
            type_date = "Discovery Interpretation from " + date_created[:10]
            return type_date
        # last resort, use uuid
        except Exception:
            properties = self.upgrade_properties()
            return properties.get('uuid', None)
