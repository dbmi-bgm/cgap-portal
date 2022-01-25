There are two main options currently available for
submission.

1.	Submit via Web UI
2.	Submit to CGAP yourself using a python package that
 can be invoked via a command line interface. This method is
 recommended if files for upload are stored locally on a
 computer

#### Option 1: Web UI submission

Go to the CGAP home page and make sure you are logged in.
 Then click on [\"Submit New Case(s)\"](/search/?type=IngestionSubmission&currentAction=add)
. If you are associated with more than one project or
 institution, select the one you want the case(s) to be
 associated with from the dropdown menus, and upload the
 excel file. The server will then process the file and
 extract metadata to prepare your new case(s) on CGAP, but
 you may need to wait ~30 seconds for this process to finish.
 If there are any errors in the formatting of the excel file,
 the server will report this back to you so that you can
 edit the file and resubmit. Upon successful submission, you
 will be directed to view your new case(s).

At this point, your data files (usually fastq) will still
 need to be transferred to us. Contact us at
 [cgap-support@hms-dbmi.atlassian.net](mailto:cgap-support@hms-dbmi.atlassian.net)
 to coordinate file transfer.

#### Option 2: Submission with the python package

We have developed a python package for submission of
 accessioning spreadsheets to the CGAP portal, called
 SubmitCGAP. The current version is still in beta. It can be
 installed by running `pip install submit-cgap`. We recommend
 doing this inside a virtual environment running python 3.6.
 Further instructions for submission with this method can be
 found in the [SubmitCGAP documentation](https://submitcgap.readthedocs.io/en/latest/index.html).
 Briefly, the basic commands are as follows:

```
submit-metadata-bundle <cases.xlsx> -s <CGAP_server_url> -v
```

The above command will do a validate-only dry run of your submission, to ensure that there
 are no formatting errors. Once this passes, the following command can be run to submit
 all the case metadata:

```
submit-metadata-bundle <cases.xlsx> -s <CGAP_server_url>
```

For more information on the commands and their optional arguments, see the
 [documentation](https://submitcgap.readthedocs.io/en/latest/index.html).
