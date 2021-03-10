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
            currentTabIdx: 0,   // 0: Variant Notes, 1: Gene Notes, 2: Interpretation (Research/Discovery), 3: Interpretation (Clinical/ACMG)
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

    switchToTab(idx) {
        const { currentTabIdx } = this.state;
        // TODO: may need some componentWillUnmount in panels to save unsaved items before dismount completes
        if (currentTabIdx !== idx) {
            console.log("is setting current tab to idx #", idx);
            this.setState({ currentTabIdx: idx });
        }
    }

    render() {
        const { isFullScreen, currentTabIdx } = this.state;

        // Temp until create separate unique versions of the panels for each tab
        const noteLabel = currentTabIdx === 0 ? "Variant Notes" : (currentTabIdx === 1 ? "Gene Notes" : "Interpretation Notes");

        return (
            <div className="card interpretation-space">
                <InterpretationHeader {...{ isFullScreen }} toggleFullScreen={this.toggleFullScreen}/>
                <div className="card-body">
                    <InterpretationTabs {...{ currentTabIdx }} switchToTab={this.switchToTab} />
                    {/** Eventually, there will be 3 separate instances of GenericInterperetationPanelController; each with different
                     * props/options that show/hide according to currently selected tab. -- right now same one is being shared for all */}
                    <GenericInterpretationPanelController {...{ noteLabel }} { ...this.props }/>
                </div>
            </div>
        );
    }
}

function InterpretationHeader(props) {
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

function InterpretationTabs(props) {
    const { currentTabIdx, switchToTab } = props;

    const variantNotesActive = currentTabIdx === 0 ? true : false;
    const geneNotesActive = currentTabIdx === 1 ? true : false;
    const interpretationActive = currentTabIdx === 2 ? true : false;
    return (
        <ul className="p-1 d-flex align-items-center justify-content-between">
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab(0)}
                data-active={variantNotesActive}>
                Variant Notes
            </li>
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab(1)}
                data-active={geneNotesActive}>
                Gene Notes
            </li>
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab(2)}
                data-active={interpretationActive}>
                Interpretation
            </li>
        </ul>
    );
}

class GenericInterpretationPanelController extends React.Component {
    constructor(props) {
        super(props);

        const { 0: note, 1: noteSource } = this.getMostRecentNoteInterpretation() || [];

        this.state = {
            loading : false,
            interpretationNote: note, // Check after mount for last saved version of interpretation note
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
    getMostRecentNoteInterpretation() {
        const { context: { interpretation = null } = {} } = this.props;

        // Determine which interpretation note to load into state
        if (interpretation) { // Check for saved notes on Variant first
            // TODO: See if this needs to be sorted or if most recent will always be the last one
            return [interpretation, "VariantSample"];
        }
        return null; // Can assume there are no notes
    }

    /**
     * Can be used for cloning+updating notes OR creating new drafts
     * @param {Object} note     Object with at least 'note_text' field; typically state from GenericInterpretationPanel
     */
    postNewNoteInterpretation(note, version = 1) {
        const { context: { institution = null, project = null } = {} } = this.props;
        const { '@id': institutionID } = institution || {};
        const { '@id': projectID } = project || {};

        const noteToSubmit = { ...note };

        // Prune keys with incomplete values
        if (noteToSubmit.classification === null) {
            delete noteToSubmit.classification;
        }

        noteToSubmit.institution = institutionID;
        noteToSubmit.project = projectID;
        noteToSubmit.version = version;

        return ajax.promise('/note_interpretation/', 'POST', {}, JSON.stringify(noteToSubmit));
    }

    patchNewNoteToVS(noteResp) {
        const { context: { '@id': vsAtID = null } = {} } = this.props;
        const { '@id': noteAtID } = noteResp;
        return ajax.promise(vsAtID, 'PATCH', {}, JSON.stringify({ interpretation: noteAtID }));
    }

    patchPreviouslySavedNote(noteAtID, noteToPatch) { // ONLY USED FOR DRAFTS -- other notes are cloned
        return ajax.promise(noteAtID, 'PATCH', {}, JSON.stringify(noteToPatch));
    }

    saveAsDraft(note) {
        const { interpretationNote } = this.state;

        // Does a draft already exist?
        if (interpretationNote) { // Patch the pre-existing draft item & overwrite it
            console.log("Note already exists... need to patch pre-existing draft", interpretationNote);
            const {
                '@id': noteAtID, version,
            } = interpretationNote;

            const noteToSubmit = { ...note };

            // Prune keys with incomplete values
            if (noteToSubmit.classification === null) {
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
                        this.setState({ loading: false, interpretationNote: newlySavedDraft, noteSource: "VariantSample" });
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
                this.postNewNoteInterpretation(note)
                    .then((response) => {
                        // TODO: Some handling for various fail responses/codes
                        console.log("Successfully created new item", response);
                        const { '@graph': noteItem } = response;

                        // Temporarily try to update state here... since 'response' with note item is not accessible in next step
                        // TODO: Figure out a better way so if an item is created but not successfully attached, that is rectified before state update
                        this.setState({ loading: false, interpretationNote: noteItem[0], noteSource: "VariantSample" });
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
        const { interpretationNote } = this.state;
        const { noteLabel } = this.props;
        return <GenericInterpretationPanel saveAsDraft={this.saveAsDraft} saveToCase={this.saveToCase}
            lastSavedNote={interpretationNote} saveToKnowledgeBase={this.saveToKnowledgeBase} {...{ noteLabel }} />;
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
        const interpretationChanged = noteText !== savedNoteText;
        const interpretationExists = !!noteText;
        const isDraft = savedNoteStatus === "in review";
        const isCurrent = savedNoteStatus === "current";

        return (
            <div className="interpretation-panel">
                <label className="w-100">
                    { noteLabel }
                </label>
                <textarea className="w-100" value={noteText} onChange={(e) => this.onTextChange(e, "note_text")}/>
                <GenericInterpretationSubmitButton {...{ isCurrent, isDraft, interpretationExists, interpretationChanged, noteLabel }}
                    saveAsDraft={this.saveStateAsDraft} saveToCase={this.saveStateToCase} saveToKnowledgeBase={this.saveStateToKnowledgeBase}
                />
            </div>
        );
    }
}

/**
 * Displays and handles different CTAs for various stages in the Interpretation Submission Process
 */
function GenericInterpretationSubmitButton(props) {
    const {
        isCurrent,                  // Has note been submitted to case; only cloning enabled -- can save to KB
        isDraft,                    // Has previous note been saved, but not submitted;
        interpretationExists,       // Is there text in the interpretation note space
        interpretationChanged,      // Has the text in the interpretation note space changed since last save
        saveAsDraft,                // Fx -- save as Draft
        saveToCase,                 // Fx -- save to Case (handles cloning in response to edits as well as first time additions)
        saveToKnowledgeBase,        // Fx -- save to KB
        cls
    } = props;

    const allButtonsDropsDisabled = !interpretationExists || !interpretationChanged;

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
                    <Dropdown.Item onClick={saveToCase} disabled={!interpretationExists || !interpretationChanged}>
                        Approve for Case
                    </Dropdown.Item>
                    <Dropdown.Item disabled>
                        Send to Knowledgebase
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>);
    }
}