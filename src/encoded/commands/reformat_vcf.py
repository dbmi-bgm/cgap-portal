#!/usr/bin/env python3

################################################
#
#   Reformat VCF and add custom tags and fields
#       in VCF file for portal ingestion
#
#   Michele Berselli
#   berselli.michele@gmail.com
#
################################################

################################################
#
#   Libraries
#       requires granite library
#
################################################
import io
import argparse
from granite.lib import vcf_parser
# shared_functions as *
from granite.lib.shared_functions import *
# shared_vars
from granite.lib.shared_vars import DStags


################################################
#
#   Functions
#
################################################


def get_maxds(vnt_obj, SpAItag_list, SpAI_idx_list):
    ''' TODO add docstring. '''
    # if SpliceAI is within VEP
    # fetching only the first transcript
    # expected the same scores for all transcripts
    SpAI_vals = []
    for i, SpAItag in enumerate(SpAItag_list):
        SpAI_val = get_tag_idx(vnt_obj, SpAItag, SpAI_idx_list[i])
        # if SpliceAI is with VEP and is at the end of Format
        # need to remove , that separate next transcript
        try:
            SpAI_vals.append(float(SpAI_val.split(',')[0]))
        except Exception:
            return None
    if SpAI_vals:
        return max(SpAI_vals)
    return None


def get_worst_trscrpt(VEP_val, VEP_order, CNONICL_idx, CONSEQUENCE_idx, sep='&'):
    ''' TODO add docstring. '''
    # Check transcripts
    worst_trscrpt_tup = []
    trscrpt_list = VEP_val.split(',')
    # Assign worst impact to transcripts
    for trscrpt in trscrpt_list:
        trscrpt_cnsqce = trscrpt.split('|')[CONSEQUENCE_idx]
        worst_cnsqce = get_worst_consequence(trscrpt_cnsqce, VEP_order)
        try:
            worst_trscrpt_tup.append((VEP_order[worst_cnsqce], trscrpt))
        except Exception:
            worst_trscrpt_tup.append((VEP_order['MODIFIER'], trscrpt))
    sorted_worst_trscrpt_tup = sorted(worst_trscrpt_tup, key=lambda x_y: x_y[0])
    worst_impact = sorted_worst_trscrpt_tup[0][0]

    # Get worst transcripts and check canonical
    worst_trscrpt_list = []
    for worst_cnsqce, trscrpt in sorted_worst_trscrpt_tup:
        if worst_cnsqce == worst_impact:
            trscrpt_cnonicl = trscrpt.split('|')[CNONICL_idx]
            if (trscrpt_cnonicl == 'YES' or trscrpt_cnonicl == '1'):
                return trscrpt
            worst_trscrpt_list.append(trscrpt)
        else:
            break
    return worst_trscrpt_list[0]


def update_worst(VEP_val, worst_trscrpt):
    ''' TODO add docstring. '''
    # Get VEP
    trscrpt_update = []
    trscrpt_list = VEP_val.split(',')
    # Update transcripts
    for trscrpt in trscrpt_list:
        if trscrpt == worst_trscrpt:
            trscrpt += '|1'
        else:
            trscrpt += '|0'
        trscrpt_update.append(trscrpt)
    return ','.join(trscrpt_update)


def get_worst_consequence(consequence, VEP_order, sep='&'):
    ''' TODO add docstring. '''
    consequence_tup = []
    for cnsqce in consequence.split(sep):
        try:
            consequence_tup.append((VEP_order[cnsqce], cnsqce))
        except Exception:
            consequence_tup.append((VEP_order['MODIFIER'], cnsqce))
    return sorted(consequence_tup, key=lambda x_y: x_y[0])[0][1]


