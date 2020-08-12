'use strict';

import React from 'react';
import _ from 'underscore';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';


/**
 * Returns an array of phenotypic features styled as an unordered list of Bootstrap badges.
 * @param {Array} features An array of phenotypic features items
 */
function mapFeaturesToBadges(features = []) {
    if (features.length === 0) {
        return <em>None</em>;
    }
    return features.map(function(feature){
        const { display_title = null, '@id': featureID } = feature;
        return (
            // TODO: create own ~ `.tag` styling or override Bootstrap's default. Maybe.
            <a className="badge badge-pill badge-info text-400 text-small d-inline-block mr-03 mb-03 pb-04"
                href={featureID} target="_blank" rel="noopener noreferrer" key={featureID}>
                { display_title }
            </a>
        );
    });
}

/** @param {Object} props - Contents of a caseItem */
export const CaseStats = React.memo(function CaseStats(props){
    const {
        className = '',
        caseItem = null
    } = props;

    const { individual = null, family = null } = caseItem || {};
    const { individual_id = null } = individual || {};
    const { accession: famAccession = null } = family || {};

    return (
        // Stack into one column at small window size.
        <div id="case-stats" className="row">
            <div className="col-12 col-sm mb-2 mb-sm-0">
                <StatCard title="Patient Info:" subtitle={individual_id} className="h-100">
                    <PatientInfo {...props} />
                </StatCard>
            </div>
            <div className="col-12 col-sm d-flex flex-column">
                <StatCard title="Patient Phenotypic Features" className="mb-2">
                    <PhenotypicFeatures caseItem={caseItem} />
                </StatCard>
                <StatCard title="Family Info:" subtitle={famAccession} className="flex-fill">
                    <FamilyInfo {...{ family, caseItem }} />
                </StatCard>
            </div>
        </div>
    );
});

export const StatCard = React.memo(function StatDrop(props){
    const { title = null, subtitle = null, children = null, className = "", style = null } = props || {};
    const cls = "card" + (className ? " " + className : "");

    return (
        <div className={cls} style={style}>
            <h4 className="card-header mt-0 text-600">
                { title } { subtitle ? <span className="text-300">{ subtitle }</span> : null }
            </h4>
            <div className="card-body">
                { children }
            </div>
        </div>
    );
});

export const PatientInfo = React.memo(function PatientInfo(props) {
    const {
        caseItem = null
    } = props || {};

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
                <label className="mb-0">Age: </label> { age && age_units ? `${age} ${age_units}(s)` : "N/A" }
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


export const PhenotypicFeatures = React.memo(function PhenotypicFeatures({ caseItem }) {
    const { individual = null } = caseItem || {};
    const { phenotypic_features = [] } = individual || {};

    return mapFeaturesToBadges(_.pluck(phenotypic_features, 'phenotypic_feature'));
});


export const FamilyInfo = React.memo(function FamilyInfo({ family, caseItem }) {
    const {
        display_title : familyDisplayTitle = null,
        title: familyTitle= null,
        family_phenotypic_features: familyFeatures = [],
        project = null
    } = family || {};
    const { display_title: projectTitle } = project || {};
    const {
        cohort = null
    } = caseItem || {};
    const { display_title: cohortTitle = null } = cohort || {};

    const renderedPhenotypicFeatures = mapFeaturesToBadges(familyFeatures);

    return (
        <>
            <div className="card-text mb-1">
                <label className="mb-0">Family:</label> { familyTitle || familyDisplayTitle || "N/A" }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Cohort:</label> { cohortTitle || "N/A" }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Project:</label> { projectTitle || "N/A" }
            </div>
            <div className="card-text">
                <label className="mb-03">Family Phenotypic Features: </label>
                <div>{renderedPhenotypicFeatures}</div>
            </div>
        </>);
});