'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import memoize from 'memoize-one';
import Dropdown from 'react-bootstrap/esm/Dropdown';
import Button from 'react-bootstrap/esm/Button';
import Modal from 'react-bootstrap/esm/Modal';
import ButtonGroup from 'react-bootstrap/esm/ButtonGroup';
import { console, navigate, ajax, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';


/**
 * Stores and manages global note state for interpretation space. Handles AJAX
 * requests for posting and patching notes.
 */
export class InterpretationSpaceWrapper extends React.Component {
    /**
     * Crawls context to find the most recently saved notes (the ones attached to the current VS)
     * and returns an object to use to initialize state.
     * returns {
     *      "variant_notes": <note_obj>,
     *      "gene_notes": <note obj>,
     *      "interpretation": <note obj>,
     *      "loading": false,
     *      "user": null... etc. }
     */
    static initializeNoteState(context = {}) {
        const fields = ["variant_notes", "gene_notes", "interpretation", "discovery_interpretation"];
        const newState = {};
        fields.forEach((field) => {
            const { [field]: note = null } = context;
            newState[field] = note;
        });
        newState.loading = false;
        newState.user = null;
        return newState;
    }

    /**
     * Accepts note state from GenericInterpretationPanel and returns a version cleaned for post/patch request
     * @param {Object} noteState    An object containing a map of fields & data for submission.
     * @param {String} noteType     One of "note_standard", "note_interpretation", or "note_discovery"
     * Different types of notes accept slightly different fields, and will throw errors if they receive
     * the wrong ones. The 'fieldsToClean' arrays can be updated to accomodate new fields.
     *
     * Does not edit note in-place.
     */
    static cleanUpNoteStateForPostPatch(noteState, noteType) {
        if (!noteType) {
            throw new Error ("Failed to provide noteType for note cleanup.");
        }

        // Clone note, so not editing in-place
        const cleanedNote = { ...noteState };

        const fieldsToCleanFromInterpretation = ["gene_candidacy", "variant_candidacy"];
        const fieldsToCleanFromDiscovery = ["acmg_guidelines", "conclusion", "classification"];
        const fieldsToCleanFromStandard = ["acmg_guidelines", "conclusion", "classification", "gene_candidacy", "variant_candidacy"];

        switch(noteType) {
            case "note_interpretation":
                fieldsToCleanFromInterpretation.forEach((field) => {
                    delete cleanedNote[field];
                });
                if (cleanedNote.classification === null) {
                    delete cleanedNote.classification;
                }
                break;
            case "note_standard":
                fieldsToCleanFromStandard.forEach((field) => {
                    delete cleanedNote[field];
                });
                break;
            case "note_discovery":
                fieldsToCleanFromDiscovery.forEach((field) => {
                    delete cleanedNote[field];
                });
                if (cleanedNote.gene_candidacy === null) {
                    delete cleanedNote.gene_candidacy;
                }
                if (cleanedNote.variant_candidacy === null) {
                    delete cleanedNote.variant_candidacy;
                }
                break;
            default:
                throw new Error("Failed to cleanup note of type '" + noteType + "' for submission");
        }

        return cleanedNote;
    }

    constructor(props) {
        super(props);
        console.log("InterpretationSpaceWrapper props", props);
        const { context = null } = props;
        this.state = InterpretationSpaceWrapper.initializeNoteState(context); // Ex. { variantNotes: <note linkto>, loading: false }
        this.saveAsDraft = this.saveAsDraft.bind(this);
    }

    /**
     * Can be used for creating new drafts
     * @param {Object}   note     Object with at least 'note_text' field; typically state from GenericInterpretationPanel
     * @param {String}   noteType "note_interpretation" or "note_standard"
     */
    postNewNote(note, noteType) {
        const { context: { institution = null, project = null } = {} } = this.props;
        const { '@id': institutionID } = institution || {};
        const { '@id': projectID } = project || {};

        const noteToSubmit = InterpretationSpaceWrapper.cleanUpNoteStateForPostPatch(note, noteType); // returns a cleaned clone

        noteToSubmit.institution = institutionID;
        noteToSubmit.project = projectID;

        return ajax.promise(`/${noteType}/`, 'POST', {}, JSON.stringify(noteToSubmit));
    }

    patchNewNoteToVS(noteID, saveToField) {
        const { context: { '@id': vsAtID = null } = {} } = this.props;
        return ajax.promise(vsAtID, 'PATCH', {}, JSON.stringify({ [saveToField]: noteID }));
    }

    patchPreviouslySavedNote(noteToPatch, noteType, noteID) { // ONLY USED FOR DRAFTS -- other notes are cloned
        const { interpretation = null, discovery_interpretation = null } = this.state;
        const { classification: previousClassification = null } = interpretation || {};
        const { variant_candidacy: previousVarCandidacy = null, gene_candidacy: previousGeneCandidacy = null } = discovery_interpretation || {};
        const {
            classification = null,
            variant_candidacy = null,
            gene_candidacy = null
        } = noteToPatch;

        // Returns a clone, cleaned of unneccessary state fields
        const cleanedNoteToPatch = InterpretationSpaceWrapper.cleanUpNoteStateForPostPatch(noteToPatch, noteType);

        let patchURL = noteID;

        // Check for deleted fields and add to patch URL
        switch(noteType) {
            case "note_interpretation":
                if (!classification && previousClassification) {
                    patchURL += '?delete_fields=classification';
                }
                break;
            case "note_discovery":
                if ((!variant_candidacy && previousVarCandidacy) &&
                    (!gene_candidacy && previousGeneCandidacy)) {
                    patchURL += '?delete_fields=variant_candidacy,gene_candidacy';
                } else if (!variant_candidacy && previousVarCandidacy) {
                    patchURL += '?delete_fields=variant_candidacy';
                } else if (!gene_candidacy && previousGeneCandidacy) {
                    patchURL += '?delete_fields=gene_candidacy';
                }
                break;
            default:
                break; // do nothing special for standard notes
        }
        console.log("patchURL", patchURL);

        return ajax.promise(patchURL, 'PATCH', {}, JSON.stringify(cleanedNoteToPatch));
    }

    getNote(uuid, noteType) {
        console.log("Fetching @@embedded representation of " + uuid + " with " + noteType);
        const path = `/${noteType}/${uuid}/?datastore=database`;
        return ajax.promise(path, 'GET');
    }

    saveAsDraft(note, stateFieldToUpdate, noteType = "note_standard") {
        const { [stateFieldToUpdate]: lastSavedNote } = this.state;
        const urlFormattedNoteType = noteType.split('_').join('s-');

        // Does a draft already exist?
        if (lastSavedNote) { // Patch the pre-existing draft item & overwrite it
            console.log("Note already exists... need to patch pre-existing draft", lastSavedNote);
            const { "@id": noteAtID = null, "uuid": noteUUID } = lastSavedNote;

            this.setState({ loading: true }, () => {
                this.patchPreviouslySavedNote(note, noteType, noteAtID || noteUUID)
                    .then((response) => {
                        const { '@graph': graph = [], status } = response;
                        // Some handling for various fail responses/codes
                        if (graph.length === 0 || status === "error") {
                            throw new Error(response);
                        }

                        console.log("Successfully overwritten previous draft of note", response);
                        return this.getNote(noteUUID, urlFormattedNoteType);
                    })
                    .then((noteWithEmbeds) => {
                        console.log("Successfully retrieved @@embedded representation of note", noteWithEmbeds);
                        this.setState({ loading: false, [stateFieldToUpdate]: noteWithEmbeds });
                    })
                    .catch((err) => {
                        const { error: { message = null } = {} } = err || {};
                        console.error(err);
                        Alerts.queue({
                            title: "Error: Something went wrong while patching.",
                            message: message || "Your changes may not be saved.",
                            style: "danger"
                        });
                        this.setState({ loading: false });
                    });
            });
        } else { // Create a whole new item, and patch to VS
            let newNoteID;

            this.setState({ loading: true }, () => {
                this.postNewNote(note, noteType)
                    .then((response) => {
                        const { '@graph': noteItems = [], status } = response;

                        // Some handling for various fail responses/codes
                        if (noteItems.length === 0 || status === "error") {
                            throw new Error(response);
                        }

                        const { 0: noteItem } = noteItems;
                        newNoteID = noteItem.uuid;
                        console.log("Successfully created new item", noteItem);

                        return this.patchNewNoteToVS(newNoteID, stateFieldToUpdate);
                    })
                    .then((resp) => {
                        const { '@graph': noteItem, status } = resp;

                        if (status === "error") {
                            // TODO: Check integrity of @graph
                            throw new Error(resp);
                        }
                        console.log("Successfully linked note object to variant sample", resp);

                        return this.getNote(newNoteID, urlFormattedNoteType);
                    })
                    .then((noteWithEmbeds) => {
                        console.log("Successfully retrieved @@embedded representation of note: ", noteWithEmbeds);

                        // Full representation of item fetched... add this to state
                        this.setState({ loading: false, [stateFieldToUpdate]: noteWithEmbeds });
                    })
                    .catch((err) => {
                        const { error: { message = null } = {} } = err || {};
                        console.error(err);
                        Alerts.queue({
                            title: "Error: Something went wrong while patching.",
                            message: message || "Your changes may not be saved.",
                            style: "danger"
                        });
                        this.setState({ loading: false });
                    });
            });
        }
    }

    render() {
        const { variant_notes, gene_notes, interpretation, discovery_interpretation } = this.state;
        return <InterpretationSpaceController {...this.props} lastSavedVariantNote={variant_notes}
            lastSavedGeneNote={gene_notes} lastSavedInterpretation={interpretation} lastSavedDiscovery={discovery_interpretation}
            saveAsDraft={this.saveAsDraft} />;
    }
}


/**
 * Manages tab routing, and checking for changes between notes. Also keeps a 'soft' save in state of any edits made
 * to an unsaved draft note in state so that changes are retained when switching between tabs. (This 'soft-saving' is
 * auto-triggered in GenericPanelController's ComponentWillUnmount if there are changes between last 'soft-saved' wip note
 * and the draft held in state there.)
 */
export class InterpretationSpaceController extends React.Component {

    // CurrentTab will always be a number between 0-3 and index to these values
    static tabNames = ["Gene Notes", "Variant Notes", "Clinical", "Discovery"];
    static tabTitles = ["Gene Notes", "Variant Notes", "ACMG Interpretation", "Variant/Gene Discovery"];

    static haveEditPermission(actions){
        return _.findWhere(actions, { "name" : "edit" });
    }

    static hasNoteChanged(lastSavedNote = null, currNote = null) {
        if (lastSavedNote === null && currNote === null) {
            return false;
        }

        // Manually compare classification & note text (not added to embed if not present, which can confuse _'s comparisons)
        // TODO: Figure out a way to use _.isMatch/_.isEqual for future versions. Kicking this can down the road slightly.
        const {
            classification: lastSavedClassification = null,
            gene_candidacy: lastSavedGeneCandidacy = null,
            variant_candidacy: lastSavedVariantCandidacy = null,
            note_text: lastSavedNoteText = "",
            acmg_guidelines: lastSavedACMG = []
        } = lastSavedNote || {};
        const {
            classification: currClassification = null,
            gene_candidacy: currGeneCandidacy = null,
            variant_candidacy: currVariantCandidacy = null,
            note_text: currNoteText = "",
            acmg_guidelines: currACMG = []
        } = currNote || {};

        if (currClassification !== lastSavedClassification ||
            currGeneCandidacy !== lastSavedGeneCandidacy ||
            currVariantCandidacy !== lastSavedVariantCandidacy ||
            !_.isEqual(currACMG, lastSavedACMG)
        ) {
            // console.log("classifications do not match:", currClassification, lastSavedClassification);
            console.log("acmg, classificaton, or candidacy does not match");
            return true;
        }

        if (lastSavedNoteText !== currNoteText) {
            console.log("text does not match");
            return true;
        }

        console.log("note has not changed");
        return false;
    }

    constructor(props) {
        super(props);
        const { lastSavedVariantNote, lastSavedGeneNote, lastSavedInterpretation, lastSavedDiscovery, defaultTab } = props;

        this.state = {
            // Initialize WIP states to last saved - if a tab is closed WIP progress is temporarily saved here
            variant_notes_wip: lastSavedVariantNote,
            gene_notes_wip: lastSavedGeneNote,
            interpretation_wip: lastSavedInterpretation,
            discovery_interpretation_wip: lastSavedDiscovery,
            currentTab: (defaultTab >= 0 && defaultTab < InterpretationSpaceController.tabNames.length) ? defaultTab : 0, // TODO: validate elsewhere - default to variantnotes
            isExpanded: false // TODO - currently unused; V2
        };
        this.toggleExpanded = this.toggleExpanded.bind(this);
        this.switchToTab = this.switchToTab.bind(this);
        this.retainWIPStateOnUnmount = this.retainWIPStateOnUnmount.bind(this);

        this.memoized = {
            hasNoteChanged: memoize(InterpretationSpaceController.hasNoteChanged),
            haveEditPermission: memoize(InterpretationSpaceController.haveEditPermission)
        };
    }

    retainWIPStateOnUnmount(note, state) {
        this.setState({ [state]: note });
    }

    componentDidUpdate(pastState) {
        const { currentTab } = this.state;
        if (currentTab !== pastState.currentTab){
            ReactTooltip.rebuild();
        }
    }

    toggleExpanded() { // TODO for V2
        const { isExpanded } = this.state;
        console.log("is setting fullscreen", isExpanded);
        this.setState({ isExpanded: !isExpanded });
    }

    switchToTab(newTab) {
        const { currentTab } = this.state;
        const { toggleACMGInvoker } = this.props;
        // componentWillUnmount in panel saves unsaved items before dismount completes
        if (currentTab !== newTab) {
            this.setState({ currentTab: newTab }, () => {
                if (newTab === 2) {
                    // On clinical interpretation; toggle acmg visible
                    toggleACMGInvoker();
                } else if (currentTab === 2) {
                    // Switched from clinical interpretation; toggle invisible
                    toggleACMGInvoker();
                }
            });
        }
    }

    componentWillUnmount() {
        // Failsafe to ensure setIsSubmitting is always set back to false after navigating away
        const { setIsSubmitting } = this.props;
        setIsSubmitting(false, null, false);
    }

    render() {
        const { isExpanded, currentTab, variant_notes_wip, gene_notes_wip, interpretation_wip, discovery_interpretation_wip } = this.state;
        const { lastSavedGeneNote, lastSavedInterpretation, lastSavedVariantNote, lastSavedDiscovery, context, wipACMGSelections, autoClassification, toggleInvocation } = this.props;
        const { actions = [] } = context || {};

        const passProps = _.pick(this.props, 'saveAsDraft', 'schemas', 'caseSource', 'setIsSubmitting', 'isSubmitting', 'isSubmittingModalOpen' );

        const isDraftVariantNoteUnsaved = this.memoized.hasNoteChanged(variant_notes_wip, lastSavedVariantNote);
        const isDraftGeneNoteUnsaved = this.memoized.hasNoteChanged(gene_notes_wip, lastSavedGeneNote);
        const isDraftDiscoveryUnsaved = this.memoized.hasNoteChanged(discovery_interpretation_wip, lastSavedDiscovery);

        // Add ACMG from WIP
        const interpretationWIP = { ...interpretation_wip };
        interpretationWIP["acmg_guidelines"] = wipACMGSelections;
        const isDraftInterpretationUnsaved = this.memoized.hasNoteChanged(interpretationWIP, lastSavedInterpretation);

        const hasEditPermission = this.memoized.haveEditPermission(actions);

        let panelToDisplay = null;
        switch(currentTab) {
            case (0): // Gene Notes
                panelToDisplay = (<GenericInterpretationPanel retainWIPStateOnUnmount={this.retainWIPStateOnUnmount}
                    lastWIPNote={gene_notes_wip} lastSavedNote={lastSavedGeneNote} noteLabel={InterpretationSpaceController.tabTitles[currentTab]}
                    key={1} saveToField="gene_notes" noteType="note_standard" { ...passProps }
                    memoizedHasNoteChanged={this.memoized.hasNoteChanged} {...{ hasEditPermission }}
                    otherDraftsUnsaved={isDraftInterpretationUnsaved || isDraftVariantNoteUnsaved || isDraftDiscoveryUnsaved} />
                );
                break;
            case (1): // Variant Notes
                panelToDisplay = (<GenericInterpretationPanel retainWIPStateOnUnmount={this.retainWIPStateOnUnmount}
                    lastWIPNote={variant_notes_wip} lastSavedNote={lastSavedVariantNote} noteLabel={InterpretationSpaceController.tabTitles[currentTab]}
                    key={0} saveToField="variant_notes" noteType="note_standard" { ...passProps }
                    memoizedHasNoteChanged={this.memoized.hasNoteChanged} {...{ hasEditPermission }}
                    otherDraftsUnsaved={isDraftInterpretationUnsaved || isDraftGeneNoteUnsaved || isDraftDiscoveryUnsaved} />
                );
                break;
            case (2): // Interpretation
                panelToDisplay = (<GenericInterpretationPanel retainWIPStateOnUnmount={this.retainWIPStateOnUnmount} wipACMGSelections={wipACMGSelections}
                    lastWIPNote={interpretationWIP} lastSavedNote={lastSavedInterpretation} noteLabel={InterpretationSpaceController.tabTitles[currentTab]}
                    key={2} saveToField="interpretation" noteType="note_interpretation" { ...passProps }
                    memoizedHasNoteChanged={this.memoized.hasNoteChanged} {...{ hasEditPermission, autoClassification, toggleInvocation }}
                    otherDraftsUnsaved={isDraftGeneNoteUnsaved || isDraftVariantNoteUnsaved || isDraftDiscoveryUnsaved} />
                );
                break;
            case (3): // Discovery
                panelToDisplay = (<GenericInterpretationPanel retainWIPStateOnUnmount={this.retainWIPStateOnUnmount}
                    lastWIPNote={discovery_interpretation_wip} lastSavedNote={lastSavedDiscovery} noteLabel={InterpretationSpaceController.tabTitles[currentTab]}
                    key={3} saveToField="discovery_interpretation" noteType="note_discovery" { ...passProps }
                    memoizedHasNoteChanged={this.memoized.hasNoteChanged} {...{ hasEditPermission }}
                    otherDraftsUnsaved={isDraftGeneNoteUnsaved || isDraftVariantNoteUnsaved || isDraftInterpretationUnsaved} />
                );
                break;
            default:
                break;
        }
        return (
            <div className="card interpretation-space">
                <InterpretationSpaceHeader {...{ isExpanded }} toggleExpanded={this.toggleExpanded}/>
                <div className="card-body">
                    <InterpretationSpaceTabs {...{ currentTab, isDraftDiscoveryUnsaved, isDraftGeneNoteUnsaved, isDraftVariantNoteUnsaved, isDraftInterpretationUnsaved }}
                        switchToTab={this.switchToTab} />
                    { panelToDisplay }
                </div>
            </div>
        );
    }
}

function InterpretationSpaceHeader(props) { // Expanded items commented out until V2
    const { toggleExpanded, isExpanded } = props;
    return (
        <div className="interpretation-header card-header d-flex align-items-center justify-content-between">
            <i className="icon icon-poll-h fas"></i>
            Interpretation Space
            <button type="button" className="btn btn-link" onClick={toggleExpanded || undefined} style={{ visibility: "hidden" }}>
                { isExpanded ? <i className="icon icon-compress fas"></i> : <i className="icon icon-expand fas"></i> }
            </button>
        </div>
    );
}

function InterpretationSpaceTabs(props) {
    const { currentTab, switchToTab, isDraftDiscoveryUnsaved, isDraftGeneNoteUnsaved, isDraftInterpretationUnsaved, isDraftVariantNoteUnsaved } = props;
    const tabIndexToUnsavedDraft = { 0: isDraftGeneNoteUnsaved, 1: isDraftVariantNoteUnsaved, 2: isDraftInterpretationUnsaved, 3: isDraftDiscoveryUnsaved };

    // Maybe memoize?
    const tabsRender = InterpretationSpaceController.tabNames.map((tabName, i) => {
        const isActive = currentTab === i;
        const unsavedDraft = tabIndexToUnsavedDraft[i];
        return (
            <li key={i} className={`interpretation-tab clickable d-flex align-items-center ${unsavedDraft ? 'font-italic' : ''}`}
                onClick={(e) => switchToTab(i)} data-active={isActive} data-tip={unsavedDraft ? "Unsaved changes": null}>
                {tabName}{unsavedDraft ? <span className="text-warning text-600">*</span>: ''}
            </li>);
    });

    return (
        <ul className="p-1 d-flex align-items-center justify-content-between">
            {tabsRender}
        </ul>
    );
}

class GenericInterpretationPanel extends React.Component {
    constructor(props) {
        super(props);

        const {
            note_text = "", classification = null,
            conclusion =  "", variant_candidacy = null, gene_candidacy = null
        } = props.lastWIPNote || props.lastSavedNote || {};

        this.state = {
            // Fields in form. Using snake casing to make it easier to add state data directly to post/patch request
            note_text,
            classification,
            variant_candidacy,
            gene_candidacy,
            conclusion                  // TODO: Currently Unused
        };

        this.saveStateAsDraft = this.saveStateAsDraft.bind(this);
        this.onTextChange = this.onTextChange.bind(this);
        this.onDropOptionChange = this.onDropOptionChange.bind(this);
    }

    componentDidUpdate(prevProps, prevState) {
        const { setIsSubmitting, wipACMGSelections, isSubmitting, memoizedHasNoteChanged, lastSavedNote, otherDraftsUnsaved } = this.props;

        const savedState = { ...this.state };
        savedState.acmg_guidelines = wipACMGSelections;

        const isThisNoteUnsaved = memoizedHasNoteChanged(lastSavedNote, savedState);
        const anyNotesUnsaved = otherDraftsUnsaved || isThisNoteUnsaved;

        // Only trigger if switching from no unsaved to unsaved present or vice versa
        if (!isSubmitting && anyNotesUnsaved) {
            // started submitting (warning will appear on navigate)
            setIsSubmitting({
                modal: <UnsavedInterpretationModal {...{ setIsSubmitting }}/>
            });
        } else if (isSubmitting && !anyNotesUnsaved) {
            // no longer submitting (warning will no longer appear on navigate)
            setIsSubmitting(false); // unset
        }
    }

    // Will use same update fxn for multiple text fields
    onTextChange(event, stateToChange) {
        const { value: newValue } = event.target || {};
        this.setState({ [stateToChange]: newValue });
    }

    // Using same update fxn for multiple dropdowns
    onDropOptionChange(stateToChange, newValue) {
        this.setState({ [stateToChange]: newValue });
    }

    // Wrapping passed in functions so as to call them with this component's state, then pass down to children
    saveStateAsDraft() {
        const { saveAsDraft, noteType, saveToField, wipACMGSelections } = this.props;
        const stateToSave = { ...this.state };
        stateToSave.acmg_guidelines = wipACMGSelections;
        saveAsDraft(stateToSave, saveToField, noteType);
    }

    componentWillUnmount() { // Before unmounting (as in switching tabs), save unsaved changes in controller state
        const { saveToField, retainWIPStateOnUnmount, lastWIPNote, memoizedHasNoteChanged } = this.props;

        // Only trigger if note has changed since last soft save (WIP)
        if (memoizedHasNoteChanged(lastWIPNote, this.state)) {
            // console.log("note has changed since last soft save... updating WIP");
            retainWIPStateOnUnmount(this.state, `${saveToField}_wip`);
        }
    }

    render() {
        const { lastSavedNote = null, wipACMGSelections, noteLabel, noteType, schemas, memoizedHasNoteChanged, caseSource, hasEditPermission, autoClassification, toggleInvocation } = this.props;
        const {
            status: savedNoteStatus,
            last_modified: lastModified = null
        } = lastSavedNote || {};
        const { modified_by: { display_title : lastModUsername } = {}, date_modified = null } = lastModified || {};
        const { note_text: noteText, classification, gene_candidacy, variant_candidacy, conclusion } = this.state;


        const stateToSave = { ...this.state };
        stateToSave.acmg_guidelines = wipACMGSelections;

        const noteChangedSinceLastSave = memoizedHasNoteChanged(lastSavedNote, stateToSave);
        const noteTextPresent = !!noteText;
        const isDraft = savedNoteStatus === "in review";
        const isCurrent = savedNoteStatus === "current";
        const isApproved = savedNoteStatus === "approved";
        // console.log("GenericInterpretationPanel state", stateToSave);
        // console.log("lastSavedNote", lastSavedNote);

        return (
            <div className="interpretation-panel">
                <label className={`w-100 ${lastModUsername ? "mb-0" : ""}`}>
                    { noteLabel } <span className="text-smaller font-italic text-danger text-400">(Required)</span>
                </label>
                { lastModUsername ?
                    <div className="text-muted text-smaller my-1">Last Saved: <LocalizedTime timestamp={ date_modified } formatType="date-time-md" dateTimeSeparator=" at " /> by {lastModUsername} </div>
                    : null}
                <AutoGrowTextArea cls="w-100 mb-1" text={noteText} onTextChange={this.onTextChange} field="note_text" />
                { noteType === "note_interpretation" ?
                    <GenericFieldForm fieldsArr={[{ field: 'classification', value: classification }, { field: 'acmg_guidelines', value: wipACMGSelections, autoClassification, toggleInvocation }]} {...{ schemas, noteType }} onDropOptionChange={this.onDropOptionChange}/>
                    : null }
                { noteType === "note_discovery" ?
                    <GenericFieldForm fieldsArr={[{ field: 'gene_candidacy', value: gene_candidacy }, { field: 'variant_candidacy', value: variant_candidacy }]}
                        {...{ schemas, noteType }} onDropOptionChange={this.onDropOptionChange}/>
                    : null }
                <GenericInterpretationSubmitButton {...{ hasEditPermission, isCurrent, isApproved, isDraft, noteTextPresent, noteChangedSinceLastSave }}
                    saveAsDraft={this.saveStateAsDraft}
                />
                { caseSource ?
                    <Button variant="primary btn-block mt-05" onClick={() => { navigate(`/cases/${caseSource}/#case-info.interpretation`)}}>
                        Return to Case
                    </Button>: null}
            </div>
        );
    }
}

/**
 * Generates a dropdown with options from schema enums for a particular field, w/clear button and status indicator dots.
 * Currently only used for classification, but can be used in future for variant/gene candidacy dropdowns (and maybe as a stopgap for ACMG).
 */
function NoteFieldDrop(props) {
    const { value = null, schemas = null, field = null, noteType = null, onOptionChange, cls="mb-1", getFieldProperties } = props;
    if (!schemas) {
        return null;
    }

    const fieldSchema = getFieldProperties(field);

    const { title = null, description = null, enum: static_enum = [] } = fieldSchema;

    let dropOptions;
    if (static_enum.length > 0) {
        dropOptions = static_enum.map((option) => (
            <Dropdown.Item onClick={() => onOptionChange(field, option)} key={option}>
                <i className="status-indicator-dot mr-07" data-status={option}/>{option}
            </Dropdown.Item>
        ));
    }

    return (
        <React.Fragment>
            <label className="w-100 text-small">
                { title } { description ? <i className="icon icon-info-circle fas icon-fw ml-05" data-tip={description} /> : null }
            </label>
            <div className="w-100 d-flex note-field-drop">
                <Dropdown as={ButtonGroup} className={cls}>
                    <Dropdown.Toggle variant="outline-secondary text-left" id="dropdown-basic">
                        { value ? <><i className="status-indicator-dot ml-1 mr-07" data-status={value} /> { value }</> : "Select an option..."}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>{ dropOptions }</Dropdown.Menu>
                </Dropdown>
                { value ?
                    <Button variant="danger" className={cls + ' ml-03'} onClick={() => onOptionChange(field, null)}>
                        <i className="icon icon-trash-alt fas" />
                    </Button>
                    : null}
            </div>
        </React.Fragment>
    );
}

/** Currently unused; may decide to use a static sized window & style with CSS to autogrow */
class NoGrowTextArea extends React.Component {
    constructor(props) {
        super(props);
        this.onChangeWrapper = this.onChangeWrapper.bind(this);
    }
    onChangeWrapper(e) {
        const { onTextChange, field } = this.props;
        onTextChange(e, field);
    }
    render() {
        const { text, cls = "w-100 mb-1 flex-grow-1" } = this.props;
        return (
            <div className={cls} style={{ minHeight: "135px" }}>
                <textarea value={text} ref={this.textAreaRef} rows={5} style={{ height: "100%", resize: "none", minHeight: "70px" }} className="w-100"
                    onChange={this.onChangeWrapper} />
            </div>
        );
    }
}

class AutoGrowTextArea extends React.Component {
    constructor(props) {
        super(props);

        this.state = { textAreaHeight: "100%", parentHeight: "auto" };
        this.textAreaRef = React.createRef(null);

        this.onChangeWrapper = this.onChangeWrapper.bind(this);
    }

    componentDidMount() {
        const { minHeight, maxHeight } = this.props;

        const currScrollHeight = this.textAreaRef.current.scrollHeight;
        // if (minHeight > currScrollHeight) {
        //     this.setState({
        //         parentHeight: `${minHeight}px`,
        //         textAreaHeight: `${minHeight}}px`
        //     });
        // } else {
        this.setState({
            parentHeight: `${currScrollHeight > maxHeight ? maxHeight: currScrollHeight}px`,
            textAreaHeight: `${currScrollHeight > maxHeight ? maxHeight: currScrollHeight}px`
        });
        // }
    }

    onChangeWrapper(e) {
        const { onTextChange, field, minHeight, maxHeight } = this.props;

        onTextChange(e, field);

        const currScrollHeight = this.textAreaRef.current.scrollHeight;
        // if (minHeight && minHeight > currScrollHeight) {
        //     this.setState({ textAreaHeight: "auto", parentHeight: `${minHeight}px` }, () => {
        //         const newScrollHeight = this.textAreaRef.current.scrollHeight;
        //         if (minHeight > newScrollHeight) {
        //             this.setState({
        //                 parentHeight: `${minHeight}px`,
        //                 textAreaHeight: `${minHeight}}px`
        //             });
        //         }
        //     });
        // } else {
        this.setState({ textAreaHeight: "auto", parentHeight: `${currScrollHeight < maxHeight ? currScrollHeight : maxHeight}px` }, () => {
            const newScrollHeight = this.textAreaRef.current.scrollHeight;
            this.setState({
                parentHeight: `${newScrollHeight < maxHeight ? newScrollHeight: maxHeight}px`,
                textAreaHeight: `${newScrollHeight < maxHeight ? newScrollHeight: maxHeight}px`
            });
        });
        // }
    }

    render() {
        const { text, cls, minHeight, maxHeight } = this.props;
        const { textAreaHeight, parentHeight } = this.state;
        return (
            <div style={{
                minHeight: parentHeight > maxHeight ? maxHeight: parentHeight,
                // height: parentHeight
            }} className={cls}>
                <textarea value={text} ref={this.textAreaRef} rows={5} style={{ height: textAreaHeight > maxHeight ? maxHeight: textAreaHeight, resize: "none" }} className="w-100"
                    onChange={this.onChangeWrapper} />
            </div>
        );
    }
}
AutoGrowTextArea.defaultProps = {
    minHeight: 150,
    maxHeight: 325
};


function noteFieldNameToSchemaFormatted(field) {
    switch(field) {
        case "note_interpretation":
            return "NoteInterpretation";
        case "note_discovery":
            return "NoteDiscovery";
        default:
            return "NoteStandard";
    }
}

/** Displays additional form fields for ACMG Interpretation and Discovery */
function GenericFieldForm(props) {
    const { fieldsArr = [], schemas, onDropOptionChange, noteType } = props;

    if (!schemas) {
        return (
            <div className="d-flex align-items-center justify-content-center pb-05 mb-1">
                <i className="icon icon-fw fas icon-circle-notch icon-spin mr-08"/>
                Loading...
            </div>);
    }

    const getFieldProperties = useMemo(function(){
        if (!schemas) return function(){ return null; };
        // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
        return function(field){
            const noteItem = noteFieldNameToSchemaFormatted(noteType);
            const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, noteItem);
            return (schemaProperty || {});
        };
    }, [ schemas ]);

    const fieldsJSX = useMemo(function() {
        return fieldsArr.map((fieldDataObj) => {
            const { field, value, autoClassification, toggleInvocation } = fieldDataObj;
            if (field === "acmg_guidelines") { return (<ACMGPicker selections={value} {...{ schemas, field, autoClassification, toggleInvocation, getFieldProperties }}/>); }
            return (<NoteFieldDrop key={field} {...{ schemas, noteType, value, field, getFieldProperties }}
                onOptionChange={onDropOptionChange} />);
        }).sort().reverse(); // Reverse really just to get Variant candidacy to show up last. May need a better solution if more fields added in future.
    }, [ schemas, noteType, fieldsArr ]);

    return (
        <React.Fragment>
            { fieldsJSX }
        </React.Fragment>);
}

