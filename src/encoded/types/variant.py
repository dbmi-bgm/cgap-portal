import datetime
import io
import json
import os
from urllib.parse import parse_qs, urlparse

import boto3
import negspy.coordinates as nc
import pytz
import structlog
from pyramid.httpexceptions import HTTPTemporaryRedirect
from pyramid.settings import asbool
from pyramid.view import view_config
from snovault import calculated_property, collection, load_schema
from snovault.calculated import calculate_properties
from snovault.util import debug_log

from encoded.ingestion.common import CGAP_CORE_PROJECT
from encoded.inheritance_mode import InheritanceMode
from encoded.util import resolve_file_path
from encoded.types.base import Item, get_item_or_none

log = structlog.getLogger(__name__)
ANNOTATION_ID = 'annotation_id'
ANNOTATION_ID_SEP = '_'


def extend_embedded_list(embedded_list, fd, typ, prefix=None):
    """ Extends the given embedded list with embeds from fd. Helper method for
        building embedded lists from files, used for Variant and Variant Sample
        (and gene in the future).

        :param embedded_list: embedded_list to extend
        :param fd: (open) file descriptor to read JSON from
        :param typ: lowercase snake_case item type
        :param prefix: prefix to add to every embed (if you are embedding another item's embeds)
        :raises RuntimeError: if bad type is detected for the given fd ie: you try to get variant embeds from
                              variant_sample_embeds.json
    """
    embeds = json.load(fd).get(typ, None)
    if embeds is None:
        raise RuntimeError('Bad type %s passed to create_embedded_list from file %s' % (typ, fd))
    if prefix is None:
        for _, _embeds in embeds.items():
            embedded_list.extend(_embeds)
    else:
        for _, _embeds in embeds.items():
            embedded_list.extend(prefix + e for e in _embeds)


