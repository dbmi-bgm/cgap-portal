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




export class VariantSampleOverview extends React.PureComponent {

    constructor(props){
        super(props);
        this.loadGene = this.loadGene.bind(this);
        this.loadSample = this.loadSample.bind(this);
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
            loadedSampleItem: null,
            sampleItemLoading: false
        };
        this.loadedGeneCache = {};
    }

    componentDidMount(){
        this.loadGene();
        this.loadSample();
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

    loadSample(){
        const { context: { 'CALL_INFO' : sample_id = null } = {} } = this.props;
        const { loaded_sample_item } = this.state;

        if (sample_id && !loaded_sample_item) {
            console.log("loading sample:", sample_id);
            this.setState({ sampleItemLoading : true }, ()=>{
                ajax.load(`/search/?type=Sample&bam_sample_id=${sample_id}`, (response)=>{
                    // May be multiple results, picking 1st one for now (may update later to check each one)
                    const { '@graph': [sampleItem = null] = [] } = response;
                    console.log("loaded sample item:", sampleItem);
                    this.setState({ loadedSampleItem: sampleItem, sampleItemLoading : false });
                });
            });
        } else if (!sample_id) {
            throw new Error("No Sample Id found for this VariantSample...");
        }
        // else, sample already loaded (currently do nothing, but
        // maybe later do a refresh if it has been a while since original sample load)
    }

    onSelectTranscript(transcriptIndex){
        this.setState({ currentTranscriptIdx: parseInt(transcriptIndex) });
    }

    render(){
        const { context, schemas } = this.props;
        const { currentTranscriptIdx, currentGeneItem, currentGeneItemLoading, loadedSampleItem, sampleItemLoading } = this.state;
        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                {/* BA1, BS1, BS2, BS3 etc markers here */}
                <VariantSampleInfoHeader { ...{ context, schemas, currentTranscriptIdx, currentGeneItemLoading, currentGeneItem }} onSelectTranscript={this.onSelectTranscript} />
                <VariantSampleOverviewTabView {...{ context, schemas, currentGeneItem, currentGeneItemLoading, loadedSampleItem, sampleItemLoading }} />
            </div>
        );
    }

}

function getCurrentTranscriptGeneID(context, transcriptIndex){
    const { variant: { transcript: geneTranscriptList = [] } = {} } = context;
    const { vep_gene : { "@id" : geneID = null } = {} } = geneTranscriptList[transcriptIndex] || {};
    return geneID;
}



/** @todo probably eventually move into own file, along w child tabs */
function VariantSampleOverviewTabView(props){
    const { context, schemas, currentGeneItem, currentGeneItemLoading, loadedSampleItem, sampleItemLoading } = props;
    const [ currentTab, setCurrentTab ] = useState("Variant");

    // TODO change eventually to use 'if' condition or something and distribute props as needed.
    let tabViewBody = null;// { "Variant" : VariantTabBody, "Gene" : GeneTabBody, "Sample" : SampleTabBody }[currentTab];
    if (currentTab === "Variant"){
        tabViewBody = <VariantTabBody {...{ context, schemas }} />;
    } else if (currentTab === "Gene") {
        tabViewBody = <GeneTabBody {...{ context, schemas, currentGeneItem, currentGeneItemLoading }} />;
    } else if (currentTab === "Sample") {
        tabViewBody = <SampleTabBody {...{ context, schemas, loadedSampleItem, sampleItemLoading }} />;
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
                <OverviewTabTitle {...{ currentTab }} title="Gene" disabled={!currentGeneItem} />
                <OverviewTabTitle {...{ currentTab }} title="Sample" />
            </div>
            <div className="content-column card">
                { tabViewBody }
            </div>
        </div>
    );
}


const OverviewTabTitle = React.memo(function OverviewTabTitle(props){
    const { currentTab, title, disabled = false } = props;
    const active = (currentTab === title);
    return (
        <button type="button" className="d-block overview-tab" data-tab-title={title} data-active={active} disabled={disabled}>
            { title }
        </button>
    );
});


