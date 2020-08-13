=====================
Annotations Directory
=====================

This directory contains core annotation files, meaning files which are required for ingesting annotations. Once annotations have been posted to the portal, these files are no longer of use. A list of files is below.

    * gene_table_v0.4.6.csv -- latest Gene Mapping Table.
    * gene_inserts_v0.4.6.json -- corresponding Gene inserts (``make download-genes``)
    * variant_consequence.json -- consequence item inserts
    * variant_table_v0.4.8.csv -- latest Variant Mapping Table.
    * vcf_v0.4.6.vcf -- older test VCF for reference

Running ``make deploy3`` will run the end-to-end process after a fresh run of ``make deploy1`` and ``make deploy2``.