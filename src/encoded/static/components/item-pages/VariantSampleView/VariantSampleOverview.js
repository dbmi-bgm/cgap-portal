'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { VariantSampleInfoHeader } from './VariantSampleInfoHeader';
import { VariantTabBody } from './VariantTabBody';
import { GeneTabBody } from './GeneTabBody';
import { SampleTabBody } from './SampleTabBody';
import { AnnotationBrowserTabBody } from './AnnotationBrowserTabBody';
import { BamFileBrowserTabBody } from './BamFileBrowserTabBody';



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
        let initialIndex = transcript.findIndex(function({ vep_most_severe }){
            return !!(vep_most_severe);
        });

        if (initialIndex === -1){
            initialIndex = transcript.findIndex(function({ vap_canonical }){
                return !!(vap_canonical);
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
        this.setState({ currentTranscriptIdx: parseInt(transcriptIndex) });
    }

    render(){
        const { context, schemas } = this.props;
        const { currentTranscriptIdx, currentGeneItem, currentGeneItemLoading } = this.state;
        const passProps = { context, schemas, currentTranscriptIdx, currentGeneItem, currentGeneItemLoading };
        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                {/* BA1, BS1, BS2, BS3 etc markers here */}
                <VariantSampleInfoHeader { ...passProps} onSelectTranscript={this.onSelectTranscript} />
                <VariantSampleOverviewTabView {...passProps} />
            </div>
        );
    }

}

function getCurrentTranscriptGeneID(context, transcriptIndex){
    const { variant: { transcript: geneTranscriptList = [] } = {} } = context;
    const { vep_gene : { "@id" : geneID = null } = {} } = geneTranscriptList[transcriptIndex] || {};
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
function VariantSampleOverviewTabView(props){
    const { context, schemas, currentGeneItem, currentGeneItemLoading, currentTranscriptIdx } = props;
    const [ currentTab, setCurrentTab ] = useState("Variant");

    let tabViewBody = null;

    // Route by tab title (in future may change into some sort of dot-router 'key' later like '.variant-sample-overview.variant' or something).
    switch (currentTab) {
        case "Variant":
            tabViewBody = <VariantTabBody {...{ context, schemas, currentTranscriptIdx }} />;
            break;
        case "Gene":
            tabViewBody = <GeneTabBody {...{ context, schemas, currentGeneItem, currentGeneItemLoading }} />;
            break;
        case "Sample":
            tabViewBody = <SampleTabBody {...{ context, schemas }} />;
            break;
        case "Annotation Browser":
            tabViewBody = <AnnotationBrowserTabBody {...{ context, schemas }} />;
            break;
        case "BAM File Browser":
            tabViewBody = <BamFileBrowserTabBody {...{ context, schemas }} />;
            break;
        default:
            throw new Error("Unsupported tab");
    }

    const onClick = useMemo(function(){
        return function(e){
            // Event delegation cuz why not. Less event listeners is good usually, tho somewhat moot in React
            // since it has SyntheticEvents anyway.
            if (e.target.type === "button") {
                const tabTitle = e.target.getAttribute("data-tab-title");
                setCurrentTab(tabTitle);
            }
        };
    }, []);

    useEffect(function(){
        // ReactTooltip.rebuild is called by App upon navigation
        // to rebuild tooltips from current DOM.
        // However most tabs' DOM contents not visible until swithc to them
        // so we needa rebuild tooltip upon that.
        // If DotRouter can be reused/integrated here or similar, we can
        // remove this useEffect.
        setTimeout(ReactTooltip.rebuild, 200);
    }, [ currentTab ]);

    // TODO in SCSS: give tabs-column hard-coded width, give content-column flex-width
    return (
        <div className="d-flex align-items-flex-start sample-variant-overview-tab-view-container flex-column flex-lg-row">
            <div className="tabs-column col col-lg-2 col-xl-1 px-0" onClick={onClick}>
                <OverviewTabTitle {...{ currentTab }} title="Variant" />
                <OverviewTabTitle {...{ currentTab }} title="Gene" disabled={!currentGeneItem} loading={currentGeneItemLoading} />
                <OverviewTabTitle {...{ currentTab }} title="Sample" />
                <OverviewTabTitle {...{ currentTab }} title="Annotation Browser" />
                <OverviewTabTitle {...{ currentTab }} title="BAM File Browser" />
            </div>
            <div className="content-column card">
                { tabViewBody }
            </div>
        </div>
    );
}


const OverviewTabTitle = React.memo(function OverviewTabTitle(props){
    const { currentTab, title, disabled = false, loading = false } = props;
    const active = (currentTab === title);
    return (
        <button type="button" className="d-block overview-tab" data-tab-title={title} data-active={active} disabled={disabled}>
            { loading ?
                <i className="icon icon-spin icon-circle-notch fas mr-07"/>
                : title }
        </button>
    );
});


