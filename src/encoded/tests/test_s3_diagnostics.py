from types import SimpleNamespace
from unittest.mock import Mock

from ..s3_diagnostics import (
    credential_metadata,
    install_snovault_ingestion_s3_diagnostics,
    log_genelist_s3_client_diagnostics,
)


SENSITIVE_VALUES = {
    "access-key-value",
    "secret-key-value",
    "session-token-value",
}


def make_client():
    credentials = SimpleNamespace(
        method="assume-role",
        access_key="access-key-value",
        secret_key="secret-key-value",
        token="session-token-value",
    )
    return SimpleNamespace(
        _request_signer=SimpleNamespace(_credentials=credentials)
    )


def test_credential_metadata_is_secret_safe():
    environment = {
        "S3_UPLOAD_ROLE_ARN": "arn:aws:iam::123456789012:role/cgap/ci-role",
        "AWS_ACCESS_KEY_ID": "access-key-value",
        "AWS_SECRET_ACCESS_KEY": "secret-key-value",
        "AWS_SESSION_TOKEN": "session-token-value",
        "AWS_REGION": "us-east-1",
    }

    metadata = credential_metadata(make_client(), environ=environment)

    assert metadata["provider_method"] == "assume-role"
    assert metadata["credential_fields_present"] == {
        "access_key": True,
        "secret_key": True,
        "session_token": True,
    }
    assert metadata["expected_oidc_environment_present"]["S3_UPLOAD_ROLE_ARN"]
    assert metadata["expected_oidc_environment_present"]["AWS_SESSION_TOKEN"]
    assert metadata["role_name"] == "ci-role"
    assert all(value not in repr(metadata) for value in SENSITIVE_VALUES)
    assert "arn:aws:iam" not in repr(metadata)


def test_genelist_diagnostics_are_disabled_by_default():
    logger = Mock()

    assert not log_genelist_s3_client_diagnostics(
        make_client(), environ={}, logger=logger
    )
    logger.warning.assert_not_called()


def test_genelist_diagnostics_log_only_safe_metadata():
    logger = Mock()
    environment = {
        "CGAP_S3_DIAGNOSTICS": "1",
        "S3_UPLOAD_ROLE_ARN": "arn:aws:iam::123456789012:role/ci-role",
    }

    assert log_genelist_s3_client_diagnostics(
        make_client(), environ=environment, logger=logger
    )

    event, metadata = logger.warning.call_args.args[0], logger.warning.call_args.kwargs
    assert event == "cgap_s3_client_diagnostics"
    assert metadata["boundary"] == "snovault.SubmissionFolio.s3_client"
    assert metadata["provider_method"] == "assume-role"
    assert all(value not in repr(logger.warning.call_args) for value in SENSITIVE_VALUES)


def test_snovault_factory_diagnostics_are_opt_in_and_wrap_once():
    logger = Mock()
    client = make_client()
    factory = Mock(return_value=client)
    ingestion_module = SimpleNamespace(make_s3_client=factory)

    assert not install_snovault_ingestion_s3_diagnostics(
        ingestion_module=ingestion_module, environ={}, logger=logger
    )
    assert ingestion_module.make_s3_client is factory

    assert install_snovault_ingestion_s3_diagnostics(
        ingestion_module=ingestion_module,
        environ={"CGAP_S3_DIAGNOSTICS": "true"},
        logger=logger,
    )
    assert not install_snovault_ingestion_s3_diagnostics(
        ingestion_module=ingestion_module,
        environ={"CGAP_S3_DIAGNOSTICS": "true"},
        logger=logger,
    )

    assert ingestion_module.make_s3_client() is client
    assert factory.call_count == 1
    metadata = logger.warning.call_args.kwargs
    assert metadata["boundary"] == (
        "snovault.ingestion.ingestion_listener.make_s3_client"
    )
    assert all(value not in repr(logger.warning.call_args) for value in SENSITIVE_VALUES)
