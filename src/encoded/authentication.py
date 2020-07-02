import base64
import os
from operator import itemgetter
from datetime import datetime
import time
import jwt
from base64 import b64decode

from passlib.context import CryptContext
from urllib.parse import urlencode
from pyramid.authentication import (
    BasicAuthAuthenticationPolicy as _BasicAuthAuthenticationPolicy,
    CallbackAuthenticationPolicy
)
import requests
from pyramid.path import (
    DottedNameResolver,
    caller_package,
)
from pyramid.security import (
    NO_PERMISSION_REQUIRED,
    remember,
    forget,
)
from pyramid.httpexceptions import (
    HTTPForbidden,
    HTTPUnauthorized,
    HTTPFound
)
from pyramid.view import (
    view_config,
)
from pyramid.settings import asbool
from snovault import (
    ROOT,
    CONNECTION,
    COLLECTIONS
)
from snovault.validation import ValidationFailure
from snovault.calculated import calculate_properties
from snovault.validators import no_validate_item_content_post
from snovault.crud_views import collection_add as sno_collection_add
from snovault.schema_utils import validate_request
from snovault.util import debug_log

CRYPT_CONTEXT = __name__ + ':crypt_context'


JWT_ENCODING_ALGORITHM = 'HS256'

# Might need to keep a list of previously used algorithms here, not just the one we use now.
# Decryption algorithm used to default to a long list,
# but more recent versions of jwt library say we should stop assuming that.
#
# In case it goes away, as far as I can tell, the default for decoding from their
# default_algorithms() method used to be: ['ES512', 'RS384', 'HS512', 'ES256', 'none',
# 'RS256', 'PS512', 'ES384', 'HS384', 'ES521', 'PS384', 'HS256', 'PS256', 'RS512']
# -kmp 15-May-2020

# TODO: JWT_DECODING_ALGORITHMS = [JWT_ENCODING_ALGORITHM]


def includeme(config):
    config.include('.edw_hash')
    setting_prefix = 'passlib.'
    passlib_settings = {
        k[len(setting_prefix):]: v
        for k, v in config.registry.settings.items()
        if k.startswith(setting_prefix)
    }
    if not passlib_settings:
        passlib_settings = {'schemes': 'edw_hash, unix_disabled'}
    crypt_context = CryptContext(**passlib_settings)
    config.registry[CRYPT_CONTEXT] = crypt_context

    # basic login route
    config.add_route('login', '/login')
    config.add_route('logout', '/logout')
    config.add_route('me', '/me')
    config.add_route('impersonate-user', '/impersonate-user')
    config.add_route('session-properties', '/session-properties')
    config.add_route('create-unauthorized-user', '/create-unauthorized-user')
    config.scan(__name__)


class NamespacedAuthenticationPolicy(object):
    """ Wrapper for authentication policy classes

    As userids are included in the list of principals, it seems good practice
    to namespace them to avoid clashes.

    Constructor Arguments

    ``namespace``

        The namespace used (string).

    ``base``

        The base authentication policy (class or dotted name).

    Remaining arguments are passed to the ``base`` constructor.

    Example

    To make a ``REMOTE_USER`` 'admin' be 'user.admin'

    .. code-block:: python

        policy = NamespacedAuthenticationPolicy('user',
            'pyramid.authentication.RemoteUserAuthenticationPolicy')
    """

    def __new__(cls, namespace, base, *args, **kw):
        # Dotted name support makes it easy to configure with pyramid_multiauth
        name_resolver = DottedNameResolver(caller_package())
        base = name_resolver.maybe_resolve(base)
        # Dynamically create a subclass
        name = 'Namespaced_%s_%s' % (namespace, base.__name__)
        klass = type(name, (cls, base), {'_namespace_prefix': namespace + '.'})
        return super(NamespacedAuthenticationPolicy, klass).__new__(klass)

    def __init__(self, namespace, base, *args, **kw):
        super(NamespacedAuthenticationPolicy, self).__init__(*args, **kw)

    def unauthenticated_userid(self, request):
        cls  = super(NamespacedAuthenticationPolicy, self)
        userid = super(NamespacedAuthenticationPolicy, self) \
            .unauthenticated_userid(request)
        if userid is not None:
            userid = self._namespace_prefix + userid
        return userid

    def remember(self, request, principal, **kw):
        if not principal.startswith(self._namespace_prefix):
            return []
        principal = principal[len(self._namespace_prefix):]
        return super(NamespacedAuthenticationPolicy, self) \
            .remember(request, principal, **kw)


