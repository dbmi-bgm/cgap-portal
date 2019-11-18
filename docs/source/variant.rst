Variant Ingestion
=================

The goal is to create a pipeline for ingestion of variant items from annotated VCF files to the CGAP data portal. As part of this, version all elements involved based on the version of the annotation DB. We need to support a comprehensive revision history for variants, as well as a system of intelligently searching/filtering on most up-to-date variants and notifications to users when variants of interest change.

Mapping Table Intake
^^^^^^^^^^^^^^^^^^^^

The Variant Ingestion program takes in a VCF and mapping table, which are both created from a given version of the annotation DB. The program creates variant, sample variant and annotation field items that are added to the portal through a REST API. Additionally, versioned schemas for variants and sample variants are created and stored. The code for parsing the mapping table and creating the variant/sample variant schemas is in `mapping_table_intake.py <../src/encoded/commands/mapping_table_intake.py>`_.

This step is processed like a script in several sub steps, enumerated below by function.

1. Read Mapping Table Header/Fields. Relevant functions: ``process_fields`` and ``read_mapping_table``. In this step we read the Mapping Table's version and field names so we know what to expect when we process the items.
2. Schema Generation. Relevant Functions: ``generate_properties``, ``generate_variant_sample_schema`` and ``generate_variant_schema``. In this step we generate the schema fields necessary in ``generate_properties``, coalesce them together and add default fields we expect. These schemas are written out to ``variant.json`` and ``sample_variant.json`` and are used in later steps.
3. Generate Inserts. Relevant Function: ``process_inserts``. In this step we process the rows of the mapping table creating the annotation field items. These items need to be matched up later on during VCF ingestion.

VCF Parsing
^^^^^^^^^^^

After producing the schemas it is time to ingest the annotated VCF. This file has a complicated structure described below. The code for this step is in `ingest_vcf.py <../src/encoded/commands/ingest_vcf.py`_. An overview of the steps is below

The step is written in a more object-oriented way with ``VCFParser`` the main class containing several static methods specific to VCF parsing. Helper functions handle specific steps, described below.

1. Read VCF Metadata. This includes splitting VCF fields in annotation and non-annotation fields, that way we know which fields will require additional post processing beyond the initial INFO field processes.
2. Parse standard VCF fields. These are easily acquired as there is nothing special about them.
3. Parse annotation fields. These are much trickier because they are formatted differently and must be encoded a certain way to not break the VCF specification. More on this follows in the VCF specification.

Annotation VCF Specification
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Below is an outline of the annotated VCF structure with an example on how exactly it is processed.

VCF-Specific Restrictions
"""""""""""""""""""""""""

For the annotated VCF we make use of INFO fields to encapsulate our annotations. This field is part of the VCF structure and has the following restrictions on values within the field (ie: ‘AC=2;VEP=1|2…’ etc).
1. String format (conversion to type specified on the Mapping Table is done later)
2. No whitespace (tabs, spaces or otherwise)
3. No semicolon (delineates fields in INFO block)
4. No equals = (delineates fields in INFO block, ie: AC=2;VEP=1,2,3;)
5. Commas can only be used to separate annotation values

Our Restrictions
""""""""""""""""

Annotation fields that should be processed as such must be marked with a MUTANNO tag in the VCF metadata as below.

.. code-block::

  ##MUTANNO=<ID=VEP,Version="v97.4",Date="07/04/2019">

Annotation fields that have MUTANNO tags must also have a corresponding INFO tag. This tag must specify format if the annotation is multi-valued and must be pipe (|) separated. An example of each is below.

.. code-block::

  ##INFO=<ID=1000GP,Number=.,Type=String,Description="population AF by 1000GP.
  ##INFO=<ID=SNPEFFLOF,Number=.,Type=String,Description="Predicted loss of function effects for this variant by SNPEFF. Format:'Gene_Name|Gene_ID|Number_of_transcripts_in_gene|Percent_of_transcripts_affected' ">

If an annotation field can have multiple entries, as is the case with VEP, these entries must be comma separated as consistent with the VCF requirements.

.. code-block::

  VEP=1%3A65565|G|CCDS30547.1|CCDS30547.1|Transcript|upstream_gene_variant|||||||MODIFIER|3526|1||SNV||||protein_coding|YES||||CCDS30547.1|CCDS30547.1|||||||||||||||||||||,1%3A65565|G|ENSG00000186092|ENST00000335137|Transcript|upstream_gene_variant|||||||MODIFIER|3490|1||SNV|OR4F5|HGNC|HGNC%3A14825|protein_coding|YES|||P1|CCDS30547.1|ENSP00000334393|Q8NH21||UPI0000041BC1|||||||||||||||||| …

If an annotation field within a sub-embedded object is an array, such as vep_domains, those entries must be tilde (~) separated and no further nesting is allowed.

.. code-block::

  VEP= … |val_1~val_2~val_3| … → process field as [val_1, val_2, val_3]

Separator Summary
"""""""""""""""""

