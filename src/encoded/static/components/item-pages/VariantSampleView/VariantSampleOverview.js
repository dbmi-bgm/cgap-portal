'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { GeneTabBody } from './GeneTabBody';




export class VariantSampleOverview extends React.PureComponent {

    constructor(props){
        super(props);
        this.loadGene = this.loadGene.bind(this);
        this.onSelectTranscript = this.onSelectTranscript.bind(this);
        // const {
        //     context: {
        //         variant: {
        //             transcript = []
        //         } = {}
        //     }
        // } = props;

        // TODO maybe one of these things will have 'is_default' or something to better-select.
        // const [ { vep_gene: { '@id' : firstGeneID = null } = {} } = {} ] = transcript;

        this.state = {
            currentTranscriptIdx: 0,
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
                <VariantSampleInfoHeader { ...{ context, currentTranscriptIdx, currentGeneItemLoading }} onSelectTranscript={this.onSelectTranscript} />
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

function VariantSampleInfoHeader (props) {
    const { context, currentTranscriptIdx, currentGeneItemLoading, onSelectTranscript } = props;
    const { variant: { transcript: geneTranscriptList = [] } = {} } = context;
    const geneTranscriptListLen = geneTranscriptList.length;

    // Grab it from embedded item, rather than the AJAXed in currentGeneItem, as is more 'up-to-date'.
    const selectedGeneTranscript = geneTranscriptList[currentTranscriptIdx];
    const selectedGeneTitle = <GeneTranscriptDisplayTitle transcript={selectedGeneTranscript} />;

    const geneListOptions = geneTranscriptList.map(function(transcript, idx){
        return (
            <DropdownItem key={idx} eventKey={idx} active={idx === currentTranscriptIdx}>
                <GeneTranscriptDisplayTitle transcript={transcript} />
            </DropdownItem>
        );
    });

    const geneTitleToShow = selectedGeneTranscript ? (
        <span>
            { selectedGeneTitle }
            { currentGeneItemLoading ? <i className="ml-07 icon icon-spin fas icon-circle-notch"/> : null }
        </span>
    ) : (geneTranscriptListLen === 0 ? <em>No genes available</em> : <em>No gene selected</em>);

    // TODO consider common styling for .info-header title, maybe it could be display: flex with align-items: center and vertically
    // center its children equally regardless if text or DropdownButton (and maybe is applied to a div where h4 would become child of it)
    return (
        // Stack these into flex column until large responsive size, then make into row.
        <div className="card mb-24">
            <div className="card-body">
                <div className="row flex-column flex-lg-row">
                    <div className="col col-lg-2">
                        <div className="info-header-title">
                            <h4>Case ID</h4>
                        </div>
                        <div className="info-body">

                        </div>
                    </div>
                    <div className="col">
                        <div className="info-header-title">
                            <h4>Position</h4>
                        </div>
                        <div className="info-body">

                        </div>
                    </div>
                    <div className="col">
                        <div className="d-flex">
                            <div className="info-header-title">
                                <DropdownButton title={geneTitleToShow} variant="outline-dark" onSelect={onSelectTranscript} disabled={geneTranscriptListLen === 0}>
                                    { geneListOptions }
                                </DropdownButton>
                            </div>
                            <div className="flex-grow-1 text-right">
                                {/* BA1, BS1 here maybe */}
                            </div>
                        </div>
                        <div className="info-body">

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GeneTranscriptDisplayTitle({ transcript, className = "text-600" }){
    if (!transcript) return null;
    const {
        vep_canonical = false,
        vep_feature_ncbi = null,
        vep_feature = <em>No Name</em>,
        vep_biotype = null,
        vep_gene : {
            display_title: geneDisplayTitle = null
        } = {}
    } = transcript;
    return (
        <span className={className}>
            <span>{ vep_feature_ncbi || vep_feature }</span>
            <span className="text-400"> ({ geneDisplayTitle || <em>No Gene</em> })</span>
            { vep_canonical ? <span className="text-300"> (canonical)</span> : null }
        </span>
    );
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
            <div className="tabs-column col col-lg-2 px-0" onClick={onClick}>
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


