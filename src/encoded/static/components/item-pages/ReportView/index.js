'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import DefaultItemView from './../DefaultItemView';
import { ReportPrintPreviewTab } from './ReportPrintPreviewTab';

export default class ReportView extends DefaultItemView {

    getTabViewContents(){
        return [
            OverviewTabView.getTabObject(this.props),
            ReportPrintPreviewTab.getTabObject(this.props),
            ...this.getCommonTabs()
        ];
    }

}

function OverviewTabView (props) {
    return (
        <React.Fragment>
            <h3 className="tab-section-title container-wide">
                Report Overview
            </h3>
            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide bg-light py-3 mh-inner-tab-height-full">
                Under development
                <br/>
                More coming soon.
            </div>
        </React.Fragment>
    );
}
OverviewTabView.getTabObject = function(props) {
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-eye-dropper fas icon-fw"/>
                <span>Overview</span>
            </React.Fragment>
        ),
        'key' : 'overview',
        'content' : <OverviewTabView {...props} />
    };
};



