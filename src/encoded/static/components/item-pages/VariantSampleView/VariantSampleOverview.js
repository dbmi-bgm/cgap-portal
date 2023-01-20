'use strict';

import React, { useState, useRef, useCallback } from 'react';
import url from 'url';
import queryString from 'query-string';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import Overlay from 'react-bootstrap/esm/Overlay';
import memoize from 'memoize-one';
import Popover  from 'react-bootstrap/esm/Popover';
import Collapse from 'react-bootstrap/esm/Collapse';
import { console, ajax, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { acmgUtil, navigate } from '../../util';
import { VariantSampleInfoHeader } from './VariantSampleInfoHeader';
import { VariantTabBody } from './VariantTabBody';
import { GeneTabBody } from './GeneTabBody';
import { SampleTabBody } from './SampleTabBody';
import { AnnotationBrowserTabBody } from './AnnotationBrowserTabBody';
import { BamFileBrowserTabBody } from './BamFileBrowserTabBody';
import { InterpretationSpaceHeader, SNVIndelInterpretationSpace } from './InterpretationSpaceController';
import { getInitialTranscriptIndex } from './AnnotationSections';
import QuickPopover from '../components/QuickPopover';


/**
 * Takes in a query from memoizedUrlParse in VSO or SVVSO and returns an object with cleaned fields for interpretation space
 * @param {Object} query object containing the query value pairs from URL
 * @returns {Object} containing showInterpretation as bool, annotation & interp tabs parsed as integers, and case source
 */
export function convertQueryStringTypes(query) {
    const {
        showInterpretation: showInterpretationFromQuery = null, // used only if "True" (toggles showing of interpretation sidebar/pane)
        annotationTab: annotationTabFromQuery = null,           // used only if can be parsed to integer (Variant = 0, Gene = 1, Sample = 2, AnnotationBrowser = 3, BAM Browser = 4)
        interpretationTab: interpretationTabFromQuery = null,   // used only if can be parsed to integer (Variant Notes = 0, Gene Notes = 1, Clinical = 2, Discovery = 3)
        caseSource = null
    } = query || {};

    // Change types to bool & int where applicable.
    const showInterpretation = showInterpretationFromQuery === "True";
    let annotationTab = null;
    if (annotationTabFromQuery !== null) {
        annotationTab = parseInt(annotationTabFromQuery);
        if (isNaN(annotationTab)) {
            annotationTab = null;
        }
    }
    let interpretationTab = null;
    if (interpretationTabFromQuery !== null) {
        interpretationTab = parseInt(interpretationTabFromQuery);
        if (isNaN(interpretationTab)) {
            interpretationTab = null;
        }
    }

    return { showInterpretation, annotationTab, interpretationTab, caseSource };
}

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
        const initialIndex = getInitialTranscriptIndex(transcript);

        this.state = {
            "currentTranscriptIdx": initialIndex,
            "currentGeneItem": null,
            "currentGeneItemLoading": false,
            "currentClinVarResponse": null,
            "currentClinVarResponseLoading": false
        };
        this.loadedGeneCache = {};
    }

    componentDidMount(){
        this.loadGene();
        this.loadClinVarResponse();
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
            this.setState({ "currentGeneItem": cachedGeneItem });
            return;
        }
        this.setState({ "currentGeneItemLoading": true }, ()=>{
            ajax.load(currentGeneID, (currentGeneItem)=>{
                const { "@id": geneAtID } = currentGeneItem;
                if (!geneAtID) {
                    // No view permission, logged out during request, or similar.
                    this.setState({ "currentGeneItemLoading": false });
                    return;
                }
                this.loadedGeneCache[currentGeneID] = currentGeneItem;
                this.setState({ currentGeneItem, "currentGeneItemLoading": false });
            });
        });
    }

    loadClinVarResponse(){
        const { context } = this.props;
        const { variant: { csq_clinvar = null } = {} } = context;

        if (!csq_clinvar) {
            // Likely no view permisison or not available.
            return;
        }

        this.setState({ "currentClinVarResponseLoading": true }, ()=>{
            const callback = (currentClinVarResponse) => {
                const { result: { [csq_clinvar]: { uid } = {} } = {} } = currentClinVarResponse || {};
                if (!uid) {
                    // Some error
                    this.setState({ "currentClinVarResponseLoading": false });
                    return;
                }
                this.setState({ currentClinVarResponse, "currentClinVarResponseLoading": false });
            };
            ajax.load(
                `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=${csq_clinvar}&retmode=json`,
                callback,
                "GET",
                callback,
                null,
                {},
                ["Accept", "Content-Type", "Referer", "X-Requested-With"]
            );
        });
    }

    onSelectTranscript(transcriptIndex){
        this.setState({ "currentTranscriptIdx": parseInt(transcriptIndex) });
    }

    render(){
        const { context = null, schemas, href, setIsSubmitting, isSubmitting, isSubmittingModalOpen, newContext, newVSLoading } = this.props;
        const { currentTranscriptIdx, currentGeneItem, currentGeneItemLoading, currentClinVarResponse, currentClinVarResponseLoading } = this.state;
        const passProps = { context, schemas, href, currentTranscriptIdx, currentGeneItem, currentGeneItemLoading, currentClinVarResponse, currentClinVarResponseLoading };

        const { query = { } } = memoizedUrlParse(href);
        const { showInterpretation, annotationTab, interpretationTab, caseSource } = convertQueryStringTypes(query);

        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                <InterpretationController {...passProps} {...{ showInterpretation, interpretationTab, annotationTab, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen, newContext, newVSLoading }}>
                    <VariantSampleInfoHeader {...passProps} onSelectTranscript={this.onSelectTranscript} />
                    <VariantSampleOverviewTabView {...passProps} />
                </InterpretationController>
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
        this.annotationTab = this.annotationTab.bind(this);
        this.handleTabClick = _.throttle(this.handleTabClick.bind(this), 300);
        this.openPersistentTabs = {}; // N.B. ints are cast to type string when used as keys of object (both insert or lookup)
    }

    componentWillUnmount(){
        this.openPersistentTabs = {};
    }

    // TODO: DRY-ify
    annotationTab(){
        const { href, defaultTab = 0 } = this.props;
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
        const {
            context, schemas,
            currentTranscriptIdx,
            currentGeneItem, currentGeneItemLoading,
            currentClinVarResponse, currentClinVarResponseLoading
        } = this.props;

        const annotationTab = this.annotationTab();

        const tabTitleElements = [];
        const tabBodyElements = []; // [ ...this.cachedTabs ];

        VariantSampleOverviewTabView.tabNames.forEach((title, index) => {
            const tabTitleElemProps = { annotationTab, index, title, "key": index };
            if (index === 0) {
                // If Gene:
                tabTitleElemProps.disabled = !currentGeneItem;
                tabTitleElemProps.loading = currentGeneItemLoading;
            }
            if (index === 1) {
                // If Variant:
                tabTitleElemProps.loading = currentClinVarResponseLoading;
            }
            tabTitleElements.push(<OverviewTabTitle {...tabTitleElemProps} />);

            if (index === annotationTab || this.openPersistentTabs[index]) {
                const commonBodyProps = { context, schemas, index, "active": index === annotationTab, "key": index };
                switch (index) {
                    case 0:
                        tabBodyElements.push(<GeneTabBody {...commonBodyProps} {...{ currentGeneItem, currentGeneItemLoading }} />);
                        break;
                    case 1:
                        tabBodyElements.push(<VariantTabBody {...commonBodyProps} {...{ currentTranscriptIdx, currentClinVarResponse, currentClinVarResponseLoading }} />);
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


export const OverviewTabTitle = React.memo(function OverviewTabTitle(props){
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

/**
 * A component that controls interpretation/classification state shared between all tabs in interpretation space
 * AND the global ACMG invoker. The autoclassification and globalACMGSelections held here are passed into
 * Interpretation Space, used there. ShowACMGInvoker & toggleACMGInvoker toggle visibility for invoker on/off clinical tab.
 *
 * Also renders out annotation space (VariantSampleInfoHeader & VariantSampleOverviewTabView) as child (needed to position it inside of
 * this markup for layout purposes, but wanted to keep separation of functionality, so that component is defined/props are passed
 * in inside VariantSampleOverview).
 */
class InterpretationController extends React.PureComponent {

    constructor(props) {
        super(props);

        const { interpretationTab } = props;

        this.state = {
            globalACMGSelections: [],
            autoClassification: null,
            showACMGInvoker: interpretationTab === 2, // State method passed into Interpretation space and called when clinical tab is selected
        };

        this.toggleACMGInvoker = this.toggleACMGInvoker.bind(this);
        this.toggleInvocation = this.toggleInvocation.bind(this);
        this.invokeAtStrength = this.invokeAtStrength.bind(this);

        this.memoized = {
            flattenGlobalACMGStateIntoArray: memoize(acmgUtil.flattenStateMapIntoArray)
        };

        // A saved instance of autoclassify that other methods will use to calculate classification
        this.classifier = null;
    }

    // componentDidMount() { // use for testing ACMG auto classification calculation in browser console
    //     if (window) {
    //         window.acmgClass = new acmgUtil.AutoClassify([]);
    //     }
    // }

    componentDidUpdate(pastProps) {
        const { newContext = null, newVSLoading } = this.props;
        const { newContext: pastNC = null, newVSLoading: pastVSLoadStatus } = pastProps;

        // If just loaded new context
        if (!pastNC && !newVSLoading && newContext) {
            // console.log("log1: just loaded new context");
            this.initializeACMGFromContext();
        } else if (pastVSLoadStatus && !newVSLoading && !newContext) {
            // If just attempted to load new context and failed... do the same thing (it's handled slightly differently in-method)
            // console.log("log1: just failed at loading new context");
            this.initializeACMGFromContext();
        }
        console.log("pastVSLoading:", pastVSLoadStatus, "\nnewVSLoading:", newVSLoading, "\nnewContext:", newContext);
    }

    /**
     * Should only be called once; if the log ever appears more than that, need to look into.
     */
    initializeACMGFromContext() {
        const { context = null, newContext = null } = this.props;
        // console.log("log1: initializing ACMG from context");

        let acmg_rules_invoked;
        if (newContext) { // if new context is loaded in
            const { interpretation = {} } = newContext;
            acmg_rules_invoked = interpretation.acmg_rules_invoked || [];
        } else { // not successfully loaded in; default to old context
            const { interpretation = {} } = context || {};
            acmg_rules_invoked = interpretation.acmg_rules_invoked || [];
        }

        // Initialize classifier and prepare new state
        const acmgSelections = acmgUtil.criteriaArrayToStateMap(acmg_rules_invoked); // object that maps { rule: strength }
        const classifier = new acmgUtil.AutoClassify(acmgSelections);
        const classification = classifier.getClassification();
        this.classifier = classifier;

        this.setState({ globalACMGSelections: acmgSelections, autoClassification: classification });
    }

    /**
     * Toggles visibility of ACMG invoker (28 clickable rules); currently passed into Interpretation Space and called when interpretation
     * note tabs are switched to and from clinical tab.
     * @param {Function} callback   An optional function to call upon state setting.
     */
    toggleACMGInvoker(callback) {
        const { showACMGInvoker } = this.state;
        this.setState({ showACMGInvoker: !showACMGInvoker }, callback);
    }

    invokeAtStrength(criteria, callback) {
        console.log("invokeAtStrength", criteria, this);
        const { acmg_rule_name: rule = criteria, rule_strength: strength } = criteria;

        const { globalACMGSelections = {} } = this.state;
        const newInvocations = { ...globalACMGSelections };

        if (newInvocations[rule] && newInvocations[rule] !== strength) {
            this.classifier.uninvoke(rule, newInvocations[rule]);
            this.classifier.invoke(rule, strength);
            newInvocations[rule] = strength;
        } else {
            this.classifier.invoke(rule, strength);
            newInvocations[rule] = strength;
        }

        const classification = this.classifier.getClassification();

        const newState = { globalACMGSelections: newInvocations, autoClassification: classification };
        this.setState(newState, () => callback ? callback(newState): undefined );
    }


    /**
     * Called when a new rule is invoked (to default only) or uninvoked
     * @param {Object} criteria     An object with an ACMG rule & strength pair
     * @param {Function} callback   An optional function to call upon state setting
     */
    toggleInvocation(criteria, callback) {
        console.log("toggleInvocation criteria", criteria);
        const { acmg_rule_name: rule = criteria, rule_strength: strength } = criteria;
        const { globalACMGSelections = {} } = this.state;
        const newInvocations = { ...globalACMGSelections };

        const selectedStrength = strength ? strength: "Default";
        if (newInvocations[rule] !== undefined) { // already set (may have strength)
            const newState = newInvocations[rule] ? false: selectedStrength;
            newInvocations[rule] = newState;
            if (newState) {
                this.classifier.invoke(rule, selectedStrength);
            } else {
                this.classifier.uninvoke(rule, selectedStrength);
            }
        } else { // first time setting (won't have strength)
            newInvocations[rule] = selectedStrength;
            this.classifier.invoke(rule, selectedStrength);
        }

        const classification = this.classifier.getClassification();

        const newState = { globalACMGSelections: newInvocations, autoClassification: classification };

        this.setState(newState, () => callback ? callback(newState): undefined);
    }

    render() {
        const { showACMGInvoker, globalACMGSelections, autoClassification } = this.state;
        const { newVSLoading, newContext = null, context, schemas, children, showInterpretation: showInterpretationFromQuery, interpretationTab, href,
            caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen } = this.props;
        const passProps = { schemas, href, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen };

        // Pulling actions and checking for note errors with newcontext; use context if not present
        const {
            actions = [],
            acmg_rules_invoked = [],
            interpretation: { error: interpError = null } = {},
            variant_notes: { error: varNoteError = null } = {},
            gene_notes: { error: geneNoteError = null } = {},
            discovery_interpretation: { error: discoveryError = null } = {}
        } = newContext || context || {};

        const anyNotePermErrors = interpError || varNoteError || geneNoteError || discoveryError;

        const wipACMGSelections = this.memoized.flattenGlobalACMGStateIntoArray(globalACMGSelections);

        const showInterpretationSpace = showInterpretationFromQuery && !anyNotePermErrors && newContext && !newVSLoading;
        console.log(`showInterpretation:${showInterpretationFromQuery}, anyNotePermErrors: ${anyNotePermErrors}, newContext: ${!!newContext}, newVSLoading: ${newVSLoading}`);
        // const showFallbackInterpretationSpace = showInterpretation && !anyNotePermErrors && !newContext && !newVSLoading;

        // TODOs:
        // (1) Probably remove 'isFallback' case (here & downstream) and show some error instead (or nothing).
        //     If user has permission to see the page then they'll get the newContext.
        //     Edit: Removed rendering of it for now since we don't embed notes info on existing context/embedded_list anymore.
        // (2) Possibly rename 'newContext' to 'newestVariantSample' as in index.js just for clarity of where
        //     it's coming from (and since it doesn't have nearly all fields a full context might.. idk)

        return (
            <React.Fragment>
                <Collapse in={!!(showACMGInvoker && newContext)}>
                    <div>{/** Collapse seems not to work without wrapper element */}
                        <ACMGInvoker invokedFromSavedNote={acmg_rules_invoked} {...{ globalACMGSelections }} toggleInvocation={this.toggleInvocation} invokeAtStrength={this.invokeAtStrength} />
                    </div>
                </Collapse>
                <div className="row flex-column-reverse flex-lg-row flex-nowrap">
                    <div className={`${showInterpretationFromQuery || showInterpretationSpace ? "sv-snv-annotation": ""} col`}>
                        {/* Annotation Space passed as child */}
                        { children }
                    </div>
                    { showInterpretationFromQuery && newVSLoading ? <LoadingInterpretationSpacePlaceHolder headerTitle="SNV / Indel Interpretation Space" /> : null }
                    { showInterpretationSpace ?
                        <div className="col flex-grow-1 flex-lg-grow-0 interpretation-space-wrapper-column">
                            <SNVIndelInterpretationSpace {...{ autoClassification, actions }} context={newContext} toggleInvocation={this.toggleInvocation}
                                wipACMGSelections={wipACMGSelections} {...passProps} toggleACMGInvoker={this.toggleACMGInvoker} defaultTab={interpretationTab} />
                        </div> : null }
                </div>
            </React.Fragment>
        );
    }
}

export const LoadingInterpretationSpacePlaceHolder = React.memo(function LoadingInterpretationSpacePlaceHolder(headerTitle) {
    return (
        <div className="col flex-grow-1 flex-lg-grow-0 interpretation-space-wrapper-column">
            <div className="card interpretation-space">
                <InterpretationSpaceHeader {...headerTitle} headerIconCls = "icon icon-poll-h fas" />
                <div className="card-body">
                    <div className="text-center py-5">
                        <i className="icon icon-fw icon-spin icon-circle-notch icon-2x text-muted fas"/>
                    </div>
                </div>
            </div>
        </div>
    );
});

/**
 * 28 ACMG Rules, made clickable and "invokable"; uses passed in methods/state from InterpretationController.
 */
const ACMGInvoker = React.memo(function ACMGInvoker(props) {
    const { globalACMGSelections: invoked = {}, toggleInvocation, invokeAtStrength } = props || {};

    const [ acmgStrengthPopover, setACMGStrengthPopover ] = useState(null);
    const { target: targetIndicatorRef, jsx: acmgStrengthPopoverJSX } = acmgStrengthPopover || {};

    const onRootClickHide = useCallback(function onRootClickHide(e) {
        // If they clicked on another acmg rule, don't close popover after switching popover info
        if (e.target.className !== targetIndicatorRef.current.className) {
            setACMGStrengthPopover(null);
        }
    }, [ acmgStrengthPopover ]);

    return (
        <div className="card flex-row my-3 mt-0">
            <div className="text-600 acmg-guidelines-title">ACMG Rules
                <QuickPopover className="p-1" popID="acmg-info-popover" title="Note on ACMG Tooltips and Auto-Classification" placement="right" tooltip="Click for citation info">
                    <div>
                        <div className="mb-05">
                            The algorithm used to autoclassify variants based on ACMG rules, and the information contained within the ACMG tooltips is based on <a href="https://rdcu.be/cloqS" target="_blank" rel="noreferrer">this publication</a>.
                        </div>
                        <div>
                            <u>Full Citation</u>: Richards, S., Aziz, N., Bale, S. et al. Standards and guidelines for the interpretation of sequence variants: a joint consensus recommendation of the American College of Medical Genetics and Genomics and the Association for Molecular Pathology. Genet Med 17, 405–423 (2015). https://doi.org/10.1038/gim.2015.30
                        </div>
                    </div>
                </QuickPopover>
            </div>
            <ACMGScrollableList {...{ setACMGStrengthPopover, invoked, toggleInvocation, invokeAtStrength }} />
            { acmgStrengthPopover ?
                <Overlay target={targetIndicatorRef} show={!!acmgStrengthPopover} transition={true} placement="bottom"
                    rootClose rootCloseEvent="click" onHide={onRootClickHide}>
                    { acmgStrengthPopoverJSX }
                </Overlay>
                : null }
        </div>
    );
});

function ACMGScrollableList(props) {
    const { invoked, setACMGStrengthPopover, toggleInvocation, invokeAtStrength } = props;
    const commonChildProps = { setACMGStrengthPopover, toggleInvocation, invokeAtStrength };

    return (
        <div className="d-flex acmg-guidelines-invoker align-items-center">
            {acmgUtil.rules.map(function(rule){
                const { [rule]: { description } = {} } = acmgUtil.metadata;
                const strength = invoked[rule];
                return <ACMGInvokableRule key={rule} {...commonChildProps} {...{ rule, strength, description }} />;
            })}
        </div>
    );
}

const ACMGInvokableRule = React.memo(function ACMGInvokableRule(props) {
    const thisRef = useRef(null);
    const { rule, strength, description, toggleInvocation, setACMGStrengthPopover, acmgStrengthPopover, invokeAtStrength } = props;

    const toggleRuleStrengthOptionsPopover = useCallback(function(newState){
        const { globalACMGSelections: { [rule]: newStrength } = {} } = newState;
        if (!acmgStrengthPopover) {
            setACMGStrengthPopover({
                target: thisRef,
                jsx: generateACMGRulePopover(rule, newStrength, invokeAtStrength, setACMGStrengthPopover)
            });
        } else {
            setACMGStrengthPopover(null);
        }
    }, [ setACMGStrengthPopover, thisRef, invokeAtStrength, rule ]);

    const onClick = useCallback(function(e){
        return toggleInvocation({ "acmg_rule_name": rule, "rule_strength": strength }, toggleRuleStrengthOptionsPopover);
    }, [ toggleRuleStrengthOptionsPopover, strength ]); // 'rule' is already compared in toggleRuleStrengthOptionsPopover useCallback wrapper.

    return (
        <div ref={thisRef} className="acmg-invoker clickable ml-02 mr-02 flex-grow-1" key={rule} data-criteria={rule} data-invoked={!!strength}
            onClick={onClick} data-html data-tip={acmgTip(rule, description)}>
            { rule }
        </div>
    );
});

function acmgTip(criteria, description){
    if (criteria && description) {
        return `<h5 class="my-0 mw-10 text-600">${criteria}</h5><div style="max-width: 250px">${description}</div>`;
    }
    return null;
}

function calculateACMGRuleStrengthOptions(rule, selectedStrength) {
    const ruleStrengthOptions = [];

    // Pull ACMG metadata from util
    const evidenceType = acmgUtil.metadata[rule].type;
    const defaultRuleStrength = acmgUtil.metadata[rule].strength;

    // Find true value of current strength (resolve undefined or "Default" values)
    const currStrength = selectedStrength === undefined || selectedStrength === "Default" ? defaultRuleStrength: selectedStrength;

    // Populate list of strengths
    let possibleStrengths;
    if (evidenceType === "benign") {
        possibleStrengths = ["Supporting", "Strong"];
        if (rule === "BA1") {
            possibleStrengths.push("Standalone");
        }
    } else { // Pathogenic
        possibleStrengths = ["Supporting", "Moderate", "Strong", "Very Strong"];
    }

    possibleStrengths.forEach((strength) => {
        const optionData = { "strengthOption": strength };
        if (strength === defaultRuleStrength) { // if default strength for the rule
            optionData.defaultStr = true;
        }
        if (strength === currStrength) { // if currently selected strength for the rule
            optionData.selected = true;
        }
        ruleStrengthOptions.push(optionData);
    });

    return ruleStrengthOptions;
}

function generateACMGRulePopover(rule, selectedStrength, invokerFx, setACMGStrengthPopoverFx) {
    const strengthOptions = calculateACMGRuleStrengthOptions(rule, selectedStrength);

    return (
        <Popover id={"acmg-strength-pop-"+rule}>
            <Popover.Title className="m-0" as="h4">Select ACMG Rule Strength</Popover.Title>
            <Popover.Content className="p-0">
                <div className="list-group list-group-flush acmg-popover-strengths">
                    { strengthOptions.map((options) => {
                        const { strengthOption, selected = false, defaultStr = false } = options;

                        // Display "Very Strong as VeryStrong"
                        let strengthOptionNoSpaces;
                        if (strengthOption === "Very Strong") {
                            strengthOptionNoSpaces = strengthOption.split(" ").join("");
                        }

                        return (
                            <button type="button" disabled={selected} onClick={() => invokerFx({ acmg_rule_name: rule, rule_strength: ( defaultStr ? "Default" : strengthOption ) }, () => setACMGStrengthPopoverFx(null))}
                                key={strengthOption} className={`list-group-item list-group-item-action py-2 text-600 ${selected ? 'active disabled': ""}`}
                                data-criteria={rule} data-invoked={selected}>
                                {rule}{ defaultStr ? null: "_" + (strengthOptionNoSpaces || strengthOption) }
                            </button>)
                        ;
                    })}
                </div>
            </Popover.Content>
        </Popover>
    );
}
