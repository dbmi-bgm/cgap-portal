'use strict';

import React, { useMemo, useCallback, useRef, useState } from 'react';
import _ from 'underscore';
import Popover  from 'react-bootstrap/esm/Popover';
import ReactTooltip from 'react-tooltip';
import { ajax, JWT } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { PatchItemsProgress } from './../../util/PatchItemsProgress';



export class TechnicalReviewColumn extends React.PureComponent {

    constructor(props){
        super(props);

        this.updateUnsavedNoteText = _.debounce(this.updateUnsavedNoteText.bind(this), 500);
        this.handleOpenDropdownCall = this.handleOpenDropdownCall.bind(this);
        this.handleOpenDropdownNoCall = this.handleOpenDropdownNoCall.bind(this);
        this.handleOpenNotesPopover = this.handleOpenNotesPopover.bind(this);

        this.callTrueButtonRef = React.createRef();
        this.callFalseButtonRef = React.createRef();
        this.notesButtonRef = React.createRef();
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

        const { uuid: vsUUID } = result;

        const opts = [
            "Present",
            "Low Coverage",
            "Low Allelic Fraction",
            "Low Mapping Quality",
            "Strand Bias",
            "Mendelian Error",
            "Other"
        ];

        const commonBtnProps = {
            result, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData,
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

        const { uuid: vsUUID } = result;

        const opts = [
            "Recurrent Artifact",
            "Low Coverage",
            "Low Allelic Fraction",
            "Low Mapping Quality",
            "Strand Bias",
            "Mendelian Error",
            "Other"
        ];

        const commonBtnProps = {
            result, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData,
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

    /** Debounced in constructor. 'Business logic' will likely change/  */
    updateUnsavedNoteText(e){
        const {
            result,
            lastSavedTechnicalReviewNoteForResult,
            setTechnicalReviewNoteForVSUUID
        } = this.props;
        const {
            uuid: vsUUID,
            technical_review_note: savedTechnicalReviewNote = null
        } = result;
        const { note_text: savedNoteText } = savedTechnicalReviewNote || {};
        const nextNoteText = e.target.value;
        if (nextNoteText === ""){
            // Logic subject to change if add more meaningful properties to Note (and make it a subtype) aside from note_text.
            // Even if we keep just note_text, it's worth keeping it inside of an object for performance (avoids checking text value when comes down through props)
            if (!savedTechnicalReviewNote) {
                setTechnicalReviewNoteForVSUUID(vsUUID, undefined);
            } else {
                setTechnicalReviewNoteForVSUUID(vsUUID, null);
            }
        } else {
            if (savedNoteText && nextNoteText === savedNoteText) {
                // Unset from unsaved state if same value as existing
                setTechnicalReviewNoteForVSUUID(vsUUID, undefined);
            } else {
                setTechnicalReviewNoteForVSUUID(vsUUID, { ...(lastSavedTechnicalReviewNoteForResult || {}), "note_text": nextNoteText });
            }
        }
    }

    // THIS WILL CHANGE, MIGHT GET RID OF TechnicalReviewController Notes in general.
    handleOpenNotesPopover(){
        const {
            result,
            setOpenPopoverData,
            lastSavedTechnicalReviewNoteForResult
        } = this.props;
        const {
            uuid: vsUUID,
            technical_review: {
                assessment: savedTechnicalReview,
                note: savedTechnicalReviewNote = null
            } = {}
        } = result;
        const {
            call: savedCall,
            classification: savedClassification,
            date_call_made: savedCallDate,
            call_made_by: { display_title: savedCallAuthorName } = {} // Unlikely to be visible to most people.
        } = savedTechnicalReview || {};
        const {
            note_text: savedNoteText,
            last_modified: {
                date_modified: noteDateModified,
                modified_by: noteModifiedBy
            } = {},
            date_approved: noteDateApproved,
            approved_by: noteApprovedBy
        } = savedTechnicalReviewNote || {};
        const { note_text: unsavedNoteText } = lastSavedTechnicalReviewNoteForResult || {};

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
                        { noteDateModified ?
                            <div className="small">
                                Last Modified: <LocalizedTime timestamp={noteDateModified} />
                                { noteModifiedBy ? (" by " + noteModifiedBy) : null }
                            </div>
                            : null }
                        { noteDateApproved ?
                            <div className="small">
                                Approved: <LocalizedTime timestamp={noteDateApproved} />
                                { noteApprovedBy ? (" by " + noteApprovedBy) : null }
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
                        <textarea className="form-control" rows={5} defaultValue={unsavedNoteText || savedNoteText || ""} onChange={this.updateUnsavedNoteText} />
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
        const {
            result,
            lastSavedTechnicalReviewForResult,
            lastSavedTechnicalReviewNoteForResult
        } = this.props;

        const { uuid: vsUUID, technical_review: savedTechnicalReviewItem } = result;
        const { assessment: savedTechnicalReview, note: savedTechnicalReviewNote = null } = savedTechnicalReviewItem || {};
        const {
            call: savedCall,
            classification: savedClassification
        } = savedTechnicalReview || {};
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedTechnicalReviewForResult || {};

        const noLastSavedTechnicalReview = typeof lastSavedTechnicalReviewForResult === 'undefined';

        // Green (success) if first option, else yellow/orange for the 'Present - with concerns' options
        const callTrueIconCls = (
            "icon icon-2x icon-fw fas icon-check text-" + (
                (lastSavedCall === true || (savedCall === true && noLastSavedTechnicalReview)) ? (
                    (lastSavedCall === true && lastSavedClassification === "Present") ? "success"
                        : (savedCall === true && noLastSavedTechnicalReview && savedClassification === "Present") ? "success"
                            : "warning"
                ) : "muted" // (savedCall === true ? "secondary" : "muted")
            ));

        const callFalseIconCls = (
            "icon icon-2x icon-fw fas icon-times text-" + (
                (lastSavedCall === false || (savedCall === false && noLastSavedTechnicalReview)) ? "danger"
                    : "muted" // (savedCall === false ? "secondary" : "muted")
            ));

        const noteToBeDeleted = lastSavedTechnicalReviewForResult && savedTechnicalReviewNote; // TODO: && !lastSavedTechnicalReviewNote;
        const notesIconCls = (
            "icon icon-2x icon-fw icon-sticky-note " + (
                noteToBeDeleted ? "far text-danger"
                    : (savedTechnicalReviewNote || lastSavedTechnicalReviewNoteForResult) ? "fas text-secondary"
                        : "far text-muted"
            ));

        return (
            <div className="w-100 d-flex align-items-center justify-content-around text-truncate py-1">

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownCall} ref={this.callTrueButtonRef}
                    data-call="true" data-technical-review="true">
                    <i className={callTrueIconCls} />
                    { lastSavedCall === true || (lastSavedTechnicalReviewForResult === null && savedCall === true) ?
                        // lastSavedTechnicalReviewForResult === `null` means deletion, vs `undefined` means not present in unsaved state
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownNoCall} ref={this.callFalseButtonRef}
                    data-call="false" data-technical-review="true">
                    <i className={callFalseIconCls} />
                    { lastSavedCall === false || (lastSavedTechnicalReviewForResult === null && savedCall === false) ?
                        // lastSavedTechnicalReviewForResult === `null` means deletion, vs `undefined` means not present in unsaved state
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenNotesPopover} ref={this.notesButtonRef} data-technical-review="true">
                    <i data-tip={noteToBeDeleted ? "This note will be deleted upon save due to new classification. Create new note." : null} className={notesIconCls} />
                    { lastSavedTechnicalReviewNoteForResult || (lastSavedTechnicalReviewNoteForResult === null && savedTechnicalReviewNote) ?
                        <span className="text-warning position-absolute" data-tip="Recently saved and possibly not yet in search results">*</span>
                        : null }
                </button>

            </div>
        );
    }
}



class CallClassificationButton extends React.PureComponent {

    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    /* In progress */
    upsertTechnicalReviewItem(){
        const { result, optionName, callType, lastSavedTechnicalReviewForResult, cacheSavedTechnicalReviewForVSUUID, setOpenPopoverData } = this.props;
        const { technical_review: savedTechnicalReviewItem, "@id" : variantSampleAtID, uuid: vsUUID } = result;
        const { "@id": existingTechnicalReviewItemAtID } = savedTechnicalReviewItem || {};
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedTechnicalReviewForResult || {};

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

        let updatePromise = null;

        // If no existing Item -- TODO: Maybe pull this out into sep function in case need to reuse logic later re: Tech Review Notes or smth.
        if (!savedTechnicalReviewItem) {

            const updatePayload = {
                "assessment": { "call": callType, "classification": optionName }
            };

            updatePromise = ajax.promise("/technical-reviews/", "POST", {}, JSON.stringify(updatePayload))
                .then(function(techReviewResponse){
                    console.log('response', techReviewResponse);
                    const { "@graph": [ technicalReviewItemFrameObject ] } = techReviewResponse;
                    const { "@id": newTechnicalReviewAtID } = technicalReviewItemFrameObject;
                    if (!newTechnicalReviewAtID) {
                        throw new Error("No TechnicalReview @ID returned."); // If no error thrown during destructuring ^..
                    }
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
                    // EXPERIMENTAL -- imperfect attempt at notifying user of their last-edited things.
                    cacheSavedTechnicalReviewForVSUUID(vsUUID, { "call": callType, "classification": optionName });
                    return { created: true };
                });
        } else if (existingTechnicalReviewItemAtID) {
            const {
                assessment: {
                    call: savedCall,
                    classification: savedClassification
                }
            } = savedTechnicalReviewItem || {};
            let updatePayload;
            // Deletion of `review` field should be done at backend
            let updateHref = existingTechnicalReviewItemAtID + "?delete_fields=review";
            if (
                (lastSavedCall === callType && lastSavedClassification === optionName) ||
                (savedCall === callType && savedClassification === optionName && lastSavedTechnicalReviewForResult !== null)
            ) {
                // Pass. Delete/unset on PATCH/save -- leave as `{} & add `assessment` to delete_fields param.
                updatePayload = { };
                updateHref += ",assessment";
                // EXPERIMENTAL -- imperfect attempt at notifying user of their last-edited things.
                cacheSavedTechnicalReviewForVSUUID(vsUUID, null);
            } else {
                updatePayload = { "assessment": { "call": callType, "classification": optionName } };
                // EXPERIMENTAL -- imperfect attempt at notifying user of their last-edited things.
                cacheSavedTechnicalReviewForVSUUID(vsUUID, { "call": callType, "classification": optionName });
            }
            updatePromise = ajax.promise(updateHref, "PATCH", {}, JSON.stringify(updatePayload))
                .then(function(techReviewResponse){
                    console.log('response', techReviewResponse);
                    const { "@graph": [ technicalReviewItemFrameObject ] } = techReviewResponse;
                    const { "@id": newTechnicalReviewAtID } = technicalReviewItemFrameObject;
                    if (!newTechnicalReviewAtID) {
                        throw new Error("No @ID returned."); // If no error thrown during destructuring ^..
                    }
                    return { created: false };
                });
        } else {
            throw new Error("Check view permissions, can't access technical review.");
        }

        updatePromise
            .then(function(propsForPopover){
                // Show 'saved' popover.
                setOpenPopoverData(function({ ref: existingBtnRef }){
                    return { "ref": existingBtnRef, "jsx": <SavedTechnicalReviewPopover {...propsForPopover} /> };
                });
            })
            .catch(function(errorMsgOrObj){
                console.error(errorMsgOrObj);
                cacheSavedTechnicalReviewForVSUUID(vsUUID, undefined);
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


        // if (savedCall === callType && savedClassification === optionName) {
        //     // Delete on PATCH/save, unless unsaved is something else, in which case reset unsaved for this vsUUID.
        //     if (typeof unsavedTechnicalReviewForResult === "undefined") {
        //         setTechnicalReviewForVSUUID(vsUUID, null);
        //     } else {
        //         setTechnicalReviewForVSUUID(vsUUID, undefined);
        //     }
        // } else {
        //     setTechnicalReviewForVSUUID(vsUUID, { "call": callType, "classification": optionName });
        // }

        // setOpenPopoverData(null);

    }

    handleClick(){
        const { disabled } = this.props;

        if (disabled) {
            return false;
        }

        this.upsertTechnicalReviewItem();
    }

    render(){
        const {
            optionName,
            callType,
            result,
            lastSavedTechnicalReviewForResult,
            highlightColorStyle = null,
            disabled = false
        } = this.props;
        const {
            uuid: vsUUID,
            technical_review: {
                assessment: {
                    call: savedCall,
                    classification: savedClassification
                } = {}
            } = {}
        } = result;
        const { call: lastSavedCall, classification: lastSavedClassification } = lastSavedTechnicalReviewForResult || {};

        // If was recently saved but not yet in search results
        const isLastSaved = lastSavedCall === callType && lastSavedClassification === optionName;
        // If in search results
        const isSaved = savedCall === callType && savedClassification === optionName;
        // If was recently saved and this existing saved value is now unset (either technical_review.assessment changed or deleted)
        const isLastSaveDeleted = isSaved && (lastSavedTechnicalReviewForResult === null || (lastSavedClassification && !isLastSaved));

        const btnClass = (
            (isLastSaved || (isSaved && !isLastSaveDeleted) ? ` bg-${highlightColorStyle} text-white` : "") +
            (isLastSaveDeleted ? " bg-light text-secondary" : "")
        );

        return (
            <button type="button" className={"dropdown-item" + btnClass} onClick={this.handleClick} disabled={disabled}>
                { optionName }
                { isLastSaved ?
                    <span className="text-white text-700" data-tip="You recently saved this value and it may not be yet visible in search results"> *</span>
                    : isLastSaveDeleted ?
                        <i className="icon icon-minus-circle fas ml-08" data-tip="Previous Value" />
                        : null }
            </button>
        );
    }
}


const SavedTechnicalReviewPopover = React.forwardRef(function ({ created = false, ...passProps }, ref){
    return (
        <Popover {...passProps} id="technical-review-popover" key="success-new-review" ref={ref}>
            <Popover.Title className="m-0 text-600" as="h5">{ created ? "Created" : "Updated" } Technical Review</Popover.Title>
            <Popover.Content style={{ maxWidth: 320 }}>
                <h5 className="my-0">NOTE:</h5>
                <p className="mt-0">
                    It may take some time for your changes to become available in search results, please refresh or search again in a few minutes.
                </p>
            </Popover.Content>
        </Popover>
    );
});


export class TechnicalReviewController extends React.PureComponent {

    constructor(props) {
        super(props);
        this.cacheSavedTechnicalReviewForVSUUID = this._setStatePropertyForVSUUID.bind(this, "lastSavedTechnicalReview");
        this.setTechnicalReviewNoteForVSUUID = this._setStatePropertyForVSUUID.bind(this, "lastSavedTechnicalReviewNotes");
        this.resetLastSavedTechnicalReview = this.resetLastSavedTechnicalReview.bind(this);
        this.state = {
            "lastSavedTechnicalReview": {},
            "lastSavedTechnicalReviewNotes": {}
        };
    }

    _setStatePropertyForVSUUID(statePropertyName, vsUUID, value) {
        this.setState(function({ [statePropertyName]: existingStatePropertyObject }){
            // "undefined" means remove from state.lastSavedTechnicalReview, "null" means to keep in state to queue for deletion in PATCH.
            if (typeof value === "undefined") {
                if (typeof existingStatePropertyObject[vsUUID] !== "undefined") {
                    return { [statePropertyName] : _.omit(existingStatePropertyObject, vsUUID) };
                }
                return null;
            }
            // `value` may be null, which means 'queued for deletion' in PATCH.
            return { [statePropertyName] : { ...existingStatePropertyObject, [vsUUID]: value } };
        });
    }

    resetLastSavedTechnicalReview() {
        this.setState({
            "lastSavedTechnicalReview": {},
            "lastSavedTechnicalReviewNotes": {}
        });
    }

    render(){
        const { children, ...passProps } = this.props;
        const { lastSavedTechnicalReview, lastSavedTechnicalReviewNotes } = this.state;
        const childProps = {
            ...passProps,
            lastSavedTechnicalReview,
            lastSavedTechnicalReviewNotes,
            "cacheSavedTechnicalReviewForVSUUID": this.cacheSavedTechnicalReviewForVSUUID,
            "setTechnicalReviewNoteForVSUUID": this.setTechnicalReviewNoteForVSUUID,
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
