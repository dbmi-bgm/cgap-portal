'use strict';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';
import ReactTooltip from 'react-tooltip';
import { console, layout, ajax, memoizedUrlParse, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { navigate } from '../../util';
import { SvBrowserTabBody } from './SvBrowserTabBody';
import { SvGeneTabBody } from './SvGeneTabBody';
import { SvVariantTabBody } from './SvVariantTabBody';
import { SvSampleTabBody } from './SvSampleTabBody';
import { CNVInterpretationSpace } from '../VariantSampleView/InterpretationSpaceController';
import { LoadingInterpretationSpacePlaceHolder, convertQueryStringTypes } from '../VariantSampleView/VariantSampleOverview';
import { SelectedItemsController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/EmbeddedSearchView';
//import { OverviewTabTitle as VSOverviewTabTitle } from './../VariantSampleView/VariantSampleOverview';
import QuickPopover from './../components/QuickPopover';

export class StructuralVariantSampleOverview extends React.PureComponent {

    render(){
        const { context = null, schemas, href, setIsSubmitting, isSubmitting, isSubmittingModalOpen, newContext, newVSLoading } = this.props;
        const passProps = { context, schemas, href };

        console.log("setissubmittingavailable", setIsSubmitting, isSubmitting, isSubmittingModalOpen);
        const { query = {} } = memoizedUrlParse(href);
        const { showInterpretation, annotationTab, interpretationTab, caseSource } = convertQueryStringTypes(query);

        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                <SelectedItemsController isMultiSelect={false} currentAction="selection">
                    <SvInterpretationController {...passProps} {...{ showInterpretation, interpretationTab, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen, newContext, newVSLoading }}>
                        <StructuralVariantSampleInfoHeader {...passProps} />
                        <StructuralVariantSampleOverviewTabView {...passProps} defaultTab={1} {...{ showInterpretation }} />
                    </SvInterpretationController>
                </SelectedItemsController>
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

                    {/* { caseID ?
                        <div className="inner-card-section col pb-2 pb-lg-0 col-lg-2 col-xl-1 d-flex flex-column">
                            <div className="info-header-title">
                                <h4 className="text-truncate">Case ID</h4>
                            </div>
                            <div className="info-body flex-grow-1 d-flex align-items-center">
                                <h4 className="text-400 text-center w-100">{ caseID }</h4>
                            </div>
                        </div>
                        : null } */}

                    <div className="inner-card-section col-lg-12 col-xl-7 pb-2">
                        <div className="info-header-title">
                            <h4>Variant Info</h4>
                        </div>
                        <div className="info-body">
                            <div className="row mb-03">
                                <StructuralVariantInfoSection {...{ context }} />
                            </div>
                        </div>
                    </div>
                    <div className="inner-card-section col-lg-12 col-xl-5 pb-2">
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
        genotype_labels = {},
        callers = [],
        confidence_class = fallbackElem
    } = context;
    const {
        size_display = fallbackElem,
        cytoband_display = fallbackElem,
        SV_TYPE = fallbackElem,
        position_display = fallbackElem,
        hg19_position_display = fallbackElem,
    } = structural_variant;

    const longFormTypeMap = { DUP: "Duplication", DEL: "Deletion" }; // may need to update if sv schema is updated/just pull from schema in future

    const genotype = calculateGenotype(CALL_INFO, genotype_labels) || fallbackElem;

    return (
        <div className="col-12">
            <div className="row pb-1 pb-md-03">
                <div className="col-12 col-md-7">
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
                            <span id="vi_grch38">{position_display}</span>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_grch37" className="mb-0">GRCh37(hg19):
                                <QuickPopover popID="sv_vi_grch37" title={hg19PopoverTitle} className="p-0 ml-02 icon-sm" tooltip="Click here for more information">
                                    { hg19PopoverContent }
                                </QuickPopover>
                            </label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_grch37">{hg19_position_display}</span>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_confidence" className="mb-0">Call Confidence:</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_confidence">{confidence_class}</span>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-5 pl-2">
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
                    <div className="row">
                        <div className="col-12 col-md-6">
                            <label htmlFor="vi_cytoband" className="mb-0">Callers:</label>
                        </div>
                        <div className="col-12 col-md-6">
                            <span id="vi_cytoband">{callers.join(", ") || fallbackElem}</span>
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
        <div className="col-auto" style={{ maxWidth: "400px"}}>
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
        this.annotationTab = this.annotationTab.bind(this);
        this.handleTabClick = _.throttle(this.handleTabClick.bind(this), 300);
        // Setting persistence requires setting index to true for tab in render + using active prop in tabBody component to trigger d-none class when inactive
        this.openPersistentTabs = {}; // N.B. ints are cast to type string when used as keys of object (both insert or lookup)
    }

    componentWillUnmount(){
        this.openPersistentTabs = {};
    }

    // TODO: DRY-ify
    annotationTab(){
        const { href, defaultTab } = this.props;
        const { query: parsedQuery = {} } = memoizedUrlParse(href);
        let { annotationTab = null } = parsedQuery;
        annotationTab = parseInt(annotationTab);
        if (isNaN(annotationTab)) {
            annotationTab = defaultTab;
        }
        return annotationTab;
    }

    // TODO: DRY-ify
    handleTabClick(e){
        const { href } = this.props;
        // Event delegation cuz why not. Less event listeners is good usually, tho somewhat moot in React
        // since it has SyntheticEvents anyway.

        if (e.target && e.target.type === "button") {
            const nextTabIndex = parseInt(e.target.getAttribute("data-tab-index"));
            const hrefParts = memoizedUrlParse(href);
            const { query: parsedQuery = {} } = hrefParts;
            let { annotationTab } = parsedQuery;
            annotationTab = parseInt(annotationTab);
            if (!isNaN(annotationTab) && annotationTab === nextTabIndex) {
                return;
            }
            parsedQuery.annotationTab = nextTabIndex;
            hrefParts.search = "?" + queryString.stringify(parsedQuery);
            const nextHref = url.format(hrefParts);
            // ReactTooltip.rebuild is called by App upon navigation
            // to rebuild tooltips from current DOM.
            navigate(nextHref, { "replace": true, "skipRequest": true });
        }
    }

    render(){
        const { context, schemas, currentGeneItem, currentGeneItemLoading,
            selectedGenes, onSelectGene, onResetSelectedGenes, showInterpretation } = this.props;

        const annotationTab = this.annotationTab();

        const tabTitleElements = [];
        const tabBodyElements = [];

        StructuralVariantSampleOverviewTabView.tabNames.forEach((title, index) => {
            const tabTitleElemProps = { annotationTab, index, title, "key": index };

            tabTitleElements.push(<OverviewTabTitle {...tabTitleElemProps} />);

            if (index === annotationTab || this.openPersistentTabs[index]) {
                const commonBodyProps = { context, schemas, index, "active": index === annotationTab, "key": index };
                switch (index) {
                    case 0: // Gene
                        tabBodyElements.push(<SvGeneTabBody {...commonBodyProps} {...{ currentGeneItem, currentGeneItemLoading, selectedGenes, onSelectGene, onResetSelectedGenes, showInterpretation }} />);
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

// TODO: DRY-ify (maybe import OverviewTabTitle from "./../VariantSampleView/VariantSampleOverview")
const OverviewTabTitle = React.memo(function OverviewTabTitle(props){
    const { annotationTab, title, index, disabled = false, loading = false } = props;
    const active = (annotationTab === index);
    return (
        <button type="button" className="d-block overview-tab" data-tab-title={title} data-tab-index={index} data-active={active} disabled={disabled}>
            { loading ?
                <i className="icon icon-spin icon-circle-notch fas mr-07"/>
                : title }
        </button>
    );
});

class SvInterpretationController extends React.PureComponent {
    // ACMG selection will be handled here, as well as any other selections that need to occur globally

    componentDidUpdate(pastProps, pastState) {
        const { newVSLoading: pastVSLoading, newContext: pastNewContext = null } = pastProps;
        const { isMultiSelect, newVSLoading, newContext, onSelectItem: onSelectGene } = this.props;

        // Finished loading new VS, now initialize highlighted gene selections.
        if ((pastVSLoading && !newVSLoading) && (newContext && !pastNewContext)) {
            const { highlighted_genes: [ highlightedGene = null ] = [] } = newContext;
            if (highlightedGene) {
                onSelectGene(highlightedGene, isMultiSelect);
            }
        }
    }

    render() {
        const {
            newVSLoading,
            newContext = null,
            context,
            schemas,
            children,
            showInterpretation,
            interpretationTab,
            href,
            caseSource,
            setIsSubmitting,
            isSubmitting,
            isSubmittingModalOpen,
            selectedItems: selectedGenes,
            onSelectItem: onSelectGene,
            onResetSelectedItems: onResetSelectedGenes
        } = this.props;

        console.log("selectedItemscontroller props?", this.props);
        const passProps = { schemas, href, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen, selectedGenes, onSelectGene, onResetSelectedGenes };

        // Pulling actions and checking for note errors with newcontext; use context if not present
        const {
            actions = [],
            acmg_rules_invoked = [], // todo
            interpretation: { error: interpError = null } = {},
            variant_notes: { error: varNoteError = null } = {},
            gene_notes: { error: geneNoteError = null } = {},
            discovery_interpretation: { error: discoveryError = null } = {}
        } = newContext || context || {};

        const anyNotePermErrors = interpError || varNoteError || geneNoteError || discoveryError;

        const showInterpretationSpace = showInterpretation && !anyNotePermErrors && newContext && !newVSLoading;

        const childrenWithSelectionProps = React.Children.map(children, function(child){
            if (!React.isValidElement(child)){
                throw new Error('SvInterpretationController expects props.children to be a valid React component instance(s).');
            }
            return React.cloneElement(child, passProps);
        });

        return (
            <React.Fragment>
                {/** ACMG Invoker will go here once new ACMG rules for SVs are determined; might be able to re-use components
                 * from VariantSampleOverview and just use a new class for handling auto-classification. But also possibility that will need entirely new rules. */}
                <div className="row flex-column-reverse flex-lg-row flex-nowrap">
                    <div className={`${showInterpretation || showInterpretationSpace ? "sv-snv-annotation": ""} col`} >
                        {/* Annotation Space passed as child */}
                        { childrenWithSelectionProps }
                    </div>
                    { showInterpretation && newVSLoading ? <LoadingInterpretationSpacePlaceHolder headerTitle="SV / CNV Interpretation Space" /> : null }
                    { showInterpretationSpace ?
                        <div className="col flex-grow-1 flex-lg-grow-0 interpretation-space-wrapper-column">
                            <CNVInterpretationSpace {...{ actions }} context={newContext}
                                {...passProps} defaultTab={interpretationTab} />
                        </div> : null }
                </div>
            </React.Fragment>
        );
    }
}

// This content is also in src/encoded/docs as an html file; if needed for facets, may use that
const hg19PopoverTitle = "The hg19 coordinates for structural variants are calculated.";

const hg19PopoverContent = (
    <div>
        <p>
            All variants are currently called for the hg38 reference genome. If the variant in hg19
            coordinates is not available, the conversion calculation was not successful.
        </p>

        <p>
            For structural variants, both the start and end coordinates are converted to hg19 via an
            implementation of <a href="https://github.com/konstantint/pyliftover">LiftOver</a>. If
            either one of these conversions fails, the variant will not be available in hg19
            coordinates.
        </p>
    </div>
);
