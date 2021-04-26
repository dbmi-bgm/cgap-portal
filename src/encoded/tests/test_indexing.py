""" Test full indexing setup

The fixtures in this module setup a full system with postgresql and
elasticsearch running as subprocesses.
"""
import json
import os
import pkg_resources
import pytest
import re
import time
import transaction
import uuid

from snovault import DBSESSION, TYPES
from snovault.elasticsearch import create_mapping, ELASTIC_SEARCH
from snovault.elasticsearch.create_mapping import (
    type_mapping,
    create_mapping_by_type,
    build_index_record,
    compare_against_existing_mapping
)
from snovault.elasticsearch.indexer_utils import get_namespaced_index, compute_invalidation_scope
from snovault.elasticsearch.interfaces import INDEXER_QUEUE
from sqlalchemy import MetaData, func
from timeit import default_timer as timer
from unittest import mock
from zope.sqlalchemy import mark_changed
from .. import main, loadxl
from ..verifier import verify_item


pytestmark = [pytest.mark.working, pytest.mark.indexing]


POSTGRES_MAJOR_VERSION_EXPECTED = 11


def test_postgres_version(session):

    (version_info,) = session.query(func.version()).one()
    print("version_info=", version_info)
    assert isinstance(version_info, str)
    assert re.match("PostgreSQL %s([.][0-9]+)? " % POSTGRES_MAJOR_VERSION_EXPECTED, version_info)


# subset of collections to run test on
TEST_COLLECTIONS = ['testing_post_put_patch', 'file_processed']


@pytest.yield_fixture(scope='session', params=[False])
def app(es_app_settings, request):
    # for now, don't run with mpindexer. Add `True` to params above to do so
    if request.param:
        # we disable the MPIndexer since the build runs on a small machine
        # snovault should be testing the mpindexer - Will 12/12/2020
        es_app_settings['mpindexer'] = False
    app = main({}, **es_app_settings)

    yield app

    db_session = app.registry[DBSESSION]
    # Dispose connections so postgres can tear down.
    db_session.bind.pool.dispose()


@pytest.yield_fixture
def setup_and_teardown(app):
    """
    Run create mapping and purge queue before tests and clear out the
    DB tables after the test
    """

    # BEFORE THE TEST - run create mapping for tests types and clear queues
    create_mapping.run(app, collections=TEST_COLLECTIONS, skip_indexing=True)
    app.registry[INDEXER_QUEUE].clear_queue()

    yield  # run the test

    # AFTER THE TEST
    session = app.registry[DBSESSION]
    connection = session.connection().connect()
    meta = MetaData(bind=session.connection())
    meta.reflect()
    for table in meta.sorted_tables:
        print('Clear table %s' % table)
        print('Count before -->', str(connection.scalar("SELECT COUNT(*) FROM %s" % table)))
        connection.execute(table.delete())
        print('Count after -->', str(connection.scalar("SELECT COUNT(*) FROM %s" % table)), '\n')
    session.flush()
    mark_changed(session())
    transaction.commit()


@pytest.mark.slow
@pytest.mark.flaky
def test_indexing_simple(app, setup_and_teardown, testapp, indexer_testapp):
    es = app.registry['elasticsearch']
    namespaced_ppp = get_namespaced_index(app, 'testing_post_put_patch')
    doc_count = es.count(index=namespaced_ppp, doc_type='testing_post_put_patch').get('count')
    assert doc_count == 0
    # First post a single item so that subsequent indexing is incremental
    testapp.post_json('/testing-post-put-patch/', {'required': ''})
    res = indexer_testapp.post_json('/index', {'record': True})
    assert res.json['indexing_count'] == 1
    res = testapp.post_json('/testing-post-put-patch/', {'required': ''})
    uuid = res.json['@graph'][0]['uuid']
    res = indexer_testapp.post_json('/index', {'record': True})
    assert res.json['indexing_count'] == 1
    time.sleep(3)
    # check es directly
    doc_count = es.count(index=namespaced_ppp, doc_type='testing_post_put_patch').get('count')
    assert doc_count == 2
    res = testapp.get('/search/?type=TestingPostPutPatch')
    uuids = [indv_res['uuid'] for indv_res in res.json['@graph']]
    count = 0
    while uuid not in uuids and count < 20:
        time.sleep(1)
        res = testapp.get('/search/?type=TestingPostPutPatch')
        uuids = [indv_res['uuid'] for indv_res in res.json['@graph']]
        count += 1
    assert res.json['total'] >= 2
    assert uuid in uuids

    namespaced_indexing = get_namespaced_index(app, 'indexing')
    indexing_doc = es.get(index=namespaced_indexing, doc_type='indexing', id='latest_indexing')
    indexing_source = indexing_doc['_source']
    assert 'indexing_count' in indexing_source
    assert 'indexing_finished' in indexing_source
    assert 'indexing_content' in indexing_source
    assert indexing_source['indexing_status'] == 'finished'
    assert indexing_source['indexing_count'] > 0
    testing_ppp_mappings = es.indices.get_mapping(index=namespaced_ppp)[namespaced_ppp]
    assert 'mappings' in testing_ppp_mappings
    testing_ppp_settings = es.indices.get_settings(index=namespaced_ppp)[namespaced_ppp]
    assert 'settings' in testing_ppp_settings
    # ensure we only have 1 shard for tests
    assert testing_ppp_settings['settings']['index']['number_of_shards'] == '1'


