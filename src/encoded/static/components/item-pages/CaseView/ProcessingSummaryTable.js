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
        'qualityMetric' : "Quality"
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

                const qualityMetrics = { };

                rawFilesWPermissions.concat(procFilesWPermissions).forEach((procFile) => {
                    const { quality_metric = null } = procFile;
                    const {
                        overall_quality_status = null,
                        url = null,
                        qc_list = [],
                        "@type" : typesList = []
                    } = quality_metric || {};

                    if (!quality_metric){
                        return; // Skip
                    }
                    qualityMetrics.overall = overall_quality_status;
                    // determine if qc list or not
                    if (typesList[0] != "QualityMetricQclist") {
                        // TODO: update with action for single quality metric
                        // console.log(`found a non-QualityMetricQclist; 
                        //     type is ${procFile.quality_metric['@type'][0]}`);
                    } else {
                        // check status for each quality item, and update with the appropriate url and status
                        qc_list.forEach((qcItem) => {
                            console.log("qcItem", qcItem);
                            switch(qcItem.qc_type) {
                                case "quality_metric_wgs_bamqc":
                                    qualityMetrics.BAMQC = qcItem.value.overall_quality_status;
                                    qualityMetrics.BAMQC_url = qcItem.value.url || qcItem.value["@id"];
                                    break;
                                case "quality_metric_bamcheck":
                                    qualityMetrics.BAM = qcItem.value.overall_quality_status;
                                    qualityMetrics.BAM_url = qcItem.value.url || qcItem.value["@id"];
                                    break;
                                case "quality_metric_fastqc":
                                    qualityMetrics.FQC = qcItem.value.overall_quality_status;
                                    qualityMetrics.FQC_url = qcItem.value.url || qcItem.value["@id"];
                                    break;
                                case "quality_metric_vcfcheck":
                                    qualityMetrics.VCF = qcItem.value.overall_quality_status;
                                    qualityMetrisc.VCF_url = qcItem.value.url || qcItem.value["@id"];
                                    break;
                                default:
                                    break;
                            }
                        });
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

                function statusToIcon(status){
                    switch (status) {
                        case "PASS":
                            return <i className="icon icon-check fas text-success"/>;
                            break;
                        case "FAIL":
                            return <i className="icon icon-times fas text-danger"/>;
                            break;
                        case "WARN": // todo: what icon makes the most sense here
                            return <i className="icon icon-exclamation-triangle fas text-warning"/>;
                            break;
                        default:
                            return null;
                    }
                }
               
                // order the different metrics so that one always shows up
                const { BAM, BAM_url, BAMQC, BAMQC_url, VCF, FQC } = row.qualityMetrics;


                colVal = (
                    <div className="qcs-container">
                        { VCF ? <span>{ statusToIcon(VCF) } VCF</span> : null }
                        { BAMQC !== "PASS" || !BAMQC ?
                            <span>
                                <a href={BAM_url} rel="noopener noreferrer" target="_blank"> { statusToIcon(BAM) } BAM</a>
                            </span> : null }
                        { BAMQC ?
                            <span>
                                <a href={BAMQC_url} rel="noopener noreferrer" target="_blank"> { statusToIcon(BAMQC) } BAMQC</a>
                            </span> : null }
                        { FQC ? <span>{ statusToIcon(FQC) } FQC</span> : null }
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
