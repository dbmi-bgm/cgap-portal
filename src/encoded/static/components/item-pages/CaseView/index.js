'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import Collapse from 'react-bootstrap/esm/Collapse';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';

import { console, layout, ajax, object, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

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

import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';

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
        pedigreeFamilies = [],
        pedigreeFamiliesIdx = 0,
        onFamilySelect,
        graphData,
        selectedDiseases,
        windowWidth,
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
                    <EmbeddedItemSearchTable facets={null} searchHref={`/search/?type=Case&accession=${caseAccession}`} context={context} />
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

    // Combine primary and secondary families to get all families associated with case. Primary goes first.
    let families;
    const arr = [];
    if (currFamily) {
        arr.push(currFamily);

        if (secondary_families && secondary_families.length > 0) {
            families = arr.concat(secondary_families);
        } else {
            families = arr;
        }
    }
    console.log("families", families, currFamily, secondary_families);
    console.log("props", props);

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
                        <CaseStats {...{ description, numIndividuals, numWithSamples, caseFeatures }} numFamilies={1} />
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
                                <button type="button" className="btn btn-primary btn-small" style={{
                                    backgroundColor: "cornflowerblue",
                                    border: "none",
                                    borderRadius: "50px",
                                    padding: "0px 20px",
                                    color: "white",
                                }} onClick={onViewPedigreeBtnClick} disabled={!currFamily}>
                                    View Pedigree(s)
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

            <div className="container-wide bg-light pb-48">
                <div className="processing-summary-tables-container mt-0">
                    { caseSearchTables }
                </div>
            </div>

            <DotRouter href={href} navClassName="container-wide pt-36 pb-36" contentsClassName="container-wide bg-light pt-36 pb-36">
                <DotRouterTab tabTitle="Accessioning" dotPath=".accessioning" default>
                    <AccessioningTab {...{ context, href, families, props }} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Bioinformatics" dotPath=".bioinformatics">
                    <BioinformaticsTab {...{ context, families, currFamily, pedigreeFamiliesIdx, idToGraphIdentifier, sample_processing, onFamilySelect }} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Filtering" dotPath=".filtering">
                    <FilteringTab context={context} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Interpretation" dotPath=".interpretation" disabled>
                    <InterpretationTab {...props} />
                </DotRouterTab>
                <DotRouterTab tabTitle="Finalize Case" dotPath=".reporting" disabled>
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
        const hashPathSplit = href.split("#");
        if (hashPathSplit.length > 1) {
            const lastIdx = hashPathSplit.length - 1;
            const dotPathSplit = hashPathSplit[lastIdx].split(".");
            return "." + dotPathSplit[lastIdx];
        } else {
            // Path must contain both tab (hashroute) and dotpath to navigate properly
            return null;
        }
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
            // Not sure that makes much/any of measurable improvement.. eh oh well
            getDotPath: memoize(DotRouter.getDotPath)
        };
    }

    /**
     * Renders a set of child tabs defined by <DotRouterTab> that each render a component below the navbar when clicked.
     *
     * Note: Currently there is a bug where if you switch to a main tab and then press "back" to get back,
     * navigation doesn't work... need to look into
     *
     * A: Depends what the intended action is.. ideally we don't want to add each tab to browser history because
     * gets a bit annoying to have to click back ton of times to get back to search listing or something.
     *
     * @todo Detect if hash in window.location; if is dotpath of child tab, if so, activate it.
     */
    componentDidMount() {
        const { href, children } = this.props;

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
        const { children, className, navClassName, contentsClassName, elementID } = this.props;
        const currentTab = this.getCurrentTab();
        const { props : { children: currTabChildren = null, tabTitle: currTabTitle } } = currentTab;

        return (
            // We could make classNames props (with default values via defaultProps)
            // if plan to make reusable for other views
            <div className={"tab-router" + (className ? " " + className : "")} id={elementID}>
                <nav className={"dot-tab-nav" + (navClassName ? " " + navClassName : "")}>
                    <div className="dot-tab-nav-list">
                        { children }
                    </div>
                </nav>
                <div className={"tab-router-contents" + (contentsClassName ? " " + contentsClassName : "")}>
                    <TabPaneErrorBoundary key={currTabTitle}>
                        { currTabChildren }
                    </TabPaneErrorBoundary>
                </div>
            </div>
        );
    }
}

