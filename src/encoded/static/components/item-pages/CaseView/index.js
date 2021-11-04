'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import url from 'url';

import { console, navigate, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';
import { decorateNumberWithCommas } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';
import { SelectedItemsController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/SelectedItemsController';

import { responsiveGridState } from './../../util/layout';
import DefaultItemView from './../DefaultItemView';
import { TabPaneErrorBoundary } from './../components/TabView';
import { EmbeddedCaseSearchTable } from '../components/EmbeddedItemSearchTable';
import { PedigreeVizLoader } from '../components/pedigree-viz-loader';

import { VariantSampleListController } from './VariantSampleListController';
import { CaseReviewDataStore } from './VariantSampleSelection';
import { CaseSummaryTable } from './CaseSummaryTable';
import { FamilyAccessionStackedTable } from './../../browse/CaseDetailPane';
import { PedigreeTabViewBody } from './PedigreeTabViewBody';
import { PedigreeTabView, PedigreeTabViewOptionsController } from './PedigreeTabView';
import { PedigreeFullScreenBtn } from './PedigreeFullScreenBtn';
import { parseFamilyIntoDataset } from './family-parsing';
import { CurrentFamilyController } from './CurrentFamilyController';
import { CaseStats } from './CaseStats';
import { FilteringTab } from './FilteringTab';
import { CNVSVFilteringTab } from './CNVSVFilteringTab';
import { InterpretationTab } from './InterpretationTab';
import { CaseReviewTab } from './CaseReviewTab';
import { getAllNotesFromVariantSample } from './variant-sample-selection-panels';



export {
    CaseSummaryTable,
    PedigreeTabViewBody,
    PedigreeFullScreenBtn,
    parseFamilyIntoDataset,
};



export default class CaseView extends DefaultItemView {

    /**
     * Hackyish approach to reusing state logic to wrap entire ItemView (or all tabs, at last).
     * Will be easier to migrate to functional components with hooks theoretically this way if needed.
     * Any controller component can be functional or classical (pun intended :-P).
     *
     * @deprecated (Potentially)
     *
     * Later, could maybe structure as (to be more React-ful):
     * @example
     * function CaseView (props) {
     *     // ... Case-related-logic ...
     *     <CurrentFamilyController context={context}>
     *         <PedigreeTabViewOptionsController>
     *             <CaseViewBody />
     *         </PedigreeTabViewOptionsController>
     *     </CurrentFamilyController>
     * }
     * function CaseViewBody (props){
     *    const { currFamily, selectedDiseaseIdxMap, ... } = props;
     *    const tabs = [];
     *    tabs.push(CaseInfoTabView.getTabObject(props));
     *    // ... Case-related-logic ..
     *    return <CommonItemView tabs={tabs} />;
     * }
     */
    getControllers(){
        return [
            PedigreeVizLoader,
            CurrentFamilyController, // <- This passes down props.currFamily into PedigreeTabViewOptionsController. Could possibly change to just use context.family now.
            PedigreeTabViewOptionsController
        ];
    }

    getTabViewContents(controllerProps = {}){
        const { context = null } = this.props;
        const { family = null } = context || {};
        const { members = [] } = family || {};

        const membersLen = members.length;
        const commonTabProps = { ...this.props, ...controllerProps };
        const initTabs = [];

        initTabs.push(CaseInfoTabView.getTabObject(commonTabProps));

        if (membersLen > 0) {
            // Remove this outer if condition if wanna show disabled '0 Pedigrees'
            initTabs.push(PedigreeTabView.getTabObject(commonTabProps));
        }

        return initTabs.concat(this.getCommonTabs());
    }

    /**
     * Render additional item action to Add Family
     * @deprecated
     * Disabled for now since can only support one family per Case at moment.
     * To be removed once UX is more certain.
     * AttachmentInputController, AttachmentInputMenuOption from './attachment-input'
     */
    additionalItemActionsContent(){
        return super.additionalItemActionsContent();
        // const { context, href } = this.props;
        // const { actions = [] } = context;
        // const hasEditPermission = _.find(actions, { 'name' : 'edit' });
        // if (!hasEditPermission){
        //     return null;
        // }
        // return (
        //     <AttachmentInputController {...{ context, href }} onAddedFamily={this.onAddedFamily}>
        //         <AttachmentInputMenuOption />
        //     </AttachmentInputController>
        // );
    }
}

const CaseInfoTabView = React.memo(function CaseInfoTabView(props){
    const {
        // Passed in from App or redux
        context = {},
        href,
        session,
        schemas,
        windowWidth,
        windowHeight,
        addToBodyClassList,
        removeFromBodyClassList,
        setIsSubmitting,
        graphData,
        selectedDiseaseIdxMap,
        idToGraphIdentifier,
        PedigreeVizLibrary = null,
        // Passed in from VariantSampleListController which wraps this component in `getTabObject`
        variantSampleListItem = null,
        isLoadingVariantSampleListItem = false,
        updateVariantSampleListID,
        savedVariantSampleIDMap = {},
        fetchVariantSampleListItem,
    } = props;
    const { PedigreeVizView } = PedigreeVizLibrary || {}; // Passed in by PedigreeVizLoader, @see CaseView.getControllers();

    const {
        family: currFamily = null, // Previously selected via CurrentFamilyController.js, now primary from case.
        secondary_families = null,
        case_phenotypic_features: caseFeatures = { case_phenotypic_features: [] },
        description = null,
        // actions: permissibleActions = [],
        display_title: caseTitle,
        case_title: caseNamedTitle,
        case_id: caseNamedID,
        accession: caseAccession,
        individual: caseIndividual,
        sample_processing: sampleProcessing = null,
        initial_search_href_filter_addon: snvFilterHrefAddon = "",
        sv_initial_search_href_filter_addon: svFilterHrefAddon = ""
    } = context;

    const { variant_samples: vsSelections = [] } = variantSampleListItem || {};

    const {
        countIndividuals: numIndividuals,
        countIndividualsWSamples: numWithSamples
    } = useMemo(function(){
        const { members = [] } = currFamily || {};
        let countIndividuals = 0;
        let countIndividualsWSamples = 0;
        members.forEach(function({ samples }){
            if (Array.isArray(samples) && samples.length > 0) {
                countIndividualsWSamples++;
            }
            countIndividuals++;
        });
        return { countIndividuals, countIndividualsWSamples };
    }, [ currFamily ]);

    const anyAnnotatedVariantSamples = useMemo(function(){
        const vsSelectionsLen = vsSelections.length;
        for (var i = 0; i < vsSelectionsLen; i++) {
            const { variant_sample_item } = vsSelections[i];
            const notesForVS = getAllNotesFromVariantSample(variant_sample_item);
            if (notesForVS.length > 0) {
                return true;
            }
        }
        return false;
    }, [ vsSelections ]);

    const onViewPedigreeBtnClick = useCallback(function(evt){
        evt.preventDefault();
        evt.stopPropagation();
        if (!currFamily) return false;
        // By default, click on link elements would trigger ajax request to get new context.
        // (unless are external links)
        navigate("#pedigree", { skipRequest: true, replace: true });
    }, [ /* empty == executed only once ever */ ]);

    let caseSearchTables;
    if (caseIndividual) {
        caseSearchTables = (
            <React.Fragment>
                <h4 className="text-400 align-middle mt-0">Status Overview</h4>
                <div className="search-table-wrapper">
                    <EmbeddedCaseSearchTable facets={null} searchHref={`/search/?type=Case&accession=${caseAccession}`} />
                </div>
            </React.Fragment>
        );
    } else {
        caseSearchTables = (
            <div className="mt-3">
                <h4 className="text-400 mb-03">No individual assigned to this case</h4>
            </div>
        );
    }

    const rgs = responsiveGridState(windowWidth);
    let pedWidth;
    let pedBlock = (
        <div className="d-none d-lg-block pedigree-placeholder flex-fill" onClick={onViewPedigreeBtnClick} disabled={!currFamily}>
            <div className="text-center h-100">
                <i className="icon icon-sitemap icon-4x fas" />
            </div>
        </div>
    );

    if (PedigreeVizView && windowWidth !== null && (rgs === "lg" || rgs === "xl")) {
        // at windowWidth === null, `rgs` defaults to 'lg' or 'xl' for serverside render

        if (rgs === "lg") {
            pedWidth = 400;
        }

        if (rgs === "xl") {
            pedWidth = 560;
            if (windowWidth >= 1680) {
                pedWidth = 800;
            }
        }

        if (graphData){
            // Potential to-do, onComponentDidUpdate, find height in DOM of container, set to state, pass down here.
            pedBlock = (
                <div className="pedigree-pane-wrapper flex-fill">
                    <PedigreeVizView {...graphData} width={pedWidth} height={320} disableSelect showNotes={false}
                        visibleDiseaseIdxMap={selectedDiseaseIdxMap} showZoomControls={false} enablePinchZoom={false} />
                </div>
            );
        }
    }

    // Use amount of processed_files to determine if Bioinfo tab should be displayed
    const { processed_files = [] } = sampleProcessing || {};
    const disableBioinfo = !(processed_files.length > 0);

    // Use availability of search query filter string add-ons to determine if Filtering tab should be displayed
    const disableFiltering = !snvFilterHrefAddon && !svFilterHrefAddon;

    // Filtering props shared among both tables, then SV and SNV specific props
    const filteringTableProps = {
        context, windowHeight, session, schemas,
        setIsSubmitting, variantSampleListItem,
        updateVariantSampleListID, savedVariantSampleIDMap,
        fetchVariantSampleListItem, isLoadingVariantSampleListItem
    };

    return (
        <React.Fragment>
            <div className="container-wide">
                <h3 className="tab-section-title">
                    <div className="pt-12 pb-06">
                        <span>
                            { caseNamedTitle || caseNamedID }
                        </span>
                        <object.CopyWrapper className="text-smaller text-muted text-monospace text-400" value={caseAccession}>
                            { caseAccession }
                        </object.CopyWrapper>
                    </div>
                </h3>
            </div>
            <hr className="tab-section-title-horiz-divider" />
            <div className="container-wide bg-light pt-36 pb-36">
                <div className="card-group case-summary-card-row">
                    <div className="col-stats mb-2 mb-lg-0">
                        <CaseStats caseItem={context} {...{ description, numIndividuals, numWithSamples, caseFeatures }} numFamilies={1} />
                    </div>
                    <div id="case-overview-ped-link" className="col-pedigree-viz">
                        <div className="card d-flex flex-column">
                            <div className="pedigree-vis-heading card-header primary-header d-flex justify-content-between">
                                <div>
                                    <i className="icon icon-sitemap fas icon-fw mr-1"/>
                                    <h4 className="text-white text-400 d-inline-block mt-0 mb-0 ml-05 mr-05">
                                        Pedigree
                                    </h4>
                                </div>
                                <button type="button" className="btn btn-primary btn-small view-pedigree-btn"
                                    onClick={onViewPedigreeBtnClick} disabled={!currFamily}>
                                    View Pedigree
                                </button>
                            </div>
                            { pedBlock }
                        </div>
                    </div>
                </div>
            </div>

            <div className="container-wide bg-light pt-12 pb-6">
                <div className="processing-summary-tables-container mt-0">
                    { caseSearchTables }
                </div>
            </div>

            { currFamily && caseIndividual ?
                <DotRouter href={href} navClassName="container-wide pt-36 pb-36" contentsClassName="container-wide bg-light pt-36 pb-36" prependDotPath="case-info">
                    <DotRouterTab dotPath=".accessioning" default tabTitle="Accessioning">
                        <AccessioningTab {...{ context, href, currFamily, secondary_families }} />
                    </DotRouterTab>
                    <DotRouterTab dotPath=".bioinformatics" disabled={disableBioinfo} tabTitle="Bioinformatics">
                        <BioinformaticsTab {...{ context, idToGraphIdentifier }} />
                    </DotRouterTab>
                    <DotRouterTab dotPath=".filtering" cache disabled={disableFiltering} tabTitle="Filtering">
                        <FilteringTabWrapper {...filteringTableProps} {...{ snvFilterHrefAddon, svFilterHrefAddon }} />
                    </DotRouterTab>
                    <DotRouterTab dotPath=".interpretation" disabled={!isLoadingVariantSampleListItem && vsSelections.length === 0} tabTitle={
                        <span data-tip={isLoadingVariantSampleListItem ? "Loading latest selection, please wait..." : null}>
                            { isLoadingVariantSampleListItem ? <i className="icon icon-spin icon-circle-notch mr-1 fas"/> : null }
                            Interpretation
                        </span>}>
                        <InterpretationTab {...{ variantSampleListItem, schemas, context, isLoadingVariantSampleListItem }} />
                    </DotRouterTab>
                    <DotRouterTab dotPath=".review" disabled={!anyAnnotatedVariantSamples} tabTitle="Case Review">
                        <CaseReviewDataStore>
                            <CaseReviewTab {...{ variantSampleListItem, schemas, context, isLoadingVariantSampleListItem, fetchVariantSampleListItem }} />
                        </CaseReviewDataStore>
                    </DotRouterTab>
                </DotRouter>
                : null }
        </React.Fragment>
    );
});
CaseInfoTabView.getTabObject = function(props){
    const { context: { variant_sample_list_id } = {} } = props;
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-cogs fas icon-fw"/>
                <span>Case Info</span>
            </React.Fragment>
        ),
        'key' : 'case-info',
        'disabled' : false,
        'content' : (
            <VariantSampleListController id={variant_sample_list_id}>
                <CaseInfoTabView {...props} />
            </VariantSampleListController>
        )
    };
};


