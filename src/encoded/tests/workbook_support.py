import datetime
import logging
import pkg_resources
import pytest

from elasticsearch.exceptions import NotFoundError
from dcicutils.misc_utils import environ_bool, PRINT, camel_case_to_snake_case, ignored, check_true
from ..loadxl import load_all


# When this is more stable/trusted, we might want to remove this.
# But I'd rather not be adding/removing instrumentation as I'm debugging it. -kmp 11-Feb-2021
DEBUG_WORKBOOK_CACHE = environ_bool("DEBUG_WORKBOOK_CACHE", default=False)


# # TODO: Move later to dcicutils
# def reversed(seq):
#     seq_copied = list(seq).copy()
#     seq_copied.reverse()
#     return seq_copied


# TODO: Move later to dcicutils
def ancestor_classes(cls, reverse=False):
    result = list(cls.__mro__[1:])
    if reverse:
        result.reverse()
    print("ancestor_classes(%r, reverse=%s) = %r" %(cls, reverse, result))
    return result

def is_proper_subclass(cls, maybe_proper_superclass):
    """
    Returns true of its first argument is a subclass of the second argument, but is not that class itself.
    (Every class is a subclass of itself, but no class is a 'proper subclass' of itself.)
    """
    return cls is not maybe_proper_superclass and issubclass(cls, maybe_proper_superclass)


# TODO: Move later to dcicutils
def is_valid_indexer_namespace(indexer_namespace, for_testing=False):
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
        return False if for_testing else True
    if not isinstance(indexer_namespace, str):
        # Non-strings (including None) are not indexer_namespaces
        return False
    # At this point we know we have a non-empty string, so check that it ends in a digit.
    return indexer_namespace[-1].isdigit()


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
def restore_workbook_snapshot(es_testapp, indexer_namespace, repository_short_name, snapshot_name=None):
    es = es_testapp.app.registry['elasticsearch']
    try:
        if not is_valid_indexer_namespace(indexer_namespace):
            raise RuntimeError("restore_workbook_snapshot requires an indexer namespace prefix."
                               " (You can use the indexer_namespace fixture to acquire it.)")

        all_index_info = [info['index'] for info in es.cat.indices(format='json')]
        index_names = [name for name in all_index_info if name.startswith(indexer_namespace)]
        if index_names:
            index_names_string = ",".join(index_names)
            if DEBUG_WORKBOOK_CACHE:
                PRINT("Deleting index files", index_names_string)
            result = es.indices.delete(index_names_string)
            if DEBUG_WORKBOOK_CACHE:
                PRINT("deletion result=", result)
        result = es.snapshot.restore(repository=repository_short_name,
                                     snapshot=snapshot_name,
                                     wait_for_completion=True)
        # Need to find out what a successful result looks like
        if DEBUG_WORKBOOK_CACHE:
            PRINT("restore result=", result)
    except Exception as e:
        # Maybe should log somehow?
        logging.error(str(e))
        # Maybe should reset cls.done to False?
        if DEBUG_WORKBOOK_CACHE:
            import pdb
            pdb.set_trace()
        raise


