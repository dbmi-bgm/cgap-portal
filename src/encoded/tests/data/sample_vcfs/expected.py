# contains expected stuff for test_ingest_vcf

VARIANT_SCHEMA = './src/encoded/tests/data/sample_vcfs/variant.json'
VARIANT_SAMPLE_SCHEMA = './src/encoded/tests/data/sample_vcfs/variant_sample.json'
ANN_SINGLE_RECORD = './src/encoded/tests/data/sample_vcfs/single_record_ANN.vcf'
ANN_FIELDS = ['Allele', 'Annotation', 'Annotation_Impact', 'Gene_Name', 'Gene_ID',
'Feature_Type', 'Feature_ID', 'Transcript_BioType', 'Rank', 'HGVS.c', 'HGVS.p',
'cDNA.pos / cDNA.length', 'CDS.pos / CDS.length', 'AA.pos / AA.length', 'Distance',
'ERRORS / WARNINGS / INFO']

ANN_SINGLE_RECORD_EXPECTED = {'Allele': {0: 'A', 1: 'A', 2: 'A', 3: 'A'},
'Annotation': {0: 'missense_variant', 1: 'missense_variant', 2: 'missense_variant',
3: 'upstream_gene_variant'}, 'Annotation_Impact': {0: 'MODERATE', 1: 'MODERATE',
2: 'MODERATE', 3: 'MODIFIER'}, 'Gene_Name': {0: 'ISG15', 1: 'ISG15', 2: 'ISG15',
3: 'RP11-54O7.11'}, 'Gene_ID': {0: 'ENSG00000187608', 1: 'ENSG00000187608',
2: 'ENSG00000187608', 3: 'ENSG00000224969'}, 'Feature_Type': {0: 'transcript',
1: 'transcript', 2: 'transcript', 3: 'transcript'}, 'Feature_ID': {0: 'ENST00000379389.4',
1: 'ENST00000624697.3', 2: 'ENST00000624652.1', 3: 'ENST00000458555.1'},
'Transcript_BioType': {0: 'protein_coding', 1: 'protein_coding', 2: 'protein_coding',
3: 'antisense'}, 'Rank': {0: '2/2', 1: '3/3', 2: '3/3'}, 'HGVS.c': {0: 'c.62G>A',
1: 'c.38G>A', 2: 'c.38G>A', 3: 'n.-849C>T'}, 'HGVS.p': {0: 'p.Ser21Asn', 1: 'p.Ser13Asn',
2: 'p.Ser13Asn'}, 'cDNA.pos / cDNA.length': {0: '213/711', 1: '289/788', 2: '264/657'},
'CDS.pos / CDS.length': {0: '62/498', 1: '38/474', 2: '38/431'}, 'AA.pos / AA.length':
{0: '21/165', 1: '13/157', 2: '13/142'}, 'ERRORS / WARNINGS / INFO': {2:
'WARNING_TRANSCRIPT_INCOMPLETE'}, 'Distance': {3: '849'}}

ANNOVAR_SINGLE_RECORD = './src/encoded/tests/data/sample_vcfs/single_record_ANNOVAR.vcf'

