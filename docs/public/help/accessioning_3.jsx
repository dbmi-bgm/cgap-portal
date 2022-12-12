<div>

    <p>There are two main options currently available for submission.</p>

    <ol>
        <li>Submit via Web UI</li>
        <li>
            Submit to CGAP yourself using a python package that
            can be invoked via a command line interface. This method is
            recommended if files for upload are stored locally on a
            computer
        </li>
    </ol>

    <h4>Option 1: Web UI submission</h4>

    <p>
        Go to the CGAP home page and make sure you are logged in.
        Then click on <a href="/search/?type=IngestionSubmission&currentAction=add">"Submit New Case(s)"</a>
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
    </p>

    <p>
        At this point, your data files (usually fastq) will still
        need to be transferred to us. Contact us at
        <a href="mailto:cgap-support@hms-dbmi.atlassian.net">cgap-support@hms-dbmi.atlassian.net</a>
        to coordinate file transfer.
    </p>

    <h4>Tutorial Video: Case Submission via CGAP Web UI</h4>

    <div style={{ maxWidth: "500px"}} className="w-100 d-flex align-items-center justify-items-center">
        <div>  
            <YoutubeVideoEmbed
                shouldAutoplay={false}
                videoID="dEiMlad4K2A"
                videoTitle="Case Submission via CGAP Web UI"
            />
        </div>
    </div>

    <h4>Option 2: Submission with the python package</h4>

    <p>
        We have developed a python package for submission of
        accessioning spreadsheets to the CGAP portal, called
        SubmitCGAP. The current version is still in beta. It can be
        installed by running <code>pip install submit-cgap</code>. We recommend
        doing this inside a virtual environment running python 3.7.
        Further instructions for submission with this method can be
        found in the <a href="https://submitcgap.readthedocs.io/en/latest/getting_started.html#family-history">SubmitCGAP documentation</a>.
        Briefly, the basic commands are as follows:
    </p>

    <pre className="mt-2"><code>submit-metadata-bundle &lt;cases.xlsx&gt; -s &lt;CGAP_server_url&gt; -v</code></pre>

    <p>
        The above command will do a validate-only dry run of your submission, to ensure that there
        are no formatting errors. Once this passes, the following command can be run to submit
        all the case metadata:
    </p>

    <pre className="mt-2"><code>submit-metadata-bundle &lt;cases.xlsx&gt; -s &lt;CGAP_server_url&gt;</code></pre>

    <p>
        For more information on the commands and their optional arguments, see the
        <a href="https://submitcgap.readthedocs.io/en/latest/index.html">documentation</a>.
    </p>

    <h4>Tutorial Video: Case Submission using the SubmitCGAP Python Package</h4>

    <div style={{ maxWidth: "500px"}} className="w-100 d-flex align-items-center justify-items-center">
        <div>  
            <YoutubeVideoEmbed
                shouldAutoplay={false}
                videoID="4Su3a7AE0HY"
                videoTitle="Case Submission via CLI"
                params="start=151"
            />
        </div>
    </div>
</div>