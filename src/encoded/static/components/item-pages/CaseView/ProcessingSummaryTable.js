'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import { Schemas } from './../../util';


/** @param {Object} props - Contents of a family sub-embedded object. */
export const ProcessingSummaryTable = React.memo(function ProcessingSummaryTable(props){
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
        "rawFileCount",
        "provenance",
        //"processedFileCount",
        "processedFiles",
        "qualityMetric",
        "sampleStatus"
    ];

    const columnTitles = {
        'individual' : (
            <React.Fragment>
                <i className="icon icon-fw icon-user fas mr-05 align-middle"/>
                Individual
            </React.Fragment>
        ),
        'sample' : (
            <React.Fragment>
                <i className="icon icon-fw icon-vial fas mr-05 align-middle"/>
                Sample
            </React.Fragment>
        ),
        'processedFileCount' : "Processed Files",
        'processedFiles' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-code fas mr-05 align-middle"/>
                Output File(s)
            </React.Fragment>
        ),
        'provenance' : (
            <i className="icon icon-fw icon-sitemap icon-rotate-90 fas align-middle"
                data-tip="Link to provenance graph" />
        ),
        'rawFileCount' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-upload fas align-middle"
                    data-tip="Raw Files"/>
                <span className="d-none d-lg-inline ml-05">Raw Files</span>
            </React.Fragment>
        ),
        'sampleStatus' : "Sample Status",
        'qualityMetric' : (
            <React.Fragment>
                <i className="icon icon-fw icon-award fas mr-05 align-middle"/>
                Quality
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

        samples.forEach(function(sample, sampleIdx){
            const {
                '@id' : sampleID,
                display_title: sampleTitle,
                error: sampleErr = null,
                processed_files = [],
                files = [],
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

                const qualityMetrics = { };
                /*
                    qualityMetrics = {
                        <qctype> : {
                            overall: STRING <PASS|FAIL|WAIL>,
                            items: ARRAY [
                                OBJECT {
                                    url: STRING <url to report, qm item, or qclist item>,
                                    quality: STRING <PASS|FAIL|WAIL>,
                                    status: STRING <in review, deleted, current, etc.>
                                }
                            ]
                        }
                    }
                */

                sampleFiles.forEach((file) => {
                    const { quality_metric = null } = file;
                    const {
                        qc_list = [],
                        "@type" : typesList = []
                    } = quality_metric || {};

                    if (!quality_metric){
                        return; // Skip
                    }

                    /**
                     * Helper f(x) for QM handling; takes in a QM status and returns whether the current item
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
                     * {
                     *  overall: String ('PASS'|'FAIL'|'WARN'), // updated when new items are added to qualityMetrics object
                     *  items: Array [
                     *          {
                     *              value: String ('PASS'|'FAIL'|'WARN')
                     *              status: String ('Current'|'In-Review'... etc.) // Will not be added if status is deleted
                     *              url: String (URL of a QualityMetric item or a link to its view page)
                     *          }
                     *      ]
                     *  }
                     *
                     * If this object already exists, then new items are added to the items Array, and the overall value
                     * is updated (if new item has a worse status than current overall rating).
                     *
                     * Returns undefined.
                     */
                    function setQualityMetrics(qc_type, qm) {
                        const {
                            '@id' : fallbackUrl,
                            url,
                            'overall_quality_status': quality,
                            status
                        } = qm;

                        const hyphenatedStatus = status.replace(/\s+/g, "-");

                        const shortType = getShortQMType(qc_type);
                        if (shortType && itemVisible(qm.status)) {
                            if (qualityMetrics.hasOwnProperty(shortType)) {
                                // ensure overall status reflective of current items
                                const currFailing = quality === "FAIL";
                                const currWarning = quality === "WARN";
                                // if current item has a worse status than current overall rating, update to reflect that
                                if (qualityMetrics[shortType].overall === "PASS" && currFailing ||
                                    qualityMetrics[shortType].overall === "PASS" && currWarning ||
                                    qualityMetrics[shortType].overall === "WARN" && currFailing
                                ) {
                                    qualityMetrics[shortType].overall = quality;
                                }
                                qualityMetrics[shortType].items.push({
                                    url: (url || fallbackUrl),
                                    quality,
                                    status: hyphenatedStatus
                                });
                            } else {
                                qualityMetrics[shortType] = {
                                    overall: quality,
                                    items: [{
                                        url: (url || fallbackUrl),
                                        quality,
                                        status: hyphenatedStatus
                                    }]
                                };
                            }
                        }
                    }

                    // determine if qualitymetric container or not, then
                    // check status for each quality item, and update with the appropriate url and status
                    if (typesList[0] === "QualityMetricQclist") {

                        if (qc_list.length === 1) {
                            // if there's only one item in the list, just use that data directly, link to the specific item;
                            setQualityMetrics(qc_list[0].value["@type"][0], qc_list[0].value);
                        } else {
                            // if there are multiple items, process each item separately
                            qc_list.forEach((item) => {
                                setQualityMetrics(item.value["@type"][0], item.value);
                            });
                        }
                    } else if (typesList[1] === "QualityMetric") {
                        // if single (non-container) qualitymetric item
                        setQualityMetrics(file.quality_metric["@type"][0], file.quality_metric);
                    } else {
                        // todo: are there any legitimate cases in which this will happen?
                        console.error('Failure while rendering quality row; type not QualityMetric or QualityMetric container object');
                    }
                });


                rows.push({
                    individual : indvLink,
                    isProband,
                    sample: <a href={sampleID} className="accession">{ sampleTitle }</a>,
                    processedFileCount: processed_files.length,
                    processedFiles: processed_files,
                    provenance: (
                        showFile && Array.isArray(showFile.workflow_run_outputs) && showFile.workflow_run_outputs.length > 0 ?
                            showFile['@id'] + "#provenance" : null
                    ),
                    rawFileCount: files.length,
                    sampleIdx,
                    qualityMetrics,
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
            if (colName === "provenance"){
                if (colVal){
                    colVal = (
                        <a href={colVal}>
                            <i className="icon icon-fw icon-sitemap icon-rotate-90 fas"/>
                        </a>
                    );
                } else {
                    colVal = (
                        <i className="icon icon-fw icon-ban"/>
                    );
                }
            }
            else if (colName === "processedFiles"){
                const filesWPermissions = row[colName].filter(function(file){
                    return file['@id'] && file.display_title;
                });
                const filesWPermissionsLen = filesWPermissions.length;
                if (filesWPermissionsLen === 0){
                    colVal = " - ";
                } else {
                    const [ showFile  ] = filesWPermissions;
                    const { '@id' : fileID, display_title } = showFile;
                    /*
                    let provenanceGraphIcon;
                    if (Array.isArray(workflow_run_outputs) && workflow_run_outputs.length > 0){
                        provenanceGraphIcon = (
                            <div className="col-auto" data-tip="See Provenance Graph">
                                <a href={fileID + "#provenance"}>
                                    <i className="icon icon-fw icon-sitemap icon-rotate-90 fas"/>
                                </a>
                            </div>
                        );
                    }
                    */
                    if (filesWPermissionsLen === 1){
                        colVal = (
                            <a href={fileID}>{ display_title }</a>
                        );
                    } else {
                        colVal = (
                            <React.Fragment>
                                <a href={fileID}>{ display_title }</a>
                                { "+ " + ( filesWPermissionsLen - 1 ) + " more" }
                            </React.Fragment>
                        );
                    }

                }
            } else if (colName === "qualityMetric"){
                const qms = row.qualityMetrics;
                const keys = Object.keys(qms); // each key is the qm type, and contains an object as its value

                const renderArr = [];

                const passingBAMQC = qms.BAMQC && (qms.BAMQC.overall === "PASS");

                keys.forEach((qmType) => {
                    if (qmType === "BAM" && passingBAMQC) {
                        return; // skip; don't render BAM
                    }

                    // if there's a single quality metric, link the item itself
                    if (qms[qmType].items && qms[qmType].items.length <= 1) {
                        renderArr.push(
                            qms[qmType].items[0] ?
                                <span className="ellipses" key={`span-${qms[qmType]}`}>
                                    { statusToIcon(qms[qmType].overall) }
                                    <a
                                        href={qms[qmType].items[0].url}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                        className={`qc-status-${qms[qmType].items[0].status}`}
                                        data-tip={`This quality check is ${qms[qmType].items[0].status}.`}
                                    >
                                        { qmType }
                                    </a>
                                </span>
                                : null
                        );
                    } else if (qms[qmType].items) {
                        // otherwise create a list with linked #s
                        renderArr.push(
                            <span className="ellipses" key={`span-multi-${qms[qmType]}`}>
                                { statusToIcon(qms[qmType].overall) } { qmType }
                                (   {
                                    qms[qmType].items.map((qm, i) => (
                                        <React.Fragment key={`${qms[qmType]}-${i}`}>
                                            <a href={ qm.url || "" } rel="noopener noreferrer" target="_blank"
                                                className={`${statusToTextClass(qm.quality)} qc-status-${qm.status}`}
                                                data-tip={`This quality check is ${qm.status}.`}>
                                                {i + 1}
                                            </a>
                                            { // if the last item, don't add a comma
                                                (i === qms[qmType].items.length - 1 ?  null : ', ')
                                            }
                                        </React.Fragment>
                                    ))
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
