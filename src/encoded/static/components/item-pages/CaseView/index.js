'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import Collapse from 'react-bootstrap/esm/Collapse';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';

import { console, layout, ajax, object, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { PedigreeVizView } from './../../viz/PedigreeViz';
import DefaultItemView from './../DefaultItemView';
import { store } from './../../../store';

import { buildPedigreeGraphData } from './../../viz/PedigreeViz';
import { CaseSummaryTable } from './CaseSummaryTable';
import { FamilyAccessionStackedTable } from './../../browse/CaseDetailPane';
import { PedigreeTabViewBody, idToGraphIdentifier } from './PedigreeTabViewBody';
import { PedigreeTabView, PedigreeTabViewOptionsController } from './PedigreeTabView';
import { PedigreeFullScreenBtn } from './PedigreeFullScreenBtn';
import { parseFamilyIntoDataset } from './family-parsing';
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



class CurrentFamilyController extends React.PureComponent {

    static haveFullViewPermissionForFamily(family){
        const { original_pedigree = null, proband = null, members = [] } = family;
        if (original_pedigree && !object.isAnItem(original_pedigree)){
            // Tests for presence of display_title and @id, lack of which indicates lack of view permission.
            return false;
        }
        if (proband && !object.isAnItem(proband)){
            return false;
        }
        if (members.length === 0) {
            return false;
        }
        for (var i = 0; i < members.length; i++){
            if (!object.isAnItem(members[i])){
                return false;
            }
        }
        return true;
    }

    constructor(props) {
        super(props);
        this.onAddedFamily = this.onAddedFamily.bind(this);
        this.handleFamilySelect = _.throttle(this.handleFamilySelect.bind(this), 1000);
        const pedigreeFamilies = (props.context.sample_processing.families || []).filter(CurrentFamilyController.haveFullViewPermissionForFamily);
        this.state = {
            pedigreeFamilies,
            pedigreeFamiliesIdx: 0 // familiesLen - 1
        };
        this.memoized = {
            buildPedigreeGraphData: memoize(buildPedigreeGraphData),
            parseFamilyIntoDataset: memoize(parseFamilyIntoDataset),
            idToGraphIdentifier: memoize(idToGraphIdentifier)
        };
    }

    componentDidUpdate(pastProps, pastState){
        const { context } = this.props;
        const { context: pastContext } = pastProps;

        if (pastContext !== context){
            const pedigreeFamilies = (context.sample_processing.families || []).filter(CurrentFamilyController.haveFullViewPermissionForFamily);
            const pastPedigreeFamilies = (pastContext.sample_processing.families || []).filter(CurrentFamilyController.haveFullViewPermissionForFamily);
            const familiesLen = pedigreeFamilies.length;
            const pastFamiliesLen = pastPedigreeFamilies.length;
            if (familiesLen !== pastFamiliesLen){
                this.setState({
                    pedigreeFamilies,
                    pedigreeFamiliesIdx: familiesLen - 1
                });
            }
        }
    }

    onAddedFamily(response){
        const { context, status, title } = response;
        if (!context || status !== "success") return;

        const { families = [] } = context || {};
        const familiesLen = families.length;
        const newestFamily = families[familiesLen - 1];

        if (!newestFamily) return;

        const {
            original_pedigree : {
                '@id' : pedigreeID,
                display_title: pedigreeTitle
            } = {},
            pedigree_source
        } = newestFamily;
        let message = null;

        if (pedigreeTitle && pedigreeID){
            message = (
                <React.Fragment>
                    <p className="mb-0">Added family from pedigree <a href={pedigreeID}>{ pedigreeTitle }</a>.</p>
                    { pedigree_source? <p className="mb-0 text-small">Source of pedigree: <em>{ pedigree_source }</em></p> : null }
                </React.Fragment>
            );
        }
        Alerts.queue({
            "title" : "Added family " + familiesLen,
            message,
            "style" : "success"
        });

        store.dispatch({ type: { context } });
    }

    handleFamilySelect(key, callback){
        const callable = () => {
            this.setState({ 'pedigreeFamiliesIdx' : parseInt(key) }, function(){
                if (typeof callback === "function") {
                    callback();
                }
            });
        };

        // Try to defer change to background execution to
        // avoid 'blocking'/'hanging' UI thread while new
        // objectGraph is calculated.
        // @todo Later - maybe attempt to offload PedigreeViz graph-transformer
        // stuff to a WebWorker instead.
        if (window && window.requestIdleCallback) {
            window.requestIdleCallback(callable);
        } else {
            setTimeout(callable, 0);
        }
    }

    render(){
        const { children, ...passProps } = this.props;

        const { pedigreeFamilies = [], pedigreeFamiliesIdx } = this.state;
        const familiesLen = pedigreeFamilies.length;

        let currFamily, graphData, idToGraphIdentifier;
        if (familiesLen > 0){
            currFamily = pedigreeFamilies[pedigreeFamiliesIdx];
            graphData = this.memoized.buildPedigreeGraphData(this.memoized.parseFamilyIntoDataset(currFamily));
            idToGraphIdentifier = this.memoized.idToGraphIdentifier(graphData.objectGraph);
        }

        const childProps = {
            ...passProps,
            pedigreeFamilies,
            pedigreeFamiliesIdx,
            currFamily,
            graphData,
            idToGraphIdentifier,
            onFamilySelect: this.handleFamilySelect,
        };
        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }

}


export default class CaseView extends DefaultItemView {

    /**
     * Hackyish approach to reusing state logic to wrap entire ItemView (or all tabs, at last).
     * Will be easier to migrate to functional components with hooks theoretically this way if needed.
     * Any controller component can be functional or classical (pun intended :-P).
     *
     * Later, could maybe structure as (to be more React-ful):
     * ```
     * function CaseView (props) {
     *     ... Case-related-logic ...
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
     *     ... Case-related-logic ..
     *    return <CommonItemView tabs={tabs} />;
     * }
     * ```
     */
    getControllers(){
        return [
            CurrentFamilyController,
            PedigreeTabViewOptionsController
        ];
    }

    getTabViewContents(controllerProps = {}){
        const { pedigreeFamilies = [] } = controllerProps;
        const familiesLen = pedigreeFamilies.length;
        const initTabs = [];

        initTabs.push(CaseInfoTabView.getTabObject({
            ...this.props, ...controllerProps
        }));

        if (familiesLen > 0) {
            // Remove this outer if condition if wanna show disabled '0 Pedigrees'
            initTabs.push(PedigreeTabView.getTabObject({
                ...this.props, ...controllerProps
            }));
        }

        return initTabs.concat(this.getCommonTabs());
    }

    /** Render additional item actions */
    additionalItemActionsContent(){
        const { context, href } = this.props;
        const hasEditPermission = _.find(context.actions || [], { 'name' : 'edit' });
        if (!hasEditPermission){
            return null;
        }
        return (
            <AttachmentInputController {...{ context, href }} onAddedFamily={this.onAddedFamily}>
                <AttachmentInputMenuOption />
            </AttachmentInputController>
        );
    }
}

const CaseInfoTabView = React.memo(function CaseInfoTabView(props){
    const {
        context = {},
        href,
        pedigreeFamilies: families = [],
        pedigreeFamiliesIdx = 0,
        onFamilySelect,
        graphData,
        selectedDiseases,
        windowWidth,
        currFamily
    } = props;
    const {
        case_phenotypic_features: caseFeatures = { case_phenotypic_features: [] },
        description = null,
        actions: permissibleActions = [],
        sample_processing,
        display_title: caseTitle,
        accession: caseAccession,
        individual : caseIndividual
    } = context;

    const familiesLen = families.length;
    const editAction = _.findWhere(permissibleActions, { name: "edit" });

    const {
        countIndividuals: numIndividuals,
        countIndividualsWSamples: numWithSamples
    } = useMemo(function(){
        let countIndividuals = 0;
        let countIndividualsWSamples = 0;
        families.forEach(function({ members = [] }){
            members.forEach(function({ samples }){
                if (Array.isArray(samples) && samples.length > 0) {
                    countIndividualsWSamples++;
                }
                countIndividuals++;
            });
        });
        return { countIndividuals, countIndividualsWSamples };
    }, [ families ]);

    const onViewPedigreeBtnClick = useMemo(function(){
        return function(evt){
            evt.preventDefault();
            evt.stopPropagation();
            if (familiesLen === 0) return false;
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
        <div className="d-none d-lg-block pedigree-placeholder flex-fill" onClick={onViewPedigreeBtnClick} disabled={familiesLen === 0}>
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
            <div className="container-wide bg-light py-4">
                <div className="card-group case-summary-card-row">
                    <div className="col-stats">
                        <CaseStats {...{ description, numIndividuals, numWithSamples, caseFeatures }} numFamilies={familiesLen} />
                    </div>
                    <div id="case-overview-ped-link" className="col-pedigree-viz">
                        <div className="card d-flex flex-column">
                            <div className="pedigree-vis-heading d-flex justify-content-between">
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
                                }} onClick={onViewPedigreeBtnClick} disabled={familiesLen === 0}>
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

            <div className="container-wide bg-light pt-12 pb-24">
                <div className="processing-summary-tables-container mt-0">
                    { caseSearchTables }
                </div>
            </div>

            <hr className="tab-section-title-horiz-divider" />

            <DotRouter href={href} className="container-wide bg-light pt-36 pb-24">
                <DotRouterTab className="arrow-tab" tabTitle="Accessioning" dotPath=".accessioning" default>
                    <AccessioningTab {...{ context, href }} />
                </DotRouterTab>
                <DotRouterTab className="arrow-tab" tabTitle="Bioinformatics" dotPath=".bioinformatics">
                    <BioinformaticsTab {...{ context, families, currFamily, pedigreeFamiliesIdx, idToGraphIdentifier, sample_processing, onFamilySelect }} />
                </DotRouterTab>
                <DotRouterTab className="arrow-tab" tabTitle="Filtering" dotPath=".filtering">
                    <FilteringTab context={context} />
                </DotRouterTab>
                <DotRouterTab className="arrow-tab" tabTitle="Interpretation" dotPath=".interpretation" disabled>
                    <InterpretationTab {...props} />
                </DotRouterTab>
                <DotRouterTab className="arrow-tab" tabTitle="Finalize Case" dotPath=".reporting" disabled>
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
        "className" : "container-wide bg-light",
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
        const { children, className, elementID } = this.props;
        const currentTab = this.getCurrentTab();

        return (
            // We could make classNames props (with default values via defaultProps)
            // if plan to make reusable for other views
            <div className={"tab-router" + (className ? " " + className : "")} id={elementID}>
                <nav className="dot-tab-nav">
                    <ul className="dot-tab-nav-list">
                        { children }
                    </ul>
                </nav>
                <div className="tab-router-contents">
                    { currentTab.props.children }
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
    if (disabled) {
        return <li className={className + " disabled"} key={tabTitle}><button type="button" disabled>{tabTitle}</button></li>;
    }
    return (
        <li className={className} key={tabTitle}>
            <button type="button" onClick={onClick}>{ tabTitle }</button>
        </li>);
}

const AccessioningTab = React.memo(function AccessioningTab(props) {
    const { context: result, href } = props;
    const { display_title, family } = result;
    return (
        <React.Fragment>
            <h1>
                { display_title }: <span className="text-300">Accessioning Report and History</span>
                <span className="curr-selection pull-right">Current Selection</span>
            </h1>
            <div className="tab-inner-container">
                <FamilyAccessionStackedTable {...{ result, family, href }}
                    preventExpand fadeIn={false} collapseLongLists />
            </div>
        </React.Fragment>
    );
});

const BioinformaticsTab = React.memo(function BioinformaticsTab(props) {
    const {
        families = [],
        pedigreeFamiliesIdx,
        idToGraphIdentifier,
        sample_processing = []
    } = props;

    // console.log("context", context);
    console.log("biotab props", props);
    let caseSummaryTables = [];
    let display_title;
    if (props) {
        console.log("biotab props.pedigreeFamilies", props.families);
        display_title = props.context.display_title;
        caseSummaryTables = families.map(function(family, idx){
            const {
                original_pedigree: { display_title: pedFileName } = {},
                members = [],
                display_title
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
                    <span className="font-italic text-500">{ display_title }</span>
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
    } else {
        console.warn("biotabprops don't exist for whatever reason");
    }

    return (
        <React.Fragment>
            <h1>{ display_title }: <span className="text-300">Bioinformatics Analysis</span></h1>
            <div className="tab-inner-container clearfix">
                <span className="text-500">Current Status:</span> PASS
                <span className="font-italic pull-right">3/28/20</span>
            </div>
            <div className="tab-inner-container">
                <h2 className="section-header">Quality Control Metrics (QC)</h2>
            </div>
            <div className="tab-inner-container">
                <h2 className="section-header">Provenance Table</h2>
            </div>
            <div className="tab-inner-container">
                <h2 className="section-header">Multisample Analysis Table</h2>
                { caseSummaryTables }
            </div>
        </React.Fragment>
    );
});

const FilteringTab = React.memo(function FilteringTab(props) {
    const { context } = props;
    return (
        <React.Fragment>
            <h1>{ context.display_title}: <span className="text-300">Variant Filtering and Technical Review</span></h1>
            <EmbeddedItemSearchTable
                searchHref={`/search/?type=Variant`} { ...{ context }}
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