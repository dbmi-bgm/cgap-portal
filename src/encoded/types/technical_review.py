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
        'last_modified.modified_by.display_title',
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
    def display_title(self):
        assessment = self.properties.get("assessment", {})
        call = assessment.get("call")
        classification = assessment.get("classification")
        if call is not None and classification is not None:
            return "(" + ("" if call == True else "No ") + "Call) " + classification
        return self.uuid

        