@pytest.mark.skip
@pytest.mark.flaky
def test_create_mapping_on_indexing(app, setup_and_teardown, testapp, registry, elasticsearch):
    """
    Test overall create_mapping functionality using app.
    Do this by checking es directly before and after running mapping.
    Delete an index directly, run again to see if it recovers.
    """
    es = registry[ELASTIC_SEARCH]
    item_types = TEST_COLLECTIONS
    # check that mappings and settings are in index
    for item_type in item_types:
        type_mapping(registry[TYPES], item_type)
        try:
            namespaced_index = get_namespaced_index(app, item_type)
            item_index = es.indices.get(index=namespaced_index)
        except Exception:
            assert False
        found_index_mapping_emb = item_index[namespaced_index]['mappings'][item_type]['properties']['embedded']
        found_index_settings = item_index[namespaced_index]['settings']
        assert found_index_mapping_emb
        assert found_index_settings
        # compare the manually created mapping to the one in ES
        full_mapping = create_mapping_by_type(item_type, registry)
        item_record = build_index_record(full_mapping, item_type)
        # below is True if the found mapping matches manual one
        assert compare_against_existing_mapping(es, namespaced_index, item_type, item_record, True)


@pytest.mark.flaky
def test_file_processed_detailed(app, setup_and_teardown, testapp, indexer_testapp, project, institution, file_formats):
    # post file_processed
    item = {
        'institution': institution['uuid'],
        'project': project['uuid'],
        'file_format': file_formats.get('bam').get('@id'),
        'filename': 'test.bam',
        'status': 'uploading'
    }
    fp_res = testapp.post_json('/file_processed', item)
    test_fp_uuid = fp_res.json['@graph'][0]['uuid']
    testapp.post_json('/file_processed', item)
    indexer_testapp.post_json('/index', {'record': True})

    # Todo, input a list of accessions / uuids:
    verify_item(test_fp_uuid, indexer_testapp, testapp, app.registry)
    # While we're here, test that _update of the file properly
    # queues the file with given relationship
    indexer_queue = app.registry[INDEXER_QUEUE]
    rel_file = {
        'project': project['uuid'],
        'institution': institution['uuid'],
        'file_format': file_formats.get('bam').get('@id')
    }
    rel_res = testapp.post_json('/file_processed', rel_file)
    rel_uuid = rel_res.json['@graph'][0]['uuid']
    # now update the original file with the relationship
    # ensure rel_file is properly queued
    related_files = [{'relationship_type': 'derived from', 'file': rel_uuid}]
    testapp.patch_json('/' + test_fp_uuid, {'related_files': related_files}, status=200)
    time.sleep(2)
    # may need to make multiple calls to indexer_queue.receive_messages
    received = []
    received_batch = None
    while received_batch is None or len(received_batch) > 0:
        received_batch = indexer_queue.receive_messages()
        received.extend(received_batch)
    to_replace = []
    to_delete = []
    found_fp_sid = None
    found_rel_sid = None
    # keep track of the PATCH of the original file and the associated PATCH
    # of the related file. Compare uuids
    for msg in received:
        json_body = json.loads(msg.get('Body', {}))
        if json_body['uuid'] == test_fp_uuid and json_body['method'] == 'PATCH':
            found_fp_sid = json_body['sid']
            to_delete.append(msg)
        elif json_body['uuid'] == rel_uuid and json_body['method'] == 'PATCH':
            assert json_body['info'] == "queued from %s _update" % test_fp_uuid
            found_rel_sid = json_body['sid']
            to_delete.append(msg)
        else:
            to_replace.append(msg)
    indexer_queue.delete_messages(to_delete)
    indexer_queue.replace_messages(to_replace, vis_timeout=0)
    assert found_fp_sid is not None and found_rel_sid is not None
    assert found_rel_sid > found_fp_sid  # sid of related file is greater


