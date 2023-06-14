import datetime
import io
import json
import os
from typing import Iterator, List
from urllib.parse import parse_qs, urlparse

import negspy.coordinates as nc
import pytz
import structlog
from dcicutils.misc_utils import ignorable, ignored
from pyramid.httpexceptions import HTTPBadRequest, HTTPNotModified, HTTPServerError, HTTPTemporaryRedirect
from pyramid.request import Request
from pyramid.settings import asbool
from pyramid.traversal import find_resource
from pyramid.view import view_config
from snovault import calculated_property, collection, load_schema  # , TYPES
from snovault.calculated import calculate_properties
from snovault.embed import make_subrequest
from snovault.util import debug_log, IndexSettings

from .. import custom_embed
from ..batch_download import (
    get_spreadsheet_response,
    get_timestamp,
    get_variant_sample_rows,
    validate_spreadsheet_file_format,
    VariantSampleSpreadsheet,
)
from ..batch_download_utils import SpreadsheetRequest
from ..custom_embed import CustomEmbed
from ..item_models import VariantSampleList as VariantSampleListModel
from ..ingestion.common import CGAP_CORE_PROJECT
from ..inheritance_mode import InheritanceMode
from ..search.search import get_iterable_search_results
from ..types.base import Item, get_item_or_none
from ..util import JsonObject, resolve_file_path, build_s3_presigned_get_url, convert_integer_to_comma_string


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
    # The following 4 "@id" fields are now requested through /embed API when on the VariantSample ItemView
    # and available through VariantSampleList item (datastore=database request) for when in Case ItemView's
    # Interpretation+Review Tabs.
    "variant_notes.@id",
    "gene_notes.@id",
    "interpretation.@id",
    "discovery_interpretation.@id",

    "variant_sample_list.created_for_case",

    # We need Technical Review data in our search result rows, so we must embed these here and not use /embed API.
    "technical_review.@id",
    "technical_review.uuid",
    "technical_review.assessment.call",
    "technical_review.assessment.classification",
    "technical_review.assessment.date_call_made",
    "technical_review.assessment.call_made_by.display_title",
    "technical_review.review.date_reviewed",
    "technical_review.review.reviewed_by.display_title",
    "technical_review.note_text",
    "technical_review.last_text_edited.date_text_edited",
    "technical_review.last_text_edited.text_edited_by",
    # "technical_review.review.date_reviewed",   # <- Will be used later, after UX for this is defined.
    # "technical_review.review.reviewed_by",     # <- Will be used later, after UX for this is defined.
    "technical_review.approved_by.display_title",
    "technical_review.date_approved",
    "technical_review.last_modified.date_modified",
    "technical_review.is_saved_to_project",
    "technical_review.status",
    "project_technical_review.@id",
    "project_technical_review.uuid",
    "project_technical_review.assessment.call",
    "project_technical_review.assessment.classification",
    "project_technical_review.assessment.date_call_made",
    "project_technical_review.assessment.call_made_by.display_title",
    "project_technical_review.review.date_reviewed",
    "project_technical_review.review.reviewed_by.display_title",
    "project_technical_review.note_text",
    "project_technical_review.last_text_edited.date_text_edited",
    "project_technical_review.last_text_edited.text_edited_by",
    "project_technical_review.approved_by.display_title",
    "project_technical_review.date_approved",
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
        "genes.genes_most_severe_gene.gene_notes.@id",  # `genes` not present on StructuralVariant
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
        "variant.genes.genes_most_severe_gene.gene_notes.@id",
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
                    field_schema["extended_description"] = "".join([line.strip() for line in open_file.readlines()])

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


