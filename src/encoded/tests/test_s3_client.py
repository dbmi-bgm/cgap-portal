from types import SimpleNamespace
from unittest.mock import Mock, patch

from ..s3_client import (
    install_snovault_ingestion_s3_client,
    install_snovault_s3_client,
)


def test_snovault_ingestion_uses_cgap_upload_client_once():
    original = Mock()
    client = object()
    ingestion_module = SimpleNamespace(make_s3_client=original)

    with patch('encoded.types.file.make_s3_upload_client', return_value=client) as factory:
        assert install_snovault_ingestion_s3_client(ingestion_module)
        assert ingestion_module.make_s3_client() is client
        assert not install_snovault_ingestion_s3_client(ingestion_module)

    factory.assert_called_once_with()
    original.assert_not_called()


def test_snovault_shared_presign_uses_cgap_session_client(monkeypatch):
    import snovault.util as snovault_util

    original = snovault_util.make_s3_client
    client = Mock()
    client.generate_presigned_url.return_value = "presigned-url"
    monkeypatch.setattr(snovault_util, "make_s3_client", original)

    with patch('encoded.types.file.make_s3_upload_client', return_value=client) as factory:
        assert install_snovault_s3_client(snovault_util)
        assert snovault_util.build_s3_presigned_get_url(
            params={'Bucket': 'test-bucket', 'Key': 'test-key'}
        ) == "presigned-url"

    factory.assert_called_once_with(role_session_name="cgap-s3-client")
    client.generate_presigned_url.assert_called_once_with(
        ClientMethod='get_object',
        Params={'Bucket': 'test-bucket', 'Key': 'test-key'},
        ExpiresIn=36 * 60 * 60,
    )


def test_snovault_ingestion_client_does_not_wrap_shared_client():
    shared_client = Mock()
    shared_client._cgap_s3_session_client = True
    ingestion_module = SimpleNamespace(make_s3_client=shared_client)

    assert not install_snovault_ingestion_s3_client(ingestion_module)
    assert ingestion_module.make_s3_client is shared_client
