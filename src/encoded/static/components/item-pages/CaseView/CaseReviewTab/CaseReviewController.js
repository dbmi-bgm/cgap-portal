'use strict';

import React from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { getAllNotesFromVariantSample } from './../variant-sample-selection-panels';


export class CaseReviewController extends React.Component {

    static savedClassificationsByVS(variantSampleListItem){
        const { variant_samples: vsObjects = [] } = variantSampleListItem || {};
        const savedClassificationsByVS = {};
        vsObjects.forEach(function({ variant_sample_item }){
            const { uuid: vsUUID, finding_table_tag = null } = variant_sample_item;
            if (!vsUUID) {
                return; // No view permission or similar.
            }
            savedClassificationsByVS[vsUUID] = finding_table_tag;
        });
        return savedClassificationsByVS;
    }

    /** Using getDerivedStateFromProps in place of componentDidMount to avoid re-renders. */
    static getDerivedStateFromProps(props, state) {
        const { variantSampleListItem } = props;
        const { pastVSLItem, changedClassificationsByVS: origClassificationDict } = state;

        const nextState = { "pastVSLItem": variantSampleListItem };

        if (variantSampleListItem !== pastVSLItem) {
            // Unset changedClassificationsByVS[uuid] for any VS
            // which has been saved (i.e. savedClassification is now equal to unsaved classification).

            const changedClassificationsCount = Object.keys(origClassificationDict).length;
            if (changedClassificationsCount === 0) {
                return null;
            }
            const savedClassificationsByVS = CaseReviewController.savedClassificationsByVS(variantSampleListItem);
            const nextChangedClassificationsByVS = {};
            let anyClassificationsUnset = false;
            Object.keys(origClassificationDict).forEach(function(vsUUID){
                if (savedClassificationsByVS[vsUUID] !== undefined) {
                    // Ensure vsAtID present in our list of variant_samples (`savedClassificationsByVS`); it may have been
                    // deleted in InterpretationTab in which case we need to delete it from changedClassificationsByVS
                    // as well.
                    const isEqual = (origClassificationDict[vsUUID] || null) === savedClassificationsByVS[vsUUID];
                    if (!isEqual) {
                        nextChangedClassificationsByVS[vsUUID] = origClassificationDict[vsUUID];
                    } else {
                        anyClassificationsUnset = true;
                    }
                }
            });

            if (anyClassificationsUnset) {
                console.log("Updating `changedClassificationsByVS` - ", origClassificationDict, nextChangedClassificationsByVS);
                nextState.changedClassificationsByVS = nextChangedClassificationsByVS;
            }

        }

        return nextState;
    }

    constructor(props){
        super(props);
        this.fetchProjectItem = this.fetchProjectItem.bind(this);
        this.fetchReportItem = this.fetchReportItem.bind(this);
        this.updateClassificationForVS = this.updateClassificationForVS.bind(this);
        this.state = {
            "changedClassificationsByVS": {},
            "projectItem": null,
            "fetchedReportItem": null,
            "isFetchingReportItem": true,
            // Reference to object, not clone (extra memory) of it. Used solely for getDerivedStateFromProps.
            "pastVSLItem": props.variantSampleListItem
        };
        this.memoized = {
            savedClassificationsByVS: memoize(CaseReviewController.savedClassificationsByVS),
            changedClassificationsCount: memoize(function(changedClassificationsByVS){ return Object.keys(changedClassificationsByVS).length; })
        };
    }

    componentDidMount() {
        const { projectItem, fetchedReportItem } = this.state;
        if (!projectItem) {
            this.fetchProjectItem();
        }
        if (!fetchedReportItem) {
            this.fetchReportItem();
        }
    }

    /**
     * Will be used to load case.project and pass down report settings.
     * Might be moved up to CaseView, if needed in other places on page.
     *
     * Should we grab project from somewhere else?
     */
    fetchProjectItem(){
        const {
            context: {
                project: { "@id": projectAtID = null } = {}
            }
        } = this.props;

        if (!projectAtID) {
            return;
        }


        // ajax.load("/embed" or projectAtID, ...)
    }