function ACMGPicker(props) {
    const { field, selections = [], schemas = null, onOptionChange, cls="mb-1", getFieldProperties, autoClassification, toggleInvocation } = props;
    if (!schemas) {
        return null;
    }

    const fieldSchema = getFieldProperties(field);
    const { title = null, description = null, enum: static_enum = [] } = fieldSchema;


    const picked = selections.map((selection, i) => (
        <div className={`acmg-invoker text-600 clickable text-monospace text-center mr-01 ml-01`} key={selection} data-criteria={selection} data-invoked={true}
            data-tip="Click to deselect this rule" onClick={() => toggleInvocation(selection)}>
            { selection }
        </div>
    ));

    return (
        <React.Fragment>
            <label className="w-100 text-small">
                { title } { description ? <i className="icon icon-info-circle fas icon-fw ml-05" data-tip={description} /> : null }
            </label>
            <div className="w-100 d-flex flex-wrap acmg-picker mb-08">
                { selections.length > 0 ? picked : <div className="acmg-invoker text-muted" data-tip={"Use the picker above to make invocations."} data-criteria="none">None</div>}
            </div>

            { autoClassification ? (
                <>
                    <label className="w-100 text-small">CGAP's Classification:</label>
                    <div className="w-100 mb-08 ml-1">
                        <i className="status-indicator-dot ml-1 mr-1" data-status={autoClassification} />{autoClassification}
                    </div>
                </>)
                : null }
        </React.Fragment>
    );
}

