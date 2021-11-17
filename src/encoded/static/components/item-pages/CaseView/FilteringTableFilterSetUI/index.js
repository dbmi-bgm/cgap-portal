'use strict';

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import queryString from 'query-string';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';

import Collapse from "react-bootstrap/esm/Collapse";

import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';

import { AddToVariantSampleListButton } from './AddToVariantSampleListButton';
import { SaveFilterSetButton } from './SaveFilterSetButton';
import { SaveFilterSetPresetButton } from './SaveFilterSetPresetButton';
import { PresetFilterSetSelectionUI } from './PresetFilterSetSelectionUI';
import { FilterBlock, DummyLoadingFilterBlock } from './FilterBlock';
import { ExportSearchSpreadsheetButton } from './ExportSearchSpreadsheetButton';


/**
 * Main view of the FilteringTableFilterSetUI.
 * Requires data to it to be passed in from FilterSetController as well as
 * EmbeddedSearchView (for which FSUI is a header).
 * @see CaseView/FilteringTab.js
 *
 * @todo
 * In future, once have server-sent-events+pubsub, could detect if new caseItem.active_filterset
 * and then update state.lastSavedFilterSet via getDerivedStateFromProps or componentDidUpdate or something
 */
export class FilteringTableFilterSetUI extends React.PureComponent {

    /**
     * @todo Move into own func?
     * @param {{ field, ... }[]} facets List of objects containing facet info from which we extract just certain non-dynamic fields into a cached dictionary of facet/field info.
     * @param {string[]} excludeFacets - List of field names to be excluded from this UI.
     * @returns {Object.<string, { field: string, title: string, description: string, grouping: string, order: number, aggregation_type: string, field_type: string, EXCLUDED: boolean }>} Dictionary of facet/field-info from schemas+response.
     */
    static buildFacetDictionary(facets = null, schemas = null, excludeFacets = null){

        const excluded = {};
        if (Array.isArray(excludeFacets)) {
            excludeFacets.forEach(function(fieldName){
                excluded[fieldName] = true;
            });
        }

        const dict = {};

        function saveFacetToDict(facetFields){
            const {
                field,
                title, description,
                grouping, order,
                aggregation_type = "terms",
                field_type
            } = facetFields;

            // We might get duplicate for some reason, leave first since more likely to have title.
            if (dict[field]) {
                return;
            }
            dict[field] = {
                field, title, description,
                grouping, order,
                aggregation_type, field_type,
                EXCLUDED: excluded[field] || false
            };
        }

        if (Array.isArray(facets)) {
            facets.forEach(saveFacetToDict);
        } else if (schemas) {
            // Fallback for when we launch on compound search / filterset (no context.facets yet available).
            // Somewhat fragile, maybe we can move calculation of aggregation_type from search.py/_initialize_facets
            // into same place in code where schemas are augmented to included calculated properties before being served from
            // /profiles/ endpoint to allow us to definitively just use the single schemas (instead of context.facets, as well)
            Object.keys(schemas["VariantSample"].facets).forEach(function(field){
                const facetFields = { ...schemas["VariantSample"].facets[field], field };
                return saveFacetToDict(facetFields);
            });
        }

        return dict;
    }

    /**
     * Validation - find any duplicates.
     * Not super performant calculation but we only usually have < 10 blocks so should be ok.
     */
    static findDuplicateBlocks(filter_blocks){
        const duplicateQueryIndices = {};
        const duplicateNameIndices = {};

        filter_blocks.forEach(function({ name, query }, idx){
            var i;
            for (i = 0; i < idx; i++) {
                if (filter_blocks[i].name === name) {
                    duplicateNameIndices[idx] = i; // idx gets converted to str here, self-reminder to parseInt(key) out if need to compare against it.
                    break;
                }
            }
            for (i = 0; i < idx; i++) {
                if (_.isEqual(queryString.parse(filter_blocks[i].query), queryString.parse(query))) {
                    duplicateQueryIndices[idx] = i; // idx gets converted to str here, self-reminder to parseInt(key) out if need to compare against it.
                    break;
                }
            }
        });

        return { duplicateQueryIndices, duplicateNameIndices };
    }

