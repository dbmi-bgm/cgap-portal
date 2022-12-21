<div>
    <p>
        In the spreadsheet, each row represents one patient sample
        in one analysis. If a patient has a sample that will be
        analyzed once in a trio and once on its own, then two rows
        are needed. Columns where information is required is marked
        with an asterisk (*). Below are details about filling out
        each column.
    </p>

    <p>
        <strong>Analysis ID</strong>*: This is an ID used to indicate which specimens
        need to be analyzed together. If a trio analysis is going
        to be performed on proband, mother, and father samples,
        then all 3 of the corresponding rows must have the same
        analysis ID. If the proband sample also needs to be analyzed
        on its own, or with the mother&apos;s sample only, or with an
        additional sibling, this analysis needs a new analysis ID
        that distinguishes it from the first trio analysis.
    </p>

    <p>
        <strong>Unique Analysis ID</strong>*: This ID will be used to track
        results of an analysis for one particular specimen. This
        needs to be unique across all rows.
    </p>

    <p>
        <strong>Family ID</strong>: This is an ID that refers to the family being
        analyzed. This is not required, but may be useful to track
        the case on the CGAP portal.
    </p>

    <p>
        <strong>Individual ID</strong>*: This is an ID for the individual who the
        sample was collected from. Make sure this does not include
        any personal identifying information such as MRN.
    </p>

    <p>
        <strong>Sex</strong>*: The sex of the individual the sample was collected from.
    </p>

    <ul>
        <li>
            Valid options include: <strong>male, female, unknown, M, F, U</strong>.
        </li>
    </ul>

    <p>
        <strong>Age</strong>: The numerical age of the individual. Units for the age
        can be provided in the subsequent Age Units column. Must be
        an integer.
    </p>

    <p>
        <strong>Age Units</strong>: Should be provided whenever age is present.
        The units for the age. If age isn&apos;t provided,
        this should be left blank.
    </p>

    <ul>
        <li> Valid options include: <strong>year, month, day</strong>.
            Do not pluralize the units.
        </li>
    </ul>

    <p>
        <strong>Birth Year</strong>: The year the individual was born. Must be in
        format YYYY.
    </p>

    <p>
        <strong>Relation to Proband</strong>*: If the individual is the
        proband/affected for the analysis, enter Proband. Otherwise,
        enter the individual&apos;s relation to the proband.
    </p>

    <ul>
        <li> Valid options include: <strong>proband, mother, father,
            sibling</strong>.
        </li>
        <li>If the individual is a sibling, a numerical identifier can
            be appended if necessary (e.g., &apos;sibling 1&apos;).
        </li>
        <li>Currently half-siblings and other relations aren&apos;t supported by our
            submission software; if you need to submit these, please
            contact us directly.
        </li>
    </ul>

    <p>
        <strong>Specimen Type</strong>*: The type of specimen.
    </p>

    <ul>
        <li>
            Recommended options include: <strong>peripheral blood, cord blood, plasma, saliva</strong>.
        </li>
    </ul>

    <p>
        <strong>Specimen ID</strong>*: An ID for the specimen that was collected for
        sequencing.
    </p>

    <p>
        <strong>Report Required</strong>*: Whether a report needs to be generated for
        this sample in this analysis after variant interpretation
        is finalized. Commonly a report is required for the
        proband/affected only, but reports can also be generated for
        other samples in the analysis if necessary.
    </p>

    <ul>
        <li> Valid options include: <strong>yes, Y, no, N</strong></li>
    </ul>

    <p>
        <strong>Test Requested</strong>*: The type of test or sequencing that was
        ordered for the sample.
    </p>

    <ul>
        <li>Valid options include: <strong>WGS, WES</strong>.</li>
    </ul>

    <p>
        <strong>Specimen Collection Date</strong>: The date the specimen was
        collected from the individual. Format should be YYYY-MM-DD.
    </p>

    <p>
        <strong>Sequencing Date</strong>: The date the sample from the individual was
        sequenced. Format should be YYYY-MM-DD.
    </p>

    <p>
        <strong>Tags</strong>: Comma-separated tags to apply to the sample.
    </p>

    <p>
        <strong>Files</strong>: Comma-separated file names to upload for the <i>sample</i>.
        These files should contain data related only to one individual in
        the case, e.g. FASTQs, BAMs, or CRAMs.
        While full file paths are accepted, best practice is to submit
        only the file name and to provide the path during upload if needed.
        If the files are FASTQs, the following requirements apply:
    </p>

    <ul>
        <li> FASTQs must be paired-end reads </li>
        <li>File names must indicate paired-end status. Accepted file
            names must contain one of the following sub-strings:
        </li>
        <ul>
            <li><i>_R1_</i> or <i>_R1.</i> (forward reads) </li>

            <ul>
                <li>Examples: samplename_S1_L001<i>_R1_</i>001.fastq.gz, samplename<i>_R1.</i>fastq.gz </li>
            </ul>

        </ul>
        <ul>
            <li><i>_R2_</i> or <i>_R2.</i> (reverse reads)</li>
            <ul>
                <ul>
                    <li>Examples: samplename_S1_L001<i>_R2_</i>001.fastq.gz, samplename<i>_R2.</i>fastq.gz</li>
                </ul>
            </ul>
        </ul>

        <li>Paired files must be submitted during the same submission and
            have identical file names other than the paired-end indicator
        </li>
        <ul>
            <li>Examples: samplename_R1.fastq.gz, samplename_R2.fastq.gz</li>
        </ul>
    </ul>

    <p>
        <strong>Case Files</strong>: Comma-separated file names to upload for the <i>case</i>.
        These files should contain data related to all individuals/samples
        included in the analysis, e.g. a joint called VCF.
        As above, file names are recommended over full paths.
    </p>

    <p>
        <strong>Genome Build</strong>: The genome build applicable to all submitted files
        present under the <strong>Files</strong> and <strong>Case Files</strong> headers for the submission.
    </p>

    <ul>
        <li>
            Valid options include: <strong>hg19, GRCh37, GRCh38</strong>.
        </li>
        <li>
            Since the value applies to all submitted files, please submit
            multiple times as required to match the genome build to the
            corresponding file names. For example, if submitting both FASTQ
            and VCF files, fill in the FASTQ file names and submit with
            an empty <strong>Genome Build</strong> header, then remove those names, add
            the VCF file names, provide a genome build, and submit again.
        </li>
    </ul>

    <p>
        <strong>Variant Type</strong>:The variant type applicable to all submitted
        files present under the <strong>Files</strong> and <strong>Case Files</strong>
        headers for the submission. Optional, but should be provided for all VCF file
        submissions.
    </p>

    <ul>
        <li>
            Valid options include: <strong>SNV, SV, CNV</strong>.
        </li>
    </ul>

    <p>
        <strong>BAM Sample ID</strong>: The sample identifier used in the submitted file(s).
        Must be provided if submitting BAM or VCF files; optional otherwise.
    </p>

    <p>
        The above columns constitute the metadata required for the
        CGAP portal to perform the analysis, as well as a few
        additional columns that will show up on the Case View user
        interface when filled out.
    </p>

    <h4>Tutorial Video: Filling the Spreadsheet</h4>

    
    <div className="w-100">  
        <YoutubeVideoEmbed
            shouldAutoplay={false}
            videoID="2VbYXQmS66s"
            videoTitle="Submitting Case Spreadsheets Youtube Video"
            posterSize="maxresdefault"
        />
    </div>
</div>
