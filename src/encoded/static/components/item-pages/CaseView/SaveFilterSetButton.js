'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';
import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';


/**
 * This logic is split out from the SaveFilterSetButton,
 * because we want to have 2+ copies of this button potentially in the UI and data from here is useful
 * downstream, e.g. in SaveFilterSetPresetButton also.
 */
export class SaveFilterSetButtonController extends React.Component {

    static haveEditPermission(caseActions){
        return _.findWhere(caseActions, { "name" : "edit" });
    }

    /**
     * Re: param `fieldsToCompare` -
     * Eventually can add 'status' to this as well, if UI to edit it added.
     * In part we limit fields greatly because of differences between
     * `@@embedded` and other potential representations (i.e. `@@object` returned
     * on PATCH/POST).
     * Could be expanded/simplified if we get `@@embedded` back on PATCH/POST and
     * maybe AJAX in initial filter set (w all fields, not just those embedded
     * on Case Item.)
     *
     * @param {{ filter_blocks: Object[] }} savedFilterSet
     * @param {{ filter_blocks: Object[] }} currFilterSet
     * @param {string[]} fieldsToCompare - List of fields of FilterSet Item to compare.
     */
    static hasFilterSetChanged(savedFilterSet = null, currFilterSet = null, fieldsToCompare = ["filter_blocks", "title", "flags"]) {

        if (!savedFilterSet && currFilterSet) {
            // If is just initialized, then skip, even if new names/title.
            const { filter_blocks: currFilterBlocks = [] } = currFilterSet;
            if (currFilterBlocks.length > 1) {
                return true;
            }
            if (currFilterBlocks[0].query || currFilterBlocks[0].name !== "Filter Block 1" ) {
                return true;
            }
            return false;
        }

        if (!savedFilterSet && !currFilterSet) {
            return false;
        }

        if (savedFilterSet && !currFilterSet) {
            // Probably means is still loading currFilterSet,
            // will NOT be counted as new/changed filterset.
            return false;
        }

        if (savedFilterSet.status === "deleted") {
            // Consider this as always changed (always save-able).
            return true;
        }

        return !_.isEqual(
            // Skip over comparing fields that differ between frame=embed and frame=raw
            _.pick(savedFilterSet, ...fieldsToCompare),
            _.pick(currFilterSet, ...fieldsToCompare)
        );
    }

    constructor(props){
        super(props);
        const { currFilterSet: filterSet } = props;
        this.saveFilterSet = _.throttle(this.saveFilterSet.bind(this), 1500);

        this.memoized = {
            hasFilterSetChanged: memoize(SaveFilterSetButtonController.hasFilterSetChanged),
            haveEditPermission: memoize(SaveFilterSetButtonController.haveEditPermission)

        };

        this.state = {
            // Initially is blank or Case.active_filterset (once AJAXed in)
            "lastSavedFilterSet": (filterSet && filterSet['@id']) ? filterSet : null,
            "isSavingFilterSet": false
        };
    }

    componentDidUpdate({ currFilterSet: pastFilterSet }){
        const { currFilterSet, setIsSubmitting } = this.props;
        const { lastSavedFilterSet } = this.state;

        if (currFilterSet && !pastFilterSet) {
            // This should only occur upon initialization, as otherwise even a blank/unsaved filterset would be present.
            if (currFilterSet["@id"]) {
                this.setState({ "lastSavedFilterSet": currFilterSet });
            }
        }

        const hasFilterSetChanged = this.memoized.hasFilterSetChanged(lastSavedFilterSet, currFilterSet);

        if (currFilterSet && hasFilterSetChanged) {
            setIsSubmitting("Leaving will cause unsaved changes to FilterSet in the \"Filtering\" tab to be lost. Proceed?");
        } else {
            // Is OK if called frequently with same value, as App is a PureComponent
            // and won't update if state/prop value is unchanged.
            setIsSubmitting(false);
        }
    }

