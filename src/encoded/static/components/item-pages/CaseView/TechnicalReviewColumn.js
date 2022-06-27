'use strict';

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import _ from 'underscore';
import memoize from 'memoize-one';
import Popover from 'react-bootstrap/esm/Popover';
import ReactTooltip from 'react-tooltip';
import { ajax, JWT, console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { PatchItemsProgress } from './../../util/PatchItemsProgress';



export class TechnicalReviewColumn extends React.PureComponent {

    /**
     * @param {{ "@id": string }?} projectTechnicalReview - VariantSample.project_technical_review
     * @param {{ "@id": string, "status": string }?} lastSavedTechnicalReview - May be `savedTechnicalReview` (context field) or `lastSavedTechnicalReview` (state)
     * @returns {{ isTechnicalReviewSavedToProject: boolean, justSavedToProject: boolean, justRemovedFromProject: boolan }}
     */
    static projectTechnicalReviewInformation(projectTechnicalReview, lastSavedTechnicalReview) {
        const { "@id": projectTechnicalReviewAtID } = projectTechnicalReview || {};
        const { "@id": lastSavedTechnicalReviewItemAtID, status: lastSavedStatus } = lastSavedTechnicalReview || {};

        // We could theoretically just check if lastSavedStatus === "current" (should always be true when isTechnicalReviewSavedToProject)
        // but this gives us some more explicitness - i.e. we can have isTechnicalReviewSavedToProject==true and justSavedToProject==false when just deleted,
        // or have justSavedToProjec==true and isTechnicalReviewSavedToProject==false when just created.
        const isTechnicalReviewSavedToProject = (
            projectTechnicalReviewAtID
            && lastSavedTechnicalReviewItemAtID
            && (lastSavedTechnicalReviewItemAtID === projectTechnicalReviewAtID)
        ) || false;
        const justSavedToProject = lastSavedStatus === "current"; // Should always be true when isTechnicalReviewSavedToProject is true, unless _just_ removed.
        const justRemovedFromProject = isTechnicalReviewSavedToProject && !justSavedToProject;

        // Hmm, can rename to: isIndexedToProject, isSavedToProject, isJustRemovedFromProject ?
        return { isTechnicalReviewSavedToProject, justSavedToProject, justRemovedFromProject };
    }

    static classificationOptions = {
        "snv": {
            "call": [
                "Present",
                "Low Coverage",
                "Low Allelic Fraction",
                "Low Mapping Quality",
                "Strand Bias",
                "Mendelian Error",
                "Other"
            ],
            "noCall": [
                "Recurrent Artifact",
                "Low Coverage",
                "Low Allelic Fraction",
                "Low Mapping Quality",
                "Strand Bias",
                "Mendelian Error",
                "Other"
            ]
        },
        "cnv": {
            "call": [
                "Present",
                "Recurrent Artifact",
                "Low Allelic Fraction",
                "Low Mapping Quality",
                "Repeat Region",
                "Mendelian Error",
                "No Depth Change",
                "No Split Reads",
                "No Spanning Reads",
                "Other"
            ],
            "noCall": [
                "Recurrent Artifact",
                "Low Allelic Fraction",
                "Low Mapping Quality",
                "Repeat Region",
                "Mendelian Error",
                "No Depth Change",
                "No Split Reads",
                "No Spanning Reads",
                "Other"
            ]
        }
    };

    constructor(props){
        super(props);

        this.updateUnsavedNoteText = _.debounce(this.updateUnsavedNoteText.bind(this), 500);
        this.unsetLastSavedTechnicalReviewIfUpdated = this.unsetLastSavedTechnicalReviewIfUpdated.bind(this);
        this.handleOpenDropdownCall = this.handleOpenDropdownCall.bind(this);
        this.handleOpenDropdownNoCall = this.handleOpenDropdownNoCall.bind(this);
        this.handleOpenNotesPopover = this.handleOpenNotesPopover.bind(this);

        this.callTrueButtonRef = React.createRef();
        this.callFalseButtonRef = React.createRef();
        this.notesButtonRef = React.createRef();

        this.memoized = {
            "compareSavedToCache": memoize(TechnicalReviewController.compareSavedToCache),
            "projectTechnicalReviewInformation": memoize(TechnicalReviewColumn.projectTechnicalReviewInformation),
            "isCNV": memoize(function(vsItem){
                const { "@type": [ primaryItemType ] } = vsItem;
                return primaryItemType === "StructuralVariantSample";
            })
        };

        this.state = {
            "isUpdating" : false,
            // TODO: Migrate this to higher-level state so is cached if search table row is dismounted.
            "noteText": null
        };

    }

    componentDidMount(){
        this.unsetLastSavedTechnicalReviewIfUpdated();
    }

    componentDidUpdate(pastProps){
        this.unsetLastSavedTechnicalReviewIfUpdated();
    }

    unsetLastSavedTechnicalReviewIfUpdated(){
        const { lastSavedTechnicalReviewForResult, result, cacheSavedTechnicalReviewForVSUUID } = this.props;
        const { uuid: vsUUID, technical_review: savedTechnicalReview } = result;
        const isSavedTechnicalReviewSynced = this.memoized.compareSavedToCache(lastSavedTechnicalReviewForResult, savedTechnicalReview);
        if (isSavedTechnicalReviewSynced) {
            cacheSavedTechnicalReviewForVSUUID(vsUUID, undefined);
        }
    }

    handleOpenDropdownCall(){
        const {
            result,
            setOpenPopoverData,
            lastSavedTechnicalReviewForResult,
            cacheSavedTechnicalReviewForVSUUID,
            // We can't determine if have edit permission for VariantSample (required) because VSes here are returned from ES and not an ItemView.
            // So are relying on haveCaseEditPermission and assume it is same permission for VariantSample.
            haveCaseEditPermission
        } = this.props;

        const {
            uuid: vsUUID,
            technical_review: savedTechnicalReview,
            project_technical_review: projectTechnicalReview
        } = result;

        const isCNV = this.memoized.isCNV(result);
        const { [isCNV ? "cnv" : "snv"]: { call: options } } = TechnicalReviewColumn.classificationOptions;
        const projectTechnicalReviewInformation = this.memoized.projectTechnicalReviewInformation(projectTechnicalReview, lastSavedTechnicalReviewForResult || savedTechnicalReview);
        const commonBtnProps = {
            result, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData, projectTechnicalReviewInformation,
            "callType": true,
            "disabled": !haveCaseEditPermission
        };

        setOpenPopoverData({
            "ref": this.callTrueButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600 text-uppercase" as="h5">Present</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { options.slice(0,1).map(function(optionName, i){
                            return (
                                <CallClassificationButton {...commonBtnProps} {...{ optionName }} key={i} highlightColorStyle="success" />
                            );
                        }) }
                    </Popover.Content>
                    <Popover.Title className="m-0 text-600 text-uppercase border-top" as="h5">Present - with concerns</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { options.slice(1).map(function(optionName, i){
                            return (
                                <CallClassificationButton {...commonBtnProps} {...{ optionName }} key={i} highlightColorStyle="warning" />
                            );
                        }) }
                    </Popover.Content>
                </Popover>
            )
        });
    }

    handleOpenDropdownNoCall(){
        const {
            result,
            setOpenPopoverData,
            lastSavedTechnicalReviewForResult,
            cacheSavedTechnicalReviewForVSUUID,
            // We can't determine if have edit permission for VariantSample (required) because VSes here are returned from ES and not an ItemView.
            // So are relying on haveCaseEditPermission and assume it is same permission for VariantSample.
            haveCaseEditPermission
        } = this.props;

        const {
            uuid: vsUUID,
            technical_review: savedTechnicalReview,
            project_technical_review: projectTechnicalReview
        } = result;

        const isCNV = this.memoized.isCNV(result);
        const { [isCNV ? "cnv" : "snv"]: { noCall: options } } = TechnicalReviewColumn.classificationOptions;
        const projectTechnicalReviewInformation = this.memoized.projectTechnicalReviewInformation(projectTechnicalReview, lastSavedTechnicalReviewForResult || savedTechnicalReview);
        const commonBtnProps = {
            result, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData, projectTechnicalReviewInformation,
            "callType": false,
            "disabled": !haveCaseEditPermission
        };

        setOpenPopoverData({
            "ref": this.callFalseButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600 text-uppercase" as="h5">No Call</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { options.map(function(optionName, i){
                            return <CallClassificationButton {...commonBtnProps} {...{ optionName }} key={i} highlightColorStyle="danger" />;
                        }) }
                    </Popover.Content>
                </Popover>
            )
        });
        setTimeout(ReactTooltip.rebuild, 10);
    }

    /**
     * @todo IMPORTANT: Handle project_technical_review.note_text as well, if/when enable overwriting or extending it.
     */
    updateUnsavedNoteText(e){
        const { result, cacheUnsavedTechnicalReviewNoteTextForVSUUID, lastSavedTechnicalReviewForResult } = this.props;
        const { uuid: vsUUID, technical_review: savedTechnicalReview = null } = result;
        const { note_text: lastSavedNoteText } = lastSavedTechnicalReviewForResult || {};
        const { note_text: savedNoteText } = savedTechnicalReview || {};
        const nextNoteText = e.target.value;
        if (nextNoteText === ""){
            if (lastSavedNoteText || (typeof lastSavedNoteText === "undefined" && savedNoteText)) {
                // Should be deleted upon PATCH
                // cacheUnsavedTechnicalReviewNoteTextForVSUUID(vsUUID, null);
                // TEMPORARY: Instead of `null` we save empty string to get around invalidation not working for empty PATCH w. delete_fields=note_text
                cacheUnsavedTechnicalReviewNoteTextForVSUUID(vsUUID, "");
            } else {
                // Unset in clientside state
                cacheUnsavedTechnicalReviewNoteTextForVSUUID(vsUUID, undefined);
            }
        } else {
            if (
                (nextNoteText === lastSavedNoteText)
                || ((typeof lastSavedNoteText === "undefined") && nextNoteText === savedNoteText)
            ){
                // Unset from unsaved state if same value as existing
                cacheUnsavedTechnicalReviewNoteTextForVSUUID(vsUUID, undefined);
            } else {
                cacheUnsavedTechnicalReviewNoteTextForVSUUID(vsUUID, nextNoteText);
            }
        }

        // Finally, re-render the popover so it receives the new unsaved note text state, if is still open.
        this.handleOpenNotesPopover(null, true);
    }

    /**
     * @param {MouseEvent} mouseClickEvent - Click event; not used.
     * @param {boolean} reRenderOnly - If true, will only render if is already open. Passed in by updateUnsavedNoteText.
     */
    handleOpenNotesPopover(mouseClickEvent, reRenderOnly = false){
        const {
            result,
            setOpenPopoverData,
            lastSavedTechnicalReviewForResult,
            unsavedTechnicalReviewNoteTextForResult,
            cacheSavedTechnicalReviewForVSUUID,
            cacheUnsavedTechnicalReviewNoteTextForVSUUID,
            haveCaseEditPermission
        } = this.props;
        const {
            uuid: vsUUID,
            technical_review: savedTechnicalReview,
            project_technical_review: projectTechnicalReview
        } = result;

        const projectTechnicalReviewInformation = this.memoized.projectTechnicalReviewInformation(projectTechnicalReview, lastSavedTechnicalReviewForResult || savedTechnicalReview);

        setOpenPopoverData((existingPopoverData) => {
            const { uuid: existingOpenVSUUID, call: existingOpenVSCallType } = existingPopoverData || {};

            if (reRenderOnly && (existingOpenVSCallType !== null || existingOpenVSUUID !== vsUUID)) {
                // Cancel out if note popover not currently open for this result already.
                return existingPopoverData;
            }

            return {
                "uuid": vsUUID,
                "call": null,
                "ref": this.notesButtonRef,
                "jsx": (
                    // We could instead forwardRef to NotePopover and render Popover there, but this works more performantly
                    // since Overlay re-renders its child very frequently for screen positioning and we don't need to re-render the NotePopoverContents
                    // as often.
                    // (See how SavedTechnicalReviewPopover is activated)
                    <Popover id="technical-review-popover">
                        <NotePopoverContents onTextAreaChange={this.updateUnsavedNoteText} disabled={!haveCaseEditPermission}
                            {...{ result, lastSavedTechnicalReviewForResult, unsavedTechnicalReviewNoteTextForResult, projectTechnicalReviewInformation,
                                cacheSavedTechnicalReviewForVSUUID, cacheUnsavedTechnicalReviewNoteTextForVSUUID, setOpenPopoverData }}/>
                    </Popover>
                )
            };
        });
    }

    render() {
        const { result, lastSavedTechnicalReviewForResult, unsavedTechnicalReviewNoteTextForResult } = this.props;

        const {
            uuid: vsUUID,
            variant: { ID } = {},
            technical_review: savedTechnicalReviewItem,
            project_technical_review: projectTechnicalReview
        } = result;
        const {
            assessment: {
                call: projectCall,
                classification: projectClassification
            } = {},
            note_text: projectNoteText
        } = projectTechnicalReview || {};
        const {
            assessment: savedTechnicalReviewAssessment,
            note_text: savedTechnicalReviewNoteText
        } = savedTechnicalReviewItem || {};
        const {
            call: savedCall,
            classification: savedClassification
        } = savedTechnicalReviewAssessment || {};
        const {
            assessment: lastSavedAssessment,
            note_text: lastSavedNoteText
        } = lastSavedTechnicalReviewForResult || {};
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedAssessment || {};

        // linkTo exists but can't see @id - no view perms for entire NoteTechnicalReview
        // const noViewPermissions = savedTechnicalReviewItem && !savedTechnicalReviewItemAtID;

        // TODO: Finish later. We need to implement conditional AJAX request that deletes the VariantSample.technical_review if project_technical_review
        // exists as well so that project_technical_review takes precedence ... probably.
        // const savedToProjectButOverriden = (
        //     projectTechnicalReview && (
        //         (savedTechnicalReviewItem && (projectCall !== savedCall || projectClassification !== savedClassification))
        //         || (lastSavedTechnicalReviewForResult && (projectCall !== lastSavedCall || projectClassification !== lastSavedClassification))
        //     )
        // );

        // Green (success) if first option, else yellow/orange for the 'Present - with concerns' options
        const callTrueIconColor = (
            (
                lastSavedCall === true
                || (!lastSavedAssessment && savedCall === true)
                || (!lastSavedAssessment && !savedTechnicalReviewItem && projectCall === true)
            ) ? (
                    (lastSavedCall === true && lastSavedClassification === "Present") ? "success"
                        : (!lastSavedAssessment && savedCall === true && savedClassification === "Present") ? "success"
                            // Check Project
                            : (!lastSavedAssessment && !savedTechnicalReviewItem && projectCall === true && projectClassification === "Present") ? "success"
                                : "warning"
                ) : "muted" // (savedCall === true ? "secondary" : "muted")
        );

        const callFalseIconColor = (
            (
                (lastSavedCall === false)
                || (!lastSavedAssessment && savedCall === false)
                || (!lastSavedAssessment && !savedTechnicalReviewItem && projectCall === false)
            ) ? "danger" : "muted" // (savedCall === false ? "secondary" : "muted")
        );

        const isNoteUnsaved = typeof unsavedTechnicalReviewNoteTextForResult !== "undefined";


        const isNotePotentiallyOutdated = lastSavedAssessment && savedTechnicalReviewNoteText && typeof lastSavedNoteText === "undefined";
        const notesIconCls = (
            "icon icon-2x icon-fw icon-sticky-note " + (
                isNotePotentiallyOutdated ? "far text-danger"
                    : (
                        unsavedTechnicalReviewNoteTextForResult
                        || (!isNoteUnsaved && lastSavedNoteText)
                        || (!isNoteUnsaved && typeof lastSavedNoteText === "undefined" && savedTechnicalReviewNoteText)
                        || (!isNoteUnsaved && typeof lastSavedNoteText === "undefined" && !savedTechnicalReviewItem && projectNoteText)
                    ) ? "fas text-secondary" : "far text-muted"
            ));


        return (
            <div className="w-100 d-flex align-items-center justify-content-around text-truncate py-1">

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownCall} ref={this.callTrueButtonRef}
                    data-call="true" data-technical-review="true">
                    <i className={"icon icon-2x icon-fw fas icon-check text-" + callTrueIconColor} />
                    { lastSavedAssessment && (lastSavedCall === true || (typeof lastSavedCall === "undefined" && savedCall === true)) ?
                        // If was just saved or if was previously saved but now removed (in which case lastSavedAssessment exists but is equal to {})
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownNoCall} ref={this.callFalseButtonRef}
                    data-call="false" data-technical-review="true">
                    <i className={"icon icon-2x icon-fw fas icon-times text-" + callFalseIconColor} />
                    { lastSavedAssessment && (lastSavedCall === false || (typeof lastSavedCall === "undefined" && savedCall === false)) ?
                        // If was just saved or if was previously saved but now removed (in which case lastSavedAssessment exists but is equal to {})
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenNotesPopover} ref={this.notesButtonRef} data-technical-review="true">
                    <i data-tip={isNotePotentiallyOutdated ? "This note is potentially outdated." : null} className={notesIconCls} />
                    { typeof lastSavedNoteText !== "undefined" ?
                        // If was note_text just removed, then would === null.
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                    { typeof unsavedTechnicalReviewNoteTextForResult !== "undefined" ?
                        // Will be equal to null if saved text exists but unsaved text is blank (== will remove field upon save).
                        <span className="text-danger text-700 position-absolute" data-tip="Note text has not been saved yet.">*</span>
                        : null }
                </button>

            </div>
        );
    }
}


