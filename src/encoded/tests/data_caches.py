import datetime
import logging
import pkg_resources
import re

from elasticsearch.exceptions import NotFoundError
from dcicutils.misc_utils import (
    environ_bool, PRINT, camel_case_to_snake_case, check_true, ignored, full_class_name,
    ignorable, ancestor_classes, decorator
)
from ..loadxl import load_all


# When this is more stable/trusted, we might want to remove this.
# But I'd rather not be adding/removing instrumentation as I'm debugging it. -kmp 11-Feb-2021
DEBUG_WORKBOOK_CACHE = environ_bool("DEBUG_WORKBOOK_CACHE", default=False)


# TODO: Move later to dcicutils
def is_valid_indexer_namespace(indexer_namespace, allow_null=False):
    """
    Returns true if its argument is a valid indexer namespace.

    For non-shared resources, the null string is an allowed namespace.
    For all shared resources, a string ending in a digit is required.

    This test allows these formats:

    kind                      examples (not necessarily exhaustive)
    ----                      -------------------------------------
    travis or github job id   123456
    any guid                  c978d7ab-e970-417b-8cb1-4516546e6ced
    a timestamp               20211202123456, 2021-12-02T12:34:56, or 2021-12-02T12:34:56.0000
    any above with a prefix   4dn-20211202123456, sno-20211202123456, cgap-20211202123456, ff-20211202123456
    """
    if indexer_namespace == "":
        # Allow the empty string only in production situations
        return True if allow_null else False
    if not isinstance(indexer_namespace, str):
        # Non-strings (including None) are not indexer_namespaces
        return False
    # At this point we know we have a non-empty string, so check that last 4 characters match of one of our options.
    return len(indexer_namespace) >= 4


# TODO: Move later to dcicutils.es_utils
def snapshot_exists(es_testapp, repository_short_name, snapshot_name):
    es = es_testapp.app.registry['elasticsearch']
    try:
        return bool(es.snapshot.get(repository=repository_short_name, snapshot=snapshot_name))
    except NotFoundError:
        return False


# TODO: Move later to dcicutils.es_utils
def create_workbook_snapshot(es_testapp, snapshots_repository_location, repository_short_name, snapshot_name):
    if snapshot_exists(es_testapp, repository_short_name, snapshot_name):
        return
    es = es_testapp.app.registry['elasticsearch']
    try:

        if DEBUG_WORKBOOK_CACHE:
            PRINT("Creating snapshot repo", repository_short_name, "at", snapshots_repository_location)
        repo_creation_result = es.snapshot.create_repository(repository_short_name,
                                                             {
                                                                 "type": "fs",
                                                                 "settings": {
                                                                     "location": snapshots_repository_location,
                                                                 }
                                                             })
        assert repo_creation_result == {'acknowledged': True}
        if DEBUG_WORKBOOK_CACHE:
            PRINT("Creating snapshot", repository_short_name)
        snapshot_creation_result = es.snapshot.create(repository=repository_short_name,
                                                      snapshot=snapshot_name,
                                                      wait_for_completion=True)
        assert snapshot_creation_result.get('snapshot', {}).get('snapshot') == snapshot_name
    except Exception as e:
        logging.error(str(e))
        if DEBUG_WORKBOOK_CACHE:
            import pdb
            pdb.set_trace()
        raise


# TODO: Move later to dcicutils.es_utils
def restore_workbook_snapshot(es_testapp, indexer_namespace, repository_short_name, snapshot_name=None,
                              require_indexer_namespace=True):
    es = es_testapp.app.registry['elasticsearch']
    try:
        if require_indexer_namespace:
            if not indexer_namespace or not is_valid_indexer_namespace(indexer_namespace):
                raise RuntimeError("restore_workbook_snapshot requires an indexer namespace prefix (got %r)."
                                   " (You can use the indexer_namespace fixture to acquire it.)"
                                   % (indexer_namespace,))

        all_index_info = [info['index'] for info in es.cat.indices(format='json')]
        index_names = [name for name in all_index_info if name.startswith(indexer_namespace)]
        if index_names:
            index_names_string = ",".join(index_names)
            if DEBUG_WORKBOOK_CACHE:
                # PRINT("Deleting index files", index_names_string)
                PRINT("Deleting index files for prefix=", indexer_namespace)
            result = es.indices.delete(index_names_string)
            if DEBUG_WORKBOOK_CACHE:
                ignorable(result)
                # PRINT("deletion result=", result)
                PRINT("Deleted index files for prefix=", indexer_namespace)
        result = es.snapshot.restore(repository=repository_short_name,
                                     snapshot=snapshot_name,
                                     wait_for_completion=True)
        # Need to find out what a successful result looks like
        if DEBUG_WORKBOOK_CACHE:
            ignorable(result)
            # PRINT("restore result=", result)
            PRINT("restored snapshot_name=", snapshot_name)
    except Exception as e:
        # Maybe should log somehow?
        logging.error(str(e))
        # Maybe should reset cls.done to False?
        if DEBUG_WORKBOOK_CACHE:
            import pdb
            pdb.set_trace()
        raise


