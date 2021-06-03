'use strict';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import Button from 'react-bootstrap/esm/Button';
import memoize from 'memoize-one';
import Popover  from 'react-bootstrap/esm/Popover';
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
        layout.animateScrollTo(0,0);
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
        const { context = null, schemas, href, setIsSubmitting, isSubmitting, isSubmittingModalOpen } = this.props;
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
                <InterpretationController {...passProps} interpretationTab={parseInt(interpretationTab) !== isNaN ? parseInt(interpretationTab): null} {...{ showInterpretation, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen }}>
                    <VariantSampleInfoHeader {...passProps} onSelectTranscript={this.onSelectTranscript} />
                    <VariantSampleOverviewTabView {...passProps} defaultTab={parseInt(annotationTab) !== isNaN ? parseInt(annotationTab) : null} />
                </InterpretationController>
            </div>
        );
    }
}

function QuickPopover(props) {
    const { title, content, cls, popID, tooltip } = props || {};
    const popover = (
        <Popover id={popID}>
            <Popover.Title className="m-0" as="h4">{title}</Popover.Title>
            <Popover.Content>
                { content }
            </Popover.Content>
        </Popover>
    );
    return (
        <OverlayTrigger trigger="focus" placement="right" overlay={popover}>
            <Button variant="link" className={cls} data-tip={tooltip || "Click for citation info"}><i className="icon icon-info-circle fas" /></Button>
        </OverlayTrigger>
    );
}

class InterpretationController extends React.Component {

    static initializeGlobalACMGState(criteriaArr) {
        const stateObj = {};
        criteriaArr.forEach((criteria) => {
            stateObj[criteria] = true;
        });

        return stateObj;
    }

    static flattenGlobalACMGStateIntoArray(criteriaObj) {
        // Flatten into an array of invoked items
        const invokedFlat = [];
        Object.keys(criteriaObj).forEach((criteria) => {
            if (criteriaObj[criteria]) { invokedFlat.push(criteria); }
        });
        return invokedFlat.sort((a, b) => {
            const orderA = AutoClassify.criteriaToClassification[a].order;
            const orderB = AutoClassify.criteriaToClassification[b].order;
            // Sort so that it aligns with color scheme above
            return orderA - orderB;
        });
    }

    constructor(props) {
        super(props);

        // Initialize global selections based on most recent interpretation from context
        const { interpretationTab, context: { interpretation: { acmg_guidelines = [] } = {} } = {} } = props;
        const acmgSelections = InterpretationController.initializeGlobalACMGState(acmg_guidelines);
        const classifier = new AutoClassify(acmgSelections);
        const classification = classifier.getClassification();

        this.state = {
            globalACMGSelections: acmgSelections,
            autoClassification: classification,
            showACMGInvoker: interpretationTab === 2, // State method passed into Interpretation space and called when clinical tab is selected
        };

        this.toggleACMGInvoker = this.toggleACMGInvoker.bind(this);
        this.toggleInvocation = this.toggleInvocation.bind(this);

        this.memoized = {
            flattenGlobalACMGStateIntoArray: memoize(InterpretationController.flattenGlobalACMGStateIntoArray)
        };
    }

    toggleACMGInvoker(callback) {
        const { showACMGInvoker } = this.state;
        this.setState({ showACMGInvoker: !showACMGInvoker }, callback);
    }

    toggleInvocation(criteria, callback) {
        const { globalACMGSelections = {} } = this.state;
        const newInvocations = { ...globalACMGSelections };

        if (newInvocations[criteria] !== undefined) { // already set
            newInvocations[criteria] = !newInvocations[criteria];

        } else { // first time setting
            newInvocations[criteria] = true;
        }

        // TODO: rework this to have a single instance, updated when new criteria toggled
        const classifier = new AutoClassify(newInvocations);
        const classification = classifier.getClassification();

        this.setState({ globalACMGSelections: newInvocations, autoClassification: classification }, callback);
    }

