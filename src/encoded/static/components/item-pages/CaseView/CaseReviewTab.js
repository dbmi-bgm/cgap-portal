'use strict';

import React, { useCallback, useMemo } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { PatchItemsProgress } from './../../util/PatchItemsProgress';
import { VariantSampleSelectionList, parentTabTypes } from './VariantSampleSelection';
import { CaseSpecificSelectionsPanel, getAllNotesFromVariantSample } from './variant-sample-selection-panels';
import { InnerTabToggle } from './FilteringTab';



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

    /** Using getDerivedStateFromProps in place of componentDidMount to avoid re-renders. */
    static getDerivedStateFromProps(props, state) {
        const { variantSampleListItem } = props;
        const { pastVSLItem, changedClassificationsByVS: origClassificationDict } = state;

        const nextState = { "pastVSLItem": variantSampleListItem };

        if (variantSampleListItem !== pastVSLItem) {
            // Unset changedClassificationsByVS[uuid] for any VS
            // which has been saved (i.e. savedClassification is now equal to unsaved classification).

            const changedClassificationsCount = Object.keys(origClassificationDict).length;
            if (changedClassificationsCount === 0) {
                return null;
            }
            const savedClassificationsByVS = CaseReviewController.savedClassificationsByVS(variantSampleListItem);
            const nextChangedClassificationsByVS = {};
            let anyClassificationsUnset = false;
            Object.keys(origClassificationDict).forEach(function(vsUUID){
                if (savedClassificationsByVS[vsUUID] !== undefined) {
                    // Ensure vsAtID present in our list of variant_samples (`savedClassificationsByVS`); it may have been
                    // deleted in InterpretationTab in which case we need to delete it from changedClassificationsByVS
                    // as well.
                    const isEqual = (origClassificationDict[vsUUID] || null) === savedClassificationsByVS[vsUUID];
                    if (!isEqual) {
                        nextChangedClassificationsByVS[vsUUID] = origClassificationDict[vsUUID];
                    } else {
                        anyClassificationsUnset = true;
                    }
                }
            });

            if (anyClassificationsUnset) {
                console.log("Updating `changedClassificationsByVS` - ", origClassificationDict, nextChangedClassificationsByVS);
                nextState.changedClassificationsByVS = nextChangedClassificationsByVS;
            }

        }

        return nextState;
    }

    constructor(props){
        super(props);
        this.fetchProjectItem = this.fetchProjectItem.bind(this);
        this.updateClassificationForVS = this.updateClassificationForVS.bind(this);
        this.state = {
            "changedClassificationsByVS": {},
            "projectItem": null,
            // Reference to object, not clone (extra memory) of it. Used solely for getDerivedStateFromProps.
            "pastVSLItem": props.variantSampleListItem
        };
        this.memoized = {
            savedClassificationsByVS: memoize(CaseReviewController.savedClassificationsByVS),
            changedClassificationsCount: memoize(function(changedClassificationsByVS){ return Object.keys(changedClassificationsByVS).length; })
        };
    }

    componentDidMount() {
        const { projectItem } = this.state;
        if (!projectItem) {
            this.fetchProjectItem();
        }
    }

    /**
     * Will be used to load case.project and pass down report settings.
     * Might be moved up to CaseView, if needed in other places on page.
     *
     * Should we grab project from somewhere else?
     */
    fetchProjectItem(){
        const {
            context: {
                project: { "@id": projectAtID = null } = {}
            }
        } = this.props;

        if (!projectAtID) {
            return;
        }


        // ajax.load("/embed" or projectAtID, ...)
    }

    updateClassificationForVS(vsUUID, classification, callback){
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
        }, callback);
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


/**
 * @todo Potentially merge with CaseReviewController
 */
export class CaseReviewSelectedNotesStore extends React.PureComponent {

    static alreadyInProjectNotes(variantSampleListItem) {
        return buildAlreadyStoredNoteUUIDDict(variantSampleListItem, function({ status: noteStatus }){
            return (noteStatus === "current");
        });
    }

