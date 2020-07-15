'use strict';

import React, { useState, useMemo } from 'react';
import { Collapse } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Collapse';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';


/**
 * Returns an array of phenotypic features styled as an unordered list of Bootstrap badges.
 * @param {Array} features An array of phenotypic features item
 */
function mapFeaturesToBadges(features = []) {
    if (features.length === 0) {
        console.log("no features found");
        return (<em>None</em>);
    }
    const arr = features.map((feature) => {
        const { display_title: title, '@id': featureID } = feature;
        return (
            <li key={featureID} className="pr-1">
                <a className="badge badge-info" href={featureID} rel="noopener noreferrer">{title}</a>
            </li>
        );
    });
    return (<ul>{ arr }</ul>);
}

/** @param {Object} props - Contents of a family sub-embedded object. */
export const CaseStats = React.memo(function CaseStats(props){
    const {
        numFamilies = 0,
        numIndividuals = 0,
        numWithSamples = 0,
        className = '',
        caseItem = null
    } = props;

    const { individual = null, family = null } = caseItem || {};
    const { accession: indvAccession = null } = individual || {};
    const { accession: famAccession = null } = family || {};

    return (
        <div id="case-stats">
            <StatDrop defaultOpen={true} title="Patient Info:" subtitle={indvAccession} {...{ className }}>
                <PatientInfo {...props} />
            </StatDrop>
            <div className="row overlapping">
                <div className="col-md-6">
                    <StatDrop title="Family Info:" subtitle={famAccession} {...{ className }}>
                        <FamilyInfo {...{ numFamilies, numIndividuals, numWithSamples, family }} />
                    </StatDrop>
                </div>
                <div className="col-md-6">
                    <StatDrop title="Family Phenotypic Features" {...{ className }}>
                        <PhenotypicFeatures {...family} />
                    </StatDrop>
                </div>
            </div>
        </div>
    );
});

export const StatDrop = React.memo(function StatDrop(props){
    const { defaultOpen = false, title = null, subtitle = null, children = null, className = "" } = props || {};

    // Hooks declared outside of 'if' condition b.c. React hook execution order
    // must stay consistent between renders - https://reactjs.org/docs/hooks-rules.html#only-call-hooks-at-the-top-level
    const [ open, setOpen ] = useState(defaultOpen);
    const toggleOpen = useMemo(function(){
        return function(){ setOpen(!open); };
    }, [ open ]);

    const cls = ("card " + className);

    return (
        <div className={cls + " mb-2"}>
            <h4 className="clickable card-header mt-0 text-600" onClick={toggleOpen}>
                <i className="icon icon-plus fas mr-2"></i>
                { title } <span className="text-300">{ subtitle || null }</span>
            </h4>
            <Collapse in={open}>
                <div className="card-body">
                    { children }
                </div>
            </Collapse>
        </div>
    );
});

export const PatientInfo = React.memo(function PatientInfo(props = null) {
    const {
        caseItem = null
    } = props || {};
    console.log("patientinfo props", props);

    const { '@id': atId, case_title = null, individual = null } = caseItem || {};
    const {
        accession = null,
        sex = null,
        age = null, age_units = null,
        status = null,
        date_created = null,
        life_status = null,
        phenotypic_features = []
    } = individual || {};

    return (
        <div className="row">
            <div className="col-md-6">
                <div className="card-text mb-1">
                    <label className="mb-0">Sex:</label> { sex || 'N/A'}
                </div>
                <div className="card-text mb-1">
                    <label className="mb-0">Age: </label> { age && age_units ? `${age} age_units` : "N/A" }
                </div>
                <div className="card-text mb-1">
                    <label className="mb-0">Life Status:</label> { life_status || 'N/A' }
                </div>
                <div className="card-text mb-1">
                    <label className="mb-0">Status:</label> { status } <i className="item-status-indicator-dot ml-02" />
                </div>
                <div className="card-text mb-1">
                    <label className="mb-0">Accessioned:</label> { date_created ? <LocalizedTime timestamp={date_created} formatType="date-sm"/> : "N/A" }
                </div>
            </div>
            <div className="col-md-6">
                <div className="card-text mb-1">
                    <label className="mb-0">Phenotypic Features:</label> {mapFeaturesToBadges(phenotypic_features)}
                </div>
            </div>
        </div>
    );
});


export const PhenotypicFeatures = React.memo(function PhenotypicFeatures(props = null) {
    const { family = null } = props || {};
    const { family_phenotypic_features: familyFeatures = [] } = family || {};
    const renderedPhenotypicFeatures = mapFeaturesToBadges(familyFeatures);
    return renderedPhenotypicFeatures;
});


export const FamilyInfo = React.memo(function FamilyInfo(props = null) {
    const {
        family = null
    } = props || {};
    const { display_title : family_display_title = null, title: family_title= null, cohort = null, project = null } = family || {};
    const { display_title: project_title } = project || {};

    console.log("family props", family);

    return (
        <>
            <div className="card-text mb-1">
                <label className="mb-0">Family:</label> { family_title || family_display_title || "N/A" }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Cohort:</label> { cohort || "N/A" }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Project:</label> { project_title || "N/A" }
            </div>
        </>);
});