'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import Modal from 'react-bootstrap/esm/Modal';
import { ajax, console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { VariantSampleSelectionList, parentTabTypes } from './VariantSampleSelection';
import { CaseSpecificSelectionsPanel, getAllNotesFromVariantSample, NoteSubSelectionStateController } from './variant-sample-selection-panels';





export class CaseReviewController extends React.Component {

    static savedClassificationsByVS(variantSampleListItem){
        const { variant_samples: vsObjects = [] } = variantSampleListItem || {};
        const savedClassificationsByVS = {};
        vsObjects.forEach(function({ variant_sample_item }){
            const { uuid: vsUUID, finding_table_tag = null } = variant_sample_item;
            if (!vsUUID) {
                return; // No view permission or similar.
            }
            savedClassificationsByVS[vsUUID] = finding_table_tag;
        });
        return savedClassificationsByVS;
    }

    constructor(props){
        super(props);
        this.updateClassificationForVS = this.updateClassificationForVS.bind(this);
        this.state = {
            "changedClassificationsByVS": {}
        };
        this.memoized = {
            savedClassificationsByVS: memoize(CaseReviewController.savedClassificationsByVS),
            changedClassificationsCount: memoize(function(changedClassificationsByVS){ return Object.keys(changedClassificationsByVS).length; })
        };
    }

    /**
     * If VS Item is refreshed, then update states --
     * unset temporary unsaved states if just saved them.
     *
     * @todo
     * Consider change this into a `getDerivedStateFromProps` call instead of a `componentDidUpdate`.
     */
    componentDidUpdate(pastProps, pastState){
        const { variantSampleListItem: pastVSLItem = null } = pastProps;
        const { variantSampleListItem } = this.props;

        if (variantSampleListItem !== pastVSLItem) {
            this.setState(({ changedClassificationsByVS: origClassificationDict }) => {
                const changedClassificationsCount = this.memoized.changedClassificationsCount(origClassificationDict);
                if (changedClassificationsCount === 0) {
                    return null;
                }
                const savedClassificationsByVS = this.memoized.savedClassificationsByVS(variantSampleListItem);
                const nextChangedClassificationsByVS = {};
                Object.keys(origClassificationDict).forEach(function(vsUUID){
                    if (savedClassificationsByVS[vsUUID] !== undefined) {
                        // Ensure vsAtID present in our list of variant_samples (`savedClassificationsByVS`); it may have been
                        // deleted in InterpretationTab in which case we need to delete it from changedClassificationsByVS
                        // as well.
                        const isEqual = (origClassificationDict[vsUUID] || null) === savedClassificationsByVS[vsUUID];
                        if (!isEqual) {
                            nextChangedClassificationsByVS[vsUUID] = origClassificationDict[vsUUID];
                        }
                    }
                });

                console.log("Updating `changedClassificationsByVS` - ", origClassificationDict, nextChangedClassificationsByVS);

                return { "changedClassificationsByVS": nextChangedClassificationsByVS };
            });
        }
    }

    updateClassificationForVS(vsUUID, classification){
        const { variantSampleListItem } = this.props;
        const savedClassificationsByVS = this.memoized.savedClassificationsByVS(variantSampleListItem);

        this.setState(function({ changedClassificationsByVS: origClassificationDict }){
            const { [vsUUID]: savedClassification = null } = savedClassificationsByVS;
            const nextChangedClassificationsByVS = { ...origClassificationDict };

            if ((!savedClassification && classification === null) || savedClassification === classification) {
                if (typeof nextChangedClassificationsByVS[vsUUID] === "undefined") {
                    return; // No change needed; skip update for performance.
                }
                delete nextChangedClassificationsByVS[vsUUID]; // undefined means (existing/equal) `savedClassification` will take precedence, no PATCH needed.
            } else {
                // Set explicit `null` (or truthy value) to inform to DELETE (or set) value of this field when PATCH.
                if (nextChangedClassificationsByVS[vsUUID] === classification) {
                    return; // No change needed; skip update for performance.
                }
                nextChangedClassificationsByVS[vsUUID] = classification;
            }
            return { "changedClassificationsByVS": nextChangedClassificationsByVS };
        });
    }

    render(){
        const { children, ...passProps } = this.props;
        const { changedClassificationsByVS } = this.state;
        const changedClassificationsCount = this.memoized.changedClassificationsCount(changedClassificationsByVS);
        const childProps = {
            ...passProps,
            changedClassificationsByVS,
            changedClassificationsCount,
            "updateClassificationForVS": this.updateClassificationForVS
        };

        return React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) {
                // String or something
                return child;
            }
            if (typeof child.type === "string") {
                // Normal element (a, div, etc)
                return child;
            } // Else is React component
            return React.cloneElement(child, childProps);
        });
    }

}



