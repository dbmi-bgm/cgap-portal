'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { Schemas } from './../../util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { capitalizeSentence } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';



function hasViewPermisison({ '@id' : itemID, display_title }) {
    return itemID && display_title;
}


/** @param {Object} props - Contents of a family sub-embedded object. */
export const CaseSummaryTable = React.memo(function CaseSummaryTable(props){
    const { idToGraphIdentifier = {}, sampleProcessing = [], family } = props;
    const {
        original_pedigree = null,
        relationships = [],
        members = [],
        proband: { '@id' : probandID } = {},
    } = family || {};

    console.log("case summary props", props);

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
                <i className="icon icon-fw icon-vial fas me-05 align-middle"/>
                <span className="d-none d-lg-inline ms-05">Sample</span>
            </React.Fragment>
        ),
        'individual' : (
            <React.Fragment>
                <i className="icon icon-fw icon-user fas me-05 align-middle"/>
                <span className="d-none d-lg-inline ms-05">Individual</span>
            </React.Fragment>
        ),
        'assayType' : "Assay Type",
        'rawFiles' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-code fas me-05 align-middle"/>
                Sequencing
            </React.Fragment>
        ),
        'processingType' : "Processing Type",
        'processedFiles' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-medical-alt fas me-05 align-middle"/>
                Pipeline
            </React.Fragment>
        ),
    };

    // Create a mapping of individuals to relationship and sex
    const relationshipMapping = {};
    relationships.forEach((item) => {
        const { relationship = null, sex = null, individual = null } = item;
        relationshipMapping[individual] = { sex, relationship };
    });
    console.log("relationshipMapping", relationshipMapping);

    const sampleProcessingData = {}; // maps sample analysis UUIDs to sample IDs to file data Objects for MSAs and samples

    let hasMSA = false; // if there is at least one sample processing object to render (w/2 samples in family)
    let hasCombinedMSA = false; // if there is also a combined MSA (for rendering last row only when there's a combined VCF)
    // add multisample analysis column data to column order/titles and data object
    sampleProcessing.forEach(function(sp){
        const { uuid, processed_files = [], completed_processes = [], samples = [], sample_processed_files = [] } = sp;
        // TODO: If processed_files.length !== spProcFilesWithPermission.length, maybe inform user about this?
        const spProcFilesWithPermission = processed_files.filter(hasViewPermisison);

        function pushColumn(title) {
            // adds a column to the end of the column order and to the column titles map
            // placed in a method for potential future use
            columnTitles[title] = title;
            h2ColumnOrder.push(title);
        }

        if (spProcFilesWithPermission.length > 0) {
            // add column titles with a flag & some embedded data for identifying column by UUID & rendering pipeline title
            pushColumn(`~MSA|${ completed_processes[0] }|${ uuid }`);

            sampleProcessingData[uuid] = {};
            sampleProcessingData[uuid]["MSA"] = generateFileDataObject(spProcFilesWithPermission); // populate with multisample analysis objects

            // populate with per sample data (no files)
            samples.forEach(function(sample){
                const { accession = "" } = sample;
                sampleProcessingData[uuid][accession] = true;
            });

            // populate with per sample data (files) (override any previously set)
            sample_processed_files.forEach(function(set){
                const { sample : { accession = "" } = {}, processed_files: procFiles = [] } = set;
                sampleProcessingData[uuid][accession] = generateFileDataObject(procFiles.filter(hasViewPermisison));
            });
            hasMSA = true;
        }

        if (spProcFilesWithPermission.length > 0) {
            hasCombinedMSA = true;
        }

    });

    function hasMSAFlag(string) {
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

    /**
     * Takes in an array of processed_files/files and returns an object with file data structured for processing/render.
     * @param {array} files An array of processed_files or files.
     * @return {object} {
     *      file_extension1: {
     *          overall: <string>, (PASS|FAIL|WARN), // overall quality status for all files with this extension
     *          files: <array> [
     *              <objects> {
     *                  numFail: <number>,
     *                  numWarn: <number>,
     *                  hasQm: <boolean>,
     *                  fileURL: <string>,
     *                  qmUrl: <string>
     *              },
     *              ...
     *          ]
     *      },
     *      file_extensions2: {
     *          ...
     *      }
     * }
     */
    function generateFileDataObject(files) {
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
            } = quality_metric;

            let qmUrl = qmId + '/@@download'; // send to @@download instead of url (deprecated for standalone QCs) - Will Jan 24 2022
            const extension = filename.substring(filename.indexOf('.')+1, filename.length) || filename; // assuming the display_title property remains the filename

            let fileOverallQuality = "PASS";
            let hasQm = true;
            let numFail = 0; // using these instead of quality value, since quality value can be extracted from numFail and numWarns (1 source of truth)
            let numWarn = 0;

            // figure out the file's overall quality status
            if (qc_list.length > 0) {
                qmUrl = qmId; // if qc_list item, link to that metadata item (instead of @@download)
                // loop through all of the quality metrics and count the number of failures and warnings for this file
                qc_list.forEach((qm) => {
                    const { value : { overall_quality_status = null } } = qm;
                    if (overall_quality_status === "FAIL") {
                        numFail++;
                        fileOverallQuality = "FAIL";
                    } else if (overall_quality_status === "WARN") {
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
                    currOverall === "WARN" && newFailing ||
                    newStatus && !currOverall
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

    /**
     * Takes in a FileDataObject as produced by generateFileDataObject and convert into a JSX list of files and QCs.
     * @param {object} fileObject   An object containing quality metric and file data.
     * @param {string} ext          The extension of the files being submitted.
     * @returns {JSX object}        Some renderable HTML component with a list of files and QCs, formatted for tables
     */
    function convertFileObjectToJSX(fileObject, ext) {
        const renderArr = [];
        const { files, overall: overallQuality } = fileObject;

        if (files && files.length <= 1) {
            if (files.length === 0) {
                return;
            }

            const tooltips = calcTooltips(files[0].hasQm, files[0].numWarn, files[0].numFail);

            // if there's a single quality metric, link the item itself
            renderArr.push(
                files[0] ?
                    <span className="ellipses" key={`span-${ext}`}>
                        { statusToIcon(overallQuality)}
                        <a href={files[0].fileUrl || ""}
                            rel="noopener noreferrer"
                            target="_blank"
                            data-tip={tooltips[0]}
                            className="link-underline-hover">
                            { ext.toUpperCase() }
                        </a>
                        { files[0].hasQm ?
                            <a href={files[0].qmUrl || ""}
                                rel="noopener noreferrer"
                                target="_blank"
                                className={`link-underline-hover ${statusToTextClass(overallQuality)} qc-status-${files[0].status}`}
                                data-tip={tooltips[1]}>
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
                        files.map(function(file, i){
                            const { hasQm = false, numWarn = -1, numFail = -1, quality, qmUrl = "", status, fileUrl = "" } = file;
                            const tooltips = calcTooltips(hasQm, numWarn, numFail);

                            return (
                                <React.Fragment key={`${ext}-${fileUrl}`}>
                                    <a href={ fileUrl } rel="noopener noreferrer" target="_blank"
                                        className={`link-underline-hover ${statusToTextClass(quality)}`} data-tip={tooltips[0]}>
                                        {i + 1}
                                    </a>
                                    { hasQm ?
                                        <a href={qmUrl}
                                            rel="noopener noreferrer"
                                            target="_blank"
                                            className={`link-underline-hover ${statusToTextClass(
                                                getFileQuality(numFail, numWarn))} qc-status-${status}`}
                                            data-tip={tooltips[1]}>
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

    /**
     * Helper function for QM handling; takes in a QM status and returns an icon.
     * @param {string} status (PASS|FAIL|WARN)
     * @return {JSX object} containing a fontawesome icon (or nothing, in the case of invalid input)
     */
    function statusToIcon(status){
        switch (status) {
            case "PASS":
                return <i className="icon icon-check fas text-success me-05"/>;
            case "FAIL":
                return <i className="icon icon-times fas text-danger me-05"/>;
            case "WARN":
                return <i className="icon icon-exclamation-triangle fas text-warning me-05"/>;
            default:
                return null;
        }
    }

    /**
     * Helper f(x) for QM handling; takes in a QM status and returns a bootstrap text color class.
     * @param {string} status (PASS|FAIL|WARN)
     * @return {string} Bootstrap text color class
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
     * @param {number} numFail  Number of failing QM and/or QCs
     * @param {number} numWarn  Number of failing QM and/or QCs
     *
     * @return {string} (PASS|FAIL|WARN)
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
    // todo: consider moving this block to Case index; we're already doing a pass to figure out
    // how many individual have samples there... so it might make sense to move this
    members.forEach(function(individual){
        const {
            accession = null,
            display_title: indvDisplayTitle = null,
            individual_id = null,
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

        // Assign roles to the individual
        const infoObj = relationshipMapping[accession] || relationshipMapping[indvDisplayTitle];
        const role = infoObj["relationship"] || null;
        const sex = infoObj["sex"] || null;
        console.log("id from graph", indvId, genID);

        const indvLink = (
            <div className={`${genID ? "text-truncate" : ""}`}>
                { isProband ? <span className="fw-bold d-block">Proband</span> : null}
                { (role && role !== "proband") ? <span className="d-block fw-semibold text-capitalize">{role}</span> : null}
                { genID ? <span className="text-serif text-small gen-identifier d-block text-center">{ genID }</span>: null}
                <a href={indvId} className="link-underline-hover accession d-block">{ individual_id || indvDisplayTitle }</a>
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
                workup_type : assayType,
                analysis_type = null
            } = sample;

            const [ , , sampleID ] = samplePath.split("/");

            if (!sampleTitle || !samplePath){
                rows.push({
                    individual : indvLink,
                    isProband,
                    sample : <em>{ sampleErr || "No view permissions" }</em>,
                    sampleIdx
                });
                return;
            } else {
                rows.push({
                    individual : indvLink,
                    isProband,
                    sample: (
                        <React.Fragment>
                            <span className="d-block">
                                { capitalizeSentence(specimen_type) }
                                { specimen_notes ? <span className="text-primary" data-tip={ specimen_notes }>*</span>: "" }
                            </span>
                            { specimen_collection_date ?
                                <span data-tip="Specimen Collection Date">
                                    <i className="me-03 icon icon-fw icon-syringe fas text-secondary"/>
                                    <LocalizedTime timestamp={specimen_collection_date} />
                                </span>
                                : null }
                            <a href={samplePath} className="link-underline-hover accession d-block">{ sampleTitle }</a>
                        </React.Fragment>
                    ),
                    individualGroup,
                    sampleId: sampleID,
                    sampleGroup,
                    processedFiles: generateFileDataObject(processed_files.filter(hasViewPermisison)),
                    rawFiles: generateFileDataObject(files.filter(hasViewPermisison)),
                    sampleIdx,
                    processingType: analysis_type || completed_processes[0] || null,
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
        <div className="processing-summary mt-04 px-3">
            { membersWithoutSamplesLen > 0 ?
                <p className="my-0">
                    <span className="text-600">{ membersWithoutSamplesLen }</span> members without samples.
                </p>
                : null }
            { membersWithoutViewPermissionsLen > 0 ?
                <p className="my-0">
                    <span className="text-600">{ membersWithoutViewPermissionsLen }</span> members without view permissions.
                </p>
                : null }
        </div>
    ) : null;

    if (rows.length === 0){
        return renderedSummary;
    }

    // sort so that proband is on top, then it's ordered by individuals, then by samples of the same individual
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

        const {
            isProband = false,
            sampleIdx,
            sampleId,
            individualGroup
        } = row;
        const rowCols = h2ColumnOrder.map(function(colName) {

            let colVal = row[colName] || " - ";

            if (colName === "processedFiles" || colName === "rawFiles"){
                const fileData = row[colName];
                const extensions = Object.keys(fileData);
                let renderArr = [];

                extensions.forEach(function(ext){
                    const jsx = convertFileObjectToJSX(fileData[ext], ext);
                    renderArr = renderArr.concat(jsx);
                });

                colVal = (
                    <div className="qcs-container text-truncate">
                        { renderArr }
                    </div>
                );
            } else if (hasMSAFlag(colName)) { // if a multisample analysis object
                const [,, uuid] = colName.split("|");
                const allFileObjects = sampleProcessingData[uuid][sampleId] || {};

                if (allFileObjects === true) {
                    console.log("exts, allFileObjects,", allFileObjects);
                    colVal = <div className="qcs-container text-truncate"><i className="icon icon-arrow-alt-circle-down fas"></i> Included in VCF </div>;
                } else {
                    const extensions = Object.keys(allFileObjects);
                    console.log("exts, extensions,", extensions);

                    let renderArr = [];
                    extensions.forEach(function(ext){
                        const jsx = convertFileObjectToJSX(allFileObjects[ext], ext);
                        renderArr = renderArr.concat(jsx);
                    });

                    colVal = (
                        <div className="qcs-container text-truncate">
                            { renderArr.length > 0 ? renderArr : '-' }
                        </div>
                    );
                }
            }

            return (
                <td key={colName} data-for-column={colName}
                    className={typeof row[colName] !== 'undefined' ? "has-value" : null}>
                    { colVal }
                </td>
            );
        });

        // color code non-proband rows in alternating bands based on individual group
        if (currIndvGroup !== individualGroup) {
            currIndvGroup = individualGroup;
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
                            renderArr = renderArr.concat(jsx);
                        });

                        colVal = (
                            <div className="qcs-container text-truncate">
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
                            { // note: currently assumes that any cols after those set in ColumnTitles are MSAs
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
                                return <th key={`msa ${titleArr[2]}`}>{ titleArr[1] !== 'undefined' ? titleArr[1] : "Joint Call"}</th>;
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
CaseSummaryTable.propTypes = { // todo: update with required fields
    "clinic_notes" : PropTypes.string,
    "family_phenotypic_features" : PropTypes.arrayOf(PropTypes.shape({
        "@id": PropTypes.string,
        "@type": PropTypes.arrayOf(PropTypes.string),
        "display_title": PropTypes.string,
        "principals_allowed": PropTypes.object,
        "uuid": PropTypes.string
    })),
    "idToGraphIdentifier" : PropTypes.object,
    "idx" : PropTypes.number,
    "isCurrentFamily" : PropTypes.bool,
    "family": PropTypes.shape({
        "members" : PropTypes.arrayOf(PropTypes.shape({
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
        "original_pedigree" : PropTypes.object,
        "proband" : PropTypes.object,
        "family_phenotypic_features" : PropTypes.arrayOf(PropTypes.shape({
            "@id": PropTypes.string,
            "@type": PropTypes.arrayOf(PropTypes.string),
            "display_title": PropTypes.string,
            "principals_allowed": PropTypes.object,
            "uuid": PropTypes.string
        })),
    }),
    "sampleProcessing": PropTypes.arrayOf(PropTypes.object),
    "timestamp" : PropTypes.string
};
