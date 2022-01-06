'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';

import { navigateChildWindow } from './../components/child-window-reuser';
import { variantSampleColumnExtensionMap } from './../../browse/variantSampleColumnExtensionMap';
import { getAllNotesFromVariantSample } from './variant-sample-selection-panels';

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
        alreadyInReportNotes,
        // savedClassificationsByVS,
        changedClassificationsByVS,
        updateClassificationForVS,

        // From CaseReviewSelectedNotesStore (if used, else undefined):
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
    }

    const commonProps = {
        schemas, context, parentTabType,
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore,
        alreadyInProjectNotes,
        alreadyInReportNotes,
        tableTagsByID,
        updateClassificationForVS,
        toggleVariantSampleSelectionDeletion,
        anyUnsavedChanges
    };

    return vsSelections.map(function(selection, index){
        const { variant_sample_item: { "@id": vsAtID, uuid: vsUUID } = {} } = selection;
        if (!vsAtID) {
            // Handle lack of permissions, show some 'no permissions' view, idk..
            return (
                <div className="text-center p-3">
                    <em>Item with no view permissions</em>
                </div>
            );
        }
        const unsavedClassification = changedClassificationsByVS ? changedClassificationsByVS[vsUUID] : undefined;
        const isDeleted = deletedVariantSampleSelections ? (deletedVariantSampleSelections[vsUUID] || false) : undefined;
        return (
            <VariantSampleSelection {...commonProps} key={vsUUID || index}
                {...{ selection, index, unsavedClassification, isDeleted }}  />
        );
    });

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
        alreadyInReportNotes,
        unsavedClassification,
        updateClassificationForVS,
        // From CaseReviewSelectedNotesStore (if used):
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore,
        tableTagsByID
    } = props;
    const {
        accession: caseAccession
    } = context; // `context` refers to our Case in here.
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

    const { countNotes, countNotesInReport, countNotesInKnowledgeBase } = useMemo(function(){
        const notes = getAllNotesFromVariantSample(variantSample);
        const countNotes = notes.length;
        let countNotesInReport = 0;
        let countNotesInKnowledgeBase = 0;
        notes.forEach(function({ uuid: noteUUID }){
            if (alreadyInReportNotes && alreadyInReportNotes[noteUUID]) {
                countNotesInReport++;
            }
            if (alreadyInProjectNotes && alreadyInProjectNotes[noteUUID]) {
                countNotesInKnowledgeBase++;
            }
        });
        return { countNotes, countNotesInReport, countNotesInKnowledgeBase };
    }, [ context, variantSample ]);

    const noSavedNotes = clinicalInterpretationNote === null && discoveryInterpretationNote === null && lastVariantNote === null && lastGeneNote === null;

    let expandedNotesSection = null;
    if (isExpanded) {
        const noteSectionProps = {
            variantSample,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
            sendToProjectStore,
            sendToReportStore,
            alreadyInProjectNotes,
            alreadyInReportNotes
        };
        expandedNotesSection = <VariantSampleExpandedNotes {...noteSectionProps} />;
    }

    return (
        <div className="card mb-16 variant-sample-selection" data-is-deleted={isDeleted} key={index}>
            <div className="card-header pr-12">
                <div className="d-flex flex-column flex-lg-row align-items-lg-center">

                    <div className="flex-auto mb-08 mb-lg-0 overflow-hidden">
                        <h4 className="text-truncate text-600 my-0 selected-vsl-title">
                            { parentTabType === parentTabTypes.CASEREVIEW ?
                                <CaseReviewTabVariantSampleTitle {...{ noSavedNotes, countNotes, countNotesInReport, countNotesInKnowledgeBase, variantDisplayTitle }}/>
                                : <InterpretationTabVariantSampleTitle {...{ noSavedNotes, anyUnsavedChanges, isDeleted, vsID, variantDisplayTitle, caseAccession }} />
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
                                <button type="button" className={"btn btn-sm d-flex align-items-center btn-" + (noSavedNotes ? "outline-secondary" : isExpanded ? "primary-dark" : "primary")}
                                    onClick={toggleIsExpanded} disabled={noSavedNotes}>
                                    <i className={"icon icon-fw fas mr-06 icon-" + (!isExpanded ? "plus" : "minus")} />
                                    {/* !isExpanded ? "Review Notes & Classification" : "Hide Notes & Classification" */}
                                    Review Notes & Classification
                                </button>
                            </div>
                            : null }

                        { parentTabType === parentTabTypes.INTERPRETATION ?
                            <ActionsDropdown {...{ toggleVariantSampleSelectionDeletion, isDeleted, variantSample }} />
                            : null }

                    </div>
                </div>
            </div>

            <div className="card-body pt-04 pb-08">
                <div className="row flex-column flex-sm-row">
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small d-block" data-tip={geneTranscriptColDescription}>
                            { geneTranscriptColTitle || "Gene, Transcript" }
                        </label>
                        { geneTranscriptRenderFunc(variantSample, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=0&interpretationTab=0' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small d-block" data-tip={variantColDescription}>
                            { variantColTitle || "Variant" }
                        </label>
                        { variantRenderFunc(variantSample, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=1&interpretationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-3 py-2">
                        <label className="mb-04 text-small d-block" data-tip={genotypeLabelColDescription}>
                            { genotypeLabelColTitle || "Genotype" }
                        </label>
                        { genotypeLabelRenderFunc(variantSample, { align: 'left' }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small d-block">ACMG Classification</label>
                        <ACMGClassificationColumn clinicalInterpretationNote={clinicalInterpretationNote} />
                    </div>
                    <div className="col col-sm-8 col-lg-3 py-2">
                        <label className="mb-04 text-small d-block">Discovery</label>
                        <DiscoveryCandidacyColumn discoveryInterpretationNote={discoveryInterpretationNote} />
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

export const ACMGClassificationColumn = React.memo(function ACMGClassificationColumn ({ clinicalInterpretationNote, showIcon = true }) {
    const { classification: acmgClassification = null } = clinicalInterpretationNote || {};
    if (!acmgClassification) {
        return <PlaceHolderStatusIndicator showIcon={showIcon} />;
    }
    return (
        <React.Fragment>
            { showIcon ? <i className="status-indicator-dot mr-1" data-status={acmgClassification}/> : null }
            { acmgClassification }
        </React.Fragment>
    );
});

export const DiscoveryCandidacyColumn = React.memo(function DiscoveryCandidacyColumn ({ discoveryInterpretationNote, showIcon = true }) {
    const { gene_candidacy: geneCandidacy = null, variant_candidacy: variantCandidacy = null } = discoveryInterpretationNote || {};
    const labelStyle = useMemo(function(){ return { "width" : 70 }; }); // Don't create new object reference each re-render
    return (
        <React.Fragment>
            <div className="text-left">
                <span className="font-italic text-muted d-inline-block" style={labelStyle}>Gene: </span>
                { geneCandidacy ?
                    <span className="text-left">
                        <i className="status-indicator-dot mr-1" data-status={geneCandidacy}/>
                        { geneCandidacy }
                    </span>
                    : <PlaceHolderStatusIndicator showIcon={showIcon} /> }
            </div>
            <div className="text-left">
                <span className="font-italic text-muted d-inline-block" style={labelStyle}>Variant: </span>
                { variantCandidacy ?
                    <span className="w-100 text-left">
                        { showIcon ? <i className="status-indicator-dot mr-1" data-status={variantCandidacy}/> : null }
                        { variantCandidacy }
                    </span>
                    : <PlaceHolderStatusIndicator showIcon={showIcon} /> }
            </div>
        </React.Fragment>
    );
});






function InterpretationTabVariantSampleTitle(props){
    const { noSavedNotes, anyUnsavedChanges, isDeleted, vsID, variantDisplayTitle, caseAccession } = props;

    const targetHref = vsID + "?showInterpretation=True&interpretationTab=1" + (caseAccession ? '&caseSource=' + caseAccession : '');
    const onVSTitleClick = function(e){
        e.stopPropagation();
        e.preventDefault();
        navigateChildWindow(targetHref);
        return false;
    };

    if (anyUnsavedChanges) {
        return (
            <React.Fragment>
                <i className={`icon align-middle icon-fw title-prefix-icon icon-${isDeleted ? "trash text-danger" : "check text-success"} fas mr-12`}/>
                <span className={"text-" + (isDeleted? "muted": "secondary")}>{ variantDisplayTitle }</span>
            </React.Fragment>
        );
    } else {
        return (
            <React.Fragment>
                <i className={`icon align-middle icon-fw title-prefix-icon icon-${noSavedNotes ? "pen" : "sticky-note"} fas mr-12`}
                    data-tip={noSavedNotes ? "This sample has no annotations yet" : "This sample has at least one annotation saved"}/>
                <a href={targetHref} onClick={onVSTitleClick}>
                    { variantDisplayTitle }
                </a>
            </React.Fragment>
        );
    }
}

const CaseReviewTabVariantSampleTitle = React.memo(function CaseReviewTabVariantSampleTitle(props){
    const { noSavedNotes, countNotes, countNotesInReport, countNotesInKnowledgeBase, variantDisplayTitle } = props;
    return (
        <React.Fragment>
            <i className={
                "icon align-middle icon-fw title-prefix-icon fas mr-12 icon-"
                + (noSavedNotes ? "exclamation-triangle text-warning"
                    : countNotesInReport > 0 ? "file-alt text-secondary"
                        : "minus-circle text-secondary")
            } data-tip={
                noSavedNotes ? "No notes saved for this Sample Variant, annotate it under the Interpretation tab."
                    : `This sample has <b>${countNotesInReport}</b> (of ${countNotes}) note${countNotesInReport === 1 ? "" : "s"} saved to the report`
                        + (countNotesInReport === 0 ? " and thus will be <b>excluded from report</b> entirely." : ".")
            } data-html />
            <span className="text-secondary">{ variantDisplayTitle }</span>
            { countNotesInKnowledgeBase > 0 ?
                <i className="icon align-middle icon-fw icon-database fas ml-12 text-muted" data-html
                    data-tip={`This sample has <b>${countNotesInKnowledgeBase}</b> (of ${countNotesInReport}) note${countNotesInKnowledgeBase === 1 ? "" : "s"} which have been saved to project.`}/>
                : null }
        </React.Fragment>
    );
});


const ActionsDropdown = React.memo(function ActionsDropdown(props){
    const { toggleVariantSampleSelectionDeletion, variantSample, isDeleted } = props;
    const { uuid: vsUUID } = variantSample;

    const onSelect = useCallback(function(evtKey, e){
        if (evtKey === "delete") {
            toggleVariantSampleSelectionDeletion(vsUUID);
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
                <i className={"icon mr-08 icon-fw fas icon-" + (isDeleted ? "trash-restore" : "trash")} />
                { isDeleted ? "Unmark from deletion" : "Mark for deletion" }
            </DropdownItem>
        </DropdownButton>
    );
});


function ClassificationDropdown(props){
    const { variantSample, tableTagsByID, unsavedClassification = undefined, updateClassificationForVS } = props;
    const {
        finding_table_tag: savedClassification = null,
        uuid: vsUUID,
        actions: vsActions = []
    } = variantSample || {};

    const isUnsavedClassification = typeof unsavedClassification !== "undefined"; // `null` means explicitly removed
    const viewClassification = isUnsavedClassification ? unsavedClassification : savedClassification;

    // projectReportSettings will eventually be passed down in from CaseView or similar place that AJAXes it in.
    const { table_tags: { tags = [] } = {} } = projectReportSettings;

    const onOptionSelect = useCallback(function(evtKey, evt){
        console.log("Selected classification", evtKey, "for", vsUUID);
        updateClassificationForVS(vsUUID, evtKey || null);
    }, [ variantSample, updateClassificationForVS ]);

    const renderedOptions = [];

    const haveEditPermission = useMemo(function(){
        return !!(_.findWhere(vsActions, { "name" : "edit" }));
    }, [ variantSample ]);

    if (haveEditPermission) {
        tags.forEach(function(tagObj, idx){
            const { id: classificationID, title } = tagObj;
            const existingSavedOption = (savedClassification === classificationID);
            const active = (viewClassification && viewClassification === classificationID);
            renderedOptions.push(
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
    }

    const unsavedIndicator = (
        <i className="icon icon-asterisk fas mr-06 text-danger text-smaller"
            data-delay={500} data-tip="Not yet saved, click 'Update Findings' to apply."/>
    );

    const title = (
        !viewClassification || unsavedClassification === null ?
            <React.Fragment>
                { isUnsavedClassification ? unsavedIndicator : null }
                <span className="text-300">
                    Not a finding
                </span>
            </React.Fragment>
            : (
                (tableTagsByID[viewClassification] && (
                    <React.Fragment>
                        { isUnsavedClassification ? unsavedIndicator : null }
                        <span>
                            { tableTagsByID[viewClassification].title || viewClassification }
                        </span>
                    </React.Fragment>
                ))
            ) || <em>Unknown or deprecated `{viewClassification}`</em>
    );



    // Right now we allow to select 1 tag per VS, but could support multiple theoretically later on.

    return (
        <div className="py-1 py-lg-0 pr-lg-12">
            <DropdownButton size="sm" variant="outline-dark d-flex align-items-center" menuAlign="right" title={title} onSelect={onOptionSelect}
                disabled={!haveEditPermission || tags.length === 0}
                data-delay={500} data-tip={!viewClassification? "Select a finding..." : null }>
                { renderedOptions }
            </DropdownButton>
        </div>
    );
}



const PlaceHolderStatusIndicator = React.memo(function PlaceHolderStatusIndicator({ showIcon = true }){
    return (
        <span className="text-left text-muted text-truncate">
            { showIcon ? <i className="status-indicator-dot mr-1" data-status="Not Available" /> : null }
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
        alreadyInProjectNotes,
        alreadyInReportNotes
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

    const allNotesToReportAlreadyStored = (
        (noVariantNotesSaved       || alreadyInReportNotes[lastVariantNoteUUID])
        && (noGeneNotesSaved       || alreadyInReportNotes[lastGeneNoteUUID])
        && (noDiscoveryNoteSaved   || alreadyInReportNotes[discoveryInterpretationNoteUUID])
        && (noClinicalNoteSaved    || alreadyInReportNotes[clinicalInterpretationNoteUUID])
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
                        disabled={allNotesToReportAlreadyStored}
                        checked={!!allNotesToReportSelected || allNotesToReportAlreadyStored}
                        onChange={onChangeSendAllNotesToReport}
                        indeterminate={someNotesToReportSelected && !allNotesToReportSelected && !allNotesToReportAlreadyStored}>
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
                                    reportAlreadyStored={alreadyInReportNotes[lastVariantNoteUUID]}
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
                                    reportAlreadyStored={alreadyInReportNotes[lastGeneNoteUUID]}
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
                                    reportAlreadyStored={alreadyInReportNotes[clinicalInterpretationNoteUUID]}
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
                                    reportAlreadyStored={alreadyInReportNotes[discoveryInterpretationNoteUUID]}
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

const NoteCheckboxes = React.memo(function NoteCheckboxes ({ onReportChange, onKBChange, reportChecked, reportAlreadyStored, kbChecked, kbAlreadyStored }) {
    return (
        <div className="d-flex flex-column flex-xl-row text-small">
            <Checkbox className="flex-grow-1" labelClassName="mb-0" onChange={reportAlreadyStored ? null : onReportChange}
                checked={reportAlreadyStored || reportChecked} disabled={reportAlreadyStored}>
                Send to Report
            </Checkbox>
            <Checkbox className="flex-grow-1" labelClassName="mb-0" onChange={kbAlreadyStored ? null : onKBChange}
                checked={kbAlreadyStored || kbChecked} disabled={kbAlreadyStored}>
                Save to Project
            </Checkbox>
        </div>
    );
});


