'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { variantSampleColumnExtensionMap } from './../../browse/variantSampleColumnExtensionMap';

// TEMPORARY:
import { projectReportSettings } from './../ReportView/project-settings-draft';


/**
 * @module
 * This file contains the VariantSampleSelection item, which is shared between InterpretationTab and Finalize Case tab.
 *
 * @todo
 * We will need to load in Project Item to get table tags and potentially other settings from such
 * as default sorting of VSes. We probably should do this at the CaseView/index.js level so it is accessible
 * to all elements? It could be lazy-loaded and we just render classification dropdowns once it's loaded.
 */


// Using integers here for faster comparisons.
export const parentTabTypes = {
    INTERPRETATION: 1,
    CASEREVIEW: 2
};


/**
 * Shows list of variant sample selections, or loading icon, depending on props.
 * `virtualVariantSampleListItem` takes precedence here.
 *
 * @todo Pass down a `props.updateVirtualVariantSampleListItem` function.
 */
export const VariantSampleSelectionList = React.memo(function VariantSampleSelectionList (props) {
    const {
        variantSampleListItem,
        schemas,
        context,
        isLoadingVariantSampleListItem = false,
        parentTabType = parentTabTypes.INTERPRETATION,

        // From InterpretationTab:
        toggleVariantSampleSelectionDeletion,
        deletedVariantSampleSelections,
        anyUnsavedChanges,

        // From CaseReviewTab:
        alreadyInProjectNotes,
        // savedClassificationsByVS,
        changedClassificationsByVS,
        updateClassificationForVS,

        // From CaseReviewDataStore (if used, else undefined):
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore
    } = props;

    const { variant_samples: vsSelections = [] } =  variantSampleListItem || {};

    // Used for faster lookups of current tag title.
    const tableTagsByID = useMemo(function(){
        const tableTagsByID = {};
        const {
            table_tags: {
                tags = []
            } = {}
        } = projectReportSettings;
        tags.forEach(function(tag){
            tableTagsByID[tag.id] = tag;
        });
        return tableTagsByID;
    }, [ projectReportSettings ]);

    if (vsSelections.length === 0) {
        return (
            <h4 className="text-400 text-center text-secondary py-3">
                { isLoadingVariantSampleListItem ? "Loading, please wait..." : "No selections added yet" }
            </h4>
        );
    } else {
        const commonProps = {
            schemas, context, parentTabType,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
            sendToProjectStore,
            sendToReportStore,
            alreadyInProjectNotes,
            tableTagsByID,
            updateClassificationForVS,
            toggleVariantSampleSelectionDeletion,
            anyUnsavedChanges
        };
        return vsSelections.map(function(selection, index){
            const { variant_sample_item: { "@id": vsAtID } = {} } = selection;
            if (!vsAtID) {
                // Handle lack of permissions, show some 'no permissions' view, idk..
                return (
                    <div className="text-center p-3">
                        <em>Item with no view permissions</em>
                    </div>
                );
            }
            const unsavedClassification = changedClassificationsByVS ? changedClassificationsByVS[vsAtID] : undefined;
            const isDeleted = deletedVariantSampleSelections ? (deletedVariantSampleSelections[vsAtID] || false) : undefined;
            return (
                <VariantSampleSelection {...commonProps} key={vsAtID || index}
                    {...{ selection, index, unsavedClassification, isDeleted }}  />
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
        // From InterpretationTab (if used):
        toggleVariantSampleSelectionDeletion,
        isDeleted,
        anyUnsavedChanges, // If true, then should prevent navigation to VS items as would lose changes in current view. (Unless we adjust to open in new window.)
        // From CaseReviewTab (if used):
        alreadyInProjectNotes,
        unsavedClassification,
        updateClassificationForVS,
        // From CaseReviewDataStore (if used):
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore,
        tableTagsByID
    } = props;
    const { accession: caseAccession } = context; // `context` refers to our Case in here.
    const {
        date_selected,
        filter_blocks_request_at_time_of_selection,
        variant_sample_item: variantSample
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
    } = variantSample || {};

    const noSavedNotes = clinicalInterpretationNote === null && discoveryInterpretationNote === null && lastVariantNote === null && lastGeneNote === null;
    const { classification: acmgClassification = null } = clinicalInterpretationNote || {};
    const { gene_candidacy: geneCandidacy = null, variant_candidacy: variantCandidacy = null } = discoveryInterpretationNote || {};

    let expandedNotesSection = null;
    if (isExpanded) {
        const noteSectionProps = {
            variantSample,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
            sendToProjectStore,
            sendToReportStore,
            alreadyInProjectNotes
        };
        expandedNotesSection = <VariantSampleExpandedNotes {...noteSectionProps} />;
    }

    return (
        <div className="card mb-1 variant-sample-selection" data-is-deleted={isDeleted} key={index}>
            <div className="card-header">
                <div className="d-flex flex-column flex-lg-row align-items-lg-center">

                    <div className="flex-auto mb-08 mb-lg-0 overflow-hidden">
                        <h4 className="text-truncate text-600 my-0 selected-vsl-title">
                            {
                                parentTabType === parentTabTypes.CASEREVIEW ?
                                    <React.Fragment>
                                        { variantDisplayTitle }
                                        { noSavedNotes ? <i className="icon icon-exclamation-triangle fas ml-12 text-warning" data-tip="No notes saved for this Sample Variant in interpretation"/> : null }
                                    </React.Fragment>
                                    : anyUnsavedChanges ?
                                        <React.Fragment>
                                            <i className={`icon icon-fw title-prefix-icon icon-${isDeleted ? "trash text-danger" : "check text-success"} fas mr-12`}/>
                                            <span className={"text-" + (isDeleted? "muted": "secondary")}>{ variantDisplayTitle }</span>
                                        </React.Fragment>
                                        :
                                        <React.Fragment>
                                            <i className="icon icon-fw title-prefix-icon icon-pen fas mr-12"/>
                                            <a href={`${vsID}?showInterpretation=True&interpretationTab=1${caseAccession ? '&caseSource=' + caseAccession : ''}`}>
                                                { variantDisplayTitle }
                                            </a>
                                        </React.Fragment>
                            }
                        </h4>
                    </div>

                    <div className="flex-grow-1 d-none d-lg-block px-2">
                        &nbsp;
                    </div>

                    <div className="flex-auto">

                        { parentTabType === parentTabTypes.CASEREVIEW ?
                            <div className="d-block d-lg-flex align-items-center">
                                <ClassificationDropdown {...{ variantSample, tableTagsByID, unsavedClassification, updateClassificationForVS }} />
                                <button type="button" className={"btn btn-sm btn-" + (noSavedNotes ? "outline-dark" : "primary-dark")} onClick={toggleIsExpanded} disabled={noSavedNotes}>
                                    <i className={"icon fas mr-07 icon-" + (!isExpanded ? "plus" : "minus")} />
                                    { !isExpanded ? "Review Notes & Classification" : "Hide Notes & Classification" }
                                </button>
                            </div>
                            : null }

                        { parentTabType === parentTabTypes.INTERPRETATION ?
                            <ActionsDropdown {...{ toggleVariantSampleSelectionDeletion, isDeleted, variantSample }} />
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
                        { geneTranscriptRenderFunc(variantSample, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=0&interpretationTab=0' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small" data-tip={variantColDescription}>
                            { variantColTitle || "Variant" }
                        </label>
                        { variantRenderFunc(variantSample, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=1&interpretationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-3 py-2">
                        <label className="mb-04 text-small" data-tip={genotypeLabelColDescription}>
                            { genotypeLabelColTitle || "Genotype" }
                        </label>
                        { genotypeLabelRenderFunc(variantSample, { align: 'left' }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small">ACMG Classification</label>
                        { acmgClassification ?
                            <div className="w-100 text-left">
                                <i className="status-indicator-dot mr-1" data-status={acmgClassification}/>
                                { acmgClassification }
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
                                    { geneCandidacy }
                                </span>
                                : <PlaceHolderStatusIndicator/> }
                        </div>
                        <div className="text-left">
                            <span className="font-italic text-muted d-inline-block" style={{ width: "70px" }}>Variant: </span>
                            { variantCandidacy ?
                                <span className="w-100 text-left">
                                    <i className="status-indicator-dot mr-1" data-status={variantCandidacy}/>
                                    { variantCandidacy }
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


function ActionsDropdown(props){
    const { toggleVariantSampleSelectionDeletion, variantSample, isDeleted } = props;
    const { "@id": vsAtID } = variantSample;

    const onSelect = useCallback(function(evtKey, e){
        if (evtKey === "delete") {
            toggleVariantSampleSelectionDeletion(vsAtID);
        }
    }, [ toggleVariantSampleSelectionDeletion, variantSample ]);

    return (
        <DropdownButton size="sm" variant="light" className="d-inline-block" onSelect={onSelect}
            title={
                <React.Fragment>
                    <i className="icon icon-bars fas mr-07"/>
                    Actions
                </React.Fragment>
            }>
            <DropdownItem key={0} eventKey="delete">
                { isDeleted ? "Unmark from deletion" : "Mark for deletion" }
            </DropdownItem>
        </DropdownButton>
    );
}


function ClassificationDropdown(props){
    const { variantSample, tableTagsByID, unsavedClassification = undefined, updateClassificationForVS } = props;
    const {
        finding_table_tag: savedClassification = null,
        "@id": vsAtID
    } = variantSample || {};

    const isUnsavedClassification = typeof unsavedClassification !== "undefined"; // `null` means explicitly removed
    const viewClassification = isUnsavedClassification ? unsavedClassification : savedClassification;

    // projectReportSettings will eventually be passed down in from CaseView or similar place that AJAXes it in.
    const { table_tags: { tags = [] } = {} } = projectReportSettings;

    const onOptionSelect = useCallback(function(evtKey, evt){
        console.log("Selected classification", evtKey, "for", vsAtID);
        updateClassificationForVS(vsAtID, evtKey || null);
    }, [ variantSample, updateClassificationForVS ]);

    const renderedOptions = tags.map(function(tagObj, idx){
        const { id: classificationID, title } = tagObj;
        const existingSavedOption = (savedClassification === classificationID);
        const active = (viewClassification && viewClassification === classificationID);
        return (
            <DropdownItem key={idx} eventKey={classificationID} active={active}
                className={existingSavedOption && !active ? "bg-light text-600" : null}>
                { title }
            </DropdownItem>
        );
    });

    renderedOptions.push(<div className="dropdown-divider"/>);
    renderedOptions.push(
        <DropdownItem key="none" eventKey={null} active={!viewClassification}
            className={!savedClassification && viewClassification ? "bg-light text-600" : null}>
            <em>None</em>
        </DropdownItem>
    );

    const unsavedIndicator = (
        <i className="icon icon-asterisk fas mr-06 text-danger text-smaller"
            data-delay={500} data-tip="Not yet saved, click 'Update Findings' to apply."/>
    );

    const title = (
        !viewClassification || unsavedClassification === null ?
            <span className="text-300">
                { isUnsavedClassification ? unsavedIndicator : null }
                Not a finding
            </span>
            : (
                (tableTagsByID[viewClassification] && (
                    <span>
                        { isUnsavedClassification ? unsavedIndicator : null }
                        { tableTagsByID[viewClassification].title || viewClassification }
                    </span>
                ))
            ) || <em>Unknown or deprecated `{viewClassification}`</em>
    );



    // Right now we allow to select 1 tag per VS, but could support multiple theoretically later on.

    return (
        <div className="py-1 py-lg-0 px-lg-2">
            <DropdownButton size="sm" variant="outline-dark" title={title} onSelect={onOptionSelect} disabled={tags.length === 0}
                data-delay={500} data-tip={!viewClassification? "Select a finding..." : null }>
                { renderedOptions }
            </DropdownButton>
        </div>
    );
}



const PlaceHolderStatusIndicator = React.memo(function PlaceHolderStatusIndicator(){
    return (
        <span className="text-left text-muted text-truncate">
            <i className="status-indicator-dot mr-1" data-status="Not Available" />
            Not Available
        </span>
    );
});


const VariantSampleExpandedNotes = React.memo(function VariantSampleExpandedNotes (props) {
    const {
        variantSample,
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore,
        alreadyInProjectNotes
    } = props;
    const {
        interpretation: {
            uuid: clinicalInterpretationNoteUUID = null,
            // status: clinicalInterpretationNoteStatus,
            note_text: clinicalInterpretationNoteText,
            classification
        } = {},
        discovery_interpretation: {
            uuid: discoveryInterpretationNoteUUID = null,
            // status: discoveryInterpretationNoteStatus,
            note_text: discoveryInterpretationNoteText,
            variant_candidacy,
            gene_candidacy
        } = {},
        variant_notes: {
            uuid: lastVariantNoteUUID = null,
            note_text: lastVariantNoteText
            // status: lastVariantNoteStatus
        } = {},
        gene_notes: {
            uuid: lastGeneNoteUUID = null,
            note_text: lastGeneNoteText
            // status: lastGeneNoteStatus
        } = {}
    } = variantSample;

    // TODO check for view permissions?
    const noVariantNotesSaved = lastVariantNoteUUID === null;
    const noGeneNotesSaved = lastGeneNoteUUID === null;
    const noDiscoveryNoteSaved = discoveryInterpretationNoteUUID === null;
    const noClinicalNoteSaved = clinicalInterpretationNoteUUID === null;


    const allNotesToReportSelected = (
        (noVariantNotesSaved       || sendToReportStore[lastVariantNoteUUID])
        && (noGeneNotesSaved       || sendToReportStore[lastGeneNoteUUID])
        && (noDiscoveryNoteSaved   || sendToReportStore[discoveryInterpretationNoteUUID])
        && (noClinicalNoteSaved    || sendToReportStore[clinicalInterpretationNoteUUID])
    );

    const someNotesToReportSelected = (
        (!noVariantNotesSaved       && sendToReportStore[lastVariantNoteUUID])
        || (!noGeneNotesSaved       && sendToReportStore[lastGeneNoteUUID])
        || (!noDiscoveryNoteSaved   && sendToReportStore[discoveryInterpretationNoteUUID])
        || (!noClinicalNoteSaved    && sendToReportStore[clinicalInterpretationNoteUUID])
    );

    const allNotesToKnowledgeBaseSelected = (
        (noVariantNotesSaved       || sendToProjectStore[lastVariantNoteUUID])
        && (noGeneNotesSaved       || sendToProjectStore[lastGeneNoteUUID])
        && (noDiscoveryNoteSaved   || sendToProjectStore[discoveryInterpretationNoteUUID])
        && (noClinicalNoteSaved    || sendToProjectStore[clinicalInterpretationNoteUUID])
    );

    const allNotesToKnowledgeBaseAlreadyStored = (
        (noVariantNotesSaved       || alreadyInProjectNotes[lastVariantNoteUUID])
        && (noGeneNotesSaved       || alreadyInProjectNotes[lastGeneNoteUUID])
        && (noDiscoveryNoteSaved   || alreadyInProjectNotes[discoveryInterpretationNoteUUID])
        && (noClinicalNoteSaved    || alreadyInProjectNotes[clinicalInterpretationNoteUUID])
    );

    const someNotesToKnowledgeBaseSelected = (
        (!noVariantNotesSaved       && sendToProjectStore[lastVariantNoteUUID])
        || (!noGeneNotesSaved       && sendToProjectStore[lastGeneNoteUUID])
        || (!noDiscoveryNoteSaved   && sendToProjectStore[discoveryInterpretationNoteUUID])
        || (!noClinicalNoteSaved    && sendToProjectStore[clinicalInterpretationNoteUUID])
    );



    /* Common logic for selecting report and knowledgebase notes */
    function makeNoteSelectionObjects (useStore = sendToReportStore, allSelected = false) {
        const noteSelectionObjects = [];
        if (!noVariantNotesSaved) {
            if (allSelected || !useStore[lastVariantNoteUUID]) {
                // Add, will uncheck
                noteSelectionObjects.push([ lastVariantNoteUUID, true ]);
            }
        }
        if (!noGeneNotesSaved) {
            if (allSelected || !useStore[lastGeneNoteUUID]) {
                // Add, will uncheck
                noteSelectionObjects.push([ lastGeneNoteUUID, true ]);
            }
        }
        if (!noDiscoveryNoteSaved) {
            if (allSelected || !useStore[discoveryInterpretationNoteUUID]) {
                // Add, will uncheck
                noteSelectionObjects.push([ discoveryInterpretationNoteUUID, true ]);
            }
        }
        if (!noClinicalNoteSaved) {
            if (allSelected || !useStore[clinicalInterpretationNoteUUID]) {
                // Add, will uncheck
                noteSelectionObjects.push([ clinicalInterpretationNoteUUID, true ]);
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
        toggleSendToProjectStoreItems(makeNoteSelectionObjects(sendToProjectStore, allNotesToKnowledgeBaseSelected));
    }, [ sendToProjectStore, allNotesToKnowledgeBaseSelected ]);

    return (
        <React.Fragment>
            <div className="card-body bg-light select-checkboxes-section border-top border-bottom">
                <div>
                    <Checkbox className="d-inline-block mb-08"
                        checked={!!allNotesToReportSelected}
                        onChange={onChangeSendAllNotesToReport}
                        indeterminate={someNotesToReportSelected && !allNotesToReportSelected}>
                        Send All Notes to Report
                    </Checkbox>
                </div>
                <div>
                    <Checkbox className="d-inline-block"
                        disabled={allNotesToKnowledgeBaseAlreadyStored}
                        checked={!!allNotesToKnowledgeBaseSelected || allNotesToKnowledgeBaseAlreadyStored}
                        onChange={onChangeSendAllNotesToKnowledgeBase}
                        indeterminate={someNotesToKnowledgeBaseSelected && !allNotesToKnowledgeBaseSelected && !allNotesToKnowledgeBaseAlreadyStored}>
                        Send All Notes to Project
                    </Checkbox>
                </div>
            </div>
            <div className="card-body notes-section pt-0">
                <div className="row">

                    <div className="col-12 col-md-6 col-lg-3 d-flex flex-column">
                        <h4 className="text-300 mt-2">Variant Notes</h4>

                        { !noVariantNotesSaved ?
                            <React.Fragment>
                                <NoteCheckboxes
                                    reportChecked={!!sendToReportStore[lastVariantNoteUUID]}
                                    kbChecked={!!sendToProjectStore[lastVariantNoteUUID]}
                                    onReportChange={useCallback(function(){ toggleSendToReportStoreItems([ [ lastVariantNoteUUID, true ] ]); })}
                                    onKBChange={useCallback(function(){ toggleSendToProjectStoreItems([ [ lastVariantNoteUUID, true ] ]); })}
                                    kbAlreadyStored={alreadyInProjectNotes[lastVariantNoteUUID]} />
                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { lastVariantNoteText || <em>Note was left blank</em> }
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
                                    reportChecked={!!sendToReportStore[lastGeneNoteUUID]}
                                    kbChecked={!!sendToProjectStore[lastGeneNoteUUID]}
                                    onReportChange={useCallback(function(){ toggleSendToReportStoreItems([ [ lastGeneNoteUUID, true ] ]); })}
                                    onKBChange={useCallback(function(){ toggleSendToProjectStoreItems([ [ lastGeneNoteUUID, true ] ]); })}
                                    kbAlreadyStored={alreadyInProjectNotes[lastGeneNoteUUID]} />
                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { lastGeneNoteText || <em>Note was left blank</em> }
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
                                    reportChecked={!!sendToReportStore[clinicalInterpretationNoteUUID]}
                                    kbChecked={!!sendToProjectStore[clinicalInterpretationNoteUUID]}
                                    onReportChange={useCallback(function(){ toggleSendToReportStoreItems([ [ clinicalInterpretationNoteUUID, true ] ]); })}
                                    onKBChange={useCallback(function(){ toggleSendToProjectStoreItems([ [ clinicalInterpretationNoteUUID, true ] ]); })}
                                    kbAlreadyStored={alreadyInProjectNotes[clinicalInterpretationNoteUUID]} />

                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { clinicalInterpretationNoteText || <em>Note was left blank</em> }
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
                                    reportChecked={!!sendToReportStore[discoveryInterpretationNoteUUID]}
                                    kbChecked={!!sendToProjectStore[discoveryInterpretationNoteUUID]}
                                    onReportChange={ useCallback(function(){ toggleSendToReportStoreItems([ [ discoveryInterpretationNoteUUID, true ] ]); }) }
                                    onKBChange={ useCallback(function(){ toggleSendToProjectStoreItems([ [ discoveryInterpretationNoteUUID, true ] ]); }) }
                                    kbAlreadyStored={alreadyInProjectNotes[discoveryInterpretationNoteUUID]} />
                                <div className="note-content-area d-flex flex-column flex-grow-1">
                                    <div className="note-text-content flex-grow-1">
                                        { discoveryInterpretationNoteText || <em className="text-secondary">Note was left blank</em> }
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
});

const NoteCheckboxes = React.memo(function NoteCheckboxes ({ onReportChange, onKBChange, reportChecked, kbChecked, kbAlreadyStored }) {
    return (
        <div className="d-flex flex-column flex-xl-row text-small">
            <Checkbox className="flex-grow-1" labelClassName="mb-0" onChange={onReportChange} checked={reportChecked}>
                Send to Report
            </Checkbox>
            <Checkbox className="flex-grow-1" labelClassName="mb-0" onChange={kbAlreadyStored ? null : onKBChange}
                checked={kbAlreadyStored || kbChecked} disabled={kbAlreadyStored}>
                Save to Project
            </Checkbox>
        </div>
    );
});






export class CaseReviewDataStore extends React.PureComponent {

    constructor(props) {
        super(props);

        this.toggleSendToProjectStoreItems = this.toggleStoreItems.bind(this, "sendToProjectStore");
        this.toggleSendToReportStoreItems = this.toggleStoreItems.bind(this, "sendToReportStore");
        this.resetSendToProjectStoreItems = this.resetStoreItems.bind(this, "sendToProjectStore");
        this.resetSendToReportStoreItems = this.resetStoreItems.bind(this, "sendToReportStore");

        this.state = {
            // Keyed by Note Item UUID and value is boolean true/false for now (can be changed)
            "sendToProjectStore": {},
            "sendToReportStore": {}
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

    resetStoreItems(storeName, callback = null) {
        this.setState({ [storeName]: {} }, callback);
    }

    render(){
        const {
            props: { children, ...passProps },
            state,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
            resetSendToProjectStoreItems,
            resetSendToReportStoreItems
        } = this;
        const childProps = {
            ...passProps,
            ...state,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
            resetSendToProjectStoreItems,
            resetSendToReportStoreItems
        };
        return React.Children.map(children, function(c){
            if (React.isValidElement(c)) {
                return React.cloneElement(c, childProps);
            }
            return c;
        });
    }

}