export const CaseReviewTab = React.memo(function CaseReviewTab (props) {
    const {
        schemas, context,
        isActiveDotRouterTab = false,
        // From VariantSampleListController
        variantSampleListItem,
        isLoadingVariantSampleListItem = false,
        fetchVariantSampleListItem,
        // From CaseReviewController
        changedClassificationsByVS,
        updateClassificationForVS,
        changedClassificationsCount,
        // From CaseReviewSelectedNotesStore
        sendToProjectStore,
        sendToReportStore,
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        resetSendToProjectStoreItems,
        resetSendToReportStoreItems,
        // From NoteSubSelectionStateController
        reportNotesIncluded,
        kbNotesIncluded,
        toggleReportNoteSubselectionState,
        toggleKBNoteSubselectionState,
    } = props;

    const { report } = context;
    const { uuid: reportUUID } = report || {};

    const alreadyInProjectNotes = useMemo(function(){
        return buildAlreadyStoredNoteUUIDDict(variantSampleListItem);
    }, [ variantSampleListItem ]);

    const alreadyInReportNotes = useMemo(function(){
        if (!reportUUID) {
            return {};
        }
        return buildAlreadyStoredNoteUUIDDict(variantSampleListItem, function({ associated_items: noteAssociatedItems }){
            const foundReportEntry = _.findWhere(noteAssociatedItems, { "item_type": "Report", "item_identifier": reportUUID });
            return !!(foundReportEntry);
        });
    }, [ report, variantSampleListItem ]);

    if (!isActiveDotRouterTab) {
        return null;
    }

    const commonProps = {
        isLoadingVariantSampleListItem, variantSampleListItem,
        alreadyInProjectNotes, alreadyInReportNotes,
        sendToProjectStore, sendToReportStore,
        toggleSendToProjectStoreItems, toggleSendToReportStoreItems,
        schemas, context
    };

    return (
        <React.Fragment>
            <div className="d-flex align-items-center justify-content-between mb-24">
                <h1 className="text-300 mb-0">
                    Case Review
                </h1>

                <div>
                    <button type="button" className="btn btn-primary ml-05" disabled>
                        <i className="icon icon-file-pdf far mr-1"/>
                        View Report
                    </button>
                </div>

            </div>
            <div>

                <CaseSpecificSelectionsPanel {...commonProps} {...{ reportNotesIncluded, kbNotesIncluded, toggleReportNoteSubselectionState, toggleKBNoteSubselectionState }} className="mb-12" />

                <div className="d-block d-md-flex align-items-center justify-content-between mb-12">
                    <div className="text-left">
                        {/*
                        <button type="button" className="btn btn-primary mr-05" disabled>
                            Export current 'Send to Project' selections as <span className="text-600">TSV spreadsheet</span>
                        </button>
                        */}

                        <PatchItemsProgress>
                            <SaveNotesToReportButton {...{ variantSampleListItem, fetchVariantSampleListItem, isLoadingVariantSampleListItem,
                                sendToReportStore, resetSendToReportStoreItems, context }} className="my-1 mr-1"/>
                        </PatchItemsProgress>

                        <PatchItemsProgress>
                            <SaveNotesToProjectButton {...{ variantSampleListItem, fetchVariantSampleListItem, isLoadingVariantSampleListItem,
                                sendToProjectStore, resetSendToProjectStoreItems }} className="my-1 mr-1"/>
                        </PatchItemsProgress>

                    </div>

                    <div className="text-left">
                        <SaveFindingsButton {...{ variantSampleListItem, fetchVariantSampleListItem, isLoadingVariantSampleListItem,
                            changedClassificationsByVS, updateClassificationForVS, changedClassificationsCount }} className="ml-md-05 my-1" />
                    </div>

                </div>

                <VariantSampleSelectionList {...commonProps} {...{ changedClassificationsByVS, updateClassificationForVS }}
                    parentTabType={parentTabTypes.CASEREVIEW} />

            </div>
        </React.Fragment>
    );
});



