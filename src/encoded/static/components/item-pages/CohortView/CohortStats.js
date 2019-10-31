'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import { Schemas } from './../../util';
import { patchedConsoleInstance } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';


/** @param {Object} props - Contents of a family sub-embedded object. */
export const CohortStats = React.memo(function CaseStats(props){
    const {
        numFamilies = 0,
        numIndividuals = 0,
        numWithSamples = 0,
        description = "N/A",
        cohortFeatures = []
    } = props;


    return (
        <div className="card" id="cohort-stats">
            <div className="card-header" role="heading" level="4">Overview</div>
            <div className="card-body">
                <p className="card-text"><strong>Families:</strong> { numFamilies }</p>
                <p className="card-text"><strong>Individuals:</strong> { numIndividuals } ({numWithSamples} with samples)</p>
                <p className="card-text"><strong>Description:</strong> { description }</p>
            </div>
            <div className="card-footer">
                <label htmlFor="phenotypic-features" className="badge-list-label"><small>Phenotypic Features:</small></label>
                <ul className="badge-list" name="phenotypic-features">
                    {cohortFeatures.map((feature) => {
                        const { display_title: title,
                            uuid: uuid
                        } = feature;

                        return (<li key={uuid} className="pr-1"><a className="badge badge-info" href={`/${uuid}`} rel="noopener noreferrer">{title}</a></li>);
                    })}
                </ul>
            </div>
        </div>
    );
});
