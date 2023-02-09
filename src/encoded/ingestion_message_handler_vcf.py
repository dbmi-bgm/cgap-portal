import requests  # XXX: C4-211 should not be needed but is // KMP needs this, too, until subrequest posts work
import structlog
import tempfile
from vcf import Reader
from .ingestion.vcf_utils import VCFParser, StructuralVariantVCFParser
from .commands.reformat_vcf import runner as reformat_vcf
from .commands.add_altcounts_by_gene import main as add_altcounts
from .ingestion.variant_utils import CNVBuilder, StructuralVariantBuilder, VariantBuilder
from .util import (
    gunzip_content,
    debuglog,
)
from .ingestion_listener import IngestionListener
from .ingestion_listener_defs import (
    VARIANT_SCHEMA,
    VARIANT_SAMPLE_SCHEMA,
    STATUS_INGESTED,
    STATUS_DISABLED,
    STATUS_ERROR,
    STATUS_IN_PROGRESS,
    STRUCTURAL_VARIANT_SCHEMA,
    STRUCTURAL_VARIANT_SAMPLE_SCHEMA,
)
from ingestion_message_handler_decorator import ingestion_message_handler


log = structlog.getLogger(__name__)


@ingestion_message_handler
def ingestion_message_handler_vcf(message, ingestion_listener: IngestionListener) -> bool:
    """
    This is the part of ingestion_listener.IngestionListener.run which handles a
    single message within the (effectively-infinite) incoming message handling loop,
    specifically for CGAP; refactored out February 2023.
    Returns True if the message was successfully handled, otherwise False.
    """

    ingestion_type, uuid, _ = ingestion_listener.decompose_message(message)

    if ingestion_type != "vcf":
        return False

    # locate file meta data
    try:
        file_meta = ingestion_listener.vapp.get('/' + uuid).follow().json
        location = ingestion_listener.vapp.get(file_meta['href']).location
        log.info('Got vcf location: %s' % location)
    except Exception as e:
        log.error('Could not locate uuid: %s with error: %s' % (uuid, e))
        return False

    # if this file has been ingested (or explicitly disabled), do not do anything with this uuid
    if file_meta.get('file_ingestion_status', 'N/A') in [STATUS_INGESTED, STATUS_DISABLED]:
        log.error('Skipping ingestion of file %s due to disabled ingestion status' % uuid)
        return False

    # attempt download with workaround
    try:
        raw_content = requests.get(location).content
    except Exception as e:
        log.error('Could not download file uuid: %s with error: %s' % (uuid, e))
        return False

    # gunzip content, pass to parser, post variants/variant_samples
    # patch in progress status
    ingestion_listener.set_status(uuid, STATUS_IN_PROGRESS)
    # decoded_content = gunzip_content(raw_content)
    # debuglog('Got decoded content: %s' % decoded_content[:20])

    vcf_type = file_meta.get("variant_type", "SNV")
    if vcf_type == "SNV":
        # Apply VCF reformat
        vcf_to_be_formatted = tempfile.NamedTemporaryFile(suffix='.gz')
        vcf_to_be_formatted.write(raw_content)
        formatted = tempfile.NamedTemporaryFile()
        reformat_args = {
            'inputfile': vcf_to_be_formatted.name,
            'outputfile': formatted.name,
            'verbose': False
        }
        try:
            reformat_vcf(reformat_args)
        except Exception as e:
            log.error(f'Exception encountered in reformat script {e} - input VCF may be malformed')
            ingestion_listener.set_status(uuid, STATUS_ERROR)
            return True

        # Add altcounts by gene
        # Note: you cannot pass this file object to vcf.Reader if it's in rb mode
        # It's also not guaranteed that it reads utf-8, so pass explicitly
        formatted_with_alt_counts = tempfile.NamedTemporaryFile(mode='w+', encoding='utf-8')
        alt_counts_args = {
            'inputfile': formatted.name,
            'outputfile': formatted_with_alt_counts.name
        }
        try:
            add_altcounts(alt_counts_args)
        except Exception as e:
            log.error(f'Exception encountered in altcounts script {e} - input VCF may be malformed')
            ingestion_listener.set_status(uuid, STATUS_ERROR)
            return True
        parser = VCFParser(None, VARIANT_SCHEMA, VARIANT_SAMPLE_SCHEMA,
                           reader=Reader(formatted_with_alt_counts))
        variant_builder = VariantBuilder(ingestion_listener.vapp, parser, file_meta['accession'],
                                         project=file_meta['project']['@id'],
                                         institution=file_meta['institution']['@id'])
    elif vcf_type == "SV":
        # No reformatting necesssary for SV VCF
        decoded_content = gunzip_content(raw_content)
        debuglog('Got decoded content: %s' % decoded_content[:20])
        formatted_vcf = tempfile.NamedTemporaryFile(
            mode="w+", encoding="utf-8"
        )
        formatted_vcf.write(decoded_content)
        formatted_vcf.seek(0)
        parser = StructuralVariantVCFParser(
            None,
            STRUCTURAL_VARIANT_SCHEMA,
            STRUCTURAL_VARIANT_SAMPLE_SCHEMA,
            reader=Reader(formatted_vcf),
        )
        variant_builder = StructuralVariantBuilder(
            ingestion_listener.vapp,
            parser,
            file_meta["accession"],
            project=file_meta["project"]["@id"],
            institution=file_meta["institution"]["@id"],
        )
    elif vcf_type == "CNV":
        decoded_content = gunzip_content(raw_content)
        debuglog('Got decoded content: %s' % decoded_content[:20])
        formatted_vcf = tempfile.NamedTemporaryFile(
            mode="w+", encoding="utf-8"
        )
        formatted_vcf.write(decoded_content)
        formatted_vcf.seek(0)
        parser = StructuralVariantVCFParser(
            None,
            STRUCTURAL_VARIANT_SCHEMA,
            STRUCTURAL_VARIANT_SAMPLE_SCHEMA,
            reader=Reader(formatted_vcf),
        )
        variant_builder = CNVBuilder(
            ingestion_listener.vapp,
            parser,
            file_meta["accession"],
            project=file_meta["project"]["@id"],
            institution=file_meta["institution"]["@id"],
        )
    try:
        success, error = variant_builder.ingest_vcf()
    except Exception as e:
        # if exception caught here, we encountered an error reading the actual
        # VCF - this should not happen but can in certain circumstances. In this
        # case we need to patch error status and discard the current message.
        log.error('Caught error in VCF processing in ingestion listener: %s' % e)
        ingestion_listener.set_status(uuid, STATUS_ERROR)
        ingestion_listener.patch_ingestion_report(ingestion_listener.build_ingestion_error_report(msg=e), uuid)
        return True

    # report results in error_log regardless of status
    msg = variant_builder.ingestion_report.brief_summary()
    log.error(msg)
    if ingestion_listener.update_status is not None and callable(ingestion_listener.update_status):
        ingestion_listener.update_status(msg=msg)

    # if we had no errors, patch the file status to 'Ingested'
    if error > 0:
        ingestion_listener.set_status(uuid, STATUS_ERROR)
        ingestion_listener.patch_ingestion_report(variant_builder.ingestion_report, uuid)
    else:
        ingestion_listener.set_status(uuid, STATUS_INGESTED)

    return True
