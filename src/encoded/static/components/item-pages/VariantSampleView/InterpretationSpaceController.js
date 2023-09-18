'use strict';

import React, { useCallback, useMemo } from 'react';
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
import { AutoGrowTextArea } from './../components/AutoGrowTextArea';
import { SearchAsYouTypeLocal } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/SearchAsYouTypeLocal';

const onReturnToCaseClick = function(caseSource){
    if (window && window.opener) {
        window.close();
        return;
    }
    // Fallback if no parent window:
    return navigate(`/cases/${caseSource}/#case-info.interpretation`);
};

function GenericInterpretationSidebar(props) {
    const {
        headerTitle = "Interpretation Space",
        headerIconCls = "icon icon-poll-h fas",
        children = []
    } = props;

    return (
        <div className="card interpretation-space">
            <InterpretationSpaceHeader {...{ headerTitle, headerIconCls }} />
            <div className="card-body">
                {children}
            </div>
        </div>
    );
}


export class SNVIndelInterpretationSpace extends React.Component {
    render() {
        const { ...passProps } = this.props;
        return (
            <GenericInterpretationSidebar headerTitle="SNV / Indel Interpretation Space">
                <InterpretationSpaceWrapper {...passProps}/>
            </GenericInterpretationSidebar>
        );
    }
}

export class CNVInterpretationSpace extends React.Component {
    render() {
        console.log("CNVInterpretationSpace this.props", this.props);
        const { ...passProps } = this.props;
        return (
            <GenericInterpretationSidebar headerTitle="SV / CNV Interpretation Space">
                <InterpretationSpaceWrapper {...passProps} tabsToDisable={{ 2: true }} isCNV />
            </GenericInterpretationSidebar>
        );
    }
}

/**
 * @todo
 * Expanded items commented out until V2
 * We should probably have it expand out horizontally from side (?).
 */
