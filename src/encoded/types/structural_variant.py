import negspy.coordinates as nc

from .util import resolve_file_path
from .variant import (
    extend_embedded_list, build_variant_sample_annotation_id, ANNOTATION_ID
)

def build_structural_variant_embedded_list():
    """ Determines the embedded_list based on the information
        present in schemas/structural_variant_embeds.json

        :returns: list of structural variant embeds
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
    with io.open(resolve_file_path('schemas/structural_variant_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'structural_variant')
    return embedded_list + Item.embedded_list

def build_structural_variant_sample_embedded_list():
    """ Determines the embedded list for structural variants within
        structural_variant_sample ie: structural_variant.* is not
        sufficient for things embedded into structural variant
        that we'd like to search on in the structural_variant_sample
        context. Works very similary to the above function

        :returns: list of embeds from 'structural_variant' linkTo
    """
    embedded_list = [
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
    with io.open(resolve_file_path('schemas/structural_variant_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'structural_variant', prefix='structural_variant.')
    with io.open(resolve_file_path('schemas/structural_variant_sample_embeds.json'), 'r') as fd:
        extend_embedded_list(embedded_list, fd, 'structural_variant_sample')
    return ['structural_variant.*'] + embedded_list + Item.embedded_list

def build_structural_variant_display_title(sv_type, chrom, start, end):
    """Builds the structural variant display title according to the type of SV."""
    if sv_type in ["DUP", "DEL"]:
        display_title = '%s_chr%s:%s-%s' % (sv_type, chrom, start, end)
    else:
        raise RuntimeError("Received an unexpected SV type")
    return display_title



@collection(
    name='structural-variants',
    properties={
        'title': 'Structural variants',
        'description': 'List of all structural variants'
    },
    unique_key='structural_variant:annotation_id')
class StructuralVariant(Item):
    """ Structural variant class """

    item_type = 'structural_variant'
    name_key = 'annotation_id'
    schema = load_schema('encoded:schemas/structural_variant.json')
    embedded_list = build_structural_variant_embedded_list()

    @classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """ Sets the annotation_id field on this variant prior to passing on. """
        if properties['SV_TYPE'] not in ["DUP", "DEL"]:
            raise RuntimeError("Received an unexpected SV type")
        properties[ANNOTATION_ID] = build_structural_variant_display_title(
            properties['SV_TYPE'],
            properties['CHROM'],
            properties['START'],
            properties['END'],
        )
        return super().create(registry, uuid, properties, sheets)

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, SV_TYPE, CHROM, START, END):
        return build_structural_variant_display_title(SV_TYPE, CHROM, START, END)

    @calculated_property(schema={
        "title": "Start position (genome coordinates)",
        "description": "Start absolute position in genome coordinates",
        "type": "integer"
    })
    def START_ABS(self, CHROM, START):
        chrom_info = nc.get_chrominfo('hg38')
        return nc.chr_pos_to_genome_pos('chr'+CHROM, START, chrom_info)

    @calculated_property(schema={
        "title": "End position (genome coordinates)",
        "description": "End absolute position in genome coordinates",
        "type": "integer"
    })
    def START_ABS(self, CHROM, END):
        chrom_info = nc.get_chrominfo('hg38')
        return nc.chr_pos_to_genome_pos('chr'+CHROM, END, chrom_info)



@collection(
    name='structural-variant-samples',
    properties={
        'title': 'Structural variants (sample)',
        'description': 'List of all structural variants with sample specific information',
    },
    unique_key='structural_variant_sample:annotation_id')
class StructuralVariantSample(Item):
    """Class for structural variant samples."""

    item_type = 'structural_variant_sample'
    schema = load_extended_descriptions_in_schemas(
        load_schema('encoded:schemas/structural_variant_sample.json')
    )
    rev = {'variant_sample_list': ('VariantSampleList', 'structural_variant_samples')}
    embedded_list = build_structural_variant_sample_embedded_list()

	@classmethod
    def create(cls, registry, uuid, properties, sheets=None):
        """ Sets the annotation_id field on this structural_variant_sample
            prior to passing on. """
        properties[ANNOTATION_ID] = '%s:%s:%s' % (
            properties['CALL_INFO'],
            properties['structural_variant'],
            properties['file']
        )
        return super().create(registry, uuid, properties, sheets)

    @calculated_property(schema={
        "title": "Display Title",
        "description": "A calculated title for every object in 4DN",
        "type": "string"
    })
    def display_title(self, request, CALL_INFO, structural_variant=None):
        structural_variant = get_item_or_none(
            request, structural_variant, 'StructuralVariant', frame='raw'
        )
        structural_variant_display_title = build_structural_variant_display_title(
            structural_variant['SV_TYPE'],
            structural_variant['CHROM'],
            structural_variant['START'],
            structural_variant['END']
        )
        if structural_variant:
            return CALL_INFO + ':' + structural_variant_display_title
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
        "title": "BAM Snapshot",
        "description": "Link to Genome Snapshot Image",
        "type": "string"
    })
    def bam_snapshot(self, request, file, structural_variant):
        structural_variant_props = get_item_or_none(
            request, structural_variant, 'StructuralVariant', frame='raw'
        )
        if structural_variant_props is None:
            raise RuntimeError('Got none for something that definitely exists')
        file_path = '%s/bamsnap/chr%s_%s.png' % (  # file = accession of associated VCF file
            file, structural_variant_props['CHROM'], structural_variant_props['START']
        )
        return file_path

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
    def associated_genelists(self, request, project, structural_variant, CALL_INFO):
        """
        Identifies gene lists associated with the project or project and CALL_INFO
        of the structural variant sample, if the gene list has associated BAM sample
		IDs.

        NOTE: Gene lists retrieved with @@raw view to prevent costly @@object
        view of large gene lists.
        """
        gene_atids = []
        genelist_atids = []
        genelist_info = {}
        associated_genelists = []
        core_project = CGAP_CORE_PROJECT + "/"
        potential_projects = [core_project, project]
        structural_variant_props = get_item_or_none(request, structural_variant)
        genes = structural_variant_props.get("genes", [])
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
