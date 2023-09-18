'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';
import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { FullHeightCalculator } from './../FullHeightCalculator';
import { HiGlassAjaxLoadContainer } from './HiGlassAjaxLoadContainer';

export const HiglassTabView = React.memo(function HiglassTabView(props){
    const {
        heading
    } = props;
    const higlassContainerRef = React.createRef();
    const variantPositionAbsCoord = 100000000;

    return (
        <div>
            <div className="container-wide">
                <h3 className="tab-section-title">
                    { heading }
                </h3>
            </div>
            <hr className="tab-section-title-horiz-divider mb-1"/>
            <div className="container-wide">
                <HiGlassAjaxLoadContainer variantPositionAbsCoord={variantPositionAbsCoord} ref={higlassContainerRef} />
            </div>
        </div>
    );
});
HiglassTabView.defaultProps = {
    'heading' : <span>Annotation browser</span>
};
HiglassTabView.getTabObject = function(props){

    const icon = <i className="icon icon-times fas icon-fw"/>;
    return {
        "tab" : (
            <React.Fragment>
                { icon }
                <span>Annotation browser</span>
            </React.Fragment>
        ),
        "key" : "higlass",
        "disabled"  : false,
        "content" : (
            <React.Fragment>
                <HiglassTabView />
            </React.Fragment>
        ),
        "cache": true
    };
};
