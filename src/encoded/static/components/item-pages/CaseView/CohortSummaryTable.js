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
        "sample",
        "individual",
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
                    quality_metric = null,
                    "@id": fileUrl
                } = file;

                const {
                    overall_quality_status = "",
                    qc_list = [],
                    "@id": qmUrl = ""
                } = quality_metric;

                const fileObject = {}; // object for storing data for file render
                const extension = filename.substring(filename.indexOf('.')+1, filename.length) || filename; // assuming the display_title property remains the filename

                fileObject.fileUrl = fileUrl; // set file URL
                fileObject.qmUrl = qmUrl; // set quality metric URL (either links to the list of QMS or to the QM itself)

                let fileOverallQuality = "PASS";

                if (qc_list.length > 0) {
                    let numFail = 0;
                    let numWarn = 0;

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

                    // once done, add those to fileObject;
                    fileObject.numFail = numFail;
                    fileObject.numWarn = numWarn;
                } else {
                    let numFail = 0;
                    let numWarn = 0;

                    // update pass fail number for file
                    if (overall_quality_status === "FAIL") {
                        numFail++;
                    } else if (overall_quality_status === "WARN") {
                        numWarn++;
                    }

                    // once done, add those to fileObject;
                    fileObject.numFail = numFail;
                    fileObject.numWarn = numWarn;

                    fileOverallQuality = overall_quality_status;
                }

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
                status: sampleStatus
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
                    processedFiles: generateFileRenderObject(procFilesWPermissions),
                    rawFiles: generateFileRenderObject(rawFilesWPermissions),
                    sampleIdx,
                    sampleStatus: (
                        <span>
                            <i className="item-status-indicator-dot mr-05" data-status={sampleStatus}/>
                            { Schemas.Term.toName("status", sampleStatus) }
                        </span>
                    )
                });
            }
        });

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

    const sortedRows = _.sortBy(rows, "isProband").reverse(); // todo: this is... probably not ideal performance wise

    const renderedRows = sortedRows.map(function(row, rowIdx){
        const { isProband = false, sampleIdx } = row;
        const rowCls = "sample-row" + (isProband ? " is-proband" : "");
        const rowCols = columnOrder.map(function(colName){

            /**
             * Helper f(x) for QM handling; takes in a QM status and returns appropriate icon.
             */
            function statusToIcon(status){
                switch (status) {
                    case "PASS":
                        return <i className="icon icon-check fas text-success mr-05"/>;
                    case "FAIL":
                        return <i data-tip="One or more of these files failed quality inspection." className="icon icon-times fas text-danger mr-05"/>;
                    case "WARN": // todo: what icon makes the most sense here
                        return <i data-tip="One or more of these files has a quality-related warning." className="icon icon-exclamation-triangle fas text-warning mr-05"/>;
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



            let colVal = row[colName] || " - ";

            if (colName === "processedFiles" || colName === "rawFiles"){
                const fileData = row[colName];
                const extensions = Object.keys(fileData);
                const renderArr = [];

                console.log("log2: fileData, ", fileData);
                extensions.forEach((ext) => {
                    const { files, overall: overallQuality } = fileData[ext];

                    if (files && files.length <= 1) {
                        if (files.length <= 0) {
                            return;
                        }

                        // if there's a single quality metric, link the item itself
                        let dataTip = "";
                        if (files[0].numWarn > 0) {
                            dataTip += `${files[0].numWarn} QM(s) with Warnings `;
                        }
                        if (files[0].numFail > 0) {
                            dataTip += `${files[0].numFail} QM(s) with Failures `;
                        }
                        renderArr.push(
                            files[0] ?
                                <span className="ellipses" key={`span-${ext}`}>
                                    { statusToIcon(overallQuality) }
                                    <a
                                        href={files[0].fileUrl || ""}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >
                                        { ext.toUpperCase() }
                                    </a>
                                    <a
                                        href={files[0].qmUrl || ""}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                        className={`${statusToTextClass(overallQuality)} qc-status-${files[0].status}`}
                                        data-tip={dataTip || null}
                                    >
                                        <sup>QC</sup>
                                    </a>
                                </span>
                                : null
                        );
                    } else if (files) { // otherwise create a list with linked #s
                        renderArr.push(
                            <span className="ellipses" key={`span-multi-${ext}`}>
                                { statusToIcon(overallQuality) } { ext.toUpperCase() }
                                (   {
                                    files.map((file, i) => {
                                        let dataTip = "";
                                        if (file.numWarn > 0) {
                                            dataTip += `${file.numWarn} QM(s) with Warnings `;
                                        }
                                        if (file.numFail > 0) {
                                            dataTip += `${file.numFail} QM(s) with Warnings `;
                                        }

                                        return (
                                            <React.Fragment key={`${ext}-${file.fileUrl}`}>
                                                <a href={ file.fileUrl || "" } rel="noopener noreferrer" target="_blank"
                                                    className={`${statusToTextClass(file.quality)}`}>
                                                    {i + 1}
                                                </a>
                                                <a
                                                    href={file.qmUrl || ""}
                                                    rel="noopener noreferrer"
                                                    target="_blank"
                                                    className={`${statusToTextClass(
                                                        getFileQuality(file.numFail, file.numWarn))} qc-status-${file.status}`}
                                                    data-tip={dataTip || null}
                                                >
                                                    <sup>QC</sup>
                                                </a>
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