class BasicAuthAuthenticationPolicy(_BasicAuthAuthenticationPolicy):
    def __init__(self, check, *args, **kw):
        # Dotted name support makes it easy to configure with pyramid_multiauth
        name_resolver = DottedNameResolver(caller_package())
        check = name_resolver.maybe_resolve(check)
        super(BasicAuthAuthenticationPolicy, self).__init__(check, *args, **kw)


class LoginDenied(HTTPUnauthorized):
    title = 'Login Failure'

    def __init__(self, domain=None, *args, **kwargs):
        super(LoginDenied, self).__init__(*args, **kwargs)
        if not self.headers.get('WWW-Authenticate') and domain:
            # headers['WWW-Authenticate'] might be set in constructor thru headers
            self.headers['WWW-Authenticate'] = "Bearer realm=\"{}\"; Basic realm=\"{}\"".format(domain, domain)


_fake_user = object()


class Auth0AuthenticationPolicy(CallbackAuthenticationPolicy):

    login_path = '/login'
    method = 'POST'

    def unauthenticated_userid(self, request):
        '''
        So basically this is used to do a login, instead of the actual
        login view... not sure why, but yeah..
        '''
        # we will cache it for the life of this request, cause pyramids does traversal
        cached = getattr(request, '_auth0_authenticated', _fake_user)
        if cached is not _fake_user:
            return cached

        # try to find the token in the request (should be in the header)
        id_token = get_jwt(request)
        if not id_token:
            # can I thrown an 403 here?
            # print('Missing assertion.', 'unauthenticated_userid', request)
            return None

        jwt_info = self.get_token_info(id_token, request)
        if not jwt_info:
            return None

        email = request._auth0_authenticated = jwt_info['email'].lower()

        # At this point, email has been authenticated with their Auth0 provider, but we don't know yet if this email is in our database.
        # If not authenticated (not in our DB), request.user_info will throw an HTTPUnauthorized error.

        # Allow access basic user credentials from request obj after authenticating & saving request
        def get_user_info(request):
            user_props = request.embed('/session-properties', as_user=email) # Performs an authentication against DB for user.
            if not user_props.get('details'):
                raise HTTPUnauthorized(
                    title="Could not find user info for {}".format(email),
                    headers={'WWW-Authenticate': "Bearer realm=\"{}\"; Basic realm=\"{}\"".format(request.domain, request.domain) }
                )
            user_props['id_token'] = id_token
            return user_props

        request.set_property(get_user_info, "user_info", True)
        return email

    @staticmethod
    def email_is_partners_or_hms(payload):
        """
        Checks that the given JWT payload belongs to a partners email.
        """
        for identity in payload.get('identities', []): # if auth0 decoded
            if identity.get('connection', '') in ['partners', 'hms-it']:
                return True
        if 'partners' in payload.get('sub', ''):
            return True
        elif 'hms.harvard' in payload.get('sub', ''):
            return True
        elif payload.get('email_verified'):
            return True
        else:
            return False

    def get_token_info(self, token, request):
        '''
        Given a jwt get token info from auth0, handle retrying and whatnot.
        This is only called if we receive a Bearer token in Authorization header.
        '''
        try:

            # lets see if we have an auth0 token or our own
            registry = request.registry
            auth0_client = registry.settings.get('auth0.client')
            auth0_secret = registry.settings.get('auth0.secret')
            if auth0_client and auth0_secret:
                # leeway accounts for clock drift between us and auth0
                payload = jwt.decode(token, b64decode(auth0_secret, '-_'),
                                     # algorithms=JWT_DECODING_ALGORITHMS
                                     audience=auth0_client, leeway=30)
                if 'email' in payload and self.email_is_partners_or_hms(payload):
                    request.set_property(lambda r: False, 'auth0_expired')
                    return payload

            else: # we don't have the key, let auth0 do the work for us
                user_url = "https://{domain}/tokeninfo".format(domain='hms-dbmi.auth0.com')
                resp  = requests.post(user_url, {'id_token':token})
                payload = resp.json()
                if 'email' in payload and self.email_is_partners_or_hms(payload):
                    request.set_property(lambda r: False, 'auth0_expired')
                    return payload

        except (ValueError, jwt.exceptions.InvalidTokenError, jwt.exceptions.InvalidKeyError) as e:
            # Catch errors from decoding JWT
            print('Invalid JWT assertion : %s (%s)', (e, type(e).__name__))
            request.set_property(lambda r: True, 'auth0_expired') # Allow us to return 403 code &or unset cookie in renderers.py
            return None

        print("didn't get email or email is not verified")
        return None