    render() {
        const { showACMGInvoker, globalACMGSelections, autoClassification } = this.state;
        const { context, schemas, children, showInterpretation, interpretationTab, href, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen } = this.props;
        const passProps = { context, schemas, href, caseSource, setIsSubmitting, isSubmitting, isSubmittingModalOpen };

        const {
            interpretation: { error: interpError = null, acmg_guidelines = [] } = {},
            variant_notes: { error: varNoteError = null } = {},
            gene_notes: { error: geneNoteError = null } = {},
            discovery_interpretation: { error: discoveryError = null } = {}
        } = context || {}; // TODO: Pull from most recent note from db=datastore request

        const anyNotePermErrors = interpError || varNoteError || geneNoteError || discoveryError;

        const wipACMGSelections = this.memoized.flattenGlobalACMGStateIntoArray(globalACMGSelections);

        return (
            <React.Fragment>
                <Collapse in={showACMGInvoker}>
                    <div>{/** Collapse seems not to work without wrapper element */}
                        <ACMGInvoker invokedFromSavedNote={acmg_guidelines} {...{ globalACMGSelections }} toggleInvocation={this.toggleInvocation} />
                    </div>
                </Collapse>
                <div className="row flex-column-reverse flex-lg-row flex-nowrap">
                    <div className="col">
                        {/* Annotation Space passed as child */}
                        { children }
                    </div>
                    { showInterpretation == 'True' && !anyNotePermErrors ?
                        <div className="col flex-grow-1 flex-lg-grow-0" style={{ flexBasis: "375px" }} >
                            <InterpretationSpaceWrapper {...{ autoClassification }} toggleInvocation={this.toggleInvocation} wipACMGSelections={wipACMGSelections} {...passProps} toggleACMGInvoker={this.toggleACMGInvoker} defaultTab={interpretationTab} />
                        </div> : null }
                </div>
            </React.Fragment>
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


class ACMGInvoker extends React.Component {
    render() {
        const { globalACMGSelections: invoked = {}, toggleInvocation } = this.props;

        const acmgTip = (criteria, description) => ( criteria && description ? `<h5 class="my-0 mw-10 text-600">${criteria}</h5><div style="max-width: 250px">${description}</div>`: null);

        return (
            <div className="card flex-row my-3 mt-0">
                <div className="text-600 acmg-guidelines-title">ACMG Rules
                    <QuickPopover cls="p-1" popID="acmg-info-popover" title="Note on ACMG Tooltips and Auto-Classification" content={
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
                <div className="d-flex acmg-guidelines-invoker align-items-center" style={{ height: "50px" }}>
                    {acmgUtil.rules.map((rule) => {
                        const { [rule]: { description } = {} } = acmgUtil.metadata;
                        return (
                            <div className="acmg-invoker clickable text-600 text-center ml-02 mr-02" key={rule} data-criteria={rule} data-invoked={invoked[rule]}
                                onClick={() => toggleInvocation(rule)} style={{ flex: "1" }} data-html data-tip={acmgTip(rule, description)}>
                                { rule }
                            </div>
                        );}
                    )}
                </div>
            </div>
        );
    }
}


class AutoClassify {
    /**
     * Based on https://www.mgz-muenchen.com/files/Public/Downloads/2018/ACMG%20Classification%20of%20Sequence%20Variants.pdf (pg 3)
     */
    static criteriaToClassification = {
        "BA1": { type: "benign", strength: "standalone", order: 1 },
        "BS1": { type: "benign", strength: "strong", order: 2 },
        "BS2": { type: "benign", strength: "strong", order: 2 },
        "BS3": { type: "benign", strength: "strong", order: 2 },
        "BS4": { type: "benign", strength: "strong", order: 2 },
        "BP1": { type: "benign", strength: "supporting", order: 3 },
        "BP2": { type: "benign", strength: "supporting", order: 3 },
        "BP3": { type: "benign", strength: "supporting", order: 3 },
        "BP4": { type: "benign", strength: "supporting", order: 3 },
        "BP5": { type: "benign", strength: "supporting", order: 3 },
        "BP6": { type: "benign", strength: "supporting", order: 3 },
        "BP7": { type: "benign", strength: "supporting", order: 3 },
        "PP1": { type: "pathogenic", strength: "supporting", order: 4 },
        "PP2": { type: "pathogenic", strength: "supporting", order: 4 },
        "PP3": { type: "pathogenic", strength: "supporting", order: 4 },
        "PP4": { type: "pathogenic", strength: "supporting", order: 4 },
        "PP5": { type: "pathogenic", strength: "supporting", order: 4 },
        "PM1": { type: "pathogenic", strength: "moderate", order: 5 },
        "PM2": { type: "pathogenic", strength: "moderate", order: 5 },
        "PM3": { type: "pathogenic", strength: "moderate", order: 5 },
        "PM4": { type: "pathogenic", strength: "moderate", order: 5 },
        "PM5": { type: "pathogenic", strength: "moderate", order: 5 },
        "PM6": { type: "pathogenic", strength: "moderate", order: 5 },
        "PS1": { type: "pathogenic", strength: "strong", order: 6 },
        "PS2": { type: "pathogenic", strength: "strong", order: 6 },
        "PS3": { type: "pathogenic", strength: "strong", order: 6 },
        "PS4": { type: "pathogenic", strength: "strong", order: 6 },
        "PVS1": { type: "pathogenic", strength: "vstrong", order: 7 }
    }

    /**
     * Takes evidence of pathogenicity counts and returns true if Pathogenic criteria invoked
     * @param {Number} vstrong      # of PVS1 evidence invoked
     * @param {Number} strong       # of (PS1–PS4) evidence invoked
     * @param {Number} moderate     # of (PM1–PM6) evidence invoked
     * @param {Number} supporting   # of (PP1–PP5) evidence invoked
     * @returns {boolean}
     */
    static isPathogenic(vstrong, strong, moderate, supporting){
        if (vstrong >= 1) {                             // (i) 1 Very strong (PVS1) AND
            if ((strong >= 1) ||                        //      a) ≥1 Strong (PS1–PS4) OR
                (moderate >= 2) ||                      //      b) ≥2 Moderate (PM1–PM6) OR
                (moderate === 1 && supporting === 1) || //      c) 1 Moderate (PM1–PM6) and 1 supporting (PP1–PP5) OR
                (supporting >= 2)) {                    //      d) d) ≥2 Supporting (PP1–PP5)
                return true;
            }
        }
        if (strong >= 2) {                              // (ii) ≥2 Strong (PS1–PS4) OR
            return true;
        }
        if (strong === 1) {                             // (iii) 1 Strong (PS1–PS4) AND
            if ((moderate >= 3) ||                      //      a) ≥3 Moderate (PM1–PM6) OR
            (moderate === 2 && supporting >= 2) ||      //      b) 2 Moderate (PM1–PM6) AND ≥2 Supporting (PP1–PP5) OR
            (moderate === 1 && supporting >= 4)) {      //      c) 1 Moderate (PM1–PM6) AND ≥4 supporting (PP1–PP5
                return true;
            }
        }

        return false;
    }

    /**
     * Takes evidence of pathogenicity counts and returns true if Likely Pathogenic criteria invoked
     * @param {Number} vstrong      # of PVS1 evidence invoked
     * @param {Number} strong       # of (PS1–PS4) evidence invoked
     * @param {Number} moderate     # of (PM1–PM6) evidence invoked
     * @param {Number} supporting   # of (PP1–PP5) evidence invoked
     * @returns {boolean}
     */
    static isLikelyPathogenic(vstrong, strong, moderate, supporting){
        if ((vstrong === 1 && moderate === 1) ||                    // (i) 1 Very strong (PVS1) AND 1 moderate (PM1–PM6) OR
            (strong === 1 && (moderate === 1 || moderate === 2)) || // (ii) 1 Strong (PS1–PS4) AND 1–2 moderate (PM1–PM6) OR
            (strong === 1 && (supporting >= 2)) ||                  // (iii) 1 Strong (PS1–PS4) AND ≥2 supporting (PP1–PP5) OR
            (moderate >= 3) ||                                      // (iv) ≥3 Moderate (PM1–PM6) OR
            (moderate === 2) && (supporting >= 2) ||                // (v) 2 Moderate (PM1–PM6) AND ≥2 supporting (PP1–PP5) OR
            (moderate === 1) && (supporting >= 4)) {                // (vi) 1 Moderate (PM1–PM6) AND ≥4 supporting (PP1–PP5)
            return true;
        }
        return false;

    }

    /**
     * Takes evidence of benign effect counts and returns true if Benign criteria invoked
     * @param {Number} standalone       # of BA1 evidence invoked
     * @param {Number} strong           # of (BS1-BS4) evidence invoked
     * @returns {boolean}
     */
    static isBenign(standalone, strong){
        if (standalone || strong >= 2) {    // (i) 1 Stand-alone (BA1) OR (ii) ≥2 Strong (BS1–BS4)
            return true;
        }
        return false;
    }

    /**
     * Takes evidence of benign effect counts and returns true if Likely Benign criteria invoked
     * @param {Number} strong           # of (BS1-BS4) evidence invoked
     * @param {Number} supporting       # of (BP1-BP7) evidence invoked
     * @returns {boolean}
     */
    static isLikelyBenign(strong, supporting){
        if ((strong === 1 && supporting >= 1) ||    // (i) 1 Strong (BS1–BS4) and 1 supporting (BP1–BP7) OR
            (supporting >= 2)                       // (ii) ≥2 Supporting (BP1–BP7)
        ) {
            return true;
        }
        return false;
    }

    constructor(invoked) {
        this.evidenceOfPathogenicity = {};
        this.evidenceOfBenignImpact = {};
        this.autoClassification = null;

        this.initializeEvidenceFromInvoked(invoked);

        this.memoized = {
            isBenign: memoize(AutoClassify.isBenign),
            isLikelyBenign: memoize(AutoClassify.isLikelyBenign),
            isPathogenic: memoize(AutoClassify.isPathogenic),
            isLikelyPathogenic: memoize(AutoClassify.isLikelyPathogenic)
        };
    }

    initializeEvidenceFromInvoked(invoked) {
        // console.log("populating with evidence from, ", invoked);
        // Flatten into an array of invoked items
        const invokedFlat = [];
        Object.keys(invoked).forEach((criteria) => {
            if (invoked[criteria]) { invokedFlat.push(criteria); }
        });

        // Collect counts of various evidence types
        invokedFlat.forEach((criteria) => {
            const classification = AutoClassify.criteriaToClassification[criteria];
            if (classification.type === "pathogenic") {
                if (this.evidenceOfPathogenicity[classification.strength] === undefined) {
                    this.evidenceOfPathogenicity[classification.strength] = 1;
                } else {
                    const newValue = this.evidenceOfPathogenicity[classification.strength] + 1;
                    this.evidenceOfPathogenicity[classification.strength] = newValue;
                }
            } else {
                if (this.evidenceOfBenignImpact[classification.strength] === undefined) {
                    this.evidenceOfBenignImpact[classification.strength] = 1;
                } else {
                    const newValue = this.evidenceOfBenignImpact[classification.strength] + 1;
                    this.evidenceOfBenignImpact[classification.strength] = newValue;
                }
            }
        });
    }

    classify() {
        const {
            standalone = null,
            strong: strongb = null,
            supporting: supportingb = null
        } = this.evidenceOfBenignImpact;
        const {
            vstrong = null,
            strong: strongp = null,
            supporting: supportingp = null,
            moderate: moderatep = null
        } = this.evidenceOfPathogenicity;

        // Check for certain benign effect
        const isBenign = this.memoized.isBenign(standalone, strongb);
        let isPathogenic;
        if (isBenign) {
            isPathogenic = this.memoized.isPathogenic(vstrong, strongp, moderatep, supportingp);
            // (Uncertain significance ii) the criteria for benign and pathogenic are contradictory
            return isPathogenic ? "Uncertain significance" : "Benign";
        }

        // Check for certain pathogenicity
        if (isPathogenic === undefined) {
            isPathogenic = this.memoized.isPathogenic(vstrong, strongp, moderatep, supportingp);
        }
        if (isPathogenic) {
            return "Pathogenic";
        }

        // Check for probable benign effect
        const isLikelyBenign = this.memoized.isLikelyBenign(strongb, supportingb);
        let isLikelyPathogenic;
        if (isLikelyBenign) {
            isLikelyPathogenic = this.memoized.isLikelyPathogenic(vstrong, strongp, moderatep, supportingp);
            // (Uncertain significance ii) the criteria for benign and pathogenic are contradictory
            return isLikelyPathogenic ? "Uncertain significance" : "Likely benign";
        }

        // Check for probable pathogenic effect
        if (isLikelyPathogenic === undefined) {
            isLikelyPathogenic = this.memoized.isLikelyPathogenic(vstrong, strongp, moderatep, supportingp);
        }
        if (isLikelyPathogenic) {
            return "Likely pathogenic";
        }

        // (Uncertain significance i) Other criteria shown above are not met
        return "Uncertain significance";
    }

    getClassification() {
        const classification = this.classify();
        this.autoClassification = classification;
        console.log("Final classification...", classification);
        return classification;
    }
}