const NotePopoverContents = React.memo(function NotePopover(props){
    const {
        result,
        lastSavedTechnicalReviewForResult,
        unsavedTechnicalReviewNoteTextForResult,
        cacheSavedTechnicalReviewForVSUUID,
        cacheUnsavedTechnicalReviewNoteTextForVSUUID,
        projectTechnicalReviewInformation,
        onTextAreaChange,
        setOpenPopoverData,
        disabled: propDisabled,
        // ...propsForPopoverFromOverlay
    } = props;
    const {
        uuid: vsUUID,
        technical_review: savedTechnicalReview,
        project_technical_review: projectTechnicalReview
    } = result;
    const {
        assessment: projectAssessment,
        note_text: projectNoteText
    } = projectTechnicalReview || {};
    const {
        call: projectCall,
        classification: projectClassification,
        date_call_made: projectCallDate,
        call_made_by: { display_title: projectCallMadeByName } = {} // Unlikely to be visible to most people.
    } = projectAssessment || {};
    const {
        "@id": savedTechnicalReviewItemAtID,
        assessment: savedAssessment,
        note_text: savedTechnicalReviewNoteText = null,
        date_approved: savedDateApproved,
        approved_by: { display_title: approvedByName } = {},
        last_modified: {
            date_modified: savedDateModified,
            modified_by: { display_title: lastModifiedByName } = {}
        } = {}
    } = savedTechnicalReview || {};
    const {
        call: savedCall,
        classification: savedClassification,
        date_call_made: savedCallDate,
        call_made_by: { display_title: savedCallMadeByName } = {} // Unlikely to be visible to most people.
    } = savedAssessment || {};

    const { "@id": lastSavedAtID, assessment: lastSavedAssessment, note_text: lastSavedNoteText } = lastSavedTechnicalReviewForResult || {};
    const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedAssessment || {};
    const { isTechnicalReviewSavedToProject, justRemovedFromProject, justSavedToProject } = projectTechnicalReviewInformation || {};

    // console.log("NotePopoverContents Render", lastSavedTechnicalReviewForResult, unsavedTechnicalReviewNoteTextForResult);

    let showCall;
    let showClassification;
    let showCallDate;
    let showCallMadeByName;
    const isLastSaved = typeof lastSavedAssessment !== "undefined";
    /* if (typeof lastSavedAssessment !== "undefined") {
        showCall = lastSavedCall;
        showClassification = lastSavedClassification;
        isLastSaved = true;
        showCallDate = null;
    } else */ if (typeof savedTechnicalReview !== "undefined") {
        showCall = savedCall;
        showClassification = savedClassification;
        showCallDate = savedCallDate;
        showCallMadeByName = savedCallMadeByName;
    } else if (typeof projectTechnicalReview !== "undefined") {
        showCall = projectCall;
        showClassification = projectClassification;
        showCallDate = projectCallDate;
        showCallMadeByName = projectCallMadeByName;
    } else {
        showCall = null;
        showClassification = null;
        showCallDate = null;
        showCallMadeByName = null;
    }

    // Including if any, not just this one. Re-enable maybe later (?).
    const isSavedToProject = justSavedToProject || (projectTechnicalReview && !justRemovedFromProject);
    // If project technical review exists but was not set on this VariantSample, disable it for time being at least.
    const textareaDisabled = propDisabled || isSavedToProject;
    const saveDisabled = textareaDisabled || typeof unsavedTechnicalReviewNoteTextForResult === "undefined";


    function handleSave (e) {
        // const associatedTechnicalReviewAtID = savedTechnicalReviewItemAtID || lastSavedAtID || null;
        // const isExistingValue = associatedTechnicalReviewAtID && (
        //     (lastSavedCall === callType && lastSavedClassification === optionName)
        //     // Ensure we don't have an empty assessment: {} in lastSavedTechnicalReviewForResult
        //     || (typeof lastSavedAssessment === "undefined" && savedCall === callType && savedClassification === optionName)
        // );

        // Include in payload even if null, commonNoteUpsetProcess will clear out any delete_fields, but we need this null value to be cached to
        // lastSavedTechnicalReviewForResult so that the recent change shows up in UI.
        // TEMPORARY: We patch `note_text: ""` for time being, later will revert to deleting note_text again once backend invalidation is fixed.
        const payload = { "note_text": unsavedTechnicalReviewNoteTextForResult };
        const deleteFields = [];
        if (unsavedTechnicalReviewNoteTextForResult === null) { // Not 'undefined' (=== in which case button should be disabled)
            deleteFields.push("note_text");
        }

        // IMPORTANT: There might be a glitch if try to save note of something already saved to project (i.e. it might unset it from saved to project).
        // Needs to be investigated a little if going to enable overwriting saved-to-project notes. Probably just need to set shouldSaveToProject=true if
        // already is saved to project -> shouldSaveToProject: isSavedToProject as the _quickest_ solution, albeit maybe not best one.
        commonNoteUpsertProcess({
            payload,
            deleteFields,
            onComplete: function(){ cacheUnsavedTechnicalReviewNoteTextForVSUUID(vsUUID, undefined); },
            result,
            // shouldSaveToProject: isSavedToProject,
            projectTechnicalReviewInformation,
            setOpenPopoverData,
            lastSavedTechnicalReviewForResult,
            cacheSavedTechnicalReviewForVSUUID
        });
    }

    const textareaDefaultValue = (
        typeof unsavedTechnicalReviewNoteTextForResult !== "undefined" ? unsavedTechnicalReviewNoteTextForResult
            : typeof lastSavedNoteText !== "undefined" ? lastSavedNoteText
                : typeof savedTechnicalReviewNoteText !== "undefined" ? savedTechnicalReviewNoteText
                    : typeof projectNoteText !== "undefined" ? projectNoteText
                        : ""
    );


    return (
        <React.Fragment>
            <Popover.Title className="m-0 text-600" as="h5">Technical Review Note</Popover.Title>
            <Popover.Content className="p-2">
                { lastSavedTechnicalReviewForResult ?
                    <h5 className="text-400">
                        You have recently updated this technical review, <br/>
                        but the change is not yet propagated to search results.
                    </h5>
                    : null }
                { showCallDate ?
                    <div className="small">
                        { (isLastSaved ? "Previous " : "") + "Call Made: " }
                        <LocalizedTime timestamp={showCallDate} />
                        { showCallMadeByName ? (" by " + showCallMadeByName) : null }
                    </div>
                    : null }
                { savedDateModified ?
                    <div className="small">
                        { (isLastSaved ? "Previous " : "") + "Last Modified: " }
                        <LocalizedTime timestamp={savedDateModified} />
                        { lastModifiedByName ? (" by " + lastModifiedByName) : null }
                    </div>
                    : null }
                { savedDateApproved ?
                    <div className="small">
                        { (isLastSaved ? "Previously " : "") + "Approved: " }
                        <LocalizedTime timestamp={savedDateApproved} />
                        { approvedByName ? (" by " + approvedByName) : null }
                    </div>
                    : null }
                <h6 className="mb-04 text-600">
                    { isLastSaved? "Previous " : "" }
                    Variant Classification
                </h6>
                { showCall === null ? <em>A technical review for this item has yet to be saved</em>
                    : <NoteClassificationIndicator {...{ showCall, showClassification }} showAsterisk={isLastSaved} /> }
                { isLastSaved ?
                    <React.Fragment>
                        <h6 className="mb-04 text-600">Newly-Saved Variant Classification</h6>
                        <NoteClassificationIndicator showCall={lastSavedCall} showClassification={lastSavedClassification} />
                    </React.Fragment>
                    : null }
                <h6 className="mt-12">
                    Notes
                    { unsavedTechnicalReviewNoteTextForResult ? <span className="text-danger"> - UNSAVED</span> : null }
                </h6>
                {/*<textarea className="form-control" rows={5} disabled value="Coming soon..." /> */}
                <textarea className="form-control" rows={5} onChange={onTextAreaChange} disabled={textareaDisabled} key={vsUUID}
                    defaultValue={textareaDefaultValue} />
                <div className="d-flex mt-08">
                    <button type="button" className="btn btn-primary mr-04 w-100" disabled={saveDisabled} onClick={handleSave}>
                        Save
                    </button>
                    <button type="button" className="btn btn-primary ml-04 w-100" disabled>
                        Approve
                    </button>
                </div>
            </Popover.Content>
        </React.Fragment>
    );
});


