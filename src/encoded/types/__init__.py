"""init.py lists all the collections that do not have a dedicated types file."""

import transaction
from snovault import (
    calculated_property,
    collection,
    load_schema,
    # CONNECTION,
    COLLECTIONS,
    # display_title_schema
)
from snovault.attachment import ItemWithAttachment
from snovault.crud_views import collection_add as sno_collection_add
from snovault.schema_utils import validate_request
from snovault.validation import ValidationFailure
from .base import (
    Item,
    get_item_or_none,
    # set_namekey_from_title,
    # ALLOW_OWNER_EDIT,
    # ALLOW_CURRENT,
    DELETED_ACL,
    ONLY_ADMIN_VIEW_ACL
)


def includeme(config):
    """include me method."""
    config.scan()


@collection(
    name='reports',
    properties={
        'title': 'Reports',
        'description': 'Listing of Reports',
    })
class Report(Item):
    item_type = 'report'
    schema = load_schema('encoded:schemas/report.json')
    embedded_list = [
        "variant_samples.interpretation.classification",
        "variant_samples.interpretation.conclusion",
        "variant_samples.interpretation.acmg_guidelines",
        "variant_samples.interpretation.note_text",
        # Institution used for report footer
        "institution.display_title",
        "institution.address1",
        "institution.address2",
        "institution.city",
        "institution.state",
        "institution.country",
        "institution.postal_code",
        "institution.phone1",
        "institution.phone2",
        "institution.fax",
        "institution.url",
        "institution.contact_persons.email"
    ]
    rev = {'case': ('Case', 'report')}

    @calculated_property(schema={
        "title": "Case",
        "description": "The case this sample processing is for",
        "type": "string",
        "linkTo": "Case"
    })
    def case(self, request):
        rs = self.rev_link_atids(request, "case")
        if rs:
            return rs[0]

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, accession):
        case = self.rev_link_atids(request, "case")
        if case:
            case_props = get_item_or_none(request, case[0], 'cases')
            if case_props and case_props.get('case_id'):
                return case_props['case_id'] + ' Case Report'
        return accession


@collection(
    name='gene-annotation-fields',
    unique_key='gene_annotation_field:field_name',
    properties={
        'title': 'Gene Annotation Fields',
        'description': 'List of gene annotation fields',
    })
class GeneAnnotationField(Item):
    """Class for gene annotation fields."""

    item_type = 'gene_annotation_field'
    name_key = 'field_name'
    schema = load_schema('encoded:schemas/gene_annotation_field.json')

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, source_name, field_name):
        return ':'.join([source_name, field_name])


@collection(
    name='documents',
    properties={
        'title': 'Documents',
        'description': 'Listing of Documents',
    })
class Document(ItemWithAttachment, Item):
    """Document class."""

    item_type = 'document'
    schema = load_schema('encoded:schemas/document.json')
    embedded_list = []
    mimetype_map = {'application/proband+xml': ['text/plain']}

    def mimetypes_are_equal(self, m1, m2):
        """ Checks that mime_type m1 and m2 are equal """
        major1 = m1.split('/')[0]
        major2 = m2.split('/')[0]
        if major1 == 'text' and major2 == 'text':
            return True
        if m1 in self.mimetype_map and m2 in self.mimetype_map[m1]:
            return True
        return m1 == m2

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Document filename, if available.",
        "type": "string"
    })
    def display_title(self, attachment=None):
        if attachment:
            return attachment.get('download')
        return Item.display_title(self)

    class Collection(Item.Collection):
        pass


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


@collection(
    name='tracking-items',
    properties={
        'title': 'TrackingItem',
        'description': 'For internal tracking of Fourfront events',
    })
class TrackingItem(Item):
    """tracking-item class."""

    item_type = 'tracking_item'
    schema = load_schema('encoded:schemas/tracking_item.json')
    embedded_list = []
    STATUS_ACL = Item.STATUS_ACL.copy()
    STATUS_ACL.update({
        'released': ONLY_ADMIN_VIEW_ACL,
        'deleted': DELETED_ACL,
        'draft': ONLY_ADMIN_VIEW_ACL
    })

    @classmethod
    def create_and_commit(cls, request, properties, clean_headers=False):
        """
        Create a TrackingItem with a given request and properties, committing
        it directly to the DB. This works by manually committing the
        transaction, which may cause issues if this function is called as
        part of another POST. For this reason, this function should be used to
        track GET requests -- otherwise, use the standard POST method.
        If validator issues are hit, will not create the item but log to error

        Args:
            request: current request object
            properties (dict): TrackingItem properties to post
            clean_headers(bool): If True, remove 'Location' header created by POST

        Returns:
            dict response from snovault.crud_views.collection_add

        Raises:
            ValidationFailure if TrackingItem cannot be validated
        """
        collection = request.registry[COLLECTIONS]['TrackingItem']
        # set remote_user to standarize permissions
        prior_remote = request.remote_user
        request.remote_user = 'EMBED'
        # remove any missing attributes from DownloadTracking
        properties['download_tracking'] = {
            k: v for k, v in properties.get('download_tracking', {}).items() if v is not None
        }
        validate_request(collection.type_info.schema, request, properties)
        if request.errors:  # added from validate_request
            request.remote_user = prior_remote
            raise ValidationFailure('body', 'TrackingItem: create_and_commit',
                                    'Cannot validate request')
        ti_res = sno_collection_add(collection, request, False)  # render=False
        transaction.get().commit()
        if clean_headers and 'Location' in request.response.headers:
            del request.response.headers['Location']
        request.remote_user = prior_remote
        return ti_res

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Descriptor of TrackingItem",
        "type": "string"
    })
    def display_title(self, tracking_type, date_created=None, google_analytics=None):
        if date_created:  # pragma: no cover should always be true
            date_created = date_created[:10]
        if tracking_type == 'google_analytics':
            for_date = None
            if google_analytics:
                for_date = google_analytics.get('for_date', None)
            if for_date:
                return 'Google Analytics for ' + for_date
            return 'Google Analytics Item'
        elif tracking_type == 'download_tracking':
            title = 'Download Tracking Item'
            if date_created:
                title = title + ' from ' + date_created
            return title
        else:
            title = 'Tracking Item'
            if date_created:
                title = title + ' from ' + date_created
            return title


@collection(
    name='annotation-fields',
    unique_key='annotation_field:field_name',
    properties={
        'title': 'Annotation Fields',
        'description': 'List of annotation fields',
    })
class AnnotationField(Item):
    """Class for annotation fields."""

    item_type = 'annotation_field'
    name_key = 'field_name'
    schema = load_schema('encoded:schemas/annotation_field.json')

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, field_name):
        return field_name


@collection(
    name='nexuses',
    unique_key='accession',
    properties={
        'title': 'Cohorts',
        'description': 'List of Cohorts',
    })
class Nexus(Item):
    """Class for Cohorts."""
    item_type = 'nexus'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/nexus.json')
    embedded_list = []

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, title):
        return title
