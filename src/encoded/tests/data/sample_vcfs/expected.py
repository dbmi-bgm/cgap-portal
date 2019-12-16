# contains expected stuff for test_ingest_vcf


TEST_VCF = './src/encoded/tests/data/sample_vcfs/test_vcf.vcf'
EXPECTED_ANNOTATION_FIELDS = ['MUTANNO', 'ANNOVAR', 'VEP', '1000GP', 'ESP6500', 'ExAC',
                              'ExACnonpsych', 'ExACnonTCGA', 'KAVIAR', 'UK10K',
                              'TOPmed', 'dbSNP', 'gnomAD', 'gnomADexome',
                              'MaxPopAF', 'dbNSFP', 'CADD', 'SpliceAI',
                              'INTERVAR', 'CLINVAR', 'genomicSuperDups',
                              'simpleRepeat', 'rmsk', 'nestedRepeats',
                              'microsat']
EXPECTED_GENERIC_FIELDS = ['AC', 'AF', 'AN', 'BaseQRankSum', 'ClippingRankSum',
                           'DB', 'DP', 'DS', 'END', 'ExcessHet', 'FS',
                           'HaplotypeScore', 'InbreedingCoeff', 'MLEAC',
                           'MLEAF', 'MQ', 'MQRankSum', 'NEGATIVE_TRAIN_SITE',
                           'POSITIVE_TRAIN_SITE', 'QD', 'RAW_MQ',
                           'ReadPosRankSum', 'SOR', 'VQSLOD', 'culprit']
VARIANT_SCHEMA = './src/encoded/tests/data/sample_vcfs/variant.json'
VARIANT_SAMPLE_SCHEMA = './src/encoded/tests/data/sample_vcfs/variant_sample.json'
RAW_INFOTAG_DESCRIPTION = "Predicted nonsense mediated decay effects for this variant by VEP. Subembedded:'transcript':Format:'Location|Allele|Gene|Gene_ncbi|Feature|Feature_ncbi|Feature_type|Consequence|cDNA_position|CDS_position|Protein_position|Amino_acids|Codons|Existing_variation|IMPACT|DISTANCE|STRAND|FLAGS|VARIANT_CLASS|SYMBOL|SYMBOL_SOURCE|HGNC_ID|BIOTYPE|CANONICAL|MANE|TSL|APPRIS|CCDS|ENSP|SWISSPROT|TREMBL|UNIPARC|GENE_PHENO|SIFT|PolyPhen|EXON|INTRON|DOMAINS|miRNA|HGVSc|HGVSp|HGVS_OFFSET|CLIN_SIG|SOMATIC|PHENO|PUBMED|MOTIF_NAME|MOTIF_POS|HIGH_INF_POS|MOTIF_SCORE_CHANGE' "