function NoteClassificationIndicator (props) {
    const { showCall, showClassification, showAsterisk } = props;
    return (
        <div className={"d-inline-block px-3 py-1 rounded" + (
            showCall === true ? " bg-success text-white"
                : showCall === false ? " bg-danger text-white"
                    : typeof showCall === "undefined" ? " bg-secondary text-white"
                        : null )}>
            { showCall === true ? "Call - "
                : showCall === false ? "No Call - "
                    : typeof showCall === "undefined" ? "No Call value set"
                        : null }
            { showClassification }
            { showAsterisk ?
                <span className="text-700" data-tip="You recently saved this and it may not be yet visible in search results"> *</span>
                : null }
        </div>
    );
}





/**
 * Chain of promises that will create or patch VariantSample.technical_review,
 * and/or release it to project if need be.
 *
 * @param {{}} paramsObj - Object of parameters.
 */
function commonNoteUpsertProcess ({
    payload,
    deleteFields = [],
    shouldSaveToProject = false,
    isExistingValue = false, // If true and shouldSaveToProject is also true, PATCH will be skipped, and it will only be saved to project.
    onComplete = null,
    // Props -
    result,
    projectTechnicalReviewInformation: { isTechnicalReviewSavedToProject, justRemovedFromProject, justSavedToProject } = {},
    setOpenPopoverData,
    lastSavedTechnicalReviewForResult,
    cacheSavedTechnicalReviewForVSUUID,
}){
    const {
        technical_review: savedTechnicalReviewItem,
        "@id" : variantSampleAtID,
        uuid: vsUUID,
        "@type": vsTypeList,
        project: { "@id": vsProjectAtID },
        institution: { "@id": vsInstitutionAtID }
    } = result;

    const { "@id": savedTechnicalReviewItemAtID, uuid: savedTechnicalReviewUUID } = savedTechnicalReviewItem || {};
    // const { call: savedCall = null, classification: savedClassification = null } = savedAssessment || {};
    const { "@id": lastSavedAtID, uuid: lastSavedUUID } = lastSavedTechnicalReviewForResult || {};
    // const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedAssessment || {};

    // TODO: Handle lack of edit/view permissions


    setOpenPopoverData(function({ ref: existingBtnRef }){
        return {
            // Re-use existing popover position.
            ref: existingBtnRef,
            jsx: (
                // Set 'key' prop to re-instantiate and force to reposition.
                <Popover id="technical-review-popover-updating" key="update">
                    <Popover.Title className="m-0 text-600" as="h5">Updating...</Popover.Title>
                    <Popover.Content className="p-2 text-center">
                        <i className="icon icon-spin icon-circle-notch icon-2x text-secondary fas py-4"/>
                        <p>Updating Technical Review</p>
                    </Popover.Content>
                </Popover>
            )
        };
    });

    const associatedTechnicalReviewAtID = savedTechnicalReviewItemAtID || lastSavedAtID || null;

    const isCurrentlySavedToProject = (justSavedToProject || (isTechnicalReviewSavedToProject && !justRemovedFromProject));
    let updatePromise = null;
    let techReviewResponse = null;

    function createNotePromise(){

        const createPayload = {
            ...payload,
            // Explicitly add project+institution so is same as that of VariantSample and not that of user (potentially admin).
            "project": vsProjectAtID,
            "institution": vsInstitutionAtID
        };

        return ajax.promise("/notes-technical-review/", "POST", {}, JSON.stringify(_.omit(createPayload, ...deleteFields)))
            .then(function(res){
                console.log('response', res);
                const { "@graph": [ technicalReviewItemFrameObject ] } = res;
                const { "@id": newTechnicalReviewAtID } = technicalReviewItemFrameObject;
                if (!newTechnicalReviewAtID) {
                    throw new Error("No NoteTechnicalReview @ID returned."); // If no error thrown during destructuring ^..
                }
                techReviewResponse = res;
                // PATCH VariantSample to set linkTo of "technical_review"
                return ajax.promise(variantSampleAtID, "PATCH", {}, JSON.stringify({ "technical_review": newTechnicalReviewAtID }));
            })
            .then(function(vsResponse){
                // PATCH VariantSample with new technical review.
                const { "@graph": [ vsItemFrameObject ] } = vsResponse;
                const { "@id": vsAtIDRepeated } = vsItemFrameObject;
                if (!vsAtIDRepeated) {
                    throw new Error("No [Structural]VariantSample @ID returned."); // If no error thrown during destructuring ^..
                }
                // - Grab status from techreview response and save to local state to compare for if saved to project or not.
                // - Also save "@id" of new NoteTechnicalReviewItem so we may (re-)PATCH it while savedTechnicalReviewItem & VS hasn't yet indexed
                //   and so that can use to determine isTechnicalReviewSavedToProject (by comparing to project_technical_review @id)
                const { "@graph": [ { "@id": technicalReviewAtID, uuid, status, last_modified: { date_modified } } ] } = techReviewResponse;
                cacheSavedTechnicalReviewForVSUUID(
                    vsUUID,
                    {
                        ...payload,
                        "@id": technicalReviewAtID,
                        uuid,
                        status,
                        last_modified: { date_modified }
                    }
                );
                return { created: true };
            });
    }

    function updateNotePromise(){

        // Deletion of `review` field should be done at backend for security -- TODO: move to _update method there perhaps.
        const updateHref = associatedTechnicalReviewAtID + "?delete_fields=" + ["review"].concat(deleteFields).join(",");

        return ajax.promise(updateHref, "PATCH", {}, JSON.stringify(_.omit(payload, ...deleteFields)))
            .then(function(res){
                console.log('response', res);
                const { "@graph": [ technicalReviewItemFrameObject ] } = res;
                const { "@id": technicalReviewAtID } = technicalReviewItemFrameObject;
                if (!technicalReviewAtID) {
                    throw new Error("No @ID returned."); // If no error thrown during destructuring ^..
                }
                techReviewResponse = res;
                // Grab status from techreview response and save to local state to compare for if saved to project or not.
                const { status, uuid, last_modified: { date_modified } } = technicalReviewItemFrameObject;
                cacheSavedTechnicalReviewForVSUUID(vsUUID, {
                    ...payload,
                    "@id": technicalReviewAtID,
                    uuid,
                    status,
                    last_modified: { date_modified }
                });
                return { created: false };
            });
    }

    /**
     * This mechanism works but many niche/edge cases need to be addressed. So for now we disable much of tangential UX for using it.
     * For example, when we override a saved-to-project review, and then unset the overriding review,
     * we need to revert to saved-to-project review --probably--, and add mechanism for that (vs just leaving it "no value").
     *
     * @return {Promise} AJAX request to update Variant's technical_reviews
     */
    function saveTechnicalReviewToProject(technicalReviewUUID, remove=false){
        let statusExpected;
        const payload = {};
        if (remove) {
            // Remove from project
            statusExpected = "in review";
            payload.remove_from_project_notes = { "technical_review": technicalReviewUUID };
        } else {
            statusExpected = "current";
            payload.save_to_project_notes = { "technical_review": technicalReviewUUID };
        }
        return ajax.promise(variantSampleAtID + "@@process-items/", "PATCH", {}, JSON.stringify(payload))
            .then(function(processItemsResponse){
                const {
                    status: endpointResponseStatus,
                    results: {
                        "Note": {
                            "responses": [ { "@graph": [ technicalReviewPatchResponseItem ] } ]
                        }
                    }
                } = processItemsResponse;
                if (endpointResponseStatus !== "success") {
                    throw new Error("Failed to update Variant with new Technical Review, check permissions.");
                }
                const { status: statusFromNotePatch, last_modified: { date_modified } } = technicalReviewPatchResponseItem;
                if (statusExpected !== statusFromNotePatch) {
                    throw new Error("We expected Note to have updated its status to " + statusExpected);
                }
                // We save it to cache/lastSavedTechnicalReview as if was a linkTo item, since for comparison with savedTechnicalReview, we'll get embedded linkTo.
                cacheSavedTechnicalReviewForVSUUID(vsUUID, {
                    status: statusFromNotePatch,        // Used to determine if currently saved to project
                    last_modified: { date_modified }    // Used to determine if result from search is newer (or equal to) our local cache.
                } );
                return processItemsResponse;
            });
    }


    // If no existing Item -- TODO: Maybe pull this out into sep function in case need to reuse logic later re: Tech Review Notes or smth.
    if (!associatedTechnicalReviewAtID) {
        updatePromise = createNotePromise();
    } else {
        // If values are same and we just want to save existing value to project, then skip the PATCH to Note itself.
        if (isExistingValue && shouldSaveToProject && !isCurrentlySavedToProject) {
            console.info("Skipping PATCH for same classification, will only save to project");
            updatePromise = new Promise(function(resolve, reject){
                resolve({ created: false });
            });
            updatePromise = Promise.resolve({ created: false });
        } else {
            updatePromise = updateNotePromise();
        }
    }




    let propsForPopover;
    updatePromise
        .then((propsFromPromise) => {
            propsForPopover = propsFromPromise;

            // Save to project if clicked on a save-to-project button
            // OR unset if is already saved to project (assume we saved a new/different value)
            const shouldRemoveFromProject = (
                (!shouldSaveToProject && isCurrentlySavedToProject)                         // Clicked on different value which shouldn't be saved to project
                || (shouldSaveToProject && isExistingValue && isCurrentlySavedToProject)    // Clicked on same value which already saved to project -- toggle/remove it.
            ) || false;

            if (shouldSaveToProject || shouldRemoveFromProject) {
                // We may not have techReviewResponse if we skipped PATCH, in which case we should have it from savedTechnicalReview
                // or lastSavedTechnicalReviewForResult.
                const { "@graph": [ technicalReviewItemFrameObject ] = [] } = techReviewResponse || {};
                const { uuid: technicalReviewUUIDFromResponse } = technicalReviewItemFrameObject || {};

                const technicalReviewUUID = technicalReviewUUIDFromResponse || lastSavedUUID || savedTechnicalReviewUUID;
                if (!technicalReviewUUID) {
                    throw new Error("No technical review UUID available to be able to save to project");
                }
                console.info(`Will ${shouldRemoveFromProject ? "remove from" : "save to"} project`);
                return saveTechnicalReviewToProject(technicalReviewUUID, shouldRemoveFromProject);
            }

            return propsForPopover;
        })
        .then(function(){
            // Show 'saved' popover unless manually set to skip it
            let skipPopover = false;
            try { // in case this runs server-side or in a non-standard browser
                skipPopover = JSON.parse(window.sessionStorage.getItem("skip_index_wait_warning"));
            } catch (e) {
                // pass
            }
            if (skipPopover) {
                setOpenPopoverData(null);
            } else {
                setOpenPopoverData(function({ ref: existingBtnRef }){
                    return {
                        "ref": existingBtnRef,
                        "jsx": <SavedTechnicalReviewPopover {...propsForPopover} />
                    };
                });
            }
            if (typeof onComplete === "function") {
                onComplete();
            }
        })
        .catch(function(errorMsgOrObj){
            console.error(errorMsgOrObj);
            setOpenPopoverData(function({ ref: existingBtnRef }){
                return {
                    // Re-use existing popover, essentially.
                    ref: { ...existingBtnRef },
                    jsx: (
                        <Popover id="technical-review-popover" key="error">
                            <Popover.Title className="m-0 text-600" as="h5">Error</Popover.Title>
                            <Popover.Content className="d-flex align-items-center" style={{ maxWidth: 320 }}>
                                <div className="p-2 text-center">
                                    <i className="icon icon-exclamation-triangle icon-2x text-danger fas"/>
                                </div>
                                <div className="flex-grow-1 px-2">
                                    <h5 className="text-600 my-0">Failed to save Technical Review</h5>
                                    <p className="mt-0">Please check permissions or report to admins/developers.</p>
                                </div>
                            </Popover.Content>
                        </Popover>
                    )
                };
            });
        });


}





