'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { Schemas } from './../../util';


/** @param {Object} props - Contents of a family sub-embedded object. */
export const CohortSummaryTable = React.memo(function CohortSummaryTable(props){
    const {
        members = [],
        proband: { '@id' : probandID } = {},
        original_pedigree = null,
        idToGraphIdentifier = {},
        sampleProcessing = []
    } = props;

    if (members.length === 0){
        return (
            <div className="processing-summary">
                <em>No members available.</em>
            </div>
        );
    }

    const h2ColumnOrder = [
        "individual",
        "sample",
        "assayType",
        "rawFiles",
        "processingType",
        "processedFiles",
    ];

    const originalNumCols = h2ColumnOrder.length; // store # of columns before any multisample columns are added

    const columnTitles = {
        'sample' : (
            <React.Fragment>
                <i className="icon icon-fw icon-vial fas mr-05 align-middle"/>
                Sample
            </React.Fragment>
        ),
        'individual' : (
            <React.Fragment>
                <i className="icon icon-fw icon-user fas mr-05 align-middle"/>
                Individual
            </React.Fragment>
        ),
        'assayType' : "Assay Type",
        'rawFiles' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-code fas mr-05 align-middle"/>
                <span className="d-none d-lg-inline ml-05">Sequencing</span>
            </React.Fragment>
        ),
        'processingType' : "Processing Type",
        'processedFiles' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-medical-alt fas mr-05 align-middle"/>
                <span className="d-none d-lg-inline ml-05">Pipeline</span>
            </React.Fragment>
        ),
    };

    const sampleProcessingData = {}; // maps sample analysis UUIDs to sample IDs to file data Objects for MSAs and samples

    let hasMSA = false; // if there is at least one sample processing object to render (w/2 samples in family)
    let hasCombinedMSA = false; // if there is also a combined MSA (for rendering last row only when there's a combined VCF)
    // add multisample analysis column data to column order/titles and data object
    sampleProcessing.forEach((sp) => {
        const { uuid, processed_files = [], completed_processes = [] , sample_processed_files = [] } = sp;

        function pushColumn(title) {
            // adds a column to the end of the column order and to the column titles map
            // placed in a method for potential future use
            columnTitles[title] = title;
            h2ColumnOrder.push(title);
        }

        if (sample_processed_files.length > 0) {
            // add column titles with some embedded data for identifying column by UUID & rendering pipeline title
            pushColumn(`~MSA|${ completed_processes[0] }|${ uuid }`);

            sampleProcessingData[uuid] = {};
            sampleProcessingData[uuid]["MSA"] = generateFileRenderObject(processed_files); // populate with multisample analysis objects

            // populate with per sample data
            sample_processed_files.forEach((set) => {
                const { sample = {}, processed_files: procFiles = [] } = set;
                sampleProcessingData[uuid][sample.accession] = generateFileRenderObject(procFiles);
            });
            hasMSA = true;
        }

        if (processed_files.length > 0) {
            hasCombinedMSA = true;
        }

    });

    function hasMSAFlag(string) { // checks if a string starts with an MSA flag
        return string.substring(0,5) === "~MSA|";
    }

    function getUUIDFromMSATitle(string) {
        return string.split("|")[2];
    }

    const rows = [];
    const membersWithoutSamples = [];
    const membersWithoutViewPermissions = [];

    // counters for keeping track of groupings (for rendering samples from the same individual in the same color and ordering rows by individual)
    let individualGroup = 0;
    let sampleGroup = 0;

    function generateFileRenderObject(files) {
        const allFiles = {};

        files.forEach((file) => {
            const {
                display_title: filename,
                quality_metric = {},
                "@id": fileUrl
            } = file;

            const {
                overall_quality_status = "",
                qc_list = [],
                "@id": qmId,
                url: qmUrl = qmId || "",
            } = quality_metric;

            const extension = filename.substring(filename.indexOf('.')+1, filename.length) || filename; // assuming the display_title property remains the filename

            let fileOverallQuality = "PASS";
            let hasQm = true;
            let numFail = 0; // using these instead of quality value, since quality value can be extracted from numFail and numWarns (1 source of truth)
            let numWarn = 0;

            // figure out the file's overall quality status
            if (qc_list.length > 0) {
                // loop through all of the quality metrics and count the number of failures and warnings for this file
                qc_list.forEach((qm) => {
                    if (qm.value.overall_quality_status === "FAIL") {
                        numFail++;
                        fileOverallQuality = "FAIL";
                    } else if (qm.value.overall_quality_status === "WARN") {
                        numWarn++;
                        fileOverallQuality = (fileOverallQuality === "FAIL" ? "FAIL" : "WARN");
                    }
                });
            } else {
                if (!overall_quality_status) {
                    numFail = -1;
                    numWarn = -1;
                    hasQm = false;
                } else {
                    if (overall_quality_status === "FAIL") {
                        numFail++;
                    } else if (overall_quality_status === "WARN") {
                        numWarn++;
                    }
                }
                fileOverallQuality = overall_quality_status;
            }

            const fileObject = {
                numFail,
                numWarn,
                hasQm,
                fileUrl,
                qmUrl
            };

            function shouldUpdateOverallQuality(currOverall, newStatus) {
                const newFailing = newStatus === "FAIL";
                const newWarning = newStatus === "WARN";
                if (currOverall === "PASS" && newFailing ||
                    currOverall === "PASS" && newWarning ||
                    currOverall === "WARN" && newFailing
                ) {
                    return true;
                }
                return false;
            }

            // check to see if there's currently a property in allFiles with key
            if (allFiles.hasOwnProperty(extension)) {

                // check if should update overall Quality Status on update
                if (shouldUpdateOverallQuality(allFiles[extension].overall, fileOverallQuality)) {
                    // update accordingly
                    allFiles[extension].overall = fileOverallQuality;
                }

                // add new file object to files array
                allFiles[extension].files.push(fileObject);
            } else {
                // generate a new object in allFiles object;
                allFiles[extension] = {
                    overall: fileOverallQuality,
                    files: [fileObject]
                };
            }
        });

        return allFiles;
    }

    function convertFileObjectToJSX(fileObject, ext) {
        const renderArr = [];
        const { files, overall: overallQuality } = fileObject;

        if (files && files.length <= 1) {
            if (files.length <= 0) {
                return;
            }

            const tooltips = calcTooltips(files[0].hasQm, files[0].numWarn, files[0].numFail);

            // if there's a single quality metric, link the item itself
            renderArr.push(
                files[0] ?
                    <span className="ellipses" key={`span-${ext}`}>
                        { statusToIcon(overallQuality || "WARN") }
                        <a
                            href={files[0].fileUrl || ""}
                            rel="noopener noreferrer"
                            target="_blank"
                            data-tip={tooltips[0]}
                        >
                            { ext.toUpperCase() }
                        </a>
                        { files[0].hasQm ?
                            <a
                                href={files[0].qmUrl || ""}
                                rel="noopener noreferrer"
                                target="_blank"
                                className={`${statusToTextClass(overallQuality)} qc-status-${files[0].status}`}
                                data-tip={tooltips[1]}
                            >
                                <sup>QC</sup>
                            </a>
                            : null }
                    </span>
                    : null
            );
        } else if (files) { // otherwise create a list with linked #s
            renderArr.push(
                <span className="ellipses" key={`span-multi-${ext}`}>
                    { statusToIcon(overallQuality) } { ext.toUpperCase() }
                    (   {
                        files.map((file, i) => {
                            const tooltips = calcTooltips(file.hasQm, file.numWarn, file.numFail);

                            return (
                                <React.Fragment key={`${ext}-${file.fileUrl}`}>
                                    <a href={ file.fileUrl || "" } rel="noopener noreferrer" target="_blank"
                                        className={`${statusToTextClass(file.quality)}`} data-tip={tooltips[0]}>
                                        {i + 1}
                                    </a>
                                    { file.hasQm ?
                                        <a
                                            href={file.qmUrl || ""}
                                            rel="noopener noreferrer"
                                            target="_blank"
                                            className={`${statusToTextClass(
                                                getFileQuality(file.numFail, file.numWarn))} qc-status-${file.status}`}
                                            data-tip={tooltips[1]}
                                        >
                                            <sup>QC</sup>
                                        </a>
                                        : null }
                                    { // if the last item, don't add a comma
                                        (i === files.length - 1 ?  null : ', ')
                                    }
                                </React.Fragment>
                            );
                        })
                    }   )
                </span>
            );
        }
        return renderArr;
    }

    function statusToIcon(status){
        switch (status) {
            case "PASS":
                return <i className="icon icon-check fas text-success mr-05"/>;
            case "FAIL":
                return <i className="icon icon-times fas text-danger mr-05"/>;
            case "WARN":
                return <i className="icon icon-exclamation-triangle fas text-warning mr-05"/>;
            default:
                return null;
        }
    }

    /**
     * Helper f(x) for QM handling; takes in a QM status and returns a bootstrap text color class.
     */
    function statusToTextClass(status) {
        switch(status) {
            case "PASS":
                return "";
            case "FAIL":
                return "text-danger";
            case "WARN":
                return "text-warning";
            default:
                return null;
        }
    }

    /**
     * Helper f(x) for QM handling; takes in # of QM failues and warnings, returns a QM status string.
     */
    function getFileQuality(numFail, numWarn) {
        if (numFail) {
            return "FAIL";
        }
        if (numWarn) {
            return "WARN";
        }
        return "PASS";
    }

    /**
     * Generates a file-level and QC-level tooltip based on a file's QM stats.
     *
     * @param {boolean} hasQm   Is there at least 1 visible qualitymetric for the given file?
     * @param {number}  warns   Number of qualitymetrics with value "WARN"
     * @param {number}  fails   Number of qualitymetrics with value "FAIL"
     *
     * @return {array} Index [0] is the file level tooltip (only relevant if there is no QM), and index [1] is the QC level tooltip.
     */
    function calcTooltips(hasQm, warns, fails) {
        let qmExistsTip = "";
        let warnFailTip = "";

        if (!hasQm) {
            qmExistsTip += "This file has no quality metrics.";
        }
        if (warns > 0) {
            warnFailTip += `${warns} QM(s) with Warnings `;
        }
        if (fails > 0) {
            warnFailTip += `${fails} QM(s) with Failures `;
        }
        return [qmExistsTip || null, warnFailTip || null];
    }

    // Gather rows from family.members - 1 per sample (or individual, if no sample).
    // todo: consider moving this block to Cohort index; we're already doing a pass to figure out
    // how many individual have samples there... so it might make sense to move this
    members.forEach(function(individual){
        const {
            display_title: indvDisplayTitle = null,
            '@id' : indvId,
            error = null,
            samples = []
        } = individual;

        if (!indvDisplayTitle || !indvId){
            membersWithoutViewPermissions.push(individual);
            return;
        }

        if (samples.length === 0){
            membersWithoutSamples.push(individual);
            return;
        }

        const isProband = (probandID && probandID === indvId);
        const genID = idToGraphIdentifier[indvId];

        const indvLink = (
            <div className={`${genID ? "text-ellipsis-container" : ""}`}>
                { isProband ? <span className="font-weight-bold d-block">Proband</span> : null}
                { genID ? <span className="text-serif text-small gen-identifier d-block text-center">{ genID }</span>: null}
                <a href={indvId} className="accession d-block">{ indvDisplayTitle }</a>
            </div>);

        samples.forEach(function(sample, sampleIdx){
            const {
                '@id' : samplePath = "",
                display_title: sampleTitle,
                error: sampleErr = null,
                files = [],
                processed_files = [],
                completed_processes = [],
                specimen_type = null,
                specimen_collection_date = null,
                specimen_notes = null,
                workup_type : assayType
            } = sample;

            const [ , , sampleID ] = samplePath.split("/"); // linter complained about arr destructuring... ¯\_(ツ)_/¯

            if (!sampleTitle || !samplePath){
                rows.push({
                    individual : indvLink,
                    isProband,
                    sample : <em>{ sampleErr || "No view permissions" }</em>,
                    sampleIdx
                });
                return;
            } else {
                const procFilesWPermissions = processed_files.filter(function(file){
                    return file['@id'] && file.display_title;
                });
                const rawFilesWPermissions = files.filter(function(file){
                    return file['@id'] && file.display_title;
                });

                rows.push({
                    individual : indvLink,
                    isProband,
                    sample: (
                        <React.Fragment>
                            <span className="d-block">
                                { specimen_type }
                                { specimen_notes ? <span className="text-primary" data-tip={ specimen_notes }>*</span>: "" }
                            </span>
                            { specimen_collection_date ? <span data-tip="specimen collection date"><i className="mr-03 icon icon-fw icon-syringe fas text-primary"/>{ specimen_collection_date }</span>: null}
                            <a href={samplePath} className="accession d-block">{ sampleTitle }</a>
                        </React.Fragment>
                    ),
                    individualGroup,
                    sampleId: sampleID,
                    sampleGroup,
                    processedFiles: generateFileRenderObject(procFilesWPermissions),
                    rawFiles: generateFileRenderObject(rawFilesWPermissions),
                    sampleIdx,
                    sampleInfo: (
                        sampleInfo ?
                            <React.Fragment>{sampleInfo} { specimen_notes ?
                                <span className="text-primary" data-tip={ specimen_notes }>* </span>
                                : "" }
                            </React.Fragment> : null
                    ),
                    sampleStatus: (
                        <span>
                            <i className="item-status-indicator-dot mr-05" data-status={sampleStatus}/>
                            { Schemas.Term.toName("status", sampleStatus) }
                        </span>
                    ),
                    visitInfo: (
                        specimen_collection_date ? <span>{ specimen_collection_date }</span>: null
                    ),
                    processingType: completed_processes[0] || null,
                    assayType
                });
            }
            sampleGroup++;
        });
        individualGroup++;
    });

    const membersWithoutSamplesLen = membersWithoutSamples.length;
    const membersWithoutViewPermissionsLen = membersWithoutViewPermissions.length;

    const renderedSummary = (membersWithoutSamplesLen + membersWithoutViewPermissionsLen) > 0 ? (
        <div className="processing-summary">
            { membersWithoutSamplesLen > 0 ?
                <p className="mb-0">
                    <span className="text-600">{ membersWithoutSamplesLen }</span> members without samples.
                </p>
                /*
                <React.Fragment>
                    <p className="mb-0">{ (membersWithoutSamplesLen + " members without samples: ") }</p>
                    {
                        membersWithoutSamples.map(function(member, idx){
                            const { '@id' : id, display_title } = member;
                            return (
                                <React.Fragment key={id}>
                                    { idx !== 0 ? ", " : null }
                                    <a href={id}>{ display_title }</a>
                                </React.Fragment>
                            );
                        })
                    }
                </React.Fragment>
                */
                : null }
            { membersWithoutViewPermissionsLen > 0 ?
                <p className="mb-0">
                    <span className="text-600">{ membersWithoutViewPermissionsLen }</span> members without view permissions.
                </p>
                : null }
        </div>
    ) : null;

    if (rows.length === 0){
        return renderedSummary;
    }

    const sortedRows = _(rows).chain().sortBy(function(row) {
        return row.sampleGroup;
    }).sortBy(function(row) {
        return row.individualGroup;
    }).reverse().sortBy(function(row) {
        return row.isProband;
    }).value().reverse();

    let isEven = false; // Toggle on individual change
    let currIndvGroup = null; // Individual Group #
    const renderedRows = sortedRows.map(function(row, rowIdx) {

        const { isProband = false, sampleIdx, sampleId } = row;
        const rowCols = h2ColumnOrder.map(function(colName) {

            let colVal = row[colName] || " - ";

            if (colName === "processedFiles" || colName === "rawFiles"){
                const fileData = row[colName];
                const extensions = Object.keys(fileData);
                let renderArr = [];

                extensions.forEach((ext) => {
                    const jsx = convertFileObjectToJSX(fileData[ext], ext);
                    renderArr = renderArr.concat(jsx); // add to render Arr (matey)
                });

                colVal = (
                    <div className="qcs-container text-ellipsis-container">
                        { renderArr }
                    </div>
                );
            } else if (hasMSAFlag(colName)) { // if a multisample analysis object
                const [,, uuid] = colName.split("|");
                const allFileObjects = sampleProcessingData[uuid][sampleId] || {};
                const extensions = Object.keys(allFileObjects);

                let renderArr = [];
                extensions.forEach((ext) => {
                    // generate new jsx
                    const jsx = convertFileObjectToJSX(allFileObjects[ext], ext);
                    renderArr = renderArr.concat(jsx); // add to render Arr (matey)
                });

                colVal = (
                    <div className="qcs-container text-ellipsis-container">
                        { renderArr.length > 0 ? renderArr : '-' }
                    </div>
                );
            }

            return (
                <td key={colName} data-for-column={colName}
                    className={typeof row[colName] !== 'undefined' ? "has-value" : null}>
                    { colVal }
                </td>
            );
        });

        // color code non-proband rows in alternating bands based on individual group
        if (currIndvGroup !== row.individualGroup) {
            currIndvGroup = row.individualGroup;
            isEven = !isEven;
        }

        const rowCls = (
            "sample-row" +
            (isProband ? " is-proband" :  (isEven ? " is-even" : ""))
        );

        return <tr key={rowIdx} className={rowCls} data-sample-index={sampleIdx}>{ rowCols }</tr>;
    });

    const finalRow = hasMSA ? (
        <tr>
            {
                h2ColumnOrder.map((colName) => {
                    let colVal;
                    const hasValue = hasMSAFlag(colName);
                    if (hasMSAFlag(colName)) {
                        const fileObjects = sampleProcessingData[getUUIDFromMSATitle(colName)].MSA || {};
                        const extensions = Object.keys(fileObjects);

                        let renderArr = [];
                        extensions.forEach((ext) => {
                            // generate new jsx
                            const jsx = convertFileObjectToJSX(fileObjects[ext], ext);
                            renderArr = renderArr.concat(jsx); // add to render Array
                        });

                        colVal = (
                            <div className="qcs-container text-ellipsis-container">
                                { renderArr.length > 0 ? renderArr : '-' }
                            </div>
                        );
                    } else {
                        colVal = null;
                    }
                    return (
                        <td key={colName} data-for-column={colName}
                            className={ hasValue ? "has-value" : null}>
                            { colVal }
                        </td>
                    );
                })
            }
        </tr>) : null ;

    const renderedTable = (
        <div className="processing-summary-table-container">
            <table className="processing-summary-table">
                <thead>
                    { hasMSA ?
                        <tr>
                            { // note: currently assumes that any cols after the initial 8 set in ColumnTitles are MSAs
                                <React.Fragment>
                                    <th colSpan={originalNumCols} className="hidden-th"/>
                                    <th colSpan={ Object.keys(columnTitles).length - originalNumCols }>Multi Sample Analysis</th>
                                </React.Fragment>}
                        </tr> : null}
                    <tr>
                        { h2ColumnOrder.map(function(colName, colIdx){
                            const title = columnTitles[colName];
                            // if flagged as a multiSampleAnalysis column, parse it for the appropriate data
                            if (typeof title === "string" && hasMSAFlag(title)) {
                                const titleArr = title.split("|"); // if there isn't a proper title (undefined) for column, numbers based on index
                                return <th key={`msa ${titleArr[2]}`}>{ titleArr[1] !== 'undefined' ? titleArr[1] : `Pipeline V${colIdx - originalNumCols}`}</th>;
                            }
                            return <th key={colName}>{ title }</th>;
                        }) }
                    </tr>
                </thead>
                <tbody>
                    { renderedRows }
                </tbody>
                { hasCombinedMSA ?  <tfoot>{ finalRow }</tfoot>: null }
            </table>
        </div>
    );

    return (
        <React.Fragment>
            { renderedSummary }
            { renderedTable }
        </React.Fragment>
    );
});
CohortSummaryTable.propTypes = {
    clinic_notes : PropTypes.string,
    family_phenotypic_features : PropTypes.arrayOf(PropTypes.shape({
        "@id": PropTypes.string,
        "@type": PropTypes.arrayOf(PropTypes.string),
        "display_title": PropTypes.string,
        "principals_allowed": PropTypes.object,
        "uuid": PropTypes.string
    })),
    idToGraphIdentifier : PropTypes.object,
    idx : PropTypes.number,
    isCurrentFamily : PropTypes.bool,
    members : PropTypes.arrayOf(PropTypes.shape({
        "@id" : PropTypes.string,
        "@type" : PropTypes.arrayOf(PropTypes.string),
        "accession" : PropTypes.string,
        "age_at_death_units" : PropTypes.string,
        "age_units" : PropTypes.string,
        "display_title" : PropTypes.string,
        "father" : PropTypes.object,
        "is_deceased" : PropTypes.bool,
        "is_infertile" : PropTypes.bool,
        "is_no_children_by_choice" : PropTypes.bool,
        "is_pregnancy" : PropTypes.bool,
        "is_spontaneous_abortion" : PropTypes.bool,
        "is_still_birth" : PropTypes.bool,
        "is_termination_of_pregnancy" : PropTypes.bool,
        "mother" : PropTypes.object,
        "principals_allowed" : PropTypes.object,
        "sex" : PropTypes.string,
        "status" : PropTypes.string,
        "uuid" : PropTypes.string
    })),
    original_pedigree : PropTypes.object,
    proband : PropTypes.object,
    sampleProcessing: PropTypes.arrayOf(PropTypes.object),
    timestamp : PropTypes.string
};