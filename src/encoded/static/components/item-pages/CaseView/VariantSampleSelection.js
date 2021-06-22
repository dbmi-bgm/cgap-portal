'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { variantSampleColumnExtensionMap, VariantSampleDisplayTitleColumn } from './../../browse/variantSampleColumnExtensionMap';


/**
 * @module
 * This file contains the VariantSampleSelection item, which is shared between InterpretationTab and Finalize Case tab.
 */


// Using integers here for faster comparisons.
export const parentTabTypes = {
    "INTERPRETATION": 1,
    "FINALIZECASE": 2
};


/**
 * Shows list of variant sample selections, or loading icon, depending on props.
 */
export const VariantSampleSelectionList = React.memo(function VariantSampleSelectionList (props) {
    const {
        variantSampleListItem,
        schemas,
        context,
        isLoadingVariantSampleListItem = false,
        parentTabType = parentTabTypes.INTERPRETATION,
        // From FinalizeCaseDataStore (if used):
        toggleSendToKnowledgeBaseStoreItems,
        toggleSendToReportStoreItems,
        sendToKnowledgeBaseStore,
        sendToReportStore
    } = props;
    const { variant_samples: vsSelections = [] } = variantSampleListItem || {};

    if (isLoadingVariantSampleListItem) {
        return (
            <h4 className="text-400 text-center text-muted">
                <i className="icon icon-spin icon-circle-notch icon-2x fas"/>
            </h4>
        );
    } else if (vsSelections.length === 0) {
        return (
            <h4 className="text-400">No selections added yet</h4>
        );
    } else {
        const commonProps = {
            schemas, context, parentTabType,
            toggleSendToKnowledgeBaseStoreItems,
            toggleSendToReportStoreItems,
            sendToKnowledgeBaseStore,
            sendToReportStore
        };
        return vsSelections.map(function(selectionSubObject, idx){
            return (
                <VariantSampleSelection {...commonProps}
                    selection={selectionSubObject} key={idx} index={idx} />
            );
        });
    }
});


/**
 * For now, we just re-use the column render func from some VariantSample columns
 * as value 'cells' of this card.
 */
const {
    "variant.genes.genes_most_severe_gene.display_title": { render: geneTranscriptRenderFunc },
    "variant.genes.genes_most_severe_hgvsc": { render: variantRenderFunc },
    "associated_genotype_labels.proband_genotype_label": { render: genotypeLabelRenderFunc },
} = variantSampleColumnExtensionMap;

