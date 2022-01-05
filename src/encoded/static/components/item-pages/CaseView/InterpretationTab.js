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
            const { variant_samples: vsSelections, structural_variant_samples: cnvSelections } = variantSampleListItem;

            // order SNV/Indel variant samples
            const vsIDDict = {};
            vsSelections.forEach(function(vsSelection){
                const { variant_sample_item: { "@id": vsAtID } } = vsSelection;
                vsIDDict[vsAtID] = vsSelection;
            });
            const reorderedVSes = changedOrdering.map(function(vsAtID){
                return vsIDDict[vsAtID];
            });

            // order CNV/SV variant samples
            const cnvIDDict = {};
            cnvSelections.forEach(function(cnvSelection) {
                const { structural_variant_sample_item: { "@id": cnvAtID } } = cnvSelection;
                cnvIDDict[cnvAtID] = cnvSelection;
            });
            const reorderedCNVs = changedOrdering.map(function(cnvAtID) {
                return cnvIDDict[cnvAtID];
            });

            useVSItem = { ...variantSampleListItem, "variant_samples": reorderedVSes, "structural_variant_samples": reorderedCNVs };
        }

        return useVSItem;
    }

    constructor(props){
        super(props);
        this.toggleVariantSampleSelectionDeletion = this.toggleVariantSampleSelectionDeletion.bind(this);
        this.toggleStructuralVariantSampleSelectionDeletion = this.toggleStructuralVariantSampleSelectionDeletion.bind(this);
        this.resetVariantSampleSelectionDeletionsAndOrdering = this.resetVariantSampleSelectionDeletionsAndOrdering.bind(this);
        this.state = {
            "deletedVariantSampleSelections": {},
            "deletedStructuralVariantSampleSelections": {},
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

    toggleStructuralVariantSampleSelectionDeletion(vsUUIDToDelete){
        this.setState(function({ deletedStructuralVariantSampleSelections }){
            const nextDeletedVSes = { ...deletedStructuralVariantSampleSelections };
            if (nextDeletedVSes[vsUUIDToDelete]) {
                delete nextDeletedVSes[vsUUIDToDelete];
            } else {
                nextDeletedVSes[vsUUIDToDelete] = true;
            }
            return { "deletedStructuralVariantSampleSelections": nextDeletedVSes };
        });
    }

    resetVariantSampleSelectionDeletionsAndOrdering(){
        this.setState({ "deletedVariantSampleSelections": {}, "deletedStructuralVariantSampleSelections": {}, "changedOrdering": null });
    }

    render(){
        const { children, variantSampleListItem: propVariantSampleListItem, ...passProps } = this.props;
        const { deletedVariantSampleSelections, deletedStructuralVariantSampleSelections, changedOrdering } = this.state;

        const snvDeletionsLen = this.memoized.deletionsLen(deletedVariantSampleSelections);
        const cnvDeletionsLen = this.memoized.deletionsLen(deletedStructuralVariantSampleSelections);
        const variantSampleListItem = this.memoized.reorderedVariantSampleListItem(propVariantSampleListItem, changedOrdering);

        const childProps = {
            ...passProps,
            variantSampleListItem, // <- reordered. Might make sense to do reordering elsewhere..
            deletedVariantSampleSelections,
            deletedStructuralVariantSampleSelections,
            changedOrdering,
            snvDeletionsLen,
            cnvDeletionsLen,
            "toggleVariantSampleSelectionDeletion": this.toggleVariantSampleSelectionDeletion,
            "toggleStructuralVariantSampleSelectionDeletion": this.toggleStructuralVariantSampleSelectionDeletion,
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
        deletedStructuralVariantSampleSelections,
        deletedVariantSampleSelections,
        changedOrdering,
        toggleVariantSampleSelectionDeletion,
        toggleStructuralVariantSampleSelectionDeletion,
        resetVariantSampleSelectionDeletionsAndOrdering,
        snvDeletionsLen,
        cnvDeletionsLen,
    } = props;

    console.log("InterpretationTab props", props);


    const anyUnsavedChanges = changedOrdering !== null || snvDeletionsLen > 0 || cnvDeletionsLen > 0;

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
                    <SaveVariantSampleListItemDeletionsAndOrderingButton {...{ variantSampleListItem, deletedVariantSampleSelections, deletedStructuralVariantSampleSelections, changedOrdering,
                        resetVariantSampleSelectionDeletionsAndOrdering, anyUnsavedChanges, snvDeletionsLen, cnvDeletionsLen, fetchVariantSampleListItem }} />
                </div>
            </div>
            <div>
                <VariantSampleSelectionList {...{ variantSampleListItem, isLoadingVariantSampleListItem,
                    deletedVariantSampleSelections, deletedStructuralVariantSampleSelections, anyUnsavedChanges, schemas, context,
                    toggleVariantSampleSelectionDeletion, toggleStructuralVariantSampleSelectionDeletion }} />
            </div>
        </React.Fragment>
    );
});



