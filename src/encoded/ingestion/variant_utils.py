import io
import os
import json
import structlog
from tqdm import tqdm
from ..inheritance_mode import InheritanceMode
from ..server_defaults import add_last_modified
from ..loadxl import LOADXL_USER_UUID
from ..types.variant import build_variant_display_title, ANNOTATION_ID_SEP, build_variant_sample_annotation_id
from ..util import resolve_file_path
from .common import CGAP_CORE_PROJECT, CGAP_CORE_INSTITUTION, IngestionReport


log = structlog.getLogger(__name__)


class IngestionConfigError(Exception):
    pass


class IngestionConfig:
    """ Data class that packages arguments necessary for invoking variant ingestion. """

    def __init__(self, vcf, gene_list=None):
        self.VARIANT_TABLE = resolve_file_path('annotations/variant_table_v0.5.1.csv')
        self.GENE_TABLE = resolve_file_path('annotations/gene_table_v0.4.6.csv')
        self.VARIANT_ANNOTATION_FIELD_SCHEMA = resolve_file_path('schemas/annotation_field.json')
        self.GENE_ANNOTATION_FIELD_SCHEMA = resolve_file_path('schemas/gene_annotation_field.json')
        self.vcf = vcf  # assume path to VCF does not require any resolution (ie: full absolute/relative path)
        self.GENE_LIST = None
        if gene_list:
            self.GENE_LIST = gene_list  # same assumption as above
        self.validate()

    def extract_class_fields(self):
        """ This function does a neat trick to resolve the class fields defined above that have values.
            It extracts all fields in dir that are not __ prefixed, not callable and have a value.
            In this case, these fields are all file paths that are validated in the below method.
        """
        return filter(lambda f: not f.startswith('__') and not callable(getattr(self, f)) and
                      getattr(self, f, None) is not None, dir(self))

    def validate(self):
        """ Validates fields set above map to files that exist. """
        for field in self.extract_class_fields():
            if not os.path.exists(getattr(self, field)):
                raise IngestionConfigError('Required file location does not exist: %s' % field)


class VariantBuilder:
    """ Class used globally to build variants/variant samples. """

    def __init__(self, vapp, vcf_parser, file, project=CGAP_CORE_PROJECT, institution=CGAP_CORE_INSTITUTION):
        self.vapp = vapp  # VirtualApp handle to application
        self.parser = vcf_parser  # VCF Parser
        self.project = project  # project/institution to post these items under
        self.institution = institution
        self.file = file  # source VCF file, should be the accession of a processed file
        self.ingestion_report = IngestionReport()

    def _add_project_and_institution(self, obj, variant=False):
        """ Helper function that adds project/institution to the given dict object. """
        if variant:  # variants are always part of CGAP CORE
            obj['project'] = CGAP_CORE_PROJECT
            obj['institution'] = CGAP_CORE_INSTITUTION
        else:
            obj['project'] = self.project
            obj['institution'] = self.institution

    @staticmethod
    def _set_shared_obj_status(obj):
        """ Helper function that sets status to 'shared' on the given dict object. """
        obj['status'] = 'shared'

    def _post_or_patch_variant(self, variant):
        """ POST/PATCH the variant ie: create it if it doesn't exist, or update existing.
            NOTE: snovault does not implement standard HTTP PUT.
        """
        try:
            res = self.vapp.post_json('/variant', variant, status=201)
        except Exception as e:  # noqa exceptions thrown by the above call are not reported correctly
            log.info('Exception encountered on variant post (attempting patch): %s' % e)
            res = self.vapp.patch_json('/variant/%s' % build_variant_display_title(
                variant['CHROM'],
                variant['POS'],
                variant['REF'],
                variant['ALT'],
                sep=ANNOTATION_ID_SEP
            ), variant, status=200)
        return res.json

    def _post_or_patch_variant_sample(self, variant_sample, variant_uuid):
        """ POST/PATCH the variant_sample ie: create it if it doesn't exist, or update existing.
            The VariantSample annotation_id format is (see variant.py):
                "CALL_INFO:variant_uuid:file_accession"

            NOTE: snovault does not implement standard HTTP PUT.
        """
        try:
            self.vapp.post_json('/variant_sample', variant_sample, status=201)
        except Exception as e:  # noqa exceptions thrown by the above call are not reported correctly
            log.info('Exception encountered on variant_sample post (attempting patch): %s' % e)
            self.vapp.patch_json('/variant_sample/%s' %
                                 build_variant_sample_annotation_id(variant_sample['CALL_INFO'],
                                                                    variant_uuid, self.file),
                                 variant_sample,
                                 status=200)

    def build_variant(self, record):
        """ Builds a raw variant from the given VCF record. """
        raw_variant = self.parser.create_variant_from_record(record)
        self._add_project_and_institution(raw_variant)
        self._set_shared_obj_status(raw_variant)
        self.parser.format_variant_sub_embedded_objects(raw_variant)
        add_last_modified(raw_variant, userid=LOADXL_USER_UUID)
        return raw_variant

    def search_for_sample_relations(self):
        """ Helper function for below method that is easy to mock. """
        search_qs = '/search/?type=SampleProcessing&processed_files.accession=%s' % self.file
        try:
            search_result = self.vapp.get(search_qs).json['@graph']
        except Exception as e:  # will catch 404
            log.error('No sample_processing found for this VCF! Familial relations will be absent. Error: %s' % e)
            raise e
        return search_result

    def extract_sample_relations(self):
        """ Searches the application for a single SampleProcessing file with the to-be-ingested VCF file
            as a processed file. When located, sample_relation info is processed to be added to
            all variant sample items. """
        sample_relations = {}
        search_result = self.search_for_sample_relations()
        if not search_result:
            return sample_relations
        sample_processing = search_result[0]
        sample_pedigrees = sample_processing.get('samples_pedigree', [])
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

    def post_variant_consequence_items(self):
        """ Posts variant_consequence items under the given project/institution. Required for poasting variants.

        :param virtualapp: application_handle to post under
        :param project: project to post under
        :param institution: institution to post under
=       """
        with io.open(resolve_file_path('annotations/variant_consequence.json'), 'r') as f:
            vcs = json.load(f)
            for entry in vcs:
                entry['project'] = self.project
                entry['institution'] = self.institution
                try:
                    self.vapp.post_json('/variant_consequence', entry, status=201)
                except Exception as e:  # can happen with master-inserts collision
                    log.error('Failed to post variant consequence %s' % str(e))

    def ingest_vcf(self, use_tqdm=False):
        """ Ingests the VCF, building/posting variants and variant samples until done, creating a report
            at the end of the run. """
        sample_relations = self.extract_sample_relations()
        for idx, record in enumerate(self.parser if not use_tqdm else tqdm(self.parser)):

            # build the items
            try:
                variant = self.build_variant(record)
                variant_samples = self.build_variant_samples(variant, record, sample_relations)
            except Exception as e:
                log.info('Error encountered building variant/variant_sample: %s' % e)
                self.ingestion_report.mark_failure(body=str(e), row=idx)
                continue

            # Post/Patch Variants/Samples
            try:
                variant_response = self._post_or_patch_variant(variant)
                variant_uuid = variant_response['@graph'][0]['uuid']
                for sample in variant_samples:
                    self._post_or_patch_variant_sample(sample, variant_uuid)
                self.ingestion_report.mark_success()
            except Exception as e:
                log.info('Error encountered posting variant/variant_sample: %s' % e)
                self.ingestion_report.mark_failure(body=str(e), row=idx)

        return self.ingestion_report.total_successful(), self.ingestion_report.total_errors()