def get_jwt(request):
    token = None
    try:
        # ensure this is a jwt token not basic auth:
        auth_type = request.headers['Authorization'][:6]
        if auth_type.strip().lower() == 'bearer':
            token = request.headers['Authorization'][7:]
    except (ValueError, TypeError, KeyError):
        pass

    if not token and request.method in ('GET', 'HEAD'):
        # Only grab this if is a GET request, not a transactional request to help mitigate CSRF attacks.
        # See: https://en.wikipedia.org/wiki/Cross-site_request_forgery#Cookie-to-header_token
        # The way our JS grabs and sticks JWT into Authorization header is somewhat analogous to above approach.
        # TODO: Ensure our `Access-Control-Allow-Origin` response headers are appropriate (more for CGAP).
        # TODO: Get a security audit done.
        token = request.cookies.get('jwtToken')

    return token


@view_config(route_name='login', request_method='POST',
             permission=NO_PERMISSION_REQUIRED)
@debug_log
def login(context, request):
    '''
    Check the auth0 assertion and return User Information to be stored client-side
    user_info comes from /session-properties and other places and would contain ultimately:
        { id_token: string, user_actions : string[], details : { uuid, email, first_name, last_name, groups, timezone, status } }
    '''
    user_info = getattr(request, 'user_info', None)
    if user_info and user_info.get('id_token'): # Authenticated
        return user_info

    raise LoginDenied(domain=request.domain)


@view_config(route_name='logout',
             permission=NO_PERMISSION_REQUIRED, http_cache=0)
@debug_log
def logout(context, request):
    """
    This endpoint proxies a request to Auth0 for it to remove its session cookies.
    See https://auth0.com/docs/api/authentication#enterprise-saml-and-others-

    The Auth0 endpoint is meant to be navigated to by end-user as part of SSO logout (?)
    So this endpoint may not be needed at moment. Kept for reference.

    The front-end handles logging out by discarding the locally-held JWT from
    browser cookies and re-requesting the current 4DN URL.
    """
    #request.session.invalidate()
    #request.response.headerlist.extend(forget(request))

    # call auth0 to logout
    auth0_logout_url = "https://{domain}/v2/logout" \
                .format(domain='hms-dbmi.auth0.com')

    requests.get(auth0_logout_url)

    if asbool(request.params.get('redirect', True)):
        raise HTTPFound(location=request.resource_path(request.root))

    return {}


@view_config(route_name='me', request_method='GET', permission=NO_PERMISSION_REQUIRED)
@debug_log
def me(context, request):
    '''Alias /users/<uuid-of-current-user>'''
    for principal in request.effective_principals:
        if principal.startswith('userid.'):
            break
    else:
        raise HTTPForbidden(title="Not logged in.")

    namespace, userid = principal.split('.', 1)

    # return { "uuid" : userid } # Uncomment and delete below code to just grab UUID.

    request.response.status_code = 307 # Prevent from creating 301 redirects which are then cached permanently by browser
    properties = request.embed('/users/' + userid, as_user=userid)
    return properties


def get_basic_properties_for_user(request, userid):
    user = request.registry[COLLECTIONS]['user'][userid]
    user_dict = user.__json__(request)

    # Only include certain/applicable fields from profile
    include_detail_fields = ['email', 'first_name', 'last_name', 'groups', 'timezone', 'status']
    user_actions = calculate_properties(user, request, category='user_action')

    properties = {
        #'user': request.embed(request.resource_path(user)),
        'details' : { p:v for p, v in user_dict.items() if p in include_detail_fields },
        'user_actions' : [ v for k, v in sorted(user_actions.items(), key=itemgetter(0)) ]
    }

    # add uuid to user details
    properties['details']['uuid'] = userid

    return properties


@view_config(route_name='session-properties', request_method='GET',
             permission=NO_PERMISSION_REQUIRED)
@debug_log
def session_properties(context, request):
    for principal in request.effective_principals:
        if principal.startswith('userid.'):
            break
    else:
        return {}

    namespace, userid = principal.split('.', 1)
    properties = get_basic_properties_for_user(request, userid)

    #if 'auth.userid' in request.session:
    #    properties['auth.userid'] = request.session['auth.userid']

    return properties


def basic_auth_check(username, password, request):
    # We may get called before the context is found and the root set
    root = request.registry[ROOT]
    collection = root['access-keys']
    try:
        access_key = collection[username]
    except KeyError:
        return None

    properties = access_key.properties
    hash = properties['secret_access_key_hash']

    crypt_context = request.registry[CRYPT_CONTEXT]
    valid = crypt_context.verify(password, hash)
    if not valid:
        return None

    #valid, new_hash = crypt_context.verify_and_update(password, hash)
    #if new_hash:
    #    replace_user_hash(user, new_hash)

    return []


@view_config(route_name='impersonate-user', request_method='POST',
             validators=[no_validate_item_content_post],
             permission='impersonate')
