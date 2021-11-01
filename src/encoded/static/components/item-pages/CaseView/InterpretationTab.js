'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { ajax, console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { VariantSampleSelectionList } from './VariantSampleSelection';




export const InterpretationTab = React.memo(function InterpretationTab (props) {
    const { variantSampleListItem, schemas, context, isLoadingVariantSampleListItem = false, fetchVariantSampleListItem } = props;
    const [ deletedVariantSampleSelections, setDeletedVariantSampleSelections ] = useState({});
    const [ changedOrdering, setChangedOrdering ] = useState(null); // For now at least, will be an array of variant sample @ids

    const useVSItem = useMemo(function(){

        let useVSItem = variantSampleListItem;

        if (changedOrdering) {
            const { variant_samples: vsSelections } = variantSampleListItem;
            const vsIDDict = {};
            vsSelections.forEach(function(vsSelection){
                const { variant_sample_item: { "@id": vsAtID } } = vsSelection;
                vsIDDict[vsAtID] = vsSelection;
            });
            const reorderedVSes = changedOrdering.map(function(vsAtID){
                return vsIDDict[vsAtID];
            });

            useVSItem = { ...variantSampleListItem, "variant_samples": reorderedVSes };
        }

        return useVSItem;
    }, [ variantSampleListItem, changedOrdering ]);

    const toggleVariantSampleSelectionDeletion = useCallback(function(vsAtIDToDelete){
        const nextDeletedVSes = { ...deletedVariantSampleSelections };
        if (nextDeletedVSes[vsAtIDToDelete]) {
            delete nextDeletedVSes[vsAtIDToDelete];
        } else {
            nextDeletedVSes[vsAtIDToDelete] = true;
        }
        setDeletedVariantSampleSelections(nextDeletedVSes);
    }, [ deletedVariantSampleSelections ]);

    const deletionsLen = Object.keys(deletedVariantSampleSelections).length;
    const anyUnsavedChanges = changedOrdering !== null || deletionsLen > 0;

    // const deleteVariantSampleSelection = useCallback(function(vsAtIDToDelete){
    //     // useVSItem would have up-to-date ordering after being produced by sorting by changedOrdering.
    //     const { variant_samples: vsSelections } = useVSItem;
    //     let deleteIdx = null;
    //     const nextOrdering = vsSelections.map(function({ variant_sample_item: { "@id": vsAtID } }, index){
    //         if (vsAtID === vsAtIDToDelete) {
    //             deleteIdx = index;
    //         }
    //         return vsAtID;
    //     });

    //     if (deleteIdx === null) {
    //         throw new Error("Expected deleteIdx to be valid");
    //     }

    //     nextOrdering.splice(deleteIdx, 1);
    //     setChangedOrdering(nextOrdering);
    // }, [ useVSItem ]);

    // TODO: Implement an "Apply Ordering/Deletion Changes" button + logic


    return (
        <React.Fragment>
            <div className="d-flex align-items-center justify-content-between mb-36">
                <h1 className="text-300 mb-0">
                    Interpretation
                    { isLoadingVariantSampleListItem ? <i className="icon icon-circle-notch icon-spin fas text-muted ml-12"/> : null }
                </h1>
                <div className="d-block d-md-flex">
                    <ExportInterpretationSpreadsheetButton {...{ variantSampleListItem }} disabled={anyUnsavedChanges} className="mr-08" />
                    <SaveVariantSampleListItemDeletionsButton {...{ variantSampleListItem, deletedVariantSampleSelections, setDeletedVariantSampleSelections,
                        changedOrdering, setChangedOrdering, anyUnsavedChanges, deletionsLen, fetchVariantSampleListItem }} />
                </div>
            </div>
            <div>
                <VariantSampleSelectionList {...{ isLoadingVariantSampleListItem, schemas, context, toggleVariantSampleSelectionDeletion,
                    deletedVariantSampleSelections, anyUnsavedChanges }} variantSampleListItem={useVSItem} />
            </div>
        </React.Fragment>
    );
});

function SaveVariantSampleListItemDeletionsButton (props) {
    const {
        variantSampleListItem,
        deletedVariantSampleSelections,
        setDeletedVariantSampleSelections,
        changedOrdering,
        setChangedOrdering,
        anyUnsavedChanges,
        deletionsLen,
        fetchVariantSampleListItem
    } = props;

    const [ isPatching, setIsPatching ] = useState(false);

    const patchVariantSampleListItem = useCallback(function(e){
        const {
            "@id": vslAtID,
            variant_samples: originalVariantSamplesList = []
        } = variantSampleListItem;
        function handleResponse(resp) {
            const { status } = resp;
            if (status !== "success") {
                // Error
                Alerts.queue({
                    "title": "Failed to PATCH VariantSampleList Item",
                    "message": "Perhaps no edit permission for this VariantSampleList or Case.",
                    "style": "danger"
                });
                setIsPatching(false);
                return;
            }

            fetchVariantSampleListItem(function(){
                // Reset `deletedVariantSampleSelections`, `changedOrdering`, & `isPatching`
                setDeletedVariantSampleSelections({});
                setChangedOrdering(null);
                setIsPatching(false);
            });
        }

        // If can't see even one of the Variant Samples,
        // then can't perform a reliable PATCH.
        let hasPermissionToViewAll = !!(vslAtID);

        const variant_samples = originalVariantSamplesList.map(function(vsSelection){
            // For PATCHing, convert linkTo from object to string.
            const { variant_sample_item: { "@id": vsAtID } } = vsSelection;
            return { ...vsSelection, "variant_sample_item": vsAtID };
        }).filter(function(vsSelection){
            const { variant_sample_item: vsAtID } = vsSelection;
            if (!vsAtID) {
                // Cannot proceed further, cancel afterwards.
                hasPermissionToViewAll = false;
            }
            // Exclude if to be deleted.
            return !deletedVariantSampleSelections[vsAtID];
        });

        // TODO: Sort; probably create dict of { vsAtID: indexInChangedOrdering } and then sort
        // `variant_samples` by it.

        if (!hasPermissionToViewAll) {
            Alerts.queue({
                "title": "No permissions",
                "message": "Lack permissions to view at least one item in this list. Cannot proceed.",
                "style": "danger"
            });
            return;
        }

        setIsPatching(true);

        ajax.load(vslAtID, handleResponse, "PATCH", handleResponse, JSON.stringify({ variant_samples }));
    }, [ variantSampleListItem, deletedVariantSampleSelections ]);

    const titleParts = [];
    if (changedOrdering) {
        titleParts.push("Ordering");
    }
    if (deletionsLen > 0) {
        titleParts.push("Deletions");
    }

    return (
        <button type="button" className="btn btn-primary" disabled={!anyUnsavedChanges || isPatching} onClick={patchVariantSampleListItem}>
            { isPatching ? <i className="icon icon-circle-notch icon-spin fas mr-08"/> : null }
            Save { titleParts.join(" & ") }
        </button>
    );
}

const ExportInterpretationSpreadsheetButton = React.memo(function ExportInterpretationSpreadsheetButton({ variantSampleListItem, disabled, className }) {
    // const { accession: caseAccession } = context; // Case Item
    const { "@id": atId, variant_samples: vsObjects = [] } = variantSampleListItem || {};
    const baseHref = atId + "/@@spreadsheet/?file_format=";
    return (
        <DropdownButton variant="outline-primary" disabled={disabled || vsObjects.length === 0} className={className}
            title={
                <span>
                    <i className="icon icon-table fas mr-1"/>
                    Export As...
                </span>
            }>
            <a href={baseHref + "tsv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">TSV</span> spreadsheet
            </a>
            <a href={baseHref + "csv"} target="_blank" rel="noopener noreferrer" className="dropdown-item" role="button" download>
                <span className="text-600">CSV</span> spreadsheet
            </a>
            <a href="#" className="dropdown-item disabled" target="_blank" rel="noopener noreferrer" role="button">
                <span className="text-600">XLSX</span> spreadsheet
            </a>
        </DropdownButton>
    );
});
