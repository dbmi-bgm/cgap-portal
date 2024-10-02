'use strict';

import React, { useMemo } from 'react';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';



export const SomaticAnalysisStats = React.memo(function SomaticAnalysisStats(props){
    const { individual = null, samples, "@id": somaticAnalysisAtID, haveSAEditPermission = false } = props;
    const { "@id": individualAtID } = individual || {};

    return (
        // Stack into one column at small window size.
        <div id="case-stats" className="row">
            <div className="col-12 col-sm mb-2 mb-sm-0">
                <div className="card h-100">
                    <div className="card-header primary-header d-flex align-items-center">
                        <i className="icon icon-user fas icon-fw me-1"/>
                        <h4 className="my-0 text-400 flex-grow-1">
                            Individual
                        </h4>
                        { haveSAEditPermission && individualAtID ?
                            <a href={individualAtID + "?currentAction=edit&callbackHref=" + somaticAnalysisAtID}
                                className="text-white-50 ms-12 text-small" data-tip="Edit Individual. Changes may take a few minutes to appear.">
                                <i className="icon icon-fw icon-pencil-alt fas"/>
                            </a>
                            : null }
                    </div>
                    <div className="card-body">
                        { individualAtID && <IndividualInfo {...{ individual }} />}
                        { !individualAtID && <div className="card-text mb-1 me-06">No Individual Available</div>}
                    </div>
                </div>
            </div>
            <div className="col-12 col-sm">
                <div className="card h-100">
                    <div className="card-header primary-header d-flex align-items-center">
                        <i className="icon icon-vial fas icon-fw me-1"/>
                        <h4 className="my-0 text-400 flex-grow-1">
                            Sample Summary
                        </h4>
                    </div>
                    <div className="card-body">
                        <SampleSummaryInfo {...{ samples }} />
                    </div>
                </div>
            </div>
        </div>
    );
});

export const IndividualInfo = React.memo(function IndividualInfo({ individual }) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;
    const {
        "@id": individualAtID,
        accession = fallbackElem,
        display_title = null,
        individual_id = fallbackElem,
        sex = fallbackElem,
        age = null,
        age_units = null,
        date_created = null,
        primary_disorders = []
    } = individual || {};

    if (!individual) {
        return (
            <div className="text-center text-italic">
                No Individual Item linked to this Somatic Analysis
            </div>
        );
    }

    if (!individualAtID) {
        return (
            <div className="text-center text-italic">
                No view permissions
            </div>
        );
    }

    const primaryDisorders = primary_disorders.map((disorder) => disorder.disorder_name).join(", ");

    return (
        <React.Fragment>
            <div className="card-text mb-1">
                <label className="mb-0 me-06">Individual ID:&nbsp;</label>
                <a href={individualAtID} target="_blank" rel="noopener noreferrer">
                    { display_title || individual_id }
                </a>
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">CGAP Individual ID:&nbsp;</label>
                <span className="font-monospace text-small">{ accession }</span>
            </div>
            <div className="card-text mb-1">
                <label className="mb-0 me-02">Diagnosis:&nbsp;</label>
                <span className="text-capitalize">{primaryDisorders ? primaryDisorders: fallbackElem}</span>
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Sex (User-Submitted):&nbsp;</label>
                { sex }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Age:&nbsp;</label>
                { age && age_units ? `${age} ${age_units}(s)` : fallbackElem }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Accession Date:&nbsp;</label>
                { date_created ? <LocalizedTime timestamp={date_created} formatType="date-sm"/> : fallbackElem }
            </div>
        </React.Fragment>
    );
});


export const SampleSummaryInfo = React.memo(function SampleSummaryInfo({ samples }) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;

    if (!samples.length) {
        return (
            <div className="text-center text-italic">
                No Samples linked to this Somatic Analysis
            </div>
        );
    }

    return (
        <React.Fragment>
            {samples.map((sample, i) => {
                const { "@id": atID, tissue_type, bam_sample_id, display_title, specimen_type } = sample;

                const appendLine = i !== samples.length - 1;

                return (
                    <React.Fragment key={atID}>
                        <div className="card-text mb-1 text-capitalize">
                            <label className="mb-0">{tissue_type} Sample:&nbsp;</label>
                            { specimen_type || fallbackElem }
                        </div>
                        <div className="card-text mb-1">
                            <label className="mb-0">ID:&nbsp;</label>
                            { bam_sample_id || display_title ?
                                <a href={atID}>{bam_sample_id || display_title}</a>
                                : fallbackElem }
                        </div>
                        {appendLine && <hr/>}
                    </React.Fragment>
                );
            })}
        </React.Fragment>
    );
});