class CallClassificationButton extends React.PureComponent {

    constructor(props) {
        super(props);
        this.upsertTechnicalReviewItem = this.upsertTechnicalReviewItem.bind(this);
        this.handleClick = this.handleClick.bind(this);

    }

    /* In progress */
    upsertTechnicalReviewItem(shouldSaveToProject = false){
        const {
            result,
            optionName, callType,
            lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID,
            setOpenPopoverData,
            projectTechnicalReviewInformation,
        } = this.props;
        const { technical_review: savedTechnicalReviewItem } = result;
        const { "@id": savedTechnicalReviewItemAtID, assessment: savedAssessment } = savedTechnicalReviewItem || {};
        const { call: savedCall = null, classification: savedClassification = null } = savedAssessment || {};
        const { "@id": lastSavedAtID, assessment: lastSavedAssessment } = lastSavedTechnicalReviewForResult || {};
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedAssessment || {};

        const associatedTechnicalReviewAtID = savedTechnicalReviewItemAtID || lastSavedAtID || null;
        const isExistingValue = associatedTechnicalReviewAtID && (
            (lastSavedCall === callType && lastSavedClassification === optionName)
            // Ensure we don't have an empty assessment: {} in lastSavedTechnicalReviewForResult
            || (typeof lastSavedAssessment === "undefined" && savedCall === callType && savedClassification === optionName)
        );

        const payload = isExistingValue ?
            // Unset; PATCH w. empty object, so that the datetime+author for deletion is saved via serverDefault.
            { "assessment": {} }
            :
            { "assessment": { "call": callType, "classification": optionName } };

        commonNoteUpsertProcess({
            result,
            payload,
            shouldSaveToProject,
            isExistingValue,
            projectTechnicalReviewInformation,
            setOpenPopoverData,
            lastSavedTechnicalReviewForResult,
            cacheSavedTechnicalReviewForVSUUID
        });

    }

