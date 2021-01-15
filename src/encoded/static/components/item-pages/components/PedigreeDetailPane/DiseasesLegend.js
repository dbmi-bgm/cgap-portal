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
        selectedDiseases = [],
        onToggleSelectedDisease
    } = props;

    if (availableDiseases.length === 0) {
        return null;
    }

    // `selectedDiseases` is passed down to PedigreeViz and assigned data-disease-index by array order.
    // So we must do same here for consistency.
    const selectedMap = useMemo(function(){
        const selectedMap = {};
        selectedDiseases.forEach(function(sD, index){
            // Ordering of `data-disease-index` (and color assignments) start from 1; +1 selectedDisease index.
            selectedMap[sD] = index + 1;
        });
        return selectedMap;
    }, [ selectedDiseases ]);

    return availableDiseases.map(function(aD){
        const {
            display_title: title,
            '@id': id
        } = aD;
        const diseaseIndex = selectedMap[title] || null;
        const checked = !!(diseaseIndex);

        return (
            <div className="detail-row disease-option" key={id}>
                <Checkbox checked={checked}
                    onChange={onToggleSelectedDisease} name={title}
                    className="text-400">
                    <span className="align-middle text-400">{ title }</span>
                </Checkbox>
                <div className="disease-color-patch ml-1" data-disease-index={diseaseIndex}>
                    <span>{ diseaseIndex }</span>
                </div>
            </div>
        );
    });
}