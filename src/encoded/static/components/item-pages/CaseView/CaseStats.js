'use strict';

import React from 'react';


/** @param {Object} props - Contents of a family sub-embedded object. */
export const CaseStats = React.memo(function CaseStats(props){
    const {
        numFamilies = 0,
        numIndividuals = 0,
        numWithSamples = 0,
        description = "N/A",
        caseFeatures = [],
        className = null
    } = props;

    const cls = ("card" + (className? " " + className : ""));
    const renderedPhenotypicFeatures = (
        caseFeatures.length > 0 ? caseFeatures.map(function(feature){
            const { display_title: title, '@id': featureID } = feature;
            return (
                <li key={featureID} className="pr-1">
                    <a className="badge badge-info" href={featureID} rel="noopener noreferrer">{title}</a>
                </li>
            );
        }) : <em>None</em>
    );

    return (
        <div className={cls} id="case-stats">
            <h4 className="card-header mt-0 text-600">Overview</h4>
            <div className="card-body">
                <div className="card-text mb-1">
                    <label className="mb-0">Families:</label> { numFamilies }
                </div>
                <div className="card-text mb-1">
                    <label className="mb-0">Individuals:</label> { numIndividuals } ({numWithSamples} with samples)
                </div>
                <div className="card-text mb-1">
                    <label className="mb-0">Description:</label> { description }
                </div>
            </div>
            <div className="card-footer">
                <label htmlFor="phenotypic-features" className="badge-list-label"><small>Phenotypic Features:</small></label>
                <ul className="badge-list" name="phenotypic-features">
                    { renderedPhenotypicFeatures }
                </ul>
            </div>
        </div>
    );
});
