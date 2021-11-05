'use strict';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import { console, layout, ajax, memoizedUrlParse, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { SvBrowserTabBody } from './SvBrowserTabBody';
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
                <StructuralVariantSampleInfoHeader {...passProps} />
                <StructuralVariantSampleOverviewTabView {...passProps} defaultTab={parseInt(annotationTab) !== isNaN ? parseInt(annotationTab) : null} />
            </div>
        );
    }
}

function StructuralVariantSampleInfoHeader(props){
    const fallbackElem = <em className="text-muted" data-tip="Not Available"> - </em>;

    const {
        context,
        schemas,
        caseID = <span className="text-muted"> - </span>, // null
    } = props;
    const { variant: { ID = fallbackElem } = {} } = context;

    return (
        // Stack these into flex column until large responsive size, then make into row.
        <div className="card mb-24 sample-variant-info-header">
            <div className="card-body">
                <div className="row flex-column flex-lg-row">

                    { caseID ?
                        <div className="inner-card-section col pb-2 pb-lg-0 col-lg-2 col-xl-1 d-flex flex-column">
                            <div className="info-header-title">
                                <h4 className="text-truncate">Case ID</h4>
                            </div>
                            <div className="info-body flex-grow-1 d-flex align-items-center">
                                <h4 className="text-400 text-center w-100">{ caseID }</h4>
                            </div>
                        </div>
                        : null }

                    <div className="inner-card-section col pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Variant Info</h4>
                        </div>
                        <div className="info-body">
                            <div className="row mb-03">
                                <StructuralVariantInfoSection {...{ context }} />
                            </div>
                        </div>
                    </div>
                    <div className="inner-card-section col-lg-4 pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Gene Info</h4>
                        </div>
                        <div className="info-body">
                            <GeneInfoSection {...{ context, schemas }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


/**
 * Takes a sample ID and genotypeLabels array and returns the one associated with the current sample,
 * if any; otherwise returns null.
 */
function calculateGenotype(CALL_INFO, labels) {
    for (let i = 0; i < labels.length; i++) {
        const { sample_id = null, labels: [genotypeLabel] = [] } = labels[i];
        if (CALL_INFO === sample_id) {
            return genotypeLabel;
        }
    }
    return null;
}

function StructuralVariantInfoSection({ context }) {
    const fallbackElem = <em data-tip="Not Available"> - </em>;
    const {
        structural_variant = {},
        CALL_INFO = null,
        genotype_labels = {}
    } = context;
    const {
        size_display = fallbackElem,
        cytoband_display = fallbackElem,
        SV_TYPE = fallbackElem,
        CHROM = "",
        START = "",
        END = ""
    } = structural_variant;

    const longFormTypeMap = { DUP: "Duplication", DEL: "Deletion" }; // may need to update if sv schema is updated/just pull from schema in future

    const genotype = calculateGenotype(CALL_INFO, genotype_labels) || fallbackElem;

    return (
        <div className="col-12">
            <div className="row pb-1 pb-md-03">
                <div className="col-12 col-md-6">
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_type" className="mb-0">Type:</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_type">{longFormTypeMap[SV_TYPE]}</span>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_grch38" className="mb-0">GRCh38:</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_grch38">{`chr${CHROM}:${START}-${END}`}</span>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_grch37" className="mb-0">GRCh37(hg19):</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_grch37">{/* Coming soon */}</span>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-6 pl-2">
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_genotype" className="mb-0">Genotype:</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_genotype">{genotype}</span>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_size" className="mb-0">Size:</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_size">{size_display}</span>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_cytoband" className="mb-0">Cytoband:</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_cytoband">{cytoband_display}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GeneInfoSection({ context }) {
    const fallbackElem = <em data-tip="Not Available"> - </em>;
    const {
        structural_variant: { gene_summary: { contained = fallbackElem, at_breakpoint = fallbackElem, omim_genes = fallbackElem } = {} } = {}
    } = context;
    return (
        <div className="col-12">
            <div className="row pb-1 pb-md-03">
                <div className="col-12 col-md-8">
                    <label htmlFor="contained-genes" className="mb-0">Contained Genes:</label>
                </div>
                <div id="contained-genes" className="col-12 col-md-4">
                    {contained}
                </div>
            </div>
            <div className="row pb-1 pb-md-03">
                <div className="col-12 col-md-8">
                    <label htmlFor="genes-at-breakpoints" className="mb-0">Genes At Breakpoints:</label>
                </div>
                <div id="genes-at-breakpoints" className="col-12 col-md-4">
                    {at_breakpoint}
                </div>
            </div>
            <div className="row pb-1 pb-md-03">
                <div className="col-12 col-md-8">
                    <label htmlFor="omim-genes" className="mb-0">OMIM Genes:</label>
                </div>
                <div id="omim-genes" className="col-12 col-md-4">
                    {omim_genes}
                </div>
            </div>
            <div className="row pb-1 pb-md-03">
                <div className="col-12 col-md-8">
                    <label htmlFor="omim-genes-w-phenotype" className="mb-0">OMIM Genes with Phenotype:</label>
                </div>
                <div id="omim-genes-w-phenotype" className="col-12 col-md-4">
                    {/* coming soon */}
                </div>
            </div>
        </div>
    );
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

    componentDidUpdate(pastProps, pastState){
        const { currentTab: pastTab } = pastState;
        const { currentTab } = this.state;
        if (currentTab !== pastTab) {
            // ReactTooltip.rebuild is called by App upon navigation
            // to rebuild tooltips from current DOM.
            // However most tabs' DOM contents not visible until switch to them
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
