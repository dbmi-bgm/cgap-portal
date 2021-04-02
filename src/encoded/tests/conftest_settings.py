
_app_settings = {
    'collection_datastore': 'database',
    'item_datastore': 'database',
    'multiauth.policies': 'session remoteuser accesskey auth0',
    'multiauth.groupfinder': 'encoded.authorization.groupfinder',
    'multiauth.policy.session.use': 'encoded.authentication.NamespacedAuthenticationPolicy',
    'multiauth.policy.session.base': 'pyramid.authentication.SessionAuthenticationPolicy',
    'multiauth.policy.session.namespace': 'mailto',
    'multiauth.policy.remoteuser.use': 'encoded.authentication.NamespacedAuthenticationPolicy',
    'multiauth.policy.remoteuser.namespace': 'remoteuser',
    'multiauth.policy.remoteuser.base': 'pyramid.authentication.RemoteUserAuthenticationPolicy',
    'multiauth.policy.accesskey.use': 'encoded.authentication.NamespacedAuthenticationPolicy',
    'multiauth.policy.accesskey.namespace': 'accesskey',
    'multiauth.policy.accesskey.base': 'encoded.authentication.BasicAuthAuthenticationPolicy',
    'multiauth.policy.accesskey.check': 'encoded.authentication.basic_auth_check',
    'multiauth.policy.auth0.use': 'encoded.authentication.NamespacedAuthenticationPolicy',
    'multiauth.policy.auth0.namespace': 'auth0',
    'multiauth.policy.auth0.base': 'encoded.authentication.Auth0AuthenticationPolicy',
    'load_test_only': True,
    'testing': True,
    'indexer': True,
    'mpindexer': False,
    'production': True,
    'pyramid.debug_authorization': True,
    'postgresql.statement_timeout': 20,
    'sqlalchemy.url': 'dummy@dummy',
    'retry.attempts': 3,
    # some file specific stuff for testing
    'file_upload_bucket': 'test-wfout-bucket',
    'file_wfout_bucket': 'test-wfout-bucket',
    'file_upload_profile_name': 'test-profile',
    'metadata_bundles_bucket': 'elasticbeanstalk-fourfront-cgaplocal-test-metadata-bundles',
}


def make_app_settings_dictionary():
    return _app_settings.copy()


ORDER = [
    'user', 'project', 'institution', 'filter_set', 'nexus',
    'file_format', 'variant_consequence', 'phenotype',
    'cohort', 'family', 'individual', 'sample', 'workflow',
    'access_key', 'disorder', 'document', 'file_fastq',
    'file_processed', 'file_reference', 'note_standard', 'note_interpretation',
    'gene', 'gene_list', 'sample_processing', 'case', 'report', 'page',
    'quality_metric_fastqc', 'evidence_dis_pheno', 'quality_metric_bamcheck',
    'quality_metric_qclist', 'quality_metric_wgs_bamqc', 'quality_metric_cmphet',
    'quality_metric_vcfcheck', 'quality_metric_workflowrun',
    'quality_metric_vcfqc', 'quality_metric_bamqc', 'quality_metric_peddyqc',
    'software', 'static_section', 'tracking_item', 'workflow_mapping',
    'workflow_run_awsem', 'workflow_run', 'annotation_field', 'variant_sample',
    'variant', 'variant_sample_list', 'gene_annotation_field', # 'gene',
    'higlass_view_config', 'ingestion_submission'
]
