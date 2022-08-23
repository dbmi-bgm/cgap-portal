from copy import deepcopy

from snovault import (
    calculated_property,
    collection,
    load_schema,
)

from .base import (
    Item,
    get_item_or_none
)
from .family import Family
from ..util import title_to_snake_case


def _build_sample_embedded_list():
    """Helper function to create embedded list for sample."""
    return [
        # File linkTo
        "files.status",
        "files.file_format.file_format",
        "files.accession",

        # File linkTo
        "cram_files.status",
        "cram_files.accession",
        "cram_files.file_format.file_format",

        # File linkTo
        "processed_files.accession",
        "processed_files.file_format.file_format",
        "processed_files.workflow_run_outputs.@id"
    ]


@collection(
    name='samples',
    unique_key='accession',
    properties={
        'title': 'Samples',
        'description': 'Listing of Samples',
    })
class Sample(Item):
    item_type = 'sample'
    name_key = 'accession'
    schema = load_schema('encoded:schemas/sample.json')
    rev = {'indiv': ('Individual', 'samples')}
    embedded_list = _build_sample_embedded_list()

    @calculated_property(schema={
        "title": "Individual",
        "description": "Individual the sample belongs to",
        "type": "string",
        "linkTo": "Individual"
    })
    def individual(self, request):
        indivs = self.rev_link_atids(request, "indiv")
        if indivs:
            return indivs[0]

    @calculated_property(schema={
        "title": "Requisition Completed",
        "description": "True when Requisition Acceptance fields are completed",
        "type": "boolean"
    })
    def requisition_completed(self, request):
        props = self.properties
        req = props.get('requisition_acceptance', {})
        if req:
            if req.get('accepted_rejected') == 'Accepted':
                return True
            elif req.get('accepted_rejected') == 'Rejected' and req.get('date_completed'):
                return True
            else:
                return False
        elif any(props.get(item) for item in [
            'specimen_accession_date', 'specimen_accession',
            'date_requisition_received', 'accessioned_by'
        ]):
            return False


def _build_sample_processing_embedded_list():
    """Helper function to build embedded list for sample_processing."""
    return [
        # File linkTo
        "processed_files.accession",  # used to locate this file from annotated VCF via search
        "processed_files.variant_type",
        "processed_files.file_type",
        "processed_files.upload_key", # used by Higlass browsers
        "processed_files.higlass_file", # used by Higlass browsers

        # Sample linkTo
        "samples.completed_processes",
        "samples.processed_files.uuid",
    ]


@collection(
    name='sample-processings',
    properties={
        'title': 'SampleProcessings',
        'description': 'Listing of Sample Processings',
    })
