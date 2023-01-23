'use strict';

import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import url from 'url';
import ReactTooltip from 'react-tooltip';

import { console, navigate, object, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';
import { capitalize, decorateNumberWithCommas } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';


import { responsiveGridState } from './../../util/layout';
import DefaultItemView from './../DefaultItemView';
import { TabPaneErrorBoundary } from './../components/TabView';
import { EmbeddedCaseSearchTable } from '../components/EmbeddedItemSearchTable';
import { PedigreeVizLoader } from '../components/pedigree-viz-loader';

import { VariantSampleListController } from './VariantSampleListController';
import { CaseSummaryTable } from './CaseSummaryTable';
import { FamilyAccessionStackedTable } from './../../browse/CaseDetailPane';
import { PedigreeTabViewBody, PedigreeFullScreenBtn } from '../components/PedigreeTabViewBody';
import { PedigreeTabView, PedigreeTabViewOptionsController } from './PedigreeTabView';
import { parseFamilyIntoDataset } from './family-parsing';
import { CurrentFamilyController, FamilyItemParser } from './CurrentFamilyController';
import { CaseStats } from './CaseStats';
import { FilteringTab } from './FilteringTab';
import { InterpretationTab, InterpretationTabController } from './InterpretationTab';
import { CaseReviewTab } from './CaseReviewTab';
import { CaseReviewController, CaseReviewSelectedNotesStore } from './CaseReviewTab/CaseReviewController';
import { getAllNotesFromVariantSample, NoteSubSelectionStateController } from './variant-sample-selection-panels';
import QuickPopover from './../components/QuickPopover';
import { Accordion, AccordionContext, Card, useAccordionToggle } from 'react-bootstrap';



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
            PedigreeTabViewOptionsController,
            FamilyItemParser
        ];
    }

    getTabViewContents(controllerProps = {}){
        const { currPedigreeFamily } = controllerProps;
        const { "@id": familyAtID, members = [] } = currPedigreeFamily || {};

        const membersLen = members.length;
        const commonTabProps = { ...this.props, ...controllerProps };
        const initTabs = [];

        initTabs.push(CaseInfoTabView.getTabObject(commonTabProps));

        if (familyAtID && membersLen > 0) {
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
        // Passed in from CaseView or 1 of its controllers
        graphData,
        selectedDiseaseIdxMap,
        idToGraphIdentifier,
        PedigreeVizLibrary = null,
        // Passed in from TabView
        isActiveTab,
        // Passed in from VariantSampleListController which wraps this component in `getTabObject`
        variantSampleListItem = null,
        isLoadingVariantSampleListItem = false,
        updateVariantSampleListID,
        updateVariantSampleListSort,
        savedVariantSampleIDMap = {},
        fetchVariantSampleListItem,
        vslSortType,
        // Passed in from CurrentFamilyController
        canonicalFamily,
        currPedigreeFamily,
        familiesWithViewPermission
    } = props;

    const { PedigreeVizView } = PedigreeVizLibrary || {}; // Passed in by PedigreeVizLoader, @see CaseView.getControllers();

    const {
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
        sv_initial_search_href_filter_addon: svFilterHrefAddon = "",
        actions: caseActions = []
    } = context;

    const { variant_samples: vsSelections = [], structural_variant_samples: cnvSelections = [] } = variantSampleListItem || {};

    /**
     * Used to inform whether to show edit icons in places.
     * Used as fallback when difficult/inperformant to determine if have edit
     * permission for attached items such as Family & Individual.
     * @type {boolean}
     */
    const haveCaseEditPermission = useMemo(function(){
        return !!(_.findWhere(caseActions, { "name" : "edit" }));
    }, [ context ]);

    const secondaryFamilies = useMemo(function(){
        return (familiesWithViewPermission || []).filter(function(spFamily){
            // canonicalFamily would have been selected from this same list, so object references
            // should be identical and we don't have to compare uuid strings (slower)
            return spFamily !== canonicalFamily;
        });
    }, [ familiesWithViewPermission, canonicalFamily ]);

    const {
        countIndividuals: numIndividuals,
        countIndividualsWSamples: numWithSamples
    } = useMemo(function(){
        const { members = [] } = canonicalFamily || {};
        let countIndividuals = 0;
        let countIndividualsWSamples = 0;
        members.forEach(function({ samples }){
            if (Array.isArray(samples) && samples.length > 0) {
                countIndividualsWSamples++;
            }
            countIndividuals++;
        });
        return { countIndividuals, countIndividualsWSamples };
    }, [ canonicalFamily ]);

    const anyAnnotatedVariantSamples = useMemo(function(){ // checks for notes on SNVs and CNV/SVs
        const allSelections = vsSelections.concat(cnvSelections);
        const allSelectionsLen = allSelections.length;

        for (var i = 0; i < allSelectionsLen; i++) {
            const { variant_sample_item } = allSelections[i];
            const notesForVS = getAllNotesFromVariantSample(variant_sample_item);
            if (notesForVS.length > 0) {
                return true;
            }
        }

        return false;
    }, [ variantSampleListItem ]);

    const onViewPedigreeBtnClick = useCallback(function(evt){
        evt.preventDefault();
        evt.stopPropagation();
        if (!currPedigreeFamily) return false;
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
                    <EmbeddedCaseSearchTable session={session} facets={null} searchHref={`/search/?type=Case&accession=${caseAccession}`} />
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
        <div className="d-none d-lg-block pedigree-placeholder flex-fill" onClick={onViewPedigreeBtnClick} disabled={!currPedigreeFamily}>
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

    // Use currently selected variants and structural variants in VSL to determine if Interpretation and Case Review tabs should be displayed
    const disableInterpretation = !isLoadingVariantSampleListItem && vsSelections.length === 0 && cnvSelections.length === 0;

    // Filtering props shared among both tables, then SV and SNV specific props
    const filteringTableProps = {
        context, windowHeight, session, schemas,
        haveCaseEditPermission,
        setIsSubmitting, variantSampleListItem,
        updateVariantSampleListID, savedVariantSampleIDMap,
        fetchVariantSampleListItem, isLoadingVariantSampleListItem
    };

    useEffect(() => {
        ReactTooltip.rebuild();
    }, [vslSortType]);

    return (
        <React.Fragment>
            { !isActiveTab ? null : (
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
            ) }
            <hr className="tab-section-title-horiz-divider" />
            <div className="container-wide bg-light pt-36 pb-36">
                <div className="card-group case-summary-card-row">
                    { !isActiveTab ? null : (
                        <div className="col-stats mb-2 mb-lg-0">
                            <CaseStats caseItem={context} {...{ description, numIndividuals, numWithSamples, caseFeatures, haveCaseEditPermission, canonicalFamily }} numFamilies={1} />
                        </div>
                    )}
                    <div id="case-overview-ped-link" className="col-pedigree-viz">
                        <div className="card d-flex flex-column">
                            <div className="pedigree-vis-heading card-header primary-header d-flex justify-content-between">
                                <div>
                                    <i className="icon icon-sitemap fas icon-fw mr-1"/>
                                    <h4 className="text-white text-400 d-inline-block mt-0 mb-0 ml-05 mr-05">
                                        Pedigree
                                    </h4>
                                </div>
                                <button type="button" className="btn btn-primary btn-sm view-pedigree-btn"
                                    onClick={onViewPedigreeBtnClick} disabled={!currPedigreeFamily}>
                                    View
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

            { canonicalFamily && caseIndividual ?
                <DotRouter href={href} isActive={isActiveTab} navClassName="container-wide pt-36 pb-36" contentsClassName="container-wide bg-light pt-36 pb-36" prependDotPath="case-info">
                    <DotRouterTab dotPath=".accessioning" default tabTitle="Accessioning">
                        <AccessioningTab {...{ context, href, canonicalFamily, secondaryFamilies }} />
                    </DotRouterTab>
                    <DotRouterTab dotPath=".bioinformatics" disabled={disableBioinfo} tabTitle="Bioinformatics">
                        <BioinformaticsTab {...{ context, idToGraphIdentifier, canonicalFamily }} />
                    </DotRouterTab>
                    <DotRouterTab dotPath=".filtering" cache disabled={disableFiltering} tabTitle="Filtering"
                        contentsClassName="container-wide bg-light pt-36 pb-0">
                        <FilteringTab {...filteringTableProps} />
                    </DotRouterTab>
                    <DotRouterTab dotPath=".interpretation" cache disabled={disableInterpretation} tabTitle={
                        <span data-tip={isLoadingVariantSampleListItem ? "Loading latest selection, please wait..." : null}>
                            { isLoadingVariantSampleListItem ? <i className="icon icon-spin icon-circle-notch mr-1 fas"/> : null }
                            Interpretation
                        </span>}>
                        <InterpretationTabController {...{ variantSampleListItem }}>
                            <InterpretationTab {...{ schemas, context, isLoadingVariantSampleListItem, fetchVariantSampleListItem, updateVariantSampleListSort, vslSortType, haveCaseEditPermission }} />
                        </InterpretationTabController>
                    </DotRouterTab>
                    <DotRouterTab dotPath=".review" cache disabled={anyAnnotatedVariantSamples ? false : true} tabTitle="Case Review">
                        <CaseReviewController {...{ context, variantSampleListItem }}>
                            <CaseReviewSelectedNotesStore>
                                <NoteSubSelectionStateController>
                                    <CaseReviewTab {...{ schemas, isLoadingVariantSampleListItem, fetchVariantSampleListItem, updateVariantSampleListSort, vslSortType, haveCaseEditPermission }} />
                                </NoteSubSelectionStateController>
                            </CaseReviewSelectedNotesStore>
                        </CaseReviewController>
                    </DotRouterTab>
                </DotRouter>
                :
                <div className="error-placeholder bg-light py-5 px-3 border-top border-bottom">
                    <h4 className="text-400 text-center">No family or no individual defined for this case.</h4>
                </div>
            }
        </React.Fragment>
    );
});
CaseInfoTabView.getTabObject = function(props){
    const { context: { variant_sample_list_id } = {}, href } = props;
    return {
        "tab" : (
            <React.Fragment>
                <i className="icon icon-cogs fas icon-fw"/>
                <span>Case Info</span>
            </React.Fragment>
        ),
        "key" : "case-info",
        "disabled" : false,
        "content" : (
            <VariantSampleListController id={variant_sample_list_id} href={href}>
                <CaseInfoTabView {...props} />
            </VariantSampleListController>
        ),
        "cache": true
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

        let defaultChildTab = null;

        for (var i = 0; i < childrenLen; i++) {
            const currChild = children[i];
            if (currChild.props.disabled) {
                continue;
            }
            defaultChildTab = currChild;
            if (currChild.props.default === true) {
                break;
            }
        }

        // If no default found, use last non-disabled tab.
        return defaultChildTab;
    }

    static defaultProps = {
        "className" : null,
        "navClassName" : "container-wide",
        "contentsClassName" : "container-wide",
        "elementID" : "dot-router"
    };

    constructor(props){
        super(props);
        this.getCurrentTab = this.getCurrentTab.bind(this);
        this.memoized = {
            getDefaultTab: memoize(DotRouter.getDefaultTab),
            getDotPath: memoize(DotRouter.getDotPath)
        };
    }

    /**
     * Method is not explicitly memoized b.c. this component only has 2 props & is a PureComponent itself
     */
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
        const { children, className, prependDotPath, navClassName, contentsClassName, elementID, isActive = true } = this.props;
        const currentTab = this.getCurrentTab();
        const { props : { dotPath: currTabDotPath } } = currentTab; // Falls back to default tab if not in hash.
        // const contentClassName = "tab-router-contents" + (contentsClassName ? " " + contentsClassName : "");
        const allTabContents = [];

        const adjustedChildren = React.Children.map(children, function(childTab, index){
            const {
                props: {
                    dotPath,
                    children: tabChildren,
                    cache = false,
                    contentsClassName: overridingContentsClassName
                }
            } = childTab;

            const active = isActive && (currTabDotPath === dotPath);

            if (active || cache) {
                // If we cache tab contents, then pass down `props.isActiveDotRouterTab` so select downstream components
                // can hide or unmount themselves when not needed for performance.
                const transformedChildren = !cache ? tabChildren : React.Children.map(tabChildren, (child)=>{
                    if (!React.isValidElement(child)) {
                        // String or something
                        return child;
                    }
                    if (typeof child.type === "string") {
                        // Normal element (a, div, etc)
                        return child;
                    } // Else is React component
                    return React.cloneElement(child, { "isActiveDotRouterTab": active });
                });
                const clsSuffix = overridingContentsClassName || contentsClassName || null;
                const cls = "tab-router-contents" + (clsSuffix ? " " + clsSuffix : "") + (!active ? " d-none" : "");
                allTabContents.push(
                    <div className={cls} id={(prependDotPath || "") + dotPath} data-tab-index={index} key={dotPath}>
                        <TabPaneErrorBoundary>
                            { transformedChildren }
                        </TabPaneErrorBoundary>
                    </div>
                );
            }

            return React.cloneElement(childTab, { "key": dotPath, active, prependDotPath, index });
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
    const {
        tabTitle,
        dotPath,
        disabled = false,
        active,
        prependDotPath,
        children,
        className = "",
        ...passProps
    } = props;

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
        <button type="button" onClick={disabled ? null : onClick} disabled={disabled}
            className={"arrow-tab" + (disabled ? " disabled " : "") + (active ? " active" : "")}>
            <div className="btn-prepend d-xs-none">
                <svg viewBox="0 0 1.5875 4.2333333" width={6} height={16}>
                    <path d="M 0,4.2333333 1.5875,2.1166667 v 2.1166666 z"/>
                    <path d="M 0,3.3e-6 1.5875,0 v 2.1166667 z"/>
                </svg>
            </div>
            <div className="btn-title">{ tabTitle }</div>
            <div className="btn-append d-xs-none">
                <svg viewBox="0 0 1.5875 4.2333333" width={6} height={16}>
                    <path d="M 0,3.3e-6 1.5875,2.1166733 0,4.2333333 Z"/>
                </svg>
            </div>
        </button>
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
    const { context, canonicalFamily, secondaryFamilies = [] } = props;
    const { display_title: primaryFamilyTitle, '@id': canonicalFamilyAtID } = canonicalFamily;
    const [ isSecondaryFamiliesOpen, setSecondaryFamiliesOpen ] = useState(false);
    const secondaryFamiliesLen = secondaryFamilies.length;

    const viewSecondaryFamiliesBtn = secondaryFamiliesLen === 0 ? null : (
        <div className="pt-2">
            <button type="button" className="btn btn-block btn-outline-dark" onClick={function(){ setSecondaryFamiliesOpen(function(currentIsSecondaryFamiliesOpen){ return !currentIsSecondaryFamiliesOpen; }); }}>
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
                            <div key={canonicalFamilyAtID} className="primary-family">
                                <h4 className="mt-0 mb-16 text-400">
                                    <span className="text-300">Primary Cases from </span>
                                    { primaryFamilyTitle }
                                </h4>
                                <FamilyAccessionStackedTable family={canonicalFamily} result={context}
                                    fadeIn collapseLongLists collapseShow={1} />
                            </div>
                        ]}
                        collapsible={!isSecondaryFamiliesOpen ? null :
                            secondaryFamilies.map(function(family){
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

const bioinfoPopoverContent = {
    predictedSexAndAncestry: (
        <div>
            Sex and ancestry of each sample is predicted using the QC tool <a href="https://github.com/brentp/peddy" target="_blank" rel="noreferrer">peddy</a>.
            For more info see peddy’s <a href="https://peddy.readthedocs.io/en/latest/" target="_blank" rel="noreferrer">documentation</a>.
        </div>
    ),
    filteredSNVIndelVariants: (
        <div>
            During processing, <a href="https://cgap-pipeline-main.readthedocs.io/en/latest/Pipelines/Downstream/SNV_germline/Pages/SNV_germline-step-filtering.html" target="_blank" rel="noreferrer">hard filters are applied</a> to
            remove variants that will not be of interest. This lowers the number of variants returned from the millions to the thousands.
            Briefly, these filters include: (1) removing intergenic variants; (2) including some variants based on VEP, ClinVar, and SpliceAI
            annotations; (3) Removing variants with only intronic consequences; and (4) removing common variants based on gnomAD population allele
            frequency and a panel of unrelated samples.
        </div>
    ),
    filteredSVVariants: (
        <div>
            During processing, <a href="https://cgap-pipeline-main.readthedocs.io/en/latest/Pipelines/Downstream/SV_germline/Pages/SV_germline-step-part-3.html" target="_blank" rel="noreferrer">hard filters are applied</a> to
            remove structural variants (SVs) that will not be of interest. This limits the numbers and types of SVs returned from thousands
            to fewer than 500. Briefly, these filters include: (1) including SVs based on VEP annotations; (2) removing SVs with only intronic
            or intergenic consequences; (3) selecting SVs based on SV type (e.g., DEL and DUP); (3) removing common variants based on gnomAD-SV
            population allele frequency, and a panel of 20 unrelated samples; and (4) removing SVs over a certain size.
            <p>
                Note: SVs are only available for WGS samples.
            </p>
        </div>
    ),
    heterozygosity: (
        <div>
            The Heterozygosity/Homozygosity ratio is calculated by bcftools. Expected values are between 1.4 - 2.5; higher or lower values can indicate lower quality calls.
        </div>
    ),
    transTransRatio: (
        <div>
            The Transition/Transversion ratio is calculated by bcftools. Expected values are 1.8-2.1 overall for WGS, and 2.2-3.3 for WES. Values outside this range can indicate lower accuracy of calls.
        </div>
    ),
    coverage: (
        <div>
            Coverage is calculated by samtools. For WGS samples, expected values are
            &gt; 25X, and failures are &lt; 10X. For WES samples, expected values are
            &gt; 70X, and failures are &lt; 40X.
        </div>
    )
};

const mapLongFormSexToLetter = (sex) => {
    if (!sex) { return; }

    // Ensure it's lowercase
    const sexLower = sex.toLowerCase();

    switch (sexLower) {
        case "male":
            return "M";
        case "female":
            return "F";
        case "unknown":
        case "undetermined":
            return "U";
        default:
            // unexpected value... render as-is
            return sex;
    }
};

const flagToBootstrapClass = (flag) => {
    switch (flag) {
        case "pass":
            return "success";
        case "fail":
            return "danger";
        case "warn":
            return "warning";
        default:
            return "";
    }
};

const BioinfoStats = React.memo(function BioinfoStats(props) {
    const { canonicalFamily, caseSample = null, sampleProcessing = null, idToGraphIdentifier, relationshipMapping } = props;

    return (<QCMAccordion {...{ sampleProcessing, canonicalFamily, relationshipMapping, idToGraphIdentifier }} />);
});

function BioinfoStatTable({ qualityControlMetrics }) {
    const {
        total_reads: reads = {},
        coverage = {},
        total_variants_called: totalSNVIndelVars = {},
        transition_transversion_ratio: transTransRatio = {},
        heterozygosity_ratio: heterozygosity = {},
        de_novo_fraction: deNovo = {},
        filtered_variants: filteredSNVIndelVariants = {},
        filtered_structural_variants: filteredSVVariants = {},
        predicted_sex: predictedSex = {},
        predicted_ancestry: predictedAncestry = {},
        sex: submittedSex = {},
        ancestry: { value: submittedAncestry = [] } = {}
    } = qualityControlMetrics;

    const fallbackElem = "-";

    return (
        <React.Fragment>
            <div className="row py-0">
                <BioinfoStatsEntry label="Total Number of Reads">
                    { reads.value ? decorateNumberWithCommas(+reads.value) : fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Coverage" popoverContent={bioinfoPopoverContent.coverage}>
                    { coverage.value || fallbackElem }
                    { (coverage.value && coverage.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(coverage.flag)} ml-05`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Total Number of SNVs/Indels called">
                    { totalSNVIndelVars.value ? decorateNumberWithCommas(+totalSNVIndelVars.value): fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Transition-Transversion ratio" popoverContent={bioinfoPopoverContent.transTransRatio}>
                    { transTransRatio.value || fallbackElem }
                    { (transTransRatio.value && transTransRatio.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(transTransRatio.flag)} ml-05`} />}
                </BioinfoStatsEntry>
            </div>
            <div className="row py-0">
                <BioinfoStatsEntry label="Submitted Sex" >
                    { submittedSex.value || fallbackElem }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Predicted Sex" popoverContent={bioinfoPopoverContent.predictedSexAndAncestry}>
                    { mapLongFormSexToLetter(predictedSex.value) || fallbackElem }&nbsp;
                    { !!predictedSex.link && <a href={predictedSex.link} target="_blank" rel="noreferrer" className="text-small">(see peddy QC report)</a> }
                    { predictedSex.flag && <i className={`icon icon-flag fas text-${flagToBootstrapClass(predictedSex.flag)} ml-02`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Heterozygosity ratio" popoverContent={bioinfoPopoverContent.heterozygosity}>
                    { heterozygosity.value || fallbackElem }
                    { (heterozygosity.value && heterozygosity.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(heterozygosity.flag)} ml-05`}/>}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="SNVs/Indels After Hard Filters" popoverContent={bioinfoPopoverContent.filteredSNVIndelVariants}>
                    { filteredSNVIndelVariants.value ? decorateNumberWithCommas(+filteredSNVIndelVariants.value) : fallbackElem }
                </BioinfoStatsEntry>
            </div>
            <div className="row py-0">
                <BioinfoStatsEntry label="Submitted Ancestry" >
                    { submittedAncestry.length > 0 && submittedAncestry.join(", ") || "-" }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Predicted Ancestry" popoverContent={bioinfoPopoverContent.predictedSexAndAncestry}>
                    { predictedAncestry.value || fallbackElem }&nbsp;
                    { !!predictedAncestry.link && <a href={predictedAncestry.link} target="_blank" rel="noreferrer" className="text-small">(see peddy QC report)</a> }
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="SNV/Indel De novo Fraction">
                    { deNovo.value || fallbackElem }
                    { (deNovo.value && deNovo.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(deNovo.flag)} ml-05`}/>}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Structural Variants After Hard Filters" popoverContent={bioinfoPopoverContent.filteredSVVariants}>
                    { filteredSVVariants.value ? decorateNumberWithCommas(+filteredSVVariants.value) : fallbackElem }
                </BioinfoStatsEntry>
            </div>
        </React.Fragment>
    );
}

function BioinfoStatsEntry({ tooltip, label, children, popoverContent = null }){
    const id = "biostatsentry_" + label.split(" ").join("_");
    return (
        <div className="col-12 col-md-6 col-lg-3 col-xl-3 py-2">
            <div className="qc-summary">
                <label className="d-inline mb-0" htmlFor={id}>
                    { label }:
                    { !popoverContent && tooltip ?
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={tooltip} data-place="right"/>
                        : null }
                </label>
                { popoverContent ? <QuickPopover popID={label} tooltip={tooltip || "Click for more info"} className="p-0 ml-05">{ popoverContent }</QuickPopover>: null }
                <div {...{ id }}>{ children }</div>
            </div>
        </div>
    );
}

const BioinformaticsTab = React.memo(function BioinformaticsTab(props) {
    const {
        context,
        idToGraphIdentifier,
        canonicalFamily
    } = props;
    const {
        sample_processing: sampleProcessing = null,
        sample: caseSample = null,
        vcf_file: vcf = null,
        individual: { sex: submittedSex = null, ancestry: submittedAncestry = [] } = {},
    } = context;
    const { "@id": vcfAtId = null } = vcf || {};

    const {
        // original_pedigree: { display_title: pedFileName } = {},
        display_title: familyDisplayTitle,
        relationships = []
    } = canonicalFamily;

    const title = (
        <h4 data-family-index={0} className="my-0 d-inline-block w-100">
            <span className="text-400">{ familyDisplayTitle }</span>
            {/* { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null } */}
            <a href={vcfAtId + "#provenance"} className="btn btn-sm btn-primary pull-right d-flex align-items-center"
                data-tip="Click to view the provenance graph for the most up-to-date annotated VCF"
                disabled={(!vcfAtId)}>
                <i className="icon icon-fw icon-sitemap icon-rotate-90 fas mr-08 small" />
                <span className="mr-03">View</span><span className="text-600">Provenance Graph</span>
            </a>
        </h4>
    );

    // Create a mapping of individuals to relationship and sex
    const relationshipMapping = generateRelationshipMapping(relationships);

    return (
        <React.Fragment>
            <h1><span className="text-300">Bioinformatics Analysis</span></h1>
            {/* TODO: See if there's any desire to include QC statuses here (BAM, SNV, SV, etc.)
            <div className="tab-inner-container clearfix font-italic qc-status">
                <span className="text-600">Current Status:</span><span className="text-success"> PASS <i className="icon icon-check fas"></i></span>
                <span className="pull-right">3/28/20</span>
            </div> */}
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Quality Control Metrics (QC)</h4>
                <BioinfoStats {...{ caseSample, canonicalFamily, sampleProcessing, submittedAncestry, submittedSex, idToGraphIdentifier, relationshipMapping }} />
            </div>
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Multisample Analysis Table</h4>
                <div className="card-body family-index-0" data-is-current-family={true}>
                    { title }
                    <CaseSummaryTable family={canonicalFamily} sampleProcessing={[sampleProcessing]} isCurrentFamily={true} idx={0} {...{ idToGraphIdentifier, relationshipMapping }} />
                </div>
            </div>
        </React.Fragment>
    );
});



function QCMAccordionToggle({ children, eventKey, callback, role, sequencingType, specimenType, sampleID }) {
    const activeEventKey = useContext(AccordionContext);

    const decoratedOnClick = useAccordionToggle(
        eventKey,
        () => callback && callback(eventKey),
    );

    const isCurrentEventKey = activeEventKey === eventKey;

    const icon = isCurrentEventKey ? "minus" : "plus";

    return (
        <div onClick={decoratedOnClick} className="card-header btn d-flex justify-content-between justify-items-center flex-column flex-sm-row">
            <div className="d-flex align-items-center justify-items-center">
                <i className={`icon icon-${icon} fas mr-1`} />
                <div className="d-flex flex-column flex-lg-row flex-xl-row justify-content-center text-left text-truncate text-600 text-capitalize text-larger pl-03">
                    {role ? `${role}:`: ""}
                    <div className="ml-lg-05 ml-xl-05 mr-05 text-400 text-capitalize d-inline-block text-truncate">
                        {specimenType && sequencingType ? `${specimenType} - ${sequencingType}`:
                            specimenType ? specimenType : sequencingType}
                    </div>
                    <div className="text-400 text-muted text-truncate d-inline-block">
                        {sampleID ? `(${sampleID})` : ""}
                    </div>
                </div>
            </div>
            { children }
        </div>
    );
}


function QCMAccordion(props) {
    const {
        canonicalFamily = {},
        sampleProcessing = {},
        idToGraphIdentifier,
        relationshipMapping = {}
    } = props || {};

    const {
        quality_control_metrics = [],
    } = sampleProcessing;

    const qcmLen = quality_control_metrics.length;

    if (qcmLen === 0) {
        return <div className="m-4">No Quality Control Metrics Available</div>;
    }

    const sortedQCMs = sortAndAddRolePropsToQCMs(quality_control_metrics, relationshipMapping);

    return (
        <Accordion defaultActiveKey={sortedQCMs[0].atID} className="w-100">
            { sortedQCMs.map((qcm, i) => <QCMAccordionDrawer key={qcm.individual_accession} idx={i} {...{ idToGraphIdentifier, relationshipMapping, qcmLen }} qualityControlMetrics={qcm} />)}
        </Accordion>
    );
}

function QCMAccordionDrawer(props) {
    const { idToGraphIdentifier, qualityControlMetrics, idx, qcmLen } = props || {};
    const {
        atID,
        role,
        individual_id,
        individual_accession,
        warn = [],
        fail = [],
        sequencing_type: sequencingType,
        bam_sample_id: sampleID,
        specimen_type: specimenType
    } = qualityControlMetrics || {};

    const warnFlags = warn.map((flag) => <QCMFlag key={flag} type="warn" title={flag} />);
    const failFlags = fail.map((flag) => <QCMFlag key={flag} type="fail" title={flag} />);

    return (
        <div className={`card border-left-0 border-right-0 ${idx === 0 ? "border-top-0": ""} ${idx === (qcmLen - 1) ? "border-bottom-0": ""}`} key={atID}>
            <QCMAccordionToggle eventKey={atID} {...{ role, sequencingType, sampleID, specimenType }}>
                <div className="d-flex align-items-center justify-items-center ml-2 ml-sm-0">
                    { failFlags }
                    { warnFlags }
                </div>
            </QCMAccordionToggle>
            <Accordion.Collapse eventKey={atID}>
                <>
                    <div className="card-body d-flex align-items-center py-1 px-5" style={{
                        /** @TODO: Move these styles to SCSS */
                        backgroundColor: "#f4f4f4",
                        borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                        borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
                    }}>
                        <a href={atID} className="text-uppercase text-600 d-block text-small mr-2">{ individual_id || individual_accession }</a>
                        <span className="gen-identifier text-600 text-serif text-small pt-03">{ idToGraphIdentifier[atID] }</span>&nbsp;
                    </div>
                    <div className="card-body px-5">
                        <BioinfoStatTable {...{ qualityControlMetrics }} />
                    </div>
                </>
            </Accordion.Collapse>
        </div>
    );
}

export function QCMFlag({ type, title, cls = "m-0 ml-1" }) {
    if (!title || !type) return null;

    const alertClass = type === "warn" ? "warning" : "danger";

    return (
        <div data-flag={type} className={`qcm-flag alert alert-${alertClass} py-1 px-3 text-small border-0 d-flex align-items-center justify-items-center ${cls}`} role="alert">
            <span className="d-none d-lg-block text-truncate">{qcmFieldNameToDisplay(title)}</span>
            <i className={`icon icon-flag fas text-${flagToBootstrapClass(alertClass)} ml-05`} />
        </div>
    );
}

function qcmFieldNameToDisplay(field = "") {
    switch(field) {
        // Special cases
        case "de_novo_fraction":
            return "De novo Fraction";
        case "transition_transversion_ratio":
            return "Transition-Transversion";
        case "heterozygosity_ratio":
            return "Heterozygosity";
        // Should suffice for most other cases... just split and capitalize each word
        // case "total_reads":
        // case "total_variants_called":
        // case "filtered_variants":
        // case "filtered_structural_variants":
        // case "coverage":
        // case "predicted_sex":
        // case "predicted_ancestry":
        default:
            return field.split("_").map((word) => capitalize(word)).join(" ");
    }
}

/** @TODO Group multiple samples by Individual */
export function sortAndAddRolePropsToQCMs(qcms = [], relationshipMapping) {
    // Add the new properties to the item without sorting
    if (qcms.length === 1) {
        const { 0: { individual_accession: thisAccession } = {} } = qcms;

        const atID = `/individuals/${thisAccession}/`;
        const relation = relationshipMapping[thisAccession]?.relationship;

        qcms[0].atID = atID;
        qcms[0].role = relation;

        return qcms;
    }

    // Specify which order to put roles in
    const exceptions = {
        "proband": 1,
        "mother": 2,
        "father": 3
    };

    // Otherwise do sort
    return qcms.sort((a, b) => {
        const { individual_accession: aAccession } = a;
        const { individual_accession: bAccession } = b;

        const atIDA = `/individuals/${aAccession}/`;
        const atIDB = `/individuals/${bAccession}/`;

        // Find relationships
        const relationA = relationshipMapping[aAccession]?.relationship;
        const relationB = relationshipMapping[bAccession]?.relationship;

        // Add props to QCMS for future use
        a.atID = atIDA;
        b.atID = atIDB;
        a.role = relationA;
        b.role = relationB;

        // Sort by proband first, then by mother and father
        if (exceptions[relationA] && exceptions[relationB]) {
            return exceptions[relationA] - exceptions[relationB];
        } else if (exceptions[relationA]) {
            return -1;
        } else if (exceptions[relationB]) {
            return -1;
        } else {
            // Sort leftovers alphabetically
            return relationA.localeCompare(relationB);
        }
    });
}

export function generateRelationshipMapping(relationshipsFromCanonicalFamily) {

    // Create a mapping of individuals to relationship and sex
    const relationshipMapping = {};
    relationshipsFromCanonicalFamily.forEach((item) => {
        const { relationship = null, sex = null, individual = null } = item;
        relationshipMapping[individual] = { sex, relationship };
    });

    return relationshipMapping;
}
