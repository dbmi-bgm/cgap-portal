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
                <VariantSampleSelectionList {...commonProps} parentTabType={parentTabTypes.FINALIZECASE} />
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

    constructor(props){
        super(props);
        this.getPatchPayloadsProcess = this.getPatchPayloadsProcess.bind(this);
        this.patchItemsProcess = this.patchItemsProcess.bind(this);
        this.patchNotesStatus = this.patchNotesStatus.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onReset = this.onReset.bind(this);

        this.state = {
            "isFetching": false,
            "fetchingPercentageComplete": 0,
            "isPatching": false,
            "patchingPercentageComplete": 0,
            "patchErrors": []
        };

        this.memoized = {
            selectionStoreSize: memoize(function(selectionStore){
                return Object.keys(selectionStore).length;
            }),
            variantSamplesWithAnySelectionSize: function(variantSampleListItem, selectionStore){
                const { variant_samples: vsObjects = [] } = variantSampleListItem || {}; // Might not yet be loaded.
                let count = 0;
                vsObjects.forEach(function({ variant_sample_item }){
                    if (_.any(getAllNotesFromVariantSample(variant_sample_item), function({ uuid }){ return selectionStore[uuid]; })) {
                        count++;
                    }
                });
                return count;
            }
        };
    }

    /** @todo detect + stop process if any errors */
    getPatchPayloadsProcess(onComplete, onError){
        const {
            variantSampleListItem: { variant_samples: vsObjects = [] },
            sendToProjectStore: selectionStore
        } = this.props;

        const variantSampleItems = vsObjects.map(function({ variant_sample_item }){
            return variant_sample_item;
        }).filter(function({ "@id": vsAtID }){
            return !!(vsAtID);
        });

        let requestCount = 0;
        let requestCompletedCount = 0;

        const variantPatchPayloads = {};
        // We will merge items into here to avoid making multiple requests per each gene.
        // TODO: Consider doing this for variants as well (?)
        const genePatchPayloads = {};
        const notePatchPayloads = {};

        const checkIfCompleted = () => {
            console.log("TTT", requestCount, requestCompletedCount);
            // Check if all requests have completed, and call `onComplete` if so.
            if (requestCount === requestCompletedCount) {
                onComplete({ variantPatchPayloads, genePatchPayloads, notePatchPayloads });
            } else {
                const fetchingPercentageComplete = requestCount === 0 ? 0 : requestCompletedCount / requestCount;
                this.setState({ fetchingPercentageComplete });
            }
        };

        // TODO: Consider combining into one big /embed request to VariantSampleListItem
        variantSampleItems.forEach(function(variantSampleItem, vsIdx){
            const {
                "@id": variantSampleAtID,
                interpretation: {
                    uuid: interpretationUUID,
                    "@id": interpretationAtID,
                    status: interpretationStatus
                } = {},
                discovery_interpretation: {
                    uuid: discoveryInterpretationUUID,
                    "@id": discoveryInterpretationAtID,
                    status: discoveryInterprationStatus
                } = {},
                gene_notes: {
                    uuid: lastGeneNoteUUID,
                    "@id": lastGeneNoteAtID,
                    status: lastGeneNoteStatus
                } = {},
                variant_notes: {
                    uuid: lastVariantNoteUUID,
                    "@id": lastVariantNoteAtID,
                    status: lastVariantNoteStatus
                } = {}
            } = variantSampleItem;

            const needVariantPatch = (
                (interpretationUUID && selectionStore[interpretationUUID])
                || (discoveryInterpretationUUID && selectionStore[discoveryInterpretationUUID])
                || (lastVariantNoteUUID && selectionStore[lastVariantNoteUUID])
            );

            const needGenePatch = (
                (discoveryInterpretationUUID && selectionStore[discoveryInterpretationUUID])
                || (lastGeneNoteUUID && selectionStore[lastGeneNoteUUID])
            );

            /**
             * Re-uses variantPatchPayloads[variantAtID] (if exists) and merges into there instead of re-requesting same Item.
             *
             * @param {{ interpretations: string[], discovery_interpretations: string[], variant_notes: string[] }} variantObjRepresentation - Variant in frame=object form.
             */
            function mergeToVariantPatchPayloads(variantObjRepresentation){
                const { interpretations, discovery_interpretations, variant_notes, "@id": variantAtID } = variantObjRepresentation;
                const variantPatchPayload = variantPatchPayloads[variantAtID] || {};
                let changed = false;

                if (interpretationUUID && selectionStore[interpretationUUID]) {
                    const currList = variantPatchPayload.interpretations || interpretations || [];
                    if (currList.indexOf(interpretationAtID) === -1) {
                        changed = true;
                        currList.push(interpretationAtID);
                        variantPatchPayload.interpretations = currList;
                    }
                }

                if (discoveryInterpretationUUID && selectionStore[discoveryInterpretationUUID]) {
                    const currList = variantPatchPayload.discovery_interpretations || discovery_interpretations || [];
                    if (currList.indexOf(discoveryInterpretationAtID) === -1) {
                        changed = true;
                        currList.push(discoveryInterpretationAtID);
                        variantPatchPayload.discovery_interpretations = currList;
                    }
                }

                if (lastVariantNoteUUID && selectionStore[lastVariantNoteUUID]) {
                    const currList = variantPatchPayload.variant_notes || variant_notes || [];
                    if (currList.indexOf(lastVariantNoteAtID) === -1) {
                        changed = true;
                        currList.push(lastVariantNoteAtID);
                        variantPatchPayload.variant_notes = currList;
                    }
                }

                if (changed) {
                    // Skip PATCHing notes which don't change (i.e. duplicate entry)
                    variantPatchPayloads[variantAtID] = variantPatchPayload;
                }
            }

            function mergeToGenePatchPayloads(geneObjRepresentation){
                const { discovery_interpretations, gene_notes, "@id": geneAtID } = geneObjRepresentation;
                const genePatchPayload = genePatchPayloads[geneAtID] || {};
                let changed = false;

                if (discoveryInterpretationUUID && selectionStore[discoveryInterpretationUUID]) {
                    const currList = genePatchPayload.discovery_interpretations || discovery_interpretations || [];
                    if (currList.indexOf(discoveryInterpretationAtID) === -1) {
                        changed = true;
                        currList.push(discoveryInterpretationAtID);
                        genePatchPayload.discovery_interpretations = currList;
                    }
                }

                if (lastGeneNoteUUID && selectionStore[lastGeneNoteUUID]) {
                    const currList = genePatchPayload.gene_notes || gene_notes || [];
                    if (currList.indexOf(lastGeneNoteAtID) === -1) {
                        changed = true;
                        currList.push(lastGeneNoteAtID);
                        genePatchPayload.gene_notes = currList;
                    }
                }

                if (changed) {
                    // Skip PATCHing notes which don't change (i.e. duplicate entry)
                    genePatchPayloads[geneAtID] = genePatchPayload;
                }
            }

            if (needVariantPatch || needGenePatch) {
                requestCount++;

                const vsEmbedFetchPayload = {
                    "ids": [ variantSampleAtID ],
                    // TODO: maybe skip 2nd command and sub-embed gene on here.
                    "fields": [
                        "variant.@id",
                        "variant.interpretations",
                        "variant.discovery_interpretations",
                        "variant.variant_notes"
                    ]
                };

                if (needGenePatch) {
                    vsEmbedFetchPayload.fields.push("variant.genes.genes_most_severe_gene.@id");
                    vsEmbedFetchPayload.fields.push("variant.genes.genes_most_severe_gene.discovery_interpretations");
                    vsEmbedFetchPayload.fields.push("variant.genes.genes_most_severe_gene.gene_notes");
                }

                ajax.promise("/embed", "POST", {}, JSON.stringify(vsEmbedFetchPayload))
                    .then(function(vsEmbedList){
                        const [ vsEmbedRepresentation ] = vsEmbedList;
                        const { variant: variantObjRepresentation } =  vsEmbedRepresentation;
                        const { genes = [] } = variantObjRepresentation;

                        // Build patch payload for variant (add notes to it)
                        if (needVariantPatch) {
                            mergeToVariantPatchPayloads(variantObjRepresentation);
                        }

                        if (needGenePatch) {
                            genes.forEach(function({ genes_most_severe_gene }){
                                mergeToGenePatchPayloads(genes_most_severe_gene);
                            });
                        }

                    })
                    .finally(function(){
                        requestCompletedCount++;
                        checkIfCompleted();
                    });
            }


            if (interpretationUUID && selectionStore[interpretationUUID]) {
                if (interpretationStatus !== "current") {
                    notePatchPayloads[interpretationAtID] = { // N.B. Using @id and not uuid here.
                        "status" : "current"
                    };
                }
            }
            if (discoveryInterpretationUUID && selectionStore[discoveryInterpretationUUID]) {
                if (discoveryInterprationStatus !== "current") {
                    notePatchPayloads[discoveryInterpretationAtID] = {
                        "status" : "current"
                    };
                }
            }
            if (lastGeneNoteUUID && selectionStore[lastGeneNoteUUID]) {
                if (lastGeneNoteStatus !== "current") {
                    notePatchPayloads[lastGeneNoteAtID] = {
                        "status" : "current"
                    };
                }
            }
            if (lastVariantNoteUUID && selectionStore[lastVariantNoteUUID]) {
                if (lastVariantNoteStatus !== "current") {
                    notePatchPayloads[lastVariantNoteAtID] = {
                        "status" : "current"
                    };
                }
            }

        });

        checkIfCompleted();
    }

    patchItemsProcess(patchPayloads, onComplete) {
        const { variantPatchPayloads = {}, genePatchPayloads = {}, notePatchPayloads = {}  } = patchPayloads;
        const patchQ = [];
        Object.keys(notePatchPayloads).forEach(function(noteAtID){
            patchQ.push([ noteAtID, notePatchPayloads[noteAtID] ]);
        });
        Object.keys(variantPatchPayloads).forEach(function(variantAtID){
            patchQ.push([ variantAtID, variantPatchPayloads[variantAtID] ]);
        });
        Object.keys(genePatchPayloads).forEach(function(geneAtID){
            patchQ.push([ geneAtID, genePatchPayloads[geneAtID] ]);
        });

        const patchesToComplete = patchQ.length;
        let countCompleted = 0;

        const checkIfCompleted = () => {
            // Check if all requests have completed, and call `onComplete` if so.
            if (patchesToComplete === countCompleted) {
                onComplete({ countCompleted });
            } else {
                const patchingPercentageComplete = patchesToComplete === 0 ? 0 : countCompleted / patchesToComplete;
                this.setState({ patchingPercentageComplete });
            }
        };

        const patchErrors = [];

        // Browser can't send more than 6 reqs anyway, so limit concurrent reqs.

        function performRequest([ itemID, itemPatchPayload ]) {
            return ajax.promise(itemID, "PATCH", {}, JSON.stringify(itemPatchPayload))
                .then(function(response){
                    const { status: respStatus } = response;
                    if (respStatus !== "success") {
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

    patchNotesStatus (e) {
        this.setState({ "isFetching": true }, ()=>{
            this.getPatchPayloadsProcess((payloads)=>{
                this.setState({
                    "isFetching": false,
                    "fetchingPercentageComplete": 1,
                    "isPatching": true
                }, () => {
                    console.log("Gathered PATCH payloads -", payloads);
                    this.patchItemsProcess(payloads, ({ countCompleted }) => {
                        console.info("Patching Completed, count Items PATCHed -", countCompleted);
                        this.setState({
                            "isFetching": false,
                            "fetchingPercentageComplete": 1,
                            "isPatching": true,
                            "patchingPercentageComplete": 1
                        }, () => {
                            const { fetchVariantSampleListItem, resetSendToProjectStoreItems } = this.props;
                            if (countCompleted > 0) {
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
            });
        });
    }

    onClick(evt){
        evt.stopPropagation();
        const { isFetching, isPatching } = this.state;
        if (isFetching || isPatching) {
            return false;
        }
        this.patchNotesStatus();
    }

    onReset(){
        this.setState({
            "isFetching": false,
            "fetchingPercentageComplete": 0,
            "isPatching": false,
            "patchingPercentageComplete": 0
        });
    }

    render(){
        const { sendToProjectStore, variantSampleListItem } = this.props;
        const { isFetching, isPatching, fetchingPercentageComplete, patchingPercentageComplete } = this.state;
        const selectionStoreSize = this.memoized.selectionStoreSize(sendToProjectStore);
        const variantSamplesWithAnySelectionSize = this.memoized.variantSamplesWithAnySelectionSize(variantSampleListItem, sendToProjectStore);
        const onHide = fetchingPercentageComplete === 1 && patchingPercentageComplete === 1 ? this.onReset : null;
        return (
            <React.Fragment>
                <button type="button" className="btn btn-primary" onClick={this.onClick} disabled={isFetching || isPatching || selectionStoreSize === 0}
                    data-tip={`${selectionStoreSize} Note selections from ${variantSamplesWithAnySelectionSize} Sample Variants`}>
                    Share Note Selections to <span className="text-600">Project</span>
                </button>
                { isFetching || isPatching ?
                    <ProgressModal {...{ fetchingPercentageComplete, isFetching, isPatching, patchingPercentageComplete, onHide }} />
                    : null }
            </React.Fragment>
        );
    }
}

const ProgressModal = React.memo(function ProgressModal (props) {
    const { isFetching, isPatching, fetchingPercentageComplete, patchingPercentageComplete, onHide } = props;

    const weightedValue = (fetchingPercentageComplete || 0) * 0.25 + (patchingPercentageComplete || 0) * 0.75;
    const percentCompleteFormatted = Math.round(weightedValue * 1000) / 10;
    const finished = fetchingPercentageComplete === 1 && patchingPercentageComplete === 1;

    let body;
    if (isFetching) {
        body = "Generating data to send...";
    } else if (finished) {
        body = "Done";
    } else if (isPatching) {
        body = "Updating database...";
    }

    return (
        <Modal show onHide={onHide}>
            <Modal.Header closeButton={!!onHide}>
                <Modal.Title>{ finished ? "Updating Complete" : "Please wait..." }</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="text-center mb-1">{ body }</p>
                <div className="progress">
                    <div className="progress-bar" role="progressbar" style={{ "width": percentCompleteFormatted + "%" }}
                        aria-valuenow={percentCompleteFormatted} aria-valuemin="0" aria-valuemax="100"/>
                </div>
                { onHide?
                    <button type="button" className="mt-24 btn btn-block btn-primary" onClick={onHide}>
                        Close
                    </button>
                    : null }
            </Modal.Body>
        </Modal>
    );
});
