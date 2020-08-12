'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { VariantSampleInfoHeader } from './VariantSampleInfoHeader';
import { GeneTabBody } from './GeneTabBody';




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
            currentGeneItemLoading: false
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
        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                {/* BA1, BS1, BS2, BS3 etc markers here */}
                <VariantSampleInfoHeader { ...{ context, schemas, currentTranscriptIdx, currentGeneItemLoading, currentGeneItem }} onSelectTranscript={this.onSelectTranscript} />
                <VariantSampleOverviewTabView {...{ context, schemas, currentGeneItem, currentGeneItemLoading }} />
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
    const { context, schemas, currentGeneItem, currentGeneItemLoading } = props;
    const [ currentTab, setCurrentTab ] = useState("Variant");
    // TODO change eventually to use 'if' condition or something and distribute props as needed.
    let tabViewBody = null;// { "Variant" : VariantTabBody, "Gene" : GeneTabBody, "Sample" : SampleTabBody }[currentTab];
    if (currentTab === "Variant"){
        tabViewBody = <VariantTabBody {...{ context }} />;
    } else if (currentTab === "Gene") {
        tabViewBody = <GeneTabBody {...{ context, schemas, currentGeneItem, currentGeneItemLoading }} />;
    } else if (currentTab === "Sample") {
        tabViewBody = <SampleTabBody {...{ context }} />;
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
    // TODO in SCSS: give tabs-column hard-coded width, give content-column flex-width
    return (
        <div className="d-flex align-items-flex-start sample-variant-overview-tab-view-container">
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

function VariantTabBody(props){
    return "Test1";
}



function SampleTabBody(props){
    return "Test3";
}