/**
 * Builds dictionary to use to mark certain Notes as disabled and exclude them from selection.
 * From those notes which have already been published to knowledgebase.
 *
 * For now can just check if Note.status === "current" and then keep that way if can assert Variant.interpretations etc. will be up-to-date.
 */
function buildAlreadyStoredNoteUUIDDict(
    variantSampleListItem,
    checkFunction = function({ status: noteStatus }){
        return (noteStatus === "current");
    }
){
    const { variant_samples: vsObjects = [] } = variantSampleListItem || {}; // Might not yet be loaded.
    const dict = {};
    vsObjects.forEach(function({ variant_sample_item }){
        getAllNotesFromVariantSample(variant_sample_item).forEach(function(noteItem){
            const { uuid: noteUUID } = noteItem;
            if (checkFunction(noteItem)) {
                dict[noteUUID] = true;
            }
        });
    });
    return dict;
}


function variantSamplesWithAnySelectionSize(variantSampleListItem, selectionStore){
    const { variant_samples: vsObjects = [] } = variantSampleListItem || {}; // Might not yet be loaded.
    let count = 0;
    vsObjects.forEach(function({ variant_sample_item }){
        if (_.any(getAllNotesFromVariantSample(variant_sample_item), function({ uuid }){ return selectionStore[uuid]; })) {
            count++;
        }
    });
    return count;
}


/** @todo Move to SPC or utils directory */
class PatchItemsProgress extends React.PureComponent {

    constructor(props){
        super(props);
        this.patchItemsProcess = this.patchItemsProcess.bind(this);
        this.patchItems = this.patchItems.bind(this);
        this.onReset = this.onReset.bind(this);

        this.state = {
            "isPatching": false,
            "patchingPercentageComplete": 0,
            "patchErrors": []
        };

    }

    patchItemsProcess(patchPayloads, onComplete) {
        const patchQ = [ ...patchPayloads ];

        const patchesToComplete = patchQ.length;
        let countCompleted = 0;

        const checkIfCompleted = () => {
            // Check if all requests have completed, and call `onComplete` if so.
            if (patchesToComplete === countCompleted) {
                onComplete({ countCompleted, patchErrors });
            } else {
                const patchingPercentageComplete = patchesToComplete === 0 ? 0 : countCompleted / patchesToComplete;
                this.setState({ patchingPercentageComplete });
            }
        };

        const patchErrors = [];

        // Browser can't send more than 6 reqs anyway, so limit concurrent reqs.

        function performRequest([ patchURL, itemPatchPayload ]) {
            return ajax.promise(patchURL, "PATCH", {}, JSON.stringify(itemPatchPayload))
                .then(function(response){
                    const { status } = response;
                    if (status !== "success") {
                        throw response;
                    }
                }).catch(function(error){
                    // TODO display this in UI later perhaps.
                    patchErrors.push(error);
                    console.error("PatchItemsProgress AJAX error", error);
                }).finally(function(){
                    countCompleted++;
                    checkIfCompleted();
                    if (patchQ.length > 0) {
                        // Kick off another request
                        performRequest(patchQ.shift());
                    }
                });
        }

        // Niche case - if nothing to PATCH
        checkIfCompleted();

        // Browser can't send more than 6 reqs anyway, so limit concurrent reqs to 5.
        // As each requests ends it'll start another as long as there's more things to PATCH.
        for (var i = 0; i < Math.min(5, patchesToComplete); i++) {
            performRequest(patchQ.shift());
        }
    }

    patchItems(patchPayloads, callback){

        this.setState({ "isPatching": true, "patchingPercentageComplete": 0 }, () => {
            setTimeout(ReactTooltip.hide, 50); // Hide still-present tooltips, if any (i.e. button that was clicked)
            console.log("Generated PATCH '../@@process-notes/' payloads - ", patchPayloads);
            this.patchItemsProcess(patchPayloads, ({ countCompleted, patchErrors }) => {
                console.info("Patching Completed, count Items PATCHed -", countCompleted);
                this.setState({
                    "isPatching": true,
                    "patchingPercentageComplete": 1,
                    patchErrors
                }, () => {
                    if (typeof callback === "function") {
                        callback(countCompleted, patchErrors);
                    }
                });
            });

        });
    }

