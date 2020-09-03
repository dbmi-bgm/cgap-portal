from zope.interface import implementer
from pyramid.authorization import ACLAuthorizationPolicy
from pyramid.compat import is_nonstr_iter
from pyramid.interfaces import IAuthorizationPolicy
from pyramid.location import lineage


# This code (right now) is identical to that of https://github.com/lrowe/pyramid_localroles
# We are going to need to rip this out for CGAP. So first let's bring it in so we can debug and
# modify it while we implement a new permissions structure.

def local_principals(context, principals):
    """ The idea behind this is to process __ac_local_roles__ (and a boolean __ac_local_roles_block__
        to disable) and add local principals. This only works if you're in correct context, though,
        which does not seem to be the case.
    """

    local_principals = set()

    block = False
    for location in lineage(context):
        if block:
            break
        block = getattr(location, '__ac_local_roles_block__', False)
        local_roles = getattr(location, '__ac_local_roles__', None)

        if local_roles and callable(local_roles):
            local_roles = local_roles()

        if not local_roles:
            continue

        for principal in principals:
            try:
                roles = local_roles[principal]
            except KeyError:
                pass
            else:
                if not is_nonstr_iter(roles):
                    roles = [roles]
                local_principals.update(roles)

    if not local_principals:
        return principals

    local_principals.update(principals)
    return local_principals


def merged_local_principals(context, principals):
    # XXX Possibly limit to prefix like 'role.'
    set_principals = frozenset(principals)
    local_principals = set()
    block = False
    for location in lineage(context):
        if block:
            break

        block = getattr(location, '__ac_local_roles_block__', False)
        local_roles = getattr(location, '__ac_local_roles__', None)

        if local_roles and callable(local_roles):
            local_roles = local_roles()

        if not local_roles:
            continue

        for principal, roles in local_roles.items():
            if not is_nonstr_iter(roles):
                roles = [roles]
            if not set_principals.isdisjoint(roles):
                local_principals.add(principal)

    if not local_principals:
        return principals

    local_principals.update(principals)
    return list(local_principals)


@implementer(IAuthorizationPolicy)
class LocalRolesAuthorizationPolicy(object):
    """Local roles authorization policy
    Objects may be given an ``__ac_local_roles__`` property which may be either a
    mapping or a callable that returns a mapping from principal id to a list of principals.
    """
    def __init__(self, wrapped_policy=None):
        if wrapped_policy is None:
            wrapped_policy = ACLAuthorizationPolicy()
        self.wrapped_policy = wrapped_policy

    def permits(self, context, principals, permission):
        principals = local_principals(context, principals)
        return self.wrapped_policy.permits(context, principals, permission)

    def principals_allowed_by_permission(self, context, permission):
        principals = self.wrapped_policy.principals_allowed_by_permission(context, permission)
        return merged_local_principals(context, principals)