import datetime
import io
import json
import os
import csv
from math import inf
from urllib.parse import parse_qs, urlparse
from pyramid.httpexceptions import (
    HTTPBadRequest,
    HTTPServerError,
    HTTPNotModified
)
from pyramid.traversal import find_resource
from pyramid.request import Request
from pyramid.response import Response

import boto3
import negspy.coordinates as nc
import pytz
import structlog
from pyramid.httpexceptions import HTTPTemporaryRedirect
from pyramid.settings import asbool
from pyramid.view import view_config
from snovault import calculated_property, collection, load_schema, TYPES
from snovault.calculated import calculate_properties
from snovault.util import simple_path_ids, debug_log, IndexSettings
from snovault.embed import make_subrequest

from ..batch_download_utils import (
    stream_tsv_output,
    convert_item_to_sheet_dict
)
from ..custom_embed import CustomEmbed
from ..ingestion.common import CGAP_CORE_PROJECT
from ..inheritance_mode import InheritanceMode
from ..util import (
    resolve_file_path, build_s3_presigned_get_url, convert_integer_to_comma_string
)
from ..types.base import Item, get_item_or_none


log = structlog.getLogger(__name__)
ANNOTATION_ID = 'annotation_id'
ANNOTATION_ID_SEP = '_'

# For adding additional variant nomenclature options
# For reference, see e.g. https://www.insdc.org/documents/feature_table.html#7.4.3
AMINO_ACID_ABBREVIATIONS = {
    'Ala': 'A',
    'Arg': 'R',
    'Asn': 'N',
    'Asp': 'D',
    'Cys': 'C',
    'Gln': 'Q',
    'Glu': 'E',
    'Gly': 'G',
    'His': 'H',
    'Ile': 'I',
    'Leu': 'L',
    'Lys': 'K',
    'Met': 'M',
    'Phe': 'F',
    'Pro': 'P',
    'Ser': 'S',
    'Thr': 'T',
    'Trp': 'W',
    'Tyr': 'Y',
    'Val': 'V'
}

# Compound Het constants
CMPHET_PHASED_STRONG = 'Compound Het (Phased/strong_pair)'
CMPHET_PHASED_MED = 'Compound Het (Phased/medium_pair)'
CMPHET_PHASED_WEAK = 'Compound Het (Phased/weak_pair)'
CMPHET_UNPHASED_STRONG = 'Compound Het (Unphased/strong_pair)'
CMPHET_UNPHASED_MED = 'Compound Het (Unphased/medium_pair)'
CMPHET_UNPHASED_WEAK = 'Compound Het (Unphased/weak_pair)'

# Shared embeds for variants and variant samples also used for corresponding SV items
SHARED_VARIANT_EMBEDS = [
    "interpretations.@id",
    "interpretations.classification",
    "interpretations.acmg_rules_invoked.*",
    "interpretations.acmg_rules_with_modifier",
    "interpretations.conclusion",
    "interpretations.note_text",
    "interpretations.version",
    "interpretations.project.@id",
    "interpretations.institution.@id",
    "interpretations.status",
    "interpretations.last_modified.date_modified",
    "interpretations.last_modified.modified_by.display_title",
    "discovery_interpretations.@id",
    "discovery_interpretations.gene_candidacy",
    "discovery_interpretations.variant_candidacy",
    "discovery_interpretations.note_text",
    "discovery_interpretations.version",
    "discovery_interpretations.project.@id",
    "discovery_interpretations.institution.@id",
    "discovery_interpretations.status",
    "discovery_interpretations.last_modified.date_modified",
    "discovery_interpretations.last_modified.modified_by.display_title",
    "variant_notes.@id",
]

