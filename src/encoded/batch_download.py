import csv
import io
import json
import os
import structlog
from math import inf
from urllib.parse import parse_qs, urlparse
from collections import OrderedDict
from itertools import chain
from pyramid.compat import bytes_
from pyramid.httpexceptions import (
    HTTPBadRequest,
    HTTPMovedPermanently,
    HTTPServerError,
    HTTPTemporaryRedirect
)
from base64 import b64decode
from pyramid.view import view_config
from pyramid.request import Request
from pyramid.response import Response
from pyramid.traversal import find_resource
from pyramid.settings import asbool
from snovault import TYPES, calculated_property, collection, load_schema
from snovault.util import simple_path_ids, debug_log
from snovault.calculated import calculate_properties
from snovault.embed import make_subrequest

from encoded.types.base import Item, get_item_or_none
from .custom_embed import CustomEmbed

# from .search import (
#     iter_search_results,
#     build_table_columns,
#     get_iterable_search_results,
#     make_search_subreq
# )





log = structlog.getLogger(__name__)

def includeme(config):
    config.add_route('variant_sample_list_spreadsheet', '/variant-sample-list-spreadsheet/')
    config.scan(__name__)


############################################################
### Spreadsheet Generation for Variant Sample Item Lists ###
############################################################

def get_population_suffix_title_tuples():
    return [
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

    def get_canonical_transcript(variant_sample):
        variant = variant_sample.get("variant", {})
        for transcript in variant.get("transcript", []):
            if transcript.get("csq_canonical", False) == True:
                return transcript
        return None

    def get_most_severe_transcript(variant_sample):
        variant = variant_sample.get("variant", {})
        for transcript in variant.get("transcript", []):
            if transcript.get("csq_most_severe", False) == True:
                return transcript
        return None

    def get_most_severe_consequence(variant_sample_transcript):
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
        most_severe_consequence = get_most_severe_consequence(canonical_transcript)
        if not most_severe_consequence:
            return None
        return most_severe_consequence["display_title"]

    def most_severe_transcript_consequence_display_title(variant_sample):
        most_severe_transcript = get_most_severe_transcript(variant_sample)
        if not most_severe_transcript:
            return None
        most_severe_consequence = get_most_severe_consequence(most_severe_transcript)
        if not most_severe_consequence:
            return None
        return most_severe_consequence["display_title"]

    def gnomadv3_popmax_population(variant_sample):
        variant = variant_sample.get("variant", {})
        csq_gnomadg_af_popmax = variant.get("csq_gnomadg_af_popmax")
        if not csq_gnomadg_af_popmax: # Return None for 0, also.
            return None
        for pop_suffix, pop_name in get_population_suffix_title_tuples():
            pop_val = variant.get("csq_gnomadg_af-" + pop_suffix)
            if pop_val is not None and pop_val == csq_gnomadg_af_popmax:
                return pop_name
        return None

    def gnomadv2_popmax_population(variant_sample):
        variant = variant_sample.get("variant", {})
        csq_gnomade2_af_popmax = variant.get("csq_gnomade2_af_popmax")
        if not csq_gnomade2_af_popmax: # Return None for 0, also.
            return None
        for pop_suffix, pop_name in get_population_suffix_title_tuples():
            pop_val = variant.get("csq_gnomade2_af-" + pop_suffix)
            if pop_val is not None and pop_val == csq_gnomade2_af_popmax:
                return pop_name
        return None

    def url_to_variantsample(variant_sample):
        at_id = variant_sample["@id"]
        if request:
            # Prepend request hostname, scheme, etc.
            return request.resource_url(request.root) + variant_sample["@id"][1:]
        return at_id


    return [
    ##  Column Title                             |  CGAP Field (if not custom function)                          |  Description
    ##  ---------------------------------------  |  -----------------------------------------------------------  |  --------------------------------------------------------------------------
        ("URL",                                     url_to_variantsample,                                           "URL to Sample Variant on this row"),
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
        # TODO: For next 6, grab only from note from same project as user? From newest for which have view permission?
        ("ACMG classification (prev)",              "variant.interpretations.classification",                       "ACMG classification for variant in previous cases"), # First interpretation only
        ("ACMG rules (prev)",                       "variant.interpretations.acmg",                                 "ACMG rules invoked for variant in previous cases"), # First interpretation only
        ("Clinical interpretation (prev)",          "variant.interpretations.note_text",                            "Clinical interpretation notes written for previous cases"), # First interpretation only
        ("Gene candidacy (prev)",                   "variant.discovery_interpretations.gene_candidacy",             "Gene candidacy level selected for previous cases"), # First discovery_interpretations only
        ("Variant candidacy (prev)",                "variant.discovery_interpretations.variant_candidacy",          "Variant candidacy level selected for previous cases"), # First discovery_interpretations only
        ("Discovery notes (prev)",                  "variant.discovery_interpretations.note_text",                  "Gene/variant discovery notes written for previous cases"), # First discovery_interpretations only
        ("Variant notes (prev)",                    "variant.variant_notes.note_text",                              "Additional notes on variant written for previous cases"), # First variant_notes only
        ("Gene notes (prev)",                       "variant.genes.genes_most_severe_gene.gene_notes.note_text",    "Additional notes on gene written for previous cases"),
    ]


def get_values_for_field(item, field, remove_duplicates=True):
    """Copied over from 4DN / batch_download / metadata.tsv endpoint code"""
    c_value = []

    if remove_duplicates:
        for value in simple_path_ids(item, field):
            str_value = str(value)
            if str_value not in c_value:
                c_value.append(str_value)
    else:
        for value in simple_path_ids(item, field):
            c_value.append(str(value))

    return ", ".join(c_value)


def convert_variant_sample_item_to_sheet_dict(variant_sample_item, spreadsheet_mappings):
    '''
    We assume we have @@embedded representation of VariantSample here.
    May need to request more fields.
    '''

    if not "@id" in variant_sample_item:
        return None

    vs_sheet_dict = {} # OrderedDict() # Keyed by column title. Maybe OrderedDict not necessary now..

    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        if cgap_field_or_func is None: # Skip
            continue

        is_field_str = isinstance(cgap_field_or_func, str)

        if not is_field_str: # Assume render or custom-logic function
            vs_sheet_dict[column_title] = cgap_field_or_func(variant_sample_item)
        else:
            vs_sheet_dict[column_title] = get_values_for_field(variant_sample_item, cgap_field_or_func)

    return vs_sheet_dict




class Echo(object):
    def write(self, line):
        return line.encode("utf-8")



def stream_tsv_output(dictionaries_iterable, spreadsheet_mappings, file_format = "tsv"):
    '''
    Generator which converts iterable of column:value dictionaries into a TSV stream.
    :param dictionaries_iterable: Iterable of dictionaries, each containing TSV_MAPPING keys and values from a file in ExperimentSet.
    '''
    writer = csv.writer(Echo(), delimiter= "\t" if file_format == "tsv" else ",")

    # Initial 2 lines: Intro, Headers
    # writer.writerow([
    #     '###', 'N.B.: File summary located at bottom of TSV file.', '', '', '', '',
    #     'Suggested command to download: ', '', '', 'cut -f 1 ./{} | tail -n +3 | grep -v ^# | xargs -n 1 curl -O -L --user <access_key_id>:<access_key_secret>'.format(filename_to_suggest)
    # ])
    # yield line.read().encode('utf-8')

    # Headers (column title)
    title_headers = []
    description_headers = []
    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        title_headers.append(column_title)
        description_headers.append(description)
    title_headers[0] = "## " + title_headers[0] # Add comment hash in case people using this spreadsheet file programmatically.
    description_headers[0] = "## " + description_headers[0] # Add comment hash in case people using this spreadsheet file programmatically.

    yield writer.writerow(title_headers)
    yield writer.writerow(description_headers)

    del title_headers
    del description_headers

    for vs_dict in dictionaries_iterable:
        if vs_dict is None: # No view permissions (?)
            row = [ "" for sm in spreadsheet_mappings ]
            row[0] = "# Not Available"
            yield writer.writerow(row)
        else:
            print("Printing", vs_dict)
            yield writer.writerow([ vs_dict.get(sm[0]) or "" for sm in spreadsheet_mappings ])


    # for summary_line in generate_summary_lines():
    #     writer.writerow(summary_line)
    #     yield line.read().encode('utf-8')


def build_xslx_spreadsheet(dictionaries_iterable, spreadsheet_mappings):
    '''TODO'''
    from tempfile import NamedTemporaryFile
    from openpyxl import Workbook
    wb = Workbook()

    with NamedTemporaryFile() as tmp:
        wb.save(tmp.name)
        tmp.seek(0)
        stream = tmp.read()



############################
## Spreadsheet Generation Code Specific to VariantSampleList Items 
############################



@view_config(route_name='variant_sample_list_spreadsheet', request_method=['GET', 'POST'])
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

    request_body = {}
    try:
        request_body = request.POST
    except:
        try:
            request_body = request.json
        except:
            pass


    file_format = request_body.get("file_format", request.GET.get("file_format", "tsv")).lower()
    if file_format not in { "tsv", "csv" }: # TODO: Add support for xslx.
        raise HTTPBadRequest("Expected a valid `file_format` such as TSV or CSV.")
    suggested_filename = request_body.get("suggested_filename", request.GET.get("suggested_filename", None))
    if not suggested_filename:
        suggested_filename = "case-interpretation." + file_format # TODO: Datetime

    

    requested_variant_sample_uuids = request_body.get("variant_sample_uuids", None)

    if requested_variant_sample_uuids is None:
        # Check for VariantSampleList Item and get from there.
        variant_sample_list_id_requested = request_body.get("variant_sample_list_id", request.GET.get("variant_sample_list_id", None))
        if variant_sample_list_id_requested is None:
            raise HTTPBadRequest("Expected a valid `variant_sample_list_id` or `variant_sample_item_uuids`")
        subreq = make_subrequest(request, variant_sample_list_id_requested + "?frame=object&datastore=database", None, inherit_user=True)
        subreq.__parent__ = None

        loaded_vsl = request.invoke_subrequest(subreq).json
        print('\n\n', loaded_vsl)
        variant_sample_objects = loaded_vsl.get("variant_samples", [])
        requested_variant_sample_uuids = [ vso["variant_sample_item"] for vso in variant_sample_objects ]


    spreadsheet_mappings = get_spreadsheet_mappings(request)
    fields_to_embed = [
        # Most of these are needed for columns with render/transform/custom-logic functions in place of (string) CGAP field.
        # Keep up-to-date with any custom logic.
        "@id",
        "@type",
        "variant.transcript.csq_canonical",
        "variant.transcript.csq_most_severe",
        "variant.transcript.csq_feature",
        "variant.transcript.csq_consequence.impact",
        "variant.transcript.csq_consequence.var_conseq_name",
        "variant.transcript.csq_consequence.display_title",
        "variant.transcript.csq_exon",
        "variant.transcript.csq_intron"
    ]
    for pop_suffix, pop_name in get_population_suffix_title_tuples():
        fields_to_embed.append("variant.csq_gnomadg_af-" + pop_suffix)
        fields_to_embed.append("variant.csq_gnomade2_af-" + pop_suffix)
    for column_title, cgap_field_or_func, description in spreadsheet_mappings:
        if isinstance(cgap_field_or_func, str):
            # We don't expect any duplicate fields (else would've used a set in place of list) ... pls avoid duplicates in spreadsheet_mappings.
            fields_to_embed.append(cgap_field_or_func)

    def load_variant_sample(vs_id):
        '''
        We want to grab datastore=database version of Items here since is likely that user has _just_ finished making
        an edit when they decide to export the spreadsheet from the InterpretationTab UI.
        '''
        print("Loading...", vs_id)
        vs_embedding_instance = CustomEmbed(request, vs_id, embed_props={ "requested_fields": fields_to_embed })
        return vs_embedding_instance.result


    return Response(
        content_type='text/' + file_format,
        app_iter = stream_tsv_output(
            map(
                lambda x: convert_variant_sample_item_to_sheet_dict(x, spreadsheet_mappings),
                map(
                    load_variant_sample,
                    requested_variant_sample_uuids
                )
            ),
            spreadsheet_mappings,
            file_format
        ),
        content_encoding='utf-8',
        content_disposition='attachment;filename="%s"' % suggested_filename
    )

