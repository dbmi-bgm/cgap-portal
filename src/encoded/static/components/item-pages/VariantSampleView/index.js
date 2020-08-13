'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import DefaultItemView from '../DefaultItemView';
import { VariantSampleOverview } from './VariantSampleOverview';


export default class VariantSampleView extends DefaultItemView {

    getTabViewContents(){
        const initTabs = [];
        //initTabs.push(PedigreeTabView.getTabObject(this.props));
        //return this.getCommonTabs().concat(initTabs);
        initTabs.push(OverviewTabView.getTabObject(this.props));
        return initTabs.concat(this.getCommonTabs());
    }

}

function OverviewTabView(props){
    return (
        <div>
            <h3 className="tab-section-title container-wide">
                Annotation Space
            </h3>
            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide bg-light py-3 mh-inner-tab-height-full">
                <VariantSampleOverview {...props}/>
            </div>
        </div>
    );
}
OverviewTabView.getTabObject = function(props){
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-sitemap fas icon-fw"/>
                <span>Overview</span>
            </React.Fragment>
        ),
        'key' : 'overview',
        'content' : <OverviewTabView {...props} />
    };
};