    fetchReportItem(callback){
        const { context: { report: { "@id": reportAtID } = {} } } = this.props;

        if (!reportAtID) {
            this.setState({ "isFetchingReportItem": false });
            return null;
        }

        const reportFetchCallback = (res = []) => {
            const [ fetchedReportItem ] = res;
            const { "@id": fetchedReportAtID } = fetchedReportItem || {};
            if (!fetchedReportAtID){
                // Alert, perhaps.
                this.setState({ "isFetchingReportItem": false });
                return;
            }
            this.setState({ fetchedReportItem, "isFetchingReportItem": false }, callback);
        };

        /* todo: embed */
        this.setState({ "isFetchingReportItem": true }, function(){
            ajax.load("/embed", reportFetchCallback, "POST", reportFetchCallback, JSON.stringify({
                "ids": [ reportAtID ],
                "fields": [
                    "@id",
                    "uuid",
                    /** Datetime in string/isoformat. Used as unique key for ReportGenerationView to reset its values upon Report updates. */
                    "last_modified.date_modified",
                    /**
                     * Used for checking if Note is saved to Report.
                     * Updated on adding Notes to Report and setting/unsetting finding_table_tag
                     */
                    "variant_samples.uuid",
                    "structural_variant_samples.uuid",
                    /** String */
                    "indication",
                    "analysis_performed",
                    "result_summary",
                    "recommendations",
                    "methodology",
                    "references",
                    "extra_notes",
                    "findings_texts"
                ]
            }));
        });
    }

    updateClassificationForVS(vsUUID, classification, callback){
        const { variantSampleListItem } = this.props;
        const savedClassificationsByVS = this.memoized.savedClassificationsByVS(variantSampleListItem);

        this.setState(function({ changedClassificationsByVS: origClassificationDict }){
            const { [vsUUID]: savedClassification = null } = savedClassificationsByVS;
            const nextChangedClassificationsByVS = { ...origClassificationDict };

            if ((!savedClassification && classification === null) || savedClassification === classification) {
                if (typeof nextChangedClassificationsByVS[vsUUID] === "undefined") {
                    return; // No change needed; skip update for performance.
                }
                delete nextChangedClassificationsByVS[vsUUID]; // undefined means (existing/equal) `savedClassification` will take precedence, no PATCH needed.
            } else {
                // Set explicit `null` (or truthy value) to inform to DELETE (or set) value of this field when PATCH.
                if (nextChangedClassificationsByVS[vsUUID] === classification) {
                    return; // No change needed; skip update for performance.
                }
                nextChangedClassificationsByVS[vsUUID] = classification;
            }
            return { "changedClassificationsByVS": nextChangedClassificationsByVS };
        }, callback);
    }

    render(){
        const { children, ...passProps } = this.props;
        const { changedClassificationsByVS, fetchedReportItem, isFetchingReportItem } = this.state;
        const changedClassificationsCount = this.memoized.changedClassificationsCount(changedClassificationsByVS);
        const childProps = {
            ...passProps,
            changedClassificationsByVS,
            changedClassificationsCount,
            "updateClassificationForVS": this.updateClassificationForVS,
            fetchedReportItem,
            isFetchingReportItem,
            "fetchReportItem": this.fetchReportItem
        };

        return React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) {
                // String or something
                return child;
            }
            if (typeof child.type === "string") {
                // Normal element (a, div, etc)
                return child;
            } // Else is React component
            return React.cloneElement(child, childProps);
        });
    }

}


/**
 * @todo Potentially merge with CaseReviewController
 */
export class CaseReviewSelectedNotesStore extends React.PureComponent {

    static alreadyInProjectNotes(variantSampleListItem) {
        return buildAlreadyStoredNoteUUIDDict(variantSampleListItem, function({ is_saved_to_project }){
            return is_saved_to_project === true;
        });
    }

    static alreadyInReportNotes(variantSampleListItem, report){
        const {
            uuid: reportUUID,
            variant_samples = [],
            structural_variant_samples = []
        } = report || {};
        if (!reportUUID) {
            return {};
        }
        return buildAlreadyStoredNoteUUIDDict(variantSampleListItem, function(noteItem, vsItem){
            const { associated_items: noteAssociatedItems } = noteItem;
            const { uuid: vsUUID } = vsItem;
            // Ensure this VariantSample is in `Report.variant_samples` or `Report.structural_variant_samples`.
            const foundVSEntryInReport = (
                _.findWhere(variant_samples, { "uuid": vsUUID }) || _.findWhere(structural_variant_samples, { "uuid": vsUUID })
            );
            if (!foundVSEntryInReport) {
                return false;
            }
            // Ensure this Report is in `Note.associated_items`.
            const foundReportEntryInNote = _.findWhere(noteAssociatedItems, { "item_type": "Report", "item_identifier": reportUUID });
            if (!foundReportEntryInNote) {
                return false;
            }
            return true;
        });
    }

