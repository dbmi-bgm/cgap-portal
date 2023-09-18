'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';

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
        updateVariantSampleListSort,
        vslSortType,
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
        // From ajax.FetchedItem in CaseView/index.js
        fetchedReportItem,
        isFetchingReportItem,
        fetchReportItem
    } = props;

    const { last_modified: { date_modified: reportLastModified = null } = {} } = fetchedReportItem || {};

    // TODO: Determine if any notes saved to report, and then (a) undisable button + (b) set state to 1.
    const [ currentViewIdx, setCurrentViewIdx ] = useState(0);

    const [ resetCounter, setResetCounter ] = useState(0);

    const onClickNoteFinalization = useCallback(function(e){
        e.stopPropagation();
        setCurrentViewIdx(0);
    }, [ setCurrentViewIdx ]);

    const onClickReportGeneration = useCallback(function(e){
        e.stopPropagation();
        setCurrentViewIdx(1);
    }, [ setCurrentViewIdx ]);

    const onResetForm = useCallback(function(e){
        e.stopPropagation();
        setResetCounter(function(currentResetCounter){
            return currentResetCounter + 1;
        });
    }, [ setResetCounter ]);

    // if (!isActiveDotRouterTab) {
    //     return null;
    // }

    const commonBtnProps = { variantSampleListItem, fetchVariantSampleListItem, isLoadingVariantSampleListItem, fetchedReportItem, fetchReportItem };

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
            "onClick": onClickNoteFinalization
        },
        {
            "title": "II. Report Generation",
            "onClick": onClickReportGeneration,
            "disabled": !fetchedReportItem
            // "disabled": true // Under Construction
        }
    ];

    useEffect(function(){
        setTimeout(ReactTooltip.rebuild, 0);
    }, [ currentViewIdx ]);


    return (
        <React.Fragment>

            { isActiveDotRouterTab ?
                <div className="d-flex align-items-center justify-content-between mb-36">

                    <h1 className="text-300 mb-0">
                        Case Review
                        { isFetchingReportItem || isLoadingVariantSampleListItem ?
                            <i className="icon icon-fw icon-circle-notch icon-spin fas ml-12 text-muted" data-tip="Loading Report..." />
                            : (
                                <React.Fragment>
                                    {/* <i className="icon icon-arrow-right fas icon-xs mx-3"/>*/}
                                    &nbsp;&ndash;&nbsp;
                                    <span className="text-400">{ currentViewIdx === 0 ? "Note Finalization" : "Report Generation" }</span>
                                </React.Fragment>
                            ) }
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
                : null }

            { isActiveDotRouterTab && currentViewIdx === 0 ? // Note Finalization
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
                                <SaveNotesToReportButton {...commonBtnProps} {...{ sendToReportStore }} className="my-1 mr-1"/>
                            </PatchItemsProgress>

                            <PatchItemsProgress>
                                <SaveNotesToProjectButton {...commonBtnProps} {...{ sendToProjectStore }} className="my-1 mr-1"/>
                            </PatchItemsProgress>

                        </div>

                        <div className="text-left">
                            <PatchItemsProgress>
                                <SaveFindingsButton {...commonBtnProps} className="ml-md-05 my-1" {...{ changedClassificationsByVS,
                                    updateClassificationForVS, changedClassificationsCount, alreadyInReportNotes }} />
                            </PatchItemsProgress>
                        </div>

                    </div>

                    <VariantSampleSelectionList {...commonSelectionsProps} {...{ changedClassificationsByVS, updateClassificationForVS, vslSortType, updateVariantSampleListSort }}
                        parentTabType={parentTabTypes.CASEREVIEW} />

                </div>
                : null }

            <div className={currentViewIdx === 1 ? "d-block" : "d-none"}>
                <ReportGenerationView {...{ context, fetchedReportItem, fetchReportItem, onResetForm, variantSampleListItem }}
                    key={reportLastModified + "_" + resetCounter} visible={currentViewIdx === 1} />
            </div>


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
 * Generates payloads for VariantSampleList /@@update-project-notes/ endpoint
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

        const {
            variant_samples: snvVSObjects = [],
            structural_variant_samples: cnvVSObjects = []
        } = variantSampleListItem || {};

        const variantSampleItems = snvVSObjects.concat(cnvVSObjects).map(function({ variant_sample_item }){
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
                    is_saved_to_project: isInterpretationSavedToProject
                } = {},
                discovery_interpretation: {
                    uuid: discoveryInterpretationUUID,
                    is_saved_to_project: isDiscoveryInterpretationSavedToProject
                } = {},
                gene_notes: {
                    uuid: lastGeneNoteUUID,
                    is_saved_to_project: isGeneNoteSavedToProject
                } = {},
                variant_notes: {
                    uuid: lastVariantNoteUUID,
                    is_saved_to_project: isVariantNoteSavedToProject
                } = {}
            } = variantSampleItem;

            const payload = { "save_to_project_notes": {} };

            if (interpretationUUID && sendToProjectStore[interpretationUUID]) {
                if (!isInterpretationSavedToProject) {
                    // If condition is potentially redundant as we disable such notes from being selectable in first place.
                    payload.save_to_project_notes.interpretation = interpretationUUID;
                }
            }
            if (discoveryInterpretationUUID && sendToProjectStore[discoveryInterpretationUUID]) {
                if (!isDiscoveryInterpretationSavedToProject) {
                    payload.save_to_project_notes.discovery_interpretation = discoveryInterpretationUUID;
                }
            }
            if (lastGeneNoteUUID && sendToProjectStore[lastGeneNoteUUID]) {
                if (!isGeneNoteSavedToProject) {
                    payload.save_to_project_notes.gene_notes = lastGeneNoteUUID;
                }
            }
            if (lastVariantNoteUUID && sendToProjectStore[lastVariantNoteUUID]) {
                if (!isVariantNoteSavedToProject) {
                    payload.save_to_project_notes.variant_notes = lastVariantNoteUUID;
                }
            }

            if (Object.keys(payload.save_to_project_notes).length > 0) {
                payloads.push([
                    variantSampleAtID + "@@update-project-notes/",
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




class SaveNotesToReportButton extends React.PureComponent {

    static buildPatchPayloads (
        existingReportVariantSamples,
        vslVariantSampleItems,
        reportUUID,
        sendToReportStore = {}
    ) {
        const notePayloads = [];                        // [ [path, payload], ... ]
        const reportPatchVariantSampleUUIDs = {};   // { <uuid> : true }

        existingReportVariantSamples.forEach(function({ uuid: reportVSUUID }){
            // Add any existing variant samples first (JS objects ordered in order of insertion)
            reportPatchVariantSampleUUIDs[reportVSUUID] = true;
        });

        // Added into all Note.associated_items[] which are sent to report to identify them as being part of report.
        const newAssociatedItemEntry = { "item_type": "Report", "item_identifier": reportUUID };

        vslVariantSampleItems.forEach(function(variantSampleItem){
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
                    notePayloads.push([
                        "/" + interpretationUUID,
                        { "associated_items": [ ...interpretationAssociatedItems, newAssociatedItemEntry  ] }
                    ]);
                }
                shouldAddThisVariantSampleToReport = true;
            }
            if (discoveryInterpretationUUID && sendToReportStore[discoveryInterpretationUUID]) {
                const existingEntry = _.findWhere(discoveryInterpretationAssociatedItems, newAssociatedItemEntry);
                if (!existingEntry) {
                    notePayloads.push([
                        "/" + discoveryInterpretationUUID,
                        { "associated_items": [ ...discoveryInterpretationAssociatedItems, newAssociatedItemEntry  ] }
                    ]);
                }
                shouldAddThisVariantSampleToReport = true;
            }
            if (lastGeneNoteUUID && sendToReportStore[lastGeneNoteUUID]) {
                const existingEntry = _.findWhere(lastGeneNoteAssociatedItems, newAssociatedItemEntry);
                if (!existingEntry) {
                    notePayloads.push([
                        "/" + lastGeneNoteUUID,
                        { "associated_items": [ ...lastGeneNoteAssociatedItems, newAssociatedItemEntry  ] }
                    ]);
                }
                shouldAddThisVariantSampleToReport = true;
            }
            if (lastVariantNoteUUID && sendToReportStore[lastVariantNoteUUID]) {
                const existingEntry = _.findWhere(lastVariantNoteAssociatedItems, newAssociatedItemEntry);
                if (!existingEntry) {
                    notePayloads.push([
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

        return { notePayloads, reportVariantSampleUUIDsToPatch };
    }

    constructor(props){
        super(props);
        this.isDisabled = this.isDisabled.bind(this);
        this.handleClick = this.handleClick.bind(this);

        this.memoized = {
            selectionStoreSize: memoize(function(sendToReportStore){
                return Object.keys(sendToReportStore).length;
            }),
            variantSamplesWithAnySelections: memoize(function(variantSampleListItem, sendToReportStore){
                return countVariantSamplesWithAnySelectionSize(variantSampleListItem, sendToReportStore);
            })
        };
    }

    isDisabled() {
        const {
            fetchedReportItem,
            isLoadingVariantSampleListItem,
            sendToReportStore,
            isPatching,
            disabled: propDisabled
        } = this.props;
        const { uuid: reportUUID = null } = fetchedReportItem || {};
        const selectionStoreSize = this.memoized.selectionStoreSize(sendToReportStore);
        return propDisabled || isPatching || isLoadingVariantSampleListItem || !reportUUID || selectionStoreSize === 0 || false;
    }

    handleClick(e) {
        const {
            fetchedReportItem,
            fetchReportItem,
            variantSampleListItem,
            fetchVariantSampleListItem,
            sendToReportStore,
            patchItems
        } = this.props;

        e.stopPropagation();

        if (this.isDisabled()) {
            return false;
        }

        const {
            "@id": reportAtID,
            uuid: reportUUID = null,
            variant_samples: reportVariantSamples = [],
            structural_variant_samples: reportStructuralVariantSamples = []
        } = fetchedReportItem || {};

        const {
            variant_samples: snvVSObjects = [],
            structural_variant_samples: cnvVSObjects = []
        } = variantSampleListItem || {};


        const snvVSItems = snvVSObjects.map(function({ variant_sample_item }){
            return variant_sample_item;
        }).filter(function({ "@id": vsAtID }){
            // Filters out any VSes without view permissions, if any.
            // TODO: check actions for edit ability, perhaps.
            return !!(vsAtID);
        });

        const cnvVSItems = cnvVSObjects.map(function({ variant_sample_item }){
            return variant_sample_item;
        }).filter(function({ "@id": vsAtID }){
            return !!(vsAtID);
        });

        const {
            notePayloads: snvNotePayloads,
            reportVariantSampleUUIDsToPatch: reportSNVUUIDList
        } = SaveNotesToReportButton.buildPatchPayloads(reportVariantSamples, snvVSItems, reportUUID, sendToReportStore);
        const {
            notePayloads: cnvNotePayloads,
            reportVariantSampleUUIDsToPatch: reportCNVUUIDList
        } = SaveNotesToReportButton.buildPatchPayloads(reportStructuralVariantSamples, cnvVSItems, reportUUID, sendToReportStore);

        const allPayloads = snvNotePayloads.concat(cnvNotePayloads);
        let reportPayload = null;

        const reportSNVUUIDListLen = reportSNVUUIDList.length;
        const reportCNVUUIDListLen = reportCNVUUIDList.length;

        if (reportSNVUUIDListLen > 0) {
            if (!_.isEqual(reportSNVUUIDList, _.pluck(reportVariantSamples, "uuid"))) {
                // Skip if is same value to be patched (maybe this is 2nd saving action as result of some prior network error(s))
                reportPayload = reportPayload || {};
                reportPayload.variant_samples = reportSNVUUIDList;
            }
        }

        if (reportCNVUUIDListLen > 0) {
            if (!_.isEqual(reportCNVUUIDList, _.pluck(reportStructuralVariantSamples, "uuid"))) {
                // Skip if is same value to be patched (maybe this is 2nd saving action as result of some prior network error(s))
                reportPayload = reportPayload || {};
                reportPayload.structural_variant_samples = reportCNVUUIDList;
            }
        }

        if (reportPayload !== null) {
            allPayloads.unshift([ reportAtID, reportPayload ]);
        }

        // TODO: Consider doing PATCH to report first, and then only do Note patches once report is successfully PATCHed.

        patchItems(allPayloads, (countCompleted, patchErrors) => {
            if (countCompleted > 0) {
                if (typeof fetchVariantSampleListItem === "function") {
                    console.log("Refreshing our VariantSampleListItem with updated Note Item statuses.");
                    fetchVariantSampleListItem();
                } else {
                    throw new Error("No `props.fetchVariantSampleListItem` supplied to SaveNotesToReportButton");
                }

                if (reportPayload !== null) {
                    if (typeof fetchReportItem === "function") {
                        console.log("Refreshing our fetchedReportItem.");
                        fetchReportItem();
                    } else {
                        throw new Error("No `props.fetchReportItem` supplied to SaveNotesToReportButton");
                    }
                }
            }
            // TODO:
            // if (patchErrors.length > 0) {}
        });
    }

    render(){
        const { fetchedReportItem, sendToReportStore, className } = this.props;
        const { uuid: reportUUID = null } = fetchedReportItem || {};

        const selectionStoreSize = this.memoized.selectionStoreSize(sendToReportStore);
        const variantSamplesWithAnySelections = this.memoized.variantSamplesWithAnySelections();
        const disabled = this.isDisabled();
        const btnCls = "btn btn-" + (!reportUUID ? "outline-danger" : "primary") + (className ? " " + className : "");

        return (
            <button type="button" disabled={disabled} onClick={this.handleClick} className={btnCls}
                data-tip={`${selectionStoreSize} Note selections from ${variantSamplesWithAnySelections} Sample Variants`}>
                Save Note Selections to <span className="text-600">Report</span>
            </button>
        );
    }
}