/**
 * @todo
 * iterate on then move into own file for reuse later maybe
 */
class DotRouter extends React.PureComponent {

    static getDotPath(href) {
        // Path must contain both tab (hashroute) and dotpath to navigate properly
        const hashString = (url.parse(href, false).hash || "#").slice(1) || null;
        if (!hashString) return null;
        const dotPathSplit = hashString.split(".");
        return "." + dotPathSplit[dotPathSplit.length - 1];
    }

    static getDefaultTab(children) {
        const childrenLen = children.length;

        if (childrenLen === 0) {
            throw new Error("Must provide children and ideally default tab to DotRouter via props.");
        }

        for (var i = 0; i < childrenLen; i++) {
            if (children[i].props.default === true) {
                return children[i];
            }
        }

        // If no default found, use first child component as default.
        return children[0];
    }

    static defaultProps = {
        "className" : null,
        "navClassName" : "container-wide",
        "contentsClassName" : "container-wide",
        "elementID" : "dot-router"
    };

    constructor(props){
        super(props);
        this.memoized = {
            getDefaultTab: memoize(DotRouter.getDefaultTab),
            getDotPath: memoize(DotRouter.getDotPath)
        };
    }

    /** Method is not explicitly memoized b.c. this component only has 2 props & is a PureComponent itself */
    getCurrentTab() {
        const { children, href } = this.props;
        const dotPath = this.memoized.getDotPath(href);

        if (dotPath){
            for (let i = 0; i < children.length; i++) {
                const currChild = children[i];
                if (currChild.props.dotPath === dotPath && !currChild.props.disabled) {
                    // Maybe consider removing `&& !currChild.props.disabled` check from if condition
                    // for UX-URL consistency (show case review tab if go there, even if nothing to show).
                    return currChild;
                }
            }
        }

        return this.memoized.getDefaultTab(children);
    }

