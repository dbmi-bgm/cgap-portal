'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import { Schemas } from './../../util';
import { patchedConsoleInstance } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';


/** @param {Object} props - Contents of a family sub-embedded object. */
export const CohortStats = React.memo(function CaseStats(props){
    const {
        numFamilies,
        numIndividuals
    } = props;

    return (
        <div className="card w-50 mr-1">
            <div className="card-header" role="heading" level="4">Overview</div>
            <div className="card-body">
                <p className="card-text"><strong>Number of Families:</strong> { numFamilies }</p>
                <p className="card-text"><strong>Number of Individuals:</strong> { numIndividuals }</p>
                <p className="card-text"><strong>Lorem Ipsum:</strong> #</p>
                <p className="card-text"><strong>Duren vest:</strong> #</p>
            </div>
        </div>
    );
});
