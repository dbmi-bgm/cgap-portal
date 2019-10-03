import argparse
import structlog
import logging

from pyramid.paster import get_app
from snovault.elasticsearch.create_mapping import run as run_create_mapping
from dcicutils.log_utils import set_logging
from dcicutils.beanstalk_utils import whodaman

log = structlog.getLogger(__name__)
EPILOG = __doc__

# This order determines order that items will be mapped + added to the queue
# Can use item type (e.g. file_fastq) or class name (e.g. FileFastq)
# XXX: This order is probably not right
ITEM_INDEX_ORDER = [
    'Project',
    'Institution',
    'AccessKey',
    'User',
    'Case',
    'Ontology',
    'OntologyTerm',
    'Workflow',
    'WorkflowMapping',
    'WorkflowRun',
    'WorkflowRunAwsem',
    'Disorder',
    'FileFormat',
    'FileFastq',
    'FileProcessed',
    'FileReference',
    'Image',
    'Gene',
    'Phenotype',
    'Individual',
    'Document',
    'QualityMetricBamcheck',
    'QualityMetricFastqc',
    'QualityMetricQclist',
    'QualityMetricWgsBamqc',
    'QualityMetricWorkflowrun',
    'TrackingItem',
    'Software',
    'Sample',
    'Sysinfo',
    'StaticSection',
    'Document',
    'Page'
]


def main():
    parser = argparse.ArgumentParser(
        description="Create Elasticsearch mapping on deployment", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('config_uri', help="path to configfile")
    parser.add_argument('--app-name', help="Pyramid app name in configfile")

    args = parser.parse_args()
    app = get_app(args.config_uri, args.app_name)
    # Loading app will have configured from config file. Reconfigure here:
    set_logging(in_prod=app.registry.settings.get('production'), log_name=__name__, level=logging.DEBUG)
    # set_logging(app.registry.settings.get('elasticsearch.server'), app.registry.settings.get('production'), level=logging.DEBUG)

    # check if staging
    try:
        data_env = whodaman()
        env = app.registry.settings.get('env.name')
        if 'webprod' in env:
            if data_env != env:
                log.info("looks like we are on staging, run create mapping without check first")
                run_create_mapping(app, check_first=False, item_order=ITEM_INDEX_ORDER)
                return
        # handle mastertest ... by blowing away all data first
        if 'mastertest' in env:
            log.info("looks like we are on mastertest, run create mapping without check first")
            run_create_mapping(app, check_first=False, purge_queue=True, item_order=ITEM_INDEX_ORDER)
            return
        log.info("looks like we are NOT on staging or mastertest so run create mapping with check first")
    except Exception:
        import traceback
        log.warning("error checking whodaman: %s " % traceback.format_exc())
        log.warning("couldn't get wodaman, so assuming NOT staging")
    log.info("... using default create mapping case")
    run_create_mapping(app, check_first=True, purge_queue=True, item_order=ITEM_INDEX_ORDER)