export function InterpretationSpaceHeader(props) {
    const { headerIconCls, headerTitle } = props;
    return (
        <div className="interpretation-header card-header d-flex align-items-center justify-content-between">
            <i className={headerIconCls}></i>
            <span className="w-100 text-center">{headerTitle}</span>
        </div>
    );
}


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
     *      "gene_notes": <note obj> || [<note obj], // for sv, this will be an array of note objs
     *      "interpretation": <note obj>,
     *      "highlighted_genes": [ {"@id", "display_title"}] // only used for sv gene notes
     *      "loading": false,
     *      "user": null... etc. }
     */
    static initializeNoteState(context = {}) {
        const fields = ["variant_notes", "gene_notes", "interpretation", "discovery_interpretation", "highlighted_genes"];
        const newState = {};
        fields.forEach((field) => {
            const { [field]: note = null } = context;
            newState[field] = note; // for sv gene_notes, this will actually be an array
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
        const fieldsToCleanFromDiscovery = ["acmg_rules_invoked", "conclusion", "classification"];
        const fieldsToCleanFromStandard = ["acmg_rules_invoked", "conclusion", "classification", "gene_candidacy", "variant_candidacy"];

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
        this.postNewNote = this.postNewNote.bind(this);
        this.saveHighlightedGene = this.saveHighlightedGene.bind(this);
        // this.postNewMultiNote = this.postNewMultiNote.bind(this);
        this.patchNewNoteToVS = this.patchNewNoteToVS.bind(this);
        this.patchPreviouslySavedNote = this.patchPreviouslySavedNote.bind(this);
        this.saveAsDraft = this.saveAsDraft.bind(this);

        const { context = null } = props;
        this.state = InterpretationSpaceWrapper.initializeNoteState(context); // Ex. { variantNotes: <note linkto>, loading: false }
    }

    /**
     * Can be used for creating new drafts
     * @param {Object}   note     Object with at least 'note_text' field; typically state from GenericInterpretationPanel
     * @param {String}   noteType "note_interpretation" or "note_standard"
     */
    postNewNote(note, noteType) {
        const { context: { institution = null, project = null } = {} } = this.props;
        const { '@id': variantSampleInstitutionID } = institution || {};
        const { '@id': variantSampleProjectID } = project || {};

        const noteToSubmit = InterpretationSpaceWrapper.cleanUpNoteStateForPostPatch(note, noteType); // returns a cleaned clone

        noteToSubmit.institution = variantSampleInstitutionID;
        noteToSubmit.project = variantSampleProjectID;

        return ajax.promise(`/${noteType}/`, 'POST', {}, JSON.stringify(noteToSubmit));
    }

    // postNewMultiNote(notes, noteType) {
    //     const { context: { institution = null, project = null } = {} } = this.props;
    //     const { '@id': variantSampleInstitutionID } = institution || {};
    //     const { '@id': variantSampleProjectID } = project || {};

    //     const notesToSubmit = notes.map((note) => {
    //         const cleanedNote = InterpretationSpaceWrapper.cleanUpNoteStateForPostPatch(note, noteType);
    //         noteToSubmit.institution = variantSampleInstitutionID;
    //         noteToSubmit.project = variantSampleProjectID;
    //         return cleanedNote;
    //     });
    //     return ajax.promise(`/${noteType}/`, 'POST', {}, JSON.stringify(notesToSubmit));
    // }

    patchNewNoteToVS(noteAtID, saveToField) {
        const { context: { '@id': vsAtID = null } = {} } = this.props;
        return ajax.promise(vsAtID, 'PATCH', {}, JSON.stringify({ [saveToField]: noteAtID }));
    }

    patchPreviouslySavedNote(noteToPatch, noteType, noteAtID) { // ONLY USED FOR DRAFTS -- other notes are cloned
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

        let patchURL = noteAtID;

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

    saveHighlightedGene(highlightedGeneToPatch, successCallback) {
        const { context: { "@id": vsAtID, highlighted_genes: lastSavedHighlighted = [] } = {} } = this.props;
        let patchURL = vsAtID;
        let payload = JSON.stringify({});
        let postPatchState = null;

        if (!highlightedGeneToPatch) { // deleting previous value
            if (lastSavedHighlighted.length > 0) {
                patchURL += '?delete_fields=highlighted_genes';
            } else {
                throw new Error("Attempting to delete highlighted gene when there was no previous value.");
            }
        } else { // adding new value
            const { "@id": highlightedGeneAtID } = highlightedGeneToPatch;
            payload = JSON.stringify({ highlighted_genes: [ highlightedGeneAtID ] });
            postPatchState = [highlightedGeneToPatch];
        }

        this.setState({ "loading": true }, () => {
            ajax.promise(patchURL, 'PATCH', {}, payload)
                .then((response) => {
                    const { '@graph': graph = [], status } = response;
                    console.log("response", response);
                    if (graph.length === 0 || status === "error") {
                        this.setState({ "loading": false });
                        throw new Error(response);
                    }
                    this.setState({ "loading": false, "highlighted_genes": postPatchState }, successCallback);
                });
        });
    }

    // saveMultinoteAsDraft(note, stateFieldToUpdate, noteType = "note_standard", successCallback) {

    // }

    saveAsDraft(note, stateFieldToUpdate, noteType = "note_standard", successCallback) {
        const { [stateFieldToUpdate]: lastSavedNote } = this.state;

        // Does a draft already exist?
        if (lastSavedNote) { // Patch the pre-existing draft item & overwrite it
            console.log("Note already exists... need to patch pre-existing draft", lastSavedNote);
            const { "@id": noteAtID = null } = lastSavedNote;

            this.setState({ "loading": true }, () => {
                this.patchPreviouslySavedNote(note, noteType, noteAtID)
                    .then((response) => {
                        const { '@graph': graph = [], status } = response;
                        // Some handling for various fail responses/codes
                        if (graph.length === 0 || status === "error") {
                            throw new Error(response);
                        }

                        console.log("Successfully overwritten previous draft of note", response);
                        return ajax.promise(noteAtID + "?datastore=database", 'GET');
                    })
                    .then((noteWithEmbeds) => {
                        console.log("Successfully retrieved @@embedded representation of note", noteWithEmbeds);
                        this.setState({ "loading": false, [stateFieldToUpdate]: noteWithEmbeds }, successCallback);
                    })
                    .catch((err) => {
                        const { error: { message = null } = {} } = err || {};
                        console.error(err);
                        Alerts.queue({
                            title: "Error: Something went wrong while patching.",
                            message: message || "Your changes may not be saved.",
                            style: "danger"
                        });
                        this.setState({ "loading": false });
                    });
            });
        } else { // Create a whole new item, and patch to VS
            let newNoteID;

            this.setState({ "loading": true }, () => {
                this.postNewNote(note, noteType)
                    .then((response) => {
                        const { '@graph': noteItems = [], status } = response;

                        // Some handling for various fail responses/codes
                        if (noteItems.length === 0 || status === "error") {
                            throw new Error(response);
                        }

                        const [ noteItem ] = noteItems;
                        newNoteID = noteItem["@id"];
                        console.log("Successfully created new item", noteItem);

                        return this.patchNewNoteToVS(newNoteID, stateFieldToUpdate);
                    })
                    .then((resp) => {
                        const { '@graph': [ noteItem ], status } = resp;
                        if (status !== "success") {
                            // Assert this.patchNewNoteToVS(newNoteID, stateFieldToUpdate) succeeded.
                            // TODO: Check integrity of @graph
                            throw new Error(resp);
                        }
                        console.log("Successfully linked note object to variant sample", resp);
                        return ajax.promise(newNoteID + "?datastore=database", 'GET');
                    })
                    .then((noteWithEmbeds) => {
                        console.log("Successfully retrieved @@embedded representation of note: ", noteWithEmbeds);

                        // Full representation of item fetched... add this to state
                        this.setState({ "loading": false, [stateFieldToUpdate]: noteWithEmbeds }, successCallback);
                    })
                    .catch((err) => {
                        const { error: { message = null } = {} } = err || {};
                        console.error(err);
                        Alerts.queue({
                            title: "Error: Something went wrong while patching.",
                            message: message || "Your changes may not be saved.",
                            style: "danger"
                        });
                        this.setState({ "loading": false });
                    });
            });
        }
    }

    render() {
        const { variant_notes, gene_notes, interpretation, discovery_interpretation, highlighted_genes } = this.state;
        console.log("log2 this.state", this.state);
        return (
            <InterpretationSpaceController {...this.props}
                lastSavedHighlightedGene={highlighted_genes}
                lastSavedVariantNote={variant_notes}
                lastSavedGeneNote={gene_notes}
                lastSavedInterpretation={interpretation}
                lastSavedDiscovery={discovery_interpretation}
                saveAsDraft={this.saveAsDraft}
                saveHighlightedGene={this.saveHighlightedGene}/>
        );
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
            acmg_rules_invoked: lastSavedACMG = [],
        } = lastSavedNote || {};
        const {
            classification: currClassification = null,
            gene_candidacy: currGeneCandidacy = null,
            variant_candidacy: currVariantCandidacy = null,
            note_text: currNoteText = "",
            acmg_rules_invoked: currACMG = []
        } = currNote || {};

        if (currClassification !== lastSavedClassification ||
            currGeneCandidacy !== lastSavedGeneCandidacy ||
            currVariantCandidacy !== lastSavedVariantCandidacy ||
            !_.isEqual(currACMG, lastSavedACMG)
        ) {
            // console.log("acmg, classificaton, or candidacy does not match");
            return true;
        }

        if (lastSavedNoteText !== currNoteText) {
            // console.log("text does not match");
            return true;
        }

        // console.log("note has not changed");
        return false;
    }

    /**
     * @param {Map} wipHighlightedGene - map with highlighted gene passed down from SelectItemsController
     * @param {Array} lastSavedHighlightedGene - array of objects with highlighted gene atID and display title from InterpretationSpaceWrapper
     * @returns {boolean} True if highlighted gene has changed, False if it hasn't
     */
    static hasHighlightedGeneChanged(wipHighlightedGene, lastSavedHighlightedGene) {
        if (!wipHighlightedGene && !lastSavedHighlightedGene) { return false; } // probably on snv
        if (wipHighlightedGene.size === 0 && !lastSavedHighlightedGene) {
            return false;
        } else if (
            (wipHighlightedGene.size !== 0 && !lastSavedHighlightedGene) ||
            (wipHighlightedGene.size === 0 && lastSavedHighlightedGene)
        ) {
            return true;
        } else {
            // WIP is actually a version of "selectedItems"/is a Map
            const wipGeneAtID = wipHighlightedGene.keys().next().value || null;
            // If not null, lastSavedHighlightedGene is an object w/@id & display title
            const { 0: { "@id": lastSavedHighlightedGeneID } = [] } = lastSavedHighlightedGene || {};
            return wipGeneAtID !== lastSavedHighlightedGeneID;
        }
    }

    constructor(props) {
        super(props);
        const { lastSavedVariantNote, lastSavedGeneNote, lastSavedInterpretation, lastSavedDiscovery, defaultTab } = props;

        this.state = {
            // Initialize WIP states to last saved - if a tab is closed WIP progress is temporarily saved here
            "variant_notes_wip": lastSavedVariantNote,
            "gene_notes_wip": lastSavedGeneNote,
            "interpretation_wip": lastSavedInterpretation,
            "discovery_interpretation_wip": lastSavedDiscovery,
            // TODO: validate elsewhere - default to variantnotes
            "currentTab": (typeof defaultTab === "number" && defaultTab >= 0 && defaultTab < InterpretationSpaceController.tabNames.length) ? defaultTab : 0,
            "isExpanded": false // TODO - currently unused; V2
        };
        this.toggleExpanded = this.toggleExpanded.bind(this);
        this.switchToTab = this.switchToTab.bind(this);
        this.retainWIPStateOnUnmount = this.retainWIPStateOnUnmount.bind(this);

        this.memoized = {
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
        const {
            lastSavedHighlightedGene,   // state from InterpretationSpaceWrapper
            lastSavedGeneNote,          // state from InterpretationSpaceWrapper
            lastSavedVariantNote,       // state from InterpretationSpaceWrapper
            lastSavedInterpretation,    // state from InterpretationSpaceWrapper
            lastSavedDiscovery,         // state from InterpretationSpaceWrapper
            saveHighlightedGene,        // method from InterpretationSpaceWrapper
            selectedGenes,              // from selectedItemsController
            onSelectGene,               // from selectedItemsController
            onResetSelectedGenes,       // from selectedItemsController
            tabsToDisable = {},         // from CNVInterpretationSpace
            isFallback,                 // unused
            isCNV,                      // from CNVInterpretationSpace
            context,
            wipACMGSelections,          // from VariantSampleOverview
            autoClassification,         // from VariantSampleOverview
            toggleInvocation,           // from VariantSampleOverview
            actions
        } = this.props;

        const hasEditPermission = this.memoized.haveEditPermission(actions);
        const passProps = _.pick(this.props, 'saveAsDraft', 'schemas', 'caseSource', 'setIsSubmitting', 'isSubmitting', 'isSubmittingModalOpen' );
        const commonProps = {
            ...passProps, hasEditPermission, isFallback,
            "retainWIPStateOnUnmount": this.retainWIPStateOnUnmount,
            "noteLabel": InterpretationSpaceController.tabTitles[currentTab],
            "key": currentTab
        };

        // Check for changes in basic notes
        const isDraftVariantNoteUnsaved = InterpretationSpaceController.hasNoteChanged(variant_notes_wip, lastSavedVariantNote);
        const isDraftGeneNoteUnsaved = InterpretationSpaceController.hasNoteChanged(gene_notes_wip, lastSavedGeneNote);
        const isDraftDiscoveryUnsaved = InterpretationSpaceController.hasNoteChanged(discovery_interpretation_wip, lastSavedDiscovery);

        // Handle SV specific changes
        const isHighlightedGeneUnsaved = InterpretationSpaceController.hasHighlightedGeneChanged(selectedGenes, lastSavedHighlightedGene);
        const isGeneTabUnsaved = isCNV ? (isDraftGeneNoteUnsaved || isHighlightedGeneUnsaved) : isDraftGeneNoteUnsaved;

        // Check for ACMG changes from WIP
        const interpretationWIP = { ...interpretation_wip };
        interpretationWIP["acmg_rules_invoked"] = wipACMGSelections;
        const isDraftInterpretationUnsaved = InterpretationSpaceController.hasNoteChanged(interpretationWIP, lastSavedInterpretation);

        // Decide what panel to display based on currently selected tab index
        let panelToDisplay = null;
        switch(currentTab) {
            case (0): // Gene Notes
                var otherDraftsUnsaved = isDraftInterpretationUnsaved || isDraftVariantNoteUnsaved || isDraftDiscoveryUnsaved;
                if (isCNV) {
                    const highlightedGeneID_wip = selectedGenes.keys().next().value || null;
                    panelToDisplay = <SVGeneNotePanel {...commonProps} {...{
                        otherDraftsUnsaved,
                        saveHighlightedGene,
                        lastSavedGeneNote,
                        isHighlightedGeneUnsaved,
                        lastSavedHighlightedGene,
                        context,
                        highlightedGeneID_wip,
                        onSelectGene,
                        onResetSelectedGenes
                    }} />;
                } else {
                    panelToDisplay = (<GenericInterpretationPanel {...commonProps} {...{ otherDraftsUnsaved }}
                        lastWIPNote={gene_notes_wip} lastSavedNote={lastSavedGeneNote} saveToField="gene_notes" noteType="note_standard" />
                    );
                }
                break;
            case (1): // Variant Notes
                panelToDisplay = (<GenericInterpretationPanel {...commonProps}
                    lastWIPNote={variant_notes_wip} lastSavedNote={lastSavedVariantNote} saveToField="variant_notes" noteType="note_standard"
                    otherDraftsUnsaved={isDraftInterpretationUnsaved || isGeneTabUnsaved || isDraftDiscoveryUnsaved} />
                );
                break;
            case (2): // Interpretation
                panelToDisplay = (<GenericInterpretationPanel {...commonProps} wipACMGSelections={wipACMGSelections} {...{ autoClassification, toggleInvocation }}
                    lastWIPNote={interpretationWIP} lastSavedNote={lastSavedInterpretation} saveToField="interpretation" noteType="note_interpretation"
                    otherDraftsUnsaved={isGeneTabUnsaved || isDraftVariantNoteUnsaved || isDraftDiscoveryUnsaved} />
                );
                break;
            case (3): // Discovery
                panelToDisplay = (<GenericInterpretationPanel {...commonProps}
                    lastWIPNote={discovery_interpretation_wip} lastSavedNote={lastSavedDiscovery} saveToField="discovery_interpretation" noteType="note_discovery"
                    otherDraftsUnsaved={isGeneTabUnsaved || isDraftVariantNoteUnsaved || isDraftInterpretationUnsaved} />
                );
                break;
            default:
                break;
        }
        return (
            <>
                <InterpretationSpaceTabs {...{ tabsToDisable, currentTab, isDraftDiscoveryUnsaved, isDraftVariantNoteUnsaved,
                    isDraftInterpretationUnsaved, isGeneTabUnsaved }} switchToTab={this.switchToTab} />
                { panelToDisplay }
            </>
        );
    }
}

function GenericInterpretationSpaceTabBtn(props) {
    const { disabled, tabName, tooltip = null, onClick, isActive = false, unsavedDraft = false, cls = "" } = props;
    const className = `${cls} btn btn-xs ${isActive ? "btn-primary-dark": "btn-link"} ${unsavedDraft ? 'font-italic': ""}`;
    return (
        <div data-tip={disabled ? "Coming Soon": ""}>
            <button type="button" data-tip={tooltip} {...{ onClick, className, disabled }}>
                { tabName }{ unsavedDraft && <span className="text-danger text-600">*</span>}
            </button>
        </div>
    );
}

function GenericInterpretationSpaceTabNav(props) {
    const { children = [] } = props;

    return (
        <div className="interpretation-tabs p-1 d-flex align-items-center justify-content-around">
            {children}
        </div>
    );
}

/**
 * @module
 * @todo
 * Potentially move stuff below this line (and maybe above <div className="card interpretation-space">...</div>
 * from InterpretationSpaceController) into new file InterpretationSpaceView.js.
 */

function InterpretationSpaceTabs(props) {
    const { tabsToDisable, currentTab, switchToTab, isDraftDiscoveryUnsaved, isGeneTabUnsaved, isDraftInterpretationUnsaved, isDraftVariantNoteUnsaved } = props;
    const tabIndexToUnsavedDraft = {
        0: isGeneTabUnsaved, // includes changes to highlighted gene and gene note
        1: isDraftVariantNoteUnsaved,
        2: isDraftInterpretationUnsaved,
        3: isDraftDiscoveryUnsaved
    };

    // Maybe memoize?
    const tabsRender = InterpretationSpaceController.tabNames.map((tabName, i) => {
        const isActive = currentTab === i;
        const unsavedDraft = tabIndexToUnsavedDraft[i];
        const tooltip = unsavedDraft ? "Unsaved changes": null;
        const onClick = (e) => switchToTab(i);
        const disabled = tabsToDisable[i] || false;
        return (
            <GenericInterpretationSpaceTabBtn key={i} {...{ tooltip, onClick, unsavedDraft, isActive, tabName, disabled }} />
        );
    });

    return (
        <GenericInterpretationSpaceTabNav>
            { tabsRender }
        </GenericInterpretationSpaceTabNav>
    );
}

const refreshParentWindowVariantSampleList = _.debounce(function(){
    window.opener.postMessage({ "action": "refresh-variant-sample-list" });
}, 1200, false); // Debounced to prevent accidental double-clicks & (too-)rapid changes

class SVGeneNotePanel extends React.PureComponent {
    constructor(props) {
        super(props);

        const { lastSavedGeneNote = [] } = this.props;

        this.state = {
            gene_notes: lastSavedGeneNote || [],
        };

        this.selectNewGene = this.selectNewGene.bind(this);
        this.onTextAreaChange = this.onTextAreaChange.bind(this);
        this.clearSelectedGene = this.clearSelectedGene.bind(this);
        this.saveHighlightedGeneWrapper = this.saveHighlightedGeneWrapper.bind(this);
    }

    componentDidUpdate(prevProps, prevState) {
        const { setIsSubmitting, isSubmitting, isHighlightedGeneUnsaved, otherDraftsUnsaved } = this.props;

        // TODO: will need to check for updates to gene_notes field itself in future
        const anyNotesUnsaved = otherDraftsUnsaved || isHighlightedGeneUnsaved;

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

    onTextAreaChange(value, idx) {
        /** Needs to be updated to work with multiple indeces of notes in future */
        const { gene_notes: [ { associated_items = [] } = {} ] = [] } = this.state;
        const newState = [{ note_text: value, associated_items }];
        this.setState({ gene_notes: newState });
    }

    selectNewGene(geneId, idx) {
        /** Needs to be updated to work with multiple indeces of notes in future */
        const { gene_notes = [] } = this.state;
        const numNotes = gene_notes.length;

        if (!numNotes) {
            // initialize first note object
            const firstNote = {};
            const associatedItems = { item_type: "Gene", item_identifier: geneId };
            firstNote.associated_items = [associatedItems];

            // update state with new item
            const newState = [];
            newState.push(firstNote);
            this.setState({ gene_notes: newState });
        } else {
            const newState = [...gene_notes]; // todo: may need to deeper clone?

            if (idx !== 0 && !idx) { throw new Error ("No idx passed into selectNewGene");}
            if (gene_notes[idx]) { // note exists, update old object
                if (gene_notes[idx].note_text) { // check for note text
                    // query user to confirm they want to overwrite old note
                    const okToOverwrite = confirm("Switching genes will delete current gene note. Is this okay?");
                    if (okToOverwrite) {
                        const updatedNote = { ...newState[idx] };
                        updatedNote.associated_items[0].item_identifier = geneId;
                        updatedNote.note_text = "";
                        this.setState({ gene_notes: [updatedNote] });
                    }
                } else {
                    const updatedNote = { ...newState[idx] };
                    updatedNote.associated_items[0].item_identifier = geneId;
                    updatedNote.note_text = "";
                    this.setState({ gene_notes: [updatedNote] });
                }
            } else { // note doesn't exist yet; create new obj
                const associatedItems = { item_type: "Gene", item_identifier: geneId };
                newNote.associated_items = [associatedItems];
                newState.push(newNote);
            }
        }
    }

    clearSelectedGene(idx) {
        /** Needs to be updated to work with multiple indeces of notes in future */
        this.setState({ gene_notes: [] });
    }

    // Wrapping passed in functions so as to call them with this component's state, then pass down to children
    saveHighlightedGeneWrapper(highlightedGene) {
        const { saveHighlightedGene, retainWIPStateOnUnmount, noteType, saveToField } = this.props;
        saveHighlightedGene(highlightedGene, function(){
            // Success Callback
            if (window && window.opener) {
                // If parent window exists, refresh it (if listener exists in it for this event)
                refreshParentWindowVariantSampleList();
            }
        });
        // retainWIPStateOnUnmount(this.state, `${saveToField}_wip`);
    }

    /**
    componentWillUnmount() {
        // TODO: Before unmounting (as in switching tabs), will need to save unsaved changes in controller state
        const { saveToField, retainWIPStateOnUnmount, lastWIPNote } = this.props;

        // Only trigger if note has changed since last soft save (WIP)
        if (InterpretationSpaceController.hasNoteChanged(lastWIPNote, this.state)) {
            // console.log("note has changed since last soft save... updating WIP");
            retainWIPStateOnUnmount(this.state, `${saveToField}_wip`);
        }
    }
    **/

    render() {
        const { gene_notes } = this.state;
        const {
            context,
            highlightedGeneID_wip,
            isHighlightedGeneUnsaved,
            onSelectGene,
            onResetSelectedGenes,
            noteLabel,
            noteType,
            schemas, // not in use
            caseSource,
            hasEditPermission,
            isCurrent, // not in use yet
            isApproved, // not in use yet
            isDraft, // not in use yet
            // noteChangedSinceLastSave // not in use yet
        } = this.props;

        const noteTextPresent = gene_notes.length > 0 || (gene_notes.length === 1 && gene_notes[0].note_text);

        // Generate a list of genes for passing into other fields
        const { structural_variant: { transcript: transcripts = [] } = {}, highlighted_gene: highlightedGene = [] } = context;

        const geneAtIDToGeneMap = {};

        let geneEnsgids = []; // needed for calculating Saytajax searchhref

        transcripts.forEach((transcript) => {
            const { csq_gene = null } = transcript;
            const { "@id": atID = null, ensgid } = csq_gene || {};
            geneAtIDToGeneMap[atID] = csq_gene;
            geneEnsgids.push(ensgid);
        });

        const genes = Object.keys(geneAtIDToGeneMap);
        geneEnsgids = _.uniq(geneEnsgids, false); // free of duplicates


        return (
            <div className="interpretation-panel">
                <label className="w-100">{ noteLabel }</label>
                <HighlightedGenesDrop selectedGeneID={highlightedGeneID_wip} {...{ geneEnsgids, genes, geneAtIDToGeneMap, onSelectGene, onResetSelectedGenes, highlightedGene }}/>
                {/* <NoteArray notes={gene_notes} onEditNote={this.onTextAreaChange} selectNewGene={this.selectNewGene} clearSelectedGene={this.clearSelectedGene} {...{ genes, geneAtIDToGeneMap }} /> */}
                {/* { (lastModUsernameFromNew || lastModUsername) ?
                    <div className="text-muted text-smaller my-1">Last Saved: <LocalizedTime timestamp={ date_modified } formatType="date-time-md" dateTimeSeparator=" at " /> by {lastModUsernameFromNew || lastModUsername} </div>
                : null*/}
                {/* <GenericInterpretationSubmitButton cls="mt-05" {...{ hasEditPermission, isCurrent, isApproved, isDraft, noteTextPresent, noteType }}
                    noteChangedSinceLastSave={isHighlightedGeneUnsaved}
                /> */}
                <SVGeneInterpretationSubmitButton highlightedGeneChangedSinceLastSave={isHighlightedGeneUnsaved} selectedGeneID={highlightedGeneID_wip}
                    {...{ hasEditPermission, geneAtIDToGeneMap }} saveHighlightedGene={this.saveHighlightedGeneWrapper} />
                { caseSource ?
                    <button type="button" className="btn btn-primary btn-block mt-05" onClick={() => onReturnToCaseClick(caseSource)}>
                        Return to Case
                    </button> : null}
            </div>
        );
    }
}

function NoteArray(props) {
    const { notes = [], onEditNote, genes, geneAtIDToGeneMap, selectNewGene, clearSelectedGene } = props;

    if (!notes.length) {
        return (
            <div>
                <GenesDrop noteIdx={notes.length} value={null} {...{ genes, geneAtIDToGeneMap, selectNewGene }} />
            </div>
        );
    }

    return (
        <>
            {notes.map((note, idx) => {
                const { associated_items: [associated_item] = [], note_text = "" } = note;
                if (!associated_item) return null;
                const { item_type, item_identifier } = associated_item;
                console.log("item_type, item_identifier", item_type, item_identifier);
                const geneDisplayTitle = geneAtIDToGeneMap[item_identifier].display_title;

                return (
                    <div key={idx}>
                        <GenesDrop noteIdx={idx} value={item_identifier} {...{ genes, geneAtIDToGeneMap, selectNewGene, clearSelectedGene }} />
                        <label className="w-100 mt-1">
                            {geneDisplayTitle} Gene Note
                        </label>
                        <AutoGrowTextArea className="w-100 mb-1" value={note_text} onChange={(e) => onEditNote(e.target.value, idx)} placeholder="Required" />
                    </div>
                );
            })}
        </>
    );

}

function GenesDrop(props) {
    const { geneAtIDToGeneMap = {}, genes, noteIdx, value, selectNewGene, clearSelectedGene, cls = "" } = props;

    let dropOptions;
    let title;
    if (genes.length > 0) {
        dropOptions = genes.map((geneID) => {
            const { display_title, "@id": atID } = geneAtIDToGeneMap[geneID];

            return (
                <Dropdown.Item onClick={() => selectNewGene(atID, noteIdx)} key={geneID}>
                    { display_title }
                </Dropdown.Item>
            );
        });

        if (value) {
            title = geneAtIDToGeneMap[value].display_title;
        }
    }
    return (
        <>
            <label className="w-100 text-small mt-1">
                Add Gene Note
            </label>
            <div className="w-100 d-flex note-field-drop">
                <Dropdown as={ButtonGroup} className={cls}>
                    <Dropdown.Toggle variant="outline-secondary text-left">
                        { title || "Select a gene to interpret..." }
                    </Dropdown.Toggle>
                    <Dropdown.Menu>{ dropOptions }</Dropdown.Menu>
                </Dropdown>
                { value ?
                    <Button variant="danger" className={cls + ' ml-03'} onClick={() => clearSelectedGene()}>
                        <i className="icon icon-trash-alt fas" />
                    </Button>
                    : null}
            </div>
        </>
    );
}

function HighlightedGenesDrop(props) {
    const { selectedGeneID, genes, geneAtIDToGeneMap, cls = "", selectedGenes, onSelectGene, onResetSelectedGenes, highlightedGene } = props;

    // let dropOptions;

    // let value;
    // if (genes.length > 0) {
    //     dropOptions = genes.map((geneID) => {
    //         const { display_title } = geneAtIDToGeneMap[geneID];
    //         return (
    //             <Dropdown.Item onClick={() => onSelectGene(geneAtIDToGeneMap[geneID])} key={geneID}>
    //                 { display_title }
    //             </Dropdown.Item>
    //         );
    //     });

    //     if (selectedGeneID) {
    //         value = geneAtIDToGeneMap[selectedGeneID].display_title;
    //     }
    // }

    function optionRenderFunction(resultAtID) {
        const { display_title } = geneAtIDToGeneMap[resultAtID];
        return (
            <div key={resultAtID} className="py-1">
                <h5 className="text-300 text-truncate my-0">{ display_title }</h5>
                {/* <h6 className="text-mono text-400 text-truncate my-0">{ resultAtID }</h6> */}
            </div>
        );
    }

    function titleRenderFunction(resultAtID){
        const { display_title } = geneAtIDToGeneMap[resultAtID];
        return display_title;
    }

    /** TODO: get more feedback on how @id version should work - consequence of SV shown on transcript col or actual gene id? 
     * This should also probably be memoized somehow for performance, if possible
    */
    function customFilterFunction(currentTextValue, searchList, filterMethodForDisplayTitle) {
        // const regexQueryForAtID = SearchAsYouTypeLocal.getRegexQuery(currentTextValue, "includes"); // always needs to be this because of way ensgid is structured
        const regexQueryForDisplayTitle = SearchAsYouTypeLocal.getRegexQuery(currentTextValue, filterMethodForDisplayTitle);

        return searchList.filter(function(atID){
            // match if atID is a match
            // const lowerAtID = atID.toLowerCase();
            // const atIDMatches = lowerAtID.match(regexQueryForAtID);

            // also check if display_title is a match
            const { display_title } = geneAtIDToGeneMap[atID];
            const lowerDisplayTitle = display_title.toLowerCase();
            const displayTitleMatches = lowerDisplayTitle.match(regexQueryForDisplayTitle);

            return !!(displayTitleMatches); // !!(atIDMatches || displayTitleMatches)
        });
    }

    return (
        <>
            <label className="w-100 text-small">
                <i className="icon icon-star text-primary fas icon-fw"></i> Selected Gene for Interpretation
            </label>
            <div className="w-100 d-flex note-field-drop mb-1">
                <SearchAsYouTypeLocal className={cls} searchList={genes} value={selectedGeneID} allowCustomValue={false}
                    filterMethod="includes" onChange={(atID) => { onSelectGene((geneAtIDToGeneMap[atID])); } }
                    maxResults={3} {...{ optionRenderFunction, titleRenderFunction, customFilterFunction }} />
                {/* <Dropdown as={ButtonGroup} className={cls}> // keeping this around in case there are issues.
                    <Dropdown.Toggle variant="outline-secondary text-left">
                        { value || "Select an option..." }
                    </Dropdown.Toggle>
                    <Dropdown.Menu>{ dropOptions }</Dropdown.Menu>
                </Dropdown> */}
                { selectedGeneID ?
                    <Button variant="danger" className={cls + ' ml-03'} onClick={() => onResetSelectedGenes(highlightedGene)}>
                        <i className="icon icon-trash-alt fas" />
                    </Button>
                    : null}
            </div>
        </>
    );
}

class GenericInterpretationPanel extends React.PureComponent {
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
        this.onTextAreaChange = this.onTextAreaChange.bind(this);
        this.onDropOptionChange = this.onDropOptionChange.bind(this);
    }

    componentDidUpdate(prevProps, prevState) {
        const { setIsSubmitting, wipACMGSelections, isSubmitting, lastSavedNote, otherDraftsUnsaved } = this.props;

        const savedState = { ...this.state };
        savedState.acmg_rules_invoked = wipACMGSelections;

        const isThisNoteUnsaved = InterpretationSpaceController.hasNoteChanged(lastSavedNote, savedState);
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
    onTextAreaChange(event) {
        const { value: newValue } = event.target || {};
        this.setState({ "note_text": newValue });
    }

    // Using same update fxn for multiple dropdowns
    onDropOptionChange(stateToChange, newValue) {
        this.setState({ [stateToChange]: newValue });
    }

    // Wrapping passed in functions so as to call them with this component's state, then pass down to children
    saveStateAsDraft() {
        const { saveAsDraft, retainWIPStateOnUnmount, noteType, saveToField, wipACMGSelections } = this.props;
        const stateToSave = { ...this.state };
        stateToSave.acmg_rules_invoked = wipACMGSelections;
        saveAsDraft(stateToSave, saveToField, noteType, function(){
            // Success Callback
            if (window && window.opener) {
                // If parent window exists, refresh it (if listener exists in it for this event)
                refreshParentWindowVariantSampleList();
            }
        });
        retainWIPStateOnUnmount(this.state, `${saveToField}_wip`);
    }

    componentWillUnmount() { // Before unmounting (as in switching tabs), save unsaved changes in controller state
        const { saveToField, retainWIPStateOnUnmount, lastWIPNote } = this.props;

        // Only trigger if note has changed since last soft save (WIP)
        if (InterpretationSpaceController.hasNoteChanged(lastWIPNote, this.state)) {
            // console.log("note has changed since last soft save... updating WIP");
            retainWIPStateOnUnmount(this.state, `${saveToField}_wip`);
        }
    }

    render() {
        const { lastSavedNote = null, wipACMGSelections, noteLabel, noteType, schemas, caseSource, hasEditPermission, autoClassification, toggleInvocation, isFallback } = this.props;
        const {
            status: savedNoteStatus,
            last_modified: lastModified = null
        } = lastSavedNote || {};
        const {
            modified_by: {
                display_title: lastModUsername,
                title: lastModUsernameFromNew
            } = {},
            date_modified = null
        } = lastModified || {};
        const { note_text: noteText, classification, gene_candidacy, variant_candidacy, conclusion } = this.state;


        const stateToSave = { ...this.state };
        stateToSave.acmg_rules_invoked = wipACMGSelections;

        const noteChangedSinceLastSave = InterpretationSpaceController.hasNoteChanged(lastSavedNote, stateToSave);
        const noteTextPresent = !!noteText;
        const isDraft = savedNoteStatus === "in review";
        const isCurrent = savedNoteStatus === "current";
        const isApproved = savedNoteStatus === "approved";
        // console.log("GenericInterpretationPanel state", stateToSave);
        // console.log("lastSavedNote", lastSavedNote);


        return (
            <div className="interpretation-panel">
                <label className={`w-100 ${(lastModUsernameFromNew || lastModUsername) ? "mb-0" : ""}`}>
                    { noteLabel }
                </label>
                { (lastModUsernameFromNew || lastModUsername) ?
                    <div className="text-muted text-smaller my-1">Last Saved: <LocalizedTime timestamp={ date_modified } formatType="date-time-md" dateTimeSeparator=" at " /> by {lastModUsernameFromNew || lastModUsername} </div>
                    : null}
                <AutoGrowTextArea disabled={isFallback} className="w-100 mb-1" value={noteText} onChange={this.onTextAreaChange} placeholder="Required" />
                { noteType === "note_interpretation" ?
                    <GenericFieldForm {...{ isFallback }} fieldsArr={[{ field: 'classification', value: classification }, { field: 'acmg_rules_invoked', value: wipACMGSelections, autoClassification, toggleInvocation }]} {...{ schemas, noteType }} onDropOptionChange={this.onDropOptionChange}/>
                    : null }
                { noteType === "note_discovery" ?
                    <GenericFieldForm fieldsArr={[{ field: 'gene_candidacy', value: gene_candidacy }, { field: 'variant_candidacy', value: variant_candidacy }]}
                        {...{ schemas, noteType, isFallback }} onDropOptionChange={this.onDropOptionChange}/>
                    : null }
                <GenericInterpretationSubmitButton {...{ hasEditPermission, isFallback, isCurrent, isApproved, isDraft, noteTextPresent, noteChangedSinceLastSave, noteType }}
                    saveAsDraft={this.saveStateAsDraft}
                />
                { caseSource ?
                    <button type="button" className="btn btn-primary btn-block mt-05" onClick={() => onReturnToCaseClick(caseSource)}>
                        Return to Case
                    </button> : null}
            </div>
        );
    }
}

/**
 * Generates a dropdown with options from schema enums for a particular field, w/clear button and status indicator dots.
 * Currently only used for classification, but can be used in future for variant/gene candidacy dropdowns (and maybe as a stopgap for ACMG).
 */
function NoteFieldDrop(props) {
    const { isFallback, value = null, schemas = null, field = null, noteType = null, onOptionChange, cls="mb-1", getFieldProperties } = props;
    if (!schemas) {
        return null;
    }

    const disableInputs = isFallback; // Made its own variable in case we add perm checks in future
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
                    <Dropdown.Toggle disabled={disableInputs} variant="outline-secondary text-left" id="dropdown-basic">
                        { value ? <><i className="status-indicator-dot ml-1 mr-07" data-status={value} /> { value }</> : "Select an option..."}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>{ dropOptions }</Dropdown.Menu>
                </Dropdown>
                { value ?
                    <Button disabled={disableInputs} variant="danger" className={cls + ' ml-03'} onClick={() => onOptionChange(field, null)}>
                        <i className="icon icon-trash-alt fas" />
                    </Button>
                    : null}
            </div>
        </React.Fragment>
    );
}

// /** Currently unused; may decide to use a static sized window & style with CSS to autogrow */
// class NoGrowTextArea extends React.Component {
//     constructor(props) {
//         super(props);
//         this.onChangeWrapper = this.onChangeWrapper.bind(this);
//     }
//     onChangeWrapper(e) {
//         const { onTextChange, field } = this.props;
//         onTextChange(e, field);
//     }
//     render() {
//         const { text, cls = "w-100 mb-1 flex-grow-1" } = this.props;
//         return (
//             <div className={cls} style={{ minHeight: "135px" }}>
//                 <textarea value={text} ref={this.textAreaRef} rows={5} style={{ height: "100%", resize: "none", minHeight: "70px" }} className="w-100"
//                     onChange={this.onChangeWrapper} />
//             </div>
//         );
//     }
// }


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
    const { fieldsArr = [], schemas, onDropOptionChange, noteType, isFallback } = props;

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
            if (field === "acmg_rules_invoked") {
                return (
                    <ACMGPicker key={field} selections={value} {...{ schemas, field, autoClassification, toggleInvocation, getFieldProperties, isFallback }}/>
                );
            }
            return (
                <NoteFieldDrop key={field} {...{ schemas, noteType, value, field, getFieldProperties, isFallback }}
                    onOptionChange={onDropOptionChange} />
            );
        }).sort().reverse(); // Reverse really just to get Variant candidacy to show up last. May need a better solution if more fields added in future.
    }, [ schemas, noteType, fieldsArr ]);

    return (
        <React.Fragment>
            { fieldsJSX }
        </React.Fragment>);
}

