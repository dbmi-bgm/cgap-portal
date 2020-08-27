from snovault import COLLECTIONS


def groupfinder(login, request):
    if '.' not in login:
        return None
    namespace, localname = login.split('.', 1)
    user = None

    collections = request.registry[COLLECTIONS]

    if namespace == 'remoteuser':
        if localname in ['EMBED', 'INDEXER']:
            return []
        elif localname in ['TEST', 'IMPORT', 'UPGRADE']:
            return ['group.admin']
        elif localname in ['TEST_SUBMITTER']:
            return ['group.submitter']
        elif localname in ['TEST_AUTHENTICATED']:
            return ['viewing_group.ENCODE']

    if namespace in ('mailto', 'remoteuser', 'auth0'):
        users = collections.by_item_type['user']
        try:
            user = users[localname]
        except KeyError:
            return None

    elif namespace == 'accesskey':

        access_keys = collections.by_item_type['access_key']
        try:
            access_key = access_keys[localname]
        except KeyError:
            return None

        if access_key.properties.get('status') in ('deleted', 'revoked'):
            return None

        userid = access_key.properties['user']
        user = collections.by_item_type['user'][userid]

    if user is None:
        return None

    user_properties = user.properties

    if user_properties.get('status') in ('deleted'):
        return None

    principals = ['userid.%s' % user.uuid]

    # not currently used for access
    institution = user_properties.get('institution')
    if institution:
        principals.append('institution.%s' % institution)

    # first pass implementation uses project to give view access only - will need to be
    # be modified when different user roles can provide different levels of access
    # and users can belong to different project
    # project_roles is a list of embedded objects with 'project' property required
    project_roles = user_properties.get('project_roles', [])
    principals.extend('project.{}'.format(pr.get('project')) for pr in project_roles)

    groups = user_properties.get('groups', [])
    principals.extend('group.%s' % group for group in groups)
    return principals
