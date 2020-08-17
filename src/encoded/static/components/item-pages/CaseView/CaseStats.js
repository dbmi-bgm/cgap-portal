'use strict';

import React, { useMemo } from 'react';
import _ from 'underscore';
import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Schemas } from './../../util';


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
    const { individual_id = null, phenotypic_features = [] } = individual || {};
    const { accession: famAccession = null, family_phenotypic_features = [] } = family || {};

    const renderedPatientPhenotypicFeatures = useMemo(function(){
        return mapFeaturesToBadges(phenotypic_features);
    }, [ phenotypic_features ]);

    const renderedFamilyPhenotypicFeatures = useMemo(function(){
        return mapFeaturesToBadges(family_phenotypic_features);
    }, [ family_phenotypic_features ]);

    return (
        // Stack into one column at small window size.
        <div id="case-stats" className="row">
            <div className="col-12 col-sm mb-2 mb-sm-0">
                <div className="card h-100">
                    <h4 className="card-header mt-0 text-600">
                        Patient Info: <span className="text-300">{ individual_id }</span>
                    </h4>
                    <div className="card-body">
                        <PatientInfo {...props} />
                    </div>
                    <div className="card-footer">
                        <label className="mb-03 text-large">Patient Phenotypic Features:</label>
                        <div>{renderedPatientPhenotypicFeatures}</div>
                    </div>
                </div>
            </div>
            <div className="col-12 col-sm">
                <div className="card h-100">
                    <h4 className="card-header mt-0 text-600">
                        Family Info: <span className="text-300">{ famAccession }</span>
                    </h4>
                    <div className="card-body">
                        <FamilyInfo {...{ family, caseItem }} />
                    </div>
                    <div className="card-footer">
                        <label className="mb-03 text-large">Family Phenotypic Features: </label>
                        <div>{renderedFamilyPhenotypicFeatures}</div>
                    </div>
                </div>
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
        aliases = null,
        phenotypic_features = []
    } = individual || {};

    const renderedPhenotypicFeatures = useMemo(function(){
        return mapFeaturesToBadges(phenotypic_features);
    }, [ phenotypic_features ]);

    // TODO later maybe use card footer Bootstrap component if such exists.

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
                <label className="mb-0">Status:</label> &nbsp;{ Schemas.Term.toName("status", status, true) }
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

    const renderedPhenotypicFeatures = useMemo(function(){
        return mapFeaturesToBadges(familyFeatures);
    }, [ familyFeatures ]);

    // TODO later maybe use card footer Bootstrap component if such exists.

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
        </>
    );
});