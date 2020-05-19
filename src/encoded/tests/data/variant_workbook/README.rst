================
Variant Workbook
================

The Variant Workbook contains files related to testing variants on cgap. Below is an overview of each file.
See the respective test files. If you require variants/genes for testing, see variant_fixtures.py.

    * expected.py - contains expected values, used in tests. Modify these if you update the mapping table/vcf.
    * gene_table.csv - contains the gene annotation fields, to be ingested
    * variant_table.csv - conatins variant annotation fields, to be ingested (may be versioned)
    * variant.json - symlink to to schemas/variant.json, so if you generate a new one you must copy it to schemas before it is picked up by the tests.
    * variant_sample.json - analogous symlink^
    * varaint_consequence.json - variant_consequence items to be posted and linked to in variants
    * vcf_v0.4.6_subset.vcf - the vcf ingested in the tests
    * gene_workbook.json - genes required to post a small subset of variants
    * gene_inserts_partial.json - small subset of genes to post in tests