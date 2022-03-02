'use strict';

import React from 'react';
import _ from 'underscore';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { getAllNotesFromVariantSample } from './../variant-sample-selection-panels';




export class SaveFindingsButton extends React.Component {

    constructor(props){
        super(props);
        this.onClick = this.onClick.bind(this);
        this.createPayload = this.createPayload.bind(this);
    }

    createPayload(vsObject){
        const { changedClassificationsByVS, alreadyInReportNotes } = this.props;
        const { variant_sample_item } = vsObject;
        const {
            "@id": vsAtID,
            uuid: vsUUID,
        } = variant_sample_item;
        const { [vsUUID]: classificationToSaveForVS = undefined } = changedClassificationsByVS;

        const allNotes = getAllNotesFromVariantSample(variant_sample_item);
        const viewPermissionForAllNotes = _.all(allNotes, function({ uuid }){ return !!(uuid); });
        const anySavedToReportNotes = _.any(allNotes, function({ uuid: noteUUID }){
            return noteUUID && alreadyInReportNotes[noteUUID];
        });

        if (!vsAtID) {
            // Filter out any VSes without view permissions, if any.
            // TODO: check actions for edit ability, perhaps.
            return;
        }

        if (classificationToSaveForVS === undefined) {
            // Preserve if === null, which means to delete the value.
            return;
        }

        let removeFromReport;
        let addToReport;
        const payload = [ vsAtID, {} ];
        if (classificationToSaveForVS === null) {
            payload[0] += "?delete_fields=finding_table_tag";
            if (!anySavedToReportNotes && viewPermissionForAllNotes) {
                // Be extra careful to not remove any VSes, e.g. due to some permissions err
                // or similar.
                removeFromReport = vsUUID;
                console.log("removeFromReport vsUUID", vsUUID, removeFromReport);
            }
        } else {
            payload[1].finding_table_tag = classificationToSaveForVS;
            if (!anySavedToReportNotes) {
                addToReport = vsUUID;
                console.log("addToReport vsUUID", vsUUID, addToReport);
            }
        }

        return { payload, removeFromReport, addToReport };
    }

    onClick(e){
        e.stopPropagation();
        const {
            patchItems,
            changedClassificationsCount,
            variantSampleListItem,
            fetchVariantSampleListItem,
            isLoadingVariantSampleListItem,
            disabled: propDisabled,
            fetchedReportItem,
            fetchReportItem
        } = this.props;

        if (propDisabled || !fetchedReportItem || isLoadingVariantSampleListItem || changedClassificationsCount === 0) {
            return false;
        }

        const { variant_samples: vsObjects = [] } = variantSampleListItem || {};

        const snvPayloads = []; // [ [path, payload], ... ]
        const cnvPayloads = [];

        const vsItemsToAddToReport = [];
        const vsItemsToRemoveFromReport = [];
        const cnvItemsToAddToReport = [];
        const cnvItemsToRemoveFromReport = [];

        console.log("typeof", typeof this.createPayload);

        vsObjects.forEach((vs) => {
            console.log("vs", vs, typeof this.createPayload);
            const payloadInfo = this.createPayload(vs);
            const { payload, removeFromReport = false, addToReport = false } = payloadInfo || {};
            if (payload){ snvPayloads.push(payload); }

            console.log("removeFromReport", removeFromReport);
            console.log("addToReport", addToReport);
            if (removeFromReport) { vsItemsToRemoveFromReport.push(removeFromReport); }
            if (addToReport) { vsItemsToAddToReport.push(addToReport);}
        });

        console.log("snvPayloads before adjustment", snvPayloads);
        const shouldAdjustReportVariantSamples = vsItemsToAddToReport.length > 0 || vsItemsToRemoveFromReport.length > 0;

        if (shouldAdjustReportVariantSamples) {
            const { "@id": reportAtID, variant_samples: reportVariantSamples = [] } = fetchedReportItem;
            const nextVariantSampleUUIDs = _.union(
                _.without(
                    _.pluck(reportVariantSamples, "uuid"),
                    ...vsItemsToRemoveFromReport
                ),
                vsItemsToAddToReport
            );
            snvPayloads.unshift([ reportAtID, { "variant_samples": nextVariantSampleUUIDs } ]);
        }

        console.log("snvPayloads after adjustment", snvPayloads);

        patchItems(snvPayloads, (countCompleted, patchErrors) => {
            if (countCompleted > 0) {
                // We don't need to call updateClassificationForVS(...) here, since
                // changedClassificationsByVS will be updated in CaseReviewController componentDidUpdate.
                if (typeof fetchVariantSampleListItem === "function") {
                    console.log("Refreshing our VariantSampleListItem with updated Note Item statuses.");
                    fetchVariantSampleListItem();
                } else {
                    throw new Error("No `props.fetchVariantSampleListItem` supplied to SaveFindingsButton");
                }

                if (shouldAdjustReportVariantSamples) {
                    if (typeof fetchReportItem === "function") {
                        console.log("Refreshing our fetchedReportItem.");
                        fetchReportItem();
                    } else {
                        throw new Error("No `props.fetchReportItem` supplied to SaveFindingsButton");
                    }
                }
            }
            // TODO:
            // if (patchErrors.length > 0) {}
        });
    }

    render(){
        const { changedClassificationsCount, isLoadingVariantSampleListItem, disabled: propDisabled, className, fetchedReportItem } = this.props;

        const disabled = propDisabled || !fetchedReportItem || isLoadingVariantSampleListItem || changedClassificationsCount === 0;

        const applyFindingsTagsBtnText = (
            `Save ${changedClassificationsCount > 0 ? changedClassificationsCount + " " : ""}Finding${changedClassificationsCount !== 1 ? "s" : ""}`
        );

        return (
            <button type="button" disabled={disabled} onClick={this.onClick}
                className={"btn btn-primary" + (className ? " " + className : "")}>
                { applyFindingsTagsBtnText }
            </button>
        );

    }
}
