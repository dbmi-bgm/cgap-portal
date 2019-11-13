# contains expected stuff for test_ingest_vcf


SINGLE_RECORD_FULL = './src/encoded/tests/data/sample_vcfs/single_record_full.vcf'
EXPECTED_ANNOTATION_FIELDS = ['MUTANNO', 'ANNOVAR', 'SNPEFF', 'SNPEFFLOF',
                              'SNPEFFNMD', 'VEP', '1000GP', 'ESP6500', 'ExAC',
                              'ExACnonpsych', 'ExACnonTCGA', 'KAVIAR', 'UK10K',
                              'TOPmed', 'dbSNP', 'gnomAD', 'gnomADexome',
                              'MaxPopAF', 'dbNSFP', 'CADD', 'SpliceAI',
                              'INTERVAR', 'CLINVAR', 'genomicSuperDups',
                              'simpleRepeat', 'rmsk', 'nestedRepeats',
                              'microsat', 'dgvMerged']
EXPECTED_GENERIC_FIELDS = ['AC', 'AF', 'AN', 'BaseQRankSum', 'ClippingRankSum',
                           'DB', 'DP', 'DS', 'END', 'ExcessHet', 'FS',
                           'HaplotypeScore', 'InbreedingCoeff', 'MLEAC',
                           'MLEAF', 'MQ', 'MQRankSum', 'NEGATIVE_TRAIN_SITE',
                           'POSITIVE_TRAIN_SITE', 'QD', 'RAW_MQ',
                           'ReadPosRankSum', 'SOR', 'VQSLOD', 'culprit']
EXPECTED_ANNOVAR_FIELDS = ['Func.ensGene', 'Gene.ensGene', 'GeneDetail.ensGene',
                           'ExonicFunc.ensGene', 'AAChange.ensGene',
                           'Func.refGene', 'Gene.refGene', 'GeneDetail.refGene',
                           'GeneDetail.refGene', 'ExonicFunc.refGene',
                           'AAChange.refGene', 'Func.knownGene', 'Gene.knownGene',
                           'GeneDetail.knownGene', 'ExonicFunc.knownGene',
                           'AAChange.knownGene', 'cytoBand']
RESULT_EXPECTED_FIELDS = ['ANNOVAR', 'SNPEFF', 'SNPEFFLOF', 'SNPEFFNMD', 'VEP',
                          '1000GP', 'ESP6500', 'ExAC', 'ExACnonpsych',
                          'ExACnonTCGA', 'KAVIAR', 'UK10K', 'TOPmed', 'dbSNP',
                          'gnomAD', 'gnomADexome', 'MaxPopAF', 'dbNSFP', 'CADD',
                          'SpliceAI', 'INTERVAR', 'CLINVAR', 'genomicSuperDups',
                          'simpleRepeat', 'rmsk', 'nestedRepeats', 'microsat',
                          'dgvMerged', 'AC', 'AF', 'AN', 'BaseQRankSum',
                          'ClippingRankSum', 'DB', 'DP', 'DS', 'END', 'ExcessHet',
                          'FS', 'HaplotypeScore', 'InbreedingCoeff', 'MLEAC',
                          'MLEAF', 'MQ', 'MQRankSum', 'NEGATIVE_TRAIN_SITE',
                          'POSITIVE_TRAIN_SITE', 'QD', 'RAW_MQ', 'ReadPosRankSum',
                          'SOR', 'VQSLOD', 'culprit', 'Chrom', 'Pos', 'ID', 'Ref',
                          'Alt', 'Qual', 'Filter', 'Format', 'samples']
VARIANT_SCHEMA = './src/encoded/tests/data/sample_vcfs/variant.json'
VARIANT_SAMPLE_SCHEMA = './src/encoded/tests/data/sample_vcfs/variant_sample.json'
