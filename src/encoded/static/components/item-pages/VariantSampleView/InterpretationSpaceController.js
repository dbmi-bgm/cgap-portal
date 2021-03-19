'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import memoize from 'memoize-one';
import Dropdown from 'react-bootstrap/esm/Dropdown';
import Button from 'react-bootstrap/esm/Button';
import ButtonGroup from 'react-bootstrap/esm/ButtonGroup';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

/**
 * Stores and manages global note state for interpretation space.
 */
export class InterpretationSpaceWrapper extends React.Component {
    /**
     * Crawls context to find the most recently saved notes (the ones attached to the current VS)
     * and returns an object to use to initialize state.
     * returns { "variant_notes": <note_obj>, "gene_notes": <note obj>... etc. }
     */
    static initializeNoteState(context = {}) {
        const fields = ["variant_notes", "gene_notes", "interpretation"];
        const newState = {};
        fields.forEach((field) => {
            const { [field]: note = null } = context;
            newState[field] = note;
        });
        newState.loading = false;
        return newState;
    }

    constructor(props) {
        super(props);
        const { context = null } = props;
        this.state = InterpretationSpaceWrapper.initializeNoteState(context); // Ex. { variantNotes: <note linkto>, loading: false }
        this.saveAsDraft = this.saveAsDraft.bind(this);
        this.saveToCase = this.saveToCase.bind(this);
        this.saveToKnowledgeBase = this.saveToKnowledgeBase.bind(this);
    }

    /**
     * Can be used for cloning+updating notes OR creating new drafts
     * @param {Object}   note     Object with at least 'note_text' field; typically state from GenericInterpretationPanel
     * @param {String}   noteType "note_interpretation" or "note_standard"
     * @param {Integer}  version  Number to set version to
     * @param {String}   status   Should be "in review" or "current"; newly created notes shouldn't be "approved"
     */
    postNewNote(note, noteType, version = 1, status = null) {
        const { context: { institution = null, project = null } = {} } = this.props;
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

        // Don't set initial version for drafts
        if (status === "current") {
            noteToSubmit.version = version;
        }

        noteToSubmit.institution = institutionID;
        noteToSubmit.project = projectID;
        noteToSubmit.status = status;

        return ajax.promise(`/${noteType}/`, 'POST', {}, JSON.stringify(noteToSubmit));
    }

    patchNewNoteToVS(noteResp, saveToField) {
        console.log("noteResp", noteResp);
        const { context: { '@id': vsAtID = null } = {} } = this.props;
        const { '@id': noteAtID } = noteResp;
        return ajax.promise(vsAtID, 'PATCH', {}, JSON.stringify({ [saveToField]: noteAtID }));
    }

    patchPreviouslySavedNote(noteAtID, noteToPatch, status = null) { // ONLY USED FOR DRAFTS -- other notes are cloned
        if (status === "current") { // only used to convert "in review" to "current" (draft -> approved for case)
            noteToPatch.status = status;
            if (noteToPatch.version) {
                noteToPatch.version++;
            } else {
                noteToPatch.version = 1;
            }
            // TODO: add approved_by and approved_date stamps
            // newNote.approved_date = Date.now();
            // newNote.approved_by = ; // get user @id
        }
        return ajax.promise(noteAtID, 'PATCH', {}, JSON.stringify(noteToPatch));
    }