    onReset(){
        const { patchingPercentageComplete } = this.state;
        if (patchingPercentageComplete !== 1) {
            // Not allowed until PATCHes completed (or timed out / failed / etc).
            return false;
        }
        this.setState({
            "isPatching": false,
            "patchingPercentageComplete": 0,
            "patchErrors": []
        });
    }

    render(){
        const { children, ...passProps } = this.props;
        const { isPatching, patchingPercentageComplete, patchErrors } = this.state;

        const childProps = {
            ...passProps,
            isPatching,
            "patchItems": this.patchItems
        };

        const adjustedChildren = React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) {
                // String or something
                return child;
            }
            if (typeof child.type === "string") {
                // Normal element (a, div, etc)
                return child;
            } // Else is React component
            return React.cloneElement(child, childProps);
        });

        return (
            <React.Fragment>
                { adjustedChildren }
                { isPatching ?
                    <ProgressModal {...{ isPatching, patchingPercentageComplete, patchErrors }} onHide={this.onReset} />
                    : null }
            </React.Fragment>
        );
    }

}

/**
 * Generates payloads for VariantSampleList /@@process-notes/ endpoint
 * and then PATCHes them to there.
 *
 * @todo Check if lack edit permission and make button disabled if so.
 */
function SaveNotesToProjectButton (props) {
    const {
        variantSampleListItem,
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem,
        sendToProjectStore,
        resetSendToProjectStoreItems,
        isPatching,
        patchItems,
        className,
        disabled: propDisabled
    } = props;

    const selectionStoreSize = useMemo(function(){
        return Object.keys(sendToProjectStore).length;
    }, [ sendToProjectStore ]);

    const variantSamplesWithAnySelections = useMemo(function(){
        return variantSamplesWithAnySelectionSize(variantSampleListItem, sendToProjectStore);
    }, [ variantSampleListItem, sendToProjectStore ]);

    const disabled = propDisabled || isPatching || isLoadingVariantSampleListItem || selectionStoreSize === 0 || false;

    const onClick = useCallback(function(e){
        e.stopPropagation();
        if (disabled) {
            return false;
        }

        const { variant_samples: vsObjects = [] } = variantSampleListItem || {};

        const variantSampleItems = vsObjects.map(function({ variant_sample_item }){
            return variant_sample_item;
        }).filter(function({ "@id": vsAtID }){
            // Filters out any VSes without view permissions, if any.
            // TODO: check actions for edit ability, perhaps.
            return !!(vsAtID);
        });

        const payloads = [];
        variantSampleItems.forEach(function(variantSampleItem){
            const {
                "@id": variantSampleAtID,
                interpretation: {
                    uuid: interpretationUUID,
                    status: interpretationStatus
                } = {},
                discovery_interpretation: {
                    uuid: discoveryInterpretationUUID,
                    status: discoveryInterprationStatus
                } = {},
                gene_notes: {
                    uuid: lastGeneNoteUUID,
                    status: lastGeneNoteStatus
                } = {},
                variant_notes: {
                    uuid: lastVariantNoteUUID,
                    status: lastVariantNoteStatus
                } = {}
            } = variantSampleItem;

            const payload = { "save_to_project_notes": {} };

            if (interpretationUUID && sendToProjectStore[interpretationUUID]) {
                if (interpretationStatus !== "current") {
                    // If condition is potentially redundant as we disable such notes from being selectable in first place.
                    payload.save_to_project_notes.interpretation = interpretationUUID;
                }
            }
            if (discoveryInterpretationUUID && sendToProjectStore[discoveryInterpretationUUID]) {
                if (discoveryInterprationStatus !== "current") {
                    payload.save_to_project_notes.discovery_interpretation = discoveryInterpretationUUID;
                }
            }
            if (lastGeneNoteUUID && sendToProjectStore[lastGeneNoteUUID]) {
                if (lastGeneNoteStatus !== "current") {
                    payload.save_to_project_notes.gene_notes = lastGeneNoteUUID;
                }
            }
            if (lastVariantNoteUUID && sendToProjectStore[lastVariantNoteUUID]) {
                if (lastVariantNoteStatus !== "current") {
                    payload.save_to_project_notes.variant_notes = lastVariantNoteUUID;
                }
            }

            if (Object.keys(payload.save_to_project_notes).length > 0) {
                payloads.push([
                    variantSampleAtID + "/@@process-notes/",
                    payload
                ]);
            }

        });

        patchItems(payloads, (countCompleted, patchErrors) => {
            if (countCompleted > 0) {
                if (typeof resetSendToProjectStoreItems === "function") {
                    console.log("Reset `resetSendToProjectStoreItems`.");
                    resetSendToProjectStoreItems();
                } else {
                    throw new Error("No `props.resetSendToProjectStoreItems` supplied to SaveNotesToProjectButton");
                }
                if (typeof fetchVariantSampleListItem === "function") {
                    console.log("Refreshing our VariantSampleListItem with updated Note Item statuses.");
                    fetchVariantSampleListItem();
                } else {
                    throw new Error("No `props.fetchVariantSampleListItem` supplied to SaveNotesToProjectButton");
                }
            }
            // TODO:
            // if (patchErrors.length > 0) {}
        });
    }, [ disabled, patchItems, variantSampleListItem, sendToProjectStore, resetSendToProjectStoreItems, fetchVariantSampleListItem ]);

    return (
        <button type="button" {...{ disabled, onClick }} className={"btn btn-primary" + (className ? " " + className : "")}
            data-tip={`${selectionStoreSize} Note selections from ${variantSamplesWithAnySelections} Sample Variants`}>
            Save Note Selections to <span className="text-600">Project</span>
        </button>
    );
}