export const VariantSampleSelection = React.memo(function VariantSampleSelection(props){
    const {
        selection,  // VariantSample Item
        index,
        context,    // Case
        schemas,
        parentTabType = parentTabTypes.INTERPRETATION,
        // From FinalizeCaseDataStore (if used):
        toggleSendToKnowledgeBaseStoreItems,
        toggleSendToReportStoreItems,
        sendToKnowledgeBaseStore,
        sendToReportStore
    } = props;
    const { accession: caseAccession } = context; // `context` refers to our Case in here.
    const {
        date_selected,
        filter_blocks_request_at_time_of_selection,
        variant_sample_item
    } = selection;


    // TODO: Consider if should just re-use state.isExpanded for "Actions" btn, expanding to show a menu..
    const [ isExpanded, setIsExpanded ] = useState(false); // Can move this state up if have pagination or infinite scroll or something in future.
    const toggleIsExpanded = useCallback(function(e){
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    }, [ isExpanded ]);

    const {
        "VariantSample": {
            columns: {
                "variant.genes.genes_most_severe_gene.display_title": {
                    title: geneTranscriptColTitle,
                    description: geneTranscriptColDescription
                } = {},
                "variant.genes.genes_most_severe_hgvsc": {
                    title: variantColTitle,
                    description: variantColDescription
                } = {},
                "associated_genotype_labels.proband_genotype_label": {
                    title: genotypeLabelColTitle,
                    description: genotypeLabelColDescription
                } = {}
            } = {}
        } = {}
    } = schemas || {};

    const {
        "@id": vsID,
        variant: { display_title: variantDisplayTitle },
        interpretation: clinicalInterpretationNote = null,
        discovery_interpretation: discoveryInterpretationNote = null,
        variant_notes: lastVariantNote = null,
        gene_notes: lastGeneNote = null
    } = variant_sample_item || {};

    const noSavedNotes = clinicalInterpretationNote === null && discoveryInterpretationNote === null && lastVariantNote === null && lastGeneNote === null;
    const { classification: acmgClassification = null } = clinicalInterpretationNote || {};
    const { gene_candidacy: geneCandidacy = null, variant_candidacy: variantCandidacy = null } = discoveryInterpretationNote || {};

    let expandedNotesSection = null;
    if (isExpanded) {
        const noteSectionProps = {
            "variantSample": variant_sample_item,
            toggleSendToKnowledgeBaseStoreItems,
            toggleSendToReportStoreItems,
            sendToKnowledgeBaseStore,
            sendToReportStore
        };
        expandedNotesSection = <VariantSampleExpandedNotes {...noteSectionProps} />;
    }

    return (
        <div className="card mb-1 variant-sample-selection" key={index}>
            <div className="card-header">
                <div className="d-flex flex-column flex-lg-row align-items-lg-center">

                    <div className="flex-auto mb-08 mb-lg-0 overflow-hidden">
                        <h4 className="text-truncate text-600 my-0 selected-vsl-title">
                            {
                                parentTabType === parentTabTypes.FINALIZECASE ?
                                    <React.Fragment>
                                        { variantDisplayTitle }
                                        { noSavedNotes ? <i className="icon icon-exclamation-triangle fas ml-12 text-muted" data-tip="No notes saved for this Sample Variant in interpretation"/> : null }
                                    </React.Fragment>
                                    : (
                                        <React.Fragment>
                                            <a href={`${vsID}?showInterpretation=True&interpretationTab=1${caseAccession ? '&caseSource=' + caseAccession : ''}`}>
                                                { variantDisplayTitle }
                                            </a>
                                            <i className="icon icon-pen fas ml-12"/>
                                        </React.Fragment>
                                    )
                            }
                        </h4>
                    </div>

                    <div className="flex-grow-1 d-none d-lg-block px-2">&nbsp;</div>

                    <div className="flex-auto">

                        { parentTabType === parentTabTypes.FINALIZECASE ?
                            <button type="button" className="btn btn-sm btn-primary" onClick={toggleIsExpanded} disabled={noSavedNotes}>
                                <i className={"icon fas mr-07 icon-" + (!isExpanded ? "plus" : "minus")} />
                                { !isExpanded ? "Review Variant Notes & Classification" : "Hide Variant Notes & Classification" }
                            </button>
                            : null }

                        { parentTabType === parentTabTypes.INTERPRETATION ?
                            <DropdownButton size="sm" variant="light" className="d-inline-block ml-07" disabled title={
                                <React.Fragment>
                                    <i className="icon icon-bars fas mr-07"/>
                                    Actions
                                </React.Fragment>
                            }>
                                TODO
                            </DropdownButton>
                            : null }

                    </div>
                </div>
            </div>

            <div className="card-body pt-0 pb-08">
                <div className="row flex-column flex-sm-row">
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small" data-tip={geneTranscriptColDescription}>
                            { geneTranscriptColTitle || "Gene, Transcript" }
                        </label>
                        { geneTranscriptRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=0&interpretationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small" data-tip={variantColDescription}>
                            { variantColTitle || "Variant" }
                        </label>
                        { variantRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-3 py-2">
                        <label className="mb-04 text-small" data-tip={genotypeLabelColDescription}>
                            { genotypeLabelColTitle || "Genotype" }
                        </label>
                        { genotypeLabelRenderFunc(variant_sample_item, { align: 'left' }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small">ACMG Classification</label>
                        { acmgClassification ?
                            <div className="w-100 text-left">
                                <i className="status-indicator-dot mr-1" data-status={acmgClassification}/>
                                {acmgClassification}
                            </div>
                            : <div className="w-100 text-left"><PlaceHolderStatusIndicator /></div> }
                    </div>
                    <div className="col col-sm-8 col-lg-3 py-2">
                        <label className="mb-04 text-small">Discovery</label>
                        <div className="w-100 text-left">
                            <span className="font-italic text-muted d-inline-block" style={{ width: "70px" }}>Gene: </span>
                            { geneCandidacy ?
                                <span className="text-left">
                                    <i className="status-indicator-dot mr-1" data-status={geneCandidacy}/>
                                    {geneCandidacy}
                                </span>
                                : <PlaceHolderStatusIndicator/> }
                        </div>
                        <div className="text-left">
                            <span className="font-italic text-muted d-inline-block" style={{ width: "70px" }}>Variant: </span>
                            { variantCandidacy ?
                                <span className="w-100 text-left">
                                    <i className="status-indicator-dot mr-1" data-status={variantCandidacy}/>
                                    {variantCandidacy}
                                </span>
                                : <PlaceHolderStatusIndicator/> }
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-body border-top attribution-section pt-1 pb-08">
                <div className="d-flex align-items-center">
                    <div className="flex-auto text-small" data-tip="Date Selected">
                        <i className="icon icon-calendar far mr-07"/>
                        <LocalizedTime timestamp={date_selected} />
                    </div>
                </div>
            </div>

            { expandedNotesSection }

        </div>
    );
});

const PlaceHolderStatusIndicator = React.memo(function PlaceHolderStatusIndicator(){
    return (
        <span className="text-left text-muted text-truncate">
            <i className="status-indicator-dot mr-1" data-status="Not Available" />
            Not Available
        </span>
    );
});


function VariantSampleExpandedNotes (props) {
    const {
        variantSample,
        toggleSendToKnowledgeBaseStoreItems,
        toggleSendToReportStoreItems,
        sendToKnowledgeBaseStore,
        sendToReportStore
    } = props;
    const {
        interpretation: clinicalInterpretationNote = null,
        discovery_interpretation: discoveryInterpretationNote = null,
        variant_notes: lastVariantNote = null, // = [],
        gene_notes: lastGeneNote = null, // = []
    } = variantSample;

    const { classification } = clinicalInterpretationNote || {};

    const { variant_candidacy, gene_candidacy } = discoveryInterpretationNote || {};

    // TODO check for view permissions?
    const noVariantNotesSaved = lastVariantNote === null;
    const noGeneNotesSaved = lastGeneNote === null;
    const noDiscoveryNoteSaved = discoveryInterpretationNote === null;
    const noClinicalNoteSaved = clinicalInterpretationNote === null;

    const allNotesToReportSelected = (
        (noVariantNotesSaved       || sendToReportStore[lastVariantNote.uuid])
        && (noGeneNotesSaved       || sendToReportStore[lastGeneNote.uuid])
        && (noDiscoveryNoteSaved   || sendToReportStore[discoveryInterpretationNote.uuid])
        && (noClinicalNoteSaved    || sendToReportStore[clinicalInterpretationNote.uuid])
    );

    const someNotesToReportSelected = (
        (!noVariantNotesSaved       && sendToReportStore[lastVariantNote.uuid])
        || (!noGeneNotesSaved       && sendToReportStore[lastGeneNote.uuid])
        || (!noDiscoveryNoteSaved   && sendToReportStore[discoveryInterpretationNote.uuid])
        || (!noClinicalNoteSaved    && sendToReportStore[clinicalInterpretationNote.uuid])
    );

    const allNotesToKnowledgeBaseSelected = (
        (noVariantNotesSaved       || sendToKnowledgeBaseStore[lastVariantNote.uuid])
        && (noGeneNotesSaved       || sendToKnowledgeBaseStore[lastGeneNote.uuid])
        && (noDiscoveryNoteSaved   || sendToKnowledgeBaseStore[discoveryInterpretationNote.uuid])
        && (noClinicalNoteSaved    || sendToKnowledgeBaseStore[clinicalInterpretationNote.uuid])
    );

    const someNotesToKnowledgeBaseSelected = (
        (!noVariantNotesSaved       && sendToKnowledgeBaseStore[lastVariantNote.uuid])
        || (!noGeneNotesSaved       && sendToKnowledgeBaseStore[lastGeneNote.uuid])
        || (!noDiscoveryNoteSaved   && sendToKnowledgeBaseStore[discoveryInterpretationNote.uuid])
        || (!noClinicalNoteSaved    && sendToKnowledgeBaseStore[clinicalInterpretationNote.uuid])
    );


    /* Common logic for selecting report and knowledgebase notes */
    function makeNoteSelectionObjects (useStore = sendToReportStore, allSelected = false) {
        const noteSelectionObjects = [];
        if (!noVariantNotesSaved) {
            if (allSelected || !useStore[lastVariantNote.uuid]) {
                // Add, will uncheck
                noteSelectionObjects.push([ lastVariantNote.uuid, true ]);
            }
        }
        if (!noGeneNotesSaved) {
            if (allSelected || !useStore[lastGeneNote.uuid]) {
                // Add, will uncheck
                noteSelectionObjects.push([ lastGeneNote.uuid, true ]);
            }
        }
        if (!noDiscoveryNoteSaved) {
            if (allSelected || !useStore[discoveryInterpretationNote.uuid]) {
                // Add, will uncheck
                noteSelectionObjects.push([ discoveryInterpretationNote.uuid, true ]);
            }
        }
        if (!noClinicalNoteSaved) {
            if (allSelected || !useStore[clinicalInterpretationNote.uuid]) {
                // Add, will uncheck
                noteSelectionObjects.push([ clinicalInterpretationNote.uuid, true ]);
            }
        }
        return noteSelectionObjects;
    }

    const onChangeSendAllNotesToReport = useCallback(function(e){
        e.stopPropagation();
        toggleSendToReportStoreItems(makeNoteSelectionObjects(sendToReportStore, allNotesToReportSelected));
    }, [ sendToReportStore, allNotesToReportSelected ]);

    const onChangeSendAllNotesToKnowledgeBase = useCallback(function(e){
        e.stopPropagation();
        toggleSendToKnowledgeBaseStoreItems(makeNoteSelectionObjects(sendToKnowledgeBaseStore, allNotesToKnowledgeBaseSelected));
    }, [ sendToKnowledgeBaseStore, allNotesToKnowledgeBaseSelected ]);

    return (
        <React.Fragment>
            <div className="card-body bg-light select-checkboxes-section border-top border-bottom">
                <Checkbox labelClassName="text-400 mb-08 no-highlight"
                    checked={!!allNotesToReportSelected}
                    onChange={onChangeSendAllNotesToReport}
                    indeterminate={someNotesToReportSelected && !allNotesToReportSelected}>
                    Send All Notes to Report
                </Checkbox>
                <Checkbox labelClassName="text-400 mb-0 no-highlight"
                    checked={!!allNotesToKnowledgeBaseSelected}
                    onChange={onChangeSendAllNotesToKnowledgeBase}
                    indeterminate={someNotesToKnowledgeBaseSelected && !allNotesToKnowledgeBaseSelected}>
                    Send All Notes to KnowledgeBase
                </Checkbox>
            </div>
            <div className="card-body notes-section pt-0">
                <div className="row">

                    <div className="col-12 col-md-6 col-lg-3 d-flex flex-column">
                        <h4 className="text-300 mt-2">Variant Notes</h4>

                        { !noVariantNotesSaved ?
                            <React.Fragment>
                                <NoteCheckboxes
                                    reportChecked={!!sendToReportStore[lastVariantNote.uuid]}
                                    kbChecked={!!sendToKnowledgeBaseStore[lastVariantNote.uuid]}
                                    onReportChange={useCallback(function(){ toggleSendToReportStoreItems([ [ lastVariantNote.uuid, true ] ]); })}
                                    onKBChange={useCallback(function(){ toggleSendToKnowledgeBaseStoreItems([ [ lastVariantNote.uuid, true ] ]); })} />
                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { lastVariantNote.note_text || <em>Note was left blank</em> }
                                    </div>
                                </div>
                            </React.Fragment>
                            : <div className="text-center py-3"><em className="text-secondary">No Variant Notes Saved</em></div> }

                    </div>

                    <div className="col-12 col-md-6 col-lg-3 d-flex flex-column">
                        <h4 className="text-300 mt-2">Gene Notes</h4>

                        { !noGeneNotesSaved ?
                            <React.Fragment>
                                <NoteCheckboxes
                                    reportChecked={!!sendToReportStore[lastGeneNote.uuid]}
                                    kbChecked={!!sendToKnowledgeBaseStore[lastGeneNote.uuid]}
                                    onReportChange={useCallback(function(){ toggleSendToReportStoreItems([ [ lastGeneNote.uuid, true ] ]); })}
                                    onKBChange={useCallback(function(){ toggleSendToKnowledgeBaseStoreItems([ [ lastGeneNote.uuid, true ] ]); })} />
                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { lastGeneNote.note_text || <em>Note was left blank</em> }
                                    </div>
                                </div>
                            </React.Fragment>
                            : <div className="text-center py-3"><em className="text-secondary">No Gene Notes Saved</em></div> }

                    </div>

                    <div className="col-12 col-md-6 col-lg-3 d-flex flex-column">
                        <h4 className="text-300 mt-2">ACMG Interpretation</h4>

                        { !noClinicalNoteSaved ?

                            <React.Fragment>
                                <NoteCheckboxes
                                    reportChecked={!!sendToReportStore[clinicalInterpretationNote.uuid]}
                                    kbChecked={!!sendToKnowledgeBaseStore[clinicalInterpretationNote.uuid]}
                                    onReportChange={useCallback(function(){ toggleSendToReportStoreItems([ [ clinicalInterpretationNote.uuid, true ] ]); })}
                                    onKBChange={useCallback(function(){ toggleSendToKnowledgeBaseStoreItems([ [ clinicalInterpretationNote.uuid, true ] ]); })} />

                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { clinicalInterpretationNote.note_text || <em>Note was left blank</em> }
                                    </div>

                                    <div className="clinical-classification flex-grow-0">
                                        <label className="mb-0 mt-08">Classification</label>
                                        <div>
                                            { classification?
                                                <React.Fragment>
                                                    <i className="status-indicator-dot ml-1 mr-1" data-status={classification} />{classification}
                                                </React.Fragment>
                                                : <em>None Defined</em> }
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                            : <div className="text-center py-3"><em className="text-secondary">No Interpretation Note Saved</em></div> }

                    </div>

                    <div className="col-12 col-md-6 col-lg-3 d-flex flex-column">
                        <h4 className="text-300 mt-2">Gene Discovery</h4>

                        { !noDiscoveryNoteSaved ?

                            <React.Fragment>
                                <NoteCheckboxes
                                    reportChecked={!!sendToReportStore[discoveryInterpretationNote.uuid]}
                                    kbChecked={!!sendToKnowledgeBaseStore[discoveryInterpretationNote.uuid]}
                                    onReportChange={ useCallback(function(){ toggleSendToReportStoreItems([ [ discoveryInterpretationNote.uuid, true ] ]); }) }
                                    onKBChange={ useCallback(function(){ toggleSendToKnowledgeBaseStoreItems([ [ discoveryInterpretationNote.uuid, true ] ]); }) } />
                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { discoveryInterpretationNote.note_text || <em className="text-secondary">Note was left blank</em> }
                                    </div>

                                    <div className="discovery-gene-candidacy flex-grow-0">
                                        <label className="mb-0 mt-08">Gene Candidacy</label>
                                        <div>
                                            { gene_candidacy ?
                                                <React.Fragment>
                                                    <i className="status-indicator-dot ml-1 mr-1" data-status={gene_candidacy} />{gene_candidacy}
                                                </React.Fragment>
                                                : <em>None Defined</em> }
                                        </div>
                                    </div>

                                    <div className="discovery-variant-candidacy flex-grow-0">
                                        <label className="mb-0 mt-08">Variant Candidacy</label>
                                        <div>
                                            { variant_candidacy ?
                                                <React.Fragment>
                                                    <i className="status-indicator-dot ml-1 mr-1" data-status={variant_candidacy} />{variant_candidacy}
                                                </React.Fragment>
                                                : <em>None Defined</em> }
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                            : <div className="text-center py-3"><em className="text-secondary">No Gene Discovery Note Saved</em></div> }

                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}

const NoteCheckboxes = React.memo(function NoteCheckboxes ({ onReportChange, onKBChange, reportChecked, kbChecked }) {
    return (
        <div className="d-flex flex-column flex-xl-row text-small">
            <Checkbox className="flex-grow-1" labelClassName="text-400 mb-0" onChange={onReportChange} checked={reportChecked}>
                Send to Report
            </Checkbox>
            <Checkbox className="flex-grow-1" labelClassName="text-400 mb-0" onChange={onKBChange} checked={kbChecked}>
                Send to KnowledgeBase
            </Checkbox>
        </div>
    );
});









export class FinalizeCaseDataStore extends React.PureComponent {

    constructor(props) {
        super(props);

        this.toggleSendToKnowledgeBaseStoreItems = this.toggleStoreItems.bind(this, "sendToKnowledgeBaseStore");
        this.toggleSendToReportStoreItems = this.toggleStoreItems.bind(this, "sendToReportStore");

        this.state = {
            // Keyed by note ID and value will contain { noteItem, vslItem } (references)
            sendToKnowledgeBaseStore: {},
            sendToReportStore: {}
        };
    }

    toggleStoreItems(storeName, noteSelectionObjects){
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
        });
    }

    render(){
        const {
            props: { children, ...passProps },
            state,
            toggleSendToKnowledgeBaseStoreItems,
            toggleSendToReportStoreItems
        } = this;
        const childProps = {
            ...passProps,
            ...state,
            toggleSendToKnowledgeBaseStoreItems,
            toggleSendToReportStoreItems
        };
        return React.Children.map(children, function(c){
            if (React.isValidElement(c)) {
                return React.cloneElement(c, childProps);
            }
            return c;
        });
    }

}








export function CaseSpecificSelectionsPanel () {
    const [ isExpanded, setIsExpanded ] = useState(false);
    const toggleExpanded = useCallback(function(e){
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    }, [ isExpanded ]);
    return (
        <div className="card mb-24">
            <div className={"card-header py-3 bg-primary-dark" + (!isExpanded ? " rounded" : "")}>
                <h4 className="text-400 my-0 d-flex align-items-center clickable text-white" onClick={toggleExpanded}>
                    <i className={"mr-1 icon fas icon-" + (isExpanded ? "minus" : "plus")}/>
                    <span>Case Specific Selections</span>
                </h4>
            </div>
            { isExpanded ?
                <div className="card-body">
                    <ACMGClassificationSelections />
                </div>
                : null }
        </div>
    );
}

function ACMGClassificationSelections () {
    return (
        <div>
            <h4 className="text-600">ACMG Classification Selections</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Move to Report</h5>
                    <ACMGClassificationSelectionsCommonCheckboxList />
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Send to KnowledgeBase</h5>
                    <ACMGClassificationSelectionsCommonCheckboxList />
                </div>
            </div>
        </div>
    );
}

function ACMGClassificationSelectionsCommonCheckboxList (props) {
    // TODO: Have a common onChange passed to all of these, using something from props (TBD) to decide its logic

    return (
        <div>
            <Checkbox>
                Pathogenic Variants
            </Checkbox>
            <Checkbox>
                Likely Pathogenic Variants
            </Checkbox>
            <Checkbox>
                VUS Variants
            </Checkbox>
            <Checkbox>
                Likely Benign Variants
            </Checkbox>
            <Checkbox>
                Benign Variants
            </Checkbox>
        </div>
    );
}

function VariantGeneSelections () {



    return (
        <div>
            <h4 className="text-600">ACMG Classification Selections</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Move to Report</h5>
                    <div>
                        <Checkbox>
                            Strong
                        </Checkbox>
                        <Checkbox>
                            Likely Pathogenic Variants
                        </Checkbox>
                        <Checkbox>
                            VUS Variants
                        </Checkbox>
                        <Checkbox>
                            Likely Benign Variants
                        </Checkbox>
                        <Checkbox>
                            Benign Variants
                        </Checkbox>
                    </div>
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Send to KnowledgeBase</h5>
                </div>
            </div>
        </div>
    );
}