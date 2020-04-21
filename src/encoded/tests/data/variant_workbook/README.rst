================
Variant Workbook
================

The Variant Workbook contains files related to testing variants on cgap. Below is an overview of each file.

    * expected.py - contains expected values, used in tests. Modify these if you update the mapping table/vcf.
    * gene_table.csv - contains the gene annotation fields, to be ingested
    * variant_table.csv - conatins variant annotation fields, to be ingested
    * variant.json - symlink to to schemas/variant.json, so if you generate a new one you must copy it to schemas before it is picked up by the tests.
    * variant_sample.json - analogous symlink^
    * varaint_consequence.json - variant_consequence items to be posted and linked to in variants
    * test_vcf.vcf - the vcf ingested in the tests