'use strict';

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';
import { SearchBar } from './SearchBar';


/** Adjusts the right buttons for more CGAP-specific theming */
export function AboveTableControlsBaseCGAP (props) {
    const {
        context, // search context
        children: propChildren,
        navigate,
        isContextLoading = false // Present only on embedded search views
    } = props;
    const panelMap = AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(props);
    panelMap.multiColumnSort.body = React.cloneElement(panelMap.multiColumnSort.body, { "size": "sm", "variant": "outline-dark" });

    //const { context, currentAction, isFullscreen, windowWidth, toggleFullScreen, sortBy } = props;
    const { total: totalResultCount = 0 } = context || {};

    let children = propChildren;
    // Default, if nothing else supplied.
    if (!children) {
        children = (
            <React.Fragment>
                <div className="col-12 col-md-4">
                    <SearchBar {...{ isContextLoading, context, navigate }} />
                </div>
                <div className="col-12 col-md">
                    <span className="text-400" id="results-count">
                        { totalResultCount }
                    </span> Results
                </div>
            </React.Fragment>
        );
    }

    return <AboveTableControlsBase {...props} {...{ children, panelMap }} />;
}
