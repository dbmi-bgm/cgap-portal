'use strict';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import { console, layout, ajax, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { SvBrowserTabBody } from './SvBrowserTabBody';
import { VariantSampleInfoHeader } from '../VariantSampleView/VariantSampleInfoHeader';
import { SvGeneTabBody } from './SvGeneTabBody';
import { SvVariantTabBody } from './SvVariantTabBody';
import { SvSampleTabBody } from './SvSampleTabBody';

export class StructuralVariantSampleOverview extends React.PureComponent {

    render(){
        const { context = null, schemas, href } = this.props;
        const passProps = { context, schemas, href };

        const { query: {
            annotationTab = null,           // used only if can be parsed to integer (SvBrowser = 0)
        } } = memoizedUrlParse(href);

        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                <VariantSampleInfoHeader {...passProps} showTranscriptSelection={false} />
                <StructuralVariantSampleOverviewTabView {...passProps} defaultTab={parseInt(annotationTab) !== isNaN ? parseInt(annotationTab) : null} />
            </div>
        );
    }
}



/**
 * We don't want to include DotRouter (or its functionality) in here yet/for-now since
 * this will also be an overlayed UI on CaseView. We might later conditionally pass in like
 * 'onMount' prop/function that could detect if ".variant-tab" or something and then update own state,
 * (componentDidMount can be replicated in functional component using memoized useEffect hook).
 * (I guess it wouldn't need to be a prop, and on CaseView we could theoretically support like #case-info.filtering.variant-sample-overlay.variant-tab ? idk lol)
 *
 * @todo probably eventually move into own file, along w child tabs
 */

class StructuralVariantSampleOverviewTabView extends React.PureComponent {

    static tabNames = [
        "Gene",
        "Variant",
        "Sample",
        "SV Browser"
    ];

    constructor(props){
        super(props);
        const { defaultTab = null } = props;
        this.handleTabClick = _.throttle(this.handleTabClick.bind(this), 300);
        const numTabs = StructuralVariantSampleOverviewTabView.tabNames.length;

        this.state = {
            "currentTab" : defaultTab < numTabs ? defaultTab : 1 // default to Variant unless otherwise specified
        };

        // Setting persistence requires setting index to true for tab in render + using active prop in tabBody component to trigger d-none class when inactive
        this.openPersistentTabs = {}; // N.B. ints are cast to type string when used as keys of object (both insert or lookup)
    }

    componentDidUpdate(pastProps){
        const { currentTab: pastTab } = pastProps;
        const { currentTab } = this.props;
        if (currentTab !== pastTab) {
            // ReactTooltip.rebuild is called by App upon navigation
            // to rebuild tooltips from current DOM.
            // However most tabs' DOM contents not visible until swithc to them
            // so we needa rebuild tooltip upon that.
            // If DotRouter can be reused/integrated here or similar, we can
            // remove this useEffect.
            setTimeout(ReactTooltip.rebuild, 200);
        }
    }

    componentWillUnmount(){
        this.openPersistentTabs = [];
    }

    handleTabClick(e){
        // Event delegation cuz why not. Less event listeners is good usually, tho somewhat moot in React
        // since it has SyntheticEvents anyway.
        if (e.target && e.target.type === "button") {
            const tabTitle = parseInt(e.target.getAttribute("data-tab-index"));
            this.setState({ "currentTab": tabTitle });
        }
    }

    render(){
        const { context, schemas, currentGeneItem, currentGeneItemLoading } = this.props;
        const { currentTab } = this.state;

        const tabTitleElements = [];
        const tabBodyElements = [];

        StructuralVariantSampleOverviewTabView.tabNames.forEach((title, index) => {
            const tabTitleElemProps = { currentTab, index, title, "key": index };

            tabTitleElements.push(<OverviewTabTitle {...tabTitleElemProps} />);

            if (index === currentTab || this.openPersistentTabs[index]) {
                const commonBodyProps = { context, schemas, index, "active": index === currentTab, "key": index };
                switch (index) {
                    case 0: // Gene
                        tabBodyElements.push(<SvGeneTabBody {...commonBodyProps} {...{ currentGeneItem, currentGeneItemLoading }} />);
                        this.openPersistentTabs[0] = true; // Persist open after first appearance.
                        break;
                    case 1: // Variant
                        tabBodyElements.push(<SvVariantTabBody {...commonBodyProps} />);
                        break;
                    case 2: // Sample
                        tabBodyElements.push(<SvSampleTabBody {...commonBodyProps} />);
                        break;
                    case 3: // SV Browser
                        tabBodyElements.push(<SvBrowserTabBody {...commonBodyProps}/>);
                        this.openPersistentTabs[3] = true; // Persist open after first appearance.
                        break;
                    default:
                        throw new Error("Unsupported tab");
                }
            }

        });


        // TODO in SCSS: give tabs-column hard-coded width, give content-column flex-width
        return (
            <div className="d-flex align-items-flex-start sample-variant-overview-tab-view-container flex-column flex-lg-row">
                <div className="tabs-column col col-lg-2 col-xl-1 px-0" onClick={this.handleTabClick}>
                    { tabTitleElements }
                </div>
                <div className="content-column card">
                    { tabBodyElements }
                </div>
            </div>
        );
    }

}


const OverviewTabTitle = React.memo(function OverviewTabTitle(props){
    const { currentTab, title, index, disabled = false, loading = false } = props;
    const active = (currentTab === index);
    return (
        <button type="button" className="d-block overview-tab" data-tab-title={title} data-tab-index={index} data-active={active} disabled={disabled}>
            { loading ?
                <i className="icon icon-spin icon-circle-notch fas mr-07"/>
                : title }
        </button>
    );
});