class DataCacheInfo:
    REGISTERED_DATA_CACHES = set()
    ABSTRACT_DATA_CACHES = set()
    DATA_CACHE_BASE_CLASS = None


def is_data_cache(cls, allow_abstract=False):
    return cls in DataCacheInfo.REGISTERED_DATA_CACHES and (allow_abstract or _is_abstract_data_cache(cls))


def _is_abstract_data_cache(cls):
    return cls not in DataCacheInfo.ABSTRACT_DATA_CACHES


@decorator()
def es_data_cache(is_abstract=False, is_base=False):
    def _wrap_registered(cls):
        if is_base:
            if DataCacheInfo.DATA_CACHE_BASE_CLASS:
                raise RuntimeError("Attempt to declare %s with base=True, but %s has already been declared."
                                   % (full_class_name(cls), full_class_name(DataCacheInfo.DATA_CACHE_BASE_CLASS)))
            DataCacheInfo.DATA_CACHE_BASE_CLASS = cls
        elif not DataCacheInfo.DATA_CACHE_BASE_CLASS:
            raise RuntimeError("Attempt to use @data_cache decorator for the first time on %s, but is_base=%s."
                               % (full_class_name(cls), is_base))
        if not issubclass(cls, DataCacheInfo.DATA_CACHE_BASE_CLASS):
            raise SyntaxError("The data_cache class %s does not inherit, directly or indirectly, from %s."
                              % (cls.__name__, full_class_name(ElasticSearchDataCache)))
        DataCacheInfo.REGISTERED_DATA_CACHES.add(cls)
        if is_abstract:
            DataCacheInfo.ABSTRACT_DATA_CACHES.add(cls)
        return cls
    return _wrap_registered