    render() {
        const { children, className, prependDotPath, navClassName, contentsClassName, elementID } = this.props;
        const currentTab = this.getCurrentTab();
        const { props : { dotPath: currTabDotPath } } = currentTab; // Falls back to default tab if not in hash.
        const contentClassName = "tab-router-contents" + (contentsClassName ? " " + contentsClassName : "");
        const allTabContents = [];

        const adjustedChildren = React.Children.map(children, function(childTab, index){
            const { props : { dotPath, children: tabChildren, cache = false } } = childTab;
            const active = currTabDotPath === dotPath;
            if (active || cache) {
                allTabContents.push(
                    <div className={contentClassName + (!active ? " d-none" : "")} id={(prependDotPath || "") + dotPath} data-tab-index={index} key={dotPath}>
                        <TabPaneErrorBoundary>
                            { tabChildren }
                        </TabPaneErrorBoundary>
                    </div>
                );
            }
            return React.cloneElement(childTab, { key: dotPath, active, prependDotPath, index });
        });

        return (
            <div className={"tab-router" + (className ? " " + className : "")} id={elementID}>
                <nav className={"dot-tab-nav" + (navClassName ? " " + navClassName : "")}>
                    <div className="dot-tab-nav-list">
                        { adjustedChildren }
                    </div>
                </nav>
                { allTabContents }
            </div>
        );
    }
}

