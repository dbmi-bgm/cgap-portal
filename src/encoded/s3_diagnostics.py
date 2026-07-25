"""Opt-in, secret-safe diagnostics for the Genelist S3 client boundary.

This module is intentionally gated by ``CGAP_S3_DIAGNOSTICS`` and should be
removed once the CI credential-path failure is understood. It only reports
credential metadata (booleans and provider labels), never credential values.
"""

import os
import re
from functools import wraps
from importlib import import_module
from typing import Mapping, Optional

import structlog


log = structlog.getLogger(__name__)

DIAGNOSTICS_ENV = "CGAP_S3_DIAGNOSTICS"
ROLE_ENV_KEYS = ("S3_UPLOAD_ROLE_ARN", "AWS_ROLE_ARN")
OIDC_ENV_KEYS = (
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_WEB_IDENTITY_TOKEN_FILE",
    "AWS_ROLE_ARN",
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
    "S3_UPLOAD_ROLE_ARN",
)

_SAFE_ROLE_NAME = re.compile(r"[^A-Za-z0-9_.+=,@-]")
_KNOWN_PROVIDER_METHODS = {
    "assume-role",
    "assume-role-with-web-identity",
    "boto-config",
    "config-file",
    "container-role",
    "credential_process",
    "env",
    "explicit",
    "iam-role",
    "instance-role",
    "shared-credentials-file",
    "sso",
}


def diagnostics_enabled(environ: Optional[Mapping[str, str]] = None) -> bool:
    """Return whether the explicitly opt-in CI diagnostic path is enabled."""

    environment = os.environ if environ is None else environ
    return environment.get(DIAGNOSTICS_ENV, "").strip().lower() in {
        "1",
        "true",
        "yes",
    }


def _credential_object(client):
    """Read the botocore signer credential object without representing it."""

    request_signer = getattr(client, "_request_signer", None)
    return getattr(request_signer, "_credentials", None)


def _safe_provider_method(credentials) -> str:
    method = getattr(credentials, "method", None)
    if isinstance(method, str) and method in _KNOWN_PROVIDER_METHODS:
        return method
    return "unavailable"


def _safe_role_name(role_arn) -> Optional[str]:
    """Return only the final, sanitized role-name component of an ARN."""

    if not isinstance(role_arn, str) or not role_arn:
        return None
    role_name = role_arn.rsplit("/", 1)[-1]
    if not role_name:
        return None
    return _SAFE_ROLE_NAME.sub("_", role_name)[:64]


def credential_metadata(
    client, environ: Optional[Mapping[str, str]] = None
) -> dict:
    """Build log-safe metadata for a boto3 client.

    The credential object is used only for its provider method and presence
    checks. Access-key, secret, and session-token values are never returned.
    """

    environment = os.environ if environ is None else environ
    credentials = _credential_object(client)
    session_token = getattr(credentials, "token", None)
    if session_token is None:
        session_token = getattr(credentials, "session_token", None)

    role_arn = next(
        (environment.get(key) for key in ROLE_ENV_KEYS if environment.get(key)),
        None,
    )
    return {
        "provider_method": _safe_provider_method(credentials),
        "credential_fields_present": {
            "access_key": bool(getattr(credentials, "access_key", None)),
            "secret_key": bool(getattr(credentials, "secret_key", None)),
            "session_token": bool(session_token),
        },
        "expected_oidc_environment_present": {
            key: bool(environment.get(key)) for key in OIDC_ENV_KEYS
        },
        "role_name": _safe_role_name(role_arn),
    }


def log_genelist_s3_client_diagnostics(
    client,
    environ: Optional[Mapping[str, str]] = None,
    logger=log,
    boundary="snovault.SubmissionFolio.s3_client",
) -> bool:
    """Emit opt-in, secret-safe metadata at the Genelist S3 client boundary."""

    if not diagnostics_enabled(environ):
        return False

    logger.warning(
        "cgap_s3_client_diagnostics",
        boundary=boundary,
        **credential_metadata(client, environ=environ),
    )
    return True


def install_snovault_ingestion_s3_diagnostics(
    ingestion_module=None,
    environ: Optional[Mapping[str, str]] = None,
    logger=log,
) -> bool:
    """Wrap Snovault's ingestion client factory only for the opt-in CI path."""

    if not diagnostics_enabled(environ):
        return False

    ingestion_module = ingestion_module or import_module(
        "snovault.ingestion.ingestion_listener"
    )
    original = ingestion_module.make_s3_client
    if getattr(original, "_cgap_s3_diagnostics", False) is True:
        return False

    @wraps(original)
    def make_s3_client_with_diagnostics(*args, **kwargs):
        client = original(*args, **kwargs)
        log_genelist_s3_client_diagnostics(
            client,
            environ=environ,
            logger=logger,
            boundary="snovault.ingestion.ingestion_listener.make_s3_client",
        )
        return client

    make_s3_client_with_diagnostics._cgap_s3_diagnostics = True
    ingestion_module.make_s3_client = make_s3_client_with_diagnostics
    return True