    static alreadyInReportNotes(variantSampleListItem, report){
        const { uuid: reportUUID } = report || {};
        if (!reportUUID) {
            return {};
        }
        return buildAlreadyStoredNoteUUIDDict(variantSampleListItem, function({ associated_items: noteAssociatedItems }){
            const foundReportEntry = _.findWhere(noteAssociatedItems, { "item_type": "Report", "item_identifier": reportUUID });
            return !!(foundReportEntry);
        });
    }

    /** Using getDerivedStateFromProps instd of componentDidUpdate prevents additional render(s) */
    static getDerivedStateFromProps(props, state){
        const { variantSampleListItem, context: { report } } = props;
        const { pastVSLItem, sendToProjectStore = {}, sendToReportStore = {} } = state;

        const nextState = { "pastVSLItem": variantSampleListItem };

        if (variantSampleListItem !== pastVSLItem) {
            // Clear sendToProjectStore and sendToReportStore of any items that were just saved
            // or updated by someone else.
            const alreadyInProjectNotes = CaseReviewSelectedNotesStore.alreadyInProjectNotes(variantSampleListItem);
            const alreadyInReportNotes = CaseReviewSelectedNotesStore.alreadyInReportNotes(variantSampleListItem, report);

            const nextSendToProjectStore = { ...sendToProjectStore };
            const nextSendToReportStore = { ...sendToReportStore };
            let anyProjectStoreChanges = false;
            let anyReportStoreChanges = false;
            Object.keys(sendToProjectStore).forEach(function(noteUUID){
                if (alreadyInProjectNotes[noteUUID]) {
                    delete nextSendToProjectStore[noteUUID];
                    anyProjectStoreChanges = true;
                }
            });
            Object.keys(sendToReportStore).forEach(function(noteUUID){
                if (alreadyInReportNotes[noteUUID]) {
                    delete nextSendToReportStore[noteUUID];
                    anyReportStoreChanges = true;
                }
            });

            if (anyProjectStoreChanges) {
                nextState.sendToProjectStore = nextSendToProjectStore;
            }
            if (anyReportStoreChanges) {
                nextState.sendToReportStore = nextSendToReportStore;
            }

        }

        return nextState;
    }

    constructor(props) {
        super(props);
        this.toggleSendToProjectStoreItems = this.toggleStoreItems.bind(this, "sendToProjectStore");
        this.toggleSendToReportStoreItems = this.toggleStoreItems.bind(this, "sendToReportStore");

        this.state = {
            // Keyed by Note Item UUID and value is boolean true/false for now (can be changed)
            "sendToProjectStore": {},
            "sendToReportStore": {},
            // Reference to object, not clone (extra memory) of it. Used solely for getDerivedStateFromProps.
            "pastVSLItem": props.variantSampleListItem
        };

        this.memoized = {
            alreadyInProjectNotes: memoize(CaseReviewSelectedNotesStore.alreadyInProjectNotes),
            alreadyInReportNotes: memoize(CaseReviewSelectedNotesStore.alreadyInReportNotes)
        };
    }

    toggleStoreItems(storeName, noteSelectionObjects, callback = null){
        this.setState(function(currState){
            const nextStore = { ...currState[storeName] };
            noteSelectionObjects.forEach(function([ id, data ]){
                if (nextStore[id]) {
                    delete nextStore[id];
                } else {
                    nextStore[id] = data;
                }
            });
            return { [storeName] : nextStore };
        }, callback);
    }

    render(){
        const {
            props: {
                children,
                context,
                variantSampleListItem,
                ...passProps
            },
            state,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
        } = this;

        const { report } = context;

        const alreadyInProjectNotes = this.memoized.alreadyInProjectNotes(variantSampleListItem);
        const alreadyInReportNotes = this.memoized.alreadyInReportNotes(variantSampleListItem, report);

        const childProps = {
            ...passProps,
            ...state,
            context,
            variantSampleListItem,
            alreadyInProjectNotes,
            alreadyInReportNotes,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
        };
        return React.Children.map(children, function(c){
            if (React.isValidElement(c)) {
                return React.cloneElement(c, childProps);
            }
            return c;
        });
    }

}




