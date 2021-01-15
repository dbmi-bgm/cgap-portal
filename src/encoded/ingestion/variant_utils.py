import structlog
from ..inheritance_mode import InheritanceMode
from ..server_defaults import add_last_modified
from ..loadxl import LOADXL_USER_UUID
from ..types.variant import build_variant_display_title, ANNOTATION_ID_SEP
from .common import CGAP_CORE_PROJECT, CGAP_CORE_INSTITUTION, IngestionReport


log = structlog.getLogger(__name__)


class VariantBuilder:
    """ Class used globally to build variants/variant samples. """

    def __init__(self, vapp, vcf_parser, file, project=CGAP_CORE_PROJECT, institution=CGAP_CORE_INSTITUTION):
        self.vapp = vapp  # VirtualApp handle to application
        self.parser = vcf_parser  # VCF Parser
        self.project = project  # project/institution to post these items under
        self.institution = institution
        self.file = file  # source VCF file, should be the accession of a processed file
        self.ingestion_report = IngestionReport()

    def _add_project_and_institution(self, obj):
        obj['project'] = self.project
        obj['institution'] = self.institution

    @staticmethod
    def _set_shared_obj_status(obj):
        obj['status'] = 'shared'

    def _post_or_patch_variant(self, variant):
        """ Tries to post the given variant to the application. If 201 is not encountered, assume the
            variant is already present and should be patched (ie: we update variants we've seen before with
            the latest annotations from the most recent VCF from which the variant has been seen. """
        try:
            self.vapp.post_json('/variant', variant, status=201)
        except Exception:  # XXX: HTTPConflict should be thrown and appears to be yet it is not caught
            self.vapp.patch_json('/variant/%s' % build_variant_display_title(
                variant['CHROM'],
                variant['POS'],
                variant['REF'],
                variant['ALT'],
                sep=ANNOTATION_ID_SEP
            ), variant, status=200)

    def _post_variant_sample(self, variant_sample):
        try:
            self.vapp.post_json('/variant_sample', variant_sample, status=201)
        except Exception as e:
            log.error('Encountered exception posting variant_sample: %s' % e)
            raise  # propagate/report if error occurs here

    def build_variant(self, record):
        """ Parses the VCF row, adding required fields/formatting. """
        raw_variant = self.parser.create_variant_from_record(record)
        self._add_project_and_institution(raw_variant)
        self._set_shared_obj_status(raw_variant)
        self.parser.format_variant_subembedded_objects(raw_variant)
        add_last_modified(raw_variant, userid=LOADXL_USER_UUID)
        return raw_variant

    def extract_sample_relations(self):
        """ Searches the application for a single SampleProcessing file with the to-be-ingested VCF file
            as a processed file. When located, sample_relation info is processed to be added to
            all variant sample items. """
        search_qs = '/search/?type=SampleProcessing&processed_files.accession=%s' % self.file
        search_result = []
        sample_relations = {}
        try:
            search_result = self.vapp.get(search_qs).json['@graph']
        except Exception as e:  # will catch 404
            log.error('No sample_processing found for this VCF! Familial relations will be absent. Error: %s' % e)
        if len(search_result) > 1:
            log.error('Ambiguous sample_processing detected for vcf %s, search: %s' % (self.file, search_qs))
        else:  # one result
            sample_procesing = search_result[0]
            sample_pedigrees = sample_procesing.get('samples_pedigree', [])
            for entry in sample_pedigrees:
                sample_id = entry['sample_name']
                sample_relations[sample_id] = {}
                for field, key in zip(['relationship', 'sex'], ['samplegeno_role', 'samplegeno_sex']):
                    value = entry.get(field, None)
                    if value is not None:
                        sample_relations[sample_id][key] = value
        return sample_relations

    def build_variant_samples(self, variant, record, sample_relations):
        """ Builds variant samples from the record row, returning the resulting samples. """
        if variant is None:
            return []
        variant_samples = self.parser.create_sample_variant_from_record(record)
        for sample in variant_samples:
            sample['project'] = self.project
            sample['institution'] = self.institution
            sample['variant'] = build_variant_display_title(variant['CHROM'], variant['POS'], variant['REF'],
                                                            variant['ALT'], sep=ANNOTATION_ID_SEP)
            sample['file'] = self.file

            # add familial relations to samplegeno field
            for geno in sample.get('samplegeno', []):
                sample_id = geno['samplegeno_sampleid']
                if sample_id in sample_relations:
                    geno.update(sample_relations[sample_id])

            # add inheritance mode information
            variant_name = sample['variant']
            chrom = variant_name[variant_name.index('chr') + 3]  # find chr* and get *
            sample.update(InheritanceMode.compute_inheritance_modes(sample, chrom=chrom))
            add_last_modified(variant, userid=LOADXL_USER_UUID)
        return variant_samples

    def ingest_vcf(self):
        """ Ingests the VCF, building/posting variants and variant samples until done, creating a report
            at the end of the run. """
        sample_relations = self.extract_sample_relations()
        for idx, record in enumerate(self.parser):
            log.info('Parsing record %s' % record)

            # build the items
            try:
                variant = self.build_variant(record)
                variant_samples = self.build_variant_samples(record, variant, sample_relations)
            except Exception as e:
                log.error('Error encountered building variant/variant_sample: %s' % e)
                self.ingestion_report.mark_failure(body=str(e), row=idx)
                continue

            # post the items
            try:
                self._post_or_patch_variant(variant)
                for sample in variant_samples:
                    self._post_variant_sample(sample)
                self.ingestion_report.mark_success()
            except Exception as e:
                log.error('Error encountered posting variant/variant_sample: %s' % e)
                self.ingestion_report.mark_failure(body=str(e), row=idx)

        return self.ingestion_report.total_successful(), self.ingestion_report.total_errors()
