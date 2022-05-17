'use strict';

import React, { useMemo, useCallback, useRef, useState } from 'react';
import _ from 'underscore';
import Popover  from 'react-bootstrap/esm/Popover';
import ReactTooltip from 'react-tooltip';
import { ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/ajax';
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
            unsavedTechnicalReviewForResult,
            setTechnicalReviewForVSUUID
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

        setOpenPopoverData({
            "uuid": vsUUID,
            "call": true,
            "ref": this.callTrueButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600 text-uppercase" as="h5">Present</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { opts.slice(0,1).map(function(optionName, i){
                            return (
                                <CallClassificationButton {...{ optionName, result, unsavedTechnicalReviewForResult, setTechnicalReviewForVSUUID, setOpenPopoverData }}
                                    callType={true} key={i} />
                            );
                        }) }
                    </Popover.Content>
                    <Popover.Title className="m-0 text-600 text-uppercase border-top" as="h5">Present - with concerns</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { opts.slice(1).map(function(optionName, i){
                            return (
                                <CallClassificationButton {...{ optionName, result, unsavedTechnicalReviewForResult, setTechnicalReviewForVSUUID, setOpenPopoverData }}
                                    callType={true} key={i} highlightColorStyle="warning" />
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
            unsavedTechnicalReviewForResult,
            setTechnicalReviewForVSUUID,
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

        setOpenPopoverData({
            "uuid": vsUUID,
            "call": false,
            "ref": this.callFalseButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600 text-uppercase" as="h5">No Call</Popover.Title>
                    <Popover.Content className="px-0 py-1">
                        { opts.map(function(optionName, i){
                            return <CallClassificationButton {...{ optionName, result, unsavedTechnicalReviewForResult, setTechnicalReviewForVSUUID, setOpenPopoverData }} callType={false} key={i} />;
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
            unsavedTechnicalReviewNoteForResult,
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
                setTechnicalReviewNoteForVSUUID(vsUUID, { ...(unsavedTechnicalReviewNoteForResult || {}), "note_text": nextNoteText });
            }
        }
    }

    // THIS WILL CHANGE, MIGHT GET RID OF TechnicalReviewController Notes in general.
    handleOpenNotesPopover(){
        const {
            result,
            setOpenPopoverData,
            unsavedTechnicalReviewNoteForResult
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
        const { note_text: unsavedNoteText } = unsavedTechnicalReviewNoteForResult || {};

        setOpenPopoverData({
            "uuid": vsUUID,
            "call": null,
            "ref": this.notesButtonRef,
            "jsx": (
                <Popover id="technical-review-popover">
                    <Popover.Title className="m-0 text-600" as="h5">Technical Review Note</Popover.Title>
                    <Popover.Content className="p-2">
                        { savedInitialCallDate ?
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
            unsavedTechnicalReviewForResult,
            unsavedTechnicalReviewNoteForResult
        } = this.props;
        const { uuid: vsUUID, technical_review: savedTechnicalReviewItem } = result;
        const { assessment: savedTechnicalReview, note: savedTechnicalReviewNote = null } = savedTechnicalReviewItem || {};
        const {
            call: savedCall,
            classification: savedClassification
        } = savedTechnicalReview || {};
        const { call: unsavedCall, classification: unsavedClassification } = unsavedTechnicalReviewForResult || {};

        // Green (success) if first option, else yellow/orange for the 'Present - with concerns' options
        const noUnsavedTechnicalReview = typeof unsavedTechnicalReviewForResult === 'undefined';
        const callTrueIconCls = (
            "icon icon-2x icon-fw fas icon-check text-" + (
                (unsavedCall === true || (savedCall === true && noUnsavedTechnicalReview)) ? (
                    (unsavedCall === true && unsavedClassification === "Present") ? "success"
                        : (savedCall === true && noUnsavedTechnicalReview && savedClassification === "Present") ? "success"
                            : "warning"
                ) : "muted" // (savedCall === true ? "secondary" : "muted")
            ));

        const callFalseIconCls = (
            "icon icon-2x icon-fw fas icon-times text-" + (
                (unsavedCall === false || (savedCall === false && noUnsavedTechnicalReview)) ? "danger"
                    : "muted" // (savedCall === false ? "secondary" : "muted")
            ));

        const noteToBeDeleted = unsavedTechnicalReviewForResult && savedTechnicalReviewNote; // TODO: && !unsavedTechnicalReviewNote;
        const notesIconCls = (
            "icon icon-2x icon-fw icon-sticky-note " + (
                noteToBeDeleted ? "far text-danger"
                    : (savedTechnicalReviewNote || unsavedTechnicalReviewNoteForResult) ? "fas text-secondary"
                        : "far text-muted"
            ));

        return (
            <div className="w-100 d-flex align-items-center justify-content-around text-truncate py-1">

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownCall} ref={this.callTrueButtonRef}
                    data-call="true" data-technical-review="true">
                    <i className={callTrueIconCls} />
                    { unsavedCall === true || (unsavedTechnicalReviewForResult === null && savedCall === true) ?
                        // unsavedTechnicalReviewForResult === `null` means deletion, vs `undefined` means not present in unsaved state
                        <span className="text-danger position-absolute" data-tip="Not Saved">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenDropdownNoCall} ref={this.callFalseButtonRef}
                    data-call="false" data-technical-review="true">
                    <i className={callFalseIconCls} />
                    { unsavedCall === false || (unsavedTechnicalReviewForResult === null && savedCall === false) ?
                        // unsavedTechnicalReviewForResult === `null` means deletion, vs `undefined` means not present in unsaved state
                        <span className="text-danger position-absolute" data-tip="Not Saved">*</span>
                        : null }
                </button>

                <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={this.handleOpenNotesPopover} ref={this.notesButtonRef} data-technical-review="true">
                    <i data-tip={noteToBeDeleted ? "This note will be deleted upon save due to new classification. Create new note." : null} className={notesIconCls} />
                    { unsavedTechnicalReviewNoteForResult || (unsavedTechnicalReviewNoteForResult === null && savedTechnicalReviewNote) ?
                        <span className="text-danger position-absolute" data-tip="Not Saved">*</span>
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
        const { technical_review: savedTechnicalReviewItem } = result;
        const { "@id": existingTechnicalReviewItemAtID } = savedTechnicalReviewItem || {};

        // TODO: Handle lack of edit/view permissions


        // If no existing Item
        if (!savedTechnicalReviewItem) {
            ajax.promise("/technical-reviews/", "POST", {}, { "call": callType, "classification": optionName })
                .then(function(response){
                    try {
                        const { "@graph": [ { uuid: newTechnicalReviewUUID } ] } = response;
                    } catch (e) {
                        throw new Error("Failed to create new Technical Review, check permissions.");
                    }
                    console.log('response', response);
                });
        }


        if (savedCall === callType && savedClassification === optionName) {
            // Delete on PATCH/save, unless unsaved is something else, in which case reset unsaved for this vsUUID.
            if (typeof unsavedTechnicalReviewForResult === "undefined") {
                setTechnicalReviewForVSUUID(vsUUID, null);
            } else {
                setTechnicalReviewForVSUUID(vsUUID, undefined);
            }
        } else {
            setTechnicalReviewForVSUUID(vsUUID, { "call": callType, "classification": optionName });
        }

        setOpenPopoverData(null);



    }

    handleClick(){
        const { result, optionName, callType, setTechnicalReviewForVSUUID, setOpenPopoverData } = this.props;
        const {
            uuid: vsUUID,
            technical_review: {
                assessment: {
                    call: savedCall,
                    classification: savedClassification
                } = {}
            } = {}
        } = result;
        if (savedCall === callType && savedClassification === optionName) {
            // Delete on PATCH/save, unless unsaved is something else, in which case reset unsaved for this vsUUID.
            if (typeof unsavedTechnicalReviewForResult === "undefined") {
                setTechnicalReviewForVSUUID(vsUUID, null);
            } else {
                setTechnicalReviewForVSUUID(vsUUID, undefined);
            }
        } else {
            setTechnicalReviewForVSUUID(vsUUID, { "call": callType, "classification": optionName });
        }

        setOpenPopoverData(null);
    }

    render(){
        const {
            optionName,
            callType,
            result,
            unsavedTechnicalReviewForResult,
            highlightColorStyle = null
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
        const { call: unsavedCall, classification: unsavedClassification } = unsavedTechnicalReviewForResult || {};

        const highlightStyle = highlightColorStyle || (callType === true ? "success" : callType === false ? "danger" : null);

        const isUnsavedSelected = unsavedCall === callType && unsavedClassification === optionName;
        const isSavedSelected = savedCall === callType && savedClassification === optionName;
        const isSetToRemove = isSavedSelected && (unsavedTechnicalReviewForResult === null || (unsavedClassification && !isUnsavedSelected));

        const btnClass = (
            (isUnsavedSelected || (isSavedSelected && !isSetToRemove) ? ` bg-${highlightStyle} text-white` : "") +
            (isSetToRemove ? " bg-light text-secondary" : "")
        );

        return (
            <button type="button" className={"dropdown-item" + btnClass} onClick={this.handleClick}>
                { optionName }
                { isUnsavedSelected ?
                    <span className="text-white text-700" data-tip="Not Saved"> *</span>
                    : isSetToRemove ?
                        <i className="icon icon-minus-circle fas ml-08 text-danger" data-tip="Will be unset" />
                        : null }
            </button>
        );
    }
}


export function SaveTechnicalReviewButton(props){
    const { unsavedTechnicalReview, resetUnsavedTechnicalReviewAndNotes, haveCaseEditPermission, patchItems, isPatching } = props;

    const unsavedTechnicalReviewVSUUIDs = Object.keys(unsavedTechnicalReview);
    const unsavedTechnicalReviewVSUUIDsLen = unsavedTechnicalReviewVSUUIDs.length;

    const saveProcess = useCallback(function(){
        const payloads = [];
        unsavedTechnicalReviewVSUUIDs.forEach(function(vsUUID){
            const unsavedTechnicalReviewForVS = unsavedTechnicalReview[vsUUID];
            const payload = [ "/" + vsUUID, {} ];
            if (unsavedTechnicalReviewForVS === null) {
                payload[0] += "?delete_fields=technical_review";
            } else {
                payload[1].technical_review = unsavedTechnicalReviewForVS;
            }
            payloads.push(payload);
        });
        patchItems(payloads, function(countCompleted, patchErrors){
            if (countCompleted === unsavedTechnicalReviewVSUUIDsLen) {
                resetUnsavedTechnicalReviewAndNotes();
            }
        });
    }, [ unsavedTechnicalReview ]);

    const disabled = !haveCaseEditPermission || isPatching || unsavedTechnicalReviewVSUUIDsLen === 0;

    return (
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={saveProcess}>
            Update technical review for { unsavedTechnicalReviewVSUUIDsLen } samples
        </button>
    );

}

export class TechnicalReviewController extends React.PureComponent {

    constructor(props) {
        super(props);
        this.setTechnicalReviewForVSUUID = this._setStatePropertyForVSUUID.bind(this, "unsavedTechnicalReview");
        this.setTechnicalReviewNoteForVSUUID = this._setStatePropertyForVSUUID.bind(this, "unsavedTechnicalReviewNotes");
        this.resetUnsavedTechnicalReviewAndNotes = this.resetUnsavedTechnicalReviewAndNotes.bind(this);
        this.state = {
            "unsavedTechnicalReview": {},
            "unsavedTechnicalReviewNotes": {}
        };
    }

    _setStatePropertyForVSUUID(statePropertyName, vsUUID, value) {
        this.setState(function({ [statePropertyName]: existingStatePropertyObject }){
            // "undefined" means remove from state.unsavedTechnicalReview, "null" means to keep in state to queue for deletion in PATCH.
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

    resetUnsavedTechnicalReviewAndNotes() {
        this.setState({
            "unsavedTechnicalReview": {},
            "unsavedTechnicalReviewNotes": {}
        });
    }

    render(){
        const { children, ...passProps } = this.props;
        const { unsavedTechnicalReview, unsavedTechnicalReviewNotes } = this.state;
        const childProps = {
            ...passProps,
            unsavedTechnicalReview,
            unsavedTechnicalReviewNotes,
            "setTechnicalReviewForVSUUID": this.setTechnicalReviewForVSUUID,
            "setTechnicalReviewNoteForVSUUID": this.setTechnicalReviewNoteForVSUUID,
            "resetUnsavedTechnicalReviewAndNotes": this.resetUnsavedTechnicalReviewAndNotes
        };
        return React.Children.map(children, function(child){
            if (!React.isValidElement(child) || typeof child.type === "string") {
                return child;
            }
            return React.cloneElement(child, childProps);
        });
    }

}