/**
 * Displays and handles different CTAs for various stages in the Note Submission Process
 */
function GenericInterpretationSubmitButton(props) {
    const {
        isCurrent,                  // Has note been submitted to case; only cloning enabled -- can save to KB
        isDraft,                    // Has previous note been saved, but not submitted to case
        isApproved,                 // Has saved to knowledge base
        noteTextPresent,            // Is there text in the note space?
        noteChangedSinceLastSave,   // Has the text in the note space changed since last save?
        saveAsDraft,                // Fx -- save as Draft
        cls,
        hasEditPermission
    } = props;

    const allButtonsDropsDisabled = !noteTextPresent || !noteChangedSinceLastSave;

    if (isCurrent || isApproved || !hasEditPermission) {
        // No further steps allowed; saved to knowledgebase or approved to case
        return (
            <Button variant="primary btn-block" disabled className={cls} data-tip={!hasEditPermission ? "You must be added to the project to submit a note for this item." : null}>
                { !hasEditPermission ? "Need Edit Permission" : "Cannot edit - already approved" }
            </Button>);
    } else { // Brand new draft OR previous draft; allow saving or re-saving as draft
        return (
            <Button variant="primary btn-block" onClick={saveAsDraft}
                disabled={allButtonsDropsDisabled}>
                { isDraft ? "Re-save as Draft": "Save as Draft" }
            </Button>
        );
    }
}

