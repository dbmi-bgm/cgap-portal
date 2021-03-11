'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import Dropdown from 'react-bootstrap/esm/Dropdown';
import Button from 'react-bootstrap/esm/Button';
import ButtonGroup from 'react-bootstrap/esm/ButtonGroup';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

export class InterpretationSpaceController extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentTab: "Variant Notes",   // 0: Variant Notes, 1: Gene Notes, 2: Interpretation (Research/Discovery), 3: Interpretation (Clinical/ACMG)
            isFullScreen: false // TODO - currently unused
        };
        this.toggleFullScreen = this.toggleFullScreen.bind(this);
        this.switchToTab = this.switchToTab.bind(this);
    }

    toggleFullScreen() {
        // TODO
        const { isFullScreen } = this.state;
        console.log("is setting fullscreen", isFullScreen);
        this.setState({ isFullScreen: !isFullScreen });
    }

    switchToTab(newTab) {
        const { currentTab } = this.state;
        // TODO: may need some componentWillUnmount in panels to save unsaved items before dismount completes
        if (currentTab !== newTab) {
            console.log("is setting current tab to", newTab);
            this.setState({ currentTab: newTab });
        }
    }

    render() {
        const { isFullScreen, currentTab } = this.state;
        console.log(currentTab);

        let panelToDisplay = null;
        switch(currentTab) {
            case "Variant Notes":
                panelToDisplay = <GenericInterpretationPanelController noteLabel={currentTab} key={0} saveToField="variant_notes" noteType="note_standard" { ...this.props }/>;
                break;
            case "Gene Notes":
                panelToDisplay = <GenericInterpretationPanelController noteLabel={currentTab} key={1} saveToField="gene_notes" noteType="note_standard" { ...this.props }/>;
                break;
            case "Interpretation":
                panelToDisplay = <GenericInterpretationPanelController noteLabel={currentTab} key={2} saveToField="interpretation" noteType="note_interpretation" { ...this.props }/>;
                break;
            default:
                break;
        }
        return (
            <div className="card interpretation-space">
                <InterpretationSpaceHeader {...{ isFullScreen }} toggleFullScreen={this.toggleFullScreen}/>
                <div className="card-body">
                    <InterpretationSpaceTabs {...{ currentTab }} switchToTab={this.switchToTab} />
                    { panelToDisplay }
                </div>
            </div>
        );
    }
}

function InterpretationSpaceHeader(props) {
    const { toggleFullScreen, isFullScreen } = props;
    return (
        <div className="interpretation-header card-header d-flex align-items-center justify-content-between">
            <i className="icon icon-sort-amount-down fas"></i>
            Variant Interpretation
            <button type="button" className="btn btn-link" onClick={toggleFullScreen || undefined}>
                { isFullScreen ? <i className="icon icon-compress fas"></i> : <i className="icon icon-expand fas"></i> }
            </button>
        </div>
    );
}

function InterpretationSpaceTabs(props) {
    const { currentTab, switchToTab } = props;

    const variantNotesActive = currentTab === "Variant Notes" ? true : false;
    const geneNotesActive = currentTab === "Gene Notes" ? true : false;
    const interpretationActive = currentTab === "Interpretation" ? true : false;
    return (
        <ul className="p-1 d-flex align-items-center justify-content-between">
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab("Variant Notes")}
                data-active={variantNotesActive}>
                Variant Notes
            </li>
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab("Gene Notes")}
                data-active={geneNotesActive}>
                Gene Notes
            </li>
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab("Interpretation")}
                data-active={interpretationActive}>
                Interpretation
            </li>
        </ul>
    );
}

class GenericInterpretationPanelController extends React.Component {
    constructor(props) {
        super(props);

        const { 0: note, 1: noteSource } = this.getMostRecentNote() || [];

        this.state = {
            loading : false,
            lastSavedNote: note, // Check after mount for last saved version of interpretation note
            noteSource : noteSource   // Currently just VariantSample... eventually could be KnowledgeBase, Gene
        };

        this.saveAsDraft = this.saveAsDraft.bind(this);
        this.saveToCase = this.saveToCase.bind(this);
        this.saveToKnowledgeBase = this.saveToKnowledgeBase.bind(this);
    }

    /**
     * Used on initialization to find the most recent note attached to the current VS (will need tweaking
     * to check other locations for gene items, interpretation notes, etc)
     */
    getMostRecentNote() {
        const { context, saveToField } = this.props;
        console.log("saveToField", saveToField);
        const { [saveToField]: note = null } = context || {};

        // Determine which interpretation note to load into state
        if (note) { // Check for saved notes on Variant first
            // TODO: See if this needs to be sorted or if most recent will always be the last one
            return [note, "VariantSample"];
        }
        return null; // Can assume there are no notes
    }

