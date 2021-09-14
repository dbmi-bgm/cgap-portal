import glob
import io
import os
import pkg_resources
import pytest

from dcicutils import lang_utils
from dcicutils.lang_utils import conjoined_list
from dcicutils.misc_utils import ignored
from dcicutils.s3_utils import s3Utils
from unittest import mock
from ..root import HealthPageKey, SettingsKey, uptime_info

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

    h = HealthPageKey

    assert h.BLOB_BUCKET == 'blob_bucket' == s3Utils.BLOB_BUCKET_HEALTH_PAGE_KEY
    assert h.FILE_UPLOAD_BUCKET == 'file_upload_bucket' == s3Utils.RAW_BUCKET_HEALTH_PAGE_KEY
    assert h.METADATA_BUNDLES_BUCKET == 'metadata_bundles_bucket' == s3Utils.METADATA_BUCKET_HEALTH_PAGE_KEY
    assert h.PROCESSED_FILE_BUCKET == 'processed_file_bucket' == s3Utils.OUTFILE_BUCKET_HEALTH_PAGE_KEY
    assert h.SYSTEM_BUCKET == 'system_bucket' == s3Utils.SYS_BUCKET_HEALTH_PAGE_KEY
    assert h.TIBANNA_OUTPUT_BUCKET == 'tibanna_output_bucket' == s3Utils.TIBANNA_OUTPUT_BUCKET_HEALTH_PAGE_KEY
    assert h.TIBANNA_CWLS_BUCKET == 'tibanna_cwls_bucket'  # == s3Utils.TIBANNA_OUTPUT_BUCKET_HEALTH_PAGE_KEY


def test_registry_settings_in_orchestrated_ini_template():

    # This will check that every setting in SettingsKey (used on the health page) is actually in the ini files
    # we're going to use at least under orchestration.

    alpha_any_ini = os.path.abspath(
        pkg_resources.resource_filename("encoded",
                                        # The resource will start at src/encoded so has to work up.
                                        "../../deploy/docker/production/cgap_any_alpha.ini"))
    verify_settings_keys_in_ini(alpha_any_ini, is_legacy=False)


def test_registry_settings_in_legacy_ini_template():

    # This will check that every setting in SettingsKey (used on the health page) is actually in the ini files
    # we use for beanstalks

    for legacy_ini in glob.glob(
        os.path.abspath(
            pkg_resources.resource_filename("encoded",
                                            # The resource will start at src/encoded so has to work up.
                                            "../../deploy/ini_files/*.ini"))):
        verify_settings_keys_in_ini(legacy_ini, is_legacy=True)


SETTINGS_NOT_REQUIRED_IN_ORCHESTRATED_INI = {
    # None?
}

SETTINGS_NOT_REQUIRED_IN_LEGACY_INI = {
    SettingsKey.APPLICATION_BUCKET_PREFIX,
    SettingsKey.FOURSIGHT_BUCKET_PREFIX,
}


def verify_settings_keys_in_ini(file, is_legacy):

    key_counts = {}
    for k, v in SettingsKey.__dict__.items():
        if k[0].isupper():  # Names starting with an uppercase alphabetic are of interest to us
            key_counts[v] = 0
    print(f"Processing {file} ...")
    with io.open(file, 'r') as fp:
        for raw_line in fp:
            line = raw_line.lstrip()
            if line[:1] != '#' and '=' in line:
                var = line.split('=', 1)[0].strip()
                if var:
                    if var in key_counts:
                        print(f"Found '{var}=' in cgap_any_alpha.ini.")
                        key_counts[var] += 1
        warn_not_set = set()
        optional_attributes = (SETTINGS_NOT_REQUIRED_IN_LEGACY_INI
                               if is_legacy else
                               SETTINGS_NOT_REQUIRED_IN_ORCHESTRATED_INI)
        for k, v in key_counts.items():
            if v == 0 and k not in optional_attributes:
                warn_not_set.add(k)
        if warn_not_set:
            n = len(warn_not_set)
            options = 'option' if n == 1 else 'options'
            ini_kind = 'legacy' if is_legacy else 'orchestrated'
            raise AssertionError(f"The {ini_kind} ini file {file[file.index('deploy/'):]} does not set"
                                 f" {options} {conjoined_list(sorted(warn_not_set))}.")
