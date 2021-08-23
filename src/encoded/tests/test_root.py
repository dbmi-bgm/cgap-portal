import pytest

from dcicutils import lang_utils
from dcicutils.misc_utils import ignored
from dcicutils.s3_utils import s3Utils
from unittest import mock
from ..root import HealthPageKey, uptime_info


pytestmark = [pytest.mark.setone, pytest.mark.working]


def test_uptime_info():

    with mock.patch("uptime.uptime", return_value=65 * 60):
        assert uptime_info() == "1 hour, 5 minutes"

    def fail(*args, **kwargs):
        ignored(args, kwargs)
        raise RuntimeError("Failure")

    with mock.patch("uptime.uptime", side_effect=fail):
        assert uptime_info() == "unavailable"

    with mock.patch.object(lang_utils, "relative_time_string", fail):
        assert uptime_info() == "unavailable"


def test_health_page_view_constants():

    assert HealthPageKey.BLOB_BUCKET == 'blob_bucket' == s3Utils.BLOB_BUCKET_HEALTH_PAGE_KEY
    assert HealthPageKey.FILE_UPLOAD_BUCKET == 'file_upload_bucket' == s3Utils.RAW_BUCKET_HEALTH_PAGE_KEY
    assert HealthPageKey.METADATA_BUNDLES_BUCKET == 'metadata_bundles_bucket' == s3Utils.METADATA_BUCKET_HEALTH_PAGE_KEY
    assert HealthPageKey.PROCESSED_FILE_BUCKET == 'processed_file_bucket' == s3Utils.OUTFILE_BUCKET_HEALTH_PAGE_KEY
    assert HealthPageKey.SYSTEM_BUCKET == 'system_bucket' == s3Utils.SYS_BUCKET_HEALTH_PAGE_KEY
    assert HealthPageKey.TIBANNA_OUTPUT_BUCKET == 'tibanna_output_bucket' == s3Utils.TIBANNA_OUTPUT_BUCKET_HEALTH_PAGE_KEY
