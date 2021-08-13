## Submission Methods
Gene lists can be submitted directly on the CGAP
website or with command line tools. 

For the web interface, click on the ["Submit New 
Gene List(s)"](/search/?type=IngestionSubmission&currentAction=add&submissionType=GeneList)
 button on the home page once logged in. 

For the command line, submission is accomplished 
with the SubmitCGAP package, which can be found 
[here](https://github.com/dbmi-bgm/SubmitCGAP)
along with documentation on system requirements
and appropriate commands. 
 

## File Formats
Gene lists can be uploaded as either text (.txt)
or Excel (.xlsx) files and must match an expected 
formatting style. 

For example, to create a gene list titled
"Cardiomyopathy" that contains the genes MYH7 
and MYL2, a text submission would simply include:  
<br>

```
Title: Cardiomyopathy  
MYH7  
MYL2
```

A formatted Excel file that submits the same
gene list can be downloaded 
[here](https://raw.githubusercontent.com/dbmi-bgm/cgap-portal/master/docs/public/help/help_linked_docs/genelist_template.xlsx)
. 
Simply replace the title and genes with your own
and save the file with a new name to create your
Excel submission. 

## Gene List Contents 
Though there are multiple options for submitting a gene 
list to CGAP, each submission 
consists of only two items: a title and a list 
of genes.

#### Title 
The title supplied will match exactly the title of the gene 
list as it will appear in CGAP. However, a few characters 
(&='+!?%/) are not permitted and will be automatically 
removed if present.

The length of the gene list will be automatically added to 
the end of the title to create the final title as viewed on 
CGAP and should not be provided; e.g. submitting a gene 
list with 10 genes and the title *Cardiomyopathy* will 
result in a final title of *Cardiomyopathy (10)*.

**Note**: Submitting a gene list with the same title as
an existing gene list associated with your
project will overwrite the contents of the existing
item. 

#### Genes

The provided genes must match genes currently in the 
CGAP database for a gene list to successfully upload.

Genes can be entered in several formats, including:
 
* Gene names/aliases
* Ensembl IDs 
* Entrez IDs
* OMIM IDs 
* Uniprot IDs

If a gene list fails to upload successfully because 
a gene name could not be matched, we recommend 
replacing the name with a unique identifier, such as
an Ensembl ID. 

**Note**: The CGAP database does not currently include
pseudogenes so such entries will not be matched. 

#### Cases (optional)

By default, if no case accession is provided for
a gene list, the gene list will be applied to all
cases in your project.
 
If you wish to associate a gene list with a subset
of the cases associated with your project, you can
include case accessions with your submission. To 
find a case accession, click on a case, navigate to
the "Details" tab, and click the "Accession" text
to copy the accession. 

For example, a gene list submission for cases
with accessions GAPCAFX11111 and GAPCAFX11112
would look like: 

<br>

```
Title: Cardiomyopathy  
Cases: GAPCAFX11111, GAPCAFX11112
MYH7  
MYL2
``` 

## Viewing or Editing a Gene List
Once a gene list is successfully uploaded, it can be 
found on CGAP at the provided link any time to inspect exactly which genes
are included. 

Additionally, the submitted document can be found as 
a link under the "Source File" heading within the 
gene list description. 
Clicking the link will bring 
you to a page from which the submitted document can
be downloaded. 
This facilitates updating of existing gene lists by
downloading the document, adding/removing genes as
desired, and then resubmitting the document. 
