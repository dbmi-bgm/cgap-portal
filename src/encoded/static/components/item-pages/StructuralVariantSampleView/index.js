'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import DefaultItemView from '../DefaultItemView';
import { StructuralVariantSampleOverview } from './StructuralVariantSampleOverview';


export default class VariantSampleView extends DefaultItemView {

    getTabViewContents(){
        const initTabs = [];
        initTabs.push(OverviewTabView.getTabObject(this.props));
        return initTabs.concat(this.getCommonTabs());
    }

}

class OverviewTabView extends React.Component {

    static getTabObject(props) {
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
    }

    constructor(props) {
        super(props);
    }

    componentDidMount() {
    }

    render() {
        return (
            <div>
                <h3 className="tab-section-title container-wide">
                    Annotation Space &mdash; Structural Variants
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                <div className="container-wide bg-light py-3 mh-inner-tab-height-full">
                    <StructuralVariantSampleOverview {...this.props} />
                </div>
            </div>
        );
    }
}