function SaveNotesToReportButton (props) {
    const {
        context: { report } = {},
        variantSampleListItem,
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem,
        sendToReportStore,
        resetSendToReportStoreItems,
        isPatching,
        patchItems,
        className,
        disabled: propDisabled
    } = props;

    const {
        "@id": reportAtID,
        uuid: reportUUID = null,
        variant_samples: reportVariantSamples = []
    } = report || {};

    const selectionStoreSize = useMemo(function(){
        return Object.keys(sendToReportStore).length;
    }, [ sendToReportStore ]);

    const variantSamplesWithAnySelections = useMemo(function(){
        return variantSamplesWithAnySelectionSize(variantSampleListItem, sendToReportStore);
    }, [ variantSampleListItem, sendToReportStore ]);

    const disabled = propDisabled || isPatching || isLoadingVariantSampleListItem || !reportUUID || selectionStoreSize === 0 || false;

    const onClick = useCallback(function(e){
        e.stopPropagation();
        if (disabled) {
            return false;
        }

        const { variant_samples: vsObjects = [] } = variantSampleListItem || {};

        const variantSampleItems = vsObjects.map(function({ variant_sample_item }){
            return variant_sample_item;
        }).filter(function({ "@id": vsAtID }){
            // Filters out any VSes without view permissions, if any.
            // TODO: check actions for edit ability, perhaps.
            return !!(vsAtID);
        });

        const payloads = [];                        // [ [path, payload], ... ]
        const reportPatchVariantSampleUUIDs = {};   // { <uuid> : true }

        reportVariantSamples.forEach(function({ uuid: reportVSUUID }){
            // Add any existing variant samples first (JS objects ordered in order of insertion)
            reportPatchVariantSampleUUIDs[reportVSUUID] = true;
        });

        // Added into all Note.associated_items[] which are sent to report to identify them as being part of report.
        const newAssociatedItemEntry = { "item_type": "Report", "item_identifier": reportUUID };

        variantSampleItems.forEach(function(variantSampleItem){
            const {
                "@id": variantSampleAtID,
                uuid: variantSampleUUID,
                interpretation: {
                    uuid: interpretationUUID,
                    associated_items: interpretationAssociatedItems = []
                } = {},
                discovery_interpretation: {
                    uuid: discoveryInterpretationUUID,
                    associated_items: discoveryInterpretationAssociatedItems = []
                } = {},
                gene_notes: {
                    uuid: lastGeneNoteUUID,
                    associated_items: lastGeneNoteAssociatedItems = []
                } = {},
                variant_notes: {
                    uuid: lastVariantNoteUUID,
                    associated_items: lastVariantNoteAssociatedItems = []
                } = {}
            } = variantSampleItem;

            let shouldAddThisVariantSampleToReport = false;

            if (interpretationUUID && sendToReportStore[interpretationUUID]) {
                const existingEntry = _.findWhere(interpretationAssociatedItems, newAssociatedItemEntry);
                if (!existingEntry) {
                    payloads.push([
                        "/" + interpretationUUID,
                        { "associated_items": [ ...interpretationAssociatedItems, newAssociatedItemEntry  ] }
                    ]);
                }
                shouldAddThisVariantSampleToReport = true;
            }
            if (discoveryInterpretationUUID && sendToReportStore[discoveryInterpretationUUID]) {
                const existingEntry = _.findWhere(discoveryInterpretationAssociatedItems, newAssociatedItemEntry);
                if (!existingEntry) {
                    payloads.push([
                        "/" + discoveryInterpretationUUID,
                        { "associated_items": [ ...discoveryInterpretationAssociatedItems, newAssociatedItemEntry  ] }
                    ]);
                }
                shouldAddThisVariantSampleToReport = true;
            }
            if (lastGeneNoteUUID && sendToReportStore[lastGeneNoteUUID]) {
                const existingEntry = _.findWhere(lastGeneNoteAssociatedItems, newAssociatedItemEntry);
                if (!existingEntry) {
                    payloads.push([
                        "/" + lastGeneNoteUUID,
                        { "associated_items": [ ...lastGeneNoteAssociatedItems, newAssociatedItemEntry  ] }
                    ]);
                }
                shouldAddThisVariantSampleToReport = true;
            }
            if (lastVariantNoteUUID && sendToReportStore[lastVariantNoteUUID]) {
                const existingEntry = _.findWhere(lastVariantNoteAssociatedItems, newAssociatedItemEntry);
                if (!existingEntry) {
                    payloads.push([
                        "/" + lastVariantNoteUUID,
                        { "associated_items": [ ...lastVariantNoteAssociatedItems, newAssociatedItemEntry  ] }
                    ]);
                }
                shouldAddThisVariantSampleToReport = true;
            }

            if (shouldAddThisVariantSampleToReport) {
                reportPatchVariantSampleUUIDs[variantSampleUUID] = true;
            }
        });


        // PATCH Report Item with `variant_samples`. TODO: Check for edit permissions first (?)
        const reportVariantSampleUUIDsToPatch = Object.keys(reportPatchVariantSampleUUIDs);
        const reportVariantSampleUUIDsToPatchLen = reportVariantSampleUUIDsToPatch.length;
        if (reportVariantSampleUUIDsToPatchLen > 0) {
            if (!_.isEqual(reportVariantSampleUUIDsToPatch, _.pluck(reportVariantSamples, "uuid"))) {
                // Skip if is same value to be patched (maybe this is 2nd saving action as result of some prior network error(s))
                payloads.unshift([
                    reportAtID,
                    { "variant_samples": reportVariantSampleUUIDsToPatch }
                ]);
            }
        }

        patchItems(payloads, (countCompleted, patchErrors) => {
            if (countCompleted > 0) {
                if (typeof resetSendToReportStoreItems === "function") {
                    console.log("Reset 'send to project' store items.");
                    resetSendToReportStoreItems();
                } else {
                    throw new Error("No `props.resetSendToReportStoreItems` supplied to SaveNotesToReportButton");
                }
                if (typeof fetchVariantSampleListItem === "function") {
                    console.log("Refreshing our VariantSampleListItem with updated Note Item statuses.");
                    fetchVariantSampleListItem();
                } else {
                    throw new Error("No `props.fetchVariantSampleListItem` supplied to SaveNotesToReportButton");
                }
            }
            // TODO:
            // if (patchErrors.length > 0) {}
        });
    }, [ disabled, patchItems, variantSampleListItem, sendToReportStore, report, resetSendToReportStoreItems, fetchVariantSampleListItem ]);

    const btnCls = "btn btn-" + (!reportUUID ? "outline-danger" : "primary") + (className ? " " + className : "");

    return (
        <button type="button" {...{ disabled, onClick }} className={btnCls}
            data-tip={`${selectionStoreSize} Note selections from ${variantSamplesWithAnySelections} Sample Variants`}>
            Save Note Selections to <span className="text-600">Report</span>
        </button>
    );
}


