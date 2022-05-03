'use strict';

import React, { useMemo, useCallback, useRef, useState } from 'react';
import Popover  from 'react-bootstrap/esm/Popover';
import Overlay from 'react-bootstrap/esm/Overlay';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import ReactTooltip from 'react-tooltip';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper, flattenColumnsDefinitionsSortFields } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { EmbeddedItemSearchTable } from './../components/EmbeddedItemSearchTable';
import { navigateChildWindow } from '../components/child-window-controls';
import { VariantSampleDisplayTitleColumn, VariantSampleDisplayTitleColumnSV } from './../../browse/variantSampleColumnExtensionMap';
import { StackedRowColumn } from '../../browse/variantSampleColumnExtensionMap';
import { TechnicalReviewColumn } from './TechnicalReviewColumn';

/* Used in FilteringTab */

/**
 * This table is wrapped by `SelectedItemsController` in FilteringTab which passes in selected items and methods to select/deselect, as well.
 * `SelectedItemsController` is originally used for selecting multiple items in new window, e.g. for HiGlass files selection. It has some methods which are unnecessary or unused.
 */
export function CaseViewEmbeddedVariantSampleSearchTable(props){
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedVariantSamples,
        onSelectVariantSample,
        savedVariantSampleIDMap = {},
        isLoadingVariantSampleListItem,
        currFilterSet,
        unsavedTechnicalReview,
        setTechnicalReviewForVSUUID,
        // passProps includes e.g. addToBodyClassList, removeFromBodyClassList (used for FacetList / ExtendedDescriptionPopover)
        ...passProps
    } = props;

    const columnExtensionMap = useMemo(function() {
        return {
            ...originalColExtMap,
            "display_title" : {
                // Preserve existing 'display_title' extension properties but overwrite render, minColumnWidth..
                ...originalColExtMap.display_title,
                "widthMap": { 'lg' : 250, 'md' : 220, 'sm' : 200 },
                "minColumnWidth" : (originalColExtMap.display_title.minColumnWidth || 100) + 20,
                "render": function(result, parentProps){
                    const { context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <VariantSampleDisplayTitleColumnWrapper {...{ result, context, rowNumber, detailOpen, toggleDetailOpen,
                            selectedVariantSamples, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem }}>
                            <VariantSampleDisplayTitleColumn />
                        </VariantSampleDisplayTitleColumnWrapper>
                    );
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
            },
            /** Depends on temporary/unsaved state ... */
            "technical_review.call": {
                "colTitle": "Technical Review",
                "widthMap": { 'lg' : 170, 'md' : 160, 'sm' : 150 },
                "render": function(result, props){
                    const {
                        uuid: vsUUID,
                        technical_review: { call, classification } = {}
                    } = result;

                    console.log("%R%", unsavedTechnicalReview);

                    return (
                        <div className="w-100 d-flex align-items-center justify-content-around text-truncate">
                            <button type="button" className="btn btn-link">
                                <i className={"icon icon-2x icon-fw fas icon-check text-" + (call === true ? "success" : "muted")} />
                            </button>
                            <i className={"icon icon-2x icon-fw fas icon-times text-" + (call === false ? "error" : "muted")} />
                            <i className={"icon icon-2x icon-fw fas icon-sticky-note text-muted"}  />
                        </div>
                    );
                }
            }
        };
    }, [ originalColExtMap, selectedVariantSamples, savedVariantSampleIDMap, isLoadingVariantSampleListItem, currFilterSet ]);

    return <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} stickyFirstColumn />;
}

/**
 * @todo
 * Consider having this render out <CaseViewEmbeddedVariantSampleSearchTable ...props /> but just
 * have it add "structural_variant.transcript.csq_gene.display_title" & "structural_variant.size"
 * and let `VariantSampleDisplayTitleColumn` determine if it's a SV or SNV.
 * This would allow this CaseViewEmbeddedVariantSampleSearchTableSV to be less repetitive of `CaseViewEmbeddedVariantSampleSearchTable`
 */