function ACMGPicker(props) {
    const { field, selections = [], schemas = null, getFieldProperties, autoClassification, toggleInvocation, isFallback } = props;
    if (!schemas) {
        return null;
    }

    const fieldSchema = getFieldProperties(field);
    const { title = null, description = null, enum: static_enum = [] } = fieldSchema;

    const picked = selections.map(function(selection, i){
        return <ACMGPickerOption {...{ selection, toggleInvocation, isFallback }} key={i} />;
    });

    return (
        <React.Fragment>
            <label className="w-100 text-small">
                { title } { description ? <i className="icon icon-info-circle fas icon-fw ml-05" data-tip={description} /> : null }
            </label>
            <div className="w-100 d-flex flex-wrap acmg-picker mb-08">
                { selections.length > 0 ? picked : <div className="acmg-invoker text-muted" data-tip={"Use the picker above to make invocations."} data-criteria="none">None</div>}
            </div>

            { autoClassification ?
                <React.Fragment>
                    <label className="w-100 text-small">CGAP&apos;s Classification:</label>
                    <div className="w-100 mb-08 ml-1">
                        <i className="status-indicator-dot ml-1 mr-1" data-status={autoClassification} />{autoClassification}
                    </div>
                </React.Fragment>
                : null }
        </React.Fragment>
    );
}

