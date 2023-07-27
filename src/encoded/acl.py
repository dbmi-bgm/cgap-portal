# Considation of ACL related definitions.
from pyramid.security import Allow, Authenticated, Deny, Everyone  # noqa: F401 (imported but unused)
from snovault.types.acl import Acl, DELETED_ACL, ONLY_ADMIN_VIEW_ACL  # noqa: F401 (imported but unused)

""" This acl allows item creation; it should be overwritten with an empty
    list in Item types a project member user should not be able to create
    likely worthwhile to review and set it up in the opposite way as there
    will probably be more items than a regular user shouldn't create
    this gets added to the Collection class __init__
"""
PROJECT_MEMBER_CREATE_ACL: Acl = [
    (Allow, 'group.project_editor', 'add'),
    (Allow, 'group.project_editor', 'create'),
]

# this is for pages that should be visible to public
ALLOW_EVERYONE_VIEW_ACL: Acl = [
    (Allow, Everyone, 'view'),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL

# view for shared items - add a status for common cgap items
# not sure if we want project members to have create on these?
ALLOW_AUTHENTICATED_VIEW_ACL: Acl = [
    (Allow, Authenticated, 'view'),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL

ALLOW_PROJECT_MEMBER_EDIT_ACL: Acl = [
    (Allow, 'role.project_editor', ['view', 'edit']),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL

ALLOW_PROJECT_MEMBER_VIEW_ACL: Acl = [
    (Allow, 'role.project_editor', 'view'),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL

ALLOW_PROJECT_MEMBER_ADD_ACL: Acl = PROJECT_MEMBER_CREATE_ACL

# Used for 'draft' status
ALLOW_OWNER_EDIT_ACL: Acl = [
    (Allow, 'role.owner', ['view', 'edit']),
] + ONLY_ADMIN_VIEW_ACL + PROJECT_MEMBER_CREATE_ACL