function UnsavedInterpretationModal(props) {
    const { href, setIsSubmitting } = props;

    function discardAndNavigate() {
        setIsSubmitting(false, () => navigate(href, { 'skipRequest' : false, 'replace': false }), false);
    }

    return (
        <React.Fragment>
            <Modal show={true} onHide={() => setIsSubmitting(false, null, false)} centered>
                <Modal.Header closeButton style={{ backgroundColor: "#bdcbd9", color: "#1e435e" }}>
                    <Modal.Title>
                        <div className="modal-title font-italic text-600 h4">
                            Variant Interpretation: <span className="text-300">Unsaved Changes</span>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-small text-center mt-2">This variant interpretation is <u>incomplete</u> and contains at least 1:</div>
                    <div className="font-italic text-center text-600 h3 my-3" style={{ color: "#1e435e" }}>Unsaved Variant Classification</div>
                    <div className="text-small text-center mb-2">Are you sure you want to navigate away?</div>
                </Modal.Body>
                <Modal.Footer className="d-flex" style={{ backgroundColor: "#eff0f0" }}>
                    <Button className="flex-grow-1" variant="danger" onClick={discardAndNavigate}>
                        Navigate Away & Discard Notes
                    </Button>
                    <Button className="flex-grow-1" variant="primary" onClick={() => setIsSubmitting(false, null, false)}>
                        Back to Notes
                    </Button>
                </Modal.Footer>
            </Modal>
        </React.Fragment>
    );
}