SHARED_VARIANT_SAMPLE_EMBEDS = [
    # The following fields are now requested through /embed API.
    "variant_notes.@id",
    # "variant_notes.note_text",
    # "variant_notes.version",
    # "variant_notes.project",
    # "variant_notes.institution",
    # "variant_notes.status",
    # "variant_notes.last_modified.date_modified",
    # "variant_notes.last_modified.modified_by.display_title",
    "gene_notes.@id",
    # "gene_notes.note_text",
    # "gene_notes.version",
    # "gene_notes.project",
    # "gene_notes.institution",
    # "gene_notes.status",
    # "gene_notes.last_modified.date_modified",
    # "gene_notes.last_modified.modified_by.display_title",
    "interpretation.@id",
    # "interpretation.classification",
    # "interpretation.acmg_rules_invoked.*",
    # "interpretation.acmg_rules_with_modifier",
    # "interpretation.conclusion",
    # "interpretation.note_text",
    # "interpretation.version",
    # "interpretation.project",
    # "interpretation.institution",
    # "interpretation.status",
    # "interpretation.last_modified.date_modified",
    # "interpretation.last_modified.modified_by.display_title",
    "discovery_interpretation.@id",
    # "discovery_interpretation.gene_candidacy",
    # "discovery_interpretation.variant_candidacy",
    # "discovery_interpretation.note_text",
    # "discovery_interpretation.version",
    # "discovery_interpretation.project",
    # "discovery_interpretation.institution",
    # "discovery_interpretation.status",
    # "discovery_interpretation.last_modified.date_modified",
    # "discovery_interpretation.last_modified.modified_by.display_title",
    "variant_sample_list.created_for_case",
    # We need the following data in search result rows, so we embed these here and not thru /embed API.
    "technical_review.*", # <- Added as workaround for invalidation scope... needs to be looked into more.
    "technical_review.assessment.call",
    "technical_review.assessment.classification",
    "technical_review.assessment.date_call_made",
    "technical_review.assessment.call_made_by.display_title",
    "technical_review.review.date_reviewed",
    "technical_review.review.reviewed_by.display_title",
    "technical_review.note_text",
    "technical_review.last_text_edited.date_text_edited",
    "technical_review.last_modified.date_modified"
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
    embedded_list = SHARED_VARIANT_EMBEDS + [
        "genes.genes_most_severe_gene.gene_notes.@id", # `genes` not present on StructuralVariant
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


def perform_patch_as_admin(request, item_atid, patch_payload):
    """
    Patches Items as 'UPGRADER' user/permissions.

    TODO: Seems like this could be re-usable somewhere
    """
    if len(patch_payload) == 0:
        log.warning("Skipped PATCHing " + item_atid + " due to empty payload.")
        return # skip empty patches (e.g. if duplicate note uuid is submitted that a Gene has already)
    subreq = make_subrequest(request, item_atid, method="PATCH", json_body=patch_payload, inherit_user=False)
    subreq.remote_user = "UPGRADE"
    if 'HTTP_COOKIE' in subreq.environ:
        del subreq.environ['HTTP_COOKIE']
    patch_result = request.invoke_subrequest(subreq).json
    if patch_result["status"] != "success":
        raise HTTPServerError("Couldn't update Item " + item_atid)
    return patch_result


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
    schema = load_extended_descriptions_in_schemas(load_schema('encoded:schemas/variant.json'))
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
        position = convert_integer_to_comma_string(POS)
        if position is None:
            position = POS
        return build_variant_display_title(CHROM, position, REF, ALT)  # chr1:1,504A>T

    @calculated_property(schema={
        "title": "Position (genome coordinates)",
        "description": "Absolute position in genome coordinates",
        "type": "integer"
    })
    def POS_ABS(self, CHROM, POS):
        chrom_info = nc.get_chrominfo('hg38')
        return nc.chr_pos_to_genome_pos('chr'+CHROM, POS, chrom_info)

    @calculated_property(schema={
        "title": "Most severe location",
        "description": "Location of variant in most severe transcript",
        "type": "string"
    })
    def most_severe_location(self, request):
        """Get relative location of variant per most severe transcript.

        Used in filtering space column, so provide user-friendly
        read-out.
        """
        result = None
        transcripts = self.properties.get("transcript", [])
        for transcript in transcripts:
            if transcript.get("csq_most_severe") is True:
                exon = transcript.get("csq_exon")
                intron = transcript.get("csq_intron")
                distance = transcript.get("csq_distance")
                consequences = transcript.get("csq_consequence", [])
                if intron:
                    result = "Intron " + intron
                elif exon:
                    result = "Exon " + exon
                    for consequence in consequences:
                        item = get_item_or_none(request, consequence)
                        if not item:
                            continue
                        consequence_title = item.get("var_conseq_name")
                        if consequence_title == "3_prime_UTR_variant":
                            result += " (3' UTR)"
                            break
                        elif consequence_title == "5_prime_UTR_variant":
                            result += " (5' UTR)"
                            break
                elif distance:
                    for consequence in consequences:
                        item = get_item_or_none(request, consequence)
                        if not item:
                            continue
                        consequence_title = item.get("var_conseq_name")
                        if consequence_title == "downstream_gene_variant":
                            result = distance + " bp downstream"
                            break
                        elif consequence_title == "upstream_gene_variant":
                            result = distance + " bp upstream"
                            break
                break
        return result

    @calculated_property(schema={
        "title": "Alternate Display Title",
        "description": "Variant display title with comma-separated position",
        "type": "string"
    })
    def alternate_display_title(self, CHROM, POS, REF, ALT):
        return build_variant_display_title(CHROM, POS, REF, ALT)  # chr1:1504A>T

    @calculated_property(schema={
        "title": "Additional Variant Names",
        "description": "Additional names/aliases this variant is known as",
        "type": "array",
        "items": {
            "type": "string"
        }
    })
    def additional_variant_names(self, genes=None):
        """This property will allow users to search for specific variants in the filtering tab,
        using a few different possible variant names.
         - c. change
         - p. change (3 letter aa code)
         - p. change (1 letter aa code)
        NB: talk to front end about tooltip/click box for example searches
        """
        names = []
        if genes:
            for gene in genes:
                if gene.get('genes_most_severe_hgvsc'):
                    names.append(gene['genes_most_severe_hgvsc'].split(':')[-1])
                if gene.get('genes_most_severe_hgvsp'):
                    hgvsp_3 = gene['genes_most_severe_hgvsp'].split(':')[-1]
                    hgvsp_1 = ''.join(hgvsp_3)
                    for key, val in AMINO_ACID_ABBREVIATIONS.items():
                        if key in hgvsp_3:
                            hgvsp_1 = hgvsp_1.replace(key, val)
                    names.append(hgvsp_3)
                    if hgvsp_1 != hgvsp_3:
                        names.append(hgvsp_1)
        if names:
            return names


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
            InheritanceMode.INHMODE_LABEL_X_LINKED_RECESSIVE: 15,  # X-linked recessive
            InheritanceMode.INHMODE_LABEL_X_LINKED_DOMINANT_MOTHER: 16,  # X-linked dominant (Maternal)
            InheritanceMode.INHMODE_LABEL_X_LINKED_DOMINANT_FATHER: 17,  # X-linked dominant (Paternal)
            InheritanceMode.INHMODE_LABEL_Y_LINKED: 18,  # Y-linked dominant
            InheritanceMode.INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT: 19,  # Low relevance, homozygous in a parent
            InheritanceMode.INHMODE_LABEL_NONE_HEMIZYGOUS_PARENT: 20,  # Low relevance, hemizygous in a parent
            InheritanceMode.INHMODE_LABEL_NONE_MN: 21,  # Low relevance, multiallelic site family
            InheritanceMode.INHMODE_LABEL_NONE_BOTH_PARENTS: 22,  # Low relevance, present in both parent(s)
            InheritanceMode.INHMODE_LABEL_NONE_DOT: 23,  # Low relevance, missing call(s) in family
            InheritanceMode.INHMODE_LABEL_NONE_SEX_INCONSISTENT: 24,  # Low relevance, mismatching chrXY genotype(s)
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

    class Collection(Item.Collection):
        @staticmethod
        def index_settings():
            """ Type specific settings for variant_sample """
            return IndexSettings(
                shard_count=5,  # split the variant sample index into 5 shards
                refresh_interval='5s'  # force update every 5 seconds
            )

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """ Sets the annotation_id field on this variant_sample prior to passing on. """
        properties[ANNOTATION_ID] = '%s:%s:%s' % (
            properties['CALL_INFO'],
            properties['variant'],
            properties['file']
        )
        return super().create(registry, uuid, properties, sheets)

    @staticmethod
    def remove_reference_transcript(hgvs_formatted_string):
        """Remove reference transcript from HGVS-formatted variant name.

        Typically, these HGVS-formatted variants come from VEP.

        NOTE: HGVS nomenclature can use colons after the reference
        transcript, but none of those situations should arise within
        VariantSamples (SNVs and small indels). For more info, see
        https://varnomen.hgvs.org/recommendations/general/
        """
        result = None
        transcript_separator = ":"
        if (
            isinstance(hgvs_formatted_string, str)
            and transcript_separator in hgvs_formatted_string
        ):
            split_value = hgvs_formatted_string.split(transcript_separator)
            if len(split_value) > 1:
                result = "".join(split_value[1:])
        return result

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, CALL_INFO, variant=None):
        """Build display title.

        This title is displayed in new tabs/windows.

        In order, display hierarchy is:
            - gene symbol with protein change + sample info
            - gene symbol with cDNA change + sample info
            - gene symbol with DNA change + sample info
            - chromosome with DNA change + sample info
            - sample info (shouldn't be reached, but just in case)
        """
        result = CALL_INFO
        variant = get_item_or_none(request, variant, 'Variant', frame='raw')
        if variant:
            gene_display = None
            hgvsp_display = None
            hgvsc_display = None
            chromosome = variant.get("CHROM")
            position = variant.get("POS")
            reference = variant.get("REF")
            alternate = variant.get("ALT")
            dna_separator = ":g."
            if chromosome == "M":
                dna_separator = ":m."
            genes = variant.get("genes", [])
            if genes:
                gene_properties = genes[0]  # Currently max 1 via reformatter, but can be more
                gene_uuid = gene_properties.get("genes_most_severe_gene")
                if gene_uuid:
                    gene_item = get_item_or_none(request, gene_uuid, "Gene", frame="raw")
                    if gene_item:
                        gene_display = gene_item.get("gene_symbol")
                hgvsp = gene_properties.get("genes_most_severe_hgvsp")
                if hgvsp:
                    hgvsp_display = self.remove_reference_transcript(hgvsp)
                hgvsc = gene_properties.get("genes_most_severe_hgvsc")
                if hgvsc:
                    hgvsc_display = self.remove_reference_transcript(hgvsc)
            if gene_display:
                if hgvsp_display:
                    result = gene_display + ":" + hgvsp_display
                elif hgvsc_display:
                    result = gene_display + ":" + hgvsc_display
                elif position and reference and alternate:
                    result = "%s%s%s%s>%s" % (
                        gene_display, dna_separator, position, reference, alternate
                    )
            elif chromosome and position and reference and alternate:
                result = build_variant_display_title(
                    chromosome, position, reference, alternate
                )
        if CALL_INFO not in result:
            result += " (" + CALL_INFO + ")"
        return result

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
        file_path = None
        excluded_chromosomes = ["M"]
        variant_props = get_item_or_none(request, variant, 'Variant', frame='raw')
        if variant_props is None:
            raise RuntimeError('Got none for something that definitely exists')
        chromosome = variant_props.get("CHROM")
        if chromosome not in excluded_chromosomes:
            file_path = '%s/bamsnap/chr%s_%s.png' % (  # file = accession of associated VCF file
                file, chromosome, variant_props['POS']
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
    params_to_get_obj = {
        'Bucket': request.registry.settings.get('file_wfout_bucket'),
        'Key': calculated['bam_snapshot']
    }
    location = build_s3_presigned_get_url(params=params_to_get_obj)

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
    name='process-items',
    context=VariantSample,
    request_method='PATCH',
    permission='edit'
)
def process_items(context, request):
    """
    This endpoint is used to process notes attached to this (in-context) VariantSample.
    Currently, "saving to project" is supported, but more functions may be available in future.

    ### Usage

    The endpoint currently accepts the following as JSON body of a POST request, and will then
    change the status of each note to "shared" upon asserting edit permissions from PATCHer for each note,
    and save it to the proper field on the Variant and Gene item(s) linked to from this VariantSample.::

        {
            "save_to_project_notes" : {
                "variant_notes": <UUID4>,
                "gene_notes": <UUID4>,
                "interpretation": <UUID4>,
                "discovery_interpretation": <UUID4>,
                "technical_review": <UUID4>
            }
        }

    ### TODO: Rename to something more explicit/apt
    """

    request_body = request.json
    stpi = request_body["save_to_project_notes"]

    vs_to_variant_or_gene_field_mappings = {
        "interpretation": "interpretations",
        "discovery_interpretation": "discovery_interpretations",
        "gene_notes": "gene_notes",
        "variant_notes": "variant_notes",
        "technical_review": "technical_reviews"
    }

    if not stpi:
        raise HTTPBadRequest("No Item UUIDs supplied.")

    li = {} # 'loaded notes'

    def validate_and_load_item(vs_field_name):
        # Initial Validation - ensure each requested UUID is present in own properties and editable
        if vs_field_name in stpi:
            uuid_to_process = stpi[vs_field_name]

            # Compare UUID submitted vs UUID present on VS Item
            if uuid_to_process != context.properties[vs_field_name]:
                raise HTTPBadRequest("Not all submitted Item UUIDs are present on VariantSample. " + \
                    "Check 'save_to_project_notes." + vs_field_name + "'.")

            # Get @@object view of Item to check permissions, status, etc.
            loaded_item = request.embed("/" + uuid_to_process, "@@object", as_user=True)
            item_resource = find_resource(request.root, loaded_item["@id"])
            if not request.has_permission("edit", item_resource):
                raise HTTPBadRequest("No edit permission for at least one submitted Item UUID. " + \
                    "Check 'save_to_project_notes." + vs_field_name + "'.")

            li[vs_field_name] = loaded_item

    for vs_field_name in vs_to_variant_or_gene_field_mappings.keys():
        validate_and_load_item(vs_field_name)

    if len(li) == 0:
        raise HTTPBadRequest("No Item UUIDs supplied.")


    variant_patch_payload = {} # Single item/dict, can be converted to dict of variants if need to PATCH multiple in future
    genes_patch_payloads = {} # Keyed by @id, along with `note_patch_payloads`
    sent_item_patch_payloads = {} # TODO: Rename to 'other_item_payloads' ?

    # PATCHing variant or gene only needed when saving notes to project, not to report.
    need_variant_patch = "interpretation" in stpi or "discovery_interpretation" in stpi or "variant_notes" in stpi or "technical_review" in stpi
    need_gene_patch = "discovery_interpretation" in stpi or "gene_notes" in stpi

    variant = None
    genes = None # We may have multiple different genes from same variant; at moment we save note to each of them.

    if need_variant_patch or need_gene_patch:
        # Load variant and/or gene(s) Items
        variant_uuid = context.properties["variant"]
        variant_fields = [
            "@id",
            "interpretations.@id",
            "interpretations.project",
            "discovery_interpretations.@id",
            "discovery_interpretations.project",
            "variant_notes.@id",
            "variant_notes.project"
        ]

        if need_gene_patch:
            variant_fields.append("genes.genes_most_severe_gene.@id")
            variant_fields.append("genes.genes_most_severe_gene.discovery_interpretations.@id")
            variant_fields.append("genes.genes_most_severe_gene.discovery_interpretations.project")
            variant_fields.append("genes.genes_most_severe_gene.gene_notes.@id")
            variant_fields.append("genes.genes_most_severe_gene.gene_notes.project")

        variant_embed = CustomEmbed(request, variant_uuid, embed_props={ "requested_fields": variant_fields })
        variant = variant_embed.result

        if need_gene_patch:
            genes = [ gene_subobject["genes_most_severe_gene"] for gene_subobject in variant["genes"] ]

    # Using `.now(pytz.utc)` appends "+00:00" for us (making the datetime timezone-aware), while `.utcnow()` doesn't.
    timestamp = datetime.datetime.now(pytz.utc).isoformat()
    auth_source, user_id = request.authenticated_userid.split(".", 1)

    def create_item_patch_current_status_payload(item_at_id, approve = True):
        # This payload may still get updated further with "previous_note" by `add_or_replace_note_for_project_on_variant_or_gene_item`
        sent_item_patch_payloads[item_at_id] = sent_item_patch_payloads.get(item_at_id, {})
        # All 3 of these fields below have permissions: restricted_fields
        # and may only be manually editable by an admin.
        sent_item_patch_payloads[item_at_id]["status"] = "current"
        if approve:
            sent_item_patch_payloads[item_at_id]["approved_by"] = user_id
            sent_item_patch_payloads[item_at_id]["date_approved"] = timestamp

    def add_or_replace_note_for_project_on_variant_or_gene_item(vs_field_name, vg_item, payload):
        vg_field_name = vs_to_variant_or_gene_field_mappings[vs_field_name]
        newly_shared_item_at_id = li[vs_field_name]["@id"]

        if not vg_item.get(vg_field_name): # Variant or Gene Item has no existing notes for `vg_field_name` field.
            payload[vg_field_name] = [ newly_shared_item_at_id ]
            return

        existing_node_ids = [ item["@id"] for item in vg_item[vg_field_name] ]

        if newly_shared_item_at_id in existing_node_ids:
            # Already shared/present; cancel out; error maybe?
            # TODO: _UNSET_ or delete it? Or rely on "remove_from_project_items" request property or similar?
            return

        # Check if note from same project exists and remove it (link to it from Note.previous_note instd.)
        # Ensure we compare to Note.project and not User.project, in case an admin or similar is making edit.
        existing_item_from_project_idx = None
        for item_idx, item in enumerate(vg_item[vg_field_name]):
            if item["project"] == li[vs_field_name]["project"]:
                existing_item_from_project_idx = item_idx
                break # Assumption is we only have 1 note per project in this list, so don't need to search further.

        payload[vg_field_name] = existing_node_ids

        if existing_item_from_project_idx != None:
            existing_item_from_project_at_id = vg_item[vg_field_name][existing_item_from_project_idx]["@id"]
            # Set existing note's status to "obsolete", and populate previous/superseding field if applicable
            sent_item_patch_payloads[existing_item_from_project_at_id] = sent_item_patch_payloads.get(existing_item_from_project_at_id, {})
            sent_item_patch_payloads[existing_item_from_project_at_id]["status"] = "obsolete"
            # Link to existing Note from newly-shared Note            
            sent_item_patch_payloads[newly_shared_item_at_id]["previous_note"] = existing_item_from_project_at_id
            # Link to newly-shared Note from existing note (adds new PATCH request)
            sent_item_patch_payloads[existing_item_from_project_at_id] = sent_item_patch_payloads.get(existing_item_from_project_at_id, {})
            sent_item_patch_payloads[existing_item_from_project_at_id]["superseding_note"] = newly_shared_item_at_id
            # Remove existing Note from Variant or Gene Notes list
            del payload[vg_field_name][existing_item_from_project_idx]

        payload[vg_field_name].append(newly_shared_item_at_id)


    if "interpretation" in stpi:
        # Update Note status if is not already current.
        if li["interpretation"]["status"] != "current":
            create_item_patch_current_status_payload(li["interpretation"]["@id"])
        # Add to Variant.interpretations
        add_or_replace_note_for_project_on_variant_or_gene_item("interpretation", variant, variant_patch_payload)


    if "discovery_interpretation" in stpi:
        # Update Note status if is not already current.
        if li["discovery_interpretation"]["status"] != "current":
            create_item_patch_current_status_payload(li["discovery_interpretation"]["@id"])
        # Add to Variant.discovery_interpretations
        add_or_replace_note_for_project_on_variant_or_gene_item("discovery_interpretation", variant, variant_patch_payload)
        # Add to Gene.discovery_interpretations
        for gene in genes:
            genes_patch_payloads[gene["@id"]] = genes_patch_payloads.get(gene["@id"], {})
            add_or_replace_note_for_project_on_variant_or_gene_item("discovery_interpretation", gene, genes_patch_payloads[gene["@id"]])

    if "variant_notes" in stpi:
        # Update Note status if is not already current.
        if li["variant_notes"]["status"] != "current":
            create_item_patch_current_status_payload(li["variant_notes"]["@id"])
        # Add to Variant.variant_notes
        add_or_replace_note_for_project_on_variant_or_gene_item("variant_notes", variant, variant_patch_payload)

    if "gene_notes" in stpi:
        # Update Note status if is not already current.
        if li["gene_notes"]["status"] != "current":
            create_item_patch_current_status_payload(li["gene_notes"]["@id"])
        # Add to Gene.gene_notes
        for gene in genes:
            genes_patch_payloads[gene["@id"]] = genes_patch_payloads.get(gene["@id"], {})
            add_or_replace_note_for_project_on_variant_or_gene_item("gene_notes", gene, genes_patch_payloads[gene["@id"]])

    if "technical_review" in stpi:
        # Update Note status if is not already current.
        # TODO: Handle technical_review.note as well.
        technical_review_at_id = li["technical_review"]["@id"]
        if li["technical_review"]["status"] != "current":
            create_item_patch_current_status_payload(technical_review_at_id, False)
        # Add to Variant.technical_reviews
        add_or_replace_note_for_project_on_variant_or_gene_item("technical_review", variant, variant_patch_payload)
        


    # Perform the PATCHes!

    # TODO: Consider parallelizing.
    # Currently Gene and Variant patches are performed before Note statuses are updated.
    # This is in part to simplify UI logic where only Note status == "current" is checked to
    # assert if a Note is already saved to Project or not.


    gene_patch_count = 0
    if need_gene_patch:
        for gene_atid, gene_payload in genes_patch_payloads.items():
            perform_patch_as_admin(request, gene_atid, gene_payload)
            gene_patch_count += 1

    variant_patch_count = 0
    if need_variant_patch:
        perform_patch_as_admin(request, variant["@id"], variant_patch_payload)
        variant_patch_count += 1

    sent_item_patch_count = 0
    for note_atid, note_payload in sent_item_patch_payloads.items():
        perform_patch_as_admin(request, note_atid, note_payload)
        sent_item_patch_count += 1

    return {
        "status" : "success",
        "patch_results": {
            "Gene": gene_patch_count,
            "Variant": variant_patch_count,
            "Other": sent_item_patch_count,
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
        # 'structural_variant_samples.variant_sample_item.structural_variant.display_title',
        # 'structural_variant_samples.variant_sample_item.interpretation.classification',
        # 'structural_variant_samples.variant_sample_item.discovery_interpretation.gene_candidacy',
        # 'structural_variant_samples.variant_sample_item.discovery_interpretation.variant_candidacy',
    ]


@view_config(
    name='add-selections',
    context=VariantSampleList,
    request_method='PATCH',
    permission='edit'
)
def add_selections(context, request):
    """
    Adds selections to VariantSampleList, preserving existing data such as selected_by which may not be
    visible to current 'adder'.
    """

    request_body = request.json
    namespace, userid = request.authenticated_userid.split(".", 1)

    # We expect lists of { variant_sample_item: uuid, filter_blocks_used: { filter_blocks: { name: str, query: str }[] } }.
    # Value for "date_selected" will be set during PATCH by schema serverDefault.
    requested_variant_samples = request_body.get("variant_samples")
    requested_structural_variant_samples = request_body.get("structural_variant_samples")

    existing_variant_samples = context.properties.get("variant_samples", [])
    existing_structural_variant_samples = context.properties.get("structural_variant_samples", [])

    patch_payload = {}

    # Skip adding duplicate selections (shouldn't occur, but just in case)
    existing_selections_by_uuid = {}
    for selection in existing_variant_samples + existing_structural_variant_samples:
        existing_selections_by_uuid[selection["variant_sample_item"]] = selection

    def make_selection_payload(vs_sel):
        return {
            "selected_by": userid,
            "variant_sample_item": vs_sel["variant_sample_item"],
            "filter_blocks_used": vs_sel["filter_blocks_used"]
            # date_selected - will be filled upon PATCH
        }

    if requested_variant_samples is not None:
        patch_payload["variant_samples"] = existing_variant_samples.copy()
        for vs_sel in requested_variant_samples:
            if vs_sel["variant_sample_item"] in existing_selections_by_uuid:
                continue
            patch_payload["variant_samples"].append(make_selection_payload(vs_sel))

    if requested_structural_variant_samples is not None:
        patch_payload["structural_variant_samples"] = existing_structural_variant_samples.copy()
        for vs_sel in requested_structural_variant_samples:
            if vs_sel["variant_sample_item"] in existing_selections_by_uuid:
                continue
            patch_payload["structural_variant_samples"].append(make_selection_payload(vs_sel))

    if not patch_payload:
        return HTTPNotModified("Nothing submitted")

    patch_result = perform_patch_as_admin(request, context.jsonld_id(request), patch_payload)

    return {
        "status": "success",
        "@type": ["result"]
    }


@view_config(
    name='order-delete-selections',
    context=VariantSampleList,
    request_method='PATCH',
    permission='edit'
)
def order_delete_selections(context, request):
    """
    Updates order & presence of VariantSampleList Items
    """

    request_body = request.json
    # We expect lists of UUIDs.
    # We do NOT accept entire items, we preserve existing values for "selected_by" and "date_selected".
    requested_variant_samples = request_body.get("variant_samples")
    requested_structural_variant_samples = request_body.get("structural_variant_samples")

    existing_variant_samples = context.properties.get("variant_samples", [])
    existing_structural_variant_samples = context.properties.get("structural_variant_samples", [])

    selections_by_uuid = {}
    for selection in existing_variant_samples + existing_structural_variant_samples:
        selections_by_uuid[selection["variant_sample_item"]] = selection

    patch_payload = {}

    if requested_variant_samples is not None:
        patch_payload["variant_samples"] = []
        for vs_uuid in requested_variant_samples:
            # Allow exception & stop if vs_uuid not found in selections_by_uuid
            patch_payload["variant_samples"].append(selections_by_uuid[vs_uuid])

    if requested_structural_variant_samples is not None:
        patch_payload["structural_variant_samples"] = []
        for vs_uuid in requested_structural_variant_samples:
            # Allow exception & stop if vs_uuid not found in selections_by_uuid
            patch_payload["structural_variant_samples"].append(selections_by_uuid[vs_uuid])

    if not patch_payload:
        return HTTPNotModified("Nothing submitted")

    # TODO: Save who+when deleted VariantSample from VariantSampleList

    perform_patch_as_admin(request, context.jsonld_id(request), patch_payload)

    return {
        "status": "success",
        "@type": ["result"]
    }


@view_config(name='spreadsheet', context=VariantSampleList, request_method='GET',
             permission='view')
@debug_log
def variant_sample_list_spreadsheet(context, request):

    file_format = request.GET.get("file_format", None)
    case_accession = request.GET.get("case_accession", context.properties.get("created_for_case"))

    if not file_format:
        file_format = "tsv"
    elif file_format not in { "tsv", "csv" }: # TODO: Add support for xslx.
        raise HTTPBadRequest("Expected a valid `file_format` such as TSV or CSV.")


    timestamp = datetime.datetime.now(pytz.utc).isoformat()[:-13] + "Z"
    suggested_filename = (case_accession or "case") + "-interpretation-" + timestamp + "." + file_format


    variant_sample_uuids = [ vso["variant_sample_item"] for vso in context.properties.get("variant_samples", []) ]
    spreadsheet_mappings = get_spreadsheet_mappings(request)
    fields_to_embed = get_fields_to_embed(spreadsheet_mappings)


    def load_variant_sample(vs_uuid):
        '''
        We want to grab datastore=database version of Items here since is likely that user has _just_ finished making
        an edit when they decide to export the spreadsheet from the InterpretationTab UI.
        '''
        vs_embedding_instance = CustomEmbed(request, vs_uuid, embed_props={ "requested_fields": fields_to_embed })
        result = vs_embedding_instance.result
        return result

    def vs_dicts_generator():
        for vs_uuid in variant_sample_uuids:
            vs_result = load_variant_sample(vs_uuid)
            yield convert_item_to_sheet_dict(vs_result, spreadsheet_mappings)


    return Response(
        app_iter = stream_tsv_output(
            vs_dicts_generator(),
            spreadsheet_mappings,
            file_format
        ),
        headers={
            'X-Accel-Buffering': 'no',
            # 'Content-Encoding': 'utf-8', # Disabled so that Python unit test may work (TODO: Look into more?)
            'Content-Disposition': 'attachment; filename=' + suggested_filename,
            'Content-Type': 'text/' + file_format,
            'Content-Description': 'File Transfer',
            'Cache-Control': 'no-store'
        }
    )


############################################################
### Spreadsheet Generation for Variant Sample Item Lists ###
############################################################


POPULATION_SUFFIX_TITLE_TUPLES = [
    ("afr", "African-American/African"),
    ("ami", "Amish"),
    ("amr", "Latino"),
    ("asj", "Ashkenazi Jewish"),
    ("eas", "East Asian"),
    ("fin", "Finnish"),
    ("mid", "Middle Eastern"),
    ("nfe", "Non-Finnish European"),
    ("oth", "Other Ancestry"),
    ("sas", "South Asian")
]

def get_spreadsheet_mappings(request = None):

    def get_boolean_transcript_field(variant_sample, field):
        variant = variant_sample.get("variant", {})
        for transcript in variant.get("transcript", []):
            if transcript.get(field, False) is True:
                return transcript
        return None

    def get_canonical_transcript(variant_sample):
        return get_boolean_transcript_field(variant_sample, "csq_canonical")

    def get_most_severe_transcript(variant_sample):
        return get_boolean_transcript_field(variant_sample, "csq_most_severe")

    def get_most_severe_consequence(variant_sample_transcript):
        ''' Used only for "Location" '''
        csq_consequences = variant_sample_transcript.get("csq_consequence", [])
        if not csq_consequences:
            return None
        impact_map = {
            "HIGH" : 0,
            "MODERATE" : 1,
            "LOW" : 2,
            "MODIFIER" : 3
        }
        most_severe_impact_val = inf
        most_severe_consequence = None
        for consequence in csq_consequences:
            impact_val = impact_map[consequence["impact"]]
            if impact_val < most_severe_impact_val:
                most_severe_consequence = consequence
                most_severe_impact_val = impact_val

        return most_severe_consequence


    def canonical_transcript_csq_feature(variant_sample):
        ''' Returns `variant.transcript.csq_feature` '''
        canonical_transcript = get_canonical_transcript(variant_sample)
        if canonical_transcript:
            return canonical_transcript.get("csq_feature", None)
        return None

    def most_severe_transcript_csq_feature(variant_sample):
        ''' Returns `variant.transcript.csq_feature` '''
        most_severe_transcript = get_most_severe_transcript(variant_sample)
        if most_severe_transcript:
            return most_severe_transcript.get("csq_feature", None)
        return None

    # TODO: Consider making `canonical_transcript_location` + `most_severe_transcript_location` as calculated properties
    def location_name(transcript):
        most_severe_consequence = get_most_severe_consequence(transcript)
        consequence_name = most_severe_consequence["var_conseq_name"].lower() if most_severe_consequence is not None and "var_conseq_name" in most_severe_consequence else None

        return_str = None

        csq_exon = transcript.get("csq_exon", None)
        csq_intron = transcript.get("csq_intron", None)
        csq_distance = transcript.get("csq_distance", None)

        if csq_exon is not None:
            return_str = "Exon " + csq_exon
        elif csq_intron is not None:
            return_str = "Intron " + csq_intron
        elif csq_distance is not None and consequence_name is not None:
            if consequence_name == "downstream_gene_variant":
                return_str = csq_distance + "bp downstream"
            elif consequence_name == "upstream_gene_variant":
                return_str = csq_distance + "bp upstream"

        if consequence_name == "3_prime_utr_variant":
            if return_str:
                return_str += " (3′ UTR)"
            else:
                return_str = "3′ UTR"
        elif consequence_name == "5_prime_utr_variant":
            if return_str:
                return_str += " (5′ UTR)"
            else:
                return_str = "5′ UTR"

        return return_str

    def canonical_transcript_location(variant_sample):
        canonical_transcript = get_canonical_transcript(variant_sample)
        if not canonical_transcript:
            return None
        return location_name(canonical_transcript)

    def most_severe_transcript_location(variant_sample):
        most_severe_transcript = get_most_severe_transcript(variant_sample)
        if not most_severe_transcript:
            return None
        return location_name(most_severe_transcript)

    def canonical_transcript_consequence_display_title(variant_sample):
        canonical_transcript = get_canonical_transcript(variant_sample)
        if not canonical_transcript:
            return None
        csq_consequences = canonical_transcript.get("csq_consequence", [])
        if not csq_consequences:
            return None
        return ", ".join([ c["display_title"] for c in csq_consequences ])

    def most_severe_transcript_consequence_display_title(variant_sample):
        most_severe_transcript = get_most_severe_transcript(variant_sample)
        if not most_severe_transcript:
            return None
        csq_consequences = most_severe_transcript.get("csq_consequence", [])
        if not csq_consequences:
            return None
        return ", ".join([ c["display_title"] for c in csq_consequences ])

    def gnomadv3_popmax_population(variant_sample):
        variant = variant_sample.get("variant", {})
        csq_gnomadg_af_popmax = variant.get("csq_gnomadg_af_popmax")
        if not csq_gnomadg_af_popmax: # Return None for 0, also.
            return None
        for pop_suffix, pop_name in POPULATION_SUFFIX_TITLE_TUPLES:
            pop_val = variant.get("csq_gnomadg_af-" + pop_suffix)
            if pop_val is not None and pop_val == csq_gnomadg_af_popmax:
                return pop_name
        return None

    def gnomadv2_popmax_population(variant_sample):
        variant = variant_sample.get("variant", {})
        csq_gnomade2_af_popmax = variant.get("csq_gnomade2_af_popmax")
        if not csq_gnomade2_af_popmax: # Return None for 0, also.
            return None
        for pop_suffix, pop_name in POPULATION_SUFFIX_TITLE_TUPLES:
            pop_val = variant.get("csq_gnomade2_af-" + pop_suffix)
            if pop_val is not None and pop_val == csq_gnomade2_af_popmax:
                return pop_name
        return None

    def get_most_recent_note_of_project(notes_iterable, project_at_id):
        for note in reversed(list(notes_iterable)):
            note_project_id = note["project"]
            if isinstance(note_project_id, dict):
                # We might get string OR @@embedded representation, e.g. if from search response.
                note_project_id = note_project_id.get("@id")
            if project_at_id == note["project"]:
                return note
        return None

    def own_project_note_factory(note_field_of_vs, note_field):

        def callable(variant_sample):
            notes_iterable = simple_path_ids(variant_sample, note_field_of_vs)
            vs_project_at_id = variant_sample.get("project")
            if isinstance(vs_project_at_id, dict):
                # We might get string OR @@embedded representation, e.g. if from search response.
                vs_project_at_id = vs_project_at_id.get("@id")
            if not vs_project_at_id:
                return None

            note_item = get_most_recent_note_of_project(notes_iterable, vs_project_at_id)

            if note_item:
                return note_item.get(note_field)
            else:
                return None

        return callable


    # portal_root_url = request.resource_url(request.root)[:-1]

    return [
    ##  Column Title                             |  CGAP Field (if not custom function)                          |  Description
    ##  ---------------------------------------  |  -----------------------------------------------------------  |  --------------------------------------------------------------------------
        ("ID",                                      "@id",                                                          "URL path to the Sample Variant on this row"),
        ("Chrom (hg38)",                            "variant.CHROM",                                                "Chromosome (hg38 assembly)"),
        ("Pos (hg38)",                              "variant.POS",                                                  "Start Position (hg38 assembly)"),
        ("Chrom (hg19)",                            "variant.hg19_chr",                                             "Chromosome (hg19 assembly)"),
        ("Pos (hg19)",                              "variant.hg19_pos",                                             "Start Position (hg19 assembly)"),
        ("Ref",                                     "variant.REF",                                                  "Reference Nucleotide"),
        ("Alt",                                     "variant.ALT",                                                  "Alternate Nucleotide"),
        ("Proband genotype",                        "associated_genotype_labels.proband_genotype_label",            "Proband Genotype"),
        ("Mother genotype",                         "associated_genotype_labels.mother_genotype_label",             "Mother Genotype"),
        ("Father genotype",                         "associated_genotype_labels.father_genotype_label",             "Father Genotype"),
        ("HGVSG",                                   "variant.hgvsg",                                                "HGVS genomic nomenclature"),
        ("HGVSC",                                   "variant.genes.genes_most_severe_hgvsc",                        "HGVS cPos nomenclature"),
        ("HGVSP",                                   "variant.genes.genes_most_severe_hgvsp",                        "HGVS pPos nomenclature"),
        ("dbSNP ID",                                "variant.ID",                                                   "dbSNP ID of variant"),
        ("Genes",                                   "variant.genes.genes_most_severe_gene.display_title",           "Gene symbol(s)"),
        ("Gene type",                               "variant.genes.genes_most_severe_gene.gene_biotype",            "Type of Gene"),
        # ONLY FOR variant.transcript.csq_canonical=true
        ("Canonical transcript ID",                 canonical_transcript_csq_feature,                               "Ensembl ID of canonical transcript of gene variant is in"),
        # ONLY FOR variant.transcript.csq_canonical=true; use `variant.transcript.csq_intron` if `variant.transcript.csq_exon` not present (display as in annotation space: eg. exon 34/45 or intron 4/7)
        ("Canonical transcript location",           canonical_transcript_location,                                  "Number of exon or intron variant is located in canonical transcript, out of total"),
        # ONLY FOR variant.transcript.csq_canonical=true
        ("Canonical transcript coding effect",      canonical_transcript_consequence_display_title,                 "Coding effect of variant in canonical transcript"),
        # ONLY FOR variant.transcript.csq_most_severe=true
        ("Most severe transcript ID",               most_severe_transcript_csq_feature,                             "Ensembl ID of transcript with worst annotation for variant"),
        # ONLY FOR variant.transcript.csq_most_severe=true; use csq_intron if csq_exon not present (display as in annotation space: eg. exon 34/45 or intron 4/7)
        ("Most severe transcript location",         most_severe_transcript_location,                                "Number of exon or intron variant is located in most severe transcript, out of total"),
        # ONLY FOR variant.transcript.csq_most_severe=true
        ("Most severe transcript coding effect",    most_severe_transcript_consequence_display_title,               "Coding effect of variant in most severe transcript"),
        ("Inheritance modes",                       "inheritance_modes",                                            "Inheritance Modes of variant"),
        ("NovoPP",                                  "novoPP",                                                       "Novocaller Posterior Probability"),
        ("Cmphet mate",                             "cmphet.comhet_mate_variant",                                   "Variant ID of mate, if variant is part of a compound heterozygous group"),
        ("Variant Quality",                         "QUAL",                                                         "Variant call quality score"),
        ("Genotype Quality",                        "GQ",                                                           "Genotype call quality score"),
        ("Strand Bias",                             "FS",                                                           "Strand bias estimated using Fisher's exact test"),
        ("Allele Depth",                            "AD_ALT",                                                       "Number of reads with variant allele"),
        ("Read Depth",                              "DP",                                                           "Total number of reads at position"),
        ("clinvar ID",                              "variant.csq_clinvar",                                          "Clinvar ID of variant"),
        ("gnomADv3 total AF",                       "variant.csq_gnomadg_af",                                       "Total allele frequency in gnomad v3 (genomes)"),
        ("gnomADv3 popmax AF",                      "variant.csq_gnomadg_af_popmax",                                "Max. allele frequency in gnomad v3 (genomes)"),
        # Name of population where `csq_gnomadg_af-<***> == csq_gnomadg_af_popmax`; use name in title (e.g. African-American/African)
        ("gnomADv3 popmax population",              gnomadv3_popmax_population,                                     "Population with max. allele frequency in gnomad v3 (genomes)"),
        ("gnomADv2 exome total AF",                 "variant.csq_gnomade2_af",                                      "Total allele frequency in gnomad v2 (exomes)"),
        ("gnomADv2 exome popmax AF",                "variant.csq_gnomade2_af_popmax",                               "Max. allele frequency in gnomad v2 (exomes)"),
        # Name of population where `csq_gnomade2_af-<***> == csq_gnomade2_af_popmax`; use name in title (e.g. African-American/African)
        ("gnomADv2 exome popmax population",        gnomadv2_popmax_population,                                     "Population with max. allele frequency in gnomad v2 (exomes)"),
        ("GERP++",                                  "variant.csq_gerp_rs",                                          "GERP++ score"),
        ("CADD",                                    "variant.csq_cadd_phred",                                       "CADD score"),
        ("phyloP-30M",                              "variant.csq_phylop30way_mammalian",                            "phyloP (30 Mammals) score"),
        ("phyloP-100V",                             "variant.csq_phylop100way_vertebrate",                          "phyloP (100 Vertebrates) score"),
        ("phastCons-100V",                          "variant.csq_phastcons100way_vertebrate",                       "phastCons (100 Vertebrates) score"),
        ("SIFT",                                    "variant.csq_sift_pred",                                        "SIFT prediction"),
        ("PolyPhen2",                               "variant.csq_polyphen2_hvar_pred",                              "PolyPhen2 prediction"),
        ("PrimateAI",                               "variant.csq_primateai_pred",                                   "Primate AI prediction"),
        ("REVEL",                                   "variant.csq_revel_score",                                      "REVEL score"),
        ("SpliceAI",                                "variant.spliceaiMaxds",                                        "SpliceAI score"),
        ("LOEUF",                                   "variant.genes.genes_most_severe_gene.oe_lof_upper",            "Loss-of-function observed/expected upper bound fraction"),
        ("RVIS (ExAC)",                             "variant.genes.genes_most_severe_gene.rvis_exac",               "RVIS (Residual Variation Intolerance Score) genome-wide percentile from ExAC"),
        ("S-het",                                   "variant.genes.genes_most_severe_gene.s_het",                   "Estimates of heterozygous selection (source: Cassa et al 2017 Nat Genet doi:10.1038/ng.3831)"),
        ("MaxEntScan",                              "variant.genes.genes_most_severe_maxentscan_diff",              "Difference in MaxEntScan scores (Maximum Entropy based scores of splicing strength) between Alt and Ref alleles"),
        ("ACMG classification (curr)",              "interpretation.classification",                                "ACMG classification for variant in this case"),
        ("ACMG rules (curr)",                       "interpretation.acmg_rules_invoked.acmg_rule_name",             "ACMG rules invoked for variant in this case"),
        ("Clinical interpretation notes (curr)",    "interpretation.note_text",                                     "Clinical interpretation notes written for this case"),
        ("Gene candidacy (curr)",                   "discovery_interpretation.gene_candidacy",                      "Gene candidacy level selected for this case"),
        ("Variant candidacy (curr)",                "discovery_interpretation.variant_candidacy",                   "Variant candidacy level selected for this case"),
        ("Discovery notes (curr)",                  "discovery_interpretation.note_text",                           "Gene/variant discovery notes written for this case"),
        ("Variant notes (curr)",                    "variant_notes.note_text",                                      "Additional notes on variant written for this case"),
        ("Gene notes (curr)",                       "gene_notes.note_text",                                         "Additional notes on gene written for this case"),
        # For next 6, grab only from note from same project as the VariantSample
        ("ACMG classification (prev)",              own_project_note_factory("variant.interpretations", "classification"),                      "ACMG classification for variant in previous cases"),
        ("ACMG rules (prev)",                       own_project_note_factory("variant.interpretations", "acmg"),                                "ACMG rules invoked for variant in previous cases"),
        ("Clinical interpretation (prev)",          own_project_note_factory("variant.interpretations", "note_text"),                           "Clinical interpretation notes written for previous cases"),
        ("Gene candidacy (prev)",                   own_project_note_factory("variant.discovery_interpretations", "gene_candidacy"),            "Gene candidacy level selected for previous cases"),
        ("Variant candidacy (prev)",                own_project_note_factory("variant.discovery_interpretations", "variant_candidacy"),         "Variant candidacy level selected for previous cases"),
        ("Discovery notes (prev)",                  own_project_note_factory("variant.discovery_interpretations", "note_text"),                 "Gene/variant discovery notes written for previous cases"),
        ("Variant notes (prev)",                    own_project_note_factory("variant.variant_notes", "note_text"),                             "Additional notes on variant written for previous cases"),
        ("Gene notes (prev)",                       own_project_note_factory("variant.genes.genes_most_severe_gene.gene_notes", "note_text"),   "Additional notes on gene written for previous cases"),
    ]


def get_fields_to_embed(spreadsheet_mappings):
    fields_to_embed = [
        ## Most of these are needed for columns with render/transform/custom-logic functions in place of (string) CGAP field.
        ## Keep up-to-date with any custom logic.
        "@id",
        "@type",
        "project", # Used to get most recent notes of same project from Variant & Gene
        "variant.transcript.csq_canonical",
        "variant.transcript.csq_most_severe",
        "variant.transcript.csq_feature",
        "variant.transcript.csq_consequence.impact",
        "variant.transcript.csq_consequence.var_conseq_name",
        "variant.transcript.csq_consequence.display_title",
        "variant.transcript.csq_exon",
        "variant.transcript.csq_intron",
        ## Notes (e.g. as used by `own_project_note_factory`)
        "variant.interpretations.classification",
        "variant.interpretations.acmg",
        "variant.interpretations.note_text",
        "variant.interpretations.project", # @id (string) form
        "variant.discovery_interpretations.gene_candidacy",
        "variant.discovery_interpretations.variant_candidacy",
        "variant.discovery_interpretations.note_text",
        "variant.discovery_interpretations.project", # @id (string) form
        "variant.variant_notes.note_text",
        "variant.variant_notes.project", # @id (string) form
        "variant.genes.genes_most_severe_gene.gene_notes.note_text",
        "variant.genes.genes_most_severe_gene.gene_notes.project"
    ]
    for pop_suffix, pop_name in POPULATION_SUFFIX_TITLE_TUPLES:
        fields_to_embed.append("variant.csq_gnomadg_af-" + pop_suffix)
        fields_to_embed.append("variant.csq_gnomade2_af-" + pop_suffix)
    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        if isinstance(cgap_field_or_func, str):
            # We don't expect any duplicate fields (else would've used a set in place of list) ... pls avoid duplicates in spreadsheet_mappings.
            fields_to_embed.append(cgap_field_or_func)
    return fields_to_embed