1. Tab separates VCF specific fields and is thus restricted.
2. Semicolon separates different annotation fields within INFO and is thus restricted.
3. Comma separates sub-embedded objects within a single INFO field (such as VEP) and cannot be used in any other way.
4. Pipe separates multi-valued annotation fields and cannot be used in any other way
5. Tilde separates sub-embedded objects that are also arrays, such as vep_domain and cannot be used in any other way.


Parsing Example
^^^^^^^^^^^^^^^

Given these restrictions, below is a detailed walk through of how the VCF parses the annotation fields given this specification. A truncated example entry is below. Assume we are able to grab appropriate MUTTANO/INFO header information. New lines are inserted for readability but are not present in the actual file.

.. code-block::

  #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	HG002
  chr1	65565	.	A	G	58.56	VQSRTrancheSNP99.00to99.90

The first line is the VCF field header. Fields other than INFO are readily accessible. All annotation fields are collapsed into the INFO section. FORMAT and HG002 follow after INFO. The fields below are tab separated as consistent with the VCF specification. A tab separates the last part of the data above and the INFO data below.

.. code-block::

  AC=2;AF=0.500;AN=4;DP=24;ExcessHet=0.7918;FS=0.000;MLEAC=2;MLEAF=0.500;MQ=65.65;NEGATIVE_TRAIN_SITE;QD=29.28;SOR=2.303;VQSLOD=-3.874e+00;culprit=DP;

These annotations are all single valued and are thus processed directly as strings. Conversion to actual types is done later.

.. code-block::

  VEP=1%3A65565|G|CCDS30547.1|CCDS30547.1|Transcript|upstream_gene_variant|||||||MODIFIER|3526|1||SNV||||protein_coding|YES||||CCDS30547.1|CCDS30547.1|||||||||||||||||||||,

  1%3A65565|G|ENSG00000186092|ENST00000335137|Transcript|upstream_gene_variant|||||||MODIFIER|3490|1||SNV|OR4F5|HGNC|HGNC%3A14825|protein_coding|YES|||P1|CCDS30547.1|ENSP00000334393|Q8NH21||UPI0000041BC1||||||||||||||||||,

  1%3A65565|G|ENSG00000240361|ENST00000492842|Transcript|downstream_gene_variant|||||||MODIFIER|1678|1||SNV|OR4G11P|HGNC|HGNC%3A31276|transcribed_unprocessed_pseudogene|||||||||||||||||||||||||||;

Above is a VEP annotation entry that is both multi-valued and has multiple entries. To parse this we first split on the comma to get the groups. Newlines are inserted to visualize the groups. We then split on pipe since the fields are pipe separated. Even if a field is blank a pipe must be present for that field otherwise we will not be able to determine which fields go with which values. Once we have all the fields, we then go through each one and post-process. If it is an array field (not shown in this example but consistent with point 4 above) then we split again on tilde to determine the array elements, otherwise the field value is cast to the appropriate type.

Item Generation
^^^^^^^^^^^^^^^

Once we have processed the VCF a dictionary is created that roughly represents the structure of each VCF record (one per line). Keys are annotation fields, values are either direct or keyed again (sub-dictionary) on the subfield. See brief example below.

.. code-block:: python

  result = { 'CHROM' : 'chr1', 'POS': 65565 … 'VEP' : { 'Location' : '<val>', 'Allele': '<val>' … } }

This dictionary is then converted to the format expected by Elasticsearch (TBD). The above described dictionary format should thus be considered temporary
