import json

from dcicutils.misc_utils import environ_bool, PRINT
from snovault import COLLECTIONS
from pyramid.security import Authenticated


DEBUG_PERMISSIONS = environ_bool("DEBUG_PERMISSIONS", default=False)

def groupfinder(login, request):
    if '.' not in login:
        if DEBUG_PERMISSIONS:
            PRINT("groupfinder sees no '.' in %s, returning None" % login)
        return None
    namespace, localname = login.split('.', 1)
    user = None

    collections = request.registry[COLLECTIONS]

    """ At least part of this stanza seems mainly for testing purposes
        should the testing bits be refactored elsewhere???
        20-09-08 changed permission model requires import of Authenticated
        is that kosher
    """
    # TODO (C4-332): Consolidate permissions all in one perms.py file once this all stabilizes.
    if namespace == 'remoteuser':

        # These names are used in testing or special service situations to force the permissions result
        # to known values without any need to go through lookup of any particular user and process
        # their groups or project_roles.

        synthetic_result = None

        if localname in ['EMBED', 'INDEXER']:
            synthetic_result = []
        elif localname in ['TEST', 'IMPORT', 'UPGRADE', 'INGESTION']:
            synthetic_result = ['group.admin']
        elif localname in ['TEST_SUBMITTER']:
            synthetic_result = ['group.submitter']
        elif localname in ['TEST_AUTHENTICATED']:
            synthetic_result = [Authenticated]

        if synthetic_result is not None:
            if DEBUG_PERMISSIONS:
                PRINT("groupfinder for", login, "returning synthetic result:", synthetic_result)
            return synthetic_result

        # Note that the above 'if' has no final 'else', and the remainder of cases,
        # having the form remoteuser.<username>, are processed in the next 'if' below.

    if namespace in ('mailto', 'remoteuser', 'auth0'):
        users = collections.by_item_type['user']
        try:
            user = users[localname]
            if DEBUG_PERMISSIONS:
                PRINT("groupfinder for", login, "found user", localname)
        except KeyError:
            if DEBUG_PERMISSIONS:
                PRINT("groupfinder for", login, "failed to find user", localname)
            return None

    elif namespace == 'accesskey':

        access_keys = collections.by_item_type['access_key']
        try:
            access_key = access_keys[localname]
            if DEBUG_PERMISSIONS:
                PRINT("groupfinder for", login, "found access key", localname)
        except KeyError:
            if DEBUG_PERMISSIONS:
                PRINT("groupfinder for", login, "failed to find access key", localname)
            return None

        access_key_status = access_key.properties.get('status')
        if access_key_status in ('deleted', 'revoked'):
            if DEBUG_PERMISSIONS:
                PRINT("groupfinder for", login, "found", access_key_status, "access key", localname)
            return None

        userid = access_key.properties['user']
        user = collections.by_item_type['user'][userid]

        if DEBUG_PERMISSIONS:
            PRINT("groupfinder for", login, "decoded access key", localname, "as user", user)

    if user is None:
        PRINT("groupfinder for", login, "returning None because user is None")
        return None

    user_properties = user.properties

    if user_properties.get('status') in ('deleted'):
        if DEBUG_PERMISSIONS:
            PRINT("groupfinder for %s found user %s, but that user has status deleted." % (login, user))
        return None

    principals = ['userid.%s' % user.uuid]
    if DEBUG_PERMISSIONS:
        PRINT("groupfinder starting with principals", principals)

    def add_principal(principal):
        if DEBUG_PERMISSIONS:
            PRINT("groupfinder for", login, "adding", principal , "to principals.")
        principals.append(principal)

    # first pass implementation uses project to give view access only - will need to be
    # be modified when different user roles can provide different levels of access
    # and users can belong to different project
    # project_roles is a list of embedded objects with 'project' property required

    project_roles = user_properties.get('project_roles', [])
    if DEBUG_PERMISSIONS:
        PRINT("groupfind for", login, "found project roles:", json.dumps(project_roles))

    if project_roles:
        add_principal('group.project_editor')

    for pr in project_roles:
        add_principal('editor_for.{}'.format(pr.get('project')))

    for group in user_properties.get('groups', []):
        add_principal('group.%s' % group)

    if DEBUG_PERMISSIONS:
        PRINT("groupfinder for", login, "returning principals", json.dumps(principals, indent=2))

    return principals


def is_admin_request(request):
    """ Checks for 'group.admin' in effective_principals on request - if present we know this
        request was submitted by an admin
    """
    return 'group.admin' in request.effective_principals
