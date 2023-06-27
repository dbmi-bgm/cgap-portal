from dcicutils.misc_utils import ignored
from jsonschema_serialize_fork import NO_DEFAULT
from snovault.schema_utils import server_default
from snovault.server_defaults import (  # noqa: F401 (imported but unused)
    add_last_modified,
    enc_accession,
    get_now,
    get_userid,
    get_user_resource,
    test_accession
)


ACCESSION_FACTORY = __name__ + ':accession_factory'
ACCESSION_PREFIX = 'GAP'
ACCESSION_TEST_PREFIX = 'TST'


@server_default
def userproject(instance, subschema):
    ignored(instance, subschema)
    user = get_user_resource()
    if user == NO_DEFAULT:
        return NO_DEFAULT
    project_roles = user.properties.get("project_roles", [])
    if len(project_roles) > 0:
        return project_roles[0]["project"]
    return NO_DEFAULT


@server_default
def userinstitution(instance, subschema):
    ignored(instance, subschema)
    user = get_user_resource()
    if user == NO_DEFAULT:
        return NO_DEFAULT
    return user.properties.get("user_institution", NO_DEFAULT)
