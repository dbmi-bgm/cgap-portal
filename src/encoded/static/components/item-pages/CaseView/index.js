'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import Collapse from 'react-bootstrap/esm/Collapse';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';

import { console, layout, ajax, object, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';

import { PedigreeVizView } from './../../viz/PedigreeViz';
import DefaultItemView from './../DefaultItemView';
import { TabPaneErrorBoundary } from './../components/TabView';

import { CaseSummaryTable } from './CaseSummaryTable';
import { FamilyAccessionStackedTable } from './../../browse/CaseDetailPane';
import { PedigreeTabViewBody } from './PedigreeTabViewBody';
import { PedigreeTabView, PedigreeTabViewOptionsController } from './PedigreeTabView';
import { PedigreeFullScreenBtn } from './PedigreeFullScreenBtn';
import { parseFamilyIntoDataset } from './family-parsing';
import { CurrentFamilyController } from './CurrentFamilyController';
import { AttachmentInputController, AttachmentInputMenuOption } from './attachment-input';
import { CaseStats } from './CaseStats';
import CaseSubmissionView from './CaseSubmissionView';

import { EmbeddedItemSearchTable, EmbeddedCaseSearchTable } from '../components/EmbeddedItemSearchTable';

export {
    CaseSummaryTable,
    PedigreeTabViewBody,
    PedigreeFullScreenBtn,
    parseFamilyIntoDataset,
    CaseSubmissionView
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
     *    const { currFamily, selectedDiseases, ... } = props;
     *    const tabs = [];
     *    tabs.push(CaseInfoTabView.getTabObject(props));
     *    // ... Case-related-logic ..
     *    return <CommonItemView tabs={tabs} />;
     * }
     */
    getControllers(){
        return [
            CurrentFamilyController,
            PedigreeTabViewOptionsController
        ];
    }

    getTabViewContents(controllerProps = {}){
        // const { pedigreeFamilies = [] } = controllerProps;
        // const familiesLen = pedigreeFamilies.length;
        const { context: { family: { members = [] } = {} } } = this.props;
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
        context = {},
        href,
        // pedigreeFamilies = [],
        // pedigreeFamiliesIdx = 0,
        // onFamilySelect,
        graphData,
        selectedDiseases,
        windowWidth,
        windowHeight,
        // currFamily,
        idToGraphIdentifier
    } = props;
    const {
        family: currFamily = null, // Previously selected via CurrentFamilyController.js, now just the 1. Unless changed later.
        secondary_families = null,
        case_phenotypic_features: caseFeatures = { case_phenotypic_features: [] },
        description = null,
        actions: permissibleActions = [],
        sample_processing,
        display_title: caseTitle,
        accession: caseAccession,
        individual: caseIndividual
    } = context;

    const editAction = _.findWhere(permissibleActions, { name: "edit" });

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

    const onViewPedigreeBtnClick = useMemo(function(){
        return function(evt){
            evt.preventDefault();
            evt.stopPropagation();
            if (!currFamily) return false;
            // By default, click on link elements would trigger ajax request to get new context.
            // (unless are external links)
            navigate("#pedigree", { skipRequest: true, replace: true });
        };
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
                { editAction ?
                    <div>{ "Add a family by pressing \"Actions\" at top right of page and then \"Add Family\"."}</div>
                    : null }
            </div>
        );
    }

    const rgs = layout.responsiveGridState(windowWidth);
    let pedWidth;
    let pedBlock = (
        <div className="d-none d-lg-block pedigree-placeholder flex-fill" onClick={onViewPedigreeBtnClick} disabled={!currFamily}>
            <div className="text-center h-100">
                <i className="icon icon-sitemap icon-4x fas" />
            </div>
        </div>
    );

    if (windowWidth !== null && (rgs === "lg" || rgs === "xl")) {
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
            //const width = layout.gridContainerWidth(windowWidth);
            pedBlock = (
                <div className="pedigree-pane-wrapper flex-fill">
                    <PedigreeVizView {...graphData} width={pedWidth} height={300} disableSelect
                        visibleDiseases={selectedDiseases} showZoomControls={false} enablePinchZoom={false} />
                </div>
            );
        }
    }

    return (
        <React.Fragment>
            <div className="container-wide">
                <h3 className="tab-section-title">
                    <div>
                        <span className="text-500">Case Info: </span>
                        <span className="text-300"> { caseTitle }</span>
                    </div>
                </h3>
            </div>
            <hr className="tab-section-title-horiz-divider" />
            <div className="container-wide bg-light pt-36 pb-36">
                <div className="card-group case-summary-card-row">
                    <div className="col-stats">
                        <CaseStats caseItem={context} {...{ description, numIndividuals, numWithSamples, caseFeatures }} numFamilies={1} />
                    </div>
                    <div id="case-overview-ped-link" className="col-pedigree-viz">
                        <div className="card d-flex flex-column">
                            <div className="pedigree-vis-heading card-header d-flex justify-content-between">
                                <div>
                                    <i className="icon icon-sitemap fas icon-fw mr-1"></i>
                                    <h4 className="text-white text-400 d-inline-block mt-0 mb-0 ml-05 mr-05">
                                        Pedigree
                                    </h4>
                                </div>
                                <button type="button" className="btn btn-primary btn-small view-pedigree-btn"
                                    onClick={onViewPedigreeBtnClick} disabled={!currFamily}>
                                    View Pedigree
                                </button>
                            </div>
                            {/*
                            <a href="#pedigree" className="card-img-top d-none d-lg-block" rel="noreferrer noopener">
                                <div className="text-center h-100">
                                    <i className="icon icon-sitemap icon-4x fas" />
                                </div>
                            </a>
                            */}
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

            <DotRouter href={href} navClassName="container-wide pt-36 pb-36" contentsClassName="container-wide bg-light pt-36 pb-36" prependDotPath="case-info">
                <DotRouterTab tabTitle="Accessioning" dotPath=".accessioning" default cache={false}>
                    <AccessioningTab {...{ context, href, currFamily, secondary_families, }} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Bioinformatics" dotPath=".bioinformatics" cache={false}>
                    <BioinformaticsTab {...{ context, currFamily, secondary_families, idToGraphIdentifier, sample_processing }} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Filtering" dotPath=".filtering">
                    <FilteringTab context={context} windowHeight={windowHeight} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Interpretation" dotPath=".interpretation" disabled cache={false}>
                    <InterpretationTab {...props} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Finalize Case" dotPath=".reporting" disabled cache={false}>
                    <ReportingTab {...props} />
                </DotRouterTab>
            </DotRouter>
        </React.Fragment>
    );
});
CaseInfoTabView.getTabObject = function(props){
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-cogs fas icon-fw"/>
                <span>Case Info</span>
            </React.Fragment>
        ),
        'key' : 'case-info',
        'disabled' : false,
        'content' : <CaseInfoTabView {...props} />
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
            const { props : { dotPath, children: tabChildren, cache = true } } = childTab;
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

