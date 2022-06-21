'use strict';

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import _ from 'underscore';
import memoize from 'memoize-one';
import Popover from 'react-bootstrap/esm/Popover';
import ReactTooltip from 'react-tooltip';
import { ajax, JWT } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { PatchItemsProgress } from './../../util/PatchItemsProgress';



export class TechnicalReviewColumn extends React.PureComponent {

    // static findSavedToProjectTechnicalReviewForVariant(result){
    //     const { variant: { technical_reviews: variantTechReviews = [] } = {} } = result;
    //     return variantTechReviews.find(function(){

    //     });
    // }

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
            "isUpdating" : false
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
        setTimeout(ReactTooltip.rebuild, 10);
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

    /** OUTDATED Debounced in constructor. 'Business logic' will likely change/  */
    updateUnsavedNoteText(e){
        // const {
        //     result,
        // } = this.props;
        // const {
        //     uuid: vsUUID,
        //     //technical_review_note: savedTechnicalReviewNote = null
        // } = result;
        // const { note_text: savedNoteText } = savedTechnicalReviewNote || {};
        // const nextNoteText = e.target.value;
        // if (nextNoteText === ""){
        //     // Logic subject to change if add more meaningful properties to Note (and make it a subtype) aside from note_text.
        //     // Even if we keep just note_text, it's worth keeping it inside of an object for performance (avoids checking text value when comes down through props)
        //     if (!savedTechnicalReviewNote) {
        //         setTechnicalReviewNoteForVSUUID(vsUUID, undefined);
        //     } else {
        //         setTechnicalReviewNoteForVSUUID(vsUUID, null);
        //     }
        // } else {
        //     if (savedNoteText && nextNoteText === savedNoteText) {
        //         // Unset from unsaved state if same value as existing
        //         setTechnicalReviewNoteForVSUUID(vsUUID, undefined);
        //     } else {
        //         setTechnicalReviewNoteForVSUUID(vsUUID, { ...(lastSavedTechnicalReviewNoteForResult || {}), "note_text": nextNoteText });
        //     }
        // }
    }

