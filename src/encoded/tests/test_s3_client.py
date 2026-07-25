from types import SimpleNamespace
from unittest.mock import Mock, patch

from ..s3_client import install_snovault_ingestion_s3_client


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