def build_variant_embedded_list():
    """ Determines the embedded_list based on the information
        present in schemas/variant_embeds.json

        :returns: list of variant embeds
    """
    embedded_list = [
        "interpretations.classification",
        "interpretations.acmg_guidelines",
        "interpretations.conclusion",
        "interpretations.note_text",
        "interpretations.version",
        "interpretations.project",
        "interpretations.institution",
        "interpretations.status",
        "discovery_interpretations.gene_candidacy",
        "discovery_interpretations.variant_candidacy",
        "discovery_interpretations.note_text",
        "discovery_interpretations.version",
        "discovery_interpretations.project",
        "discovery_interpretations.institution",
        "discovery_interpretations.status",
        "discovery_interpretations.last_modified.date_modified",
        "discovery_interpretations.last_modified.modified_by.display_title"
    ]
    with io.open(resolve_file_path('schemas/variant_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'variant')
    return embedded_list + Item.embedded_list


def build_variant_sample_embedded_list():
    """ Determines the embedded list for variants within variant_sample
        ie: variant.* is not sufficient for things embedded into variant
        that we'd like to search on in the variant_sample context. Works
        very similary to the above function

        :returns: list of embeds from 'variant' linkTo
    """
    embedded_list = [
        "cmphet.*",
        "variant_sample_list.created_for_case",
        "variant_notes.note_text",
        "variant_notes.version",
        "variant_notes.project",
        "variant_notes.institution",
        "variant_notes.status",
        "variant_notes.last_modified.date_modified",
        "variant_notes.last_modified.modified_by.display_title",
        "gene_notes.note_text",
        "gene_notes.version",
        "gene_notes.project",
        "gene_notes.institution",
        "gene_notes.status",
        "gene_notes.last_modified.date_modified",
        "gene_notes.last_modified.modified_by.display_title",
        "interpretation.classification",
        "interpretation.acmg_guidelines",
        "interpretation.conclusion",
        "interpretation.note_text",
        "interpretation.version",
        "interpretation.project",
        "interpretation.institution",
        "interpretation.status",
        "interpretation.last_modified.date_modified",
        "interpretation.last_modified.modified_by.display_title",
        "discovery_interpretation.gene_candidacy",
        "discovery_interpretation.variant_candidacy",
        "discovery_interpretation.note_text",
        "discovery_interpretation.version",
        "discovery_interpretation.project",
        "discovery_interpretation.institution",
        "discovery_interpretation.status",
        "discovery_interpretation.last_modified.date_modified",
        "discovery_interpretation.last_modified.modified_by.display_title"
    ]
    with io.open(resolve_file_path('schemas/variant_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'variant', prefix='variant.')
    with io.open(resolve_file_path('schemas/variant_sample_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'variant_sample')
    return ['variant.*'] + embedded_list + Item.embedded_list


def build_variant_display_title(chrom, pos, ref, alt, sep='>'):
    """ Builds the variant display title. """
    return 'chr%s:%s%s%s%s' % (
        chrom,
        pos,
        ref,
        sep,
        alt
    )


def build_variant_sample_annotation_id(call_info, variant_uuid, file_accession):
    """ Helper function that builds a variant sample annotation ID from the required parts. """
    return ':'.join([call_info, variant_uuid, file_accession])


def load_extended_descriptions_in_schemas(schema_object, depth=0):
    """
    MODIFIES SCHEMA_OBJECT **IN PLACE** RECURSIVELY
    :param schema_object: A dictionary of any type that might have 'extended_description', 'properties',
        or 'items.properties'. Should be an Item schema initially.
    :param depth: Don't supply this. Used to check/optimize at depth=0 where schema_object is root of schema.
    TODO:
        Maybe reuse and/or move somewhere more global/easy-to-import-from?
        Maybe in base.py?
    """

    if depth == 0:
        # Root of Item schema, no extended_description here, but maybe facets or columns
        # have own extended_description to load also.
        if "properties" in schema_object:
            load_extended_descriptions_in_schemas(schema_object["properties"], depth + 1)
        if "facets" in schema_object:
            load_extended_descriptions_in_schemas(schema_object["facets"], depth + 1)
        if "columns" in schema_object:
            load_extended_descriptions_in_schemas(schema_object["columns"], depth + 1)

        return schema_object

    for field_name, field_schema in schema_object.items():
        if "extended_description" in field_schema:
            if field_schema["extended_description"][-5:] == ".html":
                html_file_path = os.path.join(os.path.abspath(os.path.dirname(__file__)),
                                              "../../..",
                                              field_schema["extended_description"])
                with io.open(html_file_path) as open_file:
                    field_schema["extended_description"] = "".join([ l.strip() for l in open_file.readlines() ])

        # Applicable only to "properties" of Item schema, not columns or facets:
        if "type" in field_schema:
            if field_schema["type"] == "object" and "properties" in field_schema:
                load_extended_descriptions_in_schemas(field_schema["properties"], depth + 1)
                continue

            if (field_schema["type"] == "array"
                    and "items" in field_schema
                    and field_schema["items"]["type"] == "object"
                    and "properties" in field_schema["items"]):
                load_extended_descriptions_in_schemas(field_schema["items"]["properties"], depth + 1)
                continue


@collection(
    name='variants',
    properties={
        'title': 'Variants',
        'description': 'List of all variants'
    },
    unique_key='variant:annotation_id')
class Variant(Item):
    """ Variant class """

    item_type = 'variant'
    name_key = 'annotation_id'
    schema = load_schema('encoded:schemas/variant.json')
    embedded_list = build_variant_embedded_list()

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """ Sets the annotation_id field on this variant prior to passing on. """
        properties[ANNOTATION_ID] = build_variant_display_title(
            properties['CHROM'],
            properties['POS'],
            properties['REF'],
            properties['ALT'],
            sep=ANNOTATION_ID_SEP  # XXX: replace _ with >  to get display_title('>' char is restricted)
        )
        return super().create(registry, uuid, properties, sheets)

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, CHROM, POS, REF, ALT):
        return build_variant_display_title(CHROM, POS, REF, ALT)  # chr1:504A>T

    @calculated_property(schema={
        "title": "Position (genome coordinates)",
        "description": "Absolute position in genome coordinates",
        "type": "integer"
    })
    def POS_ABS(self, CHROM, POS):
        chrom_info = nc.get_chrominfo('hg38')
        return nc.chr_pos_to_genome_pos('chr'+CHROM, POS, chrom_info)


@collection(
    name='variant-samples',
    properties={
        'title': 'Variants (sample)',
        'description': 'List of all variants with sample specific information',
    },
    unique_key='variant_sample:annotation_id')
class VariantSample(Item):
    """Class for variant samples."""

    item_type = 'variant_sample'
    schema = load_extended_descriptions_in_schemas(load_schema('encoded:schemas/variant_sample.json'))
    rev = {'variant_sample_lists': ('VariantSampleList', 'variant_samples')}
    embedded_list = build_variant_sample_embedded_list()
    FACET_ORDER_OVERRIDE = {
        'inheritance_modes': {
            InheritanceMode.INHMODE_LABEL_DE_NOVO_STRONG: 1,  # de novo (strong)
            InheritanceMode.INHMODE_LABEL_DE_NOVO_MEDIUM: 2,  # de novo (medium)
            InheritanceMode.INHMODE_LABEL_DE_NOVO_WEAK: 3,  # de novo (weak)
            InheritanceMode.INHMODE_LABEL_DE_NOVO_CHRXY: 4,  # de novo (chrXY) XXX: no GATK?
            InheritanceMode.INHMODE_LABEL_RECESSIVE: 5,  # Recessive
            'Compound Het (Phased/strong_pair)': 6,  # cmphet all auto-generated, see compute_cmphet_inheritance_modes
            'Compound Het (Phased/medium_pair)': 7,
            'Compound Het (Phased/weak_pair)': 8,
            'Compound Het (Unphased/strong_pair)': 9,
            'Compound Het (Unphased/medium_pair)': 10,
            'Compound Het (Unphased/weak_pair)': 11,
            InheritanceMode.INHMODE_LABEL_LOH: 12,  # Loss of Heterozygousity
            InheritanceMode.INHMODE_DOMINANT_MOTHER: 13,  # Dominant (maternal)
            InheritanceMode.INHMODE_DOMINANT_FATHER: 14,  # Dominant (paternal)
            InheritanceMode.INHMODE_LABEL_X_LINKED_RECESSIVE_MOTHER: 15,  # X-linked recessive (Maternal)
            InheritanceMode.INHMODE_LABEL_X_LINKED_DOMINANT_MOTHER: 16,  # X-linked dominant (Maternal)
            InheritanceMode.INHMODE_LABEL_X_LINKED_DOMINANT_FATHER: 17,  # X-linked dominant (Paternal)
            InheritanceMode.INHMODE_LABEL_Y_LINKED: 18,  # Y-linked dominant
            InheritanceMode.INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT: 19,  # Low relevance, homozygous in a parent
            InheritanceMode.INHMODE_LABEL_NONE_MN: 20,  # Low relevance, multiallelic site family
            InheritanceMode.INHMODE_LABEL_NONE_BOTH_PARENTS: 21,  # Low relevance, present in both parent(s)
            InheritanceMode.INHMODE_LABEL_NONE_DOT: 22,  # Low relevance, missing call(s) in family
            InheritanceMode.INHMODE_LABEL_NONE_SEX_INCONSISTENT: 23,  # Low relevance, mismatching chrXY genotype(s)
            '_default': 1000  # arbitrary large number
        }
    }

    POSSIBLE_GENOTYPE_LABEL_FIELDS = [
        'proband_genotype_label', 'mother_genotype_label', 'father_genotype_label',
        'sister_genotype_label', 'sister_II_genotype_label', 'sister_III_genotype_label',
        'sister_IV_genotype_label',
        'brother_genotype_label', 'brother_II_genotype_label', 'brother_III_genotype_label',
        'brother_IV_genotype_label'
        'co_parent_genotype_label',
        'daughter_genotype_label', 'daughter_II_genotype_label', 'son_genotype_label',
        'son_II_genotype_label'
    ]

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """ Sets the annotation_id field on this variant_sample prior to passing on. """
        properties[ANNOTATION_ID] = '%s:%s:%s' % (
            properties['CALL_INFO'],
            properties['variant'],
            properties['file']
        )
        return super().create(registry, uuid, properties, sheets)

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, CALL_INFO, variant=None):
        variant = get_item_or_none(request, variant, 'Variant', frame='raw')
        variant_display_title = build_variant_display_title(variant['CHROM'], variant['POS'],
                                                            variant['REF'], variant['ALT'])
        if variant:
            return CALL_INFO + ':' + variant_display_title  # HG002:chr1:504A>T
        return CALL_INFO

    @calculated_property(schema={
        "title": "Variant Sample List",
        "description": "The list containing this variant sample",
        "type": "string",
        "linkTo": "VariantSampleList"
    })
    def variant_sample_list(self, request):
        result = self.rev_link_atids(request, "variant_sample_lists")
        if result:
            return result[0]  # expected one list per case

    @calculated_property(schema={
        "title": "AD_REF",
        "description": "Reference AD",
        "type": "integer"
    })
    def AD_REF(self, AD=None):
        if AD is not None:
            return int(AD.split(',')[0])
        return -1

    @calculated_property(schema={
        "title": "AD_ALT",
        "description": "Alternate AD",
        "type": "integer"
    })
    def AD_ALT(self, AD=None):
        if AD is not None:
            return int(AD.split(',')[1])
        return -1

    @calculated_property(schema={
        "title": "AF",
        "description": "Allele Frequency",
        "type": "number"
    })
    def AF(self, AD=None):
        if AD is not None:
            ref, alt = AD.split(',')
            try:
                denominator = int(ref) + int(alt)
            except Exception:
                raise ValueError('Bad value for AD (used to calculate AF): %s' % AD)
            if denominator == 0:
                return 0.0
            return round(int(alt) / (int(ref) + int(alt)), 3)  # round to 3 digits
        return 0.0

    @calculated_property(schema={
        "title": "bam_snapshot",
        "description": "Link to Genome Snapshot Image",
        "type": "string"
    })
    def bam_snapshot(self, request, file, variant):
        variant_props = get_item_or_none(request, variant, 'Variant', frame='raw')
        if variant_props is None:
            raise RuntimeError('Got none for something that definitely exists')
        file_path = '%s/bamsnap/chr%s_%s.png' % (  # file = accession of associated VCF file
            file, variant_props['CHROM'], variant_props['POS']
        )
        return file_path

    @calculated_property(schema={
        "title": "Associated Genotype Labels",
        "description": "Named Genotype Label fields that can be searched on",
        "type": "object",
        "additional_properties": True,
        "properties": {
            "proband_genotype_label": {
                "title": "Proband Genotype",
                "type": "string"
            },
            "mother_genotype_label": {
                "title": "Mother Genotype",
                "type": "string"
            },
            "father_genotype_label": {
                "title": "Father Genotype",
                "type": "string"
            },
            "sister_genotype_label": {
                "title": "Sister Genotype",
                "type": "string"
            },
            "sister_II_genotype_label": {
                "title": "Sister II Genotype",
                "type": "string"
            },
            "sister_III_genotype_label": {
                "title": "Sister III Genotype",
                "type": "string"
            },
            "sister_IV_genotype_label": {
                "title": "Sister IV Genotype",
                "type": "string"
            },
            "brother_genotype_label": {
                "title": "Brother Genotype",
                "type": "string"
            },
            "brother_II_genotype_label": {
                "title": "Brother II Genotype",
                "type": "string"
            },
            "brother_III_genotype_label": {
                "title": "Brother III Genotype",
                "type": "string"
            },
            "brother_IV_genotype_label": {
                "title": "Brother IV Genotype",
                "type": "string"
            },
            "co_parent_genotype_label": {
                "title": "Co-Parent Genotype",
                "type": "string"
            },
            "daughter_genotype_label": {
                "title": "Daughter Genotype",
                "type": "string"
            },
            "daughter_II_genotype_label": {
                "title": "Daughter II Genotype",
                "type": "string"
            },
            "son_genotype_label": {
                "title": "Son Genotype",
                "type": "string"
            },
            "son_II_genotype_label": {
                "title": "Son II Genotype",
                "type": "string"
            }
        }
    })
    def associated_genotype_labels(self, variant, CALL_INFO, samplegeno=None, genotype_labels=None):
        """ Builds the above sub-embedded object so we can search on the genotype labels """

        possible_keys_set = set(VariantSample.POSSIBLE_GENOTYPE_LABEL_FIELDS)

        # XXX: will be useful if we want to have this field be "centric" WRT the
        # person who submitted this variant_sample
        def my_role(samplegeno, CALL_INFO):
            for entry in samplegeno:
                if entry['samplegeno_sampleid'] == CALL_INFO:
                    return entry['samplegeno_role']
            return None

        def infer_key_from_role(role):
            return role.replace(' ', '_').replace('-', '_') + '_genotype_label'

        # variant always starts with chr* where * is the chrom we are looking for
        def extract_chrom_from_variant(v):
            return v[3]

        # drop if there are no genotype labels or no samplegeno field or this is a mitochondrial variant
        if not genotype_labels or not samplegeno or extract_chrom_from_variant(variant) == 'M':
            return None

        new_labels = {}
        for entry in genotype_labels:
            role = entry.get('role', '')
            label = entry.get('labels', [])
            role_key = infer_key_from_role(role)
            if role_key not in possible_keys_set:
                continue
            elif len(label) == 1:
                new_labels[role_key] = label[0]
            else:
                new_labels[role_key] = ' '.join(label)  # just in case

        return new_labels

    @calculated_property(schema={
        "title": "Project Gene Lists",
        "field_name": "project_genelists",
        "description": "Gene lists associated with project of variant sample",
        "type": "array",
        "items": {
            "title": "Gene list title",
            "type": "string",
            "description": "Gene list title"
        }
    })
    def project_genelists(self, request, project, variant):
        project_genelists = []
        core_project = CGAP_CORE_PROJECT + "/"
        potential_projects = [core_project, project]
        variant_props = get_item_or_none(request, variant, frame="embedded")
        genes = variant_props.get("genes", [])
        for gene in genes:
            genelists = gene.get("genes_most_severe_gene", {}).get("gene_lists", [])
            for genelist in genelists:
                if (genelist["project"]["@id"] in potential_projects
                        and genelist["display_title"] not in project_genelists):
                    project_genelists.append(genelist["display_title"])
        return project_genelists


@collection(
    name='variant-sample-lists',
    properties={
        'title': 'Variant Sample Lists',
        'description': 'Collection of all variant sample lists'
    })
class VariantSampleList(Item):
    """ VariantSampleList class """

    item_type = 'variant_sample_list'
    schema = load_schema('encoded:schemas/variant_sample_list.json')
    embedded_list = [
        'variant_samples.variant_sample_item.*',
        'variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.display_title',
        'variant_samples.variant_sample_item.variant.genes.genes_most_severe_transcript',
        'variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsc',
        'variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsp',
        'variant_samples.variant_sample_item.interpretation.classification',
        'variant_samples.variant_sample_item.discovery_interpretation.gene_candidacy',
        'variant_samples.variant_sample_item.discovery_interpretation.variant_candidacy'
    ]


@view_config(name='download', context=VariantSample, request_method='GET',
             permission='view', subpath_segments=[0, 1])
@debug_log
def download(context, request):
    """ Navigates to the IGV snapshot hrf on the bam_snapshot field. """
    calculated = calculate_properties(context, request)
    s3_client = boto3.client('s3')
    params_to_get_obj = {
        'Bucket': request.registry.settings.get('file_wfout_bucket'),
        'Key': calculated['bam_snapshot']
    }
    location = s3_client.generate_presigned_url(
        ClientMethod='get_object',
        Params=params_to_get_obj,
        ExpiresIn=36*60*60
    )

    if asbool(request.params.get('soft')):
        expires = int(parse_qs(urlparse(location).query)['Expires'][0])
        return {
            '@type': ['SoftRedirect'],
            'location': location,
            'expires': datetime.datetime.fromtimestamp(expires, pytz.utc).isoformat(),
        }

    # 307 redirect specifies to keep original method
    raise HTTPTemporaryRedirect(location=location)  # 307