    handleClick(e){
        const { disabled } = this.props;

        const saveToProject = e.target.getAttribute("data-save-to-project") === "true";
        if (disabled) {
            return false;
        }

        this.upsertTechnicalReviewItem(saveToProject);
    }

    render(){
        const {
            optionName,
            callType,
            result,
            lastSavedTechnicalReviewForResult,
            highlightColorStyle = null,
            disabled: propDisabled = false,
            projectTechnicalReviewInformation: { isTechnicalReviewSavedToProject, justSavedToProject, justRemovedFromProject }
        } = this.props;
        const {
            uuid: vsUUID,
            technical_review: savedTechnicalReviewItem,
            project_technical_review: projectTechnicalReview
        } = result;
        const {
            "@id": savedTechnicalReviewItemAtID,
            assessment: {
                call: savedCall,
                classification: savedClassification
            } = {},
            status: savedTechnicalReviewStatus
        } = savedTechnicalReviewItem || {};
        const {
            "@id": projectTechnicalReviewAtID,
            assessment: {
                call: projectCall,
                classification: projectClassification
            } = {}
        } = projectTechnicalReview || {};
        const { assessment: lastSavedAssessment } = lastSavedTechnicalReviewForResult || {};
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedAssessment || {};

        // linkTo exists but can't see @id - no view perms for entire NoteTechnicalReview
        const noViewPermissions = savedTechnicalReviewItem && !savedTechnicalReviewItemAtID;

        // If was recently saved but not yet in search results
        const isLastSaved = lastSavedCall === callType && lastSavedClassification === optionName;

        // If in search results
        const isSavedToVS = savedCall === callType && savedClassification === optionName;
        const isAssessmentSavedToProject = !justRemovedFromProject && (projectCall === callType && projectClassification === optionName);

        // If was recently saved and this existing saved value is now unset (either technical_review.assessment changed or deleted)
        const isLastSaveUnset = isSavedToVS && lastSavedAssessment && !isLastSaved;

        // isThisTechnicalReviewSavedToProject === false when last unset, but projectTechnicalReview and savedTechnicalReview should be present still.
        // const isLastSaveProjectUnset = isAssessmentSavedToProject && !isThisTechnicalReviewSavedToProject && (projectTechnicalReviewAtID === savedTechnicalReviewItemAtID);

        // Allow more options later?
        const isDefaultSaveToProject = callType === false && optionName === "Recurrent Artifact";

        // For now we don't allow saving if a projectTechnicalReview for this VS exists already.
        // We will revisit this after understand what the ideal UX should be.
        const disabled = (
            propDisabled
            || noViewPermissions
            || (projectTechnicalReview && !isTechnicalReviewSavedToProject && !justSavedToProject && !justRemovedFromProject)
        );

        const isCurrentlySavedToProject = (isTechnicalReviewSavedToProject && !justRemovedFromProject) || justSavedToProject;

        const btnClass = (
            (isLastSaved || (isSavedToVS && !isLastSaveUnset) ? ` bg-${highlightColorStyle} text-white` : "") +
            (isLastSaveUnset ? " bg-light text-secondary" : "")
        );

        const lastSavedIndicator = isLastSaved ?
            <span className="text-white text-700" data-tip="You recently saved this value and it may not be yet visible in search results"> *</span>
            : isLastSaveUnset ?
                <i className="icon icon-minus-circle fas ml-08" data-tip="Previous Value" />
                : null;

        if (isDefaultSaveToProject) {

            const saveToProjectBtnClass = (
                (isAssessmentSavedToProject && !justRemovedFromProject)
                || (justSavedToProject && (isLastSaved || (!lastSavedAssessment && isSavedToVS)))
            ) ? ` bg-${highlightColorStyle} text-white` : "";
            const saveToProjectBtnTip = `This classification will be ${isCurrentlySavedToProject ? "removed" : "saved"} <b>project-wide</b> for this variant`;
            // We don't have a way to unsave from project, so disable button for now if already saved to project.
            return (
                <div className="d-flex">
                    <button type="button" className={"dropdown-item pr-16" + saveToProjectBtnClass} onClick={this.handleClick} data-save-to-project={true}
                        disabled={disabled} data-html data-tip={saveToProjectBtnTip}>
                        { optionName }
                        <i className="icon icon-project-diagram fas small ml-16" />
                        { justSavedToProject && !isAssessmentSavedToProject ? // Not yet indexed
                            <span className="text-white text-700" data-tip="You recently saved this to project and it may not be yet visible in search results"> *</span>
                            : justRemovedFromProject ?
                                <i className="icon icon-minus-circle fas ml-08" data-tip="Previous Value" />
                                : null}
                    </button>
                    <button type="button" className={"px-3 flex-grow-1 dropdown-item border-left" + btnClass} onClick={this.handleClick}
                        disabled={disabled} data-save-to-project={false} data-tip="Save only to this variant sample (and not project-wide for this variant)">
                        <i className="icon icon-vial fas" />
                        { lastSavedIndicator }
                    </button>
                </div>
            );
        }

        return (
            <button type="button" className={"dropdown-item" + btnClass} onClick={this.handleClick} disabled={disabled}>
                { optionName }
                { lastSavedIndicator }
            </button>
        );
    }
}

