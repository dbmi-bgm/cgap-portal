'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import memoize from 'memoize-one';
import Dropdown from 'react-bootstrap/esm/Dropdown';
import Button from 'react-bootstrap/esm/Button';
import Modal from 'react-bootstrap/esm/Modal';
import ButtonGroup from 'react-bootstrap/esm/ButtonGroup';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, navigate, layout, JWT, ajax, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
/**
 * Stores and manages global note state for interpretation space.
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
        const fields = ["variant_notes", "gene_notes", "interpretation"];
        const newState = {};
        fields.forEach((field) => {
            const { [field]: note = null } = context;
            newState[field] = note;
        });
        newState.loading = false;
        newState.user = null;
        return newState;
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
     * @param {Integer}  version  Number to set version to (not in use currently... may need if expand for case in future)
     * @param {String}   status   Should be "in review" (not in use currently... may expand if expand for case in future)
     */
    postNewNote(note, noteType, version = 1, status = "in review") {
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

        noteToSubmit.institution = institutionID;
        noteToSubmit.project = projectID;
        noteToSubmit.status = status;

        return ajax.promise(`/${noteType}/`, 'POST', {}, JSON.stringify(noteToSubmit));
    }

    patchNewNoteToVS(noteID, saveToField) {
        const { context: { '@id': vsAtID = null } = {} } = this.props;
        return ajax.promise(vsAtID, 'PATCH', {}, JSON.stringify({ [saveToField]: noteID }));
    }

    patchPreviouslySavedNote(noteAtID, noteToPatch) { // ONLY USED FOR DRAFTS -- other notes are cloned
        return ajax.promise(noteAtID, 'PATCH', {}, JSON.stringify(noteToPatch));
    }

    getNote(uuid, noteType) {
        console.log("Fetching @@embedded representation of " + uuid + " with " + noteType);
        const path = `/${noteType}/${uuid}/?datastore=database`;
        console.log("path", path);
        return ajax.promise(path, 'GET');
    }

    saveAsDraft(note, stateFieldToUpdate, noteType = "note_standard") {
        const { [stateFieldToUpdate]: lastSavedNote } = this.state;
        const urlFormattedNoteType = noteType.split('_').join('s-');

        // Does a draft already exist?
        if (lastSavedNote) { // Patch the pre-existing draft item & overwrite it
            console.log("Note already exists... need to patch pre-existing draft", lastSavedNote);
            const {
                '@id': noteAtID,
                uuid: noteUUID, version,
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

            this.setState({ loading: true }, () => {
                this.patchPreviouslySavedNote(noteAtID, noteToSubmit)
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
                        console.log(err);
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
                this.postNewNote(note, noteType, null, "in review")
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
                        // TODO: Error handling/alerting
                        console.log(err);
                        this.setState({ loading: false });
                    });
            });
        }
    }

    render() {
        const { defaultTab, setIsSubmitting, isSubmitting, isSubmittingModalOpen } = this.props;
        const { variant_notes, gene_notes, interpretation } = this.state;
        return <InterpretationSpaceController {...this.props} lastSavedVariantNote={variant_notes}
            lastSavedGeneNote={gene_notes} lastSavedInterpretation={interpretation}
            saveAsDraft={this.saveAsDraft} />;
    }
}


export class InterpretationSpaceController extends React.Component {

    static hasNoteChanged(lastSavedNote = null, currNote = null) {
        if (lastSavedNote === null && currNote === null) {
            return false;
        }

        // Manually compare classification & note text (not added to embed if not present, which can confuse _'s comparisons)
        // TODO: Figure out a way to use _.isMatch/_.isEqual for future versions. Kicking this can down the road slightly.
        const {
            classification: lastSavedClassification = null,
            note_text: lastSavedNoteText = ""
        } = lastSavedNote || {};
        const {
            classification: currClassification = null,
            note_text: currNoteText = ""
        } = currNote || {};

        if (currClassification !== lastSavedClassification) {
            // console.log("classifications do not match:", currClassification, lastSavedClassification);
            return true;
        }

        if (lastSavedNoteText !== currNoteText) {
            // console.log("text does not match");
            return true;
        }

        return false;
    }

