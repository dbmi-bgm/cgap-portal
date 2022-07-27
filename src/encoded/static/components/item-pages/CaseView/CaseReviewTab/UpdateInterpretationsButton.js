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



export class UpdateInterpretationsButton extends React.Component {

    /**
     * @param {{ "@id": string }[]} existingReportVariantSamples - Report.variant_samples or Report.structural_variant_samples
     * @param {{ "@id": string }} vslVariantSampleItems - `variant_sample_item` from VariantSampleList.variant_samples or VariantSampleList.structural_variant_samples
     * @param {string} reportUUID - Current Report UUID to be assigned to Note.associated_items
     * @param {Object<string, boolean>} sendToReportStore - Dictionary of Note UUIDs to be saved to report.
     */
    static buildSaveToReportPatchPayloads (
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
        // TODO: Delete existing entry if any exists? Currently less of an issue since can't remove from Report..
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
        this.saveNotesToProject = this.saveNotesToProject.bind(this);
        this.handleClick = this.handleClick.bind(this);

        this.memoized = {
            saveToProjectSelectionStoreSize: memoize(function(sendToProjectStore){
                return Object.keys(sendToProjectStore).length;
            }),
            saveToProjectVariantSamplesWithAnySelections: memoize(countVariantSamplesWithAnySelectionSize),
            saveToReportSelectionStoreSize: memoize(function(sendToReportStore){
                return Object.keys(sendToReportStore).length;
            }),
            saveToReportVariantSamplesWithAnySelections: memoize(countVariantSamplesWithAnySelectionSize)
        };


        this.state = {};
    }

    isDisabled(){
        const {
            variantSampleListItem,
            fetchVariantSampleListItem,
            fetchedReportItem,
            isLoadingVariantSampleListItem,
            sendToProjectStore,
            sendToReportStore,
            isPatching,
            disabled: propDisabled
        } = this.props;
        const { uuid: reportUUID = null } = fetchedReportItem || {};

        const saveToProjectSelectionStoreSize = this.memoized.saveToProjectSelectionStoreSize(sendToProjectStore);
        const saveToReportSelectionStoreSize = this.memoized.saveToReportSelectionStoreSize(sendToReportStore);

        return (
            propDisabled || isPatching || isLoadingVariantSampleListItem
            || (saveToProjectSelectionStoreSize === 0 && saveToReportSelectionStoreSize === 0)
            || false
        );
    }

    /**
     * Generates payloads for VariantSampleList /@@update-project-notes/ endpoint
     * and then PATCHes them to there.
     *
     * @todo Check if lack edit permission and make button disabled if so.
     */
    saveNotesToProject(){
        const {
            variantSampleListItem,
            fetchVariantSampleListItem,
            isLoadingVariantSampleListItem,
            sendToProjectStore,
            isPatching,
            patchItems,
            className,
            disabled: propDisabled
        } = this.props;

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
                    // Inner `if` condition is potentially redundant as we disable such notes from being selectable in first place.
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
    }

    saveNotesToReport(){
        const {
            fetchedReportItem,
            fetchReportItem,
            variantSampleListItem,
            fetchVariantSampleListItem,
            sendToReportStore,
            patchItems
        } = this.props;

        const {
            "@id": reportAtID,
            uuid: reportUUID = null,
            variant_samples: reportVariantSamples = [],
            structural_variant_samples: reportStructuralVariantSamples = []
        } = fetchedReportItem || {};

        if (!reportAtID) {
            return false;
        }

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
        } = UpdateInterpretationsButton.buildSaveToReportPatchPayloads(reportVariantSamples, snvVSItems, reportUUID, sendToReportStore);
        const {
            notePayloads: cnvNotePayloads,
            reportVariantSampleUUIDsToPatch: reportCNVUUIDList
        } = UpdateInterpretationsButton.buildSaveToReportPatchPayloads(reportStructuralVariantSamples, cnvVSItems, reportUUID, sendToReportStore);

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

    saveFindings(){

    }

    handleClick(e) {
        e.stopPropagation();

        if (this.isDisabled()) {
            return false;
        }

        // TODO: Decide if should do these all 1-by-1, all at a time, sequentially, etc..

    }

    render(){
        const {
            variantSampleListItem,
            fetchVariantSampleListItem,
            isLoadingVariantSampleListItem,
            sendToProjectStore,
            sendToReportStore,
            isPatching,
            patchItems,
            className,
            disabled: propDisabled
        } = this.props;

        const saveToProjectSelectionStoreSize = this.memoized.saveToProjectSelectionStoreSize(sendToProjectStore);
        const saveToProjectVariantSamplesWithAnySelections = this.memoized.saveToProjectVariantSamplesWithAnySelections(variantSampleListItem, sendToProjectStore);
        const saveToReportSelectionStoreSize = this.memoized.saveToReportSelectionStoreSize(sendToReportStore);
        const saveToReportVariantSamplesWithAnySelections = this.memoized.saveToReportVariantSamplesWithAnySelections(variantSampleListItem, sendToReportStore);

        const disabled = this.isDisabled();
        const dataTips = [];
        if (saveToProjectSelectionStoreSize > 0) {
            dataTips.push(`${saveToProjectSelectionStoreSize} Note selections from ${saveToProjectVariantSamplesWithAnySelections} Sample Variants`);
        }
        if (saveToReportSelectionStoreSize > 0) {
            dataTips.push(`${saveToReportSelectionStoreSize} Note selections from ${saveToReportVariantSamplesWithAnySelections} Sample Variants`);
        }
        return (
            <button type="button" disabled={disabled} className={"btn btn-primary" + (className ? " " + className : "")}
                onClick={this.saveNotesToProject}
                data-html data-tip={dataTips.join("<br/>")}>
                Save Note Selections to <span className="text-600">Project</span>
            </button>
        );
    }

}














function countVariantSamplesWithAnySelectionSize(variantSampleListItem, selectionStore){
    const {
        variant_samples: snvVSObjects = [],
        structural_variant_samples: cnvVSObjects = []
    } = variantSampleListItem || {}; // Might not yet be loaded.
    let count = 0;
    snvVSObjects.concat(cnvVSObjects).forEach(function({ variant_sample_item }){
        if (_.any(getAllNotesFromVariantSample(variant_sample_item), function({ uuid }){ return selectionStore[uuid]; })) {
            count++;
        }
    });
    return count;
}
