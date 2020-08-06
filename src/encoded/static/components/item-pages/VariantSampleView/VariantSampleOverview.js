'use strict';

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';



export class VariantSampleOverview extends React.PureComponent {

    constructor(props){
        super(props);
        this.loadGene = this.loadGene.bind(this);
        this.onSelectGene = this.onSelectGene.bind(this);
        const {
            context: {
                variant: {
                    transcript = []
                } = {}
            }
        } = props;

        // TODO maybe one of these things will have 'is_default' or something to better-select.
        const [ { vep_gene: { '@id' : firstGeneID = null } = {} } = {} ] = transcript;

        this.state = {
            // TODO: Maybe change this to be currentTranscriptIndex, since some genes are duplicated in test inserts.. figuring out
            currentGeneID: firstGeneID,
            currentGeneItem: null,
            currentGeneItemLoading: false
        };
        this.loadedGeneCache = {};
    }

    componentDidMount(){
        this.loadGene();
    }

    componentDidUpdate(pastProps, pastState){
        const { currentGeneID } = this.state;
        const { currentGeneID: pastGeneID } = pastState;
        if (pastGeneID !== currentGeneID) {
            this.loadGene();
        }
    }

    loadGene(){
        const { currentGeneID } = this.state;
        const cachedGeneItem = this.loadedGeneCache[currentGeneID];
        if (cachedGeneItem) {
            this.setState({ currentGeneItem: cachedGeneItem });
            return;
        }
        this.setState({ currentGeneItemLoading: true }, ()=>{
            ajax.load(currentGeneID, (currentGeneItem)=>{
                this.setState({ currentGeneItem, currentGeneItemLoading: false });
            });
        });
    }

    onSelectGene(geneID){
        this.setState({ currentGeneID: geneID });
    }

    render(){
        const { context } = this.props;
        const { currentGeneID, currentGeneItem, currentGeneItemLoading } = this.state;
        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                {/* BA1, BS1, BS2, BS3 etc markers here */}
                <VariantSampleInfoHeader { ...{ context, currentGeneID, currentGeneItemLoading }} onSelectGene={this.onSelectGene} />
                <VariantSampleOverviewTabView {...{ context, currentGeneItem, currentGeneItemLoading }} />
            </div>
        );
    }

}

function VariantSampleInfoHeader (props) {
    const { context, currentGeneID, currentGeneItemLoading, onSelectGene } = props;
    const { variant: { transcript: geneTranscriptList = [] } = {} } = context;
    const geneTranscriptListLen = geneTranscriptList.length;

    // Grab it from embedded item, rather than the AJAXed in currentGeneItem, as is more 'up-to-date'.
    const selectedGeneTranscript = useMemo(function(){
        for (let i = 0; i < geneTranscriptListLen; i++) {
            const transcript = geneTranscriptList[i];
            if (transcript.vep_gene["@id"] === currentGeneID) {
                return transcript;
            }
        }
        return null;
    }, [ geneTranscriptList, currentGeneID ]);

    const currentGeneTitle = <GeneTranscriptDisplayTitle transcript={selectedGeneTranscript} />;

    const geneListOptions = geneTranscriptList.map(function(transcript){
        const { vep_gene : { '@id' : geneID = null } = {} } = transcript;
        const active = (geneID === currentGeneID);
        return (
            <DropdownItem key={geneID} eventKey={geneID} active={active}>
                <GeneTranscriptDisplayTitle transcript={transcript} />
            </DropdownItem>
        );
    });

    const geneTitleToShow = selectedGeneTranscript ? (
        <span>
            { currentGeneTitle }
            { currentGeneItemLoading ? <i className="ml-07 icon icon-spin fas icon-circle-notch"/> : null }
        </span>
    ) : (geneTranscriptListLen === 0 ? <em>No genes available</em> : <em>No gene selected</em>);

    // TODO consider common styling for .info-header title, maybe it could be display: flex with align-items: center and vertically
    // center its children equally regardless if text or DropdownButton (and maybe is applied to a div where h4 would become child of it)
    return (
        // Stack these into flex column until large responsive size, then make into row.
        <div className="row flex-column flex-lg-row">
            <div className="col col-lg-2">
                <h4 className="info-header-title">
                    Case ID
                </h4>
                <div className="info-body">

                </div>
            </div>
            <div className="col">
                <h4 className="info-header-title">
                    Position
                </h4>
                <div className="info-body">

                </div>
            </div>
            <div className="col">
                <div className="d-flex">
                    <h4 className="info-header-title">
                        <DropdownButton title={geneTitleToShow} variant="outline-dark" onSelect={onSelectGene} disabled={geneTranscriptListLen === 0}>
                            { geneListOptions }
                        </DropdownButton>
                    </h4>
                    <div className="flex-grow-1 text-right">
                        {/* BA1, BS1 here maybe */}
                    </div>
                </div>
                <div className="info-body">

                </div>
            </div>
        </div>
    );
}

function GeneTranscriptDisplayTitle({ transcript, className = null }){
    if (!transcript) return null;
    const {
        vep_canonical = false,
        vep_biotype = null,
        vep_gene : {
            display_title: geneDisplayTitle = null
        } = {}
    } = transcript;
    return (
        <span className={className}>
            <span>{ geneDisplayTitle || <em>No Gene</em> }</span>
            { vep_canonical ? <span className="text-300"> (canonical)</span> : null }
            { vep_biotype ? <span className="text-300"> ({ vep_biotype })</span> : null }
        </span>
    );
}


/** @todo probably eventually move into own file, along w child tabs */
function VariantSampleOverviewTabView(props){
    const { context, currentGeneItem, currentGeneItemLoading } = props;
    const [ currentTab, setCurrentTab ] = useState("Variant");
    // TODO change eventually to use 'if' condition or something and distribute props as needed.
    let tabViewBody = null;// { "Variant" : VariantTabBody, "Gene" : GeneTabBody, "Sample" : SampleTabBody }[currentTab];
    if (currentTab === "Variant"){
        tabViewBody = <VariantTabBody {...{ context }} />;
    } else if (currentTab === "Gene") {
        tabViewBody = <GeneTabBody {...{ context, currentGeneItem, currentGeneItemLoading }} />;
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
                <OverviewTabTitle {...{ currentTab }} title="Gene" />
                <OverviewTabTitle {...{ currentTab }} title="Sample" />
            </div>
            <div className="content-column">
                { tabViewBody }
            </div>
        </div>
    );
}


const OverviewTabTitle = React.memo(function OverviewTabTitle(props){
    const { currentTab, title } = props;
    const active = (currentTab === title);
    return (
        <button type="button" className="d-block overview-tab" data-tab-title={title} data-active={active} disabled={active}>
            { title }
        </button>
    );
});

function VariantTabBody(props){
    return "Test1";
}

function GeneTabBody(props){
    return "Test2";
}

function SampleTabBody(props){
    return "Test3";
}