    // THIS WILL CHANGE, MIGHT GET RID OF TechnicalReviewController Notes in general.
    handleOpenNotesPopover(){
        const {
            result,
            setOpenPopoverData,
            lastSavedTechnicalReviewForResult
        } = this.props;
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

        const { assessment: lastSavedAssessment } = lastSavedTechnicalReviewForResult || {};
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedAssessment || {};

        console.log("TTT", lastSavedTechnicalReviewForResult);

        let showCall;
        let showClassification;
        let showCallDate;
        let showCallMadeByName;
        let isLastSaved = false;
        if (typeof lastSavedAssessment !== "undefined") {
            showCall = lastSavedCall;
            showClassification = lastSavedClassification;
            isLastSaved = true;
            showCallDate = null;
        } else if (typeof savedTechnicalReview !== "undefined") {
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

        setOpenPopoverData({
            "uuid": vsUUID,
            "call": null,
            "ref": this.notesButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600" as="h5">Technical Review Note</Popover.Title>
                    <Popover.Content className="p-2">
                        { lastSavedTechnicalReviewForResult ?
                            <h4>You have recently updated this technical review, but the change is not yet indexed.</h4>
                            : null }
                        { showCallDate ?
                            <div className="small">
                                { (isLastSaved ? "Previously " : "") + "Call Made: " }
                                <LocalizedTime timestamp={showCallDate} />
                                { showCallMadeByName ? (" by " + showCallMadeByName) : null }
                            </div>
                            : null }
                        { savedDateModified ?
                            <div className="small">
                                { (isLastSaved ? "Previously " : "") + "Last Modified: " }
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
                        <h6 className="mb-04">Variant Call</h6>
                        { showCall === null ? <em>A technical review for this item has yet to be created</em>
                            : (
                                <div className={"d-inline-block px-3 py-1 rounded" + (
                                    showCall === true ? " bg-success text-white"
                                        : showCall === false ? " bg-danger text-white"
                                            : typeof showCall === "undefined" ? " bg-secondary"
                                                : null )}>
                                    { showCall === true ? "Call - "
                                        : showCall === false ? "No Call - "
                                            : typeof showCall === "undefined" ? "No Call value set"
                                                : null }
                                    { showClassification }
                                    { isLastSaved ?
                                        <span className="text-700" data-tip="You recently saved this and it may not be yet visible in search results"> *</span>
                                        : null }
                                </div>
                            )
                        }
                        <h6>Technical Notes</h6>
                        {/*<textarea className="form-control" rows={5} disabled value="Coming soon..." /> */}
                        <textarea className="form-control" rows={5} defaultValue={savedTechnicalReviewNoteText || ""} onChange={this.updateUnsavedNoteText} />
                        <div className="d-flex mt-08">
                            <button type="button" className="btn btn-primary mr-04 w-100" disabled>
                                Save
                            </button>
                            <button type="button" className="btn btn-primary ml-04 w-100" disabled>
                                Approve
                            </button>
                        </div>
                    </Popover.Content>
                </Popover>
            )
        });
    }

    render() {
        const { result, lastSavedTechnicalReviewForResult } = this.props;

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
            note_text: savedTechnicalReviewNoteText = null
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


        const isNotePotentiallyOutdated = lastSavedAssessment && savedTechnicalReviewNoteText && !lastSavedNoteText;
        const notesIconCls = (
            "icon icon-2x icon-fw icon-sticky-note " + (
                isNotePotentiallyOutdated ? "far text-danger"
                    : (savedTechnicalReviewNoteText || lastSavedNoteText || projectNoteText) ? "fas text-secondary"
                        : "far text-muted"
            ));


        return (
            <div className="w-100 d-flex align-items-center justify-content-around text-truncate py-1">

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownCall} ref={this.callTrueButtonRef}
                    data-call="true" data-technical-review="true">
                    <i className={"icon icon-2x icon-fw fas icon-check text-" + callTrueIconColor} />
                    { lastSavedCall === true || (lastSavedAssessment && typeof lastSavedCall === "undefined" && savedCall === true) ?
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownNoCall} ref={this.callFalseButtonRef}
                    data-call="false" data-technical-review="true">
                    <i className={"icon icon-2x icon-fw fas icon-times text-" + callFalseIconColor} />
                    { lastSavedCall === false || (lastSavedAssessment && typeof lastSavedCall === "undefined" && savedCall === false) ?
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenNotesPopover} ref={this.notesButtonRef} data-technical-review="true">
                    <i data-tip={isNotePotentiallyOutdated ? "This note is potentially outdated." : null} className={notesIconCls} />
                    {/* lastSavedTechnicalReviewNoteForResult || (lastSavedTechnicalReviewNoteForResult === null && savedTechnicalReviewNote) ?
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null */}
                </button>

            </div>
        );
    }
}



class CallClassificationButton extends React.PureComponent {

    constructor(props) {
        super(props);
        this.upsertTechnicalReviewItem = this.upsertTechnicalReviewItem.bind(this);
        this.saveTechnicalReviewToProject = this.saveTechnicalReviewToProject.bind(this);
        this.handleClick = this.handleClick.bind(this);

    }