function SaveFindingsButton(props){
    const {
        patchItems,
        changedClassificationsByVS,
        updateClassificationForVS,
        changedClassificationsCount,
        variantSampleListItem,
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem,
        disabled: propDisabled,
        className
    } = props;

    const disabled = propDisabled || isLoadingVariantSampleListItem || changedClassificationsCount === 0;


    const onClick = useCallback(function(e){
        e.stopPropagation();
        if (disabled) {
            return false;
        }

        const { variant_samples: vsObjects = [] } = variantSampleListItem || {};

        const payloads = []; // [ [path, payload], ... ]

        vsObjects.forEach(function(vsObject){
            const { variant_sample_item: { "@id": vsAtID, "uuid": vsUUID } } = vsObject;
            const { [vsUUID]: classificationToSaveForVS = undefined } = changedClassificationsByVS;

            if (!vsAtID) {
                // Filter out any VSes without view permissions, if any.
                // TODO: check actions for edit ability, perhaps.
                return;
            }

            if (classificationToSaveForVS === undefined) {
                // Preserve if === null, which means to delete the value.
                return;
            }

            const payload = [ vsAtID, {} ];
            if (classificationToSaveForVS === null) {
                payload[0] += "?delete_fields=finding_table_tag";
            } else {
                payload[1].finding_table_tag = classificationToSaveForVS;
            }

            payloads.push(payload);

        });



        console.log("PAYLOADS", payloads);



        // patchItems(payloads, (countCompleted, patchErrors) => {
        //     if (countCompleted > 0) {
        //         if (typeof resetSendToReportStoreItems === "function") {
        //             console.log("Reset 'send to project' store items.");
        //             resetSendToReportStoreItems();
        //         } else {
        //             throw new Error("No `props.resetSendToReportStoreItems` supplied to SaveNotesToReportButton");
        //         }
        //         if (typeof fetchVariantSampleListItem === "function") {
        //             console.log("Refreshing our VariantSampleListItem with updated Note Item statuses.");
        //             fetchVariantSampleListItem();
        //         } else {
        //             throw new Error("No `props.fetchVariantSampleListItem` supplied to SaveNotesToReportButton");
        //         }
        //     }
        //     // TODO:
        //     // if (patchErrors.length > 0) {}
        // });
    }, [ disabled, patchItems, variantSampleListItem, changedClassificationsByVS, updateClassificationForVS, fetchVariantSampleListItem ]);


    const applyFindingsTagsBtnText = (
        `Save ${changedClassificationsCount > 0 ? changedClassificationsCount + " " : ""}Finding${changedClassificationsCount !== 1 ? "s" : ""}`
    );

    return (
        <button type="button" {...{ disabled, onClick }} className={"btn btn-primary" + (className ? " " + className : "")}>
            { applyFindingsTagsBtnText }
        </button>
    );
}