class SampleProcessing(Item):
    item_type = 'sample_processing'
    schema = load_schema('encoded:schemas/sample_processing.json')
    embedded_list = _build_sample_processing_embedded_list()
    rev = {'case': ('Case', 'sample_processing')}

    @calculated_property(schema={
        "title": "Cases",
        "description": "The case(s) this sample processing is for",
        "type": "array",
        "items": {
            "title": "Case",
            "type": "string",
            "linkTo": "Case"
        }
    })
    def cases(self, request):
        rs = self.rev_link_atids(request, "case")
        if rs:
            return rs

    @calculated_property(schema={
        "title": "Samples Pedigree",
        "description": "Relationships to proband for samples.",
        "type": "array",
        "items": {
            "title": "Sample Pedigree",
            "type": "object",
            "properties": {
                "individual": {
                    "title": "Individual",
                    "type": "string"
                },
                "sample_accession": {
                    "title": "Individual",
                    "type": "string"
                },
                "sample_name": {
                    "title": "Individual",
                    "type": "string"
                },
                "parents": {
                    "title": "Parents",
                    "type": "array",
                    "items": {
                        "title": "Parent",
                        "type": "string"
                    }
                },
                "association": {
                    "title": "Individual",
                    "type": "string",
                    "enum": [
                        "paternal",
                        "maternal"
                    ]
                },
                "sex": {
                    "title": "Sex",
                    "type": "string",
                    "enum": [
                        "F",
                        "M",
                        "U"
                    ]
                },
                "relationship": {
                    "title": "Relationship",
                    "type": "string"
                },
                "bam_location": {
                    "title": "Bam File Location",
                    "type": "string"
                }
                }
            }
        })
    def samples_pedigree(self, request, families=None, samples=None):
        """Filter Family Pedigree for samples to be used in QCs"""
        # If there are multiple families this will be problematic, return empty
        # We will need to know the context
        samples_pedigree = []
        if not families or not samples:
            return samples_pedigree
        # this part will need word (ie disregard relations and just return parents)
        if len(families) != 1:
            return samples_pedigree
        family = families[0]

        # get relationship from family
        fam_data = get_item_or_none(request, family, 'families')
        if not fam_data:
            return samples_pedigree
        proband = fam_data.get('proband', '')
        members = fam_data.get('members', [])
        if not proband or not members:
            return samples_pedigree
        family_id = fam_data['accession']
        # collect members properties
        all_props = []
        for a_member in members:
            # This might be a step to optimize if families get larger
            # TODO: make sure all mother fathers are in member list, if not fetch them too
            #  for complete connection tracing
            props = get_item_or_none(request, a_member, 'individuals')
            all_props.append(props)
        relations = Family.calculate_relations(proband, all_props, family_id)

        for a_sample in samples:
            temp = {
                "individual": "",
                "sample_accession": "",
                "sample_name": "",
                "parents": [],
                "relationship": "",
                "sex": "",
                # "bam_location": "" optional, add if exists
                # "association": ""  optional, add if exists
            }
            mem_infos = [i for i in all_props if a_sample in i.get('samples', [])]
            if not mem_infos:
                continue
            mem_info = mem_infos[0]
            sample_info = get_item_or_none(request, a_sample, 'samples')

            # find the bam file
            sample_processed_files = sample_info.get('processed_files', [])
            sample_bam_file = ''
            # no info about file formats on object frame of sample
            # cycle through files (starting at most recent) and check the format
            for a_file in sample_processed_files[::-1]:
                file_info = get_item_or_none(request, a_file, 'files-processed')
                if not file_info:
                    continue
                # if format is bam, record the upload key and exit loop
                if file_info.get('file_format') == "/file-formats/bam/":
                    sample_bam_file = file_info.get('upload_key', '')
                    break
            # if bam file location was found, add it to temp
            if sample_bam_file:
                temp['bam_location'] = sample_bam_file

            # fetch the calculated relation info
            relation_infos = [i for i in relations if i['individual'] == mem_info['accession']]
            # fill in temp dict
            temp['individual'] = mem_info['accession']
            temp['sex'] = mem_info.get('sex', 'U')
            parents = []
            for a_parent in ['mother', 'father']:
                if mem_info.get(a_parent):
                    # extract accession from @id
                    mem_acc = mem_info[a_parent].split('/')[2]
                    parents.append(mem_acc)
            temp['parents'] = parents
            temp['sample_accession'] = sample_info['display_title']
            temp['sample_name'] = sample_info.get('bam_sample_id', '')
            if relation_infos:
                relation_info = relation_infos[0]
                temp['relationship'] = relation_info.get('relationship', '')
                if relation_info.get('association', ''):
                    temp['association'] = relation_info.get('association', '')
            samples_pedigree.append(temp)
        return samples_pedigree

    @calculated_property(schema={
        "title": "Quality Control Display",
        "description": "Select quality control metrics for associated samples",
        "type": "array",
        "items": {
            "title": "",
            "description": "",
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "sample_identifier": {
                    "title": "",
                    "description": "",
                    "type": "string",
                },
                "sample_properties": {
                    "title": "",
                    "description": "",
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "flag": {
                            "title": "",
                            "description": "",
                            "type": "string",
                            "enum": [
                                "pass",
                                "warn",
                                "fail",
                            ],
                        },
                        "sex": {
                        },
                    },
                },
                "flag": {
                },
            }
        }
    })
    def qc_display(self, samples=None, files_processed=None):
        """"""


