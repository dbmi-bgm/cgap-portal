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
    const { caseItem = null, haveCaseEditPermission = false, canonicalFamily = null } = props;
    const { individual = null, "@id": caseAtID } = caseItem || {};
    const { phenotypic_features = [], "@id": individualAtID = null } = individual || {};
    const { family_phenotypic_features = [], "@id": familyAtID = null } = canonicalFamily || {};

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
                    <div className="card-header primary-header d-flex align-items-center">
                        <i className="icon icon-user fas icon-fw mr-1"/>
                        <h4 className="my-0 text-400 flex-grow-1">
                            Patient Info
                        </h4>
                        { haveCaseEditPermission && individualAtID ?
                            <a href={individualAtID + "?currentAction=edit&callbackHref=" + caseAtID}
                                className="text-white-50 ml-12 text-small" data-tip="Edit Individual. Changes may take a few minutes to appear.">
                                <i className="icon icon-fw icon-pencil-alt fas"/>
                            </a>
                            : null }
                    </div>
                    <div className="card-body">
                        <PatientInfo {...{ caseItem, haveCaseEditPermission }} />
                    </div>
                    <div className="card-footer">
                        <label className="py-1 mb-0 text-large">Patient Phenotypic Features:</label>
                        <div>{ renderedPatientPhenotypicFeatures }</div>
                    </div>
                </div>
            </div>
            <div className="col-12 col-sm">
                <div className="card h-100">
                    <div className="card-header primary-header d-flex align-items-center">
                        <i className="icon icon-users fas icon-fw mr-1"/>
                        <h4 className="my-0 text-400 flex-grow-1">
                            Family Info
                        </h4>
                        { haveCaseEditPermission && familyAtID ?
                            <a href={familyAtID + "?currentAction=edit&callbackHref=" + caseAtID}
                                className="text-white-50 ml-12 text-small" data-tip="Edit Family. Changes may take a few minutes to appear.">
                                <i className="icon icon-fw icon-pencil-alt fas"/>
                            </a>
                            : null }
                    </div>
                    <div className="card-body">
                        <FamilyInfo {...{ caseItem, haveCaseEditPermission, canonicalFamily }} />
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
        "@id": individualAtID,
        accession = fallbackElem,
        individual_id = fallbackElem,
        sex = fallbackElem,
        age = null,
        age_units = null,
        status = null,
        date_created = null,
    } = individual || {};

    if (!individual) {
        return (
            <div className="text-center text-italic">
                No Individual Item linked to this Case
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

    // TODO later maybe use card footer Bootstrap component if such exists.

    return (
        <React.Fragment>
            <div className="card-text mb-1">
                <label className="mb-0 mr-06">Individual ID:</label>
                <a href={individualAtID} target="_blank" rel="noopener noreferrer">
                    { individual_id }
                </a>
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">CGAP Individual ID:</label>
                {" "}
                <span className="text-monospace text-small">{ accession }</span>
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Sex (User-Submitted):</label>
                {" "}
                { sex }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Age: </label>
                {" "}
                { age && age_units ? `${age} ${age_units}(s)` : fallbackElem }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0 mr-02">Status:</label>
                {" "}
                { Schemas.Term.toName("status", status, true) || fallbackElem }
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">Accession Date:</label>
                {" "}
                { date_created ? <LocalizedTime timestamp={date_created} formatType="date-sm"/> : fallbackElem }
            </div>
        </React.Fragment>
    );
});


export const FamilyInfo = React.memo(function FamilyInfo({ canonicalFamily }) {
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;
    const {
        "@id": familyAtID,
        accession: familyAccession,
        display_title : familyDisplayTitle = null,
        title: familyTitle= null,
        project: { display_title: projectTitle } = {}
    } = canonicalFamily || {};
    // const { cohort: { display_title: cohortTitle } = {} } = caseItem || {};

    // TODO later perhaps make Project value into a hyperlink once have a Project page/view.

    if (!canonicalFamily) {
        return (
            <div className="text-center text-italic">
                No Family Item linked to this Case
            </div>
        );
    }

    if (!familyAtID) {
        return (
            <div className="text-center text-italic">
                No view permissions
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className="card-text mb-1">
                <label className="mb-0">Family ID:</label>
                {" "}
                <a href={familyAtID} target="_blank" rel="noopener noreferrer">
                    { familyTitle || familyDisplayTitle }
                </a>
            </div>
            <div className="card-text mb-1">
                <label className="mb-0">CGAP Family ID:</label>
                {" "}
                <span className="text-monospace text-small">{ familyAccession }</span>
            </div>
            {/* <div className="card-text mb-1">
                <label className="mb-0">Cohort:</label> { cohortTitle || fallbackElem }
            </div> */}
            <div className="card-text mb-1">
                <label className="mb-0">Project:</label>
                {" "}
                { projectTitle || fallbackElem }
            </div>
        </React.Fragment>
    );
});