function DotRouterTab(props) {
    const { tabTitle, dotPath, className, disabled, children } = props;

    const onClick = useMemo(function(){
        return function(){
            navigate("#case-summary" + dotPath, { skipRequest: true, replace: true, dontScrollToTop: true });
        };
    }, [ dotPath ]);

    if (!React.isValidElement(children)) {
        throw new Error("Expected children to be present and valid JSX");
    }

    return (
        <div className={(className ? className + " " : "") + (disabled ? "disabled " : "")} >
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
    const { context: result, href, families = [] } = props;
    const { display_title } = result;
    console.log("families,", families);

    // console.log("accessioning props", props);
    return (
        <React.Fragment>
            <h1>
                { display_title }: <span className="text-300">Accessioning Report and History</span>
                <span className="curr-selection pull-right">Current Selection</span>
            </h1>
            <div className="tab-inner-container">
                { families.map((family) =>
                    <FamilyAccessionStackedTable
                        {...{ family, result }}
                        key={family['@id']}
                        href={href} preventExpand
                        fadeIn={false} collapseLongLists
                    />
                )}
            </div>
        </React.Fragment>
    );
});

const BioinformaticsTab = React.memo(function BioinformaticsTab(props) {
    const {
        context,
        families = [],
        pedigreeFamiliesIdx,
        idToGraphIdentifier,
        sample_processing = []
    } = props;

    const { display_title: caseDisplayTitle } = context;

    // console.log("biotab props", props);
    let caseSummaryTables = [];
    caseSummaryTables = families.map(function(family, idx){
        const {
            original_pedigree: { display_title: pedFileName } = {},
            members = [],
            display_title: familyDisplayTitle
        } = family;
        const cls = "family-index-" + idx;
        const isCurrentFamily = idx === pedigreeFamiliesIdx;
        const onClick = function(evt){
            if (isCurrentFamily) {
                navigate("#pedigree", { skipRequest: true, replace: true });
            } else {
                onFamilySelect(idx);
            }
        };

        const tip = isCurrentFamily ?
            "Currently-selected family in Pedigree Visualization"
            : "Click to view this family in the Pedigree Visualization tab";
        const title = (
            <h4 data-family-index={idx} className="clickable p-2 d-inline-block w-100">
                <i className={"icon p-1 icon-sitemap fas icon-small"} />
                <span className="font-italic text-500">{ familyDisplayTitle }</span>
                { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null }
                <button type="button" className="btn btn-small btn-primary pull-right" data-tip={tip} onClick={onClick}>
                    <i className="icon icon-fw icon-sitemap fas mr-1 small" />
                    { isCurrentFamily ? "View Pedigree in Separate Tab" : "Switch to this Pedigree"}
                </button>
            </h4>
        );

        // sampleProcessing objects that have 2 or more matching samples to pass ONLY THOSE through to caseSummaryTable
        return (
            <div className={cls} key={idx} data-is-current-family={isCurrentFamily}>
                { title }
                <CaseSummaryTable {...family} sampleProcessing={[sample_processing]} {...{ idx, idToGraphIdentifier, isCurrentFamily }} />
            </div>
        );
    });

    return (
        <React.Fragment>
            <h1>{ caseDisplayTitle }: <span className="text-300">Bioinformatics Analysis</span></h1>
            <div className="tab-inner-container clearfix font-italic qc-status">
                <span className="text-600">Current Status:</span> PASS
                <span className="pull-right">3/28/20</span>
            </div>
            <div className="tab-inner-container">
                <h2 className="section-header">Quality Control Metrics (QC)</h2>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Total Number of Reads:
                    </div>
                    <div className="col-sm-4">
                        450 Million
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
                        3-5 Million
                    </div>
                </div>
                <div className="row qc-summary">
                    <div className="col-sm-8 text-600">
                        Total number of filtered variants (high-quality exonic variants + clinvar - blacklist):
                    </div>
                    <div className="col-sm-4">
                        10K
                    </div>
                </div>
            </div>
            {/* Placeholder for Provenance Table... may not be necessary... moving elsewhere * }
            <div className="tab-inner-container">
                <h2 className="section-header">Provenance Table</h2>
                <img className="w-100" src="/static/img/provenance.png" alt="provenance graph"/>
            </div> */}
            <div className="tab-inner-container">
                <h2 className="section-header">Multisample Analysis Table</h2>
                { caseSummaryTables }
            </div>
        </React.Fragment>
    );
});

const FilteringTab = React.memo(function FilteringTab(props) {
    const { context = null } = props;
    const { filter_set_flag_addon : filterFlags } = context || {};

    return (
        <React.Fragment>
            <h1>{ context.display_title}: <span className="text-300">Variant Filtering and Technical Review</span></h1>
            <EmbeddedItemSearchTable { ...{ context }}
                searchHref={`/search/?type=VariantSample${filterFlags ? filterFlags : ""}`}
            />
        </React.Fragment>
    );
});

function InterpretationTab(props) {
    return <h1>This is the interpretation tab.</h1>;
}
function ReportingTab(props) {
    return <h1>This is the reporting tab</h1>;
}