    static deriveSelectedFilterBlockIdxInfo(selectedFilterBlockIndices){
        let singleSelectedFilterBlockIdx = null;
        const selectedFilterBlockIdxList = Object.keys(selectedFilterBlockIndices);
        const selectedFilterBlockIdxCount = selectedFilterBlockIdxList.length;
        if (selectedFilterBlockIdxCount === 1) {
            singleSelectedFilterBlockIdx = parseInt(selectedFilterBlockIdxList[0]);
        }
        return { singleSelectedFilterBlockIdx, selectedFilterBlockIdxCount };
    }

    constructor(props){
        super(props);
        const { defaultOpen = true } = props;
        this.toggleOpen = _.throttle(this.toggleOpen.bind(this), 750);

        this.memoized = {
            buildFacetDictionary: memoize(FilteringTableFilterSetUI.buildFacetDictionary, function(newArgs, lastArgs){
                const [ nextFacets, nextSchemas ] = newArgs;
                const [ lastFacets, lastSchemas ] = lastArgs;
                // In this component we only want the titles and aggregation_types of facets, not their aggregations,
                // so we recalculate only if we never calculated them before.
                if ((!lastFacets && nextFacets) || (!lastSchemas && nextSchemas)) {
                    return false; // 'is not equal'
                }
                return true; // 'is equal'
            }),
            findDuplicateBlocks: memoize(FilteringTableFilterSetUI.findDuplicateBlocks),
            deriveSelectedFilterBlockIdxInfo: memoize(FilteringTableFilterSetUI.deriveSelectedFilterBlockIdxInfo)
        };

        this.state = {
            "bodyOpen": defaultOpen,
            "bodyMounted": defaultOpen, // Is set to true for 750ms after closing to help keep contents visible until collapsed.
        };
    }

    componentDidUpdate(pastProps, pastState){
        const {
            currFilterSet: pastFilterSet,
            selectedFilterBlockIndices: pastSelectedIndices,
            cachedCounts: pastCachedCounts
        } = pastProps;
        const { bodyOpen: pastBodyOpen } = pastState;
        const { currFilterSet, selectedFilterBlockIndices, cachedCounts } = this.props;
        const { bodyOpen } = this.state;

        if (currFilterSet && !pastFilterSet) {
            // This should only occur upon initialization, as otherwise even a blank/unsaved filterset would be present.
            if (currFilterSet["@id"]) {
                this.setState({ "lastSavedFilterSet": currFilterSet });
            }
        }

        if ( // Rebuild tooltips after stuff that affects tooltips changes.
            pastFilterSet !== currFilterSet         // If FilterSet changes, then some tips likely for it do as well, esp re: validation/duplicate-queries.
            || (bodyOpen && !pastBodyOpen)          // `data-tip` elems not visible until body mounted in DOM
            || cachedCounts !== pastCachedCounts    // Tooltip on filterblocks' counts indicator, if present.
            || !_.isEqual(selectedFilterBlockIndices, pastSelectedIndices)
        ) {
            setTimeout(ReactTooltip.rebuild, 50);
        }
    }

    toggleOpen(evt){
        this.setState(function({ bodyOpen: exstOpen }){
            const bodyOpen = !exstOpen;
            return { bodyOpen, "bodyMounted": true };
        }, () => {
            const { bodyOpen } = this.state;
            if (!bodyOpen) {
                setTimeout(()=>{
                    this.setState({ "bodyMounted": false });
                }, 700);
            }
        });
    }

