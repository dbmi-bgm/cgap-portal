'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import DefaultItemView from '../DefaultItemView';
import { VariantSampleOverview } from './VariantSampleOverview';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';


export default class VariantSampleView extends DefaultItemView {

    getTabViewContents(){
        const initTabs = [];
        //initTabs.push(PedigreeTabView.getTabObject(this.props));
        //return this.getCommonTabs().concat(initTabs);
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

        this.state = {
            newestVariantSample: null,
            newVSLoading: false,
        };

        this.loadNewestVariantSample = this.loadNewestVariantSample.bind(this);
    }

    componentDidMount() {
        this.loadNewestVariantSample();

    }

    loadNewestVariantSample() {
        const { context: { uuid = null } = {} } = this.props;
        this.setState({ newVSLoading: true }, () => {
            // Do AJAX request to get new variant sample
            // Using embed API instead of datastore=database in order to prevent gene-list related slowdown

            const vsFetchCallback = (resp) => {
                const { 0: { "@id": atID = null } = {} } = resp;
                console.log("pulling new VS resp", resp);

                if (!atID) {
                    Alerts.queue({
                        title: "Some information may be out of date.",
                        style: "warning",
                        message: "Could not retrieve the most recent version of this variant and it's notes. Refresh before making changes to ensure all edits are preserved." });
                }

                this.setState({ newVSLoading: false, newestVariantSample: resp[0] });
            };

            ajax.load(
                '/embed?id=' + uuid,
                vsFetchCallback,
                "POST",
                vsFetchCallback
            );
        });
    }

    render() {
        const { newestVariantSample = null } = this.state;
        return (
            <div>
                <h3 className="tab-section-title container-wide">
                    Annotation Space
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                <div className="container-wide bg-light py-3 mh-inner-tab-height-full">
                    <VariantSampleOverview {...this.props} newContext={newestVariantSample} />
                </div>
            </div>
        );
    }
}