function DotRouterTab(props) {
    const { tabTitle, dotPath, className, disabled, active, prependDotPath, children } = props;

    const onClick = useMemo(function(){
        return function(){
            const targetDotPath = prependDotPath + dotPath;
            navigate("#" + targetDotPath, { skipRequest: true, replace: true, dontScrollToTop: true }, function(){
                // Maybe uncomment - this could be annoying if someone is also trying to keep Status Overview visible or something.
                // layout.animateScrollTo(targetDotPath);
            });
        };
    }, [ dotPath ]);

    if (!React.isValidElement(children)) {
        throw new Error("Expected children to be present and valid JSX");
    }

    return (
        <div className={(className ? className + " " : "") + (disabled ? "disabled " : "") + (active ? " active" : "")} >
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
}
DotRouterTab.defaultProps = {
    "className" : "arrow-tab d-flex"
};

const AccessioningTab = React.memo(function AccessioningTab(props) {
    const { context, currFamily, secondary_families = [] } = props;
    const { display_title: caseDisplayTitle } = context;
    const { display_title: primaryFamilyTitle, '@id' : currFamilyID } = currFamily;
    const [ isSecondaryFamiliesOpen, setSecondaryFamiliesOpen ] = useState(false);
    const secondaryFamiliesLen = secondary_families.length;
    console.log("families", currFamily, secondary_families);

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
                    { caseDisplayTitle }: <span className="text-300">Accessioning Report and History</span>
                </div>
                <div className="col-auto">
                    <span className="current-case text-small text-400 m-0">Current Selection</span>
                </div>
            </h1>
            <div className="tab-inner-container">
                <PartialList className="mb-0" open={isSecondaryFamiliesOpen}
                    persistent={[
                        <div key={currFamilyID} className="primary-family">
                            <h4 className="mt-0 mb-05 text-400">
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
        </React.Fragment>
    );
});

const BioinformaticsTab = React.memo(function BioinformaticsTab(props) {
    const {
        context,
        currFamily,
        secondary_families = [],
        idToGraphIdentifier,
        sample_processing = []
    } = props;
    const { display_title: caseDisplayTitle, family = null } = context;

    const {
        original_pedigree: { display_title: pedFileName } = {},
        members = [],
        display_title: familyDisplayTitle
    } = family;
    const onClick = useMemo(function(){
        return function(evt){
            navigate("#pedigree", { skipRequest: true, replace: true });
        };
    }, []);

    const title = (
        <h4 data-family-index={0} className="pb-0 p-2 mb-0 d-inline-block w-100">
            <span className="font-italic text-500">{ familyDisplayTitle }</span>
            { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null }
            <button type="button" className="btn btn-sm btn-primary pull-right" data-tip="Click to view this family in the Pedigree Visualization tab" onClick={onClick}>
                <i className="icon icon-fw icon-sitemap fas mr-1 small" />
                View Pedigree in Separate Tab
            </button>
        </h4>
    );


    const dataTip = "Exonic and splice variants, clinvar pathogenic or conflicting submissions, spliceAI>0.2, not seen in 2 individuals among a set of 20 unrelated samples.";

    return (
        <React.Fragment>
            <h1>{ caseDisplayTitle }: <span className="text-300">Bioinformatics Analysis</span></h1>
            <div className="tab-inner-container clearfix font-italic qc-status">
                <span className="text-600">Current Status:</span><span className="text-success"> PASS <i className="icon icon-check fas"></i></span>
                <span className="pull-right">3/28/20</span>
            </div>
            <div className="tab-inner-container">
                <h2 className="section-header">Quality Control Metrics (QC)</h2>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Total Number of Reads:
                    </div>
                    <div className="col-sm-4">
                        452.3 Million
                    </div>
                </div>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Coverage:
                    </div>
                    <div className="col-sm-4">
                        30x
                    </div>
                </div>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Total Number of Variants Called:
                    </div>
                    <div className="col-sm-4">
                        4,769,578
                    </div>
                </div>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Transition-Tansversion ratio:
                    </div>
                    <div className="col-sm-4">
                        1.96
                    </div>
                </div>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Heterozygosity ratio:
                    </div>
                    <div className="col-sm-4">
                        1.24
                    </div>
                </div>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        De novo Fraction:
                    </div>
                    <div className="col-sm-4">
                        2%
                    </div>
                </div>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Variants after hard filters:
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={dataTip} data-place="right"/>
                    </div>
                    <div className="col-sm-4">
                        2,291
                    </div>
                </div>
            </div>
            <div className="tab-inner-container">
                <h2 className="section-header">Multisample Analysis Table</h2>
                <div className="family-index-0" data-is-current-family={true}>
                    { title }
                    <CaseSummaryTable {...family} sampleProcessing={[sample_processing]} isCurrentFamily={true} idx={0} {...{ idToGraphIdentifier }} />
                </div>
            </div>
        </React.Fragment>
    );
});

const FilteringTab = React.memo(function FilteringTab(props) {
    const { context = null, windowHeight } = props;
    const { filter_set_flag_addon: filterFlags = "" } = context || {};
    const searchHref = `/search/?type=VariantSample${filterFlags ? filterFlags : ""}`;
    const hideFacets = !filterFlags ? null : Object.keys(queryString.parse(filterFlags));

    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    // 405px offset likely would need to be changed if we change height of tab nav, tab title area, etc.
    // Overrides default 400px.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 800 ? (windowHeight - 405) : undefined;

    return <EmbeddedItemSearchTable { ...{ searchHref, hideFacets, maxHeight }} title={<FilteringTabSubtitle {...{ context }} />} />;
});

function FilteringTabSubtitle({ totalCount, context: { display_title } }){
    // We give the span here an 'id' here so later on it'd be easy to find using Cypress
    // or other testing framework.
    return (
        <div className="d-flex flex-column flex-lg-row mb-2 align-items-start align-items-lg-end justify-content-between">
            <h1 className="mb-0 mt-0">
                { display_title }: <span className="text-300">Variant Filtering and Technical Review</span>
            </h1>
            <h5 className="text-300 mt-0 mb-0">
                <span id="filtering-variants-found" className="text-400 mr-05">{ totalCount || 0 }</span>
                Variants found
            </h5>
        </div>
    );
}

function InterpretationTab(props) {
    return <h1>This is the interpretation tab.</h1>;
}
function ReportingTab(props) {
    return <h1>This is the reporting tab</h1>;
}