    render(){
        const {
            // From EmbeddedSearchView:
            context: searchContext, // Current Search Response (not that of this filterSet, necessarily)
            hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions,
            requestedCompoundFilterSet, // From SPC/VirtualHrefController

            // From FilteringTab (& higher, e.g. App/redux-store):
            caseItem, schemas, session, searchHrefBase, searchType,

            // From SaveFilterSetButtonController:
            hasCurrentFilterSetChanged, isSavingFilterSet, saveFilterSet, haveEditPermission,

            // From SaveFilterSetPresetButtonController:
            hasFilterSetChangedFromOriginalPreset, hasFilterSetChangedFromLastSavedPreset,
            lastSavedPresetFilterSet, setLastSavedPresetFilterSet,
            originalPresetFilterSet, isOriginalPresetFilterSetLoading, refreshOriginalPresetFilterSet,

            // From FilterSetController:
            currFilterSet: filterSet = null,
            excludeFacets,
            cachedCounts = {},
            importFromPresetFilterSet,
            addNewFilterBlock, selectedFilterBlockIndices, selectFilterBlockIdx, removeFilterBlockAtIdx,
            setNameOfFilterBlockAtIdx, setTitleOfFilterSet, isSettingFilterBlockIdx,
            intersectFilterBlocks = false, toggleIntersectFilterBlocks,

            // From ajax.FetchedItem:
            isFetchingInitialFilterSetItem = false,

            // From SelectedItemsController:
            selectedVariantSamples, onResetSelectedVariantSamples,

            // From VariantSampleListController (in index.js, wraps CaseInfoTabView)
            variantSampleListItem, updateVariantSampleListID, fetchVariantSampleListItem, isLoadingVariantSampleListItem
        } = this.props;
        const { total: totalCount, facets = null } = searchContext || {};
        const { filter_blocks = [] } = filterSet || {};
        const { bodyOpen, bodyMounted } = this.state;

        // Only updates if facets is not null since we don't care about aggregated counts from search response.
        const facetDict                                                     = this.memoized.buildFacetDictionary(facets, schemas, excludeFacets);
        const { duplicateQueryIndices, duplicateNameIndices }               = this.memoized.findDuplicateBlocks(filter_blocks);
        const { singleSelectedFilterBlockIdx, selectedFilterBlockIdxCount } = this.memoized.deriveSelectedFilterBlockIdxInfo(selectedFilterBlockIndices);

        const filterBlocksLen = filter_blocks.length;
        const allFilterBlocksSelected = filterBlocksLen > 0 && (selectedFilterBlockIdxCount === 0 || selectedFilterBlockIdxCount === filterBlocksLen);
        // 0 selectedFilterBlockIdxCount is considered same as all filterblocks selected so we ensure this here.
        const selectedFilterBlockCount = allFilterBlocksSelected ? filterBlocksLen : selectedFilterBlockIdxCount;

        const { name: currentFilterBlockName = null } = (singleSelectedFilterBlockIdx !== null && filter_blocks[singleSelectedFilterBlockIdx]) || {};

        // console.log(
        //     'FilteringTableFilterSetUI Props',
        //     this.props
        // );


        const haveDuplicateQueries = _.keys(duplicateQueryIndices).length > 0;
        const haveDuplicateNames = _.keys(duplicateNameIndices) > 0;

        // Always disable if any of following conditions:
        const isEditDisabled = !bodyOpen || !haveEditPermission || haveDuplicateQueries || haveDuplicateNames || !filterSet || isSettingFilterBlockIdx;

        const headerProps = {
            filterSet, bodyOpen, caseItem,
            haveDuplicateQueries, haveDuplicateNames,
            isEditDisabled,
            // setTitleOfFilterSet,
            isFetchingInitialFilterSetItem,
            hasCurrentFilterSetChanged, isSavingFilterSet, saveFilterSet,

            // For SaveFilterSetPresetButton:
            hasFilterSetChangedFromOriginalPreset, hasFilterSetChangedFromLastSavedPreset,
            lastSavedPresetFilterSet, originalPresetFilterSet, isOriginalPresetFilterSetLoading, setLastSavedPresetFilterSet,
        };

        let fsuiBlocksBody = null;
        if (bodyMounted) {
            const bodyProps = {
                filterSet, filterBlocksLen, facetDict, excludeFacets, searchContext, schemas, isFetchingInitialFilterSetItem,
                singleSelectedFilterBlockIdx, selectedFilterBlockIndices, allFilterBlocksSelected, selectedFilterBlockIdxCount,
                addNewFilterBlock, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
                cachedCounts, duplicateQueryIndices, duplicateNameIndices, isSettingFilterBlockIdx,
                intersectFilterBlocks, toggleIntersectFilterBlocks,
                // Props for Save btn:
                saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged
            };
            fsuiBlocksBody = <FilterSetUIBody {...bodyProps} />;
        }

        const presetSelectionUIProps = {
            "currentCaseFilterSet": filterSet,
            caseItem, bodyOpen, session, importFromPresetFilterSet, hasCurrentFilterSetChanged, isEditDisabled,
            originalPresetFilterSet, refreshOriginalPresetFilterSet, hasFilterSetChangedFromOriginalPreset, isOriginalPresetFilterSetLoading,
            isFetchingInitialFilterSetItem, lastSavedPresetFilterSet
        };

        // console.info("Current Case FilterSet:", filterSet);

        return (
            // TODO 1: Refactor/simplify AboveTableControlsBase to not need nor use `panelMap` (needless complexity / never had use for it)
            <div className="above-variantsample-table-ui">

                <div className="filterset-outer-container" data-is-open={bodyOpen}>
                    <FilterSetUIHeader {...headerProps} toggleOpen={this.toggleOpen} />
                    <Collapse in={bodyOpen} appear>
                        <div>
                            <div className="d-flex flex-column flex-md-row">
                                <div className="filterset-preset-selection-outer-column">
                                    <PresetFilterSetSelectionUI { ...presetSelectionUIProps } {...{ searchType }}/>
                                </div>
                                <div className="flex-grow-1">
                                    { fsuiBlocksBody }
                                </div>
                            </div>
                        </div>
                    </Collapse>
                </div>

                <AboveTableControlsBase {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions }}
                    panelMap={AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(this.props)}>
                    <h4 className="text-400 col-12 col-lg my-0 py-1">
                        <strong className="mr-1">{ totalCount }</strong>
                        <span>
                            Variant Matches for { currentFilterBlockName ?
                                <em>{ currentFilterBlockName }</em>
                                // TODO: Allow to toggle Union vs Intersection in FilterSetController
                                : (
                                    <React.Fragment>
                                        <span className="text-600">{intersectFilterBlocks ? "Intersection" : "Union" }</span>
                                        { ` of ${selectedFilterBlockCount} Filter Blocks` }
                                    </React.Fragment>
                                ) }
                        </span>
                    </h4>
                    <div className="col col-lg-auto pr-06 d-flex">
                        { selectedVariantSamples instanceof Map ?
                            <div className="pr-14">
                                <AddToVariantSampleListButton {...{ selectedVariantSamples, onResetSelectedVariantSamples, caseItem, filterSet, selectedFilterBlockIndices,
                                    variantSampleListItem, updateVariantSampleListID, fetchVariantSampleListItem, isLoadingVariantSampleListItem, searchType }} />
                            </div>
                            : null }
                        <ExportSearchSpreadsheetButton {...{ requestedCompoundFilterSet, caseItem }} />
                    </div>
                </AboveTableControlsBase>
            </div>
        );
    }
}


