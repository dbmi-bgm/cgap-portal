"""
common.py - tools common to various parts of ingestion
"""

from snovault import (
    BadParameter,
    IngestionError,
    IngestionReport,
    MissingParameter,
    CONTENT_TYPE_SPECIAL_CASES,
    content_type_allowed,
    get_parameter,
    metadata_bundles_bucket,
    register_path_content_type
)


# Guaranteed to exist
CGAP_CORE_PROJECT = '/projects/cgap-core'
CGAP_CORE_INSTITUTION = '/institutions/hms-dbmi/'

# NOT guaranteed to exist, but we need to know about it
CGAP_TRAINING_PROJECT = '/projects/cgap-training'
