<div>
    <h2>Submission Methods</h2>

    <p>
        Gene lists can be submitted directly on the CGAP
        website or with command line tools.
    </p>

    <p>
        For the web interface, click on the <a href="/search/?type=IngestionSubmission&currentAction=add&submissionType=Gene%20List">&apos;Submit New 
        Gene List(s)&apos;</a> button on the home page once logged in.
    </p>

    <p>
        For the command line, submission is accomplished 
        with the SubmitCGAP package, which can be found 
        <a href="https://github.com/dbmi-bgm/SubmitCGAP">here</a>
        along with documentation on system requirements
        and appropriate commands.
    </p>

    <p>
        For a tutorial video on gene list creation and submission, refer to the last section on this page.
        All tutorial videos can be found on the <a href="https://www.youtube.com/@cgaptraining">CGAP Training Youtube channel</a>.
    </p>

    <h2>File Formats</h2>

    <p>
        Gene lists can be uploaded as either text (.txt)
        or Excel (.xlsx) files and must match an expected 
        formatting style.
    </p>

    <p>
        For example, to create a gene list titled
        &apos;Cardiomyopathy&apos; that contains the genes MYH7 
        and MYL2, a text submission would simply include: 
    </p>

    <pre><code>
    Title: Cardiomyopathy
    MYH7
    MYL2
    </code></pre>

    <p>
        A formatted Excel file that submits the same
        gene list can be downloaded 
        <a href="https://raw.githubusercontent.com/dbmi-bgm/cgap-portal/master/docs/public/help/help_linked_docs/genelist_template.xlsx">here</a>. 
        Simply replace the title and genes with your own
        and save the file with a new name to create your
        Excel submission.
    </p>

    <h2>Gene List Contents</h2>
    <p>
        Though there are multiple options for submitting a gene list to CGAP, 
        each submission consists of only two items: a title and a list of genes.
    </p>

    <h4>Title</h4>
    <p>
        The title supplied will match exactly the title of the gene 
        list as it will appear in CGAP. However, a few characters 
        (&amp;='+!?%/) are not permitted and will be automatically 
        removed if present.
    </p>

    <p>
        The length of the gene list will be automatically added to 
        the end of the title to create the final title as viewed on 
        CGAP and should not be provided; e.g. submitting a gene 
        list with 10 genes and the title <i>Cardiomyopathy</i> will 
        result in a final title of <i>Cardiomyopathy (10)</i>.
    </p>

    <p>
        <strong>Note</strong>: Submitting a gene list with the same title as
        an existing gene list associated with your
        project will overwrite the contents of the existing
        item.
    </p>

    <h4>Genes</h4>
    <p>
        The provided genes must match genes currently in the 
        CGAP database for a gene list to successfully upload.
    </p>

    <p>
        Genes can be entered in several formats, including:
    </p>

    <ul>
        <li>Gene names/aliases</li>
        <li>Ensembl IDs </li>
        <li>Entrez IDs</li>
        <li>OMIM IDs </li>
        <li>Uniprot IDs</li>
    </ul>

    <p>
        If a gene list fails to upload successfully because 
        a gene name could not be matched, we recommend 
        replacing the name with a unique identifier, such as
        an Ensembl ID.
    </p>

    <p>
        <strong>Note</strong>: The CGAP database does not currently include
        pseudogenes so such entries will not be matched.
    </p>

    <h4>Cases (optional)</h4>

    <p>
        By default, if no case accession is provided for
        a gene list, the gene list will be applied to all
        cases in your project.
    </p>

    <p>
        If you wish to associate a gene list with a subset
        of the cases associated with your project, you can
        include case accessions with your submission. To 
        find a case accession, click on a case, navigate to
        the &apos;Details&apos; tab, and click the &apos;Accession&apos; text
        to copy the accession.
    </p>

    <p>
        For example, a gene list submission for cases
        with accessions GAPCAFX11111 and GAPCAFX11112
        would look like:
    </p>

    <pre><code>
    Title: Cardiomyopathy
    Cases: GAPCAFX11111, GAPCAFX11112
    MYH7
    MYL2
    </code></pre>

    <h2>Viewing or Editing a Gene List</h2>
    <p>
        Once a gene list is successfully uploaded, it can be 
        found on CGAP at the provided link any time to inspect exactly which genes
        are included.
    </p>

    <p>
        Additionally, the submitted document can be found as 
        a link under the &apos;Source File&apos; heading within the 
        gene list description. 
        Clicking the link will bring 
        you to a page from which the submitted document can
        be downloaded. 
        This facilitates updating of existing gene lists by
        downloading the document, adding/removing genes as
        desired, and then resubmitting the document. 
    </p>

    <h2>Tutorial Video: Gene List Creation & Submission</h2>

    <div style={{ maxWidth: "500px"}} className="w-100 d-flex align-items-center justify-items-center">
        <div>
            <YoutubeVideoEmbed
                shouldAutoplay={false}
                videoID="TKAOlqrki4s"
                videoTitle="Submitting Gene Lists"
            />
        </div>
    </div>
</div>