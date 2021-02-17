import logging
import pkg_resources

from elasticsearch.exceptions import NotFoundError
from dcicutils.misc_utils import environ_bool, PRINT
from ..loadxl import load_all


# When this is more stable/trusted, we might want to remove this.
# But I'd rather not be adding/removing instrumentation as I'm debugging it. -kmp 11-Feb-2021
DEBUG_WORKBOOK_CACHE = environ_bool("DEBUG_WORKBOOK_CACHE", default=False)


class WorkbookCache:
    """ Caches whether or not we have already provisioned the workbook. """

    WORKBOOK_CACHE_INITIALIZED = False
    WORKBOOK_SNAPSHOT_INITIALIZED = False

    repository_short_name = 'snapshots'
    snapshot_name = "workbook_snapshot"
    snapshots_repository_location = None
    indexer_namespace = None

    @classmethod
    def initialize_if_needed(cls, es_testapp, datadir, indexer_namespace):
        cls._setattrs_safely(snapshots_repository_location=datadir + "/" + cls.repository_short_name,
                             indexer_namespace=indexer_namespace)
        # From the workbook fixture, this would probably only be called once anyway because it's a session fixture,
        # and other fixtures that need the cache should include that fixture, so really this variable control
        # SHOULD BE entirely unnecessary. But we do it just pro-forma. Do not expect this to ever be called more
        # than once, though. -kmp 11-Feb-2021
        if not cls.WORKBOOK_CACHE_INITIALIZED:
            cls._make_fresh_workbook(es_testapp)

    @classmethod
    def make_or_restore_workbook(cls, es_testapp, datadir, indexer_namespace):
        cls._setattrs_safely(snapshots_repository_location=datadir + "/" + cls.repository_short_name,
                             indexer_namespace=indexer_namespace)
        if not cls.WORKBOOK_CACHE_INITIALIZED:
            # For right now, this is pathologically weird, so just re-run all initialization in this case.
            # HOWEVER, there's a possible future optimization where we might distribute a snapshot that we
            # externally unpack. In that case, we would notice the file and just force the cache to think it
            # was already initialized so it can use the snapshot immediately. In that case, it might want to
            # force cls.WORKBOOK_CACHE_INITIALIZED = True here instead of setting cls.WORKBOOK_SNAPSHOT_INITIALIZED.
            # But for now this effect better matches reality. -kmp 11-Feb-2021
            cls.WORKBOOK_SNAPSHOT_INITIALIZED = False
        if cls.WORKBOOK_SNAPSHOT_INITIALIZED:
            cls.restore_workbook_snapshot(es_testapp)
        else:
            cls.initialize_if_needed(es_testapp)
            cls._create_workbook_snapshot(es_testapp)
            cls.WORKBOOK_CACHE_INITIALIZED = True

    @classmethod
    def _make_fresh_workbook(cls, es_testapp):
        # Presently we do not use the cls.indexer_namespace, but it might be nice to optimize later
        # by saving only those prefixes.
        load_res = load_all(es_testapp, pkg_resources.resource_filename('encoded', 'tests/data/workbook-inserts/'), [])

        # Note: load_all returns None for success or an Exception on failure.
        if isinstance(load_res, Exception):
            raise load_res
        elif load_res:
            raise RuntimeError("load_all returned a true value that was not an exception.")

        es_testapp.post_json('/index', {})

        cls._create_workbook_snapshot(es_testapp)

        cls.WORKBOOK_CACHE_INITIALIZED = True

    @classmethod
    def _create_workbook_snapshot(cls, es_testapp):
        if cls._snapshot_exists(es_testapp):
            return
        es = es_testapp.app.registry['elasticsearch']
        try:

            if DEBUG_WORKBOOK_CACHE:
                PRINT("Creating snapshot repo", cls.repository_short_name, "at", cls.snapshots_repository_location)
            repo_creation_result = es.snapshot.create_repository(cls.repository_short_name,
                                                                 {
                                                                     "type": "fs",
                                                                     "settings": {
                                                                         "location": cls.snapshots_repository_location,
                                                                     }
                                                                 })
            assert repo_creation_result == {'acknowledged': True}
            if DEBUG_WORKBOOK_CACHE:
                PRINT("Creating snapshot", cls.repository_short_name)
            snapshot_creation_result = es.snapshot.create(repository=cls.repository_short_name,
                                                          snapshot=cls.snapshot_name,
                                                          wait_for_completion=True)
            assert snapshot_creation_result.get('snapshot', {}).get('snapshot') == cls.snapshot_name
            cls.WORKBOOK_SNAPSHOT_INITIALIZED = True
        except Exception as e:
            logging.error(str(e))
            if DEBUG_WORKBOOK_CACHE:
                import pdb
                pdb.set_trace()
            raise

    @classmethod
    def _snapshot_exists(cls, es_testapp):
        es = es_testapp.app.registry['elasticsearch']
        try:
            return bool(es.snapshot.get(repository=cls.repository_short_name, snapshot=cls.snapshot_name))
        except NotFoundError:
            return False

    @classmethod
    def restore_workbook_snapshot(cls, es_testapp):
        es = es_testapp.app.registry['elasticsearch']
        try:
            if not cls.indexer_namespace or not cls.indexer_namespace[0].isdigit():
                raise RuntimeError("restore_workbook_snapshot requires an indexer namespace prefix."
                                   " (You can use the indexer_namespace fixture to acquire it.)")

            all_index_info = [info['index'] for info in es.cat.indices(format='json')]
            index_names = [name for name in all_index_info if name.startswith(cls.indexer_namespace)]
            if index_names:
                index_names_string = ",".join(index_names)
                if DEBUG_WORKBOOK_CACHE:
                    PRINT("Deleting index files", index_names_string)
                result = es.indices.delete(index_names_string)
                if DEBUG_WORKBOOK_CACHE:
                    PRINT("deletion result=", result)
            result = es.snapshot.restore(repository=cls.repository_short_name,
                                         snapshot=cls.snapshot_name,
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

    @classmethod
    def _setattrs_safely(cls, **attributes_and_values):
        """Sets various class variables making sure they're not already set incompatibly."""
        for attr, value in attributes_and_values.items():
            existing = getattr(cls, attr)
            if existing and existing != value:
                raise RuntimeError("Conflicting %s: %s (new) and %s (existing)." % (attr, value, existing))
            setattr(cls, attr, value)