function FilterSetUIHeader(props){
    const {
        filterSet, caseItem,
        hasCurrentFilterSetChanged, isSavingFilterSet, saveFilterSet,
        toggleOpen, bodyOpen,
        isEditDisabled,
        haveDuplicateQueries, haveDuplicateNames,
        isFetchingInitialFilterSetItem = false,
        // From SaveFilterSetPresetButtonController
        hasFilterSetChangedFromOriginalPreset, hasFilterSetChangedFromLastSavedPreset,
        lastSavedPresetFilterSet, originalPresetFilterSet, isOriginalPresetFilterSetLoading, setLastSavedPresetFilterSet,
    } = props;

    const {
        '@id': filterSetID,
        error: fsError = null,
        title: fsTitle = null,
        display_title: fsDisplayTitle = null
    } = filterSet || {};

    // const [ isEditingTitle, setIsEditingTitle ] = useState(false);

    // function onClickEditTitle(e){
    //     e.stopPropagation();
    //     e.preventDefault();
    //     setIsEditingTitle(true);
    // }

    if (fsError && !filterSetID) {
        // No view permission - shouldn't occur anymore since would get blankFilterSetItem in FilteringTab as initialFilterSetItem
        // but kept in case need to handle such case in future.
        // TODO: Add analytics here (?).
        return (
            <div className="px-3 py-3">
                <h4 className="text-400 my-0">
                    <span>Error: <em>{ fsError }</em></span>
                </h4>
            </div>
        );
    }


    let titleBlock = null;
    if (isFetchingInitialFilterSetItem) {
        titleBlock = (
            <h4 className="text-400 my-0 d-inline-block">
                <i className="small icon icon-fw fas mr-07 icon-circle-notch icon-spin" />
                <em>Loading Filter Set</em>
            </h4>
        );
    }/* else if (isEditingTitle) {
        titleBlock = (
            <form className="d-flex align-items-center mb-0" action="#case-info.filtering" onSubmit={function(e){
                e.stopPropagation();
                e.preventDefault();
                setIsEditingTitle(false);
                const formElem = e.target;
                const [ inputElem ] = formElem.children;
                setTitleOfFilterSet(inputElem.value);
            }}>
                <input type="text" name="filterName" className="form-control" defaultValue={fsTitle || fsDisplayTitle} />
                <button type="reset" className="btn btn-sm btn-outline-light ml-08" onClick={function(e){
                    e.stopPropagation();
                    e.preventDefault();
                    setIsEditingTitle(false);
                }}>
                    <i className="icon icon-fw icon-times fas" />
                </button>
                <button type="submit" className="btn btn-sm btn-outline-success ml-08"><i className="icon icon-fw icon-check fas" /></button>
            </form>
        );
    } */ else {
        titleBlock = (
            <h4 className="text-400 clickable my-0 d-inline-block" onClick={toggleOpen}>
                <i className={"small icon icon-fw fas mr-07 icon-" + (bodyOpen ? "minus" : "plus")} />
                { fsTitle || fsDisplayTitle || <em>No Title Set</em> }
                {/* bodyOpen ? <i className="icon icon-pencil-alt fas ml-1 clickable text-small" onClick={onClickEditTitle} /> : null */}
            </h4>
        );
    }

    const savePresetDropdownProps = {
        filterSet, caseItem, isEditDisabled, originalPresetFilterSet,
        hasFilterSetChangedFromOriginalPreset, hasFilterSetChangedFromLastSavedPreset,
        lastSavedPresetFilterSet, isOriginalPresetFilterSetLoading, setLastSavedPresetFilterSet,
    };

    // todo if edit permission(?): [ Save Button etc. ] [ Sum Active(?) Filters ]
    return (
        <div className="d-flex filter-set-ui-header align-items-center px-3 py-3">
            <div className="flex-grow-1">{ titleBlock }</div>
            <div className="ml-16">
                { haveDuplicateQueries || haveDuplicateNames ?
                    <i className="icon icon-exclamation-triangle fas align-middle mr-15 text-danger"
                        data-tip={`Filter blocks with duplicate ${haveDuplicateQueries ? "queries" : "names"} exist below`} />
                    : null }

                <div role="group" className="dropdown btn-group">
                    <SaveFilterSetButton {...{ saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged }} className="btn btn-sm btn-outline-light" />
                    <SaveFilterSetPresetButton {...savePresetDropdownProps} />
                </div>
            </div>
        </div>
    );
}


