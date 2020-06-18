'use strict';

import React, { useState, useMemo, useCallback } from 'react';
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
     *    tabs.push(CaseSummaryTabView.getTabObject(props));
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

        initTabs.push(CaseSummaryTabView.getTabObject({
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

const CaseSummaryTabView = React.memo(function CaseSummaryTabView(props){
    const {
        pedigreeFamilies: families = [],
        pedigreeFamiliesIdx = 0,
        context: {
            case_phenotypic_features: caseFeatures = { case_phenotypic_features: [] },
            description = null,
            actions: permissibleActions = [],
            sample_processes = []
        } = {},
        idToGraphIdentifier,
        onFamilySelect,
        graphData,
        selectedDiseases,
        windowWidth
    } = props;

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
            navigate("#pedigree", { skipRequest: true });
        }
    }, [ /* empty == executed only once ever */ ]);

    let caseSummaryTables;
    if (familiesLen > 0) {
        caseSummaryTables = families.map(function(family, idx){
            const {
                original_pedigree: { display_title: pedFileName } = {},
                members = []
            } = family;
            const cls = "summary-table-container family-index-" + idx;
            const isCurrentFamily = idx === pedigreeFamiliesIdx;
            const onClick = function(evt){
                if (isCurrentFamily) {
                    navigate("#pedigree", { skipRequest: true });
                } else {
                    onFamilySelect(idx);
                }
            };
            const tip = isCurrentFamily ?
                "Currently-selected family in Pedigree Visualization"
                : "Click to view this family in the Pedigree Visualization tab";
            const title = (
                <h4 data-family-index={idx} className="clickable p-1 d-block">
                    <span className="font-italic text-500">{ family.display_title }</span>
                    <span className="text-300 font-italic">: Status Overview</span>
                    { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null }
                    <button type="button" className="btn btn-small btn-primary d-none" data-tip={tip} onClick={onClick}>
                        <i className="icon icon-fw icon-sitemap fas mr-1 small" />
                        { isCurrentFamily ? "View Pedigree in Separate Tab" : "Switch to this Pedigree"}
                    </button>
                </h4>
            );

            // go through each member in the family and populate a list with all of their samplesIDs...
            // will match these up with those in sampleanalysis.samples to determine which to render on per family basis
            const familySpecificSampleIDs = members.reduce(function(m, { samples = [] }){
                samples.forEach(function({ "@id" : id }){
                    m[id] = true;
                });
                return m;
            }, {});

            // sampleProcessing objects that have 2 or more matching samples to pass ONLY THOSE through to caseSummaryTable
            const familySpecificSAs = sample_processes.filter(function(sp){
                const { samples = [] } = sp;
                let numMatchingSamples = 0;
                for (let i = 0; i < samples.length; i++) {
                    const { "@id": currSampleID } = samples[i];

                    if (familySpecificSampleIDs[currSampleID]) {
                        numMatchingSamples++;
                    }

                    if (numMatchingSamples >= 2) {
                        return true;
                    }
                }
                return false;
            });

            return (
                <div className={cls} key={idx} data-is-current-family={isCurrentFamily}>
                    { title }
                    <EmbeddedItemSearchTable facets={null} searchHref={`/search/?type=Case`}/>
                    {/* <CaseSummaryTable {...family} sampleProcessing={familySpecificSAs} {...{ idx, idToGraphIdentifier, isCurrentFamily }} /> */}
                </div>
            );
        });
    } else {
        caseSummaryTables = (
            <div className="mt-3">
                <h4 className="text-400 mb-03">No families available</h4>
                { editAction ?
                    <div>{ "Add a family by pressing \"Actions\" at top right of page and then \"Add Family\"."}</div>
                    : null }
            </div>
        );
    }

    const rgs = layout.responsiveGridState(windowWidth);
    let pedWidth;
    let pedBlock = (
        <div className="d-none d-lg-block pedigree-placeholder" onClick={onViewPedigreeBtnClick} disabled={familiesLen === 0}>
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
                <PedigreeVizView {...graphData} width={pedWidth} height={300} disableSelect
                    visibleDiseases={selectedDiseases} showZoomControls={false} enablePinchZoom={false} />
            );
        }
    }
    console.log("Case props,", props);

    return (
        <React.Fragment>
            <div className="container-wide">
                <h3 className="tab-section-title">
                    <div>
                        <span className="text-500 font-italic">Case Info:  </span>
                        <span className="text-300"> { props.context.display_title }</span>
                    </div>
                    
                </h3>
            </div>
            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide bg-light py-4">
                <div className="card-group case-summary-card-row">
                    <div className="col-stats">
                        <CaseStats {...{ description, numIndividuals, numWithSamples, caseFeatures }} numFamilies={familiesLen} />
                    </div>
                    <div id="case-overview-ped-link" className="col-pedigree-viz">
                        <div className="pedigree-vis-heading d-flex justify-content-between" style={{
                            backgroundColor: "#20445f",
                            borderTopRightRadius: "10px",
                            borderTopLeftRadius: "10px",
                            color: "#ffffff",
                            padding: "10px 30px"
                        }}>
                            <div>
                                <i className="icon icon-sitemap fas icon-fw mr-1"></i>
                                <h4 style={{
                                    color: "white",
                                    fontWeight: "400",
                                    display: "inline-block",
                                    margin: "0px 5px"
                                }}> Pedigree
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
            <hr className="tab-section-title-horiz-divider"/>
            <div className="container-wide">
                <div className="processing-summary-tables-container mt-15">
                    { caseSummaryTables }
                </div>
            </div>
        </React.Fragment>
    );
});
CaseSummaryTabView.getTabObject = function(props){
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-cogs fas icon-fw"/>
                <span>Case Summary</span>
            </React.Fragment>
        ),
        'key' : 'case-summary',
        'disabled' : false,
        'content' : <CaseSummaryTabView {...props} />
    };
};
