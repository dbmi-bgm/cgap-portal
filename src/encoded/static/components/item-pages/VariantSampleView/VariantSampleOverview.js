'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import memoize from 'memoize-one';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import Collapse from 'react-bootstrap/esm/Collapse';
import { console, layout, ajax, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

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
        return invokedFlat.sort(); // TODO: sort so that it aligns with color scheme above
    }

    constructor(props) {
        super(props);

        // Initialize global selections based on most recent interpretation from context
        const { interpretationTab, context: { interpretation: { acmg_guidelines = [] } = {} } = {} } = props;
        const acmgSelections = InterpretationController.initializeGlobalACMGState(acmg_guidelines);

        this.state = {
            globalACMGSelections: acmgSelections,
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

        // TODO: re-add autoclassification update method here-ish/maybe in callback?

        this.setState({ globalACMGSelections: newInvocations }, callback);
    }

    render() {
        const { showACMGInvoker, globalACMGSelections } = this.state;
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
                            <InterpretationSpaceWrapper wipACMGSelections={wipACMGSelections} {...passProps} toggleACMGInvoker={this.toggleACMGInvoker} defaultTab={interpretationTab} />
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
    constructor(props) {
        super(props);

        this.state = {
            autoClassification: null
        };

        // this.classifier = new AutoClassify(newInvocations);
    }

    // const classifier = new AutoClassify(newInvocations);
    // const classification = classifier.getClassification();

    render() {
        const { autoClassification = null } = this.state;
        const { globalACMGSelections: invoked = {}, toggleInvocation } = this.props;

        const acmgCriteria = [
            { criteria: "BA1", description: "Allele frequency is >5% in Exome Sequencing Project, 1000 Genomes Project, or Exome Aggregation Consortium" },
            { criteria: "BS1", description: "Allele frequency is greater than expected for disorder (see Table 6)" },
            { criteria: "BS2", description: "Observed in a healthy adult individual for a recessive (homozygous), dominant (heterozygous), or X-linked (hemizygous) disorder, with full penetrance expected at an early age" },
            { criteria: "BS3", description: "Well-established in vitro or in vivo functional studies show no damaging effect on protein function or splicing" },
            { criteria: "BS4", description: "Lack of segregation in affected members of a family<br/><br/><ul><li>Caveat: The presence of phenocopies for common phenotypes (i.e., cancer, epilepsy) can mimic lack of segregation among affected individuals. Also, families may have more than one pathogenic variant contributing to an autosomal dominant disorder, further confounding an apparent lack of segregation.</li></ul>" },
            { criteria: "BP1", description: "Missense variant in a gene for which primarily truncating variants are known to cause disease" },
            { criteria: "BP2", description: "Observed in trans with a pathogenic variant for a fully penetrant dominant gene/disorder or observed in cis with a pathogenic variant in any inheritance pattern" },
            { criteria: "BP3", description: "In-frame deletions/insertions in a repetitive region without a known function" },
            { criteria: "BP4", description: "Multiple lines of computational evidence suggest no impact on gene or gene product (conservation, evolutionary, splicing impact, etc.)<br/><br/><ul><li>Caveat: Because many in silico algorithms use the same or very similar input for their predictions, each algorithm cannot be counted as an independent criterion. BP4 can be used only once in any evaluation of a variant.</li></ul>" },
            { criteria: "BP5", description: "Variant found in a case with an alternate molecular basis for disease" },
            { criteria: "BP6", description: "Reputable source recently reports variant as benign, but the evidence is not available to the laboratory to perform an independent evaluation" },
            { criteria: "BP7", description: "A synonymous (silent) variant for which splicing prediction algorithms predict no impact to the splice consensus sequence nor the creation of a new splice site AND the nucleotide is not highly conserved" },
            { criteria: "PP1", description: "Co segregation with disease in multiple affected family members in a gene definitively known to cause the disease<br/><br/><ul><li>Note: May be used as stronger evidence with increasing segregation data</li></ul>" },
            { criteria: "PP2", description: "Missense variant in a gene that has a low rate of benign missense variation and in which missense variants are acommon mechanism of disease" },
            { criteria: "PP3", description: "Multiple lines of computational evidence support a deleterious effect on the gene or gene product (conservation, evolutionary, splicing impact, etc.)<br/><ul><li>Caveat: Because many in-silico algorithms use the same or very similar input for their predictions, each algorithm should not be counted as an independent criterion. PP3 can be used only once in any evaluation of a variant.</li></ul>" },
            { criteria: "PP4", description: "Patient’s phenotype or family history is highly specific for a disease with a single genetic etiology" },
            { criteria: "PP5", description: "Reputable source recently reports variant as pathogenic, but the evidence is not available to the laboratory to perform an independent evaluation" },
            { criteria: "PM1", description: "Located in a mutational hot spot and/or critical and well-established functional domain (e.g., active site of an enzyme) without benign variation." },
            { criteria: "PM2", description: "Absent from controls (or at extremely low frequency if recessive) (Table 6) in Exome Sequencing Project, 1000 Genomes Project, or Exome Aggregation Consortium<br/><ul><li>Caveat: Population data for insertions/deletions may be poorly called by next-generation sequencing</li></ul>" },
            { criteria: "PM3", description: "For recessive disorders, detected in trans with a pathogenic variant<br/><br/><em>Note: This requires testing of parents (or offspring) to determine phase.</em>" },
            { criteria: "PM4", description: "Protein length changes as a result of in-frame deletions/insertions in a nonrepeat region or stop-loss variants" },
            { criteria: "PM5", description: "Novel missense change at an amino acid residue where a different missense change determined to be pathogenic has been seen before<br/><ul><li>Example: Arg156His is pathogenic; now you observe Arg156Cys</li><li>Caveat: Beware of changes that impact splicing rather than at the amino acid/protein level.</li></ul>" },
            { criteria: "PM6", description: "Assumed de novo, but without confirmation of paternity and maternity" },
            { criteria: "PS1", description: "Same amino acid change as a previously established pathogenic variant regardless of nucleotide change<br/><ul><li>Example: Val→Leu caused by either G>C or G>T in the same codon</li><li>Caveat: Beware of changes that impact splicing rather than at the amino acid/protein level</li></ul>" },
            { criteria: "PS2", description: "De novo (both maternity and paternity confirmed) in a patient with the disease and no family history<br/><br/><em>Note: Confirmation of paternity only is insufficient. Egg donation, surrogate motherhood, errors in embryo transfer, and so on, can contribute to non maternity.</em>" },
            { criteria: "PS3", description: "Well-established in vitro or in vivo functional studies supportive of a damaging effect on the gene or gene product<br/><br/><em>Note: Functional studies that have been validated and shown to be reproducible and robust in a clinical diagnostic laboratory setting are considered the most well established.</em>" },
            { criteria: "PS4", description: "The prevalence of the variant in affected individuals is significantly increased compared with the prevalence incontrols<br/><br/><em>Note 1: Relative risk or OR, as obtained from case–control studies, is >5.0, and the confidence interval around the estimate of relative risk or OR does not include 1.0. See the article for detailed guidance.</em><br/><br/><em>Note 2: In instances of very rare variants where case–control studies may not reach statistical significance, the prior observation of the variant in multiple unrelated patients with the same phenotype, and its absence in controls, may be used as moderate level of evidence.</em>" },
            { criteria: "PVS1", description: "Null variant (nonsense, frameshift, canonical ±1 or 2 splice sites, initiation codon, single or multiexon deletion) in a gene where LOF is a known mechanism of disease.<br/><br/>Caveats:<br/><ul><li>Beware of genes where LOF is not a known disease mechanism (e.g., GFAP, MYH7)</li><li>Use caution interpreting LOF variants at the extreme 3′ end of a gene</li><li>Use caution with splice variants that are predicted to lead to exon skipping but leave the remainder of the protein intact</li><li>Use caution in the presence of multiple transcripts</li></ul>" }
        ];

        const genericDescription = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        const acmgTip = (criteria, description) => `<h5 class="my-0 mw-10 text-600">${criteria}</h5><div style="max-width: 250px">${description}</div>`;

        return (
            <>
                <div className="card flex-row my-3 mt-0">
                    <div className="text-600 acmg-guidelines-title">ACMG Guidelines</div>
                    <div className="d-flex acmg-guidelines-invoker align-items-center" style={{ height: "50px" }}>
                        {acmgCriteria.map((obj) => {
                            const { criteria, description } = obj;
                            return (
                                <div className="acmg-invoker clickable text-600 text-center ml-02 mr-02" key={criteria} data-criteria={criteria} data-invoked={invoked[criteria]}
                                    onClick={() => toggleInvocation(criteria)} style={{ flex: "1" }} data-html data-tip={(acmgTip(criteria, description || genericDescription))}>
                                    { criteria }
                                </div>
                            );}
                        )}
                    </div>
                </div>
                {/* <div className="mb-2">{ autoClassification || "No classification suggestions available" }</div> */}
            </>
        );
    }
}


class AutoClassify {
    /**
     * Based on https://www.mgz-muenchen.com/files/Public/Downloads/2018/ACMG%20Classification%20of%20Sequence%20Variants.pdf (pg 3)
     */
    static criteriaToClassification = {
        "BA1": { type: "benign", strength: "standalone" },
        "BS1": { type: "benign", strength: "strong" },
        "BS2": { type: "benign", strength: "strong" },
        "BS3": { type: "benign", strength: "strong" },
        "BS4": { type: "benign", strength: "strong" },
        "BP1": { type: "benign", strength: "supporting" },
        "BP2": { type: "benign", strength: "supporting" },
        "BP3": { type: "benign", strength: "supporting" },
        "BP4": { type: "benign", strength: "supporting" },
        "BP5": { type: "benign", strength: "supporting" },
        "BP6": { type: "benign", strength: "supporting" },
        "BP7": { type: "benign", strength: "supporting" },
        "PP1": { type: "pathogenic", strength: "supporting" },
        "PP2": { type: "pathogenic", strength: "supporting" },
        "PP3": { type: "pathogenic", strength: "supporting" },
        "PP4": { type: "pathogenic", strength: "supporting" },
        "PP5": { type: "pathogenic", strength: "supporting" },
        "PM1": { type: "pathogenic", strength: "moderate" },
        "PM2": { type: "pathogenic", strength: "moderate" },
        "PM3": { type: "pathogenic", strength: "moderate" },
        "PM4": { type: "pathogenic", strength: "moderate" },
        "PM5": { type: "pathogenic", strength: "moderate" },
        "PM6": { type: "pathogenic", strength: "moderate" },
        "PS1": { type: "pathogenic", strength: "strong" },
        "PS2": { type: "pathogenic", strength: "strong" },
        "PS3": { type: "pathogenic", strength: "strong" },
        "PS4": { type: "pathogenic", strength: "strong" },
        "PVS1": { type: "pathogenic", strength: "vstrong" }
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
        console.log("populating with evidence from, ", invoked);
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

        console.log("classifying...");

        // Check for certain benign affect
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

        // Check for likelihoods (note: currently not checking for contradictory criteria -- may need to do so in future)
        const isLikelyBenign = this.memoized.isLikelyBenign(strongb, supportingb);
        if (isLikelyBenign) {
            return "Likely benign";
        }

        const isLikelyPathogenic = this.memoized.isLikelyPathogenic(vstrong, strongp, moderatep, supportingp);
        if (isLikelyPathogenic) {
            return "Likely Pathogenic";
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