import datetime
from snovault.util import debug_log
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

    @calculated_property(schema={
        "title": "ACMG Rule",
        "description": "ACMG Rule with Strength Modifier",
        "type": "string"
    })
    def acmg_rules_with_modifier(self, acmg_rules_invoked=None):
        if not acmg_rules_invoked:
            return
        rules_display = []
        for rule in acmg_rules_invoked:
            rule_string = rule['acmg_rule_name']
            if rule.get('rule_strength') and rule['rule_strength'] != 'Default':
                rule_string += '_' + rule['rule_strength']
            rules_display.append(rule_string)
        return rules_display


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