const DotRouterTab = React.memo(function DotRouterTab(props) {
    const { tabTitle, dotPath, disabled, active, prependDotPath, children } = props;

    const onClick = useCallback(function(){
        const targetDotPath = prependDotPath + dotPath;
        const navOpts = { "skipRequest": true, "replace": true, "dontScrollToTop": true };
        navigate("#" + targetDotPath, navOpts, function(){
            // Maybe uncomment - this could be annoying if someone is also trying to keep Status Overview visible or something.
            // layout.animateScrollTo(targetDotPath);
        });
    }, []); // Previously was: [ prependDotPath, dotPath ] -- removed for now since these are hardcoded and don't change. IMPORTANT: REVERT IF THESE BECOME DYNAMIC.

    if (!React.isValidElement(children)) {
        throw new Error("Expected children to be present and valid JSX");
    }

    return (
        <div className={"arrow-tab" + (disabled ? " disabled " : "") + (active ? " active" : "")}>
            <div className="btn-prepend d-xs-none">
                <svg viewBox="0 0 1.5875 4.2333333" width={6} height={16}>
                    <path d="M 0,4.2333333 1.5875,2.1166667 v 2.1166666 z"/>
                    <path d="M 0,3.3e-6 1.5875,0 v 2.1166667 z"/>
                </svg>
            </div>
            <button type="button" onClick={disabled ? null : onClick} disabled={disabled}>{ tabTitle }</button>
            <div className="btn-append d-xs-none">
                <svg viewBox="0 0 1.5875 4.2333333" width={6} height={16}>
                    <path d="M 0,3.3e-6 1.5875,2.1166733 0,4.2333333 Z"/>
                </svg>
            </div>
        </div>
    );
}, function(prevProps, nextProps){
    // Custom equality comparison func.
    // Skip comparing the hardcoded `prependDotPath` & `dotPath` -- revert if those props become dynamic.
    // Also skip checking for props.children, since that is rendered by `DotRouter` and not this `DotRouterTab`.
    const compareKeys = ["disabled", "active", "tabTitle"];
    const anyChanged = _.any(compareKeys, function(k){
        return prevProps[k] !== nextProps[k];
    });
    return !anyChanged;
});

