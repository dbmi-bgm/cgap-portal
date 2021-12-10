'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


export function SaveFindingsButton(props){
    const {
        patchItems,
        changedClassificationsByVS,
        updateClassificationForVS,
        changedClassificationsCount,
        variantSampleListItem,
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem,
        disabled: propDisabled,
        className
    } = props;

    const disabled = propDisabled || isLoadingVariantSampleListItem || changedClassificationsCount === 0;

    const onClick = useCallback(function(e){
        e.stopPropagation();
        if (disabled) {
            return false;
        }

        const { variant_samples: vsObjects = [] } = variantSampleListItem || {};

        const payloads = []; // [ [path, payload], ... ]

        vsObjects.forEach(function(vsObject){
            const { variant_sample_item: { "@id": vsAtID, "uuid": vsUUID } } = vsObject;
            const { [vsUUID]: classificationToSaveForVS = undefined } = changedClassificationsByVS;

            if (!vsAtID) {
                // Filter out any VSes without view permissions, if any.
                // TODO: check actions for edit ability, perhaps.
                return;
            }

            if (classificationToSaveForVS === undefined) {
                // Preserve if === null, which means to delete the value.
                return;
            }

            const payload = [ vsAtID, {} ];
            if (classificationToSaveForVS === null) {
                payload[0] += "?delete_fields=finding_table_tag";
            } else {
                payload[1].finding_table_tag = classificationToSaveForVS;
            }

            payloads.push(payload);

        });


        patchItems(payloads, (countCompleted, patchErrors) => {
            if (countCompleted > 0) {
                // We don't need to call updateClassificationForVS(...) here, since
                // changedClassificationsByVS will be updated in CaseReviewController componentDidUpdate.
                if (typeof fetchVariantSampleListItem === "function") {
                    console.log("Refreshing our VariantSampleListItem with updated Note Item statuses.");
                    fetchVariantSampleListItem();
                } else {
                    throw new Error("No `props.fetchVariantSampleListItem` supplied to SaveFindingsButton");
                }
            }
            // TODO:
            // if (patchErrors.length > 0) {}
        });
    }, [ disabled, patchItems, variantSampleListItem, changedClassificationsByVS, updateClassificationForVS, fetchVariantSampleListItem ]);


    const applyFindingsTagsBtnText = (
        `Save ${changedClassificationsCount > 0 ? changedClassificationsCount + " " : ""}Finding${changedClassificationsCount !== 1 ? "s" : ""}`
    );

    return (
        <button type="button" {...{ disabled, onClick }} className={"btn btn-primary" + (className ? " " + className : "")}>
            { applyFindingsTagsBtnText }
        </button>
    );
}