def clean_dbnsfp(vnt_obj, VEPtag, dbNSFP_fields, dbnsfp_ENST_idx, ENST_idx, sep='&'):
    ''' TODO add docstring. '''
    # Get VEP
    try:
        val_get = vnt_obj.get_tag_value(VEPtag)
    except Exception:
        return None
    trscrpt_clean = []
    trscrpt_list = val_get.split(',')
    # Clean transcripts
    for trscrpt in trscrpt_list:
        trscrpt_split = trscrpt.split('|')
        # Get dbnsfp_ENST
        dbnsfp_ENST = trscrpt_split[dbnsfp_ENST_idx].split(sep)
        if len(dbnsfp_ENST) >= 1:  # need to assign values by transcripts
            dbnsfp_idx = -1
            trscrpt_ENST = trscrpt_split[ENST_idx]
            # Check index for current transcript in dbNSFP if any
            for i, ENST in enumerate(dbnsfp_ENST):
                if ENST == trscrpt_ENST:
                    dbnsfp_idx = i
                    break
            for k, v in dbNSFP_fields.items():
                if dbnsfp_idx >= 0:
                    val_ = trscrpt_split[v].split(sep)[dbnsfp_idx]
                    if val_ == '.':
                        val_ = ''
                    trscrpt_split[v] = val_
                else:
                    trscrpt_split[v] = ''
            trscrpt_clean.append('|'.join(trscrpt_split))
        else:
            trscrpt_clean.append(trscrpt)
    return ','.join(trscrpt_clean)