@pytest.mark.flaky
def test_real_validation_error(app, setup_and_teardown, indexer_testapp, testapp, institution, project, file_formats):
    """
    Create an item (file-processed) with a validation error and index,
    to ensure that validation errors work
    """
    es = app.registry[ELASTIC_SEARCH]
    fp_body = {
        'schema_version': '3',
        'uuid': str(uuid.uuid4()),
        'file_format': file_formats.get('zip').get('uuid'),
        'institution': institution['uuid'],
        'project': project['uuid'],
        'file_classification': 'unprocessed file'
        # 'higlass_uid': 1  # validation error -- higlass_uid should be string
    }
    res = testapp.post_json('/files-processed/?validate=false&upgrade=False',
                            fp_body, status=201).json
    fp_id = res['@graph'][0]['@id']
    val_err_view = testapp.get(fp_id + '@@validation-errors', status=200).json
    assert val_err_view['@id'] == fp_id
    assert val_err_view['validation_errors'] == []

    # call to /index will throw MissingIndexItemException multiple times,
    # since associated file_format, institution, and project are not indexed.
    # That's okay if we don't detect that it succeeded, keep trying until it does
    indexer_testapp.post_json('/index', {'record': True})
    time.sleep(2)
    namespaced_fp = get_namespaced_index(app, 'file_processed')
    es_res = es.get(index=namespaced_fp, doc_type='file_processed', id=res['@graph'][0]['uuid'])
    assert len(es_res['_source'].get('validation_errors', [])) == 1
    # check that validation-errors view works
    val_err_view = testapp.get(fp_id + '@@validation-errors', status=200).json
    assert val_err_view['@id'] == fp_id
    assert val_err_view['validation_errors'] == es_res['_source']['validation_errors']


# TODO: This might need to use es_testapp now. -kmp 14-Mar-2021
@pytest.mark.performance
@pytest.mark.skip(reason="need to update perf-testing inserts")
def test_load_and_index_perf_data(testapp, setup_and_teardown, indexer_testapp):
    """
    ~~ CURRENTLY NOT WORKING ~~

    PERFORMANCE TESTING
    Loads all the perf-testing data and then indexes it
    Prints time for both

    this test is to ensure the performance testing data that is run
    nightly through the mastertest_deployment process in the torb repo
    it takes roughly 25 to run.
    Note: run with bin/test -s -m performance to see the prints from the test
    """

    insert_dir = pkg_resources.resource_filename('encoded', 'tests/data/perf-testing/')
    inserts = [f for f in os.listdir(insert_dir) if os.path.isfile(os.path.join(insert_dir, f))]
    json_inserts = {}

    # pluck a few uuids for testing
    test_types = ['biosample', 'user', 'institution', 'experiment_set_replicate']
    test_inserts = []
    for insert in inserts:
        type_name = insert.split('.')[0]
        json_inserts[type_name] = json.loads(open(insert_dir + insert).read())
        # pluck a few uuids for testing
        if type_name in test_types:
            test_inserts.append({'type_name': type_name, 'data': json_inserts[type_name][0]})

    # load -em up
    start = timer()
    with mock.patch.object(loadxl, 'get_app') as mocked_app:
        mocked_app.return_value = testapp.app
        data = {'store': json_inserts}
        res = testapp.post_json('/load_data', data,  # status=200
                                )
        assert res.json['status'] == 'success'
    stop_insert = timer()
    print("PERFORMANCE: Time to load data is %s" % (stop_insert - start))
    index_res = indexer_testapp.post_json('/index', {'record': True})
    assert index_res.json['indexing_status'] == 'finished'
    stop_index = timer()
    print("PERFORMANCE: Time to index is %s" % (stop_index - start))

    # check a couple random inserts
    for item in test_inserts:
        start = timer()
        assert testapp.get("/" + item['data']['uuid'] + "?frame=raw").json['uuid']  # noQA
        stop = timer()
        frame_time = stop - start

        start = timer()
        assert testapp.get("/" + item['data']['uuid']).follow().json['uuid']  # noQA
        stop = timer()
        embed_time = stop - start

        print("PERFORMANCE: Time to query item %s - %s raw: %s embed %s" % (item['type_name'], item['data']['uuid'],  # noQA
                                                                            frame_time, embed_time))
    # userful for seeing debug messages
    # assert False