@debug_log
def impersonate_user(context, request):
    """As an admin, impersonate a different user."""

    userid = request.validated['userid']
    users = request.registry[COLLECTIONS]['user']

    try:
        user = users[userid]
    except KeyError:
        raise ValidationFailure('body', ['userid'], 'User not found.')

    if user.properties.get('status') != 'current':
        raise ValidationFailure('body', ['userid'], 'User is not enabled.')

    user_properties = get_basic_properties_for_user(request, userid)
    # pop off impersonate user action if not admin
    user_properties['user_actions'] = [x for x in user_properties['user_actions'] if (x['id'] and x['id'] != 'impersonate')]
    # make a key
    registry = request.registry
    auth0_client = registry.settings.get('auth0.client')
    auth0_secret = registry.settings.get('auth0.secret')
    if not(auth0_client and auth0_secret):
        raise HTTPForbidden(title="No keys to impersonate user")

    jwt_contents = {
        'email': userid,
        'email_verified': True,
        'aud': auth0_client,
    }

    id_token = jwt.encode(jwt_contents, b64decode(auth0_secret, '-_'),
                          algorithm=JWT_ENCODING_ALGORITHM
						  )
    user_properties['id_token'] = id_token.decode('utf-8')

    return user_properties


def generate_user():
    """ Generate a random user name with 64 bits of entropy
        Used to generate access_key
    """
    # Take a random 5 char binary string (80 bits of
    # entropy) and encode it as upper cased base32 (8 chars)
    random_bytes = os.urandom(5)
    user = base64.b32encode(random_bytes).decode('ascii').rstrip('=').upper()
    return user


def generate_password():
    """ Generate a password with 80 bits of entropy
    """
    # Take a random 10 char binary string (80 bits of
    # entropy) and encode it as lower cased base32 (16 chars)
    random_bytes = os.urandom(10)
    password = base64.b32encode(random_bytes).decode('ascii').rstrip('=').lower()
    return password


@view_config(route_name='create-unauthorized-user', request_method='POST',
             permission=NO_PERMISSION_REQUIRED)
@debug_log
def create_unauthorized_user(context, request):
    """
    Endpoint to create an unauthorized user, which will have no institution/project.
    Requires a reCAPTCHA response, which is propogated from the front end
    registration form. This is so the endpoint cannot be abused.
    Given a user properties in the request body, will validate those and also
    validate the reCAPTCHA response using the reCAPTCHA server. If all checks
    are succesful, POST a new user

    Args:
        request: Request object

    Returns:
        dictionary User creation response from collection_add

    Raises:
        LoginDenied, HTTPForbidden, or ValidationFailure
    """
    recaptcha_resp = request.json.get('g-recaptcha-response')
    if not recaptcha_resp:
        raise LoginDenied()

    email = request._auth0_authenticated  # equal to: jwt_info['email'].lower()
    user_props = request.json
    user_props_email = user_props.get("email", "<no e-mail supplied>").lower()
    if user_props_email != email:
        raise HTTPUnauthorized(
            title="Provided email {} not validated with Auth0. Try logging in again.".format(user_props_email),
            headers={'WWW-Authenticate': "Bearer realm=\"{}\"; Basic realm=\"{}\"".format(request.domain, request.domain) }
        )

    del user_props['g-recaptcha-response']
    user_props['was_unauthorized'] = True
    user_props['email'] = user_props_email  # lowercased
    user_coll = request.registry[COLLECTIONS]['User']
    request.remote_user = 'EMBED'  # permission = import_items

    # validate the User json
    validate_request(user_coll.type_info.schema, request, user_props)
    if request.errors:
        raise ValidationFailure('body', 'create_unauthorized_user', 'Cannot validate request')

    # validate recaptcha_resp
    # https://developers.google.com/recaptcha/docs/verify
    recap_url = 'https://www.google.com/recaptcha/api/siteverify'
    recap_values = {
        'secret': request.registry.settings['g.recaptcha.secret'],
        'response': recaptcha_resp
    }
    data = urlencode(recap_values).encode()
    headers = {"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"}
    recap_res =  requests.get(recap_url, params=data, headers=headers).json()

    if recap_res['success']:
        sno_res = sno_collection_add(user_coll, request, False)  # POST User
        if sno_res.get('status') == 'success':
            return sno_res
        else:
            raise HTTPForbidden(title="Could not create user. Try logging in again.")
    else:
        # error with re-captcha
        raise HTTPUnauthorized(
            title="Invalid reCAPTCHA. Try logging in again.",
            headers={'WWW-Authenticate': "Bearer realm=\"{}\"; Basic realm=\"{}\"".format(request.domain, request.domain) }
        )
