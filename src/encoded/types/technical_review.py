'''
Put TechnicalReview into own file due because variant.py is relatively
large (maybe can move variant_sample out of variant.py or something also)
'''

import datetime
from snovault.util import debug_log
from snovault import (
    abstract_collection,
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    Item,
    # lab_award_attribution_embed_list
)



@collection(
    name='technical-reviews',
    properties={
        'title': 'Technical Reviews',
        'description': 'Listing of Technical Reviews',
    })
class TechnicalReview(Item):
    """TechnicalReview class."""

    item_type = 'technical_review'
    schema = load_schema('encoded:schemas/technical_review.json')
    embedded_list = [
        'last_modified.date_modified',
        'last_modified.modified_by.display_title',
        'review.date_reviewed',
        'review.reviewed_by.display_title',
        'note.last_modified.date_modified',
        'note.last_modified.modified_by.display_title',
        'note.note_text',
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
    def display_title(self, call_info):
        try:
            # We might not have a call_info, if removed for example.
            call = call_info['call']
            classification = call_info['classification']
            return "(" + ("" if call == True else "No ") + "Call) " + classification
        except Exception:
            # last resort, use uuid
            properties = self.upgrade_properties()
            return properties.get('uuid', None)
        