export function CaseViewEmbeddedVariantSampleSearchTableSV(props) {
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedVariantSamples,
        onSelectVariantSample,
        savedVariantSampleIDMap = {},
        isLoadingVariantSampleListItem,
        currFilterSet,
        unsavedTechnicalReview,
        setTechnicalReviewForVSUUID,
        // passProps includes e.g. addToBodyClassList, removeFromBodyClassList (used for FacetList / ExtendedDescriptionPopover)
        ...passProps
    } = props;

    // For Technical Review Column; perhaps should rename to be more explicit, unless re-use for other columns...
    const [ openPopoverData, setOpenPopoverData ] = useState(null);

    const columnExtensionMap = useMemo(function() {
        return {
            ...originalColExtMap,
            "display_title" : {
                // Preserve existing 'display_title' extension properties but overwrite render, minColumnWidth..
                ...originalColExtMap.display_title,
                "widthMap": { 'lg' : 250, 'md' : 220, 'sm' : 200 },
                "minColumnWidth" : (originalColExtMap.display_title.minColumnWidth || 100) + 20,
                "render": function(result, parentProps){
                    const { context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <VariantSampleDisplayTitleColumnWrapper {...{ result, context, rowNumber, detailOpen, toggleDetailOpen,
                            selectedVariantSamples, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem }}>
                            <VariantSampleDisplayTitleColumnSV />
                        </VariantSampleDisplayTitleColumnWrapper>
                    );
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
            },
            /** Depends on temporary/unsaved state ... */
            "technical_review.call": {
                "colTitle": "Technical Review",
                "widthMap": { 'lg' : 170, 'md' : 160, 'sm' : 150 },
                "render": function(result, props){
                    const { uuid: vsUUID } = result;
                    const unsavedTechnicalReviewForResult = unsavedTechnicalReview[vsUUID];
                    return <TechnicalReviewColumn {...{ result, unsavedTechnicalReviewForResult, setOpenPopoverData, setTechnicalReviewForVSUUID }} />;
                }
            },
            //
            // TODO: Move following 3 funcs to variantSampleColumnExtensionMap, maybe put some logic into memoized component(s) (?)
            //
            "structural_variant.transcript.csq_gene.display_title": {
                "noSort": true, // not currently a useful or informative sort.
                "render": function(result, props) {
                    const { "@id": atID, structural_variant: { transcript: transcripts = [] } = {} } = result || {};
                    const path = atID + "?annotationTab=0";

                    const transcriptsDeduped = {};
                    transcripts.forEach((transcript) => {
                        const { csq_gene: { display_title = null } = {} } = transcript;
                        transcriptsDeduped[display_title] = true;
                    });
                    const genes = Object.keys(transcriptsDeduped);

                    if (genes.length <= 2) { // show comma separated
                        return <a href={path} target="_blank" rel="noreferrer">{genes.join(", ")}</a>;
                    }
                    // show first and last gene separated by "..." with first 10 available on hover
                    const lastItemIndex = genes.length >= 10 ? 10 : genes.length;
                    const tipGenes = genes.slice(0, lastItemIndex).join(", ");

                    return <a href={path} target="_blank" rel="noreferrer" data-tip={tipGenes}>{`${genes[0]}...${genes[genes.length-1]}`}</a> ;
                }
            },
            "structural_variant.gnomadg_af": {
                "render": function(result, props) {
                    const { structural_variant: { gnomadg_af = null, unrelated_count = null } = {} } = result || {};
                    const { align = 'left' } = props;

                    const rows = [
                        <div className="d-block text-truncate" key="gnomadAF"><span className="text-600">gnomAD: </span>{gnomadg_af !== null ? gnomadg_af: "-"}</div>,
                        <div className="d-block text-truncate" key="internal"><span className="text-600">Internal: </span>{unrelated_count !== null ? unrelated_count: "-"}</div>
                    ];
                    return <StackedRowColumn {...{ rows }} className={"text-truncate text-" + align} />;
                }
            },
            "structural_variant.size": {
                "render": function(result, props) {
                    const { structural_variant: { size_display = null } = {} } = result || {};
                    return size_display;
                }
            }
        };
    }, [ originalColExtMap, selectedVariantSamples, savedVariantSampleIDMap, isLoadingVariantSampleListItem, currFilterSet, unsavedTechnicalReview ]);

    return (
        <React.Fragment>
            <TechnicalReviewPopoverOverlay {...{ openPopoverData, setOpenPopoverData }} />
            <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} stickyFirstColumn />
        </React.Fragment>
    );
}

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
        <Overlay target={openPopoverRef} show={!!openPopoverData} transition placement="bottom"
            rootClose rootCloseEvent="click" onHide={onRootClickHide}>
            { openPopoverJSX }
        </Overlay>
    );
});


/**
 * Open Variant Sample in new window
 */
function VariantSampleDisplayTitleColumnWrapper (props) {
    const {
        result, href, context, rowNumber, detailOpen, toggleDetailOpen,
        selectedVariantSamples, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem,
        children
    } = props;

    const onClick = useCallback(function(evt){
        evt.preventDefault();
        evt.stopPropagation(); // Avoid having event bubble up and being caught by App.js onClick.
        const { "@id": resultAtID, uuid: resultUUID } = result;
        navigateChildWindow(resultAtID, resultUUID);
        return false;
    }, [ result ]);

    let checkbox = null;
    if (selectedVariantSamples && onSelectVariantSample && savedVariantSampleIDMap) {
        checkbox = <VariantSampleSelectionCheckbox {...{ selectedVariantSamples, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem }} />;
    }

    return (
        <DisplayTitleColumnWrapper {...{ result, context, rowNumber, detailOpen, toggleDetailOpen, onClick }} link="#">
            { checkbox }{ children }
        </DisplayTitleColumnWrapper>
    );
}


/** Based mostly on SPC SelectionItemCheckbox w. minor alterations */
export const VariantSampleSelectionCheckbox = React.memo(function VariantSampleSelectionCheckbox(props){
    const { selectedVariantSamples, result, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem = false } = props;
    const { "@id": resultID } = result;
    const isPrevSaved = savedVariantSampleIDMap[resultID];
    const isSelected = selectedVariantSamples.has(resultID);
    const isChecked = isPrevSaved || isSelected;

    const onChange = useCallback(function(e){
        return onSelectVariantSample(result, true);
    }, [ onSelectVariantSample, result ]);

    return <input type="checkbox" checked={isChecked} onChange={onChange} disabled={isLoadingVariantSampleListItem || isPrevSaved} className="mr-2" />;
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

