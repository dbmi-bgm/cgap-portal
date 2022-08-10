In the spreadsheet, each row represents one patient sample 
in one analysis. If a patient has a sample that will be 
analyzed once in a trio and once on its own, then two rows 
are needed. Columns where information is required is marked 
with an asterisk (\*). Below are details about filling out 
each column. 

**Analysis ID**\*: This is an ID used to indicate which specimens
need to be analyzed together. If a trio analysis is going
to be performed on proband, mother, and father samples,
then all 3 of the corresponding rows must have the same 
analysis ID. If the proband sample also needs to be analyzed
on its own, or with the mother's sample only, or with an 
additional sibling, this analysis needs a new analysis ID 
that distinguishes it from the first trio analysis.

**Unique Analysis ID**\*: This ID will be used to track
results of an analysis for one particular specimen. This
needs to be unique across all rows.

**Family ID**: This is an ID that refers to the family being 
analyzed. This is not required, but may be useful to track 
the case on the CGAP portal. 

**Individual ID**\*: This is an ID for the individual who the 
sample was collected from. Make sure this does not include 
any personal identifying information such as MRN.

**Sex**\*: The sex of the individual the sample was collected 
from.

- Valid options include: **male**, **female**, **unknown**,
 **M**, **F**, **U**.


**Age**: The numerical age of the individual. Units for the age 
can be provided in the subsequent Age Units column. Must be 
an integer.

**Age Units**: Should be provided whenever age is present.
The units for the age. If age isn't provided, 
this should be left blank.

- Valid options include: **year**, **month**, **day**.
 Do not pluralize the units.

**Birth Year**: The year the individual was born. Must be in 
format YYYY.

**Relation to Proband**\*: If the individual is the 
proband/affected for the analysis, enter Proband. Otherwise,
enter the individual's relation to the proband.

- Valid options include: **proband**, **mother**, **father**,
 **sibling**.
- If the individual is a sibling, a numerical identifier can
 be appended if necessary (e.g., 'sibling 1'). Currently
 half-siblings and other relations aren't supported by our
 submission software; if you need to submit these, please
 contact us directly.

**Specimen Type**\*: The type of specimen.

- Recommended options include: **peripheral blood**, **cord blood**,
 **plasma**, **saliva**.

**Specimen ID**\*: An ID for the specimen that was collected for
 sequencing.

**Report Required**\*: Whether a report needs to be generated for
this sample in this analysis after variant interpretation 
is finalized. Commonly a report is required for the 
proband/affected only, but reports can also be generated for
other samples in the analysis if necessary.

- Valid options include: **yes**, **Y**, **no**, **N**

**Test Requested**\*: The type of test or sequencing that was 
ordered for the sample.

- Valid options include: **WGS**, **WES**.

**Specimen Collection Date**: The date the specimen was 
collected from the individual. Format should be YYYY-MM-DD.

**Sequencing Date**: The date the sample from the individual was
 sequenced. Format should be YYYY-MM-DD.

**Files**: Comma-separated file names to upload for the *sample*.
While full file paths are accepted, best practice is to submit
only the file name and to provide the path during upload if needed.
If the files are FASTQs, the following requirements apply:

- FASTQs must be paired-end reads
- File names must indicate paired-end status. Accepted file
 names must contain one of the following sub-strings:

    - *\_R1\_* or *\_R1.* (forward reads)

        - Examples: samplename\_S1\_L001*\_R1\_*001.fastq.gz, samplename*\_R1.*fastq.gz

    - *\_R2\_* or *\_R2.* (reverse reads)

        - Examples: samplename\_S1\_L001*\_R2\_*001.fastq.gz, samplename*\_R2.*fastq.gz

- Paired files must be submitted during the same submission and
 have identical file names other than the paired-end indicator

    - Examples: samplename\_R1.fastq.gz, samplename\_R2.fastq.gz

**Case Files**: Comma-separated file names to upload for the *case*.
These files should contain data related to all individuals/samples
included in the analysis, e.g. a joint called VCF.
As above, file names are recommended over full paths.

**Genome Build**: The genome build applicable to all submitted files
present under the **Files** and **Case Files** headers for the submission.

- Valid options include: **hg19**, **GRCh37**, **GRCh38**.
- Since the value applies to all submitted files, please submit
multiple times as required to match the genome build to the
corresponding file names. For example, if submitting both FASTQ
and VCF files, fill in the FASTQ file names and submit with
an empty **Genome Build** header, then remove those names, add
the VCF file names, provide a genome build, and submit again.

**BAM Sample ID**: The sample identifier used in the submitted file(s).
Must be provided if submitting BAM or VCF files; optional otherwise.

The above columns constitute the metadata required for the 
CGAP portal to perform the analysis, as well as a few 
additional columns that will show up on the Case View user 
interface when filled out.