def perform_request_as_admin(request, target_path, payload=None, request_method="PATCH"):
    """
    Patches Items as 'UPGRADER' user/permissions.

    TODO: Seems like this could be re-usable somewhere, maybe move to snovault?
    """
    if len(payload) == 0 and request_method != "GET":
        log.warning("Skipped PATCHing " + target_path + " due to empty payload.")
        return # skip empty patches (e.g. if duplicate note uuid is submitted that a Gene has already)
    subreq = make_subrequest(request, target_path, method=request_method, json_body=payload, inherit_user=False)
    subreq.remote_user = "UPGRADE"
    if 'HTTP_COOKIE' in subreq.environ:
        del subreq.environ['HTTP_COOKIE']
    patch_result = request.invoke_subrequest(subreq).json
    # /queue_indexing returns 'notification', while PATCH/POST returns 'status'.
    # Perhaps should check "response status code begins with 2XX" instead?
    if patch_result.get("status") != "success" and patch_result.get("notification") != "Success":
        raise HTTPServerError(request_method + " request to " + target_path + " failed.")
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
        "title": "Project Technical Review",
        "description": "The technical review saved to project for this Variant",
        "type": "string",
        "linkTo": "NoteTechnicalReview"
    })
    def project_technical_review(self, request, variant=None, project=None):
        variant = get_item_or_none(request, variant, 'Variant', frame='raw')
        if variant and project:
            # project param will be in form of @id
            for tr_uuid in variant.get("technical_reviews", []):
                # frame=object returns linkTos in form of @id, frame=raw returns them in form of UUID.
                technical_review = get_item_or_none(request, tr_uuid, 'NoteTechnicalReview', frame='object')
                if technical_review.get("project") == project: # Comparing @IDs
                    return tr_uuid
        return None

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
        "description": "Variant Allele Fraction",
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
    name='update-project-notes',
    context=VariantSample,
    request_method='PATCH',
    permission='edit'
)
def update_project_notes(context, request):
    """This endpoint is used to process notes attached to this (in-context) VariantSample."""
    return update_project_notes_process(context, request)