    /**
     * Can be used for cloning+updating notes OR creating new drafts
     * @param {Object} note     Object with at least 'note_text' field; typically state from GenericInterpretationPanel
     */
    postNewNote(note, version = 1) {
        const { context: { institution = null, project = null } = {}, noteType } = this.props;
        const { '@id': institutionID } = institution || {};
        const { '@id': projectID } = project || {};

        const noteToSubmit = { ...note };

        if (noteType === "note_interpretation") {
            // Prune keys with incomplete values
            if (noteToSubmit.classification === null) {
                delete noteToSubmit.classification;
            }
        } else {
            // Prune unused keys
            delete noteToSubmit.acmg_guidelines;
            delete noteToSubmit.conclusion;
            delete noteToSubmit.classification;
        }

        noteToSubmit.institution = institutionID;
        noteToSubmit.project = projectID;
        noteToSubmit.version = version;

        return ajax.promise(`/${noteType}/`, 'POST', {}, JSON.stringify(noteToSubmit));
    }

    patchNewNoteToVS(noteResp) {
        console.log("noteResp", noteResp);
        const { context: { '@id': vsAtID = null } = {}, saveToField } = this.props;
        const { '@id': noteAtID } = noteResp;
        return ajax.promise(vsAtID, 'PATCH', {}, JSON.stringify({ [saveToField]: noteAtID }));
    }

    patchPreviouslySavedNote(noteAtID, noteToPatch) { // ONLY USED FOR DRAFTS -- other notes are cloned
        return ajax.promise(noteAtID, 'PATCH', {}, JSON.stringify(noteToPatch));
    }

    saveAsDraft(note) {
        const { lastSavedNote } = this.state;
        const { noteType } = this.props;

        // Does a draft already exist?
        if (lastSavedNote) { // Patch the pre-existing draft item & overwrite it
            console.log("Note already exists... need to patch pre-existing draft", lastSavedNote);
            const {
                '@id': noteAtID, version,
            } = lastSavedNote;

            const noteToSubmit = { ...note };

            if (noteType === "note_interpretation") {
                // Prune keys with incomplete values
                if (noteToSubmit.classification === null) {
                    delete noteToSubmit.classification;
                }
            } else {
                // Prune unused keys
                delete noteToSubmit.acmg_guidelines;
                delete noteToSubmit.conclusion;
                delete noteToSubmit.classification;
            }

            // Bump version number
            noteToSubmit.version = version + 1;

            // console.log("noteToSubmit", noteToSubmit);

            this.setState({ loading: true }, () => {
                this.patchPreviouslySavedNote(noteAtID, noteToSubmit)
                    .then((response) => {
                        const { '@graph': graph } = response;
                        const { 0: newlySavedDraft } = graph || [];
                        // TODO: Some handling for various fail responses/codes
                        this.setState({ loading: false, lastSavedNote: newlySavedDraft, noteSource: "VariantSample" });
                        console.log("Successfully overwritten previous draft of note", response);
                    })
                    .catch((err) => {
                        // TODO: Error handling
                        console.log(err);
                        this.setState({ loading: false });
                    });
            });
        } else { // Create a whole new item, and patch to VS
            this.setState({ loading: true }, () => {
                this.postNewNote(note)
                    .then((response) => {
                        // TODO: Some handling for various fail responses/codes
                        console.log("Successfully created new item", response);
                        const { '@graph': noteItem = {} } = response;

                        // Temporarily try to update state here... since 'response' with note item is not accessible in next step
                        // TODO: Figure out a better way so if an item is created but not successfully attached, that is rectified before state update
                        this.setState({ loading: false, lastSavedNote: noteItem, noteSource: "VariantSample" });
                        return this.patchNewNoteToVS(noteItem[0]);
                    })
                    .then((resp) => {
                        console.log("Successfully linked note object to variant sample", resp);
                        // const { '@graph': noteItem } = response;
                        // TODO: Find way to update state with new interpretation note here instead
                    })
                    .catch((err) => {
                        // TODO: Error handling
                        console.log(err);
                        this.setState({ loading: false });
                    });
            });
        }
    }

    saveToCase(note) { // Does not save to case; saves to variantsample if not existing -- status change?
        console.log("saveToCase", note);
    }

    saveToKnowledgeBase(note) {
        console.log("saveToKB", note);
    }

    render(){
        const { lastSavedNote } = this.state;
        const { noteLabel } = this.props;
        return <GenericInterpretationPanel saveAsDraft={this.saveAsDraft} saveToCase={this.saveToCase}
            lastSavedNote={lastSavedNote} saveToKnowledgeBase={this.saveToKnowledgeBase} {...{ noteLabel }} />;
    }
}