/** If this appears, we can assume sessionStorage.skip_index_wait_warning is not true */
const SavedTechnicalReviewPopover = React.forwardRef(function ({ created = false, ...passProps }, ref){
    // `checked` should always be false initially, otherwise this popover wouldn't have been shown..
    const [ checked, setChecked ] = useState(false);

    const onCheck = useCallback(function(){
        setChecked(function(prevChecked){
            return !prevChecked;
        });
    });

    useEffect(function(){
        // Use sessionStorage since is 'easier to unset' if we iterate on data structure in future.
        // Also reminds people next session they use the portal that saved changes won't be immediately visible.
        if (checked) {
            window.sessionStorage.setItem("skip_index_wait_warning", "true");
        } else {
            window.sessionStorage.removeItem("skip_index_wait_warning");
        }
    }, [ checked ]);

    return (
        <Popover {...passProps} id="technical-review-popover" key="success-new-review" ref={ref}>
            <Popover.Title className="m-0 text-600" as="h5">{ created ? "Created" : "Updated" } Technical Review</Popover.Title>
            <Popover.Content style={{ maxWidth: 320 }}>
                <h5 className="my-0">NOTE:</h5>
                <p className="mt-0">
                    It may take some time for your changes to become available in search results, please refresh or search again in a few minutes.
                </p>
                { typeof window !== "undefined" && window.sessionStorage ?
                    <label className="d-block text-400 mt-08 pt-08 border-top mb-0">
                        <input type="checkbox" value={checked} className="align-middle" onChange={onCheck} />&nbsp;
                        <span className="align-middle ml-04">Check to stop showing this message</span>
                    </label>
                    : null }
            </Popover.Content>
        </Popover>
    );
});