    /**
     * PATCHes the current filterset, if active_filterset
     * exists on caseItem. Else POSTs new FilterSet and then
     * sets it as the active_filterset of Case.
     */
    saveFilterSet(){
        const { currFilterSet: filterSet, caseItem } = this.props;
        const { lastSavedFilterSet } = this.state;
        const {
            "@id": caseAtID,
            project: { "@id": caseProjectID } = {},
            institution: { "@id": caseInstitutionID } = {}
        } = caseItem;

        console.log("SAv");

        const { "@id": existingFilterSetID } = lastSavedFilterSet || {};

        // No error handling (e.g. lastSavedFilterSet not having view permissions for) done here
        // as assumed `saveFilterSet` inaccessible if no permission, etc.

        this.setState({ "isSavingFilterSet" : true }, () => {
            if (existingFilterSetID) {
                // PATCH

                ajax.load(existingFilterSetID, (res) => {
                    const { "@graph" : [ existingFilterSetItem ] } = res;
                    this.setState({
                        // Get back and save @@object representation
                        "lastSavedFilterSet": existingFilterSetItem,
                        "isSavingFilterSet": false
                    });
                }, "PATCH", (err) => {
                    console.error("Error PATCHing existing FilterSet", err);
                    Alerts.queue({
                        "title" : "Error PATCHing existing FilterSet",
                        "message" : JSON.stringify(err),
                        "style" : "danger"
                    });
                    this.setState({ "isSavingFilterSet" : false });
                }, JSON.stringify(
                    _.pick(filterSet, ...filterSetFieldsToKeepPrePatch)
                ));

            } else {
                // POST

                const payload = _.pick(filterSet, ...filterSetFieldsToKeepPrePatch);
                // `institution` & `project` are set only upon create.
                payload.institution = caseInstitutionID;
                payload.project = caseProjectID;

                let newFilterSetItemFromPostResponse;

                ajax.promise("/filter-sets/", "POST", {}, JSON.stringify(payload))
                    .then((response)=>{
                        const { "@graph" : [ newFilterSetItemFromResponse ] } = response;
                        newFilterSetItemFromPostResponse = newFilterSetItemFromResponse;
                        const { uuid: nextFilterSetUUID } = newFilterSetItemFromResponse;

                        console.info("POSTed FilterSet, proceeding to PATCH Case.active_filterset", newFilterSetItemFromResponse);

                        return ajax.promise(caseAtID, "PATCH", {}, JSON.stringify({ "active_filterset" : nextFilterSetUUID }));
                    }).then((casePatchResponse)=>{
                        console.info("PATCHed Case Item", casePatchResponse);
                        this.setState({
                            // Get back and save @@object representation
                            "lastSavedFilterSet": newFilterSetItemFromPostResponse,
                            "isSavingFilterSet": false
                        });
                    }).catch((err)=>{
                        console.error("Error POSTing new FilterSet or PATCHing Case", err);
                        Alerts.queue({
                            "title" : "Error POSTing new FilterSet",
                            "message" : JSON.stringify(err),
                            "style" : "danger"
                        });
                        this.setState({ "isSavingFilterSet" : false });
                    });

            }
        });

    }

    render(){
        const { children, currFilterSet, caseItem, ...passProps } = this.props;
        const { isSavingFilterSet, lastSavedFilterSet } = this.state;
        const { actions: caseActions = [] } = caseItem || {};
        const hasCurrentFilterSetChanged = this.memoized.hasFilterSetChanged(lastSavedFilterSet, currFilterSet);
        const haveEditPermission = this.memoized.haveEditPermission(caseActions);
        const childProps = {
            ...passProps,
            currFilterSet,
            caseItem,
            isSavingFilterSet,
            hasCurrentFilterSetChanged,
            haveEditPermission,
            saveFilterSet: this.saveFilterSet
        };
        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }

}


export function SaveFilterSetButton(props){
    const {
        isEditDisabled,
        saveFilterSet,
        isSavingFilterSet,
        hasCurrentFilterSetChanged,
        className = "btn btn-primary"
    } = props;
    const disabled = isEditDisabled || isSavingFilterSet || !hasCurrentFilterSetChanged;

    const onSaveBtnClick = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        console.log("SAv", isEditDisabled ,isSavingFilterSet, !hasCurrentFilterSetChanged);
        if (disabled) return false;
        saveFilterSet();
    }, [ saveFilterSet, disabled ]);

    return (
        <button type="button" className={className} disabled={disabled}
            onClick={onSaveBtnClick} data-tip="Save this Case FilterSet">
            { isSavingFilterSet ?
                <i className="icon icon-spin icon-circle-notch fas" />
                : (
                    <React.Fragment>
                        <i className="icon icon-save fas mr-07"/>
                        Save Case FilterSet
                    </React.Fragment>
                ) }
        </button>
    );
}

/**
* IMPORTANT:
* We remove any calculated or linkTo things from PATCH/POST payload.
* linkTos must be transformed to UUIDs before POST as well.
* Hardcoded here since UI is pretty specific to it.
*/
export const filterSetFieldsToKeepPrePatch = [
    "title",
    "filter_blocks",
    "search_type",
    "flags",
    "created_in_case_accession",
    "uuid",
    "derived_from_preset_filterset"
];
