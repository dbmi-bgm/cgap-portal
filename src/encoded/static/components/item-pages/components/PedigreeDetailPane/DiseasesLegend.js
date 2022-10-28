'use strict';


import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';


import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';


export function DiseasesLegend (props) {
    const {
        availableDiseases = [],
        selectedDiseaseIdxMap = {},
        onToggleSelectedDisease
    } = props;

    if (availableDiseases.length === 0) {
        return null;
    }

    return availableDiseases.map(function(aD, idx){
        const {
            display_title: title,
            '@id': id
        } = aD;

        const diseaseIndex = selectedDiseaseIdxMap[title] || null;
        const checked = !!(diseaseIndex);

        return (
            <div className="detail-row disease-option text-capitalize" key={id}>
                <Checkbox checked={checked}
                    onChange={onToggleSelectedDisease} name={title}
                    labelClassName="text-400 mb-0">
                    <span className="align-middle">{ title }</span>
                </Checkbox>
                <div className="disease-color-patch ml-1" data-disease-index={diseaseIndex}>
                    <span>{ diseaseIndex }</span>
                </div>
            </div>
        );
    });
}