export class TechnicalReviewController extends React.PureComponent {

    /**
     * Compares lastSavedTechnicalReviewForResult from client-side store against VS.technical_review.
     * Used to tell whether local changes have been indexed (and then reset local changes).
     *
     * There could be conflicts if 2+ people are reviewing the same VariantSample;
     * one idea might be to save last date modified, and then unset if receive a same or newer
     * date_modified from backend; this would cover such cases theoretically.
     */
    static compareSavedToCache(lastSavedTechnicalReviewForResult, savedTechnicalReview){

        if (!lastSavedTechnicalReviewForResult || !savedTechnicalReview) {
            return false;
        }

        const { last_modified: { date_modified: lastSavedDateModified } } = lastSavedTechnicalReviewForResult;
        const { last_modified: { date_modified: savedDateModified } } = savedTechnicalReview;

        // Our indexed technical review has newer or same last_modified date as locally cached date.
        return savedDateModified >= lastSavedDateModified;
    }

    constructor(props) {
        super(props);
        this.cacheUnsavedTechnicalReviewNoteTextForVSUUID = this.cacheUnsavedTechnicalReviewNoteTextForVSUUID.bind(this);
        this.cacheSavedTechnicalReviewForVSUUID = this.cacheSavedTechnicalReviewForVSUUID.bind(this);
        this.resetLastSavedTechnicalReview = this.resetLastSavedTechnicalReview.bind(this);
        this.state = {
            /** @type {Object.<string,{ assessment: { call: boolean|undefined, classification: string|undefined }|undefined, note_text: string|undefined, status: string, "@id": string|undefined }>} */
            "lastSavedTechnicalReview": {},
            "unsavedTechnicalReviewNoteTexts": {}
        };
    }

