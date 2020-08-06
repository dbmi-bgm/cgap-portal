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

        // TODO maybe one of these things will have 'is_default' or something to better-select.
        const [ { '@id' : firstGeneID = null } = {} ] = extractListOfGenes(props.context);

        this.state = {
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

/** Grab list of gene embedded Items from VariantSample.variant.transcript.vep_gene */
export function extractListOfGenes(variantSampleContext) {
    const { variant : { transcript = [] } = {} } = variantSampleContext;
    // TODO change what this returns as/if needed; maybe return entire transcript if
    // need to build title out of those fields, idk.
    return transcript.map(function({ vep_gene = null }){
        return vep_gene;
    }).filter(function(vep_gene){
        // Eventually we maybe don't filter out vep_gene with view permission 'error'
        // and instead show as disabled option.
        return !vep_gene || vep_gene.error;
    });
}

function VariantSampleInfoHeader (props) {
    const { context, currentGeneID, currentGeneItemLoading, onSelectGene } = props;
    const geneList = useMemo(function(){
        return extractListOfGenes(context);
    }, [ context ]);
    const selectedGene = useMemo(function(){
        const geneListLen = geneList.length;
        for (let i = 0; i < geneListLen; i++) {
            const gene = geneList[i];
            if (gene["@id"] === currentGeneID) {
                return gene;
            }
        }
        return null;
    }, [ geneList, currentGeneID ]);

    // Grab it from embedded item, rather than the AJAXed in currentGeneItem, as is more 'up-to-date'.
    const { display_title: currentGeneTitle = null } = selectedGene || {};

    const geneListOptions = geneList.map(function(gene){
        const { display_title: geneDisplayTitle, '@id' : geneID } = gene;
        const active = (geneID === currentGeneID);
        return (
            <DropdownItem key={geneID} eventKey={geneID} active={active}>
                { geneDisplayTitle }
            </DropdownItem>
        );
    });

    const geneTitleToShow = currentGeneTitle ? (
        <span>
            { currentGeneTitle }
            { currentGeneItemLoading ? <i className="ml-07 icon icon-spin fas icon-circle-notch"/> : null }
        </span>
    ) : <em>No gene selected</em>;

    // TODO consider common styling for .info-header title, maybe it could be display: flex with align-items: center and vertically
    // center its children equally regardless if text or DropdownButton (and maybe is applied to a div where h4 would become child of it)
    return (
        <div className="row">
            <div className="col-2">
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
                        <DropdownButton title={geneTitleToShow} variant="outline-dark" onSelect={onSelectGene}>
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
            <div className="tabs-column" onClick={onClick}>
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


