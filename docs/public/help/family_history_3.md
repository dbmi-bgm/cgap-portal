There are two main options currently available for submission. 

1.	Submit via Web UI
2.	Submit to CGAP yourself using a python package that 
can be invoked via a command line interface. 

#### Option 1: Web UI submission

Go to the CGAP home page and make sure you are logged in. 
Then click on [\"Submit Family History\"](/search/?type=IngestionSubmission&currentAction=add&submissionType=Family+History)
. If you are associated with more than one project or 
institution, select the one the relevant case(s) are 
associated with from the dropdown menus, and upload the 
excel file. The server will then process the file and 
extract metadata to prepare the pedigree on CGAP, but 
you may need to wait ~30 seconds for this process to finish. 
If there are any errors in the formatting of the excel file,
 the server will report this back to you so that you can 
edit the file and resubmit. Upon successful submission, you 
will be directed to view the relevant case(s), in which you 
will now be able to see an interactive pedigree.

#### Option 2: Submission with the python package

We have developed a python package for submission of 
various types of data to the CGAP portal, called 
SubmitCGAP. The current version is still in beta. It can be
 installed by running `pip install submit-cgap`. We 
recommend doing this inside a virtual environment running 
python 3.6. Further instructions for submission with this 
method can be found [here](https://github.com/dbmi-bgm/SubmitCGAP/blob/master/README.rst). 
