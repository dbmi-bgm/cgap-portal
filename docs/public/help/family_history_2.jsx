<div>
    <p>
        The family history is designed to be submitted after Case upload,
        though it is also possible to do before. Ensure that all 
        Individual and Family identifiers in this spreadsheet match 
        what was uploaded for the relevant Case(s).
    </p>

    <p>
        The format of the spreadsheet is similar to a .ped file, 
        where each row represents an individual in the family. It is
        possible to represent multiple families in one file, but for
        the sake of simplicity we recommend one file per family. 
    </p>

    <h4>Required Columns</h4>

    <p>
        <strong>Family ID</strong>: The identifier for the family. Must match 
        what was uploaded for the Case(s).
    </p>

    <p>
        <strong>Individual ID</strong>: The identifier for the individual. Must 
        match what was uploaded for the Case(s), if the individual 
        is part of the Case.
    </p>

    <p>
        <strong>Sex</strong>: The sex of the individual. Possible values are: 
        M or Male; F or Female; or U or Unknown.
    </p>

    <p>
        <strong>Mother ID</strong>: The individual identifier for the current 
        individual's mother. If the mother had a sample accessioned 
        as part of the case, the identifier must match what was 
        uploaded there. Can be left blank in a particular row if the
        individual's mother is not part of the pedigree, but must 
        be specified if the mother is part of the pedigree, and the
        column must be present in the spreadsheet.
    </p>

    <p>
        <strong>Father ID</strong>: The individual identifier for the current 
        individual's father. If the father had a sample accessioned 
        as part of the case, the identifier must match what was 
        uploaded there. Can be left blank in a particular row if the
        individual's father is not part of the pedigree, but must 
        be specified if the father is part of the pedigree, and the
        column must be present in the spreadsheet.
    </p>

    <p>
        <strong>Proband</strong>: Whether this individual is the proband for 
        the family or not. Possible values include Y or N. Please 
        only indicate one proband for each family. If multiple cases
        for the family were submitted with different probands, for 
        example if the family has two affected siblings that each 
        need a report, please select one of them as the proband with
        Y and indicate N for the other. This won't change any 
        metadata about the cases.
    </p>

    <h4>Optional Columns</h4>

    <p>
        <strong>HPO Terms</strong>: Human Phenotype Ontology (HPO) Terms for the
        individual's phenotypes. The HPO Term IDs are preferred
        (e.g. HP:0004330).
    </p>

    <p>
        <strong>MONDO Terms</strong>: Monarch Disease Ontology (MONDO) Terms for
        disorders that the individual is diagnosed with. MONDO Term
        IDs are preferred (e.g. MONDO:0004330). If the individual
        is part of a cohort, see Primary Diagnosis below.
    </p>

    <p>
        <strong>Age</strong>: The age of the individual. Must be a number. By
        default refers to years, but when an age in weeks or months
        is desired, the Age Units column can also be filled out.
    </p>

    <p>
        <strong>Age Units</strong>: Only fill out if Age is present in the row.
        Must be singular. Possible values are day, week, month, year.
    </p>

    <p>
        <strong>Birth Year</strong>: The year the individual was born. Must be
        in format YYYY.
    </p>

    <p>
        <strong>Clinic Notes</strong>: Any additional notes to be associated with
        the individual.
    </p>

    <p>
        <strong>Ancestry</strong>: The ancestry of the individual. Can be a
        country (e.g. Denmark) or an ethnicity (e.g. African-American).
        If multiple values need to be specified, they can be done so
        in a comma-separated list (e.g. <i>African-American, Irish</i>).
    </p>

    <p>
        <strong>Primary Diagnosis</strong>: MONDO term for the primary disorder of
        interest for the individual (must be singular MONDO term).
        Particularly relevant for individuals within larger cohorts.
        Diagnosis Age of Onset, Diagnosis Age of Onset Units, and
        Diagnostic Confidence below are all additional information
        that can be provided for this primary disease.
    </p>

    <p>
        <strong>Diagnosis Age of Onset</strong>: The age of onset for the disease
        in Primary Diagnosis. Must be a number. Defaults to years,
        but when an alternative unit is desired, the Diagnosis
        Age of Onset Units column can be filled out. If no Primary
        Diagnosis given, value is ignored.
    </p>

    <p>
        <strong>Diagnosis Age of Onset Units</strong>: Only fill out if Diagnosis
        Age of Onset present in the row. Possible values are day,
        week, month, and year. If no Primary Diagnosis or Diagnosis
        Age of Onset, value is ignored.
    </p>

    <p>
        <strong>Diagnostic Confidence</strong>: The confidence with which the
        Primary Diagnosis is reported. Possible values are patient reported, possible,
        probable, and definite. If no Primary Diagnosis given, value is
        ignored.
    </p>

    <p>
        <strong>Life Status</strong>: Possible values are: alive and well, alive,
        deceased, or unknown.
    </p>

    <p>
        <strong>Deceased</strong>: Can be used to indicate if individual is
        deceased. Possible values: Y or N.
    </p>

    <p>
        <strong>Cause of Death</strong>: If the individual is deceased, an HPO
        term indicating the cause of death can be added here. As
        with the "HPO Terms" field described above, this should be
        an HPO Term ID (e.g. HP:0001546).
    </p>

    <p>
        <strong>Age at Death</strong>: Must be a number. If the age is meant to 
        be in weeks or months, the Age at Death Units column must 
        also be filled.
    </p>

    <p>
        <strong>Age at Death Units</strong>: Only add a value if Age at Death is 
        filled for this row. Possible values are: day, week, month, year.
        Must be singular.
    </p>

    <p>
        <strong>Pregnancy</strong>: Whether the individual indicated is a 
        pregnancy. Possible values: Y or N.
    </p>

    <p>
        <strong>Gestational Age</strong>: If the individual is a pregnancy, the 
        gestational age of the individual in weeks. Must be a number.
    </p>

    <p>
        <strong>Termination of Pregnancy</strong>: Used to indicate if the 
        individual was a terminated pregnancy. Possible values are Y or N.
    </p>

    <p>
        <strong>Stillbirth</strong>: Used to indicate if the individual was a 
        stillbirth. Possible values are Y or N.
    </p>

    <p>
        <strong>Spontaneous Abortion</strong>: Used to indicate if the individual 
        was a spontaneous abortion. Possible values are Y or N.
    </p>

    <p>
        <strong>Infertile</strong>: Used to indicate if the individual is 
        infertile. Possible values are Y or N.
    </p>

    <p>
        <strong>Cause of Infertility</strong>: If the individual is indicated as 
        infertile, the cause of infertility can be indicated here. 
        Note that an HPO term is NOT expected here, and plain text 
        should be used.
    </p>

    <p>
        <strong>No Children by Choice</strong>: Used to indicate if the individual 
        has no children by their choice and is not suspected to be 
        infertile. Possible values are Y or N.
    </p>

    <h4>Tutorial Video: Filling the Family History Spreadsheet</h4>

    <div className="w-100">
        <YoutubeVideoEmbed
            shouldAutoplay={false}
            videoID="2VbYXQmS66s"
            videoTitle="Submitting Case Spreadsheets"
            params="start=238"
            posterSize="maxresdefault"
        />
    </div>
</div>