class TestInvalidationScopeViewCGAP:
    """ Integrated testing of invalidation scope - requires ES component, so in this file. """
    DEFAULT_SCOPE = ['status', 'uuid']  # --> this is what you get if there is nothing

    class MockedRequest:
        def __init__(self, registry, source_type, target_type):
            self.registry = registry
            self.json = {
                'source_type': source_type,
                'target_type': target_type
            }

    @pytest.mark.parametrize('source_type, target_type, invalidated', [
        # Test WorkflowRun (same as fourfront)
        ('FileProcessed', 'WorkflowRunAwsem',
            DEFAULT_SCOPE + ['accession', 'file_format', 'filename', 'file_size']
         ),
        ('Software', 'WorkflowRunAwsem',
            DEFAULT_SCOPE + ['name', 'title', 'version', 'source_url']
         ),
        ('Workflow', 'WorkflowRunAwsem',
            DEFAULT_SCOPE + ['category', 'experiment_types', 'app_name', 'title']
         ),
        ('WorkflowRunAwsem', 'FileProcessed',  # no link
            DEFAULT_SCOPE
         ),
        # Test Case as it has the most links and thus the most ways things can go wrong
        ('VariantSample', 'Case',
            DEFAULT_SCOPE  # no link
         ),
        ('Variant', 'Case',
            DEFAULT_SCOPE  # no link
         ),
        ('Individual', 'Case',
            DEFAULT_SCOPE + ['accession', 'alternate_accessions', 'tags', 'last_modified.date_modified',
                             'last_modified.modified_by', 'date_created', 'submitted_by',
                             'schema_version', 'aliases', 'institution', 'project', 'individual_id', 'age',
                             'age_units', 'is_pregnancy', 'gestational_age', 'sex', 'quantity',
                             'phenotypic_features.phenotypic_feature', 'phenotypic_features.onset_age',
                             'phenotypic_features.onset_age_units', 'disorders', 'clinic_notes', 'birth_year',
                             'is_deceased', 'life_status', 'is_termination_of_pregnancy',
                             'is_spontaneous_abortion', 'is_still_birth', 'cause_of_death',
                             'age_at_death', 'age_at_death_units', 'is_no_children_by_choice',
                             'is_infertile', 'cause_of_infertility', 'ancestry', 'images',
                             'related_documents', 'institutional_id.id', 'institutional_id.institution',
                             'mother', 'father', 'samples']
         ),
        ('Sample', 'Case',
            DEFAULT_SCOPE + ['accession', 'workup_type', 'specimen_type',
                             'specimen_accession_date', 'specimen_collection_date',
                             'specimen_accession', 'specimen_notes', 'sequence_id',
                             'sequencing_date', 'completed_processes', 'bam_sample_id']
         ),
        ('Family', 'Case',
            DEFAULT_SCOPE + ['institution', 'project', 'tags', 'last_modified.date_modified',
                             'last_modified.modified_by', 'date_created', 'submitted_by', 'aliases',
                             'accession', 'alternate_accessions', 'schema_version', 'title', 'family_id',
                             'members', 'proband', 'pedigree_source', 'original_pedigree', 'clinic_notes',
                             'timestamp', 'family_phenotypic_features', 'description']
         ),
        ('Phenotype', 'Case',
            DEFAULT_SCOPE + ['hpo_id', 'phenotype_name']
         ),
        ('FileProcessed', 'Case',
            DEFAULT_SCOPE + ['accession', 'quality_metric', 'file_ingestion_status']
         ),
        ('Report', 'Case',
            DEFAULT_SCOPE + ['accession']
         ),
        ('FilterSet', 'Case',
            DEFAULT_SCOPE + ['notes', 'tags', 'last_modified.date_modified', 'last_modified.modified_by',
                             'date_created', 'submitted_by', 'institution', 'project', 'aliases',
                             'schema_version', 'title', 'search_type', 'filter_blocks.name',
                             'filter_blocks.query', 'filter_blocks.flags_applied', 'flags.name',
                             'flags.query', 'created_in_case_accession', 'preset_for_projects',
                             'preset_for_users', 'default_for_projects']
         ),
        ('Project', 'Case',
            DEFAULT_SCOPE + ['name']
         ),
    ])
    def test_invalidation_scope_view_parametrized(self, indexer_testapp, source_type, target_type, invalidated):
        """ Just call the route function - test some basic interactions.
            In this test, the source_type is the type on which we simulate a modification and target type is
            the type we are simulating an invalidation on. In all cases uuid and status will trigger invalidation
            if a linkTo exists, so those fields are always returned as part of the invalidation scope (even when no
            link exists).
        """
        req = self.MockedRequest(indexer_testapp.app.registry, source_type, target_type)
        scope = compute_invalidation_scope(None, req)
        print(scope['Invalidated'])
        assert sorted(scope['Invalidated']) == sorted(invalidated)