const AccessioningTab = React.memo(function AccessioningTab(props) {
    const { context, currFamily, secondary_families = [] } = props;
    const { display_title: primaryFamilyTitle, '@id' : currFamilyID } = currFamily;
    const [ isSecondaryFamiliesOpen, setSecondaryFamiliesOpen ] = useState(false);
    const secondaryFamiliesLen = secondary_families.length;

    const viewSecondaryFamiliesBtn = secondaryFamiliesLen === 0 ? null : (
        <div className="pt-2">
            <button type="button" className="btn btn-block btn-outline-dark" onClick={function(){ setSecondaryFamiliesOpen(!isSecondaryFamiliesOpen); }}>
                { !isSecondaryFamiliesOpen ? `Show ${secondaryFamiliesLen} more famil${secondaryFamiliesLen > 1 ? 'ies' : 'y'} that proband is member of` : 'Hide secondary families' }
            </button>
        </div>
    );

    // Using PartialList since we have it already, it hides DOM elements when collapsed.
    // In long run maybe a differing UI might be better, idk.
    return (
        <React.Fragment>
            <h1 className="row align-items-center">
                <div className="col">
                    <span className="text-300">Accessioning Report and History</span>
                </div>
                <div className="col-auto">
                    <span className="current-case text-small text-400 m-0">Current Selection</span>
                </div>
            </h1>
            <div className="tab-inner-container card">
                <div className="card-body">
                    <PartialList className="mb-0" open={isSecondaryFamiliesOpen}
                        persistent={[
                            <div key={currFamilyID} className="primary-family">
                                <h4 className="mt-0 mb-16 text-400">
                                    <span className="text-300">Primary Cases from </span>
                                    { primaryFamilyTitle }
                                </h4>
                                <FamilyAccessionStackedTable family={currFamily} result={context}
                                    fadeIn collapseLongLists collapseShow={1} />
                            </div>
                        ]}
                        collapsible={
                            secondary_families.map(function(family){
                                const { display_title, '@id' : familyID } = family;
                                return (
                                    <div className="py-4 secondary-family" key={familyID}>
                                        <h4 className="mt-0 mb-05 text-400">
                                            <span className="text-300">Related Cases from </span>
                                            { display_title }
                                        </h4>
                                        <FamilyAccessionStackedTable result={context} family={family} collapseLongLists/>
                                    </div>
                                );
                            })
                        } />
                    { viewSecondaryFamiliesBtn }
                </div>
            </div>
        </React.Fragment>
    );
});

