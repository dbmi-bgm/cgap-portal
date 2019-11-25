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
