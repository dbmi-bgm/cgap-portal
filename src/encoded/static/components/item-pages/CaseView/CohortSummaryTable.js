'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
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
            const fileObject = {};
        
            files.forEach((file) => {
                const {
                    quality_metric = null,
                    "@id": fileUrl,
                } = file;
                const {
                    qc_list = [],
                    "@type" : typesList = []
                } = quality_metric || {};
        
                if (!quality_metric){
                    return; // Skip
                }
        
                /**
                 * Helper f(x) for QM handling; takes in a QM status and returns whether the QC
                 * should be rendered on the page or not.
                 */
                function itemVisible(status) {
                    switch(status) {
                        case "deleted":
                        case "obsolete":
                        case "replaced":
                            return false;
                        default:
                            return true;
                    }
                }
        
                /**
                 * Helper f(x) for QM handling; takes in a QM type (usually from ['@type'][0]) and returns a
                 * shortened version for use in interface and as object key.
                 */
                function getShortQMType(longType) {
                    switch(longType) {
                        case "QualityMetricWgsBamqc":
                            return "BAMQC";
                        case "QualityMetricBamcheck":
                            return "BAM";
                        case "QualityMetricFastqc":
                            return "FQC";
                        // case "QualityMetricVcfcheck": // deleted
                        //     return "VCF";
                        default:
                            return "";
                    }
                }
        
        
        
                /**
                 * Helper f(x) for QM handling; takes in a QM type (usually from ['@type'][0]) and a single
                 * (non-container) QM item. Either adds or updates key-value pairs in qualityMetrics object defined above.
                 *
                 * Adds as the key a shortQMType ('BAMQC' instead of 'QualityMetricWgsBamqc') of the passed in QM
                 * and each value is an object structured as follows:
                 *
                 *
                 *  {
                 *  <file extension> : {
                 *      overallQuality: String,
                 *           files: Array[
                 *               quality: String,
                 *               qmUrl: String,
                 *               fileStatus: Status,
                 *               fileUrl: String,
                 *           ]
                 *      }
                 *  }
                 *
                 *
                 * If this object already exists, then new items are added to the items Array, and the overall value
                 * is updated (if new item has a worse status than current overall rating).
                 *
                 * Returns undefined.
                 */
                function setFileData(fileUrl, qc_type, qm) {
                    console.log('log: setting file data');
                    const {
                        '@id' : fallbackQMUrl,
                        url : qmUrl,
                        'overall_quality_status': quality,
                        status
                    } = qm;
        
                    const hyphenatedStatus = status.replace(/\s+/g, "-");
        
                    const shortType = getShortQMType(qc_type);
                    if (shortType && itemVisible(qm.status)) {
                        if (fileObject.hasOwnProperty(shortType)) {
                            // ensure overall status reflective of current items
                            const currFailing = quality === "FAIL";
                            const currWarning = quality === "WARN";
                            // if current item has a worse status than current overall rating, update to reflect that
                            if (fileObject[shortType].overall === "PASS" && currFailing ||
                                fileObject[shortType].overall === "PASS" && currWarning ||
                                fileObject[shortType].overall === "WARN" && currFailing
                            ) {
                                fileObject[shortType].overall = quality;
                            }
                            fileObject[shortType].items.push({
                                qmUrl: qmUrl || fallbackQMUrl,
                                quality,
                                status: hyphenatedStatus,
                                fileUrl
                            });
                        } else {
                            fileObject[shortType] = {
                                overall: quality,
                                items: [{
                                    qmUrl: qmUrl || fallbackQMUrl,
                                    quality,
                                    status: hyphenatedStatus,
                                    fileUrl
                                }]
                            };
                        }
                    }
                    console.log("log: finished setting metric", fileObject);
                }

                console.log("log: checking if qmetric");
                // determine if qualitymetric container or not, then
                // check status for each quality item, and update with the appropriate url and status
                if (typesList[0] === "QualityMetricQclist") {
                    if (qc_list.length === 1) {
                        // if there's only one item in the list, just use that data directly, link to the specific item;
                        setFileData(fileUrl, qc_list[0].value["@type"][0], qc_list[0].value);
                    } else {
                        // if there are multiple items, process each item separately
                        qc_list.forEach((item) => {
                            setFileData(fileUrl, item.value["@type"][0], item.value);
                        });
                    }
                } else if (typesList[1] === "QualityMetric") {
                    // if single (non-container) qualitymetric item
                    setFileData(fileUrl, file.quality_metric["@type"][0], file.quality_metric);
                } else {
                    // todo: are there any legitimate cases in which this will happen?
                    console.error('Failure while rendering quality row; type not QualityMetric or QualityMetric container object');
                }
            });

            return fileObject;
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

                const sampleFiles = rawFilesWPermissions.concat(procFilesWPermissions);
                const processedFiles = generateFileRenderObject(procFilesWPermissions);
                const rawFiles = generateFileRenderObject(rawFilesWPermissions);

                rows.push({
                    sample: <a href={sampleID} className="accession">{ sampleTitle }</a>,
                    individual : indvLink,
                    isProband,
                    processedFiles,
                    rawFiles,
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

    const renderedRows = rows.map(function(row, rowIdx){
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

            let colVal = row[colName] || " - ";
            
            if (colName === "processedFiles" || colName === "rawFiles"){
                const fileData = row[colName];
                const extensions = Object.keys(fileData);
                const renderArr = [];

                console.log("log2: fileData, ", fileData);
                extensions.forEach((ext) => {
                    const { items: files, overall: overallQuality } = fileData[ext];
                    console.log("log2: ext, ", ext);
                    console.log("log2: , files", files);
                    console.log("log2: , overallQuality", overallQuality);

                    function getFileQuality(numWarn, numFail) {
                        if (file.numFail > 0) {
                            return "FAIL";
                        }
                        if (file.numWarn > 0) {
                            return "WARN";
                        }
                        return "PASS";
                    }

                    // if there's a single quality metric, link the item itself
                    if (files && files.length <= 1) {
                        let dataTip = "";
                        if (files[0].numWarn > 0) {
                            dataTip += numWarn + " QMs with Warnings ";
                        }
                        if (files[0].numFail > 0) {
                            dataTip += numFail + " QMs Failing ";
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
                                        className={`qc-status-${statusToTextClass(overallQuality)} qc-subscript`}
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
                                            dataTip += numWarn + " QMs with Warnings ";
                                        }
                                        if (file.numFail > 0) {
                                            dataTip += numFail + " QMs Failing ";
                                        }
                                    
                                        return (
                                            <React.Fragment key={`${ext}-${file.fileUrl}`}>
                                                <a href={ file.fileUrl || "" } rel="noopener noreferrer" target="_blank"
                                                    className={`${statusToTextClass(file.quality)} qc-status-${file.status}`}>
                                                    {i + 1}
                                                </a>
                                                <a
                                                    href={file.qmUrl || ""}
                                                    rel="noopener noreferrer"
                                                    target="_blank"
                                                    className={`qc-status-${statusToTextClass(overallQuality)} qc-subscript`}
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
                console.log(renderArr);
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