/** Renders the Blocks */
const FilterSetUIBody = React.memo(function FilterSetUIBody(props){
    const {
        filterSet, filterBlocksLen, facetDict, schemas,
        singleSelectedFilterBlockIdx, selectedFilterBlockIndices, allFilterBlocksSelected, selectedFilterBlockIdxCount,
        selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
        cachedCounts, duplicateQueryIndices, duplicateNameIndices, isSettingFilterBlockIdx, isFetchingInitialFilterSetItem = false,
        // Contains: addNewFilterBlock, toggleIntersectFilterBlocks, intersectFilterBlocks, saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged,
        ...remainingProps
    } = props;

    const { filter_blocks = [] } = filterSet || {};
    const { query: currentSingleBlockQuery = null } = (singleSelectedFilterBlockIdx !== null && filter_blocks[singleSelectedFilterBlockIdx]) || {};

    const commonProps = {
        facetDict, filterBlocksLen, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx, isSettingFilterBlockIdx,
        duplicateQueryIndices, duplicateNameIndices, cachedCounts, schemas
    };


    return (
        <div className="filterset-blocks-container blocks-outer-container" data-all-selected={allFilterBlocksSelected}>

            { typeof selectFilterBlockIdx === "function" ?
                // If selectFilterBlockIdx is not provided from FilterSetController, act as read-only view & don't show interaction-related elements.
                <div className="row pb-06 pt-08 px-3 align-items-center text-small">
                    <div className="col-12 pb-02 col-sm">
                        { filterBlocksLen === 1 ? null
                            : allFilterBlocksSelected ? "Click on a filter block to only search its query and/or edit its filters"
                                : "Shift+Click to select an additional filter block"
                        }
                    </div>
                    <div className="col-12 pb-02 col-sm-auto text-sm-right">
                        { (allFilterBlocksSelected ? "All" : selectedFilterBlockIdxCount + "/" + filterBlocksLen) + " filter blocks selected" }
                    </div>
                </div>
                : null }

            { filterBlocksLen > 0 ? (
                <div className="blocks-container px-3">
                    {
                        filter_blocks.map(function(filterBlock, index){
                            const selected = allFilterBlocksSelected || selectedFilterBlockIndices[index];
                            return (
                                <FilterBlock {...commonProps} {...{ filterBlock, index, selected }} key={index} />
                            );
                        })
                    }
                </div>
            ) : isFetchingInitialFilterSetItem ? (
                <div className="blocks-container px-3">
                    <DummyLoadingFilterBlock/>
                </div>
            ) : (
                <div className="py-3 px-3">
                    <h4 className="text-400 text-center text-danger my-0">No Blocks Defined</h4>
                </div>
            ) }

            <FilterSetUIBlockBottomUI {...remainingProps}
                {...{ selectFilterBlockIdx, allFilterBlocksSelected, filterBlocksLen, singleSelectedFilterBlockIdx, currentSingleBlockQuery }} />

        </div>
    );
});

