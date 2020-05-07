# contains expected stuff for test_ingest_vcf


TEST_VCF = './src/encoded/tests/data/variant_workbook/vcf_v0.4.6_subset.vcf'
EXPECTED_ANNOTATION_FIELDS = ['MUTANNO', 'VEP', 'CYTOBAND', 'UNIPROT_TRANSMEM', 'DBSNP',
                              'CONSERVATION', 'PRIMATEAI', 'CADD', 'SPLICEAI', 'MAX_POP_AF',
                              'GNOMAD', 'TOPMED', 'UK10K', 'GENOMIC_SUPER_DUPLICATES', 'SIMPLE_REPEAT',
                              'RMSK', 'NESTED_REPEATS', 'MICROSATELLITE', 'CLINVAR', 'COSMIC']
VARIANT_SCHEMA = './src/encoded/schemas/variant.json'
VARIANT_SAMPLE_SCHEMA = './src/encoded/schemas/variant_sample.json'
RAW_INFOTAG_DESCRIPTION = "Predicted nonsense mediated decay effects for this variant by VEP. Subembedded:'transcript':Format:'Location|Allele|Gene|Gene_ncbi|Feature|Feature_ncbi|Feature_type|Consequence|cDNA_position|CDS_position|Protein_position|Amino_acids|Codons|Existing_variation|IMPACT|DISTANCE|STRAND|FLAGS|VARIANT_CLASS|SYMBOL|SYMBOL_SOURCE|HGNC_ID|BIOTYPE|CANONICAL|MANE|TSL|APPRIS|CCDS|ENSP|SWISSPROT|TREMBL|UNIPARC|GENE_PHENO|SIFT|PolyPhen|EXON|INTRON|DOMAINS|miRNA|HGVSc|HGVSp|HGVS_OFFSET|CLIN_SIG|SOMATIC|PHENO|PUBMED|MOTIF_NAME|MOTIF_POS|HIGH_INF_POS|MOTIF_SCORE_CHANGE' "