    saveAsDraft(note, stateFieldToUpdate, noteType) {
        const { [stateFieldToUpdate]: lastSavedNote } = this.state;

        // Does a draft already exist? TODO: Update this to actually check that draft is status = in review
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

            // Bump version number only if already has one (draft autosave/clone of a pre-existing approved note)
            if (noteToSubmit.version) {
                noteToSubmit.version = version + 1;
            }

            // console.log("noteToSubmit", noteToSubmit);

            this.setState({ loading: true }, () => {
                this.patchPreviouslySavedNote(noteAtID, noteToSubmit)
                    .then((response) => {
                        if (status === "error") {
                            throw new Error(response);
                        }
                        const { '@graph': graph } = response;
                        const { 0: newlySavedDraft } = graph || [];
                        // TODO: Some handling for various fail responses/codes
                        this.setState({ loading: false, [stateFieldToUpdate]: newlySavedDraft });

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
                this.postNewNote(note, noteType, null, "in review")
                    .then((response) => {
                        // TODO: Some handling for various fail responses/codes
                        console.log("Successfully created new item", response);
                        const { '@graph': noteItems = [] } = response;
                        const { 0: noteItem } = noteItems;
                        console.log("newly created note Item", noteItem);

                        // Temporarily try to update state here... since 'response' with note item is not accessible in next step
                        // TODO: Figure out a better way so if an item is created but not successfully attached, that is rectified before state update
                        this.setState({ loading: false, [stateFieldToUpdate]: noteItem });
                        return this.patchNewNoteToVS(noteItem, stateFieldToUpdate);
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

    saveToCase(note, stateFieldToUpdate, noteType) { // Does not save to case; saves to variantsample if not existing -- status change?
        const { [stateFieldToUpdate]: lastSavedNote } = this.state;

        if (lastSavedNote) {
            const { status, version, '@id': noteAtID } = lastSavedNote;
            if (status === "current") { // approved for case; future saves must be cloned
                const newNote = { ...note };
                newNote.previous_note = noteAtID;
                console.log("newNote", newNote);
                // newNote.approved_by =  ; // pull user ID from context
                // newNote.approved_date = Date.now();

                this.postNewNote(note, noteType, version + 1, "current")
                    .then((response) => {
                        // TODO: Some handling for various fail responses/codes
                        console.log("Successfully created new item", response);
                        const { '@graph': noteItems = [] } = response;
                        const { 0: noteItem } = noteItems;

                        // Temporarily try to update state here... since 'response' with note item is not accessible in next step
                        // TODO: Figure out a better way so if an item is created but not successfully attached, that is rectified before state update
                        this.setState({ loading: false, [stateFieldToUpdate]: noteItem });
                        return this.patchNewNoteToVS(noteItem, stateFieldToUpdate);
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

            } else if (status === "in review") { // patch draft to approve for case
                console.log("Note already exists... need to patch pre-existing draft", lastSavedNote);

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

                // Bump version number only if already has one (draft autosave/clone of a pre-existing approved note)
                if (noteToSubmit.version) {
                    noteToSubmit.version = version + 1;
                }

                this.setState({ loading: true }, () => {
                    this.patchPreviouslySavedNote(noteAtID, noteToSubmit, "current")
                        .then((response) => {
                            const { '@graph': graph } = response;
                            const { 0: newlySavedDraft } = graph || [];
                            // TODO: Some handling for various fail responses/codes
                            this.setState({ loading: false, [stateFieldToUpdate]: newlySavedDraft });
                            console.log("Successfully overwritten previous draft of note", response);
                        })
                        .catch((err) => {
                            // TODO: Error handling
                            console.log(err);
                            this.setState({ loading: false });
                        });
                });
            }
        } else { // No drafts or previous versions exist -- post with status of current
            this.setState({ loading: true }, () => {
                console.log("note", note);
                this.postNewNote(note, noteType, undefined, "current")
                    .then((response) => {
                        // TODO: Some handling for various fail responses/codes
                        console.log("Successfully created new item", response);
                        const { '@graph': noteItems = [] } = response;
                        const { 0: noteItem } = noteItems;

                        // Temporarily try to update state here... since 'response' with note item is not accessible in next step
                        // TODO: Figure out a better way so if an item is created but not successfully attached, that is rectified before state update
                        this.setState({ loading: false, [stateFieldToUpdate]: noteItem });
                        return this.patchNewNoteToVS(noteItem, stateFieldToUpdate);
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

    saveToKnowledgeBase(note) {
        console.log("saveToKB", note);
    }

    render() {
        const { variant_notes, gene_notes, interpretation } = this.state;
        return <InterpretationSpaceController {...this.props} lastSavedVariantNote={variant_notes}
            lastSavedGeneNote={gene_notes} lastSavedInterpretation={interpretation} saveToCase={this.saveToCase}
            saveToKnowledgeBase={this.saveToKnowledgeBase} saveAsDraft={this.saveAsDraft}/>;
    }
}


export class InterpretationSpaceController extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentTab: "Variant Notes",   // 0: Variant Notes, 1: Gene Notes, 2: Interpretation (Research/Discovery), 3: Interpretation (Clinical/ACMG)
            isExpanded: false // TODO - currently unused
        };
        this.toggleExpanded = this.toggleExpanded.bind(this);
        this.switchToTab = this.switchToTab.bind(this);
    }

    componentDidUpdate(pastState) {
        const { currentTab } = this.state;
        if (currentTab !== pastState.currentTab){
            ReactTooltip.rebuild();
        }
    }

    toggleExpanded() {
        // TODO
        const { isExpanded } = this.state;
        console.log("is setting fullscreen", isExpanded);
        this.setState({ isExpanded: !isExpanded });
    }

    switchToTab(newTab) {
        const { currentTab } = this.state;
        // TODO: may need some componentWillUnmount in panels to save unsaved items before dismount completes
        if (currentTab !== newTab) {
            this.setState({ currentTab: newTab });
        }
    }

    render() {
        const { isExpanded, currentTab } = this.state;
        const { lastSavedGeneNote, lastSavedInterpretation, lastSavedVariantNote } = this.props;

        const passProps = _.pick(this.props, 'saveAsDraft', 'saveToCase', 'saveToKnowledgeBase', 'schemas');

        let panelToDisplay = null;
        switch(currentTab) {
            case "Variant Notes":
                panelToDisplay = <GenericInterpretationPanel lastSavedNote={lastSavedVariantNote} noteLabel={currentTab} key={0} saveToField="variant_notes" noteType="note_standard" { ...passProps }/>;
                break;
            case "Gene Notes":
                panelToDisplay = <GenericInterpretationPanel lastSavedNote={lastSavedGeneNote} noteLabel={currentTab} key={1} saveToField="gene_notes" noteType="note_standard" { ...passProps }/>;
                break;
            case "Interpretation":
                panelToDisplay = <GenericInterpretationPanel lastSavedNote={lastSavedInterpretation} noteLabel={currentTab} key={2} saveToField="interpretation" noteType="note_interpretation" { ...passProps }/>;
                break;
            default:
                break;
        }
        return (
            <div className="card interpretation-space">
                <InterpretationSpaceHeader {...{ isExpanded }} toggleExpanded={this.toggleExpanded}/>
                <div className="card-body">
                    <InterpretationSpaceTabs {...{ currentTab }} switchToTab={this.switchToTab} />
                    { panelToDisplay }
                </div>
            </div>
        );
    }
}

function InterpretationSpaceHeader(props) {
    const { toggleExpanded, isExpanded } = props;
    return (
        <div className="interpretation-header card-header d-flex align-items-center justify-content-between">
            <i className="icon icon-sort-amount-down fas"></i>
            Variant Interpretation
            <button type="button" className="btn btn-link" onClick={toggleExpanded || undefined}>
                { isExpanded ? <i className="icon icon-compress fas"></i> : <i className="icon icon-expand fas"></i> }
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

class GenericInterpretationPanel extends React.Component {
    static hasNoteChanged(lastSavedNote = null, currNote = null) {
        const fieldsToCompare = ["note_text", "acmg_guidelines", "classification", "conclusion"];

        const blankNote = { note_text: "", acmg_guidelines: [], classification: null, conclusion:  "" };

        if (!lastSavedNote) { // Compare against blank note if lastSavedNote is null
            return !_.isEqual(
                _.pick(currNote, ...fieldsToCompare),
                _.pick(blankNote, ...fieldsToCompare)
            );
        }

        return !_.isEqual(
            _.pick(currNote, ...fieldsToCompare),
            _.pick(lastSavedNote, ...fieldsToCompare)
        );
    }

    constructor(props) {
        super(props);

        // Defaults to most recent note (as determined by InterpretationPanelController)
        const { note_text = "", acmg_guidelines = [], classification = null, conclusion =  "" } = props.lastSavedNote || {};
        this.state = {
            // Fields in form. Using snake casing to make it easier to add state data directly to post/patch request
            note_text,
            acmg_guidelines,            // TODO: Currently Unused
            classification,
            conclusion,                 // TODO: Currently Unused
        };

        this.saveStateAsDraft = this.saveStateAsDraft.bind(this);
        this.saveStateToCase = this.saveStateToCase.bind(this);
        this.saveStateToKnowledgeBase = this.saveStateToKnowledgeBase.bind(this);
        this.onTextChange = this.onTextChange.bind(this);
        this.onDropOptionChange = this.onDropOptionChange.bind(this);

        this.memoized = {
            hasNoteChanged: memoize(GenericInterpretationPanel.hasNoteChanged)
        };
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
        const { saveAsDraft, noteType, saveToField } = this.props;
        saveAsDraft(this.state, saveToField , noteType);
    }

    saveStateToCase() {
        const { saveToCase, noteType, saveToField } = this.props;
        saveToCase(this.state, saveToField, noteType);
    }

    saveStateToKnowledgeBase(){
        const { saveToKnowledgeBase } = this.props;
        saveToKnowledgeBase(this.state);
    }

    render() {
        const { lastSavedNote = null, noteLabel, noteType, schemas } = this.props;
        const { note_text : savedNoteText = null, status: savedNoteStatus } = lastSavedNote || {};
        const { note_text: noteText, acmg_guidelines, classification, conclusion } = this.state;

        // TODO: move into a function and memoize once checking other values of state, too
        const noteChangedSinceLastSave = this.memoized.hasNoteChanged(lastSavedNote, this.state);
        const noteTextPresent = !!noteText;
        const isDraft = savedNoteStatus === "in review";
        const isCurrent = savedNoteStatus === "current";

        return (
            <div className="interpretation-panel">
                <label className="w-100">
                    { noteLabel }
                </label>
                <AutoGrowTextArea cls="w-100 mb-1" text={noteText} onTextChange={this.onTextChange} field="note_text" />
                { noteType === "note_interpretation" ?
                    <ACMGInterpretationForm {...{ schemas, acmg_guidelines, classification, conclusion, noteType }} onDropOptionChange={this.onDropOptionChange}/>
                    : null }
                <GenericInterpretationSubmitButton {...{ isCurrent, isDraft, noteTextPresent, noteChangedSinceLastSave, noteLabel }}
                    saveAsDraft={this.saveStateAsDraft} saveToCase={this.saveStateToCase} saveToKnowledgeBase={this.saveStateToKnowledgeBase}
                />
            </div>
        );
    }
}

function NoteFieldDrop(props) { /** For classification, variant/gene candidacy dropdowns */
    const { value = null, schemas = null, field = null, noteType = null, onOptionChange, cls="mb-1", getFieldProperties } = props;
    if (!schemas) {
        return 'loading...'; // TODO: actually implement a load spinner
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
            <Dropdown as={ButtonGroup} className={cls}>
                <Dropdown.Toggle variant="outline-secondary btn-block text-left" id="dropdown-basic">
                    { value ? <><i className="status-indicator-dot ml-1 mr-07" data-status={value} /> { value }</> : "Select an option..."}
                </Dropdown.Toggle>
                <Dropdown.Menu>{ dropOptions }</Dropdown.Menu>
            </Dropdown>
        </React.Fragment>
    );
}


class AutoGrowTextArea extends React.Component {
    constructor(props) {
        super(props);

        this.state = { textAreaHeight: "100%", parentHeight: "auto" };
        this.textAreaRef = React.createRef(null);

        this.onChangeWrapper = this.onChangeWrapper.bind(this);
    }

    componentDidMount() {
        const { minHeight } = this.props;

        const currScrollHeight = this.textAreaRef.current.scrollHeight;
        if (minHeight > currScrollHeight) {
            this.setState({
                parentHeight: `${minHeight}px`,
                textAreaHeight: `${minHeight}}px`
            });
        } else {
            this.setState({
                parentHeight: `${currScrollHeight}px`,
                textAreaHeight: `${currScrollHeight}px`
            });
        }
    }

    onChangeWrapper(e) {
        const { onTextChange, field, minHeight } = this.props;

        onTextChange(e, field);

        const currScrollHeight = this.textAreaRef.current.scrollHeight;
        if (minHeight && minHeight > currScrollHeight) {
            this.setState({
                parentHeight: `${minHeight}px`,
                textAreaHeight: `${minHeight}}px`
            });
        } else {
            this.setState({ textAreaHeight: "auto", parentHeight: `${currScrollHeight}px` }, () => {
                this.setState({
                    parentHeight: `${currScrollHeight}px`,
                    textAreaHeight: `${currScrollHeight}px`
                });
            });
        }
    }

    render() {
        const { text, cls } = this.props;
        const { textAreaHeight, parentHeight } = this.state;
        return (
            <div style={{ minHeight: parentHeight, height: parentHeight }} className={cls}>
                <textarea value={text} ref={this.textAreaRef} rows={1} style={{ height: textAreaHeight, resize: "none" }} className="w-100"
                    onChange={this.onChangeWrapper} />
            </div>
        );
    }
}
AutoGrowTextArea.defaultProps = {
    minHeight: 150
};


/** Display additional form fields for ACMG Interpretation */
function ACMGInterpretationForm(props) {
    const { schemas, acmg_guidelines = [], classification = null, conclusion = null, noteType, onDropOptionChange } = props;

    const getFieldProperties = useMemo(function(){
        if (!schemas) return function(){ return null; };
        // Helper func to basically just shorten `schemaTransforms.getSchemaProperty(field, schemas, itemType);`.
        return function(field){
            const noteItem = noteType === "note_interpretation" ? "NoteInterpretation" : "NoteStandard";
            const schemaProperty = schemaTransforms.getSchemaProperty(field, schemas, noteItem);
            return (schemaProperty || {});
        };
    }, [ schemas ]);

    return (
        <React.Fragment>
            <NoteFieldDrop {...{ schemas, noteType }} getFieldProperties={getFieldProperties} onOptionChange={onDropOptionChange} field="classification" value={classification}/>
        </React.Fragment>
    );
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
                    // disabled={(!isDraft && allButtonsDropsDisabled) || (!isCurrent && allButtonDrops)}
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