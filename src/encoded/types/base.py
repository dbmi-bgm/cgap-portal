"""base class creation for all the schemas that exist."""
import re
import snovault
import string

from datetime import date
from functools import lru_cache
from jsonschema_serialize_fork import NO_DEFAULT
from pyramid.security import (
    # ALL_PERMISSIONS,
    Allow,
    Authenticated,
    Deny,
    # DENY_ALL,
    Everyone,
)
from pyramid.traversal import find_root
from pyramid.view import (
    view_config,
)
from pyramid.httpexceptions import HTTPUnprocessableEntity
from snovault.util import debug_log
# import snovault default post / patch stuff so we can overwrite it in this file
from snovault.validators import (
    validate_item_content_post,
    validate_item_content_put,
    validate_item_content_patch,
    validate_item_content_in_place,
    no_validate_item_content_post,
    no_validate_item_content_put,
    no_validate_item_content_patch
)
# We will extend the following functions with CGAP-specific actions
from snovault.crud_views import (
    collection_add as sno_collection_add,
    item_edit as sno_item_edit,
)
from snovault.interfaces import CONNECTION
# from ..schema_formats import is_accession
from ..server_defaults import get_userid, add_last_modified


# Item acls
# TODO (C4-332): consolidate all acls into one place - i.e. their own file
ONLY_ADMIN_VIEW_ACL = [
    (Allow, 'group.admin', ['view', 'edit']),
    (Allow, 'group.read-only-admin', ['view']),
    (Allow, 'remoteuser.INDEXER', ['view']),
    (Allow, 'remoteuser.EMBED', ['view']),
    (Deny, Everyone, ['view', 'edit'])
]

""" This acl allows item creation; it should be overwritten with an empty
    list in Item types a project member user should not be able to create
    likely worthwhile to review and set it up in the opposite way as there
    will probably be more items than a regular user shouldn't create
    this gets added to the Collection class __init__
"""
PROJECT_MEMBER_CREATE_ACL = [
    (Allow, 'group.project_editor', 'add'),
    (Allow, 'group.project_editor', 'create'),
]