function FilterSetUIBlockBottomUI(props){
    const {
        addNewFilterBlock,
        selectFilterBlockIdx,
        toggleIntersectFilterBlocks,
        allFilterBlocksSelected,
        filterBlocksLen,
        singleSelectedFilterBlockIdx,
        currentSingleBlockQuery,
        saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged,
        intersectFilterBlocks = false
    } = props;

    if (!saveFilterSet || !toggleIntersectFilterBlocks || !selectFilterBlockIdx) {
        // No function(s) present from FilterSet Controller. Don't show this UI and act as read-only.
        return null;
    }

    const onAddBtnClick = useCallback(function(e){
        e.stopPropagation();
        addNewFilterBlock();
    }, [ addNewFilterBlock ]);

    const onCopyBtnClick = function(e){
        e.stopPropagation();
        addNewFilterBlock({ "query" : currentSingleBlockQuery });
    };

    const onSelectAllClick = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        selectFilterBlockIdx(null);
    }, [ selectFilterBlockIdx ]);

    const onToggleIntersectFilterBlocksBtnClick = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        toggleIntersectFilterBlocks();
    }, [ toggleIntersectFilterBlocks ]);

    return (
        <div className="row pb-04 pt-16 px-3">
            <div className="col-auto mb-12">
                <div className="btn-group" role="group" aria-label="Selection Controls">
                    <button type="button" className="btn btn-primary-dark" onClick={onSelectAllClick} disabled={allFilterBlocksSelected}>
                        <i className={"icon icon-fw far mr-1 icon-" + (allFilterBlocksSelected ? "check-square" : "square")} />
                        Select All
                    </button>
                    <button type="button" className="btn btn-primary-dark" onClick={onToggleIntersectFilterBlocksBtnClick} disabled={filterBlocksLen < 2 || singleSelectedFilterBlockIdx !== null}
                        data-tip="Toggle whether to compute the union or intersection of filter blocks">
                        <i className={"icon icon-fw far mr-1 icon-" + (intersectFilterBlocks ? "check-square" : "square")} />
                        Intersect
                    </button>
                </div>
            </div>
            <div className="col-auto mb-12 flex-grow-1 d-flex justify-content-between flex-wrap">
                <div className="btn-group mr-08" role="group" aria-label="Creation Controls">
                    <button type="button" className="btn btn-primary-dark" onClick={onAddBtnClick} data-tip="Add new blank filter block">
                        <i className="icon icon-fw icon-plus fas mr-1" />
                        Add Filter Block
                    </button>
                    <button type="button" className="btn btn-primary-dark" onClick={onCopyBtnClick} disabled={!currentSingleBlockQuery}
                        data-tip="Copy currently-selected filter block">
                        <i className="icon icon-fw icon-clone far" />
                    </button>
                </div>
                <SaveFilterSetButton {...{ saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged }} className="btn btn-primary-dark"/>
            </div>
        </div>
    );
}