    /* In progress */
    upsertTechnicalReviewItem(shouldSaveToProject = false){
        const {
            result,
            optionName, callType,
            lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID,
            setOpenPopoverData,
            projectTechnicalReviewInformation: { isTechnicalReviewSavedToProject, justRemovedFromProject, justSavedToProject }
        } = this.props;
        const {
            technical_review: savedTechnicalReviewItem,
            "@id" : variantSampleAtID,
            uuid: vsUUID,
            project: { "@id": vsProjectAtID },
            institution: { "@id": vsInstitutionAtID }
        } = result;
        const { "@id": savedTechnicalReviewItemAtID, assessment: savedAssessment, uuid: savedTechnicalReviewUUID } = savedTechnicalReviewItem || {};
        const { call: savedCall = null, classification: savedClassification = null } = savedAssessment || {};
        const { "@id": lastSavedAtID, uuid: lastSavedUUID, assessment: lastSavedAssessment } = lastSavedTechnicalReviewForResult || {};
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedAssessment || {};

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
        const isExistingValue = associatedTechnicalReviewAtID && (
            (lastSavedCall === callType && lastSavedClassification === optionName)
            // Ensure we don't have an empty assessment: {} in lastSavedTechnicalReviewForResult
            || (typeof lastSavedAssessment === "undefined" && savedCall === callType && savedClassification === optionName)
        );
        const isCurrentlySavedToProject = (justSavedToProject || (isTechnicalReviewSavedToProject && !justRemovedFromProject));
        let updatePromise = null;
        let techReviewResponse = null;

        function createNotePromise(){

            const createPayload = {
                "assessment": { "call": callType, "classification": optionName },
                // Explicitly add project+institution so is same as that of VariantSample and not that of user (potentially admin).
                "project": vsProjectAtID,
                "institution": vsInstitutionAtID
            };

            return ajax.promise("/notes-technical-review/", "POST", {}, JSON.stringify(createPayload))
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
                    const { "@graph": [ { "@id": technicalReviewAtID, uuid, status } ] } = techReviewResponse;
                    cacheSavedTechnicalReviewForVSUUID(
                        vsUUID,
                        {
                            ..._.omit(createPayload, "project"),
                            uuid,
                            status,
                            "@id": technicalReviewAtID
                        }
                    );
                    return { created: true };
                });
        }

        function updateNotePromise(){

            let updatePayload;

            // Deletion of `review` field should be done at backend for security -- TODO: move to _update method there perhaps.
            const updateHref = associatedTechnicalReviewAtID + "?delete_fields=review";

            if (isExistingValue) {
                // Unset; PATCH w. empty object, so that the datetime+author for deletion is saved via serverDefault.
                updatePayload = { "assessment": {} };
            } else {
                // Set
                updatePayload = { "assessment": { "call": callType, "classification": optionName } };
            }

            return ajax.promise(updateHref, "PATCH", {}, JSON.stringify(updatePayload))
                .then(function(res){
                    console.log('response', res);
                    const { "@graph": [ technicalReviewItemFrameObject ] } = res;
                    const { "@id": newTechnicalReviewAtID } = technicalReviewItemFrameObject;
                    if (!newTechnicalReviewAtID) {
                        throw new Error("No @ID returned."); // If no error thrown during destructuring ^..
                    }
                    techReviewResponse = res;
                    const { "@id": technicalReviewAtID, status, uuid } = technicalReviewItemFrameObject; // Grab status from techreview response and save to local state to compare for if saved to project or not.
                    cacheSavedTechnicalReviewForVSUUID(vsUUID, {
                        ...updatePayload,
                        "@id": technicalReviewAtID,
                        uuid,
                        status
                    });
                    return { created: false };
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
                    return this.saveTechnicalReviewToProject(technicalReviewUUID, shouldRemoveFromProject);
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
            })
            .catch(function(errorMsgOrObj){
                console.error(errorMsgOrObj);
                // Don't unset here, as 1 part of request chain may have succeeded (save to VariantSample)
                // but not another (e.g. save to project).
                // cacheSavedTechnicalReviewForVSUUID(vsUUID, undefined);
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

    /**
     * This mechanism works but many niche/edge cases need to be addressed. So for now we disable much of tangential UX for using it.
     * For example, when we override a saved-to-project review, and then unset the overriding review,
     * we need to revert to saved-to-project review --probably--, and add mechanism for that (vs just leaving it "no value").
     *
     * @return {Promise} AJAX request to update Variant's technical_reviews
     */
    saveTechnicalReviewToProject(technicalReviewUUID, remove=false){
        const {
            result: variantSampleSearchResult,
            cacheSavedTechnicalReviewForVSUUID,
            projectTechnicalReviewInformation: { isTechnicalReviewSavedToProject, justSavedToProject, justRemovedFromProject }
        } = this.props;
        const { "@id": vsAtID, uuid: vsUUID, "@type": vsTypeList } = variantSampleSearchResult;
        const variantFieldName = vsTypeList[0] === "StructuralVariantSample" ? "structural_variant" : "variant";
        const { [variantFieldName]: { "@id": variantAtID } } = variantSampleSearchResult;
        let statusToSetInCache;
        const payload = {};
        if (remove) {
            // Remove from project
            statusToSetInCache = "in review";
            payload.remove_from_project_notes = { "technical_review": technicalReviewUUID };
        } else {
            statusToSetInCache = "current";
            payload.save_to_project_notes = { "technical_review": technicalReviewUUID };
        }
        return ajax.promise(vsAtID + "@@process-items/", "PATCH", {}, JSON.stringify(payload))
            .then(function(processItemsResponse){
                const { status } = processItemsResponse;
                if (status !== "success") {
                    throw new Error("Failed to update Variant with new Technical Review, check permissions.");
                }
                // We save it to cache/lastSavedTechnicalReview as if was a linkTo item, since for comparison with savedTechnicalReview, we'll get embedded linkTo.
                cacheSavedTechnicalReviewForVSUUID(vsUUID, { status: statusToSetInCache } ); // Used for comparison
                return processItemsResponse;
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
            projectTechnicalReviewInformation: { isTechnicalReviewSavedToProject, justSavedToProject, justRemovedFromProject },
            isThisTechnicalReviewSavedToProject = false
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

            console.log("LASTSAVED", lastSavedTechnicalReviewForResult);

            console.log("isDefaultSaveToProject - project", projectTechnicalReview,  isTechnicalReviewSavedToProject, justSavedToProject, justRemovedFromProject, isAssessmentSavedToProject);

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

    static compareSavedToCache(lastSavedTechnicalReviewForResult, savedTechnicalReview){
        if (!lastSavedTechnicalReviewForResult || !savedTechnicalReview) {
            return false;
        }

        /**
         * Essentially sets "field": undefined for non-present fields and clears `@id` as standardization for comparison.
         *
         * We only want to compare against the values explicitly present in lastSavedTechnicalReviewForResult, not anything else.
         * Might have issues if e.g. lastSavedTechnicalReview has no assessment ({}) but savedTechnicalReview does, so explicitly grab fields
         * instead of trying to recurse down lastSavedTechnicalReviewForResult properties.
         */
        function makeSubset(obj){
            const {
                assessment: { call, classification } = {},
                note_text,
                status
                // "@id": objAtID
            } = obj;
            return {
                assessment: { call, classification },
                note_text,
                status
            };
        }
        const lastSavedSubset = makeSubset(lastSavedTechnicalReviewForResult);
        const savedSubset = makeSubset(savedTechnicalReview);
        // Deep comparison wherein {} !== { someFieldName: undefined }
        const isEqual = _.isEqual(lastSavedSubset, savedSubset);
        console.log("COMPARISON TEST", lastSavedSubset, savedSubset, isEqual);
        return isEqual;
    }

    constructor(props) {
        super(props);
        this.cacheSavedTechnicalReviewForVSUUID = this.cacheSavedTechnicalReviewForVSUUID.bind(this);
        this.resetLastSavedTechnicalReview = this.resetLastSavedTechnicalReview.bind(this);
        this.state = {
            /** @type {Object.<string,{ assessment: { call: boolean|undefined, classification: string|undefined }|undefined, note_text: string|undefined, status: string, "@id": string|undefined }>} */
            "lastSavedTechnicalReview": {}
        };
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
        const { lastSavedTechnicalReview, lastSavedTechnicalReviewToProject } = this.state;
        const childProps = {
            ...passProps,
            lastSavedTechnicalReview,
            lastSavedTechnicalReviewToProject,
            "cacheSavedTechnicalReviewForVSUUID": this.cacheSavedTechnicalReviewForVSUUID,
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