# TODO: Move later to dcicutils.es_utils
class ElasticSearchDataCache:
    """ Caches whether or not we have already provisioned a particular body of data. """

    WORKBOOK_SNAPSHOTS_INITIALIZED = {}

    repository_short_name = 'snapshots'
    snapshots_repository_location = None
    indexer_namespace = None

    @classmethod
    def assure_data_once_loaded(cls, es_testapp, datadir, indexer_namespace,
                                snapshot_name=None, other_data=None):
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
        """
        cls.assure_data_loaded(es_testapp,
                                 # Just pass these arguments through
                                 datadir=datadir, indexer_namespace=indexer_namespace, snapshot_name=snapshot_name,
                                 other_data=other_data,
                                 # This is the important part, requesting deprecated legacy 'workbook' behavior,
                                 # which presumed that after the first initialization, state would just stay
                                 # initialized (or would be put explicitly back in order). We'll soon phase this out.
                                 # -kmp 13-Feb-2021
                                 only_on_first_call=True)


    @classmethod
    def assure_data_loaded(cls, es_testapp, datadir, indexer_namespace, snapshot_name=None, other_data=None,
                           # This next argument supports deprecated legacy behavior. -kmp 13-Feb-2021
                           only_on_first_call=False):
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
        """
        if DEBUG_WORKBOOK_CACHE:
            logging.warning("Entering load_data at %s" % datetime.datetime.now())
        if DEBUG_WORKBOOK_CACHE:
            PRINT("%s.assure_data_loaded(...)" % cls.__name__)

        snapshot_name = cls.defaulted_snapshot_name(snapshot_name)
        cls._setattrs_safely(snapshots_repository_location=cls.make_snapshot_location(datadir),
                             indexer_namespace=indexer_namespace)
        if not cls.is_snapshot_initialized(snapshot_name):
            cls.load_data(es_testapp, datadir=datadir, indexer_namespace=indexer_namespace, other_data=other_data)
            create_workbook_snapshot(es_testapp,
                                     snapshots_repository_location=cls.snapshots_repository_location,
                                     repository_short_name=cls.repository_short_name,
                                     snapshot_name=snapshot_name)
            cls.mark_snapshot_initialized(snapshot_name)
        elif only_on_first_call:
            # DEPRECATION NOTICE: This is legacy behavior related to how the 'workbook' fixture used to work,
            # which was to rely on loading it once and then rather than reverting it. -kmp 13-Feb-2021
            pass
        else:
            restore_workbook_snapshot(es_testapp,
                                      indexer_namespace=cls.indexer_namespace,
                                      repository_short_name=cls.repository_short_name,
                                      snapshot_name=snapshot_name)

    @classmethod
    def load_data(cls, es_testapp, datadir, indexer_namespace, other_data=None):
        if "load_additional_data" not in cls.__dict__:
            raise RuntimeError("The class %s must provide a 'load_additional_data' method.")
        if DEBUG_WORKBOOK_CACHE:
            PRINT("Checking ancestors of", cls.__name__)
        ancestor_found = None
        for ancestor_class in ancestor_classes(cls):
            if DEBUG_WORKBOOK_CACHE:
                PRINT("Trying ancestor", ancestor_class)
            # We only care about classes that are descended from our root class, obeying our protocols.
            if issubclass(ancestor_class, ElasticSearchDataCache):
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
                elif getattr(ancestor_class, "load_additional_data", None):
                    ancestor_found = ancestor_class
        if ancestor_found:
            if DEBUG_WORKBOOK_CACHE:
                PRINT("Loading data for ancestor class", ancestor_found.__name__)
            ancestor_found.assure_data_loaded(es_testapp,
                                              datadir=datadir,
                                              indexer_namespace=indexer_namespace,
                                              other_data=other_data)
            if DEBUG_WORKBOOK_CACHE:
                PRINT("Done loading data for ancestor class", ancestor_found.__name__)
        else:
            if DEBUG_WORKBOOK_CACHE:
                PRINT("No useful ancestor found. No foundation to load.", cls.__name__)
        # Having built a foundation, now add the data that we wanted.
        if DEBUG_WORKBOOK_CACHE:
            PRINT("Loading additional requested class data", cls.__name__)
        # Now that a proper foundation is assured, load the new data that this class contributes.
        cls.load_additional_data(es_testapp, other_data=other_data)
        if DEBUG_WORKBOOK_CACHE:
            PRINT("Done loading additional requested class data", cls.__name__)
        # Finally, assure everything is indexed.
        es_testapp.post_json('/index', {'record': False})

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
    def mark_snapshot_initialized(cls, snapshot_name, value=True):
        cls.WORKBOOK_SNAPSHOTS_INITIALIZED[snapshot_name] = value

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
                    import pdb; pdb.set_trace()
                raise RuntimeError("Conflicting %s: %s (new) and %s (existing)." % (attr, value, existing))
            setattr(cls, attr, value)


def load_inserts(es_testapp, inserts_name):

    if DEBUG_WORKBOOK_CACHE:
        print("load_inserts(es_testapp, %r)" % inserts_name)

    # Presently we do not use the cls.indexer_namespace, but it might be nice to optimize later
    # by saving only those prefixes.
    load_res = load_all(es_testapp, pkg_resources.resource_filename('encoded', 'tests/data/%s-inserts/' % inserts_name), [])

    # Note: load_all returns None for success or an Exception on failure.
    if isinstance(load_res, Exception):
        raise load_res
    elif load_res:
        raise RuntimeError("load_all returned a true value that was not an exception.")


class WorkbookCache(ElasticSearchDataCache):

    @classmethod
    def load_additional_data(cls, es_testapp, other_data=None):
        check_true(not other_data, "data not allowed")
        load_inserts(es_testapp, inserts_name='workbook')


@pytest.fixture()
def workbook(es_testapp, obsolete_workbook, elasticsearch_server_dir, indexer_namespace):
    WorkbookCache.assure_data_loaded(es_testapp,
                                     datadir=elasticsearch_server_dir,
                                     indexer_namespace=indexer_namespace)


class PersonasCache(WorkbookCache):

    @classmethod
    def load_additional_data(cls, es_testapp, other_data=None):
        check_true(not other_data, "data not allowed")
        load_inserts(es_testapp, inserts_name='personas')


@pytest.fixture()
def personas(es_testapp, obsolete_personas, elasticsearch_server_dir, indexer_namespace):
    PersonasCache.assure_data_loaded(es_testapp,
                                     datadir=elasticsearch_server_dir,
                                     indexer_namespace=indexer_namespace)