export const ACMGPickerOption = React.memo(function ACMGPickerOption (props) {
    const {
        selection,
        isFallback = false,
        toggleInvocation,
        onToggleCallback = null,
        className = "mr-01 ml-01"
    } = props;
    const {
        rule_strength: strength,
        acmg_rule_name: rule
    } = selection;

    const onClick = useCallback(function(e){
        if (isFallback) return false;
        return toggleInvocation(selection, onToggleCallback);
    }, [ selection, onToggleCallback ]);

    // Display "Very Strong" as "VeryStrong" to match ACMG standard instead of schema enum
    let strengthNoSpaces;
    if (strength === "Very Strong") {
        strengthNoSpaces = strength.split(" ").join("");
    }

    const cls = "acmg-invoker " + (isFallback ? "unclickable" : "clickable") + (className? " " + className : "");

    return (
        <div className={cls} key={rule} data-criteria={rule} data-invoked={!!(strength)}
            data-tip={!isFallback ? "Click to deselect this rule": null} onClick={onClick}>
            { rule }{ strength && strength !== "Default" ? ("_" + (strengthNoSpaces || strength)) : null }
        </div>
    );
});

function getTooltipPerNoteType(noteType) {
    switch(noteType) {
        case "note_interpretation":
            return "Note text required to save ACMG classification";
        case "note_discovery":
            return "Note text required to save discovery interpretation";
        case "note_standard":
            return "Note text required to save";
        default:
            return null;
    }
}

