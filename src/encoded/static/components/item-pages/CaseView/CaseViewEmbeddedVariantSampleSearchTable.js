'use strict';

import React, { useMemo, useCallback, useRef, useState } from 'react';
import memoize from 'memoize-one';
import Popover  from 'react-bootstrap/esm/Popover';
import Overlay from 'react-bootstrap/esm/Overlay';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import ReactTooltip from 'react-tooltip';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper, flattenColumnsDefinitionsSortFields } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';

import { IconCheckbox } from '../../forms/IconCheckbox';
import { EmbeddedItemSearchTable } from './../components/EmbeddedItemSearchTable';
import { navigateChildWindow } from '../components/child-window-controls';
import { VariantSampleDisplayTitleColumn, VariantSampleDisplayTitleColumnSV } from './../../browse/variantSampleColumnExtensionMap';
import { StackedRowColumn } from '../../browse/variantSampleColumnExtensionMap';
import { TechnicalReviewColumn } from './TechnicalReviewColumn';

/* Used in FilteringTab */





export function CaseViewEmbeddedVariantSampleSearchTable(props){
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        ...passProps
    } = props;

    const columnExtensionMap = useMemo(function() {
        return {
            ...originalColExtMap,
            "display_title" : {
                // Preserve existing 'display_title' extension properties but overwrite render, minColumnWidth..
                ...originalColExtMap.display_title,
                "widthMap": { 'lg' : 200, 'md' : 200, 'sm' : 180 },
                "render": function(result, parentProps){
                    const { context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <VariantSampleDisplayTitleColumnWrapper {...{ result, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <VariantSampleDisplayTitleColumn />
                        </VariantSampleDisplayTitleColumnWrapper>
                    );
                }
            }
        };
    }, [ originalColExtMap ]);

    return <CaseViewEmbeddedVariantSampleSearchTableBase {...passProps} columnExtensionMap={columnExtensionMap} />;
}


export function CaseViewEmbeddedVariantSampleSearchTableSV(props) {
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        ...passProps
    } = props;

    const columnExtensionMap = useMemo(function() {
        return {
            ...originalColExtMap,
            "display_title" : {
                // Preserve existing 'display_title' extension properties but overwrite render, minColumnWidth..
                ...originalColExtMap.display_title,
                "widthMap": { 'lg' : 230, 'md' : 200, 'sm' : 180 },
                "render": function(result, parentProps){
                    const { context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <VariantSampleDisplayTitleColumnWrapper {...{ result, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <VariantSampleDisplayTitleColumnSV />
                        </VariantSampleDisplayTitleColumnWrapper>
                    );
                }
            }
        };
    }, [ originalColExtMap ]);

    return <CaseViewEmbeddedVariantSampleSearchTableBase {...passProps} columnExtensionMap={columnExtensionMap} />;
}


/**
 * Common interactive columns & related for both CNV and SNV Samples defined here
 * and then wrapped by CNV|SNV-specific table.
 * This table is wrapped by `SelectedItemsController` in FilteringTab which passes
 * in selected items and methods to select/deselect. `SelectedItemsController` is
 * originally used for selecting multiple items in new window, e.g. for HiGlass files
 * selection. It has some methods which are unused here.
 */

export function CaseViewEmbeddedVariantSampleSearchTableBase(props){
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedVariantSamples,
        onSelectVariantSample,
        savedVariantSampleIDMap = {},
        isLoadingVariantSampleListItem,
        currFilterSet,
        lastSavedTechnicalReview,
        cacheSavedTechnicalReviewForVSUUID,
        unsavedTechnicalReviewNoteTexts,
        cacheUnsavedTechnicalReviewNoteTextForVSUUID,
        haveCaseEditPermission,
        // passProps includes e.g. addToBodyClassList, removeFromBodyClassList (used for FacetList / ExtendedDescriptionPopover)
        ...passProps
    } = props;

    /**
     * For Technical Review Column; perhaps should rename to be more explicit, unless re-use for other columns...
     * @todo Potentially make this re-usable and part of shared-portal-components table, so any column can open popover easily.
     */
    const [ openPopoverData, setOpenPopoverData ] = useState(null);

    const technicalReviewCommonProps = { setOpenPopoverData, cacheSavedTechnicalReviewForVSUUID, cacheUnsavedTechnicalReviewNoteTextForVSUUID, haveCaseEditPermission };
    const interpretationSelectionCommonProps = { selectedVariantSamples, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem };

    const columnExtensionMap = useMemo(function() {
        return {
            ...originalColExtMap,
            /** Depends on temporary/unsaved state ... */
            "technical_review.assessment.call": {
                "disabled": false,
                "minColumnWidth": 90,
                "widthMap": { 'lg' : 108, 'md' : 98, 'sm' : 90 },
                "render": function(result, propsFromSearchTable){
                    const { uuid: vsUUID } = result;
                    const { rowNumber } = propsFromSearchTable;
                    const lastSavedTechnicalReviewForResult = lastSavedTechnicalReview[vsUUID];
                    const unsavedTechnicalReviewNoteTextForResult = unsavedTechnicalReviewNoteTexts[vsUUID];
                    return (
                        <TechnicalReviewColumn {...technicalReviewCommonProps} {...{ result, lastSavedTechnicalReviewForResult,
                            unsavedTechnicalReviewNoteTextForResult, rowNumber }} />
                    );
                }
            },
            "interpretation_selection" : {
                "disabled": false, // Is disabled:true by default in Schemas, so as to be hidden on search views not wrapped by SelectedItemsController.
                "noSort": true,
                "minColumnWidth": 36,
                "widthMap": { 'lg' : 70, 'md' : 68, 'sm' : 68 },
                "colTitle": "Move to Interpretation",
                "render": function(result, props) {
                    return <VariantSampleSelectionCheckbox {...interpretationSelectionCommonProps} result={result} />;
                }
            },
            /**
             * Depends on props.currFilterSet, which only available in CaseViewEmbeddedVarriantSampleSearchTable[SV]
             * Is only shown when multiple filter blocks requested.
             */
            "__matching_filter_block_names": {
                "noSort": true,
                "widthMap": { 'lg' : 60, 'md' : 60, 'sm' : 60 },
                "colTitle": <i className="icon icon-fw icon-object-ungroup far"/>,
                "render": function(result, props) {
                    const { __matching_filter_block_names = [] } = result;
                    if (__matching_filter_block_names.length === 0) {
                        return null;
                    }
                    return <MatchingFilterBlockIndicesPopoverColumn {...{ currFilterSet, result }} />;
                }
            }
        };
    }, [
        originalColExtMap,
        selectedVariantSamples,
        savedVariantSampleIDMap,
        isLoadingVariantSampleListItem,
        currFilterSet,
        lastSavedTechnicalReview,
        unsavedTechnicalReviewNoteTexts
    ]);

    return (
        <React.Fragment>
            <TechnicalReviewPopoverOverlay {...{ openPopoverData, setOpenPopoverData }} />
            <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} stickyFirstColumn />
        </React.Fragment>
    );
}


