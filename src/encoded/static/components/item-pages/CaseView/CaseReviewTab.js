'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import Modal from 'react-bootstrap/esm/Modal';
import { VariantSampleSelectionList, parentTabTypes } from './VariantSampleSelection';
import { CaseSpecificSelectionsPanel, getAllNotesFromVariantSample, NoteSubSelectionStateController } from './variant-sample-selection-panels';
import { ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';



export const CaseReviewTab = React.memo(function CaseReviewTab (props) {
    const {
        schemas, context,
        // From VariantSampleListController
        variantSampleListItem,
        isLoadingVariantSampleListItem = false,
        fetchVariantSampleListItem,
        // From FinalizeCaseDataStore
        sendToProjectStore,
        sendToReportStore,
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        resetSendToProjectStoreItems,
        resetSendToReportStoreItems
    } = props;

    const alreadyInProjectNotes = useMemo(function(){
        return buildAlreadyStoredNoteUUIDDict(variantSampleListItem);
    }, [ variantSampleListItem ]);

    const commonProps = {
        isLoadingVariantSampleListItem, variantSampleListItem, alreadyInProjectNotes,
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
                <div>
                    {/*
                    <button type="button" className="btn btn-primary mr-05" disabled>
                        Export current 'Send to Project' selections as <span className="text-600">TSV spreadsheet</span>
                    </button>
                    */}
                    <SaveNotesToProjectButton {...{ variantSampleListItem, fetchVariantSampleListItem, resetSendToProjectStoreItems, sendToProjectStore }} />
                    <button type="button" className="btn btn-primary ml-05" disabled>
                        Send Note Selections to <span className="text-600">Report</span>
                    </button>
                    <button type="button" className="btn btn-primary ml-05" disabled>
                        View Report Draft
                    </button>
                </div>
            </div>
            <div>
                <NoteSubSelectionStateController>
                    <CaseSpecificSelectionsPanel {...commonProps} />
                </NoteSubSelectionStateController>
                <hr />
                <VariantSampleSelectionList {...commonProps} parentTabType={parentTabTypes.CASEREVIEW} />
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
function buildAlreadyStoredNoteUUIDDict(variantSampleListItem){
    const { variant_samples: vsObjects = [] } = variantSampleListItem || {}; // Might not yet be loaded.
    const dict = {};
    vsObjects.forEach(function({ variant_sample_item }){
        getAllNotesFromVariantSample(variant_sample_item).forEach(function(noteItem){
            const { uuid: noteUUID, status: noteStatus } = noteItem;
            if (noteStatus === "current") {
                dict[noteUUID] = true;
            }
        });
    });
    return dict;
}




class SaveNotesToProjectButton extends React.PureComponent {

    static variantSamplesWithAnySelectionSize(variantSampleListItem, selectionStore){
        const { variant_samples: vsObjects = [] } = variantSampleListItem || {}; // Might not yet be loaded.
        let count = 0;
        vsObjects.forEach(function({ variant_sample_item }){
            if (_.any(getAllNotesFromVariantSample(variant_sample_item), function({ uuid }){ return selectionStore[uuid]; })) {
                count++;
            }
        });
        return count;
    }

    constructor(props){
        super(props);
        this.getPatchPayloads = this.getPatchPayloads.bind(this);
        this.patchItemsProcess = this.patchItemsProcess.bind(this);
        this.patchNotesStatus = this.patchNotesStatus.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onReset = this.onReset.bind(this);

        this.state = {
            "isPatching": false,
            "patchingPercentageComplete": 0,
            "patchErrors": []
        };

        this.memoized = {
            selectionStoreSize: memoize(function(selectionStore){
                return Object.keys(selectionStore).length;
            }),
            variantSamplesWithAnySelectionSize: memoize(SaveNotesToProjectButton.variantSamplesWithAnySelectionSize)
        };
    }

    getPatchPayloads(){
        const {
            variantSampleListItem: { variant_samples: vsObjects = [] },
            sendToProjectStore: selectionStore
        } = this.props;

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

            if (interpretationUUID && selectionStore[interpretationUUID]) {
                if (interpretationStatus !== "current") {
                    // If condition is potentially redundant as we disable such notes from being selectable in first place.
                    payload.save_to_project_notes.interpretation = interpretationUUID;
                }
            }
            if (discoveryInterpretationUUID && selectionStore[discoveryInterpretationUUID]) {
                if (discoveryInterprationStatus !== "current") {
                    payload.save_to_project_notes.discovery_interpretation = discoveryInterpretationUUID;
                }
            }
            if (lastGeneNoteUUID && selectionStore[lastGeneNoteUUID]) {
                if (lastGeneNoteStatus !== "current") {
                    payload.save_to_project_notes.gene_notes = lastGeneNoteUUID;
                }
            }
            if (lastVariantNoteUUID && selectionStore[lastVariantNoteUUID]) {
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

        return payloads;
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
                    const { success } = response;
                    if (!success) {
                        throw response;
                    }
                }).catch(function(error){
                    // TODO display this in UI later perhaps.
                    patchErrors.push(error);
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

    patchNotesStatus(){

        this.setState({ "isPatching": true, "patchingPercentageComplete": 0 }, ()=>{

            const patchPayloads = this.getPatchPayloads();

            console.log("Generated PATCH '../@@process-notes/' payloads - ", patchPayloads);
            this.patchItemsProcess(patchPayloads, ({ countCompleted, patchErrors }) => {
                console.info("Patching Completed, count Items PATCHed -", countCompleted);
                this.setState({
                    "isPatching": true,
                    "patchingPercentageComplete": 1,
                    patchErrors
                }, () => {
                    const { fetchVariantSampleListItem, resetSendToProjectStoreItems } = this.props;
                    if (countCompleted > 0 && patchErrors.length === 0) {
                        if (typeof resetSendToProjectStoreItems === "function") {
                            console.info("Reset 'send to project' store items.");
                            resetSendToProjectStoreItems();
                        }
                        if (typeof fetchVariantSampleListItem === "function") {
                            console.info("Refreshing our VariantSampleListItem with updated Note Item statuses.");
                            fetchVariantSampleListItem();
                        }
                    }
                });
            });

        });
    }

    onClick(evt){
        evt.stopPropagation();
        const { isPatching } = this.state;
        if (isPatching) {
            return false;
        }
        this.patchNotesStatus();
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
        const { sendToProjectStore, variantSampleListItem } = this.props;
        const { isPatching, patchingPercentageComplete, patchErrors } = this.state;
        const selectionStoreSize = this.memoized.selectionStoreSize(sendToProjectStore);
        const variantSamplesWithAnySelectionSize = this.memoized.variantSamplesWithAnySelectionSize(variantSampleListItem, sendToProjectStore);
        return (
            <React.Fragment>
                <button type="button" className="btn btn-primary" onClick={this.onClick} disabled={isPatching || selectionStoreSize === 0}
                    data-tip={`${selectionStoreSize} Note selections from ${variantSamplesWithAnySelectionSize} Sample Variants`}>
                    Share Note Selections to <span className="text-600">Project</span>
                </button>
                { isPatching ?
                    <ProgressModal {...{ isPatching, patchingPercentageComplete, patchErrors }} onHide={this.onReset} />
                    : null }
            </React.Fragment>
        );
    }
}

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
