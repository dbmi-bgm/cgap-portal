from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema,
)
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
    embedded_list = Note.embedded_list


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
    embedded_list = Note.embedded_list