# this is for pages that should be visible to public
ALLOW_EVERYONE_VIEW_ACL = [
    (Allow, Everyone, 'view'),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL

# view for shared items - add a status for common cgap items
# not sure if we want project members to have create on these?
ALLOW_AUTHENTICATED_VIEW_ACL = [
    (Allow, Authenticated, 'view'),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL

ALLOW_PROJECT_MEMBER_EDIT_ACL = [
    (Allow, 'role.project_editor', ['view', 'edit']),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL


ALLOW_PROJECT_MEMBER_VIEW_ACL = [
    (Allow, 'role.project_editor', 'view'),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL

DELETED_ACL = [
    (Deny, Everyone, 'visible_for_edit')
] + ONLY_ADMIN_VIEW_ACL

ALLOW_PROJECT_MEMBER_ADD_ACL = PROJECT_MEMBER_CREATE_ACL


def get_item_or_none(request, value, itype=None, frame='object'):
    """
    Return the view of an item with given frame. Can specify different types
    of `value` for item lookup

    Args:
        request: the current Request
        value (str): String item identifier or a dict containing @id/uuid
        itype (str): Optional string collection name for the item (e.g. /file-formats/)
        frame (str): Optional frame to return. Defaults to 'object'

    Returns:
        dict: given view of the item or None on failure
    """
    item = None

    if isinstance(value, dict):
        if 'uuid' in value:
            value = value['uuid']
        elif '@id' in value:
            value = value['@id']

    svalue = str(value)

    # Below case is for UUIDs & unique_keys such as accessions, but not @ids
    if not svalue.startswith('/') and not svalue.endswith('/'):
        svalue = '/' + svalue + '/'
        if itype is not None:
            svalue = '/' + itype + svalue

    # Request.embed will attempt to get from ES for frame=object/embedded
    # If that fails, get from DB. Use '@@' syntax instead of 'frame=' because
    # these paths are cached in indexing
    try:
        item = request.embed(svalue, '@@' + frame)
    except Exception:
        pass

    # could lead to unexpected errors if == None
    return item


def set_namekey_from_title(properties):
    name = None
    if properties.get('title'):
        exclude = set(string.punctuation.replace('-', ''))
        name = properties['title'].replace('&', ' n ')
        name = ''.join(ch if ch not in exclude and ch != ' ' else '-' for ch in name)
        name = re.sub(r"[-]+", '-', name).strip('-').lower()
    return name


def validate_item_type_of_linkto_field(context, request):
    """We are doing this case by case on item specific types files,
    but might want to carry it here if filter is used more often.
    If any of the submitted fields contain an ff_flag property starting with "filter",
    the field in the filter is used for validating the type of the linked item.
    Example: file has field file_format which is a linkTo FileFormat.
    FileFormat items contain a field called "valid_item_types".
    We have the ff_flag on file_format field called "filter:valid_item_types"."""
    pass


##
## Common lists of embeds to be re-used in certain files (similar to schema mixins)
##

static_content_embed_list = [
    "static_headers.*",            # Type: UserContent, may have differing properties
    "static_content.content.@type",
    "static_content.content.content",
    "static_content.content.name",
    "static_content.content.title",
    "static_content.content.status",
    "static_content.content.description",
    "static_content.content.options",
    "static_content.content.institution",
    "static_content.content.project",
    "static_content.content.filetype"
]


class AbstractCollection(snovault.AbstractCollection):
    """smth."""

    def __init__(self, *args, **kw):
        try:
            self.lookup_key = kw.pop('lookup_key')
        except KeyError:
            pass
        super(AbstractCollection, self).__init__(*args, **kw)

    def get(self, name, default=None):
        '''
        heres' and example of why this is the way it is:
        ontology terms have uuid or term_id as unique ID keys
        and if neither of those are included in post, try to
        use term_name such that:
        No - fail load with non-existing term message
        Multiple - fail load with ‘ambiguous name - more than 1 term with that name exist use ID’
        Single result - get uuid and use that for post/patch
        '''
        resource = super(AbstractCollection, self).get(name, None)
        if resource is not None:
            return resource
        if ':' in name:
            resource = self.connection.get_by_unique_key('alias', name)
            if resource is not None:
                if not self._allow_contained(resource):
                    return default
                return resource
        if getattr(self, 'lookup_key', None) is not None:
            # lookup key translates to query json by key / value and return if only one of the
            # item type was found... so for keys that are mostly unique, but do to whatever
            # reason (bad data mainly..) can be defined as unique keys
            item_type = self.type_info.item_type
            resource = self.connection.get_by_json(self.lookup_key, name, item_type)
            if resource is not None:
                if not self._allow_contained(resource):
                    return default
                return resource
        return default


class Collection(snovault.Collection, AbstractCollection):
    """smth."""

    def __init__(self, *args, **kw):
        """smth."""
        super(Collection, self).__init__(*args, **kw)
        if hasattr(self, '__acl__'):
            return

        # If no ACLs are defined for collection, allow project members to create
        if 'project' in self.type_info.factory.schema['properties']:
            self.__acl__ = ALLOW_PROJECT_MEMBER_ADD_ACL


@snovault.abstract_collection(
    name='items',
    properties={
        'title': "Item Listing",
        'description': 'Abstract collection of all Items.',
    })
class Item(snovault.Item):
    """smth."""
    item_type = 'item'
    AbstractCollection = AbstractCollection
    Collection = Collection
    STATUS_ACL = {
        # standard_status
        'shared': ALLOW_AUTHENTICATED_VIEW_ACL,
        'obsolete': ALLOW_AUTHENTICATED_VIEW_ACL,
        'current': ALLOW_PROJECT_MEMBER_EDIT_ACL,
        'inactive': ALLOW_PROJECT_MEMBER_VIEW_ACL,
        'in review': ALLOW_PROJECT_MEMBER_EDIT_ACL,
        'uploaded': ALLOW_PROJECT_MEMBER_EDIT_ACL,
        'uploading': ALLOW_PROJECT_MEMBER_EDIT_ACL,
        'deleted': DELETED_ACL,
        'replaced': ONLY_ADMIN_VIEW_ACL,
        # everyone view - restrict to specific items via schema
        'public': ALLOW_EVERYONE_VIEW_ACL
    }
    FACET_ORDER_OVERRIDE = {}  # empty by default

    # Items of these statuses are filtered out from rev links
    filtered_rev_statuses = ('deleted')

    # Default embed list for all CGAP Items
    embedded_list = static_content_embed_list

    def __init__(self, registry, models):
        super().__init__(registry, models)
        self.STATUS_ACL = self.__class__.STATUS_ACL

    @property
    def __name__(self):
        """smth."""
        if self.name_key is None:
            return self.uuid
        properties = self.upgrade_properties()
        if properties.get('status') == 'replaced':
            return self.uuid
        return properties.get(self.name_key, None) or self.uuid

    def __acl__(self):
        """This sets the ACL for the item based on mapping of status to ACL.
           If there is no status or the status is not included in the STATUS_ACL
           lookup then the access is set to admin only
        """
        # Don't finalize to avoid validation here.
        properties = self.upgrade_properties().copy()
        status = properties.get('status')
        return self.STATUS_ACL.get(status, ONLY_ADMIN_VIEW_ACL)

    def __ac_local_roles__(self):
        """Adds additional information allowing access of the Item based on
           properties of the Item - currently most important is Project.
           eg. ITEM.__ac_local_roles = {
                    institution.uuid: role.institution_member,
                    project.uuid: role.project_member
                }
          """
        roles = {}
        properties = self.upgrade_properties()
        if 'institution' in properties:
            # add institution_member as well
            inst_member = 'institution.%s' % properties['institution']
            roles[inst_member] = 'role.institution_member'
            # to avoid conflation of the project used for attribution of the User ITEM
            # from the project(s) specified in the project_roles specifying project_editor
            # role - instead of using 'bare' project
        if 'project' in properties:
            project_editors = 'editor_for.%s' % properties['project']
            roles[project_editors] = 'role.project_editor'
        return roles

    def add_accession_to_title(self, title):
        if self.properties.get('accession') is not None:
            return title + ' - ' + self.properties.get('accession')
        return title

    def unique_keys(self, properties):
        """smth."""
        keys = super(Item, self).unique_keys(properties)
        if 'accession' not in self.schema['properties']:
            return keys
        keys.setdefault('accession', []).extend(properties.get('alternate_accessions', []))
        if properties.get('status') != 'replaced' and 'accession' in properties:
            keys['accession'].append(properties['accession'])
        return keys

    def is_update_by_admin_user(self):
        # determine if the submitter in the properties is an admin user
        userid = get_userid()
        users = self.registry['collections']['User']
        user = users.get(userid)
        if 'groups' in user.properties:
            if 'admin' in user.properties['groups']:
                return True
        return False

    def _update(self, properties, sheets=None):
        add_last_modified(properties)
        super(Item, self)._update(properties, sheets)

    @snovault.calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request=None):
        """create a display_title field."""
        display_title = ""
        look_for = [
            "title",
            "name",
            "location_description",
            "accession",
        ]
        properties = self.upgrade_properties()
        for field in look_for:
            # special case for user: concatenate first and last names
            display_title = properties.get(field, None)
            if display_title:
                if field != 'accession':
                    display_title = self.add_accession_to_title(display_title)
                return display_title
        # if none of the existing terms are available, use @type + date_created
        try:
            type_date = self.__class__.__name__ + " from " + properties.get("date_created", None)[:10]
            return type_date
        # last resort, use uuid
        except Exception:
            return properties.get('uuid', None)

    def rev_link_atids(self, request, rev_name):
        """
        Returns the list of reverse linked items given a defined reverse link,
        which should be formatted like:
        rev = {
            '<reverse field name>': ('<reverse item class>', '<reverse field to find>'),
        }

        """
        conn = request.registry[CONNECTION]
        return [request.resource_path(conn[uuid]) for uuid in
                self.get_filtered_rev_links(request, rev_name)]


@snovault.calculated_property(context=Item.AbstractCollection, category='action')
def add(context, request):
    """smth."""
    if request.has_permission('add', context):
        type_name = context.type_info.name
        return {
            'name': 'add',
            'title': 'Add',
            'profile': '/profiles/{name}.json'.format(name=type_name),
            'href': '/search/?type={name}&currentAction=add'.format(name=type_name),
        }


@snovault.calculated_property(context=Item, category='action')
def edit(context, request):
    """smth."""
    if request.has_permission('edit'):
        return {
            'name': 'edit',
            'title': 'Edit',
            'profile': '/profiles/{ti.name}.json'.format(ti=context.type_info),
            'href': '{item_uri}?currentAction=edit'.format(item_uri=request.resource_path(context)),
        }


@snovault.calculated_property(context=Item, category='action')
def create(context, request):
    if request.has_permission('create'):
        return {
            'name': 'create',
            'title': 'Create',
            'profile': '/profiles/{ti.name}.json'.format(ti=context.type_info),
            'href': '{item_uri}?currentAction=create'.format(item_uri=request.resource_path(context)),
        }


@view_config(
    context=Collection,
    permission='add',
    request_method='POST',
    #validators=[] # TURNS OFF VALIDATION HERE ([validate_item_content_post] previously)
    validators=[validate_item_content_post]
)
@view_config(
    context=Collection,
    permission='add_unvalidated',
    request_method='POST',
    validators=[no_validate_item_content_post],
    request_param=['validate=false']
)
@debug_log
def collection_add(context, request, render=None):

    # institution_needed = False
    # project_needed = False
    # data = request.json
    # schema = context.type_info.schema
    #
    # required_properties = schema.get("required", [])
    # if "institution" in required_properties and "institution" not in data:
    #     institution_needed = True
    #
    # if "project" in required_properties and "project" not in data:
    #     project_needed = True
    #
    # if request.authenticated_userid and (institution_needed or project_needed):
    #     namespace, userid = request.authenticated_userid.split(".", 1)
    #     user_item = get_item_or_none(request, userid, itype="/users/", frame="object")
    #     new_data = data.copy()
    #     if institution_needed and "institution" in user_item:
    #         new_data["institution"] = user_item["institution"]
    #     if project_needed and "project" in user_item:
    #         new_data["project"] = user_item["project"]
    #
    #     # Override initial JSON body of request (hacky? better way?)
    #     setattr(request, "json", new_data)
    #
    # # Perform validation that would occur otherwise
    # validate_item_content_post(context, request)
    # if request.errors:
    #     return HTTPUnprocessableEntity(
    #         json={'errors': request.errors},
    #         content_type='application/json'
    #     )
    return sno_collection_add(context, request, render)


@view_config(context=Item, permission='edit', request_method='PUT',
             validators=[validate_item_content_put])
@view_config(context=Item, permission='edit', request_method='PATCH',
             validators=[validate_item_content_patch])
@view_config(context=Item, permission='edit_unvalidated', request_method='PUT',
             validators=[no_validate_item_content_put],
             request_param=['validate=false'])
@view_config(context=Item, permission='edit_unvalidated', request_method='PATCH',
             validators=[no_validate_item_content_patch],
             request_param=['validate=false'])
@view_config(context=Item, permission='index', request_method='GET',
             validators=[validate_item_content_in_place],
             request_param=['check_only=true'])
@debug_log
def item_edit(context, request, render=None):
    # This works
    # Probably don't need to extend re: institution + project since if editing, assuming these have previously existed.
    return sno_item_edit(context, request, render)
