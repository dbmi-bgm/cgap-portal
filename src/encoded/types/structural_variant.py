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

    @calculated_property(
        schema={
            "title": "Structural Variant Size",
            "description": "The size of this structural variant",
            "type": "number",
        }
    )
    def size(self, START, END):
        return END - START + 1

    @calculated_property(
        schema={
            "title": "Structural Variant Size Display",
            "description": "The abbreviated size of this structural variant",
            "type": "string",
        }
    )
    def size_display(self, START, END):
        """
        Create user-friendly display of size.

        Finds appropriate units "bucket" according to number of digits
        in the size, then rounds to 1 decimal place within the "bucket".

        :param request: cls pyramid request
        :param START: int start location of SV
        :param END: int end location of SV
        :return result: str size plus unit
        """
        result = None
        size = END - START + 1
        unit_max_exponents = [3, 6, 9, 12]  # Gb should be max given chromosome sizes
        display_units = ["bp", "Kb", "Mb", "Gb"]
        for exponent, unit in zip(unit_max_exponents, display_units):
            if size < 10**exponent:
                display_number = round(size*10**(-exponent+3), 1)
                result = str(display_number) + " " + unit
                break
        return result

    @calculated_property()
    def transcript_variant_endpoints(self, request, transcript=None):
        """"""
        if not transcript:
            return
        csq_five_prime = "csq_variant_5_prime_location"
        csq_three_prime = "csq_variant_3_prime_location"
        downstream_consequences = ["downstream_gene_variant"]
        upstream_consequences = ["upstream_gene_variant"]
        whole_transcript_consequences = ["transcript_amplification", "transcript_ablation"]
        error_msg = "Unsure"
        for item in transcript:
            exons = item.get("csq_exon", "")
            introns = item.get("csq_intron", "")
            consequences = item.get("csq_consequence")
            consequence_names = []
            for consequence in consequences:
                consequence_raw = get_item_or_none(request, consequence, frame="raw")
                consequence_names.append(consequence_raw.get("var_conseq_name"))
            if consequence_names and not (exons or introns):
                if len(consequence_names) != 1:
                    item[csq_five_prime] = item[csq_three_prime] = error_msg
                consequence = consequence_names[0]
                if consequence in whole_transcript_consequences:
                    item[csq_five_prime] = "upstream"
                    item[csq_three_prime] = "downstream"
                elif consequence in downstream_consequences: 
                    item[csq_five_prime] = "downstream"
                    item[csq_three_prime] = "downstream"
                elif consequence in upstream_consequences:
                    item[csq_five_prime] = "upstream"
                    item[csq_three_prime] = "upstream"
                else:
                    item[csq_five_prime] = item[csq_three_prime] = error_msg
            elif exons or introns:
                exons = exons.split("/")
                introns = introns.split("/")
                if introns and not exons:
                    item[csq_five_prime] = item[csq_three_prime] = "intronic"
                elif exons and not introns:
                    exons_affected = exons[0].split("-")
                    exons_total = exons[1]
                    if len(exons_affected) == 1:  # Shouldn't be > 1 exon with no intron
                        if "5_prime_UTR_variant" in consequence_names:
                            item[csq_five_prime] = "5' UTR or upstream"
                            item[csq_three_prime] = "exonic"
                        elif "3_prime_UTR_variant" in consequence_names:
                            item[csq_five_prime] = "exonic"
                            item[csq_three_prime] = "3' UTR or upstream"
                        else:
                            item[csq_five_prime] = item[csq_three_prime] = "exonic"
                    else:
                        item[csq_five_prime] = item[csq_three_prime] = error_msg
                else:
                    exons_affected = exons[0].split("-")
                    exons_total = exons[1]
                    introns_affected = introns[0].split("-")
                    introns_total = introns[1]
                    if exons_total in exons_affected:
                        if "3_prime_UTR_variant" in consequence_names:
                            item[csq_three_prime] = "3' UTR or downstream"
                        else:
                            item[csq_three_prime] = "exonic"
                    elif introns_total in introns_affected:
                        item[csq_three_prime] = "intronic"
                    elif introns_affected[-1] == exons_affected[-1]:
                        item[csq_three_prime] = "intronic"
                    elif exons_affected[-1] > introns_affected[-1]:
                        item[csq_three_prime] = "exonic"
                    else:
                        item[csq_three_prime] = error_msg
                    if "5_prime_UTR_variant" in consequence_names:
                        item[csq_five_prime] = "5' UTR or upstream"
                    elif introns_affected[0] == exons_affected[0]:
                        item[csq_five_prime] = "exonic"
                    elif introns_affected[0] < exons_affected[0]:
                        item[csq_five_prime] = "intronic"
                    else:
                        item[csq_five_prime] = error_msg
            else:
                item[csq_five_prime] = item[csq_three_prime] = error_msg
        return transcript


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

    POSSIBLE_GENOTYPE_LABEL_FIELDS = [
        "proband_genotype_label",
        "mother_genotype_label",
        "father_genotype_label",
        "sister_genotype_label",
        "sister_II_genotype_label",
        "sister_III_genotype_label",
        "sister_IV_genotype_label",
        "brother_genotype_label",
        "brother_II_genotype_label",
        "brother_III_genotype_label",
        "brother_IV_genotype_label"
        "co_parent_genotype_label",
        "daughter_genotype_label",
        "daughter_II_genotype_label",
        "son_genotype_label",
        "son_II_genotype_label",
    ]

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
    def display_title(self, request, CALL_INFO, structural_variant):
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

    @calculated_property(schema={
        "title": "Inheritance Modes",
        "description": "Inheritance Modes (only including those relevant to a proband-only analysis)",
        "type": "array",
        "items": {
            "type": "string"
        }
    })
    def proband_only_inheritance_modes(
            self, request, structural_variant, inheritance_modes=[]
    ):
        proband_modes = []
        structural_variant = get_item_or_none(
            request, structural_variant, "StructuralVariant", frame="raw"
        )
        if structural_variant["CHROM"] in ["X", "Y"]:
            proband_modes.append(f"{structural_variant['CHROM']}-linked")
        if proband_modes:
            return proband_modes
        return None

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
    def associated_genotype_labels(
            self, structural_variant, CALL_INFO, samplegeno=None, genotype_labels=None
    ):
        """
        Builds the above sub-embedded object so we can search on the
        genotype labels.
        """
        possible_keys_set = set(StructuralVariantSample.POSSIBLE_GENOTYPE_LABEL_FIELDS)

        def infer_key_from_role(role):
            return role.replace(' ', '_').replace('-', '_') + '_genotype_label'

        # structural variant starts with sv-type_chr* where * is the chrom 
        def extract_chrom_from_variant(v):
            chrom_string = v.split("_")[1]
            return chrom_string[3]

        # drop if there are no genotype labels or no samplegeno field or this is a
        # mitochondrial variant
        if (
            not genotype_labels or not samplegeno
            or extract_chrom_from_variant(structural_variant) == 'M'
        ):
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
