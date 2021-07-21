import datetime
import io
import json
import os
from urllib.parse import parse_qs, urlparse
from pyramid.httpexceptions import (
    HTTPBadRequest,
    HTTPServerError
)
from pyramid.traversal import find_resource
from pyramid.request import Request

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
from snovault.embed import make_subrequest

from encoded.ingestion.common import CGAP_CORE_PROJECT
from encoded.inheritance_mode import InheritanceMode
from encoded.util import resolve_file_path
from encoded.types.base import Item, get_item_or_none

from ..custom_embed import CustomEmbed

log = structlog.getLogger(__name__)
ANNOTATION_ID = 'annotation_id'
ANNOTATION_ID_SEP = '_'

# Compound Het constants
CMPHET_PHASED_STRONG = 'Compound Het (Phased/strong_pair)'
CMPHET_PHASED_MED = 'Compound Het (Phased/medium_pair)'
CMPHET_PHASED_WEAK = 'Compound Het (Phased/weak_pair)'
CMPHET_UNPHASED_STRONG = 'Compound Het (Unphased/strong_pair)'
CMPHET_UNPHASED_MED = 'Compound Het (Unphased/medium_pair)'
CMPHET_UNPHASED_WEAK = 'Compound Het (Unphased/weak_pair)'

# Shared embeds for variants and variant samples also used for corresponding SV items
SHARED_VARIANT_EMBEDS = [
    "interpretations.classification",
    "interpretations.acmg_guidelines",
    "interpretations.conclusion",
    "interpretations.note_text",
    "interpretations.version",
    "interpretations.project",
    "interpretations.institution",
    "interpretations.status",
    "interpretations.last_modified.date_modified",
    "interpretations.last_modified.modified_by.display_title",
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
SHARED_VARIANT_SAMPLE_EMBEDS = [
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
    "discovery_interpretation.last_modified.modified_by.display_title",
    "variant_sample_list.created_for_case",
]


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
    embedded_list = SHARED_VARIANT_EMBEDS + []
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
    embedded_list = SHARED_VARIANT_SAMPLE_EMBEDS + [
        "cmphet.*",
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
    rev = {'variant_sample_list': ('VariantSampleList', 'variant_samples.variant_sample_item')}
    embedded_list = build_variant_sample_embedded_list()
    FACET_ORDER_OVERRIDE = {
        'inheritance_modes': {
            InheritanceMode.INHMODE_LABEL_DE_NOVO_STRONG: 1,  # de novo (strong)
            InheritanceMode.INHMODE_LABEL_DE_NOVO_MEDIUM: 2,  # de novo (medium)
            InheritanceMode.INHMODE_LABEL_DE_NOVO_WEAK: 3,  # de novo (weak)
            InheritanceMode.INHMODE_LABEL_DE_NOVO_CHRXY: 4,  # de novo (chrXY) XXX: no GATK?
            InheritanceMode.INHMODE_LABEL_RECESSIVE: 5,  # Recessive
            CMPHET_PHASED_STRONG: 6,  # cmphet all auto-generated, see compute_cmphet_inheritance_modes
            CMPHET_PHASED_MED: 7,
            CMPHET_PHASED_WEAK: 8,
            CMPHET_UNPHASED_STRONG: 9,
            CMPHET_UNPHASED_MED: 10,
            CMPHET_UNPHASED_WEAK: 11,
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
        },
        'proband_only_inheritance_modes': {
            CMPHET_UNPHASED_STRONG: 1,
            CMPHET_UNPHASED_MED: 2,
            CMPHET_UNPHASED_WEAK: 3,
            'X-linked': 4,
            'Y-linked': 5
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
        result = self.rev_link_atids(request, "variant_sample_list")
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
        "title": "Inheritance Modes",
        "description": "Inheritance Modes (only including those relevant to a proband-only analysis)",
        "type": "array",
        "items": {
            "type": "string"
        }
    })
    def proband_only_inheritance_modes(self, request, variant, inheritance_modes=[]):
        proband_mode_options = [CMPHET_UNPHASED_STRONG, CMPHET_UNPHASED_MED, CMPHET_UNPHASED_WEAK]
        proband_modes = [item for item in inheritance_modes if item in proband_mode_options]
        variant = get_item_or_none(request, variant, 'Variant', frame='raw')
        if variant['CHROM'] in ['X', 'Y']:
            proband_modes.append(f"{variant['CHROM']}-linked")
        if proband_modes:
            return proband_modes
        return None

    @calculated_property(schema={
        "title": "BAM Snapshot",
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
        "title": "Associated Gene Lists",
        "field_name": "associated_genelists",
        "description": "Gene lists associated with project or case of variant sample",
        "type": "array",
        "items": {
            "title": "Gene list title",
            "type": "string",
            "description": "Gene list title"
        }
    })
    def associated_genelists(self, request, project, variant, CALL_INFO):
        """
        Identifies gene lists associated with the project or project and CALL_INFO
        of the variant sample, if the gene list has associated BAM sample IDs.

        NOTE: Gene lists retrieved with @@raw view to prevent costly @@object
        view of large gene lists.
        """
        gene_atids = []
        genelist_atids = []
        genelist_info = {}
        associated_genelists = []
        core_project = CGAP_CORE_PROJECT + "/"
        potential_projects = [core_project, project]
        variant_props = get_item_or_none(request, variant)
        genes = variant_props.get("genes", [])
        for gene in genes:
            gene_atid = gene.get("genes_most_severe_gene", "")
            if gene_atid:
                gene_atids.append(gene_atid)
        gene_atids = list(set(gene_atids))
        genes_object = [get_item_or_none(request, atid) for atid in gene_atids]
        for gene in genes_object:
            genelist_atids += gene.get("gene_lists", [])
        genelist_atids = list(set(genelist_atids))
        genelists_raw = [
            get_item_or_none(request, atid, frame="raw") for atid in genelist_atids
        ]
        for genelist in genelists_raw:
            title = genelist.get("title", "")
            bam_sample_ids = genelist.get("bam_sample_ids", [])
            project_uuid = genelist.get("project")
            project_object = get_item_or_none(request, project_uuid)
            project_atid = project_object.get("@id")
            genelist_info[title] = {
                "project": project_atid, "bam_sample_ids": bam_sample_ids
            }
        for genelist_title, genelist_props in genelist_info.items():
            if genelist_title in associated_genelists:
                continue
            bam_sample_ids = genelist_props.get("bam_sample_ids")
            if genelist_props["project"] in potential_projects:
                if bam_sample_ids:
                    if CALL_INFO in bam_sample_ids:
                        associated_genelists.append(genelist_title)
                else:
                    associated_genelists.append(genelist_title)
        return associated_genelists



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


@view_config(
    name='process-notes',
    context=VariantSample,
    request_method='PATCH',
    permission='edit'
)
def process_notes(context, request):
    """
    Accepts (may be extended in future):
        {
            "save_to_project_notes" : {
                "variant_notes": UUID,
                "gene_notes": UUID,
                "interpretation": UUID,
                "discovery_interpretation": UUID,
            }
        }
    """

    request_body = request.json
    stpn = request_body["save_to_project_notes"]
    ln = {} # 'loaded notes'

    def validate_and_load_note(note_type_name):
        # Initial Validation - ensure each requested UUID is present in own properties and editable
        if note_type_name in stpn:

            # Compare UUID submitted vs UUID present on VS Item
            if stpn[note_type_name] != context.properties[note_type_name]:
                raise HTTPBadRequest("Not all submitted Note UUIDs are present on VariantSample. " + \
                    "Check 'save_to_project_notes." + note_type_name + "'.")

            # Get @@object view of Note to check permissions, status, etc.
            loaded_note = request.embed("/" + stpn[note_type_name], "@@object", as_user=True)
            item_resource = find_resource(request.root, loaded_note["@id"])
            if not request.has_permission("edit", item_resource):
                raise HTTPBadRequest("No edit permission for at least one submitted Note UUID. " + \
                    "Check 'save_to_project_notes." + note_type_name + "'.")

            ln[note_type_name] = loaded_note

    for note_type_name in ["interpretation", "discovery_interpretation", "variant_notes", "gene_notes"]:
        validate_and_load_note(note_type_name)

    if len(ln) == 0:
        raise HTTPBadRequest("No Note UUIDs supplied.")




    variant_patch_payload = {} # Can be converted to dict of variants if need to PATCH multiple in future
    genes_patch_payloads = {} # Keyed by @id, along with `note_patch_payloads`
    note_patch_payloads = {}




    need_variant_patch = "interpretation" in stpn \
        or "discovery_interpretation" in stpn \
        or "variant_notes" in stpn
    need_gene_patch = "discovery_interpretation" in stpn \
        or "gene_notes" in stpn

    variant = None
    genes = None # We may have multiple different genes from same variant; at moment we save note to each of them.

    if need_variant_patch or need_gene_patch:
        variant_uuid = context.properties["variant"]
        variant_fields = [
            "@id",
            "interpretations",              # These come back in form of @id (not uuid). Contains 's' at end, unlike VS field.
            "discovery_interpretations",    # These come back in form of @id (not uuid). Contains 's' at end, unlike VS field.
            "variant_notes"                 # These come back in form of @id (not uuid)
        ]

        if need_gene_patch:
            variant_fields.append("genes.genes_most_severe_gene.@id")
            variant_fields.append("genes.genes_most_severe_gene.discovery_interpretations")
            variant_fields.append("genes.genes_most_severe_gene.gene_notes")

        variant_embed = CustomEmbed(request, variant_uuid, embed_props={ "requested_fields": variant_fields })
        variant = variant_embed.result

        if need_gene_patch:
            genes = [ gene_subobject["genes_most_severe_gene"] for gene_subobject in variant["genes"] ]




    curr_date = datetime.datetime.utcnow().isoformat() + "+00:00"
    auth_source, curr_user_id = request.authenticated_userid.split(".", 1)

    def create_note_patch_payload(note_atid):
        note_patch_payloads[note_atid] = {
            # All 3 of these fields have permissions: restricted_fields
            # and may only be manually editable by an admin.
            "status": "current",
            "approved_by": curr_user_id,
            "date_approved": curr_date
        }




    # Set or extend variant.interpretations, discovery_interpretations, and variant_notes
    if "interpretation" in ln:
        # Add to Variant.interpretations
        if not variant.get("interpretations"):
            variant_patch_payload["interpretations"] = [
                ln["interpretation"]["@id"]
            ]
        elif ln["interpretation"]["@id"] not in variant["interpretations"]: # 's'
            # TODO: If note from same project exists (?), then replace existing note and make new note point to it as
            # a linked list.
            variant_patch_payload["interpretations"] = [ note_atid for note_atid in variant["interpretations"] ]
            variant_patch_payload["interpretations"].append(ln["interpretation"]["@id"])

        # Update Note status if is not already current.
        if ln["interpretation"]["status"] != "current":
            create_note_patch_payload(ln["interpretation"]["@id"])




    if "discovery_interpretation" in ln:
        # Add to Variant.discovery_interpretations
        if not variant.get("discovery_interpretations"): # 's'
            variant_patch_payload["discovery_interpretations"] = [
                ln["discovery_interpretation"]["@id"]
            ]
        elif ln["discovery_interpretation"]["@id"] not in variant["discovery_interpretations"]: # 's'
            # TODO: If note from same project exists (?), then replace existing note and make new note point to it as
            # a linked list.
            variant_patch_payload["discovery_interpretations"] = [ note_atid for note_atid in variant["discovery_interpretations"] ]
            variant_patch_payload["discovery_interpretations"].append(ln["discovery_interpretation"]["@id"])

        # Add to Gene.discovery_interpretations
        for gene in genes:
            if not gene.get("discovery_interpretations"): # 's'
                genes_patch_payloads[gene["@id"]] = genes_patch_payloads.get(gene["@id"], {})
                genes_patch_payloads[gene["@id"]]["discovery_interpretations"] = [
                    ln["discovery_interpretation"]["@id"]
                ]
            elif ln["discovery_interpretation"]["@id"] not in gene["discovery_interpretations"]: # 's'
                # TODO: If note from same project exists (?), then replace existing note and make new note point to it as
                # a linked list.
                genes_patch_payloads[gene["@id"]] = genes_patch_payloads.get(gene["@id"], {})
                genes_patch_payloads[gene["@id"]]["discovery_interpretations"] = [ note_atid for note_atid in gene["discovery_interpretations"] ]
                genes_patch_payloads[gene["@id"]]["discovery_interpretations"].append(ln["discovery_interpretation"]["@id"])

        # Update Note status if is not already current.
        if ln["discovery_interpretation"]["status"] != "current":
            create_note_patch_payload(ln["discovery_interpretation"]["@id"])




    if "variant_notes" in ln:
        if not variant.get("variant_notes"):
            variant_patch_payload["variant_notes"] = [
                ln["variant_notes"]["@id"]
            ]
        elif ln["variant_notes"]["@id"] not in variant["variant_notes"]: # 's'
            # TODO: If note from same project exists (?), then replace existing note and make new note point to it as
            # a linked list.
            variant_patch_payload["variant_notes"] = [ note_atid for note_atid in variant["variant_notes"] ]
            variant_patch_payload["variant_notes"].append(ln["variant_notes"]["@id"])

        # Update Note status if is not already current.
        if ln["variant_notes"]["status"] != "current":
            create_note_patch_payload(ln["variant_notes"]["@id"])




    if "gene_notes" in ln:
        # Add to Gene.gene_notes
        for gene in genes:
            if not gene.get("gene_notes"): # 's'
                genes_patch_payloads[gene["@id"]] = genes_patch_payloads.get(gene["@id"], {})
                genes_patch_payloads[gene["@id"]]["gene_notes"] = [
                    ln["gene_notes"]["@id"]
                ]
            elif ln["gene_notes"]["@id"] not in gene["gene_notes"]: # 's'
                # TODO: If note from same project exists (?), then replace existing note and make new note point to it as
                # a linked list.
                genes_patch_payloads[gene["@id"]] = genes_patch_payloads.get(gene["@id"], {})
                genes_patch_payloads[gene["@id"]]["gene_notes"] = [ note_atid for note_atid in gene["gene_notes"] ]
                genes_patch_payloads[gene["@id"]]["gene_notes"].append(ln["gene_notes"]["@id"])

        # Update Note status if is not already current.
        if ln["gene_notes"]["status"] != "current":
            create_note_patch_payload(ln["gene_notes"]["@id"])




    # Perform the PATCHes!

    # TODO: Consider parallelizing.
    # Currently - Gene and Variant patches are performed first before Note status is updated.
    # This is in part to simplify UI logic where only Note status is checked to assert if a Note is already saved to Project.

    def perform_patch_as_admin(item_atid, patch_payload):
        subreq = make_subrequest(request, item_atid, method="PATCH", json_body=patch_payload, inherit_user=False)
        subreq.remote_user = "UPGRADE"
        if 'HTTP_COOKIE' in subreq.environ:
            del subreq.environ['HTTP_COOKIE']
        patch_result = request.invoke_subrequest(subreq).json
        if patch_result["status"] != "success":
            raise HTTPServerError("Couldn't update Item " + item_atid)


    gene_patch_count = 0
    if need_gene_patch:
        for gene_atid, gene_payload in genes_patch_payloads.items():
            perform_patch_as_admin(gene_atid, gene_payload)
            gene_patch_count += 1

    variant_patch_count = 0
    if need_variant_patch:
        perform_patch_as_admin(variant["@id"], variant_patch_payload)
        variant_patch_count += 1

    note_patch_count = 0
    for note_atid, note_payload in note_patch_payloads.items():
        perform_patch_as_admin(note_atid, note_payload)
        note_patch_count += 1


    return {
        "success" : True,
        "patch_results": {
            "Gene": gene_patch_count,
            "Variant": variant_patch_count,
            "Note": note_patch_count,
        }
    }





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

    # Populate `embedded_list` if we want to make this Item searchable, else we can exclude from /search/.
    embedded_list = [
        # 'variant_samples.variant_sample_item.variant.display_title',
        # 'variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.display_title',
        # 'variant_samples.variant_sample_item.variant.genes.genes_most_severe_transcript',
        # 'variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsc',
        # 'variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsp',
        # 'variant_samples.variant_sample_item.interpretation.classification',
        # 'variant_samples.variant_sample_item.discovery_interpretation.gene_candidacy',
        # 'variant_samples.variant_sample_item.discovery_interpretation.variant_candidacy',
        # 'variant_samples.variant_sample_item.associated_genotype_labels.proband_genotype_label',
        # 'variant_samples.variant_sample_item.associated_genotype_labels.mother_genotype_label',
        # 'variant_samples.variant_sample_item.associated_genotype_labels.father_genotype_label',
        # 'structural_variant_samples.structural_variant_sample_item.structural_variant.display_title',
        # 'structural_variant_samples.structural_variant_sample_item.interpretation.classification',
        # 'structural_variant_samples.structural_variant_sample_item.discovery_interpretation.gene_candidacy',
        # 'structural_variant_samples.structural_variant_sample_item.discovery_interpretation.variant_candidacy',
    ]



@view_config(name='spreadsheet', context=VariantSampleList, request_method='GET',
             permission='view', subpath_segments=[0, 1])
@debug_log
def variant_sample_list_spreadsheet(context, request):
    """
    Returns spreasheet containing information about every VariantSample selection
    in the VariantSampleList Item.
    TODO:
      Figure out fields needed, use CustomEmbed class to fetch them, then
      plop them out as a download stream. See 4DN/fourfront's batch_download
      for precedent example (downloading/streaming a TSV from /search/ request).
    """


    return { "status": "in development" }