    /** Using getDerivedStateFromProps instd of componentDidUpdate prevents additional render(s) */
    static getDerivedStateFromProps(props, state){
        const { variantSampleListItem, fetchedReportItem } = props;
        const { pastVSLItem, sendToProjectStore = {}, sendToReportStore = {} } = state;

        const nextState = { "pastVSLItem": variantSampleListItem };

        if (variantSampleListItem !== pastVSLItem) {
            // Clear sendToProjectStore and sendToReportStore of any items that were just saved
            // or updated by someone else.
            const alreadyInProjectNotes = CaseReviewSelectedNotesStore.alreadyInProjectNotes(variantSampleListItem);
            const alreadyInReportNotes = CaseReviewSelectedNotesStore.alreadyInReportNotes(variantSampleListItem, fetchedReportItem);

            const nextSendToProjectStore = { ...sendToProjectStore };
            const nextSendToReportStore = { ...sendToReportStore };
            let anyProjectStoreChanges = false;
            let anyReportStoreChanges = false;
            Object.keys(sendToProjectStore).forEach(function(noteUUID){
                if (alreadyInProjectNotes[noteUUID]) {
                    delete nextSendToProjectStore[noteUUID];
                    anyProjectStoreChanges = true;
                }
            });
            Object.keys(sendToReportStore).forEach(function(noteUUID){
                if (alreadyInReportNotes[noteUUID]) {
                    delete nextSendToReportStore[noteUUID];
                    anyReportStoreChanges = true;
                }
            });

            if (anyProjectStoreChanges) {
                nextState.sendToProjectStore = nextSendToProjectStore;
            }
            if (anyReportStoreChanges) {
                nextState.sendToReportStore = nextSendToReportStore;
            }

        }

        return nextState;
    }

    constructor(props) {
        super(props);
        this.toggleSendToProjectStoreItems = this.toggleStoreItems.bind(this, "sendToProjectStore");
        this.toggleSendToReportStoreItems = this.toggleStoreItems.bind(this, "sendToReportStore");

        this.state = {
            // Keyed by Note Item UUID and value is boolean true/false for now (can be changed)
            "sendToProjectStore": {},
            "sendToReportStore": {},
            // Reference to object, not clone (extra memory) of it. Used solely for getDerivedStateFromProps.
            "pastVSLItem": props.variantSampleListItem
        };

        this.memoized = {
            alreadyInProjectNotes: memoize(CaseReviewSelectedNotesStore.alreadyInProjectNotes),
            alreadyInReportNotes: memoize(CaseReviewSelectedNotesStore.alreadyInReportNotes)
        };
    }

    toggleStoreItems(storeName, noteSelectionObjects, callback = null){
        this.setState(function(currState){
            const nextStore = { ...currState[storeName] };
            noteSelectionObjects.forEach(function([ id, data ]){
                if (nextStore[id]) {
                    delete nextStore[id];
                } else {
                    nextStore[id] = data;
                }
            });
            return { [storeName] : nextStore };
        }, callback);
    }

    render(){
        const {
            props: {
                children,
                fetchedReportItem,
                variantSampleListItem,
                ...passProps
            },
            state,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
        } = this;

        const alreadyInProjectNotes = this.memoized.alreadyInProjectNotes(variantSampleListItem);
        const alreadyInReportNotes = this.memoized.alreadyInReportNotes(variantSampleListItem, fetchedReportItem);

        const childProps = {
            ...passProps,
            ...state,
            fetchedReportItem,
            variantSampleListItem,
            alreadyInProjectNotes,
            alreadyInReportNotes,
            toggleSendToProjectStoreItems,
            toggleSendToReportStoreItems,
        };
        return React.Children.map(children, function(c){
            if (React.isValidElement(c)) {
                return React.cloneElement(c, childProps);
            }
            return c;
        });
    }

}


/**
 * Builds dictionary to use to mark certain Notes as disabled and exclude them from selection.
 * From those notes which have already been published to knowledgebase.
 *
 * For now can just check if Note.is_saved_to_project === true and then keep that way if can assert Variant.interpretations etc. will be up-to-date.
 */
export function buildAlreadyStoredNoteUUIDDict(variantSampleListItem, checkFunction){
    const {
        variant_samples: snvVSObjects = [], //vsObjects = [],
        structural_variant_samples: cnvVSObjects = []
    } = variantSampleListItem || {}; // Might not yet be loaded.
    const dict = {};
    snvVSObjects.concat(cnvVSObjects).forEach(function({ variant_sample_item }){
        getAllNotesFromVariantSample(variant_sample_item).forEach(function(noteItem){
            const { uuid: noteUUID } = noteItem;
            if (checkFunction(noteItem, variant_sample_item)) {
                dict[noteUUID] = true;
            }
        });
    });
    return dict;
}