function SaveVariantSampleListItemDeletionsAndOrderingButton (props) {
    const {
        variantSampleListItem,
        deletedVariantSampleSelections,
        deletedStructuralVariantSampleSelections,
        changedOrdering,
        resetVariantSampleSelectionDeletionsAndOrdering,
        anyUnsavedChanges,
        snvDeletionsLen,
        cnvDeletionsLen,
        fetchVariantSampleListItem
    } = props;

    const [ isPatching, setIsPatching ] = useState(false);

    const deletionsPresent = snvDeletionsLen > 0 || cnvDeletionsLen > 0;

    const patchVariantSampleListItem = useCallback(function(e){
        const {
            "@id": vslAtID,
            variant_samples: originalVariantSamplesList = [],
            structural_variant_samples: originalStructuralVariantSamplesList = []
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
                resetVariantSampleSelectionDeletionsAndOrdering(); // resets BOTH SNV and SV selections
                setIsPatching(false);
            });
        }

        // If can't see even one of the Variant Samples (SNV or CNV),
        // then can't perform a reliable PATCH.
        let hasPermissionToViewAll = !!(vslAtID);

        // TODO: maybe consolidate the functions for filtering and mapping SVs and SNVs into one
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

        const structural_variant_samples = originalStructuralVariantSamplesList.filter(function(cnvSelection){
            const { structural_variant_sample_item: { uuid: cnvUUID } } = cnvSelection;
            if (!cnvUUID) {
                // Cannot proceed further, cancel afterwards.
                hasPermissionToViewAll = false;
                return false;
            }
            // Exclude if to be deleted.
            return !deletedStructuralVariantSampleSelections[svUUID];
        }).map(function(cnvSelection){
            // For PATCHing, convert linkTo from object to string.
            const { structural_variant_sample_item: { "@id": cnvAtID } } = cnvSelection;
            return { ...cnvSelection, "structural_variant_sample_item": cnvAtID };
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

        ajax.load(vslAtID, handleResponse, "PATCH", handleResponse, JSON.stringify({ variant_samples, structural_variant_samples }));
    }, [ variantSampleListItem, deletedVariantSampleSelections, deletedStructuralVariantSampleSelections ]);

    const titleParts = [];
    if (changedOrdering) {
        titleParts.push("Ordering");
    }
    if (deletionsPresent) {
        titleParts.push("Deletions");
    }

    let iconCls = null;
    if (isPatching) {
        iconCls = "circle-notch icon-spin fas";
    } else if (deletionsPresent) {
        iconCls = "trash fas";
    } else {
        iconCls = "save fas";
    }

    const btnCls = "btn d-flex align-items-center btn-" + (deletionsPresent ? "danger" : "primary");
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

// Note: Currently only works for SNVs; will need updating of spreadsheet generation code for SVs + UI updates
const ExportInterpretationSpreadsheetButton = React.memo(function ExportInterpretationSpreadsheetButton({ variantSampleListItem, disabled, className }) {
    // const { accession: caseAccession } = context; // Case Item
    const { "@id": atId, variant_samples: vsObjects = [] } = variantSampleListItem || {};
    const baseHref = atId + "/@@spreadsheet/?file_format=";
    return (
        <DropdownButton variant="outline-primary" disabled={disabled || vsObjects.length === 0} className={className}
            title={
                <span>
                    <i className="icon icon-fw icon-table fas mr-08"/>
                    Export SNVs As...
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
