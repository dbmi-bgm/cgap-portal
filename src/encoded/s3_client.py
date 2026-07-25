"""CGAP S3 client wiring for credential-managed S3 operations."""

from functools import wraps
from importlib import import_module


def install_snovault_s3_client(util_module=None):
    """Use CGAP's session-aware client for Snovault S3 operations."""

    util_module = util_module or import_module("snovault.util")
    original = util_module.make_s3_client
    if getattr(original, "_cgap_s3_session_client", False) is True:
        return False

    @wraps(original)
    def make_s3_client_with_session_credentials(*args, **kwargs):
        from .types.file import make_s3_upload_client

        return make_s3_upload_client(role_session_name="cgap-s3-client")

    make_s3_client_with_session_credentials._cgap_s3_session_client = True
    util_module.make_s3_client = make_s3_client_with_session_credentials
    return True


def install_snovault_ingestion_s3_client(ingestion_module=None):
    """Use CGAP's session-aware upload client for Snovault ingestion uploads."""

    ingestion_module = ingestion_module or import_module(
        "snovault.ingestion.ingestion_listener"
    )
    original = ingestion_module.make_s3_client
    if (
        getattr(original, "_cgap_s3_upload_client", False) is True
        or getattr(original, "_cgap_s3_session_client", False) is True
    ):
        return False

    @wraps(original)
    def make_s3_client_with_upload_credentials(*args, **kwargs):
        from .types.file import make_s3_upload_client

        return make_s3_upload_client()

    make_s3_client_with_upload_credentials._cgap_s3_upload_client = True
    ingestion_module.make_s3_client = make_s3_client_with_upload_credentials
    return True
