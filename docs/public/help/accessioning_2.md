In the spreadsheet, each row represents one patient sample 
in one analysis. If a patient has a sample that will be 
analyzed once in a trio and once on its own, then two rows 
are needed. Columns where information is required is marked 
with an asterisk (\*). Below are details about filling out 
each column. 

**Unique Analysis ID**\*: This may sometimes also be referred to 
as Case ID, but this is an ID that will be used to track 
results of an analysis for one particular specimen. This 
needs to be unique across all rows.

**Analysis ID**\*: This is an ID used to indicate which specimens
 need to be analysed together. If a trio analysis is going 
to be performed on a proband, mother, and father samples, 
then all 3 of the corresponding rows must have the same 
analysis ID. If the proband sample also needs to be analyzed
 on its own, or with the mother's sample only, or with an 
additional sibling, this analysis needs a new analysis ID 
that distinguishes it from the first trio analysis. Note 
that in the example spreadsheet, row 2 has almost all the 
same information as row 5, but the analysis ID and unique 
analysis ID are different. This indicates that the proband's
 sample needs to be analysis as part of a quad analysis 
(analysis ID 1134-1) as well as alone on its own (analysis 
ID 1134-2).

**Family ID**: This is an ID that refers to the family being 
analyzed. This is not required, but may be useful to track 
the case on the CGAP portal. 

**Individual ID**\*: This is an ID for the individual who the 
sample was collected from. Make sure this does not include 
any personal identifying information such as MRN.

**Sex**\*: The sex of the individual the sample was collected 
from. Valid options include: male, female, unknown, M, F, U.

**Age**: The numerical age of the individual. Units for the age 
can be provided in the subsequent Age Units column. Must be 
an integer.

**Age Units**: Should be added whenever age is provided. The units for the age. If age isn't provided, 
this should be left blank. Valid options include: year, 
month, day. Do not pluralize the units.

**Birth Year**: The year the individual was born. Must be in 
format YYYY.

**Relation to Proband**\*: If the individual is the 
proband/affected for the analysis, enter Proband. Otherwise,
 enter the individual's relation to the proband. Valid 
options include: proband, mother, father, sibling. If the 
individual is a sibling, the value can be entered as sibling
 or full sibling, and a numerical identifier can be appended
 if necessary (e.g., 'sibling 1' or 'full sibling 2' are 
also accepted). Currently half-siblings and other relations
 aren't supported by our submission software; if you need to
 be able to submit these, please contact us directly.

**Specimen Type**\*: The type of specimen. Expected values 
include: peripheral blood, cord blood, plasma, saliva. If 
the specimen type is none of these, a different value can 
also be accepted.

**Specimen ID**\*: An ID for the specimen that was collected for
 sequencing.

**Report Required**\*: Whether a report needs to be generated for
 this sample in this analysis after variant interpretation 
is finalized. Commonly a report is required for the 
proband/affected only, but reports can also be generated for
 other samples in the analysis if necessary. Accepted values
 include: yes, no, Y, N.

**Test Requested**\*: The type of test or sequencing that was 
ordered for the sample. Accepted values include: WGS, WES.

**Specimen Collection Date**: The date the specimen was 
collected from the individual. Format should be YYYY-MM-DD.

**Sequencing Date**: The date the sample from the individual was
 sequenced. Format should be YYYY-MM-DD.

**Files**: The raw fastq files that were produced by the 
sequencing and need to be analyzed in this analysis, 
comma-separated. .cram files can also be accepted. For best 
results, use the full path to the file. 

The above columns constitute the metadata required for the 
CGAP portal to perform the analysis, as well as a few 
additional columns that will show up on the Case View user 
interface when filled out.
