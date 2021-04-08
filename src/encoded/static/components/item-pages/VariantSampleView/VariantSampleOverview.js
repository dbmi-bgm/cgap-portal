'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { VariantSampleInfoHeader } from './VariantSampleInfoHeader';
import { VariantTabBody } from './VariantTabBody';
import { GeneTabBody } from './GeneTabBody';
import { SampleTabBody } from './SampleTabBody';
import { AnnotationBrowserTabBody } from './AnnotationBrowserTabBody';
import { BamFileBrowserTabBody } from './BamFileBrowserTabBody';
import { InterpretationSpaceController, InterpretationSpaceWrapper } from './InterpretationSpaceController';



export class VariantSampleOverview extends React.PureComponent {

    constructor(props){
        super(props);
        this.loadGene = this.loadGene.bind(this);
        this.onSelectTranscript = this.onSelectTranscript.bind(this);
        const {
            context: {
                variant: {
                    transcript = []
                } = {}
            }
        } = props;

        // Set initial index to most severe or canonical transcript.
        let initialIndex = transcript.findIndex(function({ csq_most_severe }){
            return !!(csq_most_severe);
        });

        if (initialIndex === -1){
            initialIndex = transcript.findIndex(function({ csq_canonical }){
                return !!(csq_canonical);
            });
        }

        if (initialIndex === -1){
            initialIndex = 0;
        }

        this.state = {
            currentTranscriptIdx: initialIndex,
            currentGeneItem: null,
            currentGeneItemLoading: false,
        };
        this.loadedGeneCache = {};
    }

    componentDidMount(){
        this.loadGene();
    }

    componentDidUpdate(pastProps, pastState){
        const { context } = this.props;
        const { currentTranscriptIdx } = this.state;
        const { context: pastContext } = pastProps;
        const { currentTranscriptIdx: pastTranscriptIndex } = pastState;
        if (pastTranscriptIndex !== currentTranscriptIdx) {
            const currentGeneID = getCurrentTranscriptGeneID(context, currentTranscriptIdx);
            const pastGeneID = getCurrentTranscriptGeneID(pastContext, pastTranscriptIndex);
            if (currentGeneID !== pastGeneID) {
                this.loadGene();
            }
        }
    }

    loadGene(){
        const { context } = this.props;
        const { currentTranscriptIdx } = this.state;
        const currentGeneID = getCurrentTranscriptGeneID(context, currentTranscriptIdx);
        console.log("GID", currentGeneID);

        if (!currentGeneID) {
            // Likely no view permisison or something.
            // Probably quite unlikely but just incase.
            return;
        }

        const cachedGeneItem = this.loadedGeneCache[currentGeneID];
        if (cachedGeneItem) {
            this.setState({ currentGeneItem: cachedGeneItem });
            return;
        }
        this.setState({ currentGeneItemLoading: true }, ()=>{
            ajax.load(currentGeneID, (currentGeneItem)=>{
                this.loadedGeneCache[currentGeneID] = currentGeneItem;
                this.setState({ currentGeneItem, currentGeneItemLoading: false });
            });
        });
    }

    onSelectTranscript(transcriptIndex){
        this.setState({ "currentTranscriptIdx": parseInt(transcriptIndex) });
    }

    render(){
        const { context, schemas, href, setIsSubmitting, isSubmitting, isSubmittingModalOpen } = this.props;
        const { currentTranscriptIdx, currentGeneItem, currentGeneItemLoading } = this.state;
        const passProps = { context, schemas, currentTranscriptIdx, currentGeneItem, currentGeneItemLoading, href };

        const { query: {
            showInterpretation = true,      // used only if "True" (toggles showing of interpretation sidebar/pane)
            annotationTab = null,           // used only if can be parsed to integer (Variant = 0, Gene = 1, Sample = 2, AnnotationBrowser = 3, BAM Browser = 4)
            interpretationTab = null,       // used only if one of "Variant Notes", "Gene Notes", "Interpretation"
            caseSource = null
        } } = memoizedUrlParse(href);

        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                <div className="row flex-column-reverse flex-lg-row flex-nowrap">
                    <div className="col">
                        {/* BA1, BS1, BS2, BS3 etc markers here */}
                        <VariantSampleInfoHeader { ...passProps} onSelectTranscript={this.onSelectTranscript} />
                        <VariantSampleOverviewTabView {...passProps} defaultTab={parseInt(annotationTab) !== isNaN ? parseInt(annotationTab) : null} />
                    </div>
                    { showInterpretation == 'True' ?
                        <div className="col flex-grow-1 flex-lg-grow-0" style={{ flexBasis: "375px" }} >
                            <InterpretationSpaceWrapper {...passProps} defaultTab={interpretationTab} {...{ caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen }}/>
                        </div> : null
                    }
                </div>
            </div>
        );
    }
}

function getCurrentTranscriptGeneID(context, transcriptIndex){
    const { variant: { transcript: geneTranscriptList = [] } = {} } = context;
    const { csq_gene : { "@id" : geneID = null } = {} } = geneTranscriptList[transcriptIndex] || {};
    return geneID;
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

class VariantSampleOverviewTabView extends React.PureComponent {

    static tabNames = [
        "Gene",
        "Variant",
        "Sample",
        "Annotation Browser",
        "BAM File Browser"
    ];

    constructor(props){
        super(props);
        const { defaultTab = null } = props;
        this.handleTabClick = _.throttle(this.handleTabClick.bind(this), 300);
        this.state = {
            "currentTab" : defaultTab < 5 ? defaultTab : 1 // Validate that is 0-5
        };
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
        const { context, schemas, currentGeneItem, currentGeneItemLoading, currentTranscriptIdx } = this.props;
        const { currentTab } = this.state;

        const tabTitleElements = [];
        const tabBodyElements = []; // [ ...this.cachedTabs ];

        VariantSampleOverviewTabView.tabNames.forEach((title, index) => {
            const tabTitleElemProps = { currentTab, index, title, "key": index };
            if (index === 1) {
                // If Gene:
                tabTitleElemProps.disabled = !currentGeneItem;
                tabTitleElemProps.loading = currentGeneItemLoading;
            }
            tabTitleElements.push(<OverviewTabTitle {...tabTitleElemProps} />);

            if (index === currentTab || this.openPersistentTabs[index]) {
                const commonBodyProps = { context, schemas, index, "active": index === currentTab, "key": index };
                switch (index) {
                    case 0:
                        tabBodyElements.push(<GeneTabBody {...commonBodyProps} {...{ currentGeneItem, currentGeneItemLoading }} />);
                        break;
                    case 1:
                        tabBodyElements.push(<VariantTabBody {...commonBodyProps} {...{ currentTranscriptIdx }} />);
                        break;
                    case 2:
                        tabBodyElements.push(<SampleTabBody {...commonBodyProps} />);
                        break;
                    case 3:
                        tabBodyElements.push(<AnnotationBrowserTabBody {...commonBodyProps} />);
                        this.openPersistentTabs[3] = true; // Persist open after first appearance.
                        break;
                    case 4:
                        tabBodyElements.push(<BamFileBrowserTabBody {...commonBodyProps} />);
                        this.openPersistentTabs[4] = true; // Persist open after first appearance.
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