class GenericInterpretationPanel extends React.Component {
    constructor(props) {
        super(props);

        // Defaults to most recent note (as determined by InterpretationPanelController)
        const { note_text = "", acmg_guidelines = [], classification = null, conclusion =  "" } = props.lastSavedNote || {};
        this.state = {
            // Fields in form. Using snake casing to make it easier to add state data directly to post/patch request
            note_text,
            acmg_guidelines,            // TODO: Currently Unused
            classification,             // TODO: Currently Unused
            conclusion,                 // TODO: Currently Unused
        };

        this.saveStateAsDraft = this.saveStateAsDraft.bind(this);
        this.saveStateToCase = this.saveStateToCase.bind(this);
        this.saveStateToKnowledgeBase = this.saveStateToKnowledgeBase.bind(this);
    }

    // Will use same update fxn for multiple text fields
    onTextChange(event, stateToChange) {
        const { value: newValue } = event.target || {};
        this.setState({ [stateToChange]: newValue });
    }

    // Wrapping passed in functions so as to call them with this component's state, then pass down to children
    saveStateAsDraft() {
        const { saveAsDraft } = this.props;
        saveAsDraft(this.state);
    }

    saveStateToCase() {
        const { saveToCase } = this.props;
        saveToCase(this.state);
    }

    saveStateToKnowledgeBase(){
        const { saveToKnowledgeBase } = this.props;
        saveToKnowledgeBase(this.state);
    }

    render() {
        const { lastSavedNote: { note_text : savedNoteText = null, status: savedNoteStatus } = {}, noteLabel } = this.props;
        const { note_text: noteText } = this.state;

        // TODO: move into a function and memoize once checking other values of state, too
        const noteChangedSinceLastSave = noteText !== savedNoteText;
        const noteTextPresent = !!noteText;
        const isDraft = savedNoteStatus === "in review";
        const isCurrent = savedNoteStatus === "current";

        return (
            <div className="interpretation-panel">
                <label className="w-100">
                    { noteLabel }
                </label>
                <textarea className="w-100" value={noteText} onChange={(e) => this.onTextChange(e, "note_text")}/>
                <GenericInterpretationSubmitButton {...{ isCurrent, isDraft, noteTextPresent, noteChangedSinceLastSave, noteLabel }}
                    saveAsDraft={this.saveStateAsDraft} saveToCase={this.saveStateToCase} saveToKnowledgeBase={this.saveStateToKnowledgeBase}
                />
            </div>
        );
    }
}

/**
 * Displays and handles different CTAs for various stages in the Note Submission Process
 */
function GenericInterpretationSubmitButton(props) {
    const {
        isCurrent,                  // Has note been submitted to case; only cloning enabled -- can save to KB
        isDraft,                    // Has previous note been saved, but not submitted;
        noteTextPresent,            // Is there text in the note space
        noteChangedSinceLastSave,   // Has the text in the note space changed since last save
        saveAsDraft,                // Fx -- save as Draft
        saveToCase,                 // Fx -- save to Case (handles cloning in response to edits as well as first time additions)
        saveToKnowledgeBase,        // Fx -- save to KB
        cls
    } = props;

    const allButtonsDropsDisabled = !noteTextPresent || !noteChangedSinceLastSave;

    // TODO: Add additional conditions to check for is inKnowledgeBase
    if (isCurrent || isDraft) {
        // If current: no saving as draft; already submitted to case -- save to knowledgebase
        // In draft status: allow saving to case, re-saving as draft, but no saving to knowledgebase
        return (
            <Dropdown as={ButtonGroup} className={cls}>
                <Button variant="primary btn-block" onClick={isCurrent ? saveToKnowledgeBase : saveToCase}
                    disabled={!isDraft && allButtonsDropsDisabled}
                >
                    { isCurrent ? "Save to Knowledge Base" : "Approve for Case" }
                </Button>
                <Dropdown.Toggle split variant="primary" id="dropdown-split-basic" disabled={allButtonsDropsDisabled} />
                <Dropdown.Menu>
                    { isDraft ? <Dropdown.Item onClick={saveAsDraft} disabled={allButtonsDropsDisabled}>Save as Draft</Dropdown.Item> : null}
                    { isCurrent ? <Dropdown.Item onClick={saveToCase}>Clone to Case</Dropdown.Item> : null}
                    { isDraft ? <Dropdown.Item disabled>Send to Knowledgebase</Dropdown.Item> : null}
                </Dropdown.Menu>
            </Dropdown>);
    } else { // Brand new note; allow saving as draft or to case, but not knowledgebase
        return (
            <Dropdown as={ButtonGroup} className={cls}>
                <Button variant="primary btn-block" onClick={saveAsDraft}
                    disabled={allButtonsDropsDisabled}>
                    Save Draft
                </Button>
                <Dropdown.Toggle split variant="primary" id="dropdown-split-basic" disabled={allButtonsDropsDisabled} />
                <Dropdown.Menu>
                    <Dropdown.Item onClick={saveToCase} disabled={!noteTextPresent || !noteChangedSinceLastSave}>
                        Approve for Case
                    </Dropdown.Item>
                    <Dropdown.Item disabled>
                        Send to Knowledgebase
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>);
    }
}