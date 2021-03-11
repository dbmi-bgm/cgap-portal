import datetime
import logging
import pkg_resources
import re

from elasticsearch.exceptions import NotFoundError
from dcicutils.misc_utils import (
    environ_bool, PRINT, camel_case_to_snake_case, check_true, ignored, full_class_name,
    ignorable, ancestor_classes, decorator
)
from dcicutils.snapshot_utils import ElasticSearchDataCache, es_data_cache
from ..loadxl import load_all


def load_inserts(es_testapp, inserts_name):

    # Presently we do not use the cls.indexer_namespace, but it might be nice to optimize later
    # by saving only those prefixes.
    load_res = load_all(es_testapp,
                        pkg_resources.resource_filename('encoded', 'tests/data/%s-inserts/' % inserts_name),
                        [])

    # Note: load_all returns None for success or an Exception on failure.
    if isinstance(load_res, Exception):
        raise load_res
    elif load_res:
        raise RuntimeError("load_all returned a true value that was not an exception.")


@es_data_cache
class WorkbookCache(ElasticSearchDataCache):

    @classmethod
    def load_additional_data(cls, es_testapp, other_data=None):
        check_true(not other_data, "other_data not allowed")
        load_inserts(es_testapp, inserts_name='workbook')


@es_data_cache
class PersonasCache(WorkbookCache):

    @classmethod
    def load_additional_data(cls, es_testapp, other_data=None):
        check_true(not other_data, "other_data not allowed")
        load_inserts(es_testapp, inserts_name='personas')


@es_data_cache(is_abstract=True)
class ExtendedWorkbookCache(WorkbookCache):

    ABSTRACT_CACHE = True

    EXTENDED_DATA = {}

    @classmethod
    def load_additional_data(cls, es_testapp, other_data=None):
        check_true(not other_data, "data not allowed")
        for item_type, items in cls.EXTENDED_DATA.items():
            for item in items:
                es_testapp.post_json("/" + item_type, item, status=201)
