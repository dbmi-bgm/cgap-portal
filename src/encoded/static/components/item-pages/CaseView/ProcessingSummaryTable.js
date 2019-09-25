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
        //"processedFileCount",
        "processedFiles",
        "rawFileCount",
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
        'rawFileCount' : (
            <React.Fragment>
                <i className="icon icon-fw icon-file-upload fas mr-05 align-middle"
                    data-tip="Raw Files"/>
                <span className="d-none d-lg-inline">Raw Files</span>
            </React.Fragment>
        ),
        'sampleStatus' : "Sample Status"
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
            /*
            rows.push({
                individual : <em>{ error || "No view permissions" }</em>,
                isProband: false,
                sample: <em>N/A</em>,
                processedFileCount: <em>N/A</em>,
                rawFileCount: <em>N/A</em>,
                sampleStatus: <em>N/A</em>
            });
            */
            return;
        }

        if (samples.length === 0){
            membersWithoutSamples.push(individual);
            /*
            rows.push({
                individual : indvLink,
                isProband: (probandID && probandID === indvId),
                sample: <em className="small" data-tip="No samples available for this individual">N/A</em>
            });
            */
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
                rows.push({
                    individual : indvLink,
                    isProband,
                    sample: <a href={sampleID} className="accession">{ sampleTitle }</a>,
                    processedFileCount: processed_files.length,
                    processedFiles: processed_files,
                    rawFileCount: files.length,
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
                <p className="mb-0">{ (membersWithoutSamplesLen + " members without samples.") }</p>
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
                <p className="mb-0">{ (membersWithoutViewPermissionsLen + " members without view permissions.") }</p>
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
            if (colName === "processedFiles"){
                const filesWPermissions = row[colName].filter(function(file){
                    return file['@id'] && file.display_title;
                });
                const filesWPermissionsLen = filesWPermissions.length;
                if (filesWPermissionsLen === 0){
                    colVal = " - ";
                } else if (filesWPermissionsLen === 1){
                    colVal = filesWPermissions[0];
                    colVal = <a href={colVal['@id']}>{ colVal.display_title }</a>;
                } else {
                    colVal = filesWPermissions[0];
                    colVal = (
                        <span>
                            <a href={colVal['@id']}>{ colVal.display_title }</a>
                            { "+ " + ( filesWPermissions[0].length - 1 ) + " more" }
                        </span>
                    );
                }
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
    );

    return (
        <React.Fragment>
            { renderedSummary }
            { renderedTable }
        </React.Fragment>
    );
});
