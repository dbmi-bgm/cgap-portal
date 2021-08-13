The family history is designed to be submitted after Case upload,
though it is also possible to do before. Ensure that all 
Individual and Family identifiers in this spreadsheet match 
what was uploaded for the relevant Case(s).

The format of the spreadsheet is similar to a .ped file, 
where each row represents an individual in the family. It is
possible to represent multiple families in one file, but for
the sake of simplicity we recommend one file per family. 

#### Required Columns

**Family ID**: The identifier for the family. Must match 
what was uploaded for the Case(s).

**Individual ID**: The identifier for the individual. Must 
match what was uploaded for the Case(s), if the individual 
is part of the Case.

**Sex**: The sex of the individual. Possible values are: 
M or Male; F or Female; or U or Unknown.

**Mother ID**: The individual identifier for the current 
individual's mother. If the mother had a sample accessioned 
as part of the case, the identifier must match what was 
uploaded there. Can be left blank in a particular row if the
 individual's mother is not part of the pedigree, but must 
be specified if the mother is part of the pedigree, and the
column must be present in the spreadsheet.

**Father ID**: The individual identifier for the current 
individual's father. If the father had a sample accessioned 
as part of the case, the identifier must match what was 
uploaded there. Can be left blank in a particular row if the
 individual's father is not part of the pedigree, but must 
be specified if the father is part of the pedigree, and the
column must be present in the spreadsheet.

**Proband**: Whether this individual is the proband for 
the family or not. Possible values include Y or N. Please 
only indicate one proband for each family. If multiple cases
 for the family were submitted with different probands, for 
example if the family has two affected siblings that each 
need a report, please select one of them as the proband with
 Y and indicate N for the other. This won't change any 
metadata about the cases.

#### Optional Columns

**HPO Terms**: Human Phenotype Ontology (HPO) Terms for the 
individual's phenotypes. The HPO Term IDs are preferred 
(e.g. HP:0004330).

**MONDO Terms**: Monarch Disease Ontology (MONDO) Terms for 
disorders that the individual is diagnosed with. MONDO Term
 IDs are preferred (e.g. MONDO:0004330). 

**Age**: The age of the individual. Must be a number. By 
default refers to years, but when an age in weeks or months 
is desired, the Age Units column can also be filled out.

**Age Units**: Only fill out if Age is present in the row. 
Must be singular. Possible values are day, week, month, year.

**Clinic Notes**: Any additional notes to be associated with
 the individual.

**Ancestry**: The ancestry of the individual. Can be a 
country (e.g. Denmark) or an ethnicity (e.g. African-American). 
If multiple values need to be specified, they can be done so
 in a comma-separated list (e.g. *African-American, Irish*).

**Life Status**: Possible values are: alive and well, alive, 
deceased, or unknown.

**Deceased**: Can be used to indicate if individual is 
deceased. Possible values: Y or N.

**Cause of Death**: If the individual is deceased, an HPO 
term indicating the cause of death can be added here. As 
with the "HPO Terms" field described above, this should be 
an HPO Term ID (e.g. HP:0001546).

**Age at Death**: Must be a number. If the age is meant to 
be in weeks or months, the Age at Death Units column must 
also be filled.

**Age at Death units**: Only add a value if Age at Death is 
filled for this row. Possible values are: week, month, year.
Must be singular.

**Pregnancy**: Whether the individual indicated is a 
pregnancy. Possible values: Y or N.

**Gestational Age**: If the individual is a pregnancy, the 
gestational age of the individual in weeks. Must be a number.

**Termination of Pregnancy**: Used to indicate if the 
individual was a terminated pregnancy. Possible values are 
Y or N.

**Stillbirth**: Used to indicate if the individual was a 
stillbirth. Possible values are Y or N.

**Spontaneous Abortion**: Used to indicate if the individual
 was a spontaneous abortion. Possible values are Y or N.

**Infertile**: Used to indicate if the individual is 
infertile. Possible values are Y or N.

**Cause of Infertility**: If the individual is indicated as 
infertile, the cause of infertility can be indicated here. 
Note that an HPO term is NOT expected here, and plain text 
should be used.

**No Children by Choice**: Used to indicate if the individual
 has no children by their choice and is not suspected to be 
infertile. Possible values are Y or N.
