# contains expected stuff for test_ingest_vcf


TEST_VCF = './src/encoded/annotations/GAPFIAI7IZ9Y_v0.5.3.vcf'  # reformatted + alt counts
EXPECTED_ANNOTATION_FIELDS = ['comHet', 'CSQ']
VARIANT_SCHEMA = './src/encoded/schemas/variant.json'
VARIANT_SAMPLE_SCHEMA = './src/encoded/schemas/variant_sample.json'
