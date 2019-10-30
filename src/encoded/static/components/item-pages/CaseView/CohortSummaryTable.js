'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { Schemas } from './../../util';
import { patchedConsoleInstance } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';


/** @param {Object} props - Contents of a family sub-embedded object. */
export const CohortSummaryTable = React.memo(function CohortSummaryTable(props){
    const {
        members = [],
        proband: { '@id' : probandID } = {},
        original_pedigree = null
    } = props;

    if (members.length === 0){
        return (
            <div className="processing-summary">
                <em>No members available.</em>
            </div>
        );
    }

    const columnOrder = [
        "individual",
        "sample",
        "visitInfo",
        "sampleInfo",
        "workupType",
        "rawFiles",
        "processingType",
        "processedFiles",
        "variants"
    ];

    const columnTitles = {
        'sample' : (
            <React.Fragment>
                <i className="icon icon-fw icon-vial fas mr-05 align-middle"/>
                Sample ID
            </React.Fragment>
        ),
        'individual' : (
            <React.Fragment>
                <i className="icon icon-fw icon-user fas mr-05 align-middle"/>
                Individual
            </React.Fragment>
        ),
        'visitInfo' : (
            <React.Fragment>
                <i className="icon icon-fw icon-clinic-medical fas mr-05 align-middle"/>
                Visit Info
            </React.Fragment>
        ),
        'sampleInfo' : "Sample Type",
        'workupType' : "Workup Type",
        'rawFiles' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-code fas mr-05 align-middle"/>
                Raw Files
            </React.Fragment>
        ),
        'processingType' : "Processing Type",
        'processedFiles' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-medical-alt fas mr-05 align-middle"/>
                Processed File(s)
            </React.Fragment>
        ),
        'variants' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-upload fas align-middle" />
                <span className="d-none d-lg-inline ml-05">Variants (single)</span>
            </React.Fragment>
        )
    };


    const rows = [];
    const membersWithoutSamples = [];
    const membersWithoutViewPermissions = [];

    let individualGroup = 0;
    let sampleGroup = 0;

    // Gather rows from family.members - 1 per sample (or individual, if no sample).
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

        const indvLink = <a href={indvId} className="accession">{ indvDisplayTitle }</a>;
        const isProband = (probandID && probandID === indvId);

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
                let numFail = 0;
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
                    // if no quality status, change hasQM to false
                    if (!overall_quality_status) {
                        numFail = -1;
                        numWarn = -1;
                        hasQm = false;
                    } else {
                        // update pass fail number for file
                        if (overall_quality_status === "FAIL") {
                            numFail++;
                        } else if (overall_quality_status === "WARN") {
                            numWarn++;
                        }
                    }
                    fileOverallQuality = overall_quality_status;
                }

                // once done, add those to fileObject;
                const fileObject = {
                    numFail,
                    numWarn,
                    hasQm,
                    fileUrl,
                    qmUrl
                };

                function shouldUpdateStatus(currOverall, newStatus) {
                    // s1 is current overall status, s2 is new one
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
                    if (shouldUpdateStatus(allFiles[extension].overall, fileOverallQuality)) {
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

        samples.forEach(function(sample, sampleIdx){
            const {
                '@id' : sampleID,
                display_title: sampleTitle,
                error: sampleErr = null,
                files = [],
                processed_files = [],
                status: sampleStatus,
                specimen_type: sampleInfo = null,
            } = sample;

            if (!sampleTitle || !sampleID){
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
                const [ showFile ] = procFilesWPermissions;

                rows.push({
                    sample: <a href={sampleID} className="accession">{ sampleTitle }</a>,
                    individual : indvLink,
                    isProband,
                    individualGroup,
                    sampleGroup,
                    processedFiles: generateFileRenderObject(procFilesWPermissions),
                    rawFiles: generateFileRenderObject(rawFilesWPermissions),
                    sampleIdx,
                    sampleInfo,
                    sampleStatus: (
                        <span>
                            <i className="item-status-indicator-dot mr-05" data-status={sampleStatus}/>
                            { Schemas.Term.toName("status", sampleStatus) }
                        </span>
                    )
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
    const renderedRows = sortedRows.map(function(row, rowIdx){
        const { isProband = false, sampleIdx } = row;
        const rowCols = columnOrder.map(function(colName){

            /**
             * Helper f(x) for QM handling; takes in a QM status and returns appropriate icon.
             */
            function statusToIcon(status){
                switch (status) {
                    case "PASS":
                        return <i className="icon icon-check fas text-success mr-05"/>;
                    case "FAIL":
                        return <i className="icon icon-times fas text-danger mr-05"/>;
                    case "WARN": // todo: what icon makes the most sense here
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


            function getFileQuality(numFail, numWarn) {
                if (numFail) {
                    return "FAIL";
                }
                if (numWarn) {
                    return "WARN";
                }
                return "PASS";
            }

            function calcTooltips(hasQm, warns, fails) {
                /**
                 * Generates a file-level and QC-level tooltip based on a file's QM stats.
                 *
                 * @param {boolean} hasQm   Is there at least 1 visible qualitymetric for the given file?
                 * @param {number}  warns   Number of qualitymetrics with value "WARN"
                 * @param {number}  fails   Number of qualitymetrics with value "FAIL"
                 *
                 * @return {array} Index [0] is the file level tooltip (only relevant if there is no QM), and index [1] is the QC level tooltip.
                 */

                // console.log(`testing calcTooltips with ${hasQm}, ${warns}, ${fails}`);
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
                // console.log(`calcTooltips produced the following tips: \n "${qmExistsTip}" and "${warnFailTip}"`);

                return [qmExistsTip || null, warnFailTip || null];
            }

            let colVal = row[colName] || " - ";

            if (colName === "processedFiles" || colName === "rawFiles"){
                const fileData = row[colName];
                const extensions = Object.keys(fileData);
                const renderArr = [];

                extensions.forEach((ext) => {
                    const { files, overall: overallQuality } = fileData[ext];

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
                });

                colVal = (
                    <div className="qcs-container text-ellipsis-container">
                        { renderArr }
                    </div>
                );
            }
            return (
                <td key={colName} data-for-column={colName}
                    data-tip={isProband && colName === "individual" ? "Proband" : null}
                    className={typeof row[colName] !== 'undefined' ? "has-value" : null}>
                    { colVal }
                </td>
            );
        });

        // color code non-proband rows in alternating bands based on individual group
        if (currIndvGroup !== row.individualGroup) {
            currIndvGroup = row.individualGroup; // set new individual group
            isEven = !isEven; // toggle for next row
        }

        const rowCls = (
            "sample-row" +
            (isProband ? " is-proband" :  (isEven ? " is-even" : ""))
        );

        return <tr key={rowIdx} className={rowCls} data-sample-index={sampleIdx}>{ rowCols }</tr>;
    });

    const renderedTable = (
        <div className="processing-summary-table-container">
            <table className="processing-summary-table">
                <thead>
                    <tr>
                        { columnOrder.map(function(colName){
                            return <th key={colName}>{ columnTitles[colName] }</th>;
                        }) }
                    </tr>
                </thead>
                <tbody>{ renderedRows }</tbody>
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