    componentDidUpdate(){
        console.log("TechnicalReviewController State", this.state);
    }

    cacheUnsavedTechnicalReviewNoteTextForVSUUID(vsUUID, value) {
        this.setState(function({ unsavedTechnicalReviewNoteTexts: existingNoteTexts }){
            const existingValue = existingNoteTexts[vsUUID];
            if (typeof value === "undefined") {
                if (typeof existingValue !== "undefined") {
                    return { "unsavedTechnicalReviewNoteTexts" : _.omit(existingNoteTexts, vsUUID) };
                }
                return null;
            }
            // `value` may be null, which means 'to be deleted'
            return { "unsavedTechnicalReviewNoteTexts": { ...existingNoteTexts, [vsUUID]: value } };
        });
    }

    cacheSavedTechnicalReviewForVSUUID(vsUUID, value) {
        this.setState(function({ lastSavedTechnicalReview: existingStatePropertyObject }){
            // "undefined" means remove from state.lastSavedTechnicalReview, "null" means was deleted.
            const existingValue = existingStatePropertyObject[vsUUID];
            if (typeof value === "undefined") {
                if (typeof existingValue !== "undefined") {
                    return { "lastSavedTechnicalReview" : _.omit(existingStatePropertyObject, vsUUID) };
                }
                return null;
            }
            // `value` may be null, which means 'was deleted'
            return {
                "lastSavedTechnicalReview": {
                    ...existingStatePropertyObject,
                    [vsUUID]: {
                        ...existingValue,
                        ...value
                    }
                }
            };
        });
    }

    resetLastSavedTechnicalReview() {
        this.setState({ "lastSavedTechnicalReview": {} });
    }

    render(){
        const { children, ...passProps } = this.props;
        const { lastSavedTechnicalReview, unsavedTechnicalReviewNoteTexts } = this.state;
        const childProps = {
            ...passProps,
            lastSavedTechnicalReview,
            unsavedTechnicalReviewNoteTexts,
            "cacheSavedTechnicalReviewForVSUUID": this.cacheSavedTechnicalReviewForVSUUID,
            "cacheUnsavedTechnicalReviewNoteTextForVSUUID": this.cacheUnsavedTechnicalReviewNoteTextForVSUUID,
            "resetLastSavedTechnicalReview": this.resetLastSavedTechnicalReview
        };
        return React.Children.map(children, function(child){
            if (!React.isValidElement(child) || typeof child.type === "string") {
                return child;
            }
            return React.cloneElement(child, childProps);
        });
    }

}