def update_project_notes_process(context, request):
    """
    Currently, "saving to project" is supported, but more functions may be available in future.

    ### Usage

    The endpoint currently accepts the following as JSON body of a POST request, and will then
    change the status of each note to "shared" upon asserting edit permissions from PATCHer for each note,
    and save it to the proper field on the Variant and Gene item(s) linked to from this [Structural]VariantSample.::

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
    save_to_project_notes = request_body.get("save_to_project_notes", {})
    remove_from_project_notes = request_body.get("remove_from_project_notes", {})

    vs_to_item_mappings = {
        # "Variant" can apply to "Variant" or "StructuralVariant" when it appears here.
        "interpretation": {
            "Variant": "interpretations"
        },
        "discovery_interpretation": {
            "Variant": "discovery_interpretations",
            "Gene": "discovery_interpretations"
        },
        "variant_notes": {
            "Variant": "variant_notes"
        },
        "gene_notes": {
            "Gene": "gene_notes"
        },
        "technical_review": {
            "Variant": "technical_reviews"
        }
    }

    if not save_to_project_notes and not remove_from_project_notes:
        raise HTTPBadRequest("No Item UUIDs supplied.")
    if save_to_project_notes and remove_from_project_notes:
        raise HTTPBadRequest("May only supply 1 request at a time, to remove from OR to save to project.")

    loaded_notes = {}

    def validate_and_load_item(vs_field_name):

        uuid_to_process = None

        # Initial Validation - ensure each requested UUID is present in own properties and editable
        if vs_field_name in save_to_project_notes:
            uuid_to_process = save_to_project_notes[vs_field_name]

            # Compare UUID submitted vs UUID present on VS Item
            if uuid_to_process != context.properties[vs_field_name]:
                raise HTTPBadRequest(f"Not all submitted Item UUIDs are present on [Structural]VariantSample."
                                     f" Check 'save_to_project_notes.{vs_field_name}'.")

        elif vs_field_name in remove_from_project_notes:
            uuid_to_process = remove_from_project_notes[vs_field_name]

        if uuid_to_process is None:
            return # skip

        # Get @@object view of Item to check edit permission
        loaded_item = request.embed("/" + uuid_to_process, "@@object", as_user=True)
        item_resource = find_resource(request.root, loaded_item["@id"])
        if not request.has_permission("edit", item_resource):
            raise HTTPBadRequest(f"No edit permission for at least one submitted Item UUID."
                                 f" Check 'save_to_project_notes.{vs_field_name}'.")
        else:
            loaded_notes[vs_field_name] = loaded_item

    for vs_field_name in vs_to_item_mappings.keys():
        validate_and_load_item(vs_field_name)

    if len(loaded_notes) == 0:
        raise HTTPBadRequest("No Item UUIDs could be loaded, check permissions.")


    variant_patch_payload = {} # Single item/dict, can be converted to dict of variants if need to PATCH multiple in future
    genes_patch_payloads = {} # Keyed by @id, along with `note_patch_payloads`
    notes_patch_payloads = {}

    # PATCHing variant or gene only needed when saving notes to project, not to report.

    variant_fields_needed = []
    gene_fields_needed = []

    # Embed only the fields we need (for performance).
    for note_field in { *save_to_project_notes.keys(), *remove_from_project_notes.keys() }:
        for item_type in vs_to_item_mappings[note_field].keys():
            vg_notes_field_name = vs_to_item_mappings[note_field][item_type]
            vg_notes_fields_required = [ vg_notes_field_name + ".@id", vg_notes_field_name + ".project" ]
            if item_type == "Variant":
                variant_fields_needed = variant_fields_needed + vg_notes_fields_required
            elif item_type == "Gene":
                gene_fields_needed = gene_fields_needed + vg_notes_fields_required

    context_item_type = context.jsonld_type()
    is_structural_vs = context_item_type[0] == "StructuralVariantSample"

    variant = None
    variant_uuid = context.properties["structural_variant" if is_structural_vs else "variant"]
    genes = None # We may have multiple different genes from same variant; at moment we save note to each of them.

    if variant_fields_needed or gene_fields_needed:
        variant_fields_needed.append("@id")
    if gene_fields_needed:
        gene_fields_needed.append("@id")
        for gf in gene_fields_needed:
            variant_fields_needed.append("genes.genes_most_severe_gene." + gf)

    if variant_fields_needed:
        variant_embed = CustomEmbed(request, variant_uuid, embed_props={ "requested_fields": variant_fields_needed })
        variant = variant_embed.result
        if gene_fields_needed:
            genes = [ gene_subobject["genes_most_severe_gene"] for gene_subobject in variant["genes"] ]

    # Using `.now(pytz.utc)` appends "+00:00" for us (making the datetime timezone-aware), while `.utcnow()` doesn't.
    timestamp = datetime.datetime.now(pytz.utc).isoformat()
    auth_source, user_id = request.authenticated_userid.split(".", 1)

    def create_note_patch_payload(loaded_note, remove=False, approve=True):
        item_at_id = loaded_note["@id"]
        # This payload may still get updated further with "previous_note" by `add_or_replace_note_for_project_on_variant_or_gene_item`
        notes_patch_payloads[item_at_id] = notes_patch_payloads.get(item_at_id, {})
        # All 3 of these fields below have permissions: restricted_fields
        # and may only be manually editable by an admin.

        notes_patch_payloads[item_at_id]["is_saved_to_project"] = False if remove else True

        if not remove and loaded_note["status"] == "in review":
            # Upgrade to "current" - may change later -- DON'T change if status is something else (shared, etc.)
            notes_patch_payloads[item_at_id]["status"] = "current"

        if remove and loaded_note["status"] == "current":
            # Downgrade to "in review" only if status is "current" (don't change if is shared, etc.)
            # May change later.
            notes_patch_payloads[item_at_id]["status"] = "in review"

        if not remove and approve:
            notes_patch_payloads[item_at_id]["approved_by"] = user_id
            notes_patch_payloads[item_at_id]["date_approved"] = timestamp

    def add_or_replace_note_for_project_on_variant_or_gene_item(vs_field_name, vg_item, payload, remove=False):
        # At the moment, field names on Variant and Gene are the same, so we get via this "OR". Later, we might need
        # to figure out item type.
        vg_item_type_mapping = vs_to_item_mappings[vs_field_name]
        vg_field_name = vg_item_type_mapping.get("Variant") or vg_item_type_mapping.get("Gene")
        newly_shared_item_at_id = loaded_notes[vs_field_name]["@id"]

        if not vg_item.get(vg_field_name): # Variant or Gene Item has no existing notes for `vg_field_name` field.
            payload[vg_field_name] = [ newly_shared_item_at_id ]
            return

        # How big will this ultimately get? If few projects per instance should be fine; if used a knowledgebase then will
        # need to change to having Notes linkTo Variant, perhaps.

        item_ids = []
        removed = False
        for item in vg_item[vg_field_name]:
            if newly_shared_item_at_id == item["@id"]:
                # Already exists
                if not remove:
                    # Nothing left to do. Throw error?
                    return
                # Else remove it; pass
                removed = True
            else:
                item_ids.append(item["@id"])

        if remove:
            if not removed:
                raise HTTPBadRequest("Item to remove from project is not present")
            payload[vg_field_name] = item_ids
            return

        # Check if note from same project exists and remove it (link to it from Note.previous_note instd.)
        # Ensure we compare to Note.project and not User.project, in case an admin or similar is making edit.
        existing_item_from_project_idx = None
        for item_idx, item in enumerate(vg_item[vg_field_name]):
            if item["project"] == loaded_notes[vs_field_name]["project"]:
                existing_item_from_project_idx = item_idx
                break # Assumption is we only have 1 note per project in this list, so don't need to search further.

        payload[vg_field_name] = item_ids

        if existing_item_from_project_idx is not None:
            existing_item_from_project_at_id = vg_item[vg_field_name][existing_item_from_project_idx]["@id"]
            # Set existing note's status to "obsolete", and populate previous/superseding field if applicable
            notes_patch_payloads[existing_item_from_project_at_id] = notes_patch_payloads.get(existing_item_from_project_at_id, {})
            notes_patch_payloads[existing_item_from_project_at_id]["status"] = "obsolete"
            # Link to existing Note from newly-shared Note
            notes_patch_payloads[newly_shared_item_at_id]["previous_note"] = existing_item_from_project_at_id
            # Link to newly-shared Note from existing note (adds new PATCH request)
            notes_patch_payloads[existing_item_from_project_at_id] = notes_patch_payloads.get(existing_item_from_project_at_id, {})
            notes_patch_payloads[existing_item_from_project_at_id]["superseding_note"] = newly_shared_item_at_id
            # Remove existing Note from Variant or Gene Notes list
            del payload[vg_field_name][existing_item_from_project_idx]

        payload[vg_field_name].append(newly_shared_item_at_id)


    ## Handle Saves -
    for note_field in save_to_project_notes:
        item_field_mapping = vs_to_item_mappings[note_field]
        if loaded_notes[note_field]["is_saved_to_project"] is not True:
            create_note_patch_payload(loaded_notes[note_field])
        if "Variant" in item_field_mapping:     # Add to Variant
            add_or_replace_note_for_project_on_variant_or_gene_item(note_field, variant, variant_patch_payload)
        if "Gene" in item_field_mapping:        # Add to Genes
            for gene in genes:
                genes_patch_payloads[gene["@id"]] = genes_patch_payloads.get(gene["@id"], {})
                add_or_replace_note_for_project_on_variant_or_gene_item(note_field, gene, genes_patch_payloads[gene["@id"]])

    ## Handle Removes -

    for note_field in remove_from_project_notes:
        item_field_mapping = vs_to_item_mappings[note_field]
        if loaded_notes[note_field]["is_saved_to_project"] is True:
            create_note_patch_payload(loaded_notes[note_field], remove=True)
        if "Variant" in item_field_mapping: # Remove from Variant
            add_or_replace_note_for_project_on_variant_or_gene_item(note_field, variant, variant_patch_payload, remove=True)
        if "Gene" in item_field_mapping:
            raise HTTPBadRequest("Removing note from gene not yet implemented")



    # Perform the PATCHes!

    # TODO: Consider parallelizing.
    # Currently Gene and Variant patches are performed before Note statuses are updated to ensure
    # we don't update Note properties until the former patches have succeeded.
    # In UI logic, only Note.is_saved_to_project is checked to assert if a Note is already saved
    # to Project or not.

    gene_patch_count = 0
    if gene_fields_needed:
        for gene_atid, gene_payload in genes_patch_payloads.items():
            perform_request_as_admin(request, gene_atid, gene_payload, request_method="PATCH")
            gene_patch_count += 1

    variant_patch_count = 0
    if variant_fields_needed:
        variant_response = perform_request_as_admin(request, variant["@id"], variant_patch_payload, request_method="PATCH")
        ignorable(variant_response)
        variant_patch_count += 1
        # print('\n\n\nVARIANT RESPONSE', json.dumps(variant_response, indent=4))

    note_patch_count = 0
    note_patch_responses = []
    for note_atid, note_payload in notes_patch_payloads.items():
        patch_result = perform_request_as_admin(request, note_atid, note_payload, request_method="PATCH")
        note_patch_responses.append(patch_result)
        note_patch_count += 1


    # Follow-up - now we need to make sure all affected VariantSamples are re-indexed to be up-to-date in ES.
    # This matters right now for "VariantSample.project_technical_review" (calcprop, linkTo NoteTechnicalReview),
    # but will probably need to be propagated to all other notes once we make use of other saved to project notes.
    affected_variant_sample_uuids = []
    if variant_patch_count > 0 and ("technical_review" in save_to_project_notes or "technical_review" in remove_from_project_notes):
        vs_project_uuid = context.properties.get("project")
        param_lists = {
            "type": "StructuralVariantSample" if is_structural_vs else "VariantSample",
            "field": "uuid",
            "structural_variant.uuid" if is_structural_vs else "variant.uuid": variant_uuid,
            "project.uuid": vs_project_uuid
        }
        for variant_sample in get_iterable_search_results(request, param_lists=param_lists, inherit_user=False):
            affected_variant_sample_uuids.append(variant_sample['uuid'])
        if affected_variant_sample_uuids:
            perform_request_as_admin(request, "/queue_indexing", { "uuids": affected_variant_sample_uuids }, request_method="POST")


    return {
        "status" : "success",
        "results": {
            "Gene": {
                "patched_count": gene_patch_count
            },
            "StructuralVariant" if is_structural_vs else "Variant": {
                "patched_count": variant_patch_count
            },
            "Note": {
                "patched_count": note_patch_count,
                "responses": note_patch_responses
            },
            "StructuralVariantSample" if is_structural_vs else "VariantSample": {
                "queued_for_indexing": affected_variant_sample_uuids
            },
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

    patch_result = perform_request_as_admin(request, context.jsonld_id(request), patch_payload, request_method="PATCH")
    ignored(patch_result)  # TODO: Is that the right thing?

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

    perform_request_as_admin(request, context.jsonld_id(request), patch_payload, request_method="PATCH")

    return {
        "status": "success",
        "@type": ["result"]
    }


VARIANT_SAMPLE_FIELDS_TO_EMBED_FOR_SPREADSHEET = [
    "*",
    "variant.*",
    "variant.interpretations.*",
    "variant.discovery_interpretations.*",
    "variant.variant_notes.*",
    "variant.genes.genes_most_severe_gene.gene_notes.*",
    "variant.transcript.*",
    "variant.transcript.csq_consequence.*",
]


@view_config(
    name='spreadsheet',
    context=VariantSampleList,
    request_method='GET',
    permission='view',
    validators=[validate_spreadsheet_file_format],
)
@debug_log
def variant_sample_list_spreadsheet(context: VariantSampleList, request: Request):
    spreadsheet_request = SpreadsheetRequest(request)
    file_format = spreadsheet_request.get_file_format()
    file_name = get_variant_sample_spreadsheet_file_name(context, spreadsheet_request)
    items_for_spreadsheet = get_embedded_items(context, request)
    spreadsheet_rows = get_variant_sample_rows(
        items_for_spreadsheet, spreadsheet_request, embed_additional_items=False
    )
    return get_spreadsheet_response(file_name, spreadsheet_rows, file_format)


def get_variant_sample_spreadsheet_file_name(
    context: VariantSampleList, spreadsheet_request: SpreadsheetRequest
) -> str:
    file_format = spreadsheet_request.get_file_format()
    case_title = get_case_title(context, spreadsheet_request)
    timestamp = get_timestamp()
    return f"{case_title}-interpretation-{timestamp}.{file_format}"


def get_case_title(context: VariantSampleList, spreadsheet_request: SpreadsheetRequest) -> str:
    return (
        spreadsheet_request.get_case_accession()
        or get_associated_case(context)
        or "case"
    )


def get_associated_case(context: VariantSampleList) -> str:
    properties = get_item_properties(context)
    return VariantSampleListModel(properties).get_associated_case_accession()


def get_embedded_items(
    context: VariantSampleList, request: Request
) -> Iterator[JsonObject]:
    variant_sample_uuids = get_variant_sample_uuids(context)
    return (get_embedded_variant_sample(uuid, request) for uuid in variant_sample_uuids)


def get_item_properties(context: Item) -> JsonObject:
    return context.properties


def get_variant_sample_uuids(context: VariantSampleList) -> List[str]:
    variant_sample_list_properties = get_item_properties(context)
    variant_sample_list = VariantSampleListModel(variant_sample_list_properties)
    return variant_sample_list.get_variant_samples()


def get_embedded_variant_sample(variant_sample_identifier: str, request: Request) -> JsonObject:
    embedding_parameters = get_embedding_parameters()
    return custom_embed.CustomEmbed(
        request, variant_sample_identifier, embedding_parameters
    ).get_embedded_item()


def get_embedding_parameters() -> JsonObject:
    fields_to_embed = get_fields_to_embed()
    return {custom_embed.REQUESTED_FIELDS: fields_to_embed}


def get_fields_to_embed() -> List[str]:
    fields_from_spreadsheet = get_fields_to_embed_from_spreadsheet()
    return fields_from_spreadsheet + VARIANT_SAMPLE_FIELDS_TO_EMBED_FOR_SPREADSHEET


def get_fields_to_embed_from_spreadsheet() -> List[str]:
    spreadsheet_columns = VariantSampleSpreadsheet.get_spreadsheet_columns()
    return [
        spreadsheet_column.get_evaluator()
        for spreadsheet_column in spreadsheet_columns
        if spreadsheet_column.is_property_evaluator()
    ]
