'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { PatchItemsProgress } from './../../../util/PatchItemsProgress';
import { VariantSampleSelectionList, parentTabTypes } from './../VariantSampleSelection';
import { CaseSpecificSelectionsPanel, getAllNotesFromVariantSample } from './../variant-sample-selection-panels';
import { InnerTabToggle } from './../FilteringTab';
import { AutoGrowTextArea } from './../../components/AutoGrowTextArea';
import { projectReportSettings } from './../../ReportView/project-settings-draft';

import { SaveFindingsButton } from './SaveFindingsButton';
import { ReportGenerationView } from './ReportGenerationView';


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

    // TODO: Determine if any notes saved to report, and then (a) undisable button + (b) set state to 1.
    const [ currentViewIdx, setCurrentViewIdx ] = useState(0);

    const onClickA = useCallback(function(e){
        e.stopPropagation();
        setCurrentViewIdx(0);
    });

    const onClickB = useCallback(function(e){
        e.stopPropagation();
        setCurrentViewIdx(1);
    });

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

    const toggleOptions = [
        {
            "title": "I. Note Finalization",
            "onClick": onClickA
        },
        {
            "title": "II. Report Generation",
            "onClick": onClickB,
            // "disabled": true // Under Construction
        }
    ];


    return (
        <React.Fragment>
            <div className="d-flex align-items-center justify-content-between mb-36">

                <h1 className="text-300 mb-0">
                    Case Review
                </h1>

                <div className="my-3 my-md-n3">
                    <InnerTabToggle options={toggleOptions} activeIdx={currentViewIdx} />
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

            { currentViewIdx === 0 ? // Note Finalization
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
                :
                <ReportGenerationView {...{ context }} />
            }

        </React.Fragment>
    );
});



function countVariantSamplesWithAnySelectionSize(variantSampleListItem, selectionStore){
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
        return countVariantSamplesWithAnySelectionSize(variantSampleListItem, sendToProjectStore);
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
        return countVariantSamplesWithAnySelectionSize(variantSampleListItem, sendToReportStore);
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