ANNOVAR_SINGLE_RECORD_EXPECTED = {'Func.ensGene': {0: 'exonic'}, 'Gene.ensGene':
{0: 'ISG15'}, 'ExonicFunc.ensGene': {0: 'nonsynonymous_SNV'}, 'AAChange.ensGene':
{0: 'ISG15:ENST00000379389.4:exon2:c.G62A:p.S21N,ISG15:ENST00000624697.3:exon3:c.G38A:p.S13N'},
'Func.refGene': {0: 'exonic'}, 'Gene.refGene': {0: 'ISG15'}, 'ExonicFunc.refGene':
{0: 'nonsynonymous_SNV'}, 'AAChange.refGene': {0: 'ISG15:NM_005101:exon2:c.G62A:p.S21N'},
'Func.knownGene': {0: 'exonic'}, 'Gene.knownGene': {0: 'ISG15'}, 'ExonicFunc.knownGene':
{0: 'nonsynonymous_SNV'}, 'AAChange.knownGene': {0:
'ISG15:uc001acj.5:exon2:c.G62A:p.S21N,ISG15:uc057ayq.1:exon3:c.G38A:p.S13N,ISG15:uc057ayr.1:exon3:c.G38A:p.S13N'},
'cytoBand': {0: '1p36.33'}, '1000g2015aug_afr': {0: '0.0219'}, '1000g2015aug_amr':
{0: '0.0029'}, '1000g2015aug_all': {0: '0.0061901'}, 'esp6500siv2_all': {0: '0.0055'},
'esp6500siv2_aa': {0: '0.0161'}, 'ExAC_ALL': {0: '0.0017'}, 'ExAC_AFR': {0: '0.0169'},
'ExAC_AMR': {0: '0.0011'}, 'ExAC_EAS': {0: '0'}, 'ExAC_FIN': {0: '0'}, 'ExAC_NFE':
{0: '0.0001'}, 'ExAC_OTH': {0: '0.0011'}, 'ExAC_SAS': {0: '6.177e-05'}, 'ExAC_nonpsych_ALL':
{0: '0.0022'}, 'ExAC_nonpsych_AFR': {0: '0.0169'}, 'ExAC_nonpsych_AMR': {0: '0.0011'},
'ExAC_nonpsych_EAS': {0: '0'}, 'ExAC_nonpsych_FIN': {0: '0'}, 'ExAC_nonpsych_NFE':
{0: '0.0002'}, 'ExAC_nonpsych_OTH': {0: '0'}, 'ExAC_nonpsych_SAS': {0: '6.181e-05'},
'ExAC_nontcga_ALL': {0: '0.0016'}, 'ExAC_nontcga_AFR': {0: '0.0168'}, 'ExAC_nontcga_AMR':
{0: '0.0011'}, 'ExAC_nontcga_EAS': {0: '0'}, 'ExAC_nontcga_FIN': {0: '0'},
'ExAC_nontcga_NFE': {0: '0.0001'}, 'ExAC_nontcga_OTH': {0: '0.0014'}, 'ExAC_nontcga_SAS':
{0: '6.216e-05'}, 'Kaviar_AF': {0: '0.0015718'}, 'Kaviar_AC': {0: '243'}, 'Kaviar_AN':
{0: '154602'}, 'gnomAD_genome_ALL': {0: '0.0042'}, 'gnomAD_genome_AFR': {0: '0.0143'},
'gnomAD_genome_AMR': {0: '0.0036'}, 'gnomAD_genome_ASJ': {0: '0'}, 'gnomAD_genome_EAS':
{0: '0'}, 'gnomAD_genome_FIN': {0: '0'}, 'gnomAD_genome_NFE': {0: '0'}, 'gnomAD_genome_OTH':
{0: '0.0031'}, 'gnomAD_exome_ALL': {0: '0.0013'}, 'gnomAD_exome_AFR': {0:
'0.0177'}, 'gnomAD_exome_AMR': {0: '0.0007'}, 'gnomAD_exome_ASJ': {0: '0'},
'gnomAD_exome_EAS': {0: '0'}, 'gnomAD_exome_FIN': {0: '0'}, 'gnomAD_exome_NFE':
{0: '9.908e-05'}, 'gnomAD_exome_OTH': {0: '0.0005'}, 'gnomAD_exome_SAS': {0: '6.502e-05'},
'SIFT_score': {0: '0.732'}, 'SIFT_converted_rankscore': {0: '0.038'}, 'SIFT_pred':
{0: 'T'}, 'LRT_score': {0: '0.542'}, 'LRT_converted_rankscore': {0: '0.053'},
'LRT_pred': {0: 'N'}, 'MutationTaster_score': {0: '1'}, 'MutationTaster_converted_rankscore':
{0: '0.090'}, 'MutationTaster_pred': {0: 'N'}, 'MutationAssessor_score': {0: '-0.59'},
'MutationAssessor_score_rankscore': {0: '0.022'}, 'MutationAssessor_pred': {0: 'N'},
'FATHMM_score': {0: '-0.85'}, 'FATHMM_converted_rankscore': {0: '0.744'}, 'FATHMM_pred':
{0: 'T'}, 'PROVEAN_score': {0: '0.34'}, 'PROVEAN_converted_rankscore': {0: '0.038'},
'PROVEAN_pred': {0: 'N'}, 'MetaSVM_score': {0: '-0.925'}, 'MetaSVM_rankscore': {0: '0.449'},
'MetaSVM_pred': {0: 'T'}, 'MetaLR_score': {0: '0.123'}, 'MetaLR_rankscore': {0: '0.426'},
'MetaLR_pred': {0: 'T'}, 'fathmm-MKL_coding_score': {0: '0.019'}, 'fathmm-MKL_coding_rankscore':
{0: '0.058'}, 'fathmm-MKL_coding_pred': {0: 'N'}, 'Eigen_coding_or_noncoding': {0: 'c'},
'Eigen-raw': {0: '-1.137'}, 'Eigen-PC-raw': {0: '-1.150'}, 'GenoCanyon_score':
{0: '1.000'}, 'GenoCanyon_score_rankscore': {0: '0.747'}, 'integrated_fitCons_score':
{0: '0.726'}, 'integrated_fitCons_score_rankscore': {0: '0.872'}, 'integrated_confidence_value':
{0: '0'}, 'GERP++_RS': {0: '1.92'}, 'GERP++_RS_rankscore': {0: '0.248'}, 'phyloP100way_vertebrate':
{0: '-0.676'}, 'phyloP100way_vertebrate_rankscore': {0: '0.053'}, 'phyloP20way_mammalian':
{0: '-0.119'}, 'phyloP20way_mammalian_rankscore': {0: '0.114'}, 'phastCons100way_vertebrate':
{0: '0.000'}, 'phastCons100way_vertebrate_rankscore': {0: '0.063'}, 'phastCons20way_mammalian':
{0: '0.001'}, 'phastCons20way_mammalian_rankscore': {0: '0.043'}, 'SiPhy_29way_logOdds':
{0: '3.516'}, 'SiPhy_29way_logOdds_rankscore': {0: '0.072'}, 'Interpro_domain':
{0: 'Ubiquitin_domain\\x7cUbiquitin-related_domain'}, 'avsnp142': {0: 'rs143888043'},
'dgvMerged': {0:
'Name\\x3dnsv482937,nsv945741,nsv428334,nsv1160644,nsv517709,nsv544895,dgv2n67,esv2762302,nsv950451,nsv10161,nsv509146,nsv1013524,dgv5n100'},
'CLNALLELEID': {0: '446939'}, 'CLNDN': {0: 'Immunodeficiency_38_with_basal_ganglia_calcification'},
 'CLNDISDB': {0: 'MedGen:C4015293,OMIM:616126,Orphanet:ORPHA319563'}, 'CLNREVSTAT':
 {0: 'criteria_provided,_single_submitter'}, 'CLNSIG': {0: 'Benign'}, 'simpleRepeat':
 {0: 'Name\\x3dGGGGACTCCGTGGGGGGAGGCTGAGGCTAT'}, 'all_repeats.b37': {0: 'Name\\x3dNA'}}

SAMPLE_VCF_V41 = './src/encoded/tests/data/sample_vcfs/sample_vcf.vcf'
SAMPLE_VCF_KEYS = ['BKPTID', 'CIEND', 'CIPOS', 'END', 'HOMLEN', 'HOMSEQ', 'SVLEN', 'SVTYPE']
SAMPLE_VCF_EXPECTED = ['END', 'HOMLEN', 'HOMSEQ', 'SVLEN', 'SVTYPE']