class QualityMetricParser:

    FLAG = "flag"
    FLAG_PASS = "pass"
    FLAG_WARN = "warn"
    FLAG_FAIL = "fail"
    RANKED_FLAGS = {
        FLAG_PASS: 0,
        FLAG_WARN: 1,
        FLAG_FAIL: 2,
    }

    WORKUP_TYPE = "workup_type"

    SEX = "sex"
    PREDICTED_SEX = "predicted_sex"
    ANCESTRY = "ancestry"
    PREDICTED_ANCESTRY = "predicted_ancestry"
    TOTAL_NUMBER_OF_READS = "total_number_of_reads"
    COVERAGE = "coverage"
    TOTAL_VARIANTS_CALLED = "total_variants_called"
    FILTERED_VARIANTS = "filtered_variants"
    FILTERED_STRUCTURAL_VARIANTS = "filtered_structural_variants"
    HETEROZYGOSITY_RATIO = "heterozygosity_ratio"
    TRANSITION_TRANSVERSION_RATIO = "transition_transversion_ratio"
    DE_NOVO_FRACTION = "de_novo_fraction"

    SAMPLE_IDENTIFIER = "sample_identifier"
    SAMPLE_PROPERTIES = "sample_properties"

    SAMPLE_PROPERTIES_TO_FIND = set([SEX, ANCESTRY, WORKUP_TYPE])
    QC_PROPERTIES_TO_FIND = set(
        [
            PREDICTED_SEX,
            PREDICTED_ANCESTRY,
            TOTAL_NUMBER_OF_READS,
            COVERAGE,
            TOTAL_VARIANTS_CALLED,
            FILTERED_VARIANTS,
            HETEROZYGOSITY_RATIO,
            TRANSITION_TRANSVERSION_RATIO,
            DE_NOVO_FRACTION,
        ]
    )
    SAMPLE_PROPERTIES_TO_KEEP = QC_PROPERTIES_TO_FIND | set(
        [FILTERED_STRUCTURAL_VARIANTS, SEX, ANCESTRY]
    )
    QC_PROPERTY_NAMES_TO_LINKS = {
        PREDICTED_SEX: "peddy_qc_download",
        PREDICTED_ANCESTRY: "peddy_qc_download",
    }

    BAM_FILE_FORMAT_ATID = "/file-formats/bam/"

    def __init__(self, request):
        """"""
        self.request = request
        self.sample_mapping = {}
        self.qc_property_to_evaluator = {
            self.COVERAGE: self.flag_bam_coverage,
            self.PREDICTED_SEX: self.flag_sex_consistency,
            self.HETEROZYGOSITY_RATIO: self.flag_heterozygosity_ratio,
            self.TRANSITION_TRANSVERSION_RATIO: self.flag_transition_transversion_ratio,
            self.DE_NOVO_FRACTION: self.flag_de_novo_fraction,
        }

    def get_item(self, item_atid):
        """"""
        result = None
        if isinstance(item_atid, str):
            item_collection = item_atid.split("/")[0]
            result = get_item_or_none(self.request, item_atid, item_collection)
        return result

    def get_qc_display_results(self, samples, processed_files):
        """"""
        # Look for final VCF first; if not present, return None?
        # Start to aggregate final VCF results for all samples
        if samples:
            for sample_atid in samples:
                sample_item = self.get_item(sample_atid)
                if not sample_item:
                    # Log?
                    continue
                self.collect_sample_data(sample_item)
        if processed_files:
            self.collect_sample_processing_processed_files_data(processed_files)
        self.add_flags_to_samples()
        self.add_overall_flag()
        result = self.reformat_sample_mapping_to_schema()
        return result

    def collect_sample_processing_processed_files_data(self, processed_files):
        """"""
        snv_vcf_found = False
        vep_vcf_found = False
        sv_vcf_found = False
        for processed_file_atid in processed_files[::-1]:
            file_item = self.get_item(processed_file_atid)
            if not file_item:
                # Log?
                continue
            file_format_atid = file_item.get("file_format")
            if file_format_atid != "/file-formats/vcf_gz/":
                continue
            file_type = file_item.get("file_type", "")
            file_vcf_to_ingest = file_item.get("vcf_to_ingest", False)
            file_variant_type = file_item.get("variant_type", "SNV")
            if file_type == "full annotated VCF" or file_vcf_to_ingest is True:
                if file_variant_type == "SNV":
                    if snv_vcf_found:
                        continue
                    snv_vcf_found = True
                    self.associate_vcf_metrics_with_samples(file_item)
                elif file_variant_type == "SV":
                    if sv_vcf_found:
                        continue
                    sv_vcf_found = True
                    property_replacements = {
                        self.FILTERED_VARIANTS: self.FILTERED_STRUCTURAL_VARIANTS
                    }
                    self.associate_vcf_metrics_with_samples(
                        file_item, property_replacements=property_replacements
                    )
            elif (
                not vep_vcf_found
                and file_variant_type == "SNV"
                and "vep-annotated" in file_type.lower()  # Pretty fragile
            ):
                vep_vcf_found = True
                peddy_qc_atid = None
                link_mapping = {}
                qc_list = file_item.get("qc_list", [])
                for item in qc_list:
                    qc_type = item.get("qc_type")
                    if "peddyqc" in qc_type:
                        peddy_qc_atid = item.get("value")
                        break
                if peddy_qc_atid:
                    link_mapping["peddy_qc_download"] = peddy_qc_atid + "@@download"
                self.associate_vcf_metrics_with_samples(
                    file_item, links=link_mapping
                )
            if snv_vcf_found and sv_vcf_found and vep_vcf_found:
                break

    def associate_vcf_metrics_with_samples(
        self, vcf_file, qc_links=None, property_replacements=None
    ):
        """"""
        quality_metric_atid = vcf_file.get("quality_metric")
        quality_metric_item = self.get_item(quality_metric_atid)
        if quality_metric_item:
            quality_metric_summary = quality_metric_item.get(
                "quality_metric_summary", []
            )
            for item in quality_metric_summary:
                item_sample = item.get("sample")
                sample_props = self.sample_mapping.get(item_sample)
                if sample_props is None:
                    # log
                    continue
                self.add_qc_property_to_sample_info(
                    sample_props, item, qc_links=qc_links,
                    property_replacements=property_replacements,
                )

    def add_qc_property_to_sample_info(
        self, sample_qc_properties, qc_summary_item, qc_links=None,
        property_replacements=None,
    ):
        """"""
        title = qc_summary_item.get("title")
        schema_title = title_to_snake_case(title)
        if schema_title in self.QC_PROPERTIES_TO_FIND:
            if property_replacements:
                replacement_title = property_replacements.get(schema_title)
                if replacement_title:
                    schema_title = replacement_title
            value = qc_summary_item.get("value")
            number_type = qc_summary_item.get("numberType")
            tooltip = qc_summary_item.get("tooltip")
            qc_title_properties = {
                "value": value,
                "number_type": number_type,
            }
            if tooltip:
                qc_title_properties["tooltip"] = tooltip
            if qc_links:
                link_to_add = self.QC_PROPERTY_NAMES_TO_LINKS.get(schema_title)
                link = qc_links.get(link_to_add)
                if link:
                    qc_title_properties["link"] = link
            qc_flag = self.add_flags_for_qc_value(
                sample_qc_properties, schema_title, value
            )
            if qc_flag:
                qc_title_properties[self.FLAG] = qc_flag
            sample_qc_properties[schema_title] = qc_title_properties

    def add_flags_for_qc_value(self, sample_qc_properties, qc_title, qc_value):
        """"""
        result = None
        evaluator = self.qc_property_to_evaluator.get(qc_title)
        if evaluator:
            result = evaluator(qc_value, sample_qc_properties)
        return result

    def collect_sample_data(self, sample_item):
        """"""
        sample_qc_properties = {}
        individual_atid = sample_item.get("individual")
        if individual_atid:
            self.collect_individual_data(individual_atid, sample_qc_properties)
        processed_files = sample_item.get("processed_files")
        if processed_files:
            self.collect_sample_processed_files_data(processed_files, sample_qc_properties)
        workup_type = sample_item.get("workup_type")
        if workup_type:
            sample_qc_properties["sequence_type"] = workup_type
        bam_sample_id = sample_item.get("bam_sample_id")
        if bam_sample_id:
            self.sample_mapping[bam_sample_id] = sample_qc_properties

    def collect_individual_data(self, individual_atid, sample_info):
        """"""
        individual_item = self.get_item(individual_atid)
        if individual_item:
            properties_to_get = ["sex", "ancestry"]
            for property_to_get in properties_to_get:
                value = individual_item.get(property_to_get)
                if value:
                    sample_info[property_to_get] = value

    def collect_sample_processed_files_data(self, processed_file_atids, sample_info):
        """"""
        for processed_file_atid in processed_file_atids[::-1]:
            file_item = self.get_item(processed_file_atid)
            if not file_item:
                # Log
                continue
            file_format = file_item.get("file_format")
            if file_format == self.BAM_FILE_FORMAT_ATID:
                self.collect_bam_quality_metric_values(file_item, sample_info)
                break

    def collect_bam_quality_metric_values(self, file_item, sample_info):
        """"""
        quality_metric_atid = file_item.get("quality_metric")
        if quality_metric_atid:
            quality_metric_item = self.get_item(quality_metric_atid)
            if not quality_metric_item:
                # Log?
                pass
            summary = quality_metric_item.get("quality_metric_summary", [])
            for item in summary:
                self.add_qc_property_to_sample_info(sample_info, item)

    def add_flags_for_samples(self):
        """"""
        for sample_info in self.sample_mapping.values():
            worst_flag = None
            worst_flag_rank = -1
            for qc_field, qc_field_value in sample_info.items():
                if not isinstance(qc_field_value, dict):
                    continue
                flag = qc_field_value.get(self.FLAG)
                if flag is None:
                    continue
                flag_rank = self.RANKED_FLAGS.get(flag, -1)
                if flag_rank > worst_flag_rank:
                    worst_flag_rank = flag_rank
                    worst_flag = flag
            if worst_flag is not None:
                sample_info[self.FLAG] = worst_flag

    def add_overall_flag(self):
        """"""
        worst_flag = None
        worst_flag_rank = -1
        for sample_info in self.sample_mapping.values():
            sample_flag = sample_info.get(self.FLAG)
            sample_flag_rank = self.RANKED_FLAGS.get(sample_flag, -1)
            if sample_flag_rank > worst_flag_rank:
                worst_flag_rank = sample_flag_rank
                worst_flag = sample_flag
        if worst_flag is not None:
            self.sample_mapping[self.FLAG] = worst_flag

    def flag_bam_coverage(self, coverage_string, sample_properties, *args, **kwargs):
        """"""
        result = None
        coverage = None
        sequencing_type = sample_properties.get("sequencing_type")
        if isinstance(coverage_string, str):
            coverage_number_string = coverage_string.rstrip("X")
            try:
                coverage = float(coverage_number_string)
            except ValueError:
                # log
                pass
        if coverage is not None:
            if sequencing_type == "WGS":
                warn_limit = 20
                fail_limit = 10
            elif sequencing_type == "WES":
                warn_limit = 60
                fail_limit = 40
            else:
                warn_limit = 0
                fail_limit = 0
            if coverage > warn_limit:
                result = self.FLAG_PASS
            elif coverage < fail_limit:
                result = self.FLAG_FAIL
            elif coverage < warn_limit:
                result = self.FLAG_WARN
        return result

    def flag_sex_consistency(self, predicted_sex, sample_properties, *args, **kwargs):
        """"""
        result = None
        submitted_sex = sample_properties.get(self.SEX)
        if submitted_sex is not None:
            if not isinstance(predicted_sex, str) or not predicted_sex:
                result = self.FLAG_WARN
            predicted_sex_short_form = predicted_sex.upper()[0]
            if predicted_sex_short_form == submitted_sex:
                result = self.FLAG_PASS
            elif predicted_sex_short_form not in ["M", "F"]:
                result = self.FLAG_FAIL
            elif submitted_sex != predicted_sex_short_form:
                result = self.FLAG_WARN
        return result

    def flag_heterozygosity_ratio(self, heterozygosity_ratio, *args, **kwargs):
        """"""
        result = None
        if isinstance(heterozygosity_ratio, str):
            try:
                heterozygosity_ratio = float(heterozygosity_ratio)
            except Exception:
                # log
                pass
        if isinstance(heterozygosity_ratio, float):
            upper_limit = 2.5
            lower_limit = 1.4
            if heterozygosity_ratio > upper_limit:
                result = self.FLAG_WARN
            elif heterozygosity_ratio < lower_limit:
                result = self.FLAG_WARN
            else:
                result = self.FLAG_PASS
        return result

    def flag_transition_transversion_ratio(
        self, transition_transversion_ratio, sample_properties, *args, **kwargs
    ):
        """"""
        result = None
        transition_transversion_float = None
        if isinstance(transition_transversion_ratio, str):
            try:
                transition_transversion_float = float(transition_transversion_ratio)
            except ValueError:
                # log
                pass
        if transition_transversion_float is not None:
            known_sequencing_type = False
            sequencing_type = sample_properties.get("sequencing_type")
            if sequencing_type == "WGS":
                known_sequencing_type = True
                warn_upper_limit = 2.1
                warn_lower_limit = 1.8
                fail_upper_limit = 2.3
                fail_lower_limit = 1.6
            elif sequencing_type == "WES":
                known_sequencing_type = True
                warn_upper_limit = 3.3
                warn_lower_limit = 2.3
                fail_upper_limit = 3.5
                fail_lower_limit = 2.1
            if known_sequencing_type:
                if transition_transversion_ratio > fail_upper_limit:
                    result = self.FLAG_FAIL
                elif transition_transversion_ratio < fail_lower_limit:
                    result = self.FLAG_FAIL
                elif transition_transversion_ratio > warn_upper_limit:
                    result = self.FLAG_WARN
                elif transition_transversion_ratio < warn_lower_limit:
                    result = self.FLAG_WARN
                else:
                    result = self.FLAG_PASS
        return result

    def flag_de_novo_fraction(self, de_novo_fraction, *args, **kwargs):
        """"""
        result = None
        if isinstance(de_novo_fraction, str):
            try:
                de_novo_fraction = float(de_novo_fraction)
            except Exception:
                # log
                pass
        if isinstance(de_novo_fraction, float):
            upper_limit = 5
            if de_novo_fraction > upper_limit:
                result = self.FLAG_FAIL
            else:
                result = self.FLAG_PASS
        return result

    def reformat_sample_mapping_to_schema(self):
        """"""
        result = []
        for sample_identifier, sample_qc_properties in self.sample_mapping.items():
            sample_properties = {}
            sample_flag = sample_qc_properties.get(self.FLAG)
            if sample_flag:
                sample_properties[self.FLAG] = sample_flag
            for property_name in self.SAMPLE_PROPERTIES_TO_KEEP:
                property_value = sample_qc_properties.get(property_name)
                if property_value:
                    sample_properties[property_name] = property_value
            sample_result = {
                self.SAMPLE_IDENTIFIER: sample_identifier,
                self.SAMPLE_PROPERTIES: sample_properties,
            }
            result.append(sample_result)
        if not result:
            result = None
        return result