/** @todo Potentially make this re-usable and part of shared-portal-components table */
const TechnicalReviewPopoverOverlay = React.memo(function TechnicalReviewPopoverOverlay ({ openPopoverData, setOpenPopoverData }) {
    const {
        ref: openPopoverRef = null,
        jsx: openPopoverJSX = null
    } = openPopoverData || {};

    const onRootClickHide = useCallback(function(e){
        // If they clicked on another technical review column/row rule, don't close popover after switching info
        if (e.target && e.target.getAttribute("data-technical-review") === "true") {
            return false;
        }
        if (e.target && e.target.parentElement && e.target.parentElement.getAttribute("data-technical-review") === "true") {
            return false;
        }
        setOpenPopoverData(null);
    });

    if (!openPopoverData) {
        return null;
    }

    return (
        <Overlay target={openPopoverRef} show={!!openPopoverData} transition={false} placement="bottom"
            rootClose rootCloseEvent="click" onHide={onRootClickHide}>
            { openPopoverJSX }
        </Overlay>
    );
});


/** Open Variant Sample in new window */
function VariantSampleDisplayTitleColumnWrapper (props) {
    const { result, href, context, rowNumber, detailOpen, toggleDetailOpen, children } = props;

    const onClick = useCallback(function(evt){
        evt.preventDefault();
        evt.stopPropagation(); // Avoid having event bubble up and being caught by App.js onClick.
        const { "@id": resultAtID, uuid: resultUUID } = result;
        navigateChildWindow(resultAtID, resultUUID);
        return false;
    }, [ result ]);

    return (
        <DisplayTitleColumnWrapper {...{ result, context, rowNumber, detailOpen, toggleDetailOpen, onClick }} link="#">
            { children }
        </DisplayTitleColumnWrapper>
    );
}


/** Based mostly on SPC SelectionItemCheckbox w. minor alterations */
export const VariantSampleSelectionCheckbox = React.memo(function VariantSampleSelectionCheckbox(props){
    const {
        selectedVariantSamples,
        result,
        onSelectVariantSample,
        savedVariantSampleIDMap,
        isLoadingVariantSampleListItem = false,
        className = "mx-auto d-block my-0 text-larger"
    } = props;
    const { "@id": resultID } = result;
    const isPrevSaved = savedVariantSampleIDMap[resultID];
    const isSelected = selectedVariantSamples.has(resultID);
    const checked = isPrevSaved || isSelected;

    const disabled = (
        isLoadingVariantSampleListItem
        || isPrevSaved
        || !(selectedVariantSamples && onSelectVariantSample && savedVariantSampleIDMap)
    );

    const onChange = useCallback(function(e){
        return onSelectVariantSample(result, true);
    }, [ onSelectVariantSample, result ]);

    return <IconCheckbox {...{ checked, onChange, disabled, className }} />;
});

const MatchingFilterBlockIndicesPopoverColumn = React.memo(function MatchingFilterBlockIndicesPopoverColumn(props){
    const { result, currFilterSet } = props;
    const { __matching_filter_block_names = [], uuid: resultUUID } = result;
    const { filter_blocks = [] } = currFilterSet || {};

    const filterBlockNameList = __matching_filter_block_names.map(function(fbIdx, idxIdx){
        const matchingFilterBlock = filter_blocks[parseInt(fbIdx)];
        const { name } = matchingFilterBlock || {};
        return name || fbIdx;
    });

    const popover = (
        <Popover id={"mi:" + resultUUID}>
            <Popover.Title className="m-0 text-600" as="h5">Matches Filter Blocks:</Popover.Title>
            <Popover.Content className="pt-0 pl-0 pr-04">
                <ul className="mb-0 mt-08">
                    { filterBlockNameList.map(function(fbName, i){
                        return <li key={i}>{ fbName }</li>;
                    }) }
                </ul>
            </Popover.Content>
        </Popover>
    );

    return (
        <div className="mx-auto text-truncate">
            <OverlayTrigger trigger="focus" overlay={popover}>
                { function({ ref, ...triggerHandlers }){
                    return (
                        <button type="button" ref={ref} { ...triggerHandlers } className="btn btn-sm btn-link text-decoration-none">
                            { __matching_filter_block_names.length }
                        </button>
                    );
                }}
            </OverlayTrigger>
        </div>
    );
});

