#!/usr/bin/env python3

################################################
#
#   Add alt allele counts on most sever gene
#       per sample
#
#   Michele Berselli
#   berselli.michele@gmail.com
#
################################################
import argparse
import codecs
from granite.lib import vcf_parser


def get_most_severe(vnt_obj, VEPtag, ENSG_idx, most_severe_idx):
    ''' TODO docstring '''
    try:
        val_get = vnt_obj.get_tag_value(VEPtag)
    except Exception:
        return False
    trscrpt_list = val_get.split(',')
    # Check most severe field
    for trscrpt in trscrpt_list:
        most_severe = int(trscrpt.split('|')[most_severe_idx])
        if most_severe:
            return trscrpt.split('|')[ENSG_idx]
    return False


def main(args):
    # Variables
    VEPtag = 'CSQ'
    samplegeno_def = '##INFO=<ID=SAMPLEGENO,Number=.,Type=String,Description="Sample genotype information. Subembedded:\'samplegeno\':Format:\'NUMGT|GT|AD|SAMPLEID|AC\'">'
    counts_dict = {}  # {ENSG: {sample: alt_count, ...}, ...}

    # Creating Vcf object
    vcf_obj = vcf_parser.Vcf(args['inputfile'])

    # Indexes
    ENSG_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'Gene')
    most_severe_idx = vcf_obj.header.get_tag_field_idx(VEPtag, 'most_severe')

    # Counting alleles per most severe gene
    for vnt_obj in vcf_obj.parse_variants():
        ENSG = get_most_severe(vnt_obj, VEPtag, ENSG_idx, most_severe_idx)
        if ENSG:
            counts_dict.setdefault(ENSG, {})
            for ID_genotype in vnt_obj.IDs_genotypes:
                counts_dict[ENSG].setdefault(ID_genotype, 0)
                GT_0, GT_1 = vnt_obj.get_genotype_value(ID_genotype, 'GT').replace('|', '/').split('/')
                if GT_0 not in ['0', '.']:
                    counts_dict[ENSG][ID_genotype] += 1
                if GT_1 not in ['0', '.']:
                    counts_dict[ENSG][ID_genotype] += 1
        else:
            continue

    # Buffers
    fo = codecs.open(args['outputfile'], 'w', 'utf-8')

    # Update and write header
    vcf_obj.header.remove_tag_definition('SAMPLEGENO')
    vcf_obj.header.add_tag_definition(samplegeno_def, 'INFO')
    vcf_obj.write_header(fo)

    # Reading variants and adding samplegeno
    for vnt_obj in vcf_obj.parse_variants():
        ENSG = get_most_severe(vnt_obj, VEPtag, ENSG_idx, most_severe_idx)
        # Update samplegeno
        samplegeno = []
        samplegeno_ = vnt_obj.get_tag_value('SAMPLEGENO').split(',')
        for sample_ in samplegeno_:
            _, _, _, SAMPLEID = sample_.split('|')
            sample = sample_ + '|' + str(counts_dict[ENSG][SAMPLEID])
            samplegeno.append(sample)

        # Add samplegeno to variant INFO
        vnt_obj.remove_tag_info('SAMPLEGENO')
        vnt_obj.add_tag_info('SAMPLEGENO={0}'.format(','.join(samplegeno)))

        # Write variant
        vcf_obj.write_variant(fo, vnt_obj)

    fo.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Add alt allele counts on most sever gene per sample')

    parser.add_argument('-i', '--inputfile', help='input VCF file', required=True)
    parser.add_argument('-o', '--outputfile', help='output VCF file', required=True)

    args = vars(parser.parse_args())

    main(args)