# TODO: Move later to dcicutils.es_utils
@es_data_cache(is_abstract=True, is_base=True)
class ElasticSearchDataCache:
    """ Caches whether or not we have already provisioned a particular body of data. """

    WORKBOOK_SNAPSHOTS_INITIALIZED = {}

    repository_short_name = 'snapshots'
    snapshots_repository_location = None
    indexer_namespace = None

    @classmethod
    def assure_data_once_loaded(cls, es_testapp, datadir, indexer_namespace,
                                snapshot_name=None, other_data=None, level=0):
        """
        Initialize the data associated with a a snapshot if it has not already been done.

        DEPRECATION NOTICE: If initialization had already been done, this does NOT repeat it.
            It is possible that this was done and then the environment was later changed,
            for example in another test, and is not precisely what it was. This is how the orginal
            'workbook' fixture worked.  Fixtures of this kind are retained for compatibility
            with legacy testing. This entry point should generally be considered deprecated.

        :param es_testapp: an es_testapp fixture (providing an endpoint with admin access to test application with ES)
        :param datadir: the name of the temporary directory allocated for use of this test run
        :param indexer_namespace: the prefix string to be used on all ES index names
        :param snapshot_name: an optional snapshot name to override the default for special uses.
            The default value of None asks it be inferred from information declared as the snapshot_name class variable.
        :param other_data: a parameter passed through to the load_additional_data method if loading is needed.
            The nature of this data, if provided, depends on the class. The default value is None.
            (This can be useful if the load_additional_data method needs to receive fixture values.)
        :param level: This is used internally and should not be passed explicitly.  It helps with indentation
            and is used as a prefix when DEBUG_WORKBOOK_CACHE is True and is otherwise ignored.
        """
        if DEBUG_WORKBOOK_CACHE:
            if level == 0:
                PRINT()
            PRINT(level * "  ", level,
                  "Entering %s.assure_data_once_loaded at %s" % (cls.__name__, datetime.datetime.now()))
        cls.assure_data_loaded(es_testapp,
                               # Just pass these arguments through
                               datadir=datadir, indexer_namespace=indexer_namespace, snapshot_name=snapshot_name,
                               other_data=other_data,
                               level=level + 1,
                               # This is the important part, requesting deprecated legacy 'workbook' behavior,
                               # which presumed that after the first initialization, state would just stay
                               # initialized (or would be put explicitly back in order). We'll soon phase this out.
                               # -kmp 13-Feb-2021
                               only_on_first_call=True)
        if DEBUG_WORKBOOK_CACHE:
            PRINT(level * "  ", level,
                  "Exiting %s.assure_data_once_loaded at %s" % (cls.__name__, datetime.datetime.now()))

    @classmethod
    def assure_data_loaded(cls, es_testapp, datadir, indexer_namespace, snapshot_name=None, other_data=None,
                           # This next argument supports deprecated legacy behavior. -kmp 13-Feb-2021
                           only_on_first_call=False, level=0):
        """
        Creates (and remembers) or else restores the ES data associated with this class.

        DEPRECATION NOTICE: If initialization had already been done, this does NOT repeat it.
            It is possible that this was done and then the environment was later changed,
            for example in another test, and is not precisely what it was. This is how the orginal
            'workbook' fixture worked.  Fixtures of this kind are retained for compatibility
            with legacy testing. This entry point should generally be considered deprecated.

        :param es_testapp: an es_testapp fixture (providing an endpoint with admin access to test application with ES)
        :param datadir: the name of the temporary directory allocated for use of this test run
        :param indexer_namespace: the prefix string to be used on all ES index names
        :param snapshot_name: an optional snapshot name to override the default for special uses.
            The default value of None asks it be inferred from information declared as the snapshot_name class variable.
        :param other_data: a parameter passed through to the load_additional_data method if loading is needed.
            The nature of this data, if provided, depends on the class. The default value is None.
            (This can be useful if the load_additional_data method needs to receive fixture values.)
        :param only_on_first_call: (deprecated, default False)
            If True, restoration of data is suppressed after its initial creation.
            If False, if the data is not newly created, it is restored from a snapshot.
        :param level: This is used internally and should not be passed explicitly.  It helps with indentation
            and is used as a prefix when DEBUG_WORKBOOK_CACHE is True and is otherwise ignored.
        """
        if DEBUG_WORKBOOK_CACHE:
            if level == 0:
                PRINT()
            PRINT(level * "  ", level, "Entering %s.assure_data_loaded at %s" % (cls.__name__, datetime.datetime.now()))

        snapshot_name = cls.defaulted_snapshot_name(snapshot_name)
        cls._setattrs_safely(snapshots_repository_location=cls.make_snapshot_location(datadir),
                             indexer_namespace=indexer_namespace)
        if not cls.is_snapshot_initialized(snapshot_name):
            cls.load_data(es_testapp, datadir=datadir, indexer_namespace=indexer_namespace, other_data=other_data,
                          level=level + 1)
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Creating snapshot", snapshot_name, "at", datetime.datetime.now())
            create_workbook_snapshot(es_testapp,
                                     snapshots_repository_location=cls.snapshots_repository_location,
                                     repository_short_name=cls.repository_short_name,
                                     snapshot_name=snapshot_name)
            cls.mark_snapshot_initialized(snapshot_name)
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Done creating snapshot", snapshot_name, "at", datetime.datetime.now())
        elif only_on_first_call:
            # DEPRECATION NOTICE: This is legacy behavior related to how the 'workbook' fixture used to work,
            # which was to rely on loading it once and then rather than reverting it. -kmp 13-Feb-2021
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Skipping snapshot restoration because only_first_on_call=True.")
            pass
        else:
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Restoring snapshot", snapshot_name, "at", datetime.datetime.now())
            restore_workbook_snapshot(es_testapp,
                                      indexer_namespace=cls.indexer_namespace,
                                      repository_short_name=cls.repository_short_name,
                                      snapshot_name=snapshot_name)
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Done restoring snapshot", snapshot_name, "at", datetime.datetime.now())

        if DEBUG_WORKBOOK_CACHE:
            PRINT(level * "  ", level, "Exiting %s.assure_data_loaded at %s" % (cls.__name__, datetime.datetime.now()))

    @classmethod
    def load_data(cls, es_testapp, datadir, indexer_namespace, other_data=None, level=0):
        if DEBUG_WORKBOOK_CACHE:
            PRINT(level * "  ", level, "Entering %s.load_data at %s" % (cls.__name__, datetime.datetime.now()))
        if not is_data_cache(cls):
            raise RuntimeError("The class %s is not a registered data cache class."
                               " It may need an @es_data_cache() decoration."
                               % full_class_name(cls))
        if DEBUG_WORKBOOK_CACHE:
            PRINT(level * "  ", level, "Checking ancestors of", cls.__name__)
        ancestor_found = None
        for ancestor_class in ancestor_classes(cls):
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Trying ancestor", ancestor_class)
            # We only care about classes that are descended from our root class, obeying our protocols,
            # and actually allowed to have snapshots made (i.e., not declared abstract). Other mixed in
            # classes can be safely ignored.
            if is_data_cache(ancestor_class):
                if ancestor_found:
                    if not issubclass(ancestor_found, ancestor_class):
                        # This could happen with multiple inheritance. We can't rely on just calling its
                        # assure_data_loaded method because that method will blow away all indexes to build
                        # its foundation and we've already done that.  Even if we worked backward and loaded
                        # the less specific type first, risking reloads, that would only work for single
                        # inheritance, since it would again blow away the foundation before loading another layer,
                        # so we require single-inheritance and just assume the top layer knows what it's doing.
                        # -kmp 14-Feb-2021
                        raise RuntimeError("%s requires its descendants to use only single inheritance"
                                           ", but %s mixes %s and %s, and %s is not a subclass of %s."
                                           % (ElasticSearchDataCache.__name__,
                                              cls.__name__,
                                              ancestor_found.__name__,
                                              ancestor_class.__name__,
                                              ancestor_found.__name__,
                                              ancestor_class.__name__))
                else:
                    ancestor_found = ancestor_class
        if ancestor_found:
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Assuring data for ancestor class", ancestor_found.__name__,
                      "on behalf of", cls.__name__)
            ancestor_found.assure_data_loaded(es_testapp,
                                              datadir=datadir,
                                              indexer_namespace=indexer_namespace,
                                              other_data=other_data, level=level+1)
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "Done assuring data for ancestor class", ancestor_found.__name__,
                      "on behalf of", cls.__name__)
        else:
            if DEBUG_WORKBOOK_CACHE:
                PRINT(level * "  ", level, "No useful ancestor found. No foundation to load.", cls.__name__)
        # Having built a foundation, now add the data that we wanted.
        if DEBUG_WORKBOOK_CACHE:
            PRINT(level * "  ", level, "Loading additional requested class data", cls.__name__)
        # Now that a proper foundation is assured, load the new data that this class contributes.
        cls.load_additional_data(es_testapp, other_data=other_data)
        if DEBUG_WORKBOOK_CACHE:
            PRINT(level * "  ", level, "Done loading additional requested class data", cls.__name__)
        # Finally, assure everything is indexed.
        if DEBUG_WORKBOOK_CACHE:
            print(level * "  ", level, "Starting indexing at", datetime.datetime.now())
        es_testapp.post_json('/index', {'record': False})
        if DEBUG_WORKBOOK_CACHE:
            print(level * "  ", level, "Done indexing at", datetime.datetime.now())
        if DEBUG_WORKBOOK_CACHE:
            PRINT(level * "  ", level, "Exiting %s.load_data at %s" % (cls.__name__, datetime.datetime.now()))

    @classmethod
    def load_additional_data(cls, es_testapp, other_data=None):
        """
        The default method does no setup, so a snapshot will not be interesting,
        but this is a useful base case so that anyone writing a subclass can customize
        this method by doing:

        class MyData(ElasticSearchDataCache):

            @classmethod
            def load_additional_data(cls, es_testapp, other_data=None):
                # This should NOT call super(). That will be done in other ways.
                ... load data into environment belonging to parent ...
        """
        pass

    @classmethod
    def defaulted_snapshot_name(cls, snapshot_name):
        return snapshot_name or camel_case_to_snake_case(cls.__name__) + "_snapshot"

    @classmethod
    def make_snapshot_location(cls, datadir):
        return datadir + "/" + cls.repository_short_name

    @classmethod
    def mark_snapshot_initialized(cls, snapshot_name):
        cls.WORKBOOK_SNAPSHOTS_INITIALIZED[snapshot_name] = True

    @classmethod
    def is_snapshot_initialized(cls, snapshot_name):
        return cls.WORKBOOK_SNAPSHOTS_INITIALIZED.get(snapshot_name)

    @classmethod
    def _setattrs_safely(cls, **attributes_and_values):
        """Sets various class variables making sure they're not already set incompatibly."""
        for attr, value in attributes_and_values.items():
            existing = getattr(cls, attr)
            if existing and existing != value:
                if DEBUG_WORKBOOK_CACHE:
                    import pdb
                    pdb.set_trace()
                raise RuntimeError("Conflicting %s: %s (new) and %s (existing)." % (attr, value, existing))
            setattr(cls, attr, value)


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