const BioinfoStats = React.memo(function BioinfoStats(props) {
    // Note: Can probably clean up the render method of this a little bit by breaking each row
    // into its own component. Not sure if worth it to do yet; is pretty long and repetitive, but
    // may also be necessary to add to/edit rows individually in the future.
    const { caseSample = null, sampleProcessing = null, submittedSex = null, submittedAncestry = [] } = props;

    const {
        bam_sample_id: caseSampleId = null,
        processed_files: caseProcFiles = []
    } = caseSample || {};
    const {
        processed_files: msaProcFiles = []
    } = sampleProcessing || {};

    const msaStats = useMemo(function(){
        const msaStats = {};

        function transformValueType(numberType, value){
            const useFunc = { // Probably can just use `parseFloat` for any number but what the heck.
                "integer": parseInt,
                "float": parseFloat,
                "percent": parseFloat
            }[numberType];
            if (useFunc) {
                const transformedValue = useFunc(value);
                if (!isNaN(transformedValue)) return transformedValue;
            }
            return value;
        }

        // Pull coverage and reads values from this case's sample's bam file
        caseProcFiles.forEach(function(procFile){
            const {
                quality_metric: {
                    "@type": [ qmType ]=[],
                    quality_metric_summary: qmSummaries = []
                } = {}
            } = procFile;
            // Only continue if qclist (bamQC should only exist if there is also bamcheck)
            if (qmType === "QualityMetricQclist") {
                // Coverage and total reads should only be present in BAM, update if found
                qmSummaries.forEach(function(qmSummary){
                    const { title = null, value = null, tooltip = null, numberType = "string" } = qmSummary;
                    if (title === "Coverage") {
                        msaStats.coverage = { value: transformValueType(numberType, value), tooltip };
                    } else if (title === "Total Reads") {
                        msaStats.reads = { value: transformValueType(numberType, value), tooltip };
                    }
                });
            }
        });

        // Pull variant stats, T-T ratio, heterozygosity ratio, etc. from sample_processing
        msaProcFiles.forEach(function(procFile){
            const {
                variant_type: variantType = "SNV", // SVs are always labelled, SNVs may or may not be (ask bioinfo team for details)
                quality_metric: {
                    "@type": [ qmType ]=[],
                    quality_metric_summary: qmSummaries = [],
                    qc_list = []
                }={}
            } = procFile;

            // Only continue if qclist (vcfQC should only exist if there is also vcfcheck; peddyQC also requires qcList)
            if (qmType === "QualityMetricQclist") {
                // SNV fields are unique from SV ones; so ensure the correct ones are added to msaStats for each
                if (variantType === "SV") {
                    // Stats should only be present in combined VCF, update if found
                    qmSummaries.forEach(function(qmSummary){
                        const { title = null, value = null, sample = null, tooltip = null, numberType = "string" } = qmSummary;
                        if (sample && sample === caseSampleId) {
                            switch (title) { // Leaving this as switch case, since more fields may be added in future (may also be worth creating a function to encompass SV & SNV options as this grows)
                                case "Filtered Variants":
                                    msaStats.filteredSVVariants = { value: transformValueType(numberType, value), tooltip };
                                    break;
                                default:
                                    break;
                            }
                        }
                    });
                } else { // SNV may be labelled or not
                    // Most stats should only be present in combined VCF, update if found
                    qmSummaries.forEach(function(qmSummary){
                        const { title = null, value = null, sample = null, tooltip = null, numberType = "string" } = qmSummary;
                        if (sample && sample === caseSampleId) {
                            switch (title) {
                                case "De Novo Fraction":
                                    msaStats.deNovo = { value: transformValueType(numberType, value), tooltip };
                                    break;
                                case "Heterozygosity Ratio":
                                    msaStats.heterozygosity = { value: transformValueType(numberType, value), tooltip };
                                    break;
                                case "Transition-Transversion Ratio":
                                    msaStats.transTransRatio = { value: transformValueType(numberType, value), tooltip };
                                    break;
                                case "Total Variants Called":
                                    msaStats.totalSNVIndelVars = { value: transformValueType(numberType, value), tooltip };
                                    break;
                                case "Filtered Variants":
                                    msaStats.filteredSNVIndelVariants = { value: transformValueType(numberType, value), tooltip };
                                    break;
                                default:
                                    break;
                            }
                        }
                    });

                    // Predicted Sex and Ancestry found in qclist
                    qc_list.forEach(function(qc) {
                        const { value: { "ancestry and sex prediction": predictions = [] } = {}, qc_type } = qc;

                        if (qc_type === "quality_metric_peddyqc") {
                            predictions.forEach(function(prediction) {
                                const { name, "predicted sex": predictedSex, predictedAncestry } = prediction;
                                console.log("is this prediction for current case?", name, caseSampleID);
                                if (name === caseSampleId) {
                                    msaStats.predictedSex = { value: predictedSex };
                                    msaStats.predictedAncestry = { value: predictedAncestry };
                                }
                            });
                        }
                    });
                }
            }
        });

        return msaStats;
    }, [ caseProcFiles, msaProcFiles ]);

    const { reads = {}, coverage = {}, totalSNVIndelVars = {}, transTransRatio = {}, heterozygosity = {}, deNovo = {},
        filteredSNVIndelVariants = {}, filteredSVVariants = {}, predictedSex = {}, predictedAncestry = {} } = msaStats;

    const fallbackElem = "-";

    return (
        <>
            <div className="row py-3">
                <BioinfoStatsEntry label="Total Number of Reads" tooltip={reads.tooltip}>
                    { typeof reads.value === "number" ? decorateNumberWithCommas(reads.value) : fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Coverage" tooltip={coverage.tooltip}>
                    { coverage.value || fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Total Number of SNVs/Indels called" tooltip={totalSNVIndelVars.tooltip}>
                    { typeof totalSNVIndelVars.value === "number" ? decorateNumberWithCommas(totalSNVIndelVars.value): fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Transition-Transversion ratio" tooltip={transTransRatio.tooltip}>
                    { typeof transTransRatio.value === "number" ? transTransRatio.value || "0.0" : fallbackElem }
                </BioinfoStatsEntry>
            </div>
            <div className="row py-3">
                <BioinfoStatsEntry label="Submitted Sex" tooltip={""}>
                    { submittedSex || fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Predicted Sex" tooltip={""}>
                    { predictedSex || fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="SNVs/Indels After Hard Filters" tooltip={filteredSNVIndelVariants.tooltip}>
                    { typeof filteredSNVIndelVariants.value === "number" ? decorateNumberWithCommas(filteredSNVIndelVariants.value) : fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Structural Variants After Hard Filters" tooltip={filteredSVVariants.tooltip}>
                    { typeof filteredSVVariants.value === "number" ? decorateNumberWithCommas(filteredSVVariants.value) : fallbackElem }
                </BioinfoStatsEntry>
            </div>
            <div className="row py-3">
                <BioinfoStatsEntry label="Submitted Ancestry" tooltip={""}>
                    { submittedAncestry.length > 0 && submittedAncestry.join(", ") || "-" }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Predicted Ancestry" tooltip={""}>
                    { predictedAncestry.length > 0 && submittedAncestry.join(", ") || "-" }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Heterozygosity ratio" tooltip={heterozygosity.tooltip}>
                    { typeof heterozygosity.value === "number" ? heterozygosity.value || "0.0" : fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="De novo Fraction" tooltip={deNovo.tooltip}>
                    { typeof deNovo.value === "number" ? deNovo.value + "%" : fallbackElem }
                </BioinfoStatsEntry>
            </div>
        </>
    );
});


function BioinfoStatsEntry({ tooltip, label, children }){
    return (
        <div className="col-12 col-md-6 col-lg-3 col-xl-3 mt-04 mb-04">
            <div className="qc-summary">
                <label className="d-block mb-0">
                    { label }:
                    { tooltip ?
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={tooltip} data-place="right"/>
                        : null }
                </label>
                <div>{ children }</div>
            </div>
        </div>
    );
}

const BioinformaticsTab = React.memo(function BioinformaticsTab(props) {
    const {
        context,
        idToGraphIdentifier
    } = props;
    const {
        display_title: caseDisplayTitle,
        family = null,
        sample_processing: sampleProcessing = null,
        sample: caseSample = null,
        vcf_file: vcf = null,
        individual: { sex: submittedSex = null, ancestry: submittedAncestry = [] } = {},
    } = context;
    const { "@id": vcfAtId = null } = vcf || {};

    const {
        // original_pedigree: { display_title: pedFileName } = {},
        display_title: familyDisplayTitle
    } = family;

    const onClick = useCallback(function(evt){
        evt.stopPropagation();
        navigate(`${vcfAtId}#provenance`, { replace: true });
    }, []);

    const title = (
        <h4 data-family-index={0} className="my-0 d-inline-block w-100">
            <span className="text-400">{ familyDisplayTitle }</span>
            {/* { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null } */}
            <button type="button" className="btn btn-sm btn-primary pull-right"
                data-tip="Click to view the provenance graph for the most up-to-date annotated VCF"
                onClick={onClick} disabled={(!vcfAtId)}>
                <i className="icon icon-fw icon-sitemap icon-rotate-90 fas mr-1 small" />
                View <span className="text-600">Provenance Graph</span>
            </button>
        </h4>
    );

    return (
        <React.Fragment>
            <h1><span className="text-300">Bioinformatics Analysis</span></h1>
            {/* <div className="tab-inner-container clearfix font-italic qc-status">
                <span className="text-600">Current Status:</span><span className="text-success"> PASS <i className="icon icon-check fas"></i></span>
                <span className="pull-right">3/28/20</span>
            </div> */}
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Quality Control Metrics (QC)</h4>
                <div className="card-body py-0">
                    <BioinfoStats {...{ caseSample, sampleProcessing, submittedAncestry, submittedSex }} />
                </div>
            </div>
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Multisample Analysis Table</h4>
                <div className="card-body family-index-0" data-is-current-family={true}>
                    { title }
                    <CaseSummaryTable {...family} sampleProcessing={[sampleProcessing]} isCurrentFamily={true} idx={0} {...{ idToGraphIdentifier }} />
                </div>
            </div>
        </React.Fragment>
    );
});

/**
 * Handles tab switching between the SNV and CNV/SV tabs
 *
 * @todo Consider renaming to `FilteringTab`, and rename existing FilteringTab to ~ `SVFilteringTab`.
 */
function FilteringTabWrapper(props) {
    const {
        context, windowHeight, session, schemas,
        setIsSubmitting, variantSampleListItem,
        updateVariantSampleListID, savedVariantSampleIDMap,
        fetchVariantSampleListItem, isLoadingVariantSampleListItem,
        snvFilterHrefAddon = "", svFilterHrefAddon = ""
    } = props;

    const defaultTab = (!snvFilterHrefAddon && svFilterHrefAddon) ? "CNVSV" : "SNV";
    const [ currViewName, setCurrViewName ] = useState(defaultTab);

    const currentTitle = currViewName === "SNV" ? "SNV" : "CNV / SV";

    const commonProps = { context, windowHeight, session, schemas };

    const svFilteringProps = {};

    const snvFilteringProps = {
        setIsSubmitting, variantSampleListItem,
        updateVariantSampleListID, savedVariantSampleIDMap,
        fetchVariantSampleListItem, isLoadingVariantSampleListItem
    };

    return (
        <React.Fragment>
            <FilteringTabTableToggle {...{ currViewName, setCurrViewName, svFilterHrefAddon, snvFilterHrefAddon }}/>
            <div className="row mb-1 mt-0">
                <h1 className="col my-0">
                    {currentTitle} <span className="text-300">Variant Filtering and Technical Review</span>
                </h1>
            </div>
            <div id="snv-filtering" className={currViewName === "SNV" ? "mt-36" : "d-none"}>
                <SelectedItemsController isMultiselect>
                    <FilteringTab {...commonProps} {...snvFilteringProps } />
                </SelectedItemsController>
            </div>
            <div id="cnvsv-filtering" className={currViewName === "CNVSV" ? "" : "d-none"}>
                <CNVSVFilteringTab {...commonProps} {...svFilteringProps} />
            </div>
        </React.Fragment>
    );
}

function FilteringTabTableToggle(props) {
    const { currViewName, setCurrViewName, svFilterHrefAddon: svEnabled = false, snvFilterHrefAddon: snvEnabled = false } = props;

    const currentlyOnSNV = currViewName === "SNV";
    const currentlyOnSV = currViewName === "CNVSV";

    const onClickSNV = useCallback(function(e){
        setCurrViewName("SNV");
    });

    const onClickCNVSV = useCallback(function(e){
        setCurrViewName("CNVSV");
    });

    return (
        <div className="card py-2 px-3 flex-row mb-3 filtering-tab-toggle">
            <div onClick={currentlyOnSV && snvEnabled ? onClickSNV : null}
                className={`mr-2 text-600  ${currentlyOnSNV ? "active ": (snvEnabled ? "clickable": "unclickable text-muted")}`}>
                SNV Filtering
            </div>
            <div onClick={currentlyOnSNV && svEnabled ? onClickCNVSV : null}
                className={`text-600 ${currentlyOnSV ? "active ": (svEnabled ? "clickable": "unclickable text-muted")}`}>
                CNV / SV Filtering
            </div>
        </div>
    );
}