def runner(args):
    ''' TODO add docstring '''
    # Variables
    is_verbose = args['verbose']
    VEPtag = 'CSQ'
    VEP_order = {
                    # HIGH
                    'transcript_ablation': 1,
                    'splice_acceptor_variant': 2,
                    'splice_donor_variant': 3,
                    'stop_gained': 4,
                    'frameshift_variant': 5,
                    'stop_lost': 6,
                    'start_lost': 7,
                    'transcript_amplification': 8,
                    # MODERATE
                    'inframe_insertion': 9,
                    'inframe_deletion': 10,
                    'missense_variant': 11,
                    'protein_altering_variant': 12,
                    # LOW
                    'splice_region_variant': 13,
                    'incomplete_terminal_codon_variant': 14,
                    'start_retained_variant': 15,
                    'stop_retained_variant': 16,
                    'synonymous_variant': 17,
                    # MODIFIER
                    'coding_sequence_variant': 18,
                    'mature_miRNA_variant': 19,
                    '5_prime_UTR_variant': 20,
                    '3_prime_UTR_variant': 21,
                    'intron_variant': 22,
                    'MODIFIER': 23
                }
    dbNSFP_fields = {
                    # dbNSFP fields that may be a list
                    # and need to be assigned to transcripts
                    'Polyphen2_HVAR_pred': 0,
                    'Polyphen2_HVAR_score': 0,
                    'SIFT_pred': 0,
                    'SIFT_score': 0
                    }

    # Definitions
    vep_init = '##VEP=<ID={0}>'.format(VEPtag)
    genes_init = '##CGAP=<ID=GENES>'
    spliceai_def = '##INFO=<ID=spliceaiMaxds,Number=1,Type=Float,Description="SpliceAI max delta score">'
    genes_def = '##INFO=<ID=GENES,Number=.,Type=String,Description=". Subembedded:\'genes\':Format:\'most_severe_gene|most_severe_transcript|most_severe_feature_ncbi|most_severe_hgvsc|most_severe_hgvsp|most_severe_amino_acids|most_severe_sift_score|most_severe_polyphen_score|most_severe_maxentscan_diff|most_severe_consequence\'">'
    variant_def = '##INFO=<ID=variantClass,Number=1,Type=String,Description="Variant type">'

    # Buffers
    fo = io.open(args['outputfile'], 'w', encoding='utf-8')

    # Creating Vcf object
    vcf_obj = vcf_parser.Vcf(args['inputfile'])

    # Modify VEP definition
    vep_def = '##INFO=<ID={0},Number=.,Type=String,Description="Consequence annotations from Ensembl VEP.  Subembedded:\'transcript\':Format:\'{1}\'">'
    for line in vcf_obj.header.definitions.split('\n')[:-1]:
        if line.startswith('##INFO=<ID=' + VEPtag + ','): ##<tag_type>=<ID=<tag>,...
            format = line.split('Format:')[1]
            # Cleaning format
            format = format.replace(' ', '')
            format = format.replace('\'', '')
            format = format.replace('\"', '')
            format = format.replace('>', '')
            # Update definition
            vep_field_list = format.split('|')
            vep_field_list.append('most_severe')
            vep_def = vep_def.format(VEPtag, '|'.join(vep_field_list))
            break

    # Remove older VEP definition
    vcf_obj.header.remove_tag_definition(VEPtag)

    # Update and write custom definitions
    vcf_obj.header.add_tag_definition(vep_init + '\n' + genes_init, 'INFO')
    vcf_obj.header.add_tag_definition(spliceai_def, 'INFO')
    vcf_obj.header.add_tag_definition(genes_def, 'INFO')
    vcf_obj.header.add_tag_definition(variant_def, 'INFO')
    vcf_obj.header.add_tag_definition(vep_def, 'INFO')

    # Write header
    vcf_obj.write_header(fo)

    # Get SpliceAI ds indexes
    # DStags import from granite.shared_vars
    SpAItag_list, SpAI_idx_list = [], []
    for DStag in DStags:
        tag, idx = vcf_obj.header.check_tag_definition(DStag)
        SpAItag_list.append(tag)
        SpAI_idx_list.append(idx)

    # Get VEP indexes
    # Indexes to resolve dbNSFP values by transcript
    dbnsfp_ENST_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'Ensembl_transcriptid')
    for field in dbNSFP_fields:
        dbNSFP_fields[field] = vcf_obj.header.get_tag_field_idx(VEPtag, field)

    # Indexes for worst transcript (GENES)
    CNONICL_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'CANONICAL')
    ENSG_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'Gene')
    ENST_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'Feature')
    MANE_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'MANE') #feature_ncbi
    HGVSC_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'HGVSc')
    HGVSP_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'HGVSp')
    AACIDS_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'Amino_acids')
    SIFT_idx = dbNSFP_fields['SIFT_score']
    PPHEN_idx = dbNSFP_fields['Polyphen2_HVAR_score']
    MAXENTDIFF_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'MaxEntScan_diff')
    CONSEQUENCE_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'Consequence')

    # Reading variants and adding new tags
    for i, vnt_obj in enumerate(vcf_obj.parse_variants()):
        if is_verbose:
            sys.stderr.write('\r' + str(i+1))
            sys.stderr.flush()

        # Clean dbNSFP by resolving values by transcript
        VEP_clean = clean_dbnsfp(vnt_obj, VEPtag, dbNSFP_fields, dbnsfp_ENST_idx, ENST_idx)

        if not VEP_clean:
            continue

        # Get max SpliceAI max_ds
        maxds = get_maxds(vnt_obj, SpAItag_list, SpAI_idx_list)

        # Get most severe transcript
        worst_trscrpt = get_worst_trscrpt(VEP_clean, VEP_order, CNONICL_idx, CONSEQUENCE_idx)

        # Get variant class
        # import from granite.shared_functions
        clss = variant_type_ext(vnt_obj.REF, vnt_obj.ALT)

        # Add MAXDS to variant INFO
        if maxds:
            vnt_obj.add_tag_info('spliceaiMaxds={0}'.format(maxds))

        # Add CLASS to variant INFO
        vnt_obj.add_tag_info('variantClass={0}'.format(clss.upper()))

        # Update and replace VEP tag in variant INFO
        # Adding field most_severe (0|1) to transcripts
        VEP_update = update_worst(VEP_clean, worst_trscrpt)
        # Replace VEP
        vnt_obj.remove_tag_info(VEPtag)
        vnt_obj.add_tag_info('{0}={1}'.format(VEPtag, VEP_update))

        # Add GENES to variant INFO
        worst_trscrpt_ = worst_trscrpt.split('|')
        worst_consequence_ = get_worst_consequence(worst_trscrpt_[CONSEQUENCE_idx], VEP_order)
        genes = '{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9}'.format(
                                                        worst_trscrpt_[ENSG_idx],
                                                        worst_trscrpt_[ENST_idx],
                                                        worst_trscrpt_[MANE_idx],
                                                        worst_trscrpt_[HGVSC_idx],
                                                        worst_trscrpt_[HGVSP_idx],
                                                        worst_trscrpt_[AACIDS_idx],
                                                        worst_trscrpt_[SIFT_idx],
                                                        worst_trscrpt_[PPHEN_idx],
                                                        worst_trscrpt_[MAXENTDIFF_idx],
                                                        worst_consequence_
                                                )
        vnt_obj.add_tag_info('GENES={0}'.format(genes))

        # Write variant
        vcf_obj.write_variant(fo, vnt_obj)

    # Close buffers
    sys.stderr.write('\n')
    fo.close()


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Reformat VCF and add custom tags and fields in VCF file for portal ingestion')

    parser.add_argument('-i','--inputfile', help='input VCF file', required=True)
    parser.add_argument('-o','--outputfile', help='output VCF file', required=True)
    parser.add_argument('--verbose', help='verbose', action='store_true', required=False)

    args = vars(parser.parse_args())

    runner(args)
