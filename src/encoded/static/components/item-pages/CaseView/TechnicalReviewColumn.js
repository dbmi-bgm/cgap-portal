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
     * @param {Object} projectTechnicalReview - Should have an `@id`
     * @param {Object} lastSavedTechnicalReview - Should have either an `@id` or saved_to_project_variant, may be savedTechnicalReview (context field) or lastSavedTechnicalReview (state)
     */
    static isTechnicalReviewSavedToProject(projectTechnicalReview, lastSavedTechnicalReview) {
        const { "@id": projectTechnicalReviewAtID } = projectTechnicalReview || {};
        const { "@id": lastSavedTechnicalReviewItemAtID, saved_to_project_variant: lastSavedToProjectVariant } = lastSavedTechnicalReview || {};
        if (lastSavedToProjectVariant) {
            return true;
        }
        if (!projectTechnicalReviewAtID) {
            return false;
        }
        if (!lastSavedTechnicalReviewItemAtID) {
            return false;
        }
        return lastSavedTechnicalReviewItemAtID === projectTechnicalReviewAtID;
    }

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
            "isTechnicalReviewSavedToProject": memoize(TechnicalReviewColumn.isTechnicalReviewSavedToProject)
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

        const { uuid: vsUUID, technical_review, project_technical_review } = result;

        const opts = [
            "Present",
            "Low Coverage",
            "Low Allelic Fraction",
            "Low Mapping Quality",
            "Strand Bias",
            "Mendelian Error",
            "Other"
        ];

        const isThisTechnicalReviewSavedToProject = this.memoized.isTechnicalReviewSavedToProject(project_technical_review, lastSavedTechnicalReviewForResult || technical_review);

        const commonBtnProps = {
            result, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData, isThisTechnicalReviewSavedToProject,
            "callType": true,
            "disabled": !haveCaseEditPermission
        };

        setOpenPopoverData({
            "ref": this.callTrueButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600 text-uppercase" as="h5">Present</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { opts.slice(0,1).map(function(optionName, i){
                            return (
                                <CallClassificationButton {...commonBtnProps} {...{ optionName }} key={i} highlightColorStyle="success" />
                            );
                        }) }
                    </Popover.Content>
                    <Popover.Title className="m-0 text-600 text-uppercase border-top" as="h5">Present - with concerns</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { opts.slice(1).map(function(optionName, i){
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

        const { uuid: vsUUID, project_technical_review, technical_review } = result;

        const opts = [
            "Recurrent Artifact",
            "Low Coverage",
            "Low Allelic Fraction",
            "Low Mapping Quality",
            "Strand Bias",
            "Mendelian Error",
            "Other"
        ];

        console.log("TTT3", project_technical_review, lastSavedTechnicalReviewForResult, technical_review);

        const isThisTechnicalReviewSavedToProject = this.memoized.isTechnicalReviewSavedToProject(project_technical_review, lastSavedTechnicalReviewForResult || technical_review);
        const commonBtnProps = {
            result, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData, isThisTechnicalReviewSavedToProject,
            "callType": false,
            "disabled": !haveCaseEditPermission
        };

        setOpenPopoverData({
            "ref": this.callFalseButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600 text-uppercase" as="h5">No Call</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { opts.map(function(optionName, i){
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
            setOpenPopoverData
        } = this.props;
        const {
            uuid: vsUUID,
            technical_review: {
                assessment: savedTechnicalReview,
                note_text: savedTechnicalReviewNoteText = null,
                date_approved: savedDateApproved,
                approved_by: savedApprovedBy,
                last_modified: {
                    date_modified: savedDateModified,
                    modified_by: savedModifiedBy
                } = {}
            } = {}
        } = result;
        const {
            call: savedCall,
            classification: savedClassification,
            date_call_made: savedCallDate,
            call_made_by: { display_title: savedCallAuthorName } = {} // Unlikely to be visible to most people.
        } = savedTechnicalReview || {};

        setOpenPopoverData({
            "uuid": vsUUID,
            "call": null,
            "ref": this.notesButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600" as="h5">Technical Review Note</Popover.Title>
                    <Popover.Content className="p-2">
                        { savedCallDate ?
                            <div className="small">
                                Call Made: <LocalizedTime timestamp={savedCallDate} />
                                { savedCallAuthorName ? (" by " + savedCallAuthorName) : null }
                            </div>
                            : null }
                        { savedDateModified ?
                            <div className="small">
                                Last Modified: <LocalizedTime timestamp={savedDateModified} />
                                { savedModifiedBy ? (" by " + savedModifiedBy) : null }
                            </div>
                            : null }
                        { savedDateApproved ?
                            <div className="small">
                                Approved: <LocalizedTime timestamp={savedDateApproved} />
                                { savedApprovedBy ? (" by " + savedApprovedBy) : null }
                            </div>
                            : null }
                        <h6>Variant Call</h6>
                        { !savedTechnicalReview ? <em>Nothing saved</em>
                            : (
                                <div className={"d-inline-block px-3 py-1 rounded" + (
                                    savedCall === true ? " bg-success text-white"
                                        : savedCall === false ? " bg-danger text-white" : "" )}>
                                    { savedCall === true ? "Call - " : savedCall === false ? "No Call - " : "" }
                                    { savedClassification }
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
            "@id": projectTechnicalReviewAtID,
            assessment: {
                call: projectCall,
                classification: projectClassification
            } = {},
            note_text: projectNoteText
        } = projectTechnicalReview || {};
        const {
            "@id": savedTechnicalReviewItemAtID,
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

        // Green (success) if first option, else yellow/orange for the 'Present - with concerns' options
        const callTrueIconCls = (
            "icon icon-2x icon-fw fas icon-check text-" + (
                (lastSavedCall === true || (!lastSavedTechnicalReviewForResult && savedCall === true) || (!lastSavedTechnicalReviewForResult && !savedTechnicalReviewItem && projectCall === true)) ? (
                    (lastSavedCall === true && lastSavedClassification === "Present") ? "success"
                        : (!lastSavedTechnicalReviewForResult && savedCall === true && savedClassification === "Present") ? "success"
                            : (!lastSavedTechnicalReviewForResult && !savedTechnicalReviewItem && projectCall === true && projectClassification === "Present") ? "success"
                                : "warning"
                ) : "muted" // (savedCall === true ? "secondary" : "muted")
            ));

        const callFalseIconCls = (
            "icon icon-2x icon-fw fas icon-times text-" + (
                (lastSavedCall === false || (!lastSavedTechnicalReviewForResult && savedCall === false) || (!lastSavedTechnicalReviewForResult && !savedTechnicalReviewItem && projectCall === false)) ? "danger"
                    : "muted" // (savedCall === false ? "secondary" : "muted")
            ));

        const isNotePotentiallyOutdated = lastSavedTechnicalReviewForResult && savedTechnicalReviewNoteText && !lastSavedNoteText;
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
                    <i className={callTrueIconCls} />
                    { lastSavedCall === true || (lastSavedTechnicalReviewForResult && typeof lastSavedCall === "undefined" && savedCall === true) ?
                        // lastSavedTechnicalReviewForResult === `null` means deletion, vs `undefined` means not present in unsaved state
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownNoCall} ref={this.callFalseButtonRef}
                    data-call="false" data-technical-review="true">
                    <i className={callFalseIconCls} />
                    { lastSavedCall === false || (lastSavedTechnicalReviewForResult && typeof lastSavedCall === "undefined" && savedCall === false) ?
                        // lastSavedTechnicalReviewForResult === `null` means deletion, vs `undefined` means not present in unsaved state
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
        const { result, optionName, callType, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData } = this.props;
        const {
            technical_review: savedTechnicalReviewItem,
            "@id" : variantSampleAtID,
            uuid: vsUUID,
            project: { "@id": vsProjectAtID },
            institution: { "@id": vsInstitutionAtID }
        } = result;
        const { "@id": savedTechnicalReviewItemAtID } = savedTechnicalReviewItem || {};
        const { assessment: { call: lastSavedCall, classification: lastSavedClassification } = {}, "@id": lastSavedAtID } = lastSavedTechnicalReviewForResult || {};

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
        let updatePromise = null;
        let techReviewResponse = null;

        console.log("TTT2", savedTechnicalReviewItem, lastSavedCall, lastSavedClassification);

        // If no existing Item -- TODO: Maybe pull this out into sep function in case need to reuse logic later re: Tech Review Notes or smth.
        if (!associatedTechnicalReviewAtID) {

            const createPayload = {
                "assessment": { "call": callType, "classification": optionName },
                // Explicitly add project+institution so is same as that of VariantSample and not that of user (potentially admin).
                "project": vsProjectAtID,
                "institution": vsInstitutionAtID
            };

            let technicalReviewAtID;

            updatePromise = ajax.promise("/notes-technical-review/", "POST", {}, JSON.stringify(createPayload))
                .then(function(res){
                    console.log('response', res);
                    const { "@graph": [ technicalReviewItemFrameObject ] } = res;
                    const { "@id": newTechnicalReviewAtID } = technicalReviewItemFrameObject;
                    if (!newTechnicalReviewAtID) {
                        throw new Error("No NoteTechnicalReview @ID returned."); // If no error thrown during destructuring ^..
                    }
                    technicalReviewAtID = newTechnicalReviewAtID;
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
                    // Also save "@id" of new NoteTechnicalReviewItem so we may (re-)PATCH it while savedTechnicalReviewItem & VS hasn't yet indexed
                    cacheSavedTechnicalReviewForVSUUID(vsUUID, { ..._.omit(createPayload, "project"), "@id": technicalReviewAtID });
                    return { created: true };
                });
        } else {
            const {
                // We may have a technical review Item but no assessment, e.g. if was unset or if Note was created for text only.
                assessment: {
                    call: savedCall = null,
                    classification: savedClassification = null
                } = {}
            } = savedTechnicalReviewItem || {};
            let updatePayload;
            // Deletion of `review` field should be done at backend for security, TODO: move to _update method there perhaps.
            const updateHref = associatedTechnicalReviewAtID + "?delete_fields=review";
            if (
                (lastSavedCall === callType && lastSavedClassification === optionName) ||
                (savedCall === callType && savedClassification === optionName && typeof lastSavedCall === "undefined")
            ) {
                // DEPRECATED: Delete/unset on PATCH/save -- leave as `{} & add `assessment` to delete_fields param.
                // CURRENT: Will fill values as null or empty, so that the datetime+author for deletion is saved.
                updatePayload = { "assessment": {} };
                // updateHref += ",assessment";
            } else {
                updatePayload = { "assessment": { "call": callType, "classification": optionName } };
            }
            updatePromise = ajax.promise(updateHref, "PATCH", {}, JSON.stringify(updatePayload))
                .then(function(res){
                    console.log('response', res);
                    const { "@graph": [ technicalReviewItemFrameObject ] } = res;
                    const { "@id": newTechnicalReviewAtID } = technicalReviewItemFrameObject;
                    if (!newTechnicalReviewAtID) {
                        throw new Error("No @ID returned."); // If no error thrown during destructuring ^..
                    }
                    techReviewResponse = res;
                    cacheSavedTechnicalReviewForVSUUID(vsUUID, updatePayload);
                    return { created: false };
                });
        }

        let propsForPopover;
        updatePromise
            .then((propsFromPromise) => {
                propsForPopover = propsFromPromise;
                // TODO: If save to project, do that..
                const { "@graph": [ technicalReviewItemFrameObject ] } = techReviewResponse;
                const { uuid: technicalReviewUUID } = technicalReviewItemFrameObject;
                if (shouldSaveToProject) {
                    return this.saveTechnicalReviewToProject(technicalReviewUUID);
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

    /** @return {Promise} AJAX request to update Variant's technical_reviews */
    saveTechnicalReviewToProject(technicalReviewUUID){
        const { result: variantSampleSearchResult, cacheSavedTechnicalReviewForVSUUID, isThisTechnicalReviewSavedToProject } = this.props;
        const { "@id": vsAtID, uuid: vsUUID, "@type": vsTypeList } = variantSampleSearchResult;
        const variantFieldName = vsTypeList[0] === "StructuralVariantSample" ? "structural_variant" : "variant";
        const { [variantFieldName]: { "@id": variantAtID } } = variantSampleSearchResult;
        const payload = {
            [isThisTechnicalReviewSavedToProject ? "remove_from_project_notes" : "save_to_project_notes"]: {
                "technical_review": technicalReviewUUID
            }
        };
        return ajax.promise(vsAtID + "@@process-items/", "PATCH", {}, JSON.stringify(payload))
            .then(function(processItemsResponse){
                const { status } = processItemsResponse;
                if (status !== "success") {
                    throw new Error("Failed to update Variant with new Technical Review, check permissions.");
                }
                // We save it to cache/lastSavedTechnicalReview as if was a linkTo item, since for comparison with savedTechnicalReview, we'll get embedded linkTo.
                cacheSavedTechnicalReviewForVSUUID(vsUUID, { "saved_to_project_variant": { "@id": variantAtID } } );
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
        const {
            assessment: {
                call: lastSavedCall,
                classification: lastSavedClassification
            } = {}
        } = lastSavedTechnicalReviewForResult || {};

        // linkTo exists but can't see @id - no view perms for entire NoteTechnicalReview
        const noViewPermissions = savedTechnicalReviewItem && !savedTechnicalReviewItemAtID;
        const disabled = propDisabled || noViewPermissions;

        // If was recently saved but not yet in search results
        const isLastSaved = lastSavedCall === callType && lastSavedClassification === optionName;

        // If in search results
        const isSavedToVS = savedCall === callType && savedClassification === optionName;
        const isAssessmentSavedToProject = projectCall === callType && projectClassification === optionName;

        // If was recently saved and this existing saved value is now unset (either technical_review.assessment changed or deleted)
        const isLastSaveDeleted = isSavedToVS && lastSavedTechnicalReviewForResult && !isLastSaved;

        // Allow more options later?
        const isDefaultSaveToProject = callType === false && optionName === "Recurrent Artifact";

        const btnClass = (
            (isLastSaved || (isSavedToVS && !isLastSaveDeleted) ? ` bg-${highlightColorStyle} text-white` : "") +
            (isLastSaveDeleted ? " bg-light text-secondary" : "")
        );

        const lastSavedIndicator = isLastSaved ?
            <span className="text-white text-700" data-tip="You recently saved this value and it may not be yet visible in search results"> *</span>
            : isLastSaveDeleted ?
                <i className="icon icon-minus-circle fas ml-08" data-tip="Previous Value" />
                : null;

        if (isDefaultSaveToProject) {

            console.log("TTT", projectTechnicalReview, isThisTechnicalReviewSavedToProject, isAssessmentSavedToProject);

            const saveToProjectBtnClass = (projectTechnicalReview || isThisTechnicalReviewSavedToProject) && isAssessmentSavedToProject ? ` bg-${highlightColorStyle} text-white` : "";
            const saveToProjectBtnTip = `This classification will be ${isThisTechnicalReviewSavedToProject ? "removed" : "saved"} <b>project-wide</b> for this variant`;
            // We don't have a way to unsave from project, so disable button for now if already saved to project.
            return (
                <div className="d-flex">
                    <button type="button" className={"dropdown-item pr-16" + saveToProjectBtnClass} onClick={this.handleClick} data-save-to-project={true}
                        disabled={disabled || (isAssessmentSavedToProject && !isThisTechnicalReviewSavedToProject)} data-html data-tip={saveToProjectBtnTip}>
                        { optionName }
                        <i className="icon icon-project-diagram fas small ml-16" />
                    </button>
                    <button type="button" className={"px-3 flex-grow-1 dropdown-item border-left" + btnClass} onClick={this.handleClick}
                        data-save-to-project={false} data-tip="Save only to this variant sample (and not project-wide for this variant)">
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
                saved_to_project_variant: { "@id": projectVariantAtID } = {},
                // "@id": objAtID
            } = obj;
            return {
                assessment: { call, classification },
                note_text,
                saved_to_project_variant: { "@id": projectVariantAtID }
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
            /** @type {Object.<string,{ assessment: { call: boolean|undefined, classification: string|undefined }|undefined, note_text: string|undefined, saved_to_project_variant: string|undefined, "@id": string|undefined }>} */
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