export const CaseReviewTab = React.memo(function CaseReviewTab (props) {
    const {
        schemas, context,
        // From CaseView
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
        alreadyInProjectNotes,
        alreadyInReportNotes,
        // From NoteSubSelectionStateController
        reportNotesIncluded,
        kbNotesIncluded,
        toggleReportNoteSubselectionState,
        toggleKBNoteSubselectionState,
    } = props;

    if (!isActiveDotRouterTab) {
        return null;
    }

    const commonBtnProps = { variantSampleListItem, fetchVariantSampleListItem, isLoadingVariantSampleListItem };

    const commonSelectionsProps = {
        isLoadingVariantSampleListItem, variantSampleListItem,
        alreadyInProjectNotes, alreadyInReportNotes,
        sendToProjectStore, sendToReportStore,
        toggleSendToProjectStoreItems, toggleSendToReportStoreItems,
        schemas, context
    };

    return (
        <React.Fragment>
            <div className="d-flex align-items-center justify-content-between mb-36">

                <h1 className="text-300 mb-0">
                    Case Review
                </h1>

                <div className="my-3 my-md-n3">
                    <InnerTabToggle activeIdx={0} disabledB
                        titleA="I. Note Finalization"
                        titleB="II. Report Generation"
                    />
                </div>

                {/* Hidden Temporarily
                <div>
                    <button type="button" className="btn btn-primary ml-05 d-flex align-items-center" disabled>
                        <i className="icon icon-file-pdf far mr-1"/>
                        View Report
                    </button>
                </div>
                */}

            </div>
            <div>

                <CaseSpecificSelectionsPanel {...commonSelectionsProps} {...{ reportNotesIncluded, kbNotesIncluded, toggleReportNoteSubselectionState, toggleKBNoteSubselectionState }} className="mb-12" />

                <div className="d-block d-md-flex align-items-center justify-content-between mb-12">
                    <div className="text-left">
                        {/*
                        <button type="button" className="btn btn-primary mr-05" disabled>
                            Export current 'Send to Project' selections as <span className="text-600">TSV spreadsheet</span>
                        </button>
                        */}

                        <PatchItemsProgress>
                            <SaveNotesToReportButton {...commonBtnProps} {...{ sendToReportStore, context }} className="my-1 mr-1"/>
                        </PatchItemsProgress>

                        <PatchItemsProgress>
                            <SaveNotesToProjectButton {...commonBtnProps} {...{ sendToProjectStore }} className="my-1 mr-1"/>
                        </PatchItemsProgress>

                    </div>

                    <div className="text-left">
                        <PatchItemsProgress>
                            <SaveFindingsButton {...commonBtnProps} {...{ changedClassificationsByVS, updateClassificationForVS, changedClassificationsCount }} className="ml-md-05 my-1" />
                        </PatchItemsProgress>
                    </div>

                </div>

                <VariantSampleSelectionList {...commonSelectionsProps} {...{ changedClassificationsByVS, updateClassificationForVS }}
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
function buildAlreadyStoredNoteUUIDDict(variantSampleListItem, checkFunction){
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
    }, [ disabled, patchItems, variantSampleListItem, sendToProjectStore, fetchVariantSampleListItem ]);

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
    }, [ disabled, patchItems, variantSampleListItem, sendToReportStore, report, fetchVariantSampleListItem ]);

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


        patchItems(payloads, (countCompleted, patchErrors) => {
            if (countCompleted > 0) {
                // We don't need to call updateClassificationForVS(...) here, since
                // changedClassificationsByVS will be updated in CaseReviewController componentDidUpdate.
                if (typeof fetchVariantSampleListItem === "function") {
                    console.log("Refreshing our VariantSampleListItem with updated Note Item statuses.");
                    fetchVariantSampleListItem();
                } else {
                    throw new Error("No `props.fetchVariantSampleListItem` supplied to SaveFindingsButton");
                }
            }
            // TODO:
            // if (patchErrors.length > 0) {}
        });
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
