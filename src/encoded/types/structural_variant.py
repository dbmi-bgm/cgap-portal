import io

import negspy.coordinates as nc
from snovault import calculated_property, collection, load_schema

from ..ingestion.common import CGAP_CORE_PROJECT
from ..util import resolve_file_path
from .base import Item, get_item_or_none
from .variant import (
    ANNOTATION_ID,
    build_variant_sample_annotation_id,
    extend_embedded_list,
    load_extended_descriptions_in_schemas,
    SHARED_VARIANT_EMBEDS,
    SHARED_VARIANT_SAMPLE_EMBEDS,
)


def build_structural_variant_embedded_list():
    """Determines the embedded_list based on the information
    present in schemas/structural_variant_embeds.json

    :returns: list of structural variant embeds
    """
    embedded_list = SHARED_VARIANT_EMBEDS + []
    with io.open(
        resolve_file_path("schemas/structural_variant_embeds.json"), "r"
    ) as fd:
        extend_embedded_list(embedded_list, fd, "structural_variant")
    return embedded_list + Item.embedded_list


def build_structural_variant_sample_embedded_list():
    """Determines the embedded list for structural variants within
    structural_variant_sample ie: structural_variant.* is not
    sufficient for things embedded into structural variant
    that we'd like to search on in the structural_variant_sample
    context. Works very similary to the above function

    :returns: list of embeds from 'structural_variant' linkTo
    """
    embedded_list = SHARED_VARIANT_SAMPLE_EMBEDS + []
    with io.open(
        resolve_file_path("schemas/structural_variant_embeds.json"), "r"
    ) as fd:
        extend_embedded_list(
            embedded_list, fd, "structural_variant", prefix="structural_variant."
        )
    with io.open(
        resolve_file_path("schemas/structural_variant_sample_embeds.json"), "r"
    ) as fd:
        extend_embedded_list(embedded_list, fd, "structural_variant_sample")
    return ["structural_variant.*"] + embedded_list + Item.embedded_list


def build_structural_variant_display_title(sv_type, chrom, start, end):
    """Builds the structural variant display title according to the type of SV."""
    display_title = "%s_chr%s:%s-%s" % (sv_type, chrom, start, end)
    return display_title


@collection(
    name="structural-variants",
    properties={
        "title": "Structural variants",
        "description": "List of all structural variants",
    },
    unique_key="structural_variant:annotation_id",
)
class StructuralVariant(Item):
    """ Structural variant class """

    item_type = "structural_variant"
    name_key = "annotation_id"
    schema = load_schema("encoded:schemas/structural_variant.json")
    embedded_list = build_structural_variant_embedded_list()

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """
        Sets the annotation_id field on this structural variant prior to passing on.
        """
        properties[ANNOTATION_ID] = build_structural_variant_display_title(
            properties["SV_TYPE"],
            properties["CHROM"],
            properties["START"],
            properties["END"],
        )
        return super().create(registry, uuid, properties, sheets)

    @calculated_property(
        schema={
            "title": "Display Title",
            "description": "A calculated title for every object in CGAP",
            "type": "string",
        }
    )
    def display_title(self, SV_TYPE, CHROM, START, END):
        return build_structural_variant_display_title(SV_TYPE, CHROM, START, END)

    @calculated_property(
        schema={
            "title": "Start position (genome coordinates)",
            "description": "Start absolute position in genome coordinates",
            "type": "integer",
        }
    )
    def START_ABS(self, CHROM, START):
        chrom_info = nc.get_chrominfo("hg38")
        return nc.chr_pos_to_genome_pos("chr" + CHROM, START, chrom_info)

    @calculated_property(
        schema={
            "title": "End position (genome coordinates)",
            "description": "End absolute position in genome coordinates",
            "type": "integer",
        }
    )
    def END_ABS(self, CHROM, END):
        chrom_info = nc.get_chrominfo("hg38")
        return nc.chr_pos_to_genome_pos("chr" + CHROM, END, chrom_info)


@collection(
    name="structural-variant-samples",
    properties={
        "title": "Structural variants (sample)",
        "description": "List of all structural variants with sample specific information",
    },
    unique_key="structural_variant_sample:annotation_id",
)
class StructuralVariantSample(Item):
    """Class for structural variant samples."""

    item_type = "structural_variant_sample"
    schema = load_extended_descriptions_in_schemas(
        load_schema("encoded:schemas/structural_variant_sample.json")
    )
    rev = {"variant_sample_list": (
        "VariantSampleList", "structural_variant_samples.structural_variant_sample_item"
    )}
    embedded_list = build_structural_variant_sample_embedded_list()

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """Sets the annotation_id field on this structural variant sample
        prior to passing on."""
        properties[ANNOTATION_ID] = "%s:%s:%s" % (
            properties["CALL_INFO"],
            properties["structural_variant"],
            properties["file"],
        )
        return super().create(registry, uuid, properties, sheets)

    @calculated_property(
        schema={
            "title": "Display Title",
            "description": "A calculated title for every object in CGAP",
            "type": "string",
        }
    )
    def display_title(self, request, CALL_INFO, structural_variant=None):
        structural_variant = get_item_or_none(
            request, structural_variant, "StructuralVariant", frame="raw"
        )
        structural_variant_display_title = build_structural_variant_display_title(
            structural_variant["SV_TYPE"],
            structural_variant["CHROM"],
            structural_variant["START"],
            structural_variant["END"],
        )
        if structural_variant:
            return CALL_INFO + ":" + structural_variant_display_title
        return CALL_INFO

    @calculated_property(
        schema={
            "title": "Variant Sample List",
            "description": "The list containing this variant sample",
            "type": "string",
            "linkTo": "VariantSampleList",
        }
    )
    def variant_sample_list(self, request):
        result = self.rev_link_atids(request, "variant_sample_list")
        if result:
            return result[0]  # expected one list per case

    @calculated_property(
        schema={
            "title": "BAM Snapshot",
            "description": "Link to Genome Snapshot Image",
            "type": "string",
        }
    )
    def bam_snapshot(self, request, file, structural_variant):
        structural_variant_props = get_item_or_none(
            request, structural_variant, "StructuralVariant", frame="raw"
        )
        if structural_variant_props is None:
            raise RuntimeError("Got none for something that definitely exists")
        file_path = (
            "%s/bamsnap/chr%s_%s.png"
            % (  # file = accession of associated VCF file
                file,
                structural_variant_props["CHROM"],
                structural_variant_props["START"],
            )
        )
        return file_path