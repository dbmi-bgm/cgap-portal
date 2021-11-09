'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { ajax, console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { VariantSampleSelectionList } from './VariantSampleSelection';


/**
 * State & update methods for `deletedVariantSampleSelections` & `changedOrdering`.
 * Transforms `props.variantSampleListItem` to have reordered variant_samples, according
 * to `state.changedOrdering` (subject to change).
 */
export class InterpretationTabController extends React.Component {

    static propTypes = {
        "variantSampleListItem": PropTypes.object.isRequired,
        "children": PropTypes.element
    };

    static reorderedVariantSampleListItem(variantSampleListItem, changedOrdering){
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
    }

    constructor(props){
        super(props);
        this.toggleVariantSampleSelectionDeletion = this.toggleVariantSampleSelectionDeletion.bind(this);
        this.resetVariantSampleSelectionDeletionsAndOrdering = this.resetVariantSampleSelectionDeletionsAndOrdering.bind(this);
        this.state = {
            "deletedVariantSampleSelections": {},
            // Not yet implemented fully:
            "changedOrdering": null
        };
        this.memoized = {
            reorderedVariantSampleListItem: memoize(InterpretationTabController.reorderedVariantSampleListItem),
            deletionsLen: memoize(function(deletedVariantSampleSelections){ return Object.keys(deletedVariantSampleSelections).length; })
        };
    }

    toggleVariantSampleSelectionDeletion(vsUUIDToDelete){
        this.setState(function({ deletedVariantSampleSelections }){
            const nextDeletedVSes = { ...deletedVariantSampleSelections };
            if (nextDeletedVSes[vsUUIDToDelete]) {
                delete nextDeletedVSes[vsUUIDToDelete];
            } else {
                nextDeletedVSes[vsUUIDToDelete] = true;
            }
            return { "deletedVariantSampleSelections": nextDeletedVSes };
        });
    }

    resetVariantSampleSelectionDeletionsAndOrdering(){
        this.setState({ "deletedVariantSampleSelections": {}, "changedOrdering": null });
    }

    render(){
        const { children, variantSampleListItem: propVariantSampleListItem, ...passProps } = this.props;
        const { deletedVariantSampleSelections, changedOrdering } = this.state;

        const deletionsLen = this.memoized.deletionsLen(deletedVariantSampleSelections);
        const variantSampleListItem = this.memoized.reorderedVariantSampleListItem(propVariantSampleListItem, changedOrdering);

        const childProps = {
            ...passProps,
            variantSampleListItem, // <- reordered. Might make sense to do reordering elsewhere..
            deletedVariantSampleSelections,
            changedOrdering,
            deletionsLen,
            "toggleVariantSampleSelectionDeletion": this.toggleVariantSampleSelectionDeletion,
            "resetVariantSampleSelectionDeletionsAndOrdering": this.resetVariantSampleSelectionDeletionsAndOrdering
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



export const InterpretationTab = React.memo(function InterpretationTab (props) {
    const {
        schemas, context,
        isActiveDotRouterTab = false,
        variantSampleListItem,
        isLoadingVariantSampleListItem = false,
        fetchVariantSampleListItem,
        deletedVariantSampleSelections,
        changedOrdering,
        toggleVariantSampleSelectionDeletion,
        resetVariantSampleSelectionDeletionsAndOrdering,
        deletionsLen
    } = props;

    console.log("InterpretationTab props", props);


    const anyUnsavedChanges = changedOrdering !== null || deletionsLen > 0;

    if (!isActiveDotRouterTab) {
        return null;
    }

    return (
        <React.Fragment>
            <div className="d-flex align-items-center justify-content-between mb-36">
                <h1 className="text-300 mb-0">
                    Interpretation
                    { isLoadingVariantSampleListItem ? <i className="icon icon-circle-notch icon-spin fas text-muted ml-12"/> : null }
                </h1>
                <div className="d-block d-md-flex">
                    <ExportInterpretationSpreadsheetButton {...{ variantSampleListItem }} disabled={anyUnsavedChanges} className="mr-08" />
                    <SaveVariantSampleListItemDeletionsAndOrderingButton {...{ variantSampleListItem, deletedVariantSampleSelections, changedOrdering,
                        resetVariantSampleSelectionDeletionsAndOrdering, anyUnsavedChanges, deletionsLen, fetchVariantSampleListItem }} />
                </div>
            </div>
            <div>
                <VariantSampleSelectionList {...{ variantSampleListItem, isLoadingVariantSampleListItem,
                    deletedVariantSampleSelections, anyUnsavedChanges, schemas, context, toggleVariantSampleSelectionDeletion }} />
            </div>
        </React.Fragment>
    );
});



function SaveVariantSampleListItemDeletionsAndOrderingButton (props) {
    const {
        variantSampleListItem,
        deletedVariantSampleSelections,
        changedOrdering,
        resetVariantSampleSelectionDeletionsAndOrdering,
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
                resetVariantSampleSelectionDeletionsAndOrdering();
                setIsPatching(false);
            });
        }

        // If can't see even one of the Variant Samples,
        // then can't perform a reliable PATCH.
        let hasPermissionToViewAll = !!(vslAtID);

        const variant_samples = originalVariantSamplesList.filter(function(vsSelection){
            const { variant_sample_item: { uuid: vsUUID } } = vsSelection;
            if (!vsUUID) {
                // Cannot proceed further, cancel afterwards.
                hasPermissionToViewAll = false;
                return false;
            }
            // Exclude if to be deleted.
            return !deletedVariantSampleSelections[vsUUID];
        }).map(function(vsSelection){
            // For PATCHing, convert linkTo from object to string.
            const { variant_sample_item: { "@id": vsAtID } } = vsSelection;
            return { ...vsSelection, "variant_sample_item": vsAtID };
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

    let iconCls = null;
    if (isPatching) {
        iconCls = "circle-notch icon-spin fas";
    } else if (deletionsLen > 0) {
        iconCls = "trash fas";
    } else {
        iconCls = "save fas";
    }

    const btnCls = "btn btn-" + (deletionsLen > 0 ? "danger" : "primary");
    const disabled = !anyUnsavedChanges || isPatching;

    return (
        <div className="btn-group" role="group">
            <button type="button" className={btnCls}
                disabled={disabled} onClick={patchVariantSampleListItem}>
                { iconCls ? <i className={"icon icon-fw mr-08 icon-" + iconCls}/> : null }
                Save { titleParts.join(" & ") }
            </button>
            <button type="button" className={btnCls} data-tip="Revert changes"
                disabled={disabled} onClick={resetVariantSampleSelectionDeletionsAndOrdering}>
                <i className="icon icon-fw icon-undo fas mr-08"/>
                Clear
            </button>
        </div>
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
                    <i className="icon icon-fw icon-table fas mr-08"/>
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
