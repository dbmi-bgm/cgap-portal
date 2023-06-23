<div>
    <p>
        There are two main options currently available for submission.
    </p>

    <ol>
        <li>Submit via Web UI</li>
        <li>Submit to CGAP yourself using a python package that can be invoked via a command line interface.</li>
    </ol>

    <h4>Option 1: Web UI submission</h4>

    <p>
        Go to the CGAP home page and make sure you are logged in.
        Then click on <a href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Family+History">"Submit Family History"</a>. 
        If you are associated with more than one project or 
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
    </p>

    <h4>Tutorial Video: Family History Submission via CGAP Web UI</h4>

    <div className="w-100">
        <YoutubeVideoEmbed
            shouldAutoplay={false}
            videoID="dEiMlad4K2A"
            videoTitle="Case Submission via CGAP Web UI"
            params="start=151"
            posterSize="maxresdefault"
        />
    </div>

    <h4>Option 2: Submission with the python package</h4>

    <p>
        We have developed a python package for submission of
        various types of data to the CGAP portal, called
        SubmitCGAP. The current version is still in beta. It can be
        installed by running `pip install submit-cgap`. We
        recommend doing this inside a virtual environment running
        Python 3.7, 3.8 or 3.9. Further instructions for submission with this
        method can be found in the <a href="https://submitcgap.readthedocs.io/en/latest/getting_started.html#family-history">SubmitCGAP documentation</a>.
    </p>

    <p>
        Briefly, the command is the same as for new case/accessioning CLI submission, but
        with the added <code>-t</code> or <code>--ingestion_type</code> option:
    </p>

    <pre className="mt-2"><code>submit-metadata-bundle &lt;pedigree.xlsx&gt; -s &lt;CGAP_server_url&gt; -t family_history -v</code></pre>

    <p>
        As with submitting cases, the <code>-v</code> flag runs a validate-only dry run to check formatting of the spreadsheet.
        When that passes, the command can be run without that option:
    </p>

    <pre className="mt-2"><code>submit-metadata-bundle &lt;pedigree.xlsx&gt; -s &lt;CGAP_server_url&gt; -t family_history</code></pre>

    <h4>Tutorial Video: Family History Submission using the SubmitCGAP Python Package</h4>

    <div className="w-100">
        <YoutubeVideoEmbed
            shouldAutoplay={false}
            videoID="4Su3a7AE0HY"
            videoTitle="Case Submission via CLI"
            params="start=332"
            posterSize="maxresdefault"
        />
    </div>
</div>