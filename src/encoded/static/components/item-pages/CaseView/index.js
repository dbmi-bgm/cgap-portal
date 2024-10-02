'use strict';

import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import { Accordion, AccordionContext, Fade, useAccordionToggle } from 'react-bootstrap';

import { navigate, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DotRouter, DotRouterTab, TabPaneErrorBoundary } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/DotRouter';

import { responsiveGridState } from './../../util/layout';
import { usePrevious } from '../../util/hooks';

import DefaultItemView from './../DefaultItemView';
import { EmbeddedCaseSearchTable } from '../components/EmbeddedItemSearchTable';
import { PedigreeVizLoader } from '../components/pedigree-viz-loader';
import { PedigreeTabViewBody, PedigreeFullScreenBtn } from '../components/PedigreeTabViewBody';
import { VariantSampleListController } from './VariantSampleListController';
import { CaseSummaryTable } from './CaseSummaryTable';
import { PedigreeTabView, PedigreeTabViewOptionsController } from './PedigreeTabView';
import { parseFamilyIntoDataset } from './family-parsing';
import { CurrentFamilyController, FamilyItemParser } from './CurrentFamilyController';
import { CaseStats } from './CaseStats';
import { FilteringTab } from './FilteringTab';
import { InterpretationTab, InterpretationTabController } from './InterpretationTab';
import { CaseReviewTab } from './CaseReviewTab';
import { CaseReviewController, CaseReviewSelectedNotesStore } from './CaseReviewTab/CaseReviewController';
import { getAllNotesFromVariantSample, NoteSubSelectionStateController } from './variant-sample-selection-panels';
import { AccessioningTab } from './AccessioningTab';
import { BioinformaticsTab } from './BioinformaticsTab';



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
    getControllers() {
        return [
            PedigreeVizLoader,
            CurrentFamilyController, // <- This passes down props.currFamily into PedigreeTabViewOptionsController. Could possibly change to just use context.family now.
            PedigreeTabViewOptionsController,
            FamilyItemParser
        ];
    }

    getTabViewContents(controllerProps = {}) {
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
    additionalItemActionsContent() {
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

const CaseInfoTabView = React.memo(function CaseInfoTabView(props) {
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
    const haveCaseEditPermission = useMemo(function () {
        return !!(_.findWhere(caseActions, { "name": "edit" }));
    }, [context]);

    const secondaryFamilies = useMemo(function () {
        return (familiesWithViewPermission || []).filter(function (spFamily) {
            // canonicalFamily would have been selected from this same list, so object references
            // should be identical and we don't have to compare uuid strings (slower)
            return spFamily !== canonicalFamily;
        });
    }, [familiesWithViewPermission, canonicalFamily]);

    const {
        countIndividuals: numIndividuals,
        countIndividualsWSamples: numWithSamples
    } = useMemo(function () {
        const { members = [] } = canonicalFamily || {};
        let countIndividuals = 0;
        let countIndividualsWSamples = 0;
        members.forEach(function ({ samples }) {
            if (Array.isArray(samples) && samples.length > 0) {
                countIndividualsWSamples++;
            }
            countIndividuals++;
        });
        return { countIndividuals, countIndividualsWSamples };
    }, [canonicalFamily]);

    const anyAnnotatedVariantSamples = useMemo(function () { // checks for notes on SNVs and CNV/SVs
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
    }, [variantSampleListItem]);

    const onViewPedigreeBtnClick = useCallback(function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (!currPedigreeFamily) return false;
        // By default, click on link elements would trigger ajax request to get new context.
        // (unless are external links)
        navigate("#pedigree", { skipRequest: true, replace: true });
    }, [ /* empty == executed only once ever */]);

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

    if (PedigreeVizView && windowWidth !== null && (rgs === "lg" || rgs === "xl" || rgs === "xxl")) {
        // at windowWidth === null, `rgs` defaults to 'lg' or 'xl' for serverside render

        if (rgs === "lg") {
            pedWidth = 400;
        }

        if (rgs === "xl" || rgs === "xxl") {
            pedWidth = 560;
            if (windowWidth >= 1680) {
                pedWidth = 800;
            }
        }

        if (graphData) {
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

    const [loadingAccordion, setLoadingAccordion] = useState(true);
    const [accordion, setAccordion] = useState(null);

    let defaultAccordionState = "0";

    const prevHref = usePrevious(href);

    useEffect(() => {
        // Want to make sure to skip that very first render where href is undefined, but before the dot path appears
        // (see note by dependency aray for info on when there isn't a dot path...)
        // Second render after that should have the "real href" with dotpath present (OR schemas should have loaded instead)
        if (loadingAccordion && (prevHref || schemas)) {

            // Only show case information by default when loading into accessioning (explicitly or no dot path provided)
            const dotPath = DotRouter.getDotPath(href);
            defaultAccordionState = (dotPath === ".accessioning" || !dotPath) ? "0" : null; // "0" is open, null is close

            // Need the defaultActiveKey to be correct on first render, so defining it here, and THEN rendering
            setAccordion(
                <Accordion
                    defaultActiveKey={defaultAccordionState}
                    className="w-100"
                >
                    {!isActiveTab ?
                        null :
                        <CaseInfoToggle eventKey="0">
                            <>
                                <div className="pt-12 pb-06">
                                    <span>
                                        {caseNamedTitle || caseNamedID}
                                    </span>
                                    <object.CopyWrapper className="text-smaller text-muted font-monospace text-400" value={caseAccession} stopPropagation>
                                        {caseAccession}
                                    </object.CopyWrapper>
                                </div>
                            </>
                            <>
                                <button type="button" className="btn btn-primary btn-sm view-pedigree-btn py-2 px-4 rounded"
                                    onClick={onViewPedigreeBtnClick} disabled={!currPedigreeFamily}>
                                    View Pedigree
                                </button>
                            </>
                        </CaseInfoToggle>}
                    <Accordion.Collapse eventKey="0">
                        <>
                            <div className="container-wide bg-light pt-36 pb-36">
                                <div className="card-group case-summary-card-row">
                                    {!isActiveTab ? null : (
                                        <div className="col-stats mb-2 mb-lg-0">
                                            <CaseStats caseItem={context} {...{ description, numIndividuals, numWithSamples, caseFeatures, haveCaseEditPermission, canonicalFamily }} numFamilies={1} />
                                        </div>
                                    )}
                                    <div id="case-overview-ped-link" className="col-pedigree-viz">
                                        <div className="card d-flex flex-column">
                                            <div className="pedigree-vis-heading card-header primary-header d-flex justify-content-between">
                                                <div>
                                                    <i className="icon icon-sitemap fas icon-fw me-1" />
                                                    <h4 className="text-white text-400 d-inline-block mt-0 mb-0 ms-05 me-05">
                                                        Pedigree
                                                    </h4>
                                                </div>
                                                <button type="button" className="btn btn-primary btn-sm view-pedigree-btn"
                                                    onClick={onViewPedigreeBtnClick} disabled={!currPedigreeFamily}>
                                                    View
                                                </button>
                                            </div>
                                            {pedBlock}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="container-wide bg-light pt-12 pb-6">
                                <div className="processing-summary-tables-container mt-0">
                                    {caseSearchTables}
                                </div>
                            </div>
                        </>
                    </Accordion.Collapse>
                </Accordion>
            );

            // Once a default state has been decided, load the accordion
            setLoadingAccordion(false);
        }
    },
    // Use of schemas here is kiiinda hacky. When there is no dotpath, we need a way to know that there will not be a second update of href (which there isn't if server href matches href from window).
    // In app.js that second update of href happens in componentDidMount() when window is loaded. loadSchemas() is triggered right AFTER that, so schemas will always appear after that final href update.
    // We're using that here to ensure that SOMETHING will be rendered for the accordion in the case there is no second update of href. If there's a better way to do this: fix it.
    [
        href,
        schemas
    ]);

    return (
        <React.Fragment>
            {loadingAccordion && <div className="container-wide d-flex justify-content-center" style={{ minHeight: "78px" }}><div className="pt-3"><i className="icon-spin icon-circle-notch fas" /></div></div>}
            {!loadingAccordion && accordion}

            {canonicalFamily && caseIndividual ?
                <DotRouter href={href} isActive={isActiveTab} navClassName="container-wide pt-36 pb-36" contentsClassName="container-wide bg-light pt-36 pb-36" prependDotPath="case-info" errorBoundary={<TabPaneErrorBoundary/>}>
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
                            {isLoadingVariantSampleListItem ? <i className="icon icon-spin icon-circle-notch me-1 fas" /> : null}
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
CaseInfoTabView.getTabObject = function (props) {
    const { context: { variant_sample_list_id } = {}, href } = props;
    return {
        "tab": (
            <React.Fragment>
                <i className="icon icon-cogs fas icon-fw" />
                <span>Case Info</span>
            </React.Fragment>
        ),
        "key": "case-info",
        "disabled": false,
        "content": (
            <VariantSampleListController id={variant_sample_list_id} href={href}>
                <CaseInfoTabView {...props} />
            </VariantSampleListController>
        ),
        "cache": true
    };
};

export function CaseInfoToggle({ children, eventKey }) {
    // Want the line to fade out shortly after animation is triggered, not before (hence not using isCurrentEventKey which would trigger immediately)
    let showLine = true;
    const decoratedOnClick = useAccordionToggle(eventKey, () => { showLine = !showLine; });

    const activeEventKey = useContext(AccordionContext);
    const isCurrentEventKey = activeEventKey === eventKey;

    const icon = isCurrentEventKey ? "minus" : "plus";

    const childrenArray = React.Children.toArray(children);
    const { 0: firstChild = null, 1: secondChild = null } = childrenArray || [];

    return (
        <>
            <div className="container-wide clickable" onClick={decoratedOnClick}>
                <h3 className="tab-section-title">
                    <div className="d-flex align-items-center">
                        <i className={`icon icon-${icon} fas me-2 text-large`} />
                        { firstChild }
                    </div>
                    {secondChild}
                </h3>
            </div>
            {showLine && <Fade in={isCurrentEventKey}><hr className="tab-section-title-horiz-divider" /></Fade>}
        </>
    );
}