'use strict';

import React, { useState, useMemo } from 'react';
import { Collapse } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Collapse';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';


/**
 * Returns an array of phenotypic features styled as an unordered list of Bootstrap badges.
 * @param {Array} features An array of phenotypic features items
 */
function mapFeaturesToBadges(features = []) {
    if (features.length === 0) {
        return (<em>None</em>);
    }
    const arr = features.map((feature) => {
        const { phenotypic_feature = null } = feature;
        const { display_title = null, '@id': featureID } = phenotypic_feature || {};
        return (
            <li key={featureID} className="pr-1 d-inline">
                <a className="badge badge-info" href={featureID} rel="noopener noreferrer">{ display_title }</a>
            </li>
        );
    });
    return (
        <ul style={{
            listStyleType: "none",
            maxWidth: "100%",
            maxHeight: "25px",
            overflowX: "scroll",
            paddingLeft: "unset",
            marginBottom: "unset",
        }}>
            { arr }
        </ul>
    );
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
    const { individual_id = null } = individual || {};
    const { accession: famAccession = null } = family || {};

    return (
        <div id="case-stats" className="d-flex flex-row justify-content-between">
            <StatCard title="Patient Info:" subtitle={individual_id} {...{ className }} style={{ flexBasis: "calc(50% - 10px)" }}>
                <PatientInfo {...props} />
            </StatCard>
            <div className="d-flex flex-column justify-content-between" style={{ flexBasis: "calc(50% - 10px)" }}>
                <StatCard title="Phenotypic Features" {...{ className }}>
                    <PhenotypicFeatures {...props} />
                </StatCard>
                <StatCard title="Family Info:" subtitle={famAccession} {...{ className }}>
                    <FamilyInfo {...{ numFamilies, numIndividuals, numWithSamples, family }} />
                </StatCard>
            </div>
        </div>
    );
});

export const StatCard = React.memo(function StatDrop(props){
    const { title = null, subtitle = null, children = null, className = "", style = null } = props || {};
    const cls = ("card " + className);

    return (
        <div className={cls} style={style}>
            <h4 className="card-header mt-0 text-600">
                { title } <span className="text-300">{ subtitle || null }</span>
            </h4>
            <div className="card-body">
                { children }
            </div>
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
        display_title = null,
        aliases = null
    } = individual || {};

    return (
        <>
            <div className="card-text mb-1">
                <label className="mb-0">CGAP Individual ID:</label> { accession }
            </div>
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
            <div className="card-text mb-1">
                <label className="mb-0">Aliases:</label> {aliases || "N/A"}
            </div>
        </>
    );
});


export const PhenotypicFeatures = React.memo(function PhenotypicFeatures(props = null) {
    const {
        caseItem = null
    } = props || {};
    const { individual = null } = caseItem || {};
    const { phenotypic_features = [] } = individual || {};

    return mapFeaturesToBadges(phenotypic_features);
});


export const FamilyInfo = React.memo(function FamilyInfo(props = null) {
    const {
        family = null
    } = props || {};
    const {
        display_title : family_display_title = null,
        title: family_title= null,
        family_phenotypic_features: familyFeatures = [],
        cohort = null,
        project = null
    } = family || {};
    const { display_title: project_title } = project || {};

    const renderedPhenotypicFeatures = mapFeaturesToBadges(familyFeatures);

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
            <div className="card-text mb-1">
                <label className="mb-0">Family Phenotypic Features: </label> {renderedPhenotypicFeatures}
            </div>
        </>);
});