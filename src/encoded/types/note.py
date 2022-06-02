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
from ..server_defaults import add_last_modified


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

    def _update(self, properties, sheets=None):
        new_note_text = properties.get("note_text", None)
        old_note_text = None
        try:
            # We may not have a self.properties yet if this is a new item (e.g. from POST request)
            # (getattr(self, properties) doesn't work here, throws exception)
            old_note_text = self.properties.get("note_text", None)
        except KeyError as e: # str(e) === "''"; not sure why.
            pass
        if new_note_text != old_note_text:
            # Add/update last_text_edited: { text_edited_by, date_text_edited }
            add_last_modified(properties, field_name_portion="text_edited")
        super(Note, self)._update(properties, sheets)

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
            return self.uuid





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
            return self.uuid





@collection(
    name='notes-technical-review',
    properties={
        'title': 'Technical Review Note',
        'description': 'Listing of Technical Reviews',
    })
class NoteTechnicalReview(Note):
    """NoteTechnicalReview class."""

    item_type = 'note_technical_review'
    schema = load_schema('encoded:schemas/note_technical_review.json')
    # rev = {'variant_sample': ('VariantSample', 'technical_review')}
    embedded_list = [
        'last_modified.modified_by.display_title',
        'last_text_edited.text_edited_by.display_title',
        'review.reviewed_by.display_title'
        # Maybe put within like 'approval' sub-object, to make e.g. note.approval.date_approved
        # Would allow easier PATCHing from UI (no custom endpoint needed)
        #'note.approved_by',
        #'note.date_approved'
    ]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Note's display title",
        "type": "string"
    })
    def display_title(self):
        assessment = self.properties.get("assessment", {})
        call = assessment.get("call")
        classification = assessment.get("classification")
        if call is not None and classification is not None:
            return "(" + ("" if call == True else "No ") + "Call) " + classification
        return self.uuid

        