/**
 * Can be re-used for PATCHing multiple items.
 * @todo Move to SPC or utils directory along with PatchItemsProgress
 */
const ProgressModal = React.memo(function ProgressModal (props) {
    const { isPatching, patchingPercentageComplete, onHide, patchErrors } = props;

    const percentCompleteFormatted = Math.round(patchingPercentageComplete * 1000) / 10;
    const finished = patchingPercentageComplete === 1;
    const errorsLen = patchErrors.length;

    let body;
    if (errorsLen > 0){
        body = "" + errorsLen + " errors";
    } else if (finished) {
        body = "Done";
    } else if (isPatching) {
        body = "Updating...";
    }

    return (
        <Modal show onHide={onHide}>
            <Modal.Header closeButton={finished}>
                <Modal.Title>{ finished ? "Update Complete" : "Please wait..." }</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="text-center mb-1">{ body }</p>
                <div className="progress">
                    <div className="progress-bar" role="progressbar" style={{ "width": percentCompleteFormatted + "%" }}
                        aria-valuenow={percentCompleteFormatted} aria-valuemin="0" aria-valuemax="100"/>
                </div>
                { finished ?
                    <button type="button" className="mt-24 btn btn-block btn-primary" onClick={onHide}>
                        Close
                    </button>
                    : null }
            </Modal.Body>
        </Modal>
    );
});
