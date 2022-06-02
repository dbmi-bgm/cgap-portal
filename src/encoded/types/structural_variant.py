import io

import negspy.coordinates as nc
from pyramid.view import view_config
from snovault import calculated_property, collection, load_schema

from ..ingestion.common import CGAP_CORE_PROJECT
from ..inheritance_mode import InheritanceMode
from ..util import resolve_file_path, convert_integer_to_comma_string
from .base import Item, get_item_or_none
from .variant import (
    ANNOTATION_ID,
    SHARED_VARIANT_EMBEDS,
    SHARED_VARIANT_SAMPLE_EMBEDS,
    extend_embedded_list,
    load_extended_descriptions_in_schemas,
    process_items_process
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


def build_comma_formatted_position(chromosome, start, end):
    """Create more readable position display with comma-formatted
    numbers.

    :param chromosome: Chromosome of SV.
    :type chromosome: str
    :param start: Start position of SV.
    :type start: int
    :param end: End position of SV.
    :type end: int
    :returns: Comma-formatted position or None.
    :rtype: str or None
    """
    result = None
    start = convert_integer_to_comma_string(start)
    end = convert_integer_to_comma_string(end)
    if chromosome and start is not None and end is not None:
        result = "chr%s:%s-%s" % (chromosome, start, end)
    return result


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
        start = convert_integer_to_comma_string(START)
        end = convert_integer_to_comma_string(END)
        return build_structural_variant_display_title(SV_TYPE, CHROM, start, end)

    @calculated_property(
        schema={
            "title": "Start Absolute Position",
            "description": "Start absolute position in genome coordinates",
            "type": "integer",
        }
    )
    def START_ABS(self, CHROM, START):
        chrom_info = nc.get_chrominfo("hg38")
        return nc.chr_pos_to_genome_pos("chr" + CHROM, START, chrom_info)

    @calculated_property(
        schema={
            "title": "End Absolute Position",
            "description": "End absolute position in genome coordinates",
            "type": "integer",
        }
    )
    def END_ABS(self, CHROM, END):
        chrom_info = nc.get_chrominfo("hg38")
        return nc.chr_pos_to_genome_pos("chr" + CHROM, END, chrom_info)

    @calculated_property(
        schema={
            "title": "Size",
            "description": "The size of this structural variant",
            "type": "number",
        }
    )
    def size(self, START, END):
        return END - START + 1

    @calculated_property(
        schema={
            "title": "Size Display",
            "description": "The abbreviated size of this structural variant",
            "type": "string",
        }
    )
    def size_display(self, START, END):
        """
        Create user-friendly display of size.

        Finds appropriate units "bucket" according to number of digits
        in the size, then rounds to 1 decimal place within the "bucket".

        :param START: int start location of SV
        :param END: int end location of SV
        :return: str size plus unit
        """
        result = None
        size = END - START + 1
        unit_max_exponents = [3, 6, 9, 12]  # Gb should be max given chromosome sizes
        display_units = ["bp", "Kb", "Mb", "Gb"]
        for exponent, unit in zip(unit_max_exponents, display_units):
            if size < 10 ** exponent:
                display_number = round(size * 10 ** (-exponent + 3), 1)
                result = str(display_number) + " " + unit
                break
        return result

    @calculated_property(
        schema={
            "title": "Cytoband(s)",
            "description": "The cytoband(s) of this structural variant",
            "type": "string",
        }
    )
    def cytoband_display(self, CHROM, cytoband_start=None, cytoband_end=None):
        """
        Create cytoband to display in portal.

        Requires cytobands at both start and end locations, and result
        is either single cytoband if both identical or dash-separated
        cytobands if different.

        :param CHROM: str chromosome
        :param cytoband_start: str cytoband at SV START
        :param cytoband_end: str cytoband at SV END
        :returns: str cytoband to display
        """
        result = None
        if cytoband_start and cytoband_end:
            if cytoband_start == cytoband_end:
                result = CHROM + cytoband_start
            else:
                result = CHROM + cytoband_start + "-" + CHROM + cytoband_end
        return result

    @calculated_property(
        schema={
            "title": "Gene Summary",
            "description": "An overview of genes overlapping this structural variant",
            "type": "object",
            "properties": {
                "contained": {
                    "title": "Genes Contained in SV",
                    "type": "string",
                    "description": (
                        "The number of genes entirely within the structural variant out"
                        " of all genes affected"
                    ),
                },
                "at_breakpoint": {
                    "title": "Genes Crossing an SV Breakpoint",
                    "type": "string",
                    "description": (
                        "The number of genes overlapping the ends of the structural"
                        " variant out of all genes affected"
                    ),
                },
                "omim_genes": {
                    "title": "Genes with OMIM IDs",
                    "type": "string",
                    "description": (
                        "The number of genes affected by the structural variant that"
                        " exist in the OMIM database out of all genes affected"
                    ),
                },
            },
        }
    )
    def gene_summary(self, request, START, END, transcript=None):
        """
        Calculate summary characteristics of genes overlapped by the
        structural variant.

        NOTE: Genes included here are only those that have some
        overlap with the given SV; genes entirely up-/downstream of the
        SV are not contributing towards any counts (including the
        total).

        :param request: cls pyramid request
        :param START: int SV hg38 start position
        :param END: int SV hg38 end position
        :param transcript: list of VEP annotations
        :returns: dict of summary characteristics
        """
        result = {}
        genes = []
        gene_count = 0
        contained_count = 0
        breakpoint_count = 0
        omim_count = 0
        if transcript:
            for item in transcript:
                gene = item.get("csq_gene")
                if gene and gene not in genes:
                    genes.append(gene)
        for gene in genes:
            gene = get_item_or_none(request, gene, "Gene", frame="raw")
            gene_start = gene.get("spos")
            gene_end = gene.get("epos")
            gene_omim_id = gene.get("omim_id")
            if gene_start and gene_end:  # True for all genes as of 09-14-2021 drr
                if int(gene_start) >= START and int(gene_end) <= END:
                    gene_count += 1
                    contained_count += 1
                    if gene_omim_id:
                        omim_count += 1
                elif int(gene_start) <= END and int(gene_end) >= START:
                    gene_count += 1
                    breakpoint_count += 1
                    if gene_omim_id:
                        omim_count += 1
        result["contained"] = str(contained_count) + "/" + str(gene_count)
        result["at_breakpoint"] = str(breakpoint_count) + "/" + str(gene_count)
        result["omim_genes"] = str(omim_count) + "/" + str(gene_count)
        return result

    @calculated_property(
        schema={
            "title": "Position Display",
            "description": "The comma formatted position of this structural variant",
            "type": "string",
        }
    )
    def position_display(self, CHROM, START, END):
        """Create formatted position to display in portal."""
        return build_comma_formatted_position(CHROM, START, END)

    @calculated_property(
        schema={
            "title": "Formatted Position (hg19)",
            "description": "The formatted hg19 position of this structural variant",
            "type": "string",
        }
    )
    def hg19_position_display(self, hg19_chr=None, hg19_start=None, hg19_end=None):
        """Create formatted hg19 position to display in portal."""
        return build_comma_formatted_position(hg19_chr, hg19_start, hg19_end)


@collection(
    name="structural-variant-samples",
    properties={
        "title": "Structural variants (sample)",
        "description": "List of all structural variants with sample specific information",
    },
    unique_key="structural_variant_sample:annotation_id",
)
class StructuralVariantSample(Item):
    """
    Class for structural variant samples.
    Should we have this inherit from VariantSample perhaps? Or maybe make a common base class?
    """

    item_type = "structural_variant_sample"
    schema = load_extended_descriptions_in_schemas(
        load_schema("encoded:schemas/structural_variant_sample.json")
    )
    rev = {
        "variant_sample_list": (
            "VariantSampleList",
            "structural_variant_samples.variant_sample_item",
        )
    }
    embedded_list = build_structural_variant_sample_embedded_list()
    FACET_ORDER_OVERRIDE = {
        "inheritance_modes": {
            InheritanceMode.INHMODE_LABEL_SV_DE_NOVO: 1,  # Possibly de novo
            InheritanceMode.INHMODE_LABEL_RECESSIVE: 2,  # Recessive
            InheritanceMode.INHMODE_LABEL_LOH: 3,  # Loss of Heterozygosity
            InheritanceMode.INHMODE_DOMINANT_MOTHER: 4,  # Dominant (Maternal)
            InheritanceMode.INHMODE_DOMINANT_FATHER: 5,  # Dominant (Paternal)
            InheritanceMode.INHMODE_LABEL_X_LINKED_RECESSIVE: 6,  # X-linked recessive
            InheritanceMode.INHMODE_LABEL_X_LINKED_DOMINANT_MOTHER: 7,  # X-linked dominant (Maternal)
            InheritanceMode.INHMODE_LABEL_X_LINKED_DOMINANT_FATHER: 8,  # X-linked dominant (Paternal)
            InheritanceMode.INHMODE_LABEL_Y_LINKED: 9,  # Y-linked dominant
            InheritanceMode.INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT: 10,  # Low relevance, homozygous in a parent
            InheritanceMode.INHMODE_LABEL_NONE_HEMIZYGOUS_PARENT: 11,  # Low relevance, hemizygous in a parent
            InheritanceMode.INHMODE_LABEL_NONE_BOTH_PARENTS: 12,  # Low relevance, present in both parent(s)
            InheritanceMode.INHMODE_LABEL_NONE_DOT: 13,  # Low relevance, missing call(s) in family
            InheritanceMode.INHMODE_LABEL_NONE_SEX_INCONSISTENT: 14,  # Low relevance, mismatching chrXY genotype(s)
            InheritanceMode.INHMODE_LABEL_NONE_OTHER: 15,  # Low relevance, other
            '_default': 1000  # arbitrary large number
        },
    }
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
        "brother_IV_genotype_label",
        "co_parent_genotype_label",
        "daughter_genotype_label",
        "daughter_II_genotype_label",
        "son_genotype_label",
        "son_II_genotype_label",
    ]

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """
        Sets the annotation_id field on this structural variant sample
        prior to passing on.
        """
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
        """Build display title.

        This title is displayed in new tabs/windows.
        """
        result = CALL_INFO
        structural_variant = get_item_or_none(
            request, structural_variant, "StructuralVariant", frame="raw"
        )
        if structural_variant:
            structural_variant_display_title = build_structural_variant_display_title(
                structural_variant["SV_TYPE"],
                structural_variant["CHROM"],
                structural_variant["START"],
                structural_variant["END"],
            )
            result = structural_variant_display_title + " (" + CALL_INFO + ")"
        return result

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
            "title": "Associated Gene Lists",
            "description": "Gene lists associated with project or case of variant sample",
            "type": "array",
            "items": {
                "title": "Gene list title",
                "type": "string",
                "description": "Gene list title",
            },
        }
    )
    def associated_genelists(self, request, project, structural_variant, CALL_INFO):
        """
        Identifies gene lists associated with the project or project and
        CALL_INFO of the structural variant sample, if the gene list has
        associated BAM sample IDs.

        NOTE: Gene lists retrieved with @@raw view to prevent costly
        @@object view of large gene lists.
        """
        gene_atids = []
        genelist_atids = []
        genelist_info = {}
        associated_genelists = []
        core_project = CGAP_CORE_PROJECT + "/"
        potential_projects = [core_project, project]
        variant_props = get_item_or_none(request, structural_variant)
        transcripts = variant_props.get("transcript", [])
        for transcript in transcripts:
            gene_atid = transcript.get("csq_gene")
            if gene_atid not in gene_atids:
                gene_atids.append(gene_atid)
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
                "project": project_atid,
                "bam_sample_ids": bam_sample_ids,
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

    @calculated_property(
        schema={
            "title": "Inheritance Modes",
            "description": "Inheritance Modes (only including those relevant to a proband-only analysis)",
            "type": "array",
            "items": {"type": "string"},
        }
    )
    def proband_only_inheritance_modes(
        self, request, structural_variant, inheritance_modes=[]
    ):
        """
        Inheritance modes for proband-only cases.

        NOTE: Limited only to sex-chromosome-linked inheritance modes
        at the moment. If compound hets aren't going to be included for
        SVs, can consider discarding this property.
        """
        proband_modes = []
        structural_variant = get_item_or_none(
            request, structural_variant, "StructuralVariant", frame="raw"
        )
        if structural_variant["CHROM"] in ["X", "Y"]:
            proband_modes.append(f"{structural_variant['CHROM']}-linked")
        if proband_modes:
            return proband_modes
        return None

    @calculated_property(
        schema={
            "title": "Associated Genotype Labels",
            "description": "Named Genotype Label fields that can be searched on",
            "type": "object",
            "additional_properties": True,
            "properties": {
                "proband_genotype_label": {
                    "title": "Proband Genotype",
                    "type": "string",
                },
                "mother_genotype_label": {"title": "Mother Genotype", "type": "string"},
                "father_genotype_label": {"title": "Father Genotype", "type": "string"},
                "sister_genotype_label": {"title": "Sister Genotype", "type": "string"},
                "sister_II_genotype_label": {
                    "title": "Sister II Genotype",
                    "type": "string",
                },
                "sister_III_genotype_label": {
                    "title": "Sister III Genotype",
                    "type": "string",
                },
                "sister_IV_genotype_label": {
                    "title": "Sister IV Genotype",
                    "type": "string",
                },
                "brother_genotype_label": {
                    "title": "Brother Genotype",
                    "type": "string",
                },
                "brother_II_genotype_label": {
                    "title": "Brother II Genotype",
                    "type": "string",
                },
                "brother_III_genotype_label": {
                    "title": "Brother III Genotype",
                    "type": "string",
                },
                "brother_IV_genotype_label": {
                    "title": "Brother IV Genotype",
                    "type": "string",
                },
                "co_parent_genotype_label": {
                    "title": "Co-Parent Genotype",
                    "type": "string",
                },
                "daughter_genotype_label": {
                    "title": "Daughter Genotype",
                    "type": "string",
                },
                "daughter_II_genotype_label": {
                    "title": "Daughter II Genotype",
                    "type": "string",
                },
                "son_genotype_label": {"title": "Son Genotype", "type": "string"},
                "son_II_genotype_label": {"title": "Son II Genotype", "type": "string"},
            },
        }
    )
    def associated_genotype_labels(
        self, structural_variant, CALL_INFO, samplegeno=None, genotype_labels=None
    ):
        """
        Builds the above sub-embedded object so we can search on the
        genotype labels.
        """
        possible_keys_set = set(StructuralVariantSample.POSSIBLE_GENOTYPE_LABEL_FIELDS)

        def infer_key_from_role(role):
            return role.replace(" ", "_").replace("-", "_") + "_genotype_label"

        # structural variant starts with sv-type_chr* where * is the chrom
        def extract_chrom_from_variant(v):
            chrom_string = v.split("_")[1]
            return chrom_string[3]

        # drop if there are no genotype labels or no samplegeno field or this is a
        # mitochondrial variant
        if (
            not genotype_labels
            or not samplegeno
            or extract_chrom_from_variant(structural_variant) == "M"
        ):
            return None

        new_labels = {}
        for entry in genotype_labels:
            role = entry.get("role", "")
            label = entry.get("labels", [])
            role_key = infer_key_from_role(role)
            if role_key not in possible_keys_set:
                continue
            elif len(label) == 1:
                new_labels[role_key] = label[0]
            else:
                new_labels[role_key] = " ".join(label)  # just in case

        return new_labels


@view_config(
    name='process-items',
    context=StructuralVariantSample,
    request_method='PATCH',
    permission='edit'
)
def process_items(context, request):
    """This endpoint is used to process notes attached to this (in-context) StructuralVariantSample."""
    return process_items_process(context, request)