function SVGeneInterpretationSubmitButton(props) {
    const {
        geneAtIDToGeneMap,
        highlightedGeneChangedSinceLastSave,
        saveHighlightedGene,
        hasEditPermission,
        selectedGeneID,
        cls = ""
    } = props;

    return (
        <div data-tip={!hasEditPermission ? "You must be added to the project to submit a note for this item.": null }>
            <Button variant="primary" className={"btn-block " + cls} onClick={() => saveHighlightedGene(geneAtIDToGeneMap[selectedGeneID])}
                disabled={!hasEditPermission || !highlightedGeneChangedSinceLastSave}>
                { !hasEditPermission ? "Need Edit Permission": "Save Highlighted Gene" }
            </Button>
        </div>
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
        cls = "",                   // Classes to apply to the button
        hasEditPermission,          // Derived from actions
        noteType,                   // "note_interpretation", "note_discovery", etc.
        isFallback                  // Determined on render in VariantSampleOverview - is this using embed api "newContext" or context as fallback
    } = props;

    const allButtonsDropsDisabled = !noteTextPresent || !noteChangedSinceLastSave || isFallback;

    const dataTip = isFallback ? "Unable to retrieve most recent version of this note. Reload the page to try again.":
        !hasEditPermission ? "You must be added to the project to submit a note for this item." :
            !noteTextPresent ? getTooltipPerNoteType(noteType) : null;

    if (isCurrent || isApproved || !hasEditPermission) {
        // No further steps allowed; saved to knowledgebase or approved to case
        return (
            <div data-tip={dataTip}>
                <Button variant="primary" disabled className={"btn-block " + cls}>
                    { !hasEditPermission ? "Need Edit Permission" : "Cannot edit - already approved" }
                </Button>
            </div>
        );
    } else { // Brand new draft OR previous draft; allow saving or re-saving as draft
        return (
            <div data-tip={dataTip}>
                <Button variant="primary" className={"btn-block " + cls} onClick={saveAsDraft} data-tip={dataTip}
                    disabled={allButtonsDropsDisabled}>
                    { isDraft ? "Re-save as Draft": "Save as Draft" }
                </Button>
            </div>
        );
    }
}

function UnsavedInterpretationModal(props) {
    const { href, setIsSubmitting } = props;

    const onHide = useCallback(function(){
        setIsSubmitting(false, null, false);
    });

    const discardAndNavigate = useCallback(function(){
        setIsSubmitting(false, () => navigate(href, { 'skipRequest' : false, 'replace': false }), false);
    });

    return (
        <React.Fragment>
            <Modal show={true} onHide={onHide} centered>
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
                    <button type="button" className="btn btn-danger flex-grow-1" onClick={discardAndNavigate}>
                        Navigate Away & Discard Notes
                    </button>
                    <button type="button" className="btn btn-primary flex-grow-1" variant="primary" onClick={onHide}>
                        Back to Notes
                    </button>
                </Modal.Footer>
            </Modal>
        </React.Fragment>
    );
}