    constructor(props) {
        super(props);
        const { lastSavedVariantNote, lastSavedGeneNote, lastSavedInterpretation, defaultTab } = props;

        // use to validate passed in defaultTab prop
        const acceptableTabNames = ["Variant Notes", "Gene Notes", "Interpretation"];

        this.state = {
            // Initialize WIP states to last saved - if a tab is closed WIP progress is temporarily saved here
            variant_notes_wip: lastSavedVariantNote,
            gene_notes_wip: lastSavedGeneNote,
            interpretation_wip: lastSavedInterpretation,
            currentTab: _.contains(acceptableTabNames, defaultTab) ? defaultTab : "Variant Notes",
            isExpanded: false // TODO - currently unused; V2
        };
        this.toggleExpanded = this.toggleExpanded.bind(this);
        this.switchToTab = this.switchToTab.bind(this);
        this.retainWIPStateOnUnmount = this.retainWIPStateOnUnmount.bind(this);

        this.memoized = {
            hasNoteChanged: memoize(InterpretationSpaceController.hasNoteChanged)
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
        // TODO: may need some componentWillUnmount in panels to save unsaved items before dismount completes
        if (currentTab !== newTab) {
            this.setState({ currentTab: newTab });
        }
    }

    componentWillUnmount() {
        const { setIsSubmitting } = this.props;
        setIsSubmitting(false, null, false);
    }

    render() {
        const { isExpanded, currentTab, variant_notes_wip, gene_notes_wip, interpretation_wip } = this.state;
        const { lastSavedGeneNote, lastSavedInterpretation, lastSavedVariantNote } = this.props;

        const passProps = _.pick(this.props, 'saveAsDraft', 'schemas', 'caseSource', 'setIsSubmitting', 'isSubmitting', 'isSubmittingModalOpen' );

        const isDraftVariantNoteUnsaved = this.memoized.hasNoteChanged(variant_notes_wip, lastSavedVariantNote);
        const isDraftGeneNoteUnsaved = this.memoized.hasNoteChanged(gene_notes_wip, lastSavedGeneNote);
        const isDraftInterpretationUnsaved = this.memoized.hasNoteChanged(interpretation_wip, lastSavedInterpretation);

        let panelToDisplay = null;
        switch(currentTab) {
            case "Variant Notes":
                panelToDisplay = (<GenericInterpretationPanel retainWIPStateOnUnmount={this.retainWIPStateOnUnmount}
                    lastWIPNote={variant_notes_wip} lastSavedNote={lastSavedVariantNote} noteLabel={currentTab}
                    key={0} saveToField="variant_notes" noteType="note_standard" { ...passProps }
                    memoizedHasNoteChanged={this.memoized.hasNoteChanged}
                    otherDraftsUnsaved={isDraftInterpretationUnsaved || isDraftGeneNoteUnsaved} />
                );
                break;
            case "Gene Notes":
                panelToDisplay = (<GenericInterpretationPanel retainWIPStateOnUnmount={this.retainWIPStateOnUnmount}
                    lastWIPNote={gene_notes_wip} lastSavedNote={lastSavedGeneNote} noteLabel={currentTab}
                    key={1} saveToField="gene_notes" noteType="note_standard" { ...passProps }
                    memoizedHasNoteChanged={this.memoized.hasNoteChanged}
                    otherDraftsUnsaved={isDraftInterpretationUnsaved || isDraftVariantNoteUnsaved} />
                );
                break;
            case "Interpretation":
                panelToDisplay = (<GenericInterpretationPanel retainWIPStateOnUnmount={this.retainWIPStateOnUnmount}
                    lastWIPNote={interpretation_wip} lastSavedNote={lastSavedInterpretation} noteLabel={currentTab}
                    key={2} saveToField="interpretation" noteType="note_interpretation" { ...passProps }
                    memoizedHasNoteChanged={this.memoized.hasNoteChanged}
                    otherDraftsUnsaved={isDraftGeneNoteUnsaved || isDraftVariantNoteUnsaved} />
                );
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

function InterpretationSpaceHeader(props) { // Expanded items commented out until V2
    const { toggleExpanded, isExpanded } = props;
    return (
        <div className="interpretation-header card-header d-flex align-items-center justify-content-between">
            <i className="icon icon-poll-h fas"></i>
            Variant Interpretation
            <button type="button" className="btn btn-link" onClick={toggleExpanded || undefined} style={{ visibility: "hidden" }}>
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
    constructor(props) {
        super(props);

        const { note_text = "", acmg_guidelines = [], classification = null, conclusion =  "" } = props.lastWIPNote || props.lastSavedNote || {};

        this.state = {
            // Fields in form. Using snake casing to make it easier to add state data directly to post/patch request
            note_text,
            acmg_guidelines,            // TODO: Currently Unused
            classification,
            conclusion,                 // TODO: Currently Unused
        };

        this.saveStateAsDraft = this.saveStateAsDraft.bind(this);
        this.onTextChange = this.onTextChange.bind(this);
        this.onDropOptionChange = this.onDropOptionChange.bind(this);
    }

    componentDidUpdate(prevProps, prevState) {
        const { setIsSubmitting, isSubmitting, isSubmittingModalOpen, memoizedHasNoteChanged, lastSavedNote, otherDraftsUnsaved } = this.props;

        const isThisNoteUnsaved = memoizedHasNoteChanged(lastSavedNote, this.state);
        const anyNotesUnsaved = otherDraftsUnsaved || isThisNoteUnsaved;

        // Only trigger if switching from no unsaved to unsaved present or vice versa
        if (!isSubmitting && anyNotesUnsaved) {
            console.log("started submitting (warning will appear)");
            setIsSubmitting({
                modal: <UnsavedInterpretationModal {...{ isSubmittingModalOpen, setIsSubmitting, isSubmitting }}/>
            });
        } else if (isSubmitting && !anyNotesUnsaved) {
            console.log("no longer submitting (warning will no longer appear)");
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
        const { saveAsDraft, noteType, saveToField } = this.props;
        saveAsDraft(this.state, saveToField, noteType);
    }

    componentWillUnmount() { // Before unmounting (as in switching tabs), save unsaved changes in controller state
        const { saveToField, retainWIPStateOnUnmount, lastWIPNote, memoizedHasNoteChanged } = this.props;

        // Only trigger if note has changed since last save to state
        if (memoizedHasNoteChanged(lastWIPNote, this.state)) {
            console.log("note has changed... saving");
            retainWIPStateOnUnmount(this.state, `${saveToField}_wip`);
        }
    }

    render() {
        const { lastSavedNote = null, noteLabel, noteType, schemas, memoizedHasNoteChanged, caseSource } = this.props;
        const {
            note_text : savedNoteText = null,
            status: savedNoteStatus,
            last_modified: lastModified = null
        } = lastSavedNote || {};
        const { modified_by: { display_title : lastModUsername } = {}, date_modified = null } = lastModified || {};
        const { note_text: noteText, acmg_guidelines, classification, conclusion } = this.state;

        const noteChangedSinceLastSave = memoizedHasNoteChanged(lastSavedNote, this.state);
        const noteTextPresent = !!noteText;
        const isDraft = savedNoteStatus === "in review";
        const isCurrent = savedNoteStatus === "current";
        const isApproved = savedNoteStatus === "approved";

        return (
            <div className="interpretation-panel">
                <label className={`w-100 ${lastModUsername ? "mb-0" : ""}`}>
                    { noteLabel }
                </label>
                { lastModUsername ?
                    <div className="text-muted text-smaller my-1">Last Saved: <LocalizedTime timestamp={ date_modified } formatType="date-time-md" dateTimeSeparator=" at " /> by {lastModUsername} </div>
                    : null}
                <AutoGrowTextArea cls="w-100 mb-1" text={noteText} onTextChange={this.onTextChange} field="note_text" />
                { noteType === "note_interpretation" ?
                    <ACMGInterpretationForm {...{ schemas, acmg_guidelines, classification, conclusion, noteType }} onDropOptionChange={this.onDropOptionChange}/>
                    : null }
                <GenericInterpretationSubmitButton {...{ isCurrent, isApproved, isDraft, noteTextPresent, noteChangedSinceLastSave, noteLabel }}
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
            <div className="d-flex">
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
        isApproved,                 // Has saved to knowledge base
        noteTextPresent,            // Is there text in the note space
        noteChangedSinceLastSave,   // Has the text in the note space changed since last save
        saveAsDraft,                // Fx -- save as Draft
        cls
    } = props;

    const allButtonsDropsDisabled = !noteTextPresent || !noteChangedSinceLastSave;

    if (isCurrent || isApproved) {
        // No further steps allowed; saved to knowledgebase or approved to case
        return (
            <Button variant="primary btn-block" disabled={isCur} onClick={saveAsDraft} className={cls}>
                { isCurrent || isApproved  ? "Cannot edit - already approved" : null}
            </Button>);
    } else { // Brand new note OR previous draft; allow saving or re-saving as draft
        return (
            <Button variant="primary btn-block" onClick={saveAsDraft}
                disabled={allButtonsDropsDisabled}>
                { isDraft ? "Re-save as Draft": "Save as Draft" }
            </Button>
        );
    }
}

function UnsavedInterpretationModal(props) {
    const { href, isSubmittingModalOpen, isSubmitting, setIsSubmitting } = props;

    console.log("href", href);

    function discardAndNavigate() {
        setIsSubmitting(false, () => navigate(href, { 'skipRequest' : false, 'replace' : true }), false);
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
                        Continue Editing
                    </Button>
                </Modal.Footer>
            </Modal>
        </React.Fragment>
    );
}