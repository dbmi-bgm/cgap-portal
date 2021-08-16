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
    const { caseItem = null } = props;
    const { individual = null, family = null } = caseItem || {};
    const { phenotypic_features = [] } = individual || {};
    const { family_phenotypic_features = [] } = family || {};

    const renderedPatientPhenotypicFeatures = useMemo(function(){
        const onlyPhenotypicFeatures = phenotypic_features.map((feature) => {
            const { phenotypic_feature = null } = feature;
            return phenotypic_feature;
        });
        return mapFeaturesToBadges(onlyPhenotypicFeatures);
    }, [ phenotypic_features ]);

    const renderedFamilyPhenotypicFeatures = useMemo(function(){
        return mapFeaturesToBadges(family_phenotypic_features);
    }, [ family_phenotypic_features ]);

    return (
        // Stack into one column at small window size.
        <div id="case-stats" className="row">
            <div className="col-12 col-sm mb-2 mb-sm-0">
                <div className="card h-100">
                    <div className="card-header primary-header">
                        <i className="icon icon-user fas icon-fw mr-1"/>
                        <h4 className="my-0 text-400 d-inline-block">
                            Patient Info
                        </h4>
                    </div>
                    <div className="card-body">
                        <PatientInfo {...props} />
                    </div>
                    <div className="card-footer">
                        <label className="py-1 mb-0 text-large">Patient Phenotypic Features:</label>
                        <div>{renderedPatientPhenotypicFeatures}</div>
                    </div>
                </div>
            </div>
            <div className="col-12 col-sm">
                <div className="card h-100">
                    <div className="card-header primary-header">
                        <i className="icon icon-users fas icon-fw mr-1"/>
                        <h4 className="my-0 text-400 d-inline-block">
                            Family Info
                        </h4>
                    </div>
                    <div className="card-body">
                        <FamilyInfo {...{ family, caseItem }} />
                    </div>
                    <div className="card-footer">
                        <label className="py-1 mb-0 text-large">Family Phenotypic Features: </label>
                        <div>{ renderedFamilyPhenotypicFeatures }</div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const PatientInfo = React.memo(function PatientInfo({ caseItem = null }) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;
    const { individual = null } = caseItem || {};
    const {
        accession = fallbackElem,
        individual_id = fallbackElem,
        sex = fallbackElem,
        age = null,
        age_units = null,
        status = null,
        date_created = null,
    } = individual || {};

    // TODO later maybe use card footer Bootstrap component if such exists.

    return (
        <React.Fragment>
            <div className="card-text mb-1">
                <label className="mb-0">Individual ID:</label> { individual_id }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">CGAP Individual ID:</label> { accession }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Sex:</label> { sex }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Age: </label> { age && age_units ? `${age} ${age_units}(s)` : fallbackElem }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Status:</label> &nbsp;{ Schemas.Term.toName("status", status, true) || fallbackElem }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Accession Date:</label> { date_created ? <LocalizedTime timestamp={date_created} formatType="date-sm"/> : fallbackElem }
            </div>
        </React.Fragment>
    );
});


export const FamilyInfo = React.memo(function FamilyInfo({ family, caseItem }) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;
    const {
        accession: familyAccession,
        display_title : familyDisplayTitle = null,
        title: familyTitle= null,
        project: { display_title: projectTitle } = {}
    } = family || {};
    const { cohort: { display_title: cohortTitle } = {} } = caseItem || {};

    // TODO later perhaps make Project value into a hyperlink once have a Project page/view.

    return (
        <React.Fragment>
            <div className="card-text mb-1">
                <label className="mb-0">Family ID:</label> { familyTitle || familyDisplayTitle || fallbackElem }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">CGAP Family ID:</label> { familyAccession }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Cohort:</label> { cohortTitle || fallbackElem }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Project:</label> { projectTitle || fallbackElem }
            </div>
        </React.Fragment>
    );
});