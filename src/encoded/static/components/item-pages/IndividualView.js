'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import DefaultItemView from './DefaultItemView';
import { PedigreeVizLoader } from './components/pedigree-viz-loader';
import { PedigreeTabViewBody, PedigreeFullScreenBtn } from './components/PedigreeTabViewBody';



export default class IndividualView extends DefaultItemView {

    getControllers(){
        return [
            PedigreeVizLoader
        ];
    }

    getTabViewContents(controllerProps = {}){
        const initTabs = [];
        const commonTabProps = { ...this.props, ...controllerProps };
        initTabs.push(PedigreeTabView.getTabObject(commonTabProps));
        return this.getCommonTabs().concat(initTabs);
    }

}

// TODO: Create endpoint to trace family of individual?
export const PedigreeTabView = React.memo(function PedigreeTabView(props){
    const { context, PedigreeVizLibrary, windowWidth, windowHeight } = props;
    const family = [ context ];
    if (context.father){
        family.push(context.father);
    }
    if (context.mother){
        family.push(context.mother);
    }
    // Pass the following `dataset` into PedigreeTabViewBody to visualize this
    // individual's direct parents.
    // Else (for now) it just shows a sample/defaultProps dataset.
    // const dataset = parseFamilyIntoDataset({ members: family, proband: context });
    return (
        <div>
            <h3 className="tab-section-title container-wide">
                <span>Pedigree</span>
                <PedigreeFullScreenBtn />
            </h3>
            <hr className="tab-section-title-horiz-divider"/>
            <PedigreeTabViewBody {...{ PedigreeVizLibrary, windowWidth, windowHeight }} />
        </div>
    );
});

PedigreeTabView.getTabObject = function(props){
    const { context: { father, mother, children = [] } } = props;
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-sitemap fas icon-fw"/>
                <span>Pedigree</span>
            </React.Fragment>
        ),
        'key' : 'pedigree',
        'disabled' : (!father || !mother) && children.length === 0,
        'content' : <PedigreeTabView {...props} />
    };
};

