'use strict';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import Overlay from 'react-bootstrap/esm/Overlay';
import Button from 'react-bootstrap/esm/Button';
import memoize from 'memoize-one';
import Popover  from 'react-bootstrap/esm/Popover';
import SplitButton from 'react-bootstrap/esm/SplitButton';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import Collapse from 'react-bootstrap/esm/Collapse';
import { console, layout, ajax, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { acmgUtil } from '../../util';
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
        const { context = null, schemas, href, setIsSubmitting, isSubmitting, isSubmittingModalOpen, newContext, newVSLoading } = this.props;
        const { currentTranscriptIdx, currentGeneItem, currentGeneItemLoading } = this.state;
        const passProps = { context, schemas, currentTranscriptIdx, currentGeneItem, currentGeneItemLoading, href };

        const { query: {
            showInterpretation = true,      // used only if "True" (toggles showing of interpretation sidebar/pane)
            annotationTab = null,           // used only if can be parsed to integer (Variant = 0, Gene = 1, Sample = 2, AnnotationBrowser = 3, BAM Browser = 4)
            interpretationTab = null,       // used only if can be parsed to integer (Variant Notes = 0, Gene Notes = 1, Clinical = 2, Discovery = 3)
            caseSource = null
        } } = memoizedUrlParse(href);

        return (
            <div className="sample-variant-overview sample-variant-annotation-space-body">
                <InterpretationController {...passProps} interpretationTab={parseInt(interpretationTab) !== isNaN ? parseInt(interpretationTab): null} {...{ showInterpretation, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen, newContext, newVSLoading }}>
                    <VariantSampleInfoHeader {...passProps} onSelectTranscript={this.onSelectTranscript} />
                    <VariantSampleOverviewTabView {...passProps} defaultTab={parseInt(annotationTab) !== isNaN ? parseInt(annotationTab) : null} />
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

/**
 * A component that controls interpretation/classification state shared between all tabs in interpretation space
 * AND the global ACMG invoker. The autoclassification and globalACMGSelections held here are passed into
 * Interpretation Space, used there. ShowACMGInvoker & toggleACMGInvoker toggle visibility for invoker on/off clinical tab.
 *
 * Also renders out annotation space (VariantSampleInfoHeader & VariantSampleOverviewTabView) as child (needed to position it inside of
 * this markup for layout purposes, but wanted to keep separation of functionality, so that component is defined/props are passed
 * in inside VariantSampleOverview).
 */
class InterpretationController extends React.Component {

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

        this.memoized = {
            flattenGlobalACMGStateIntoArray: memoize(acmgUtil.flattenStateMapIntoArray)
        };

        // A saved instance of autoclassify that other methods will use to calculate classification
        this.classifier = null;
    }

    componentDidUpdate(pastProps) {
        const { newContext = null, newVSLoading } = this.props;
        const { newContext: pastNC = null, newVSLoading: pastVSLoadStatus } = pastProps;

        // If just loaded new context
        if (!pastNC && !newVSLoading && newContext) {
            console.log("log1: just loaded new context");
            this.initializeACMGFromContext();
        } else if (pastVSLoadStatus && !newVSLoading && !newContext) {
            // If just attempted to load new context and failed... do the same thing (it's handled slightly differently in-method)
            console.log("log1: just failed at loading new context");
            this.initializeACMGFromContext();
        }
        console.log(`pastVSLoading=${pastVSLoadStatus}, newVSLoading=${newVSLoading}, newContext=${newContext}`);
    }

    /**
     * Should only be called once; if the log ever appears more than that, need to look into.
     */
    initializeACMGFromContext() {
        const { context = null, newContext = null } = this.props;
        console.log("log1: initializing ACMG from context");

        let acmg_rules_invoked;
        if (newContext) { // if new context is loaded in
            const { interpretation = {} } = newContext;
            acmg_rules_invoked = interpretation.acmg_rules_invoked || [];
        } else { // not successfully loaded in; default to old context
            const { interpretation = {} } = context || {};
            acmg_rules_invoked = interpretation.acmg_rules_invoked || [];
        }

        // Initialize classifier and prepare new state
        const acmgSelections = acmgUtil.criteriaArrayToStateMap(acmg_rules_invoked);
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

    invokeAtStrength(criteria, strength, callback) {

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

        this.setState({ globalACMGSelections: newInvocations, autoClassification: classification }, callback);
    }

    render() {
        const { showACMGInvoker, globalACMGSelections, autoClassification } = this.state;
        const { newVSLoading, newContext = null, context, schemas, children, showInterpretation, interpretationTab, href,
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

        const showInterpretationSpace = showInterpretation == 'True' && !anyNotePermErrors && newContext && !newVSLoading;
        const showFallbackInterpretationSpace = showInterpretation == 'True' && !anyNotePermErrors && !newContext && !newVSLoading;

        return (
            <React.Fragment>
                <Collapse in={showACMGInvoker && newContext}>
                    <div>{/** Collapse seems not to work without wrapper element */}
                        <ACMGInvoker invokedFromSavedNote={acmg_rules_invoked} {...{ globalACMGSelections }} toggleInvocation={this.toggleInvocation} />
                    </div>
                </Collapse>
                <div className="row flex-column-reverse flex-lg-row flex-nowrap">
                    <div className="col">
                        {/* Annotation Space passed as child */}
                        { children }
                    </div>
                    { showInterpretationSpace ?
                        <div className="col flex-grow-1 flex-lg-grow-0" style={{ flexBasis: "375px" }} >
                            <InterpretationSpaceWrapper {...{ autoClassification, actions }} context={newContext} toggleInvocation={this.toggleInvocation}
                                wipACMGSelections={wipACMGSelections} {...passProps} toggleACMGInvoker={this.toggleACMGInvoker} defaultTab={interpretationTab} />
                        </div> : null }
                    { showFallbackInterpretationSpace ?
                        <div className="col flex-grow-1 flex-lg-grow-0" style={{ flexBasis: "375px" }} >
                            <InterpretationSpaceWrapper isFallback {...{ autoClassification, actions, context }} toggleInvocation={this.toggleInvocation}
                                wipACMGSelections={wipACMGSelections} {...passProps} toggleACMGInvoker={this.toggleACMGInvoker} defaultTab={interpretationTab} />
                        </div> : null }
                </div>
            </React.Fragment>
        );
    }
}

/**
 * 28 ACMG Rules, made clickable and "invokable"; uses passed in methods/state from InterpretationController.
 */
function ACMGInvoker(props) {
    const { globalACMGSelections: invoked = {}, toggleInvocation } = props || {};

    const acmgTip = (criteria, description) => ( criteria && description ? `<h5 class="my-0 mw-10 text-600">${criteria}</h5><div style="max-width: 250px">${description}</div>`: null);

    const [ acmgStrengthPopover, setACMGStrengthPopover ] = useState(null);
    const { target: targetIndicatorRef, jsx: acmgStrengthPopoverJSX } = acmgStrengthPopover || {};

    return (
        <div className="card flex-row my-3 mt-0">
            <div className="text-600 acmg-guidelines-title">ACMG Rules
                <QuickPopover className="p-1" popID="acmg-info-popover" title="Note on ACMG Tooltips and Auto-Classification" content={
                    <div>
                        <div className="mb-05">
                            The algorithm used to autoclassify variants based on ACMG rules, and the information contained within the ACMG tooltips is based on <a href="https://rdcu.be/cloqS" target="_blank" rel="noreferrer">this publication</a>.
                        </div>
                        <div>
                            <u>Full Citation</u>: Richards, S., Aziz, N., Bale, S. et al. Standards and guidelines for the interpretation of sequence variants: a joint consensus recommendation of the American College of Medical Genetics and Genomics and the Association for Molecular Pathology. Genet Med 17, 405–423 (2015). https://doi.org/10.1038/gim.2015.30
                        </div>
                    </div>
                }/>
            </div>
            <ACMGScrollableList {...{ setACMGStrengthPopover, invoked, acmgTip, toggleInvocation }} />
            { acmgStrengthPopover ?
                <Overlay target={targetIndicatorRef} show={!!acmgStrengthPopover} transition={true} placement="bottom" >
                    { acmgStrengthPopoverJSX }
                </Overlay>: null }
        </div>
    );
}

function ACMGScrollableList(props) {
    const { invoked, setACMGStrengthPopover, acmgTip, toggleInvocation } = props;

    return (
        <div className="d-flex acmg-guidelines-invoker align-items-center">
            {acmgUtil.rules.map((rule) => {
                const { [rule]: { description } = {} } = acmgUtil.metadata;
                const strength = invoked[rule];
                return <ACMGInvokableRule key={rule} {...{ rule, strength, acmgTip, setACMGStrengthPopover, toggleInvocation, description }} />;
            })}
        </div>
    );
}

function ACMGInvokableRule(props) {
    const thisRef = useRef(null);
    const { rule, strength, description, acmgTip } = props;

    function toggleRuleStrengthOptions() {
        const { rule, strength, setACMGStrengthPopover, acmgStrengthPopover,  toggleInvocation } = props;
        toggleInvocation({ acmg_rule_name: rule, rule_strength: strength }, () => {
            if (!acmgStrengthPopover) {
                setACMGStrengthPopover({
                    target: thisRef,
                    jsx: getACMGRulePopover(rule, strength, "Pathogenic")
                });
            } else {
                setACMGStrengthPopover(null);
            }
        });
    }

    return (
        <div ref={thisRef} className="acmg-invoker clickable text-600 text-center ml-02 mr-02" key={rule} data-criteria={rule} data-invoked={!!strength}
            onClick={() => toggleRuleStrengthOptions()} style={{ flex: "1" }} data-html data-tip={acmgTip(rule, description)}>
            { rule }
        </div>);
}

// function calculateACMGRuleStrengthOptions(ruleStrength, evidenceType) {
//     const ruleStrengthOptions = [];
//     if (evidenceType === "Benign") {
//         switch (ruleStrength) {
//             case "supporting":
//                 ruleStrengthOptions.push("strong",)
//             case "strong":

//             case "standalone":

//         }
//     }

//     return ruleStrengthOptions;
// }

function getACMGRulePopover(rule, selectedStrength, evidenceType) {

    return (
        <Popover id="test">
            <Popover.Title className="m-0" as="h4">{rule}</Popover.Title>
            <Popover.Content>
                <ul>
                    <li className="selected text-warning">{ selectedStrength }</li>
                </ul>
            </Popover.Content>
        </Popover>);
}

function QuickPopover(props) {
    const { title, content, className, popID, tooltip } = props || {};
    const popover = (
        <Popover id={popID}>
            <Popover.Title className="m-0" as="h4">{title}</Popover.Title>
            <Popover.Content>
                { content }
            </Popover.Content>
        </Popover>
    );
    const cls = "btn btn-link" + (className ? " " + className : "");
    return (
        <OverlayTrigger trigger="focus" placement="right" overlay={popover}>
            { function({ ref, ...triggerHandlers }){
                return (
                    <button type="button" ref={ref} { ...triggerHandlers } className={cls} data-tip={tooltip || "Click for citation info"}>
                        <i className="icon icon-info-circle fas" />
                    </button>
                );
            }}
        </OverlayTrigger>
    );
}