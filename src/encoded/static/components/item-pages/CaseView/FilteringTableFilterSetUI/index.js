'use strict';

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import queryString from 'query-string';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';

import { console, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { buildSchemaFacetDictionary } from './../../../util/Schemas';
import { PatchItemsProgress } from './../../../util/PatchItemsProgress';
import { AboveTableControlsBaseCGAP } from './../../../browse/AboveTableControlsBaseCGAP';
import { SearchBar } from './../../../browse/SearchBar';
import { AddToVariantSampleListButton } from './AddToVariantSampleListButton';
import { SaveFilterSetButton, validateAllFilterSetBlockNames, savedVariantSampleListItemFilterBlockQueryDict } from './SaveFilterSetButton';
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
     * Builds a dictionary of all facets that might be applicable to the VariantSample Item type.
     * This dictionary is used to get field names, descriptions, etc. to show inside of filter blocks.
     *
     * @param {{ field, ... }[]} facets List of objects containing facet info from which we extract just certain non-dynamic fields into a cached dictionary of facet/field info.
     * @param {string[]} excludeFacets - List of field names to be excluded from this UI.
     * @returns {Object.<string, { field: string, title: string, description: string, grouping: string, order: number, aggregation_type: string, field_type: string, EXCLUDED: boolean }>} Dictionary of facet/field-info from schemas+response.
     */
    static buildFacetDictionary(schemas = null, excludeFacets = null, searchType = "VariantSample"){
        const schemaFacetDict = buildSchemaFacetDictionary(schemas)[searchType] || {};

        // Treat 'q' as a facet/filter when used in filterblocks.
        schemaFacetDict["q"] = {
            "title": "Text Search",
            "field": "q",
            "order": -100
        };

        if (Array.isArray(excludeFacets)) {
            excludeFacets.forEach(function(fieldName){
                delete schemaFacetDict[fieldName];
            });
        }

        return schemaFacetDict;
    }

    /**
     * Validation - find any duplicates.
     * Not super performant calculation but we only usually have < 10 blocks so should be ok.
     */
    static findDuplicateBlocks(filter_blocks){
        const duplicateQueryIndices = {};
        const duplicateNameIndices = {};
        let haveDuplicateQueries = false;
        let haveDuplicateNames = false;

        // For each filter_block, check any of its preceding blocks for equality.
        filter_blocks.forEach(function({ name, query }, idx){
            var i;
            for (i = 0; i < idx; i++) {
                if (filter_blocks[i].name === name) {
                    duplicateNameIndices[idx] = i; // idx gets converted to str here, self-reminder to parseInt(key) out if need to compare against it.
                    haveDuplicateNames = true;
                    break;
                }
            }
            for (i = 0; i < idx; i++) {
                if (object.compareQueries(queryString.parse(filter_blocks[i].query), queryString.parse(query))) {
                    duplicateQueryIndices[idx] = i; // idx gets converted to str here, self-reminder to parseInt(key) out if need to compare against it.
                    haveDuplicateQueries = true;
                    break;
                }
            }
        });

        return { duplicateQueryIndices, duplicateNameIndices, haveDuplicateQueries, haveDuplicateNames };
    }

    static deriveSelectedFilterBlockIdxInfo(selectedFilterBlockIndices){
        let singleSelectedFilterBlockIdx = null;
        const selectedFilterBlockIdxList = Object.keys(selectedFilterBlockIndices).map(function(stringIdx){
            return parseInt(stringIdx);
        });
        const selectedFilterBlockIdxCount = selectedFilterBlockIdxList.length;
        if (selectedFilterBlockIdxCount === 1) {
            [ singleSelectedFilterBlockIdx ] = selectedFilterBlockIdxList;
        }

        return { singleSelectedFilterBlockIdx, selectedFilterBlockIdxCount, selectedFilterBlockIdxList };
    }

    constructor(props){
        super(props);
        const { defaultOpen = true } = props;
        this.toggleOpen = _.throttle(this.toggleOpen.bind(this), 750);

        this.memoized = {
            buildFacetDictionary: memoize(FilteringTableFilterSetUI.buildFacetDictionary, function(newArgs, lastArgs){
                const [ nextSchemas ] = newArgs;
                const [ lastSchemas ] = lastArgs;
                // We recalculate only if we get schemas and didn't have them before.
                // searchType and excludeFacets not expected to change per instance.
                if (!lastSchemas && nextSchemas) {
                    return false; // 'is not equal'
                }
                return true; // 'is equal'
            }),
            findDuplicateBlocks: memoize(FilteringTableFilterSetUI.findDuplicateBlocks),
            deriveSelectedFilterBlockIdxInfo: memoize(FilteringTableFilterSetUI.deriveSelectedFilterBlockIdxInfo),
            savedVariantSampleListItemFilterBlockQueryDict: memoize(savedVariantSampleListItemFilterBlockQueryDict),
            validateAllFilterSetBlockNames: memoize(validateAllFilterSetBlockNames)
        };

        this.state = {
            "bodyOpen": defaultOpen
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
            return { "bodyOpen": !exstOpen };
        });
    }

    render(){
        const {
            // From EmbeddedSearchView:
            context: searchContext, // Current Search Response (not that of this filterSet, necessarily)
            hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions,
            sortBy, sortColumns, // From SPC/SortController
            requestedCompoundFilterSet, // From SPC/VirtualHrefController
            isContextLoading,
            navigate: virtualNavigate,

            // From FilteringTab (& higher, e.g. App/redux-store):
            caseItem, schemas, session, searchHrefBase, searchType, isActiveDotRouterTab, haveCaseEditPermission,

            // From TechnicalReviewController (used in FilteringTab)
            // lastSavedTechnicalReview, lastSavedTechnicalReviewNotes, resetLastSavedTechnicalReview,

            // From SaveFilterSetButtonController:
            hasCurrentFilterSetChanged, isSavingFilterSet, saveFilterSet,

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
        const { bodyOpen } = this.state;

        // Only updates if facets is not null since we don't care about aggregated counts from search response.
        const facetDict = this.memoized.buildFacetDictionary(schemas, excludeFacets, searchType);
        const { duplicateQueryIndices, duplicateNameIndices, haveDuplicateQueries, haveDuplicateNames } = this.memoized.findDuplicateBlocks(filter_blocks);
        const { singleSelectedFilterBlockIdx, selectedFilterBlockIdxCount, selectedFilterBlockIdxList } = this.memoized.deriveSelectedFilterBlockIdxInfo(selectedFilterBlockIndices, filterSet);

        const filterBlocksLen = filter_blocks.length;
        const allFilterBlocksSelected = filterBlocksLen > 0 && (selectedFilterBlockIdxCount === 0 || selectedFilterBlockIdxCount === filterBlocksLen);
        // 0 selectedFilterBlockIdxCount is considered same as all filterblocks selected so we ensure this here.
        const selectedFilterBlockCount = allFilterBlocksSelected ? filterBlocksLen : selectedFilterBlockIdxCount;

        const { name: currentFilterBlockName = null } = (singleSelectedFilterBlockIdx !== null && filter_blocks[singleSelectedFilterBlockIdx]) || {};

        // console.log(
        //     'FilteringTableFilterSetUI Props',
        //     this.props
        // );

        const savedToVSLFilterBlockQueries = this.memoized.savedVariantSampleListItemFilterBlockQueryDict(variantSampleListItem);
        const allFilterBlockNameQueriesValid = this.memoized.validateAllFilterSetBlockNames(savedToVSLFilterBlockQueries, filterSet);

        // Always disable if any of following conditions:
        const isEditDisabled = (
            haveDuplicateQueries || haveDuplicateNames ||
            !allFilterBlockNameQueriesValid ||
            !filterSet || isSettingFilterBlockIdx
        );

        const headerProps = {
            filterSet, bodyOpen, caseItem,
            haveDuplicateQueries, haveDuplicateNames, allFilterBlockNameQueriesValid,
            isEditDisabled, haveCaseEditPermission,
            // setTitleOfFilterSet,
            isFetchingInitialFilterSetItem,
            hasCurrentFilterSetChanged, isSavingFilterSet, saveFilterSet,

            // For SaveFilterSetPresetButton:
            hasFilterSetChangedFromOriginalPreset, hasFilterSetChangedFromLastSavedPreset,
            lastSavedPresetFilterSet, originalPresetFilterSet, isOriginalPresetFilterSetLoading, setLastSavedPresetFilterSet,
        };

        let fsuiBlocksBody = null;
        let aboveTableControls = null;

        if (bodyOpen && isActiveDotRouterTab) {
            const bodyProps = {
                filterSet, filterBlocksLen, facetDict, excludeFacets, searchContext, schemas, isFetchingInitialFilterSetItem,
                singleSelectedFilterBlockIdx, selectedFilterBlockIndices, allFilterBlocksSelected, selectedFilterBlockIdxCount,
                addNewFilterBlock, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
                cachedCounts, duplicateQueryIndices, duplicateNameIndices, isSettingFilterBlockIdx,
                intersectFilterBlocks, toggleIntersectFilterBlocks,
                savedToVSLFilterBlockQueries, allFilterBlockNameQueriesValid,
                // Props for Save btn:
                saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged,
                haveCaseEditPermission
            };

            fsuiBlocksBody = <FilterSetUIBody {...bodyProps} />;
        }

        if (isActiveDotRouterTab) {
            aboveTableControls = (
                <React.Fragment>
                    { selectedVariantSamples instanceof Map ?
                        <div className="filtering-tab-table-controls pb-08 row align-items-center mt-12">
                            <div className="col-12 col-md col text-md-right pr-md-0">
                                <h5 className="text-600">Move to Interpretation</h5>
                            </div>
                            <div className="col-12 col-md-auto">
                                <AddToVariantSampleListButton {...{ selectedVariantSamples, onResetSelectedVariantSamples, caseItem, filterSet, selectedFilterBlockIdxList, selectedFilterBlockIdxCount,
                                    intersectFilterBlocks, variantSampleListItem, updateVariantSampleListID, fetchVariantSampleListItem, isLoadingVariantSampleListItem, searchType,
                                    isEditDisabled, haveCaseEditPermission }} width={200} />
                            </div>
                        </div>
                        : null }
                    <AboveTableControlsBaseCGAP {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions, sortBy, sortColumns }}>
                        <div className="col-12 col-lg-4 py-2">
                            <SearchBar context={searchContext} navigate={virtualNavigate} {...{ isContextLoading }}
                                placeholder={!currentFilterBlockName ? "Select a single filter-block above to search..." : "Search..."} />
                        </div>
                        <h5 className="col-12 col-lg my-0 py-1 text-400 text-truncate">
                            { typeof totalCount === "number" ?
                                <React.Fragment>
                                    <strong>{ totalCount || 0 }</strong>
                                    &nbsp;
                                    matches for { currentFilterBlockName ?
                                        <em>{ currentFilterBlockName }</em>
                                        // TODO: Allow to toggle Union vs Intersection in FilterSetController
                                        : (
                                            <React.Fragment>
                                                <span className="text-600">{intersectFilterBlocks ? "Intersection" : "Union" }</span>
                                                { ` of ${selectedFilterBlockCount} Filter Blocks` }
                                            </React.Fragment>
                                        ) }
                                </React.Fragment>
                                : null }
                        </h5>
                        <div className="col col-lg-auto pr-06 d-flex">
                            <ExportSearchSpreadsheetButton {...{ requestedCompoundFilterSet, caseItem }} />
                        </div>
                    </AboveTableControlsBaseCGAP>
                </React.Fragment>
            );
        } else {
            aboveTableControls = null;
        }

        const presetSelectionUIProps = {
            "currentCaseFilterSet": filterSet,
            caseItem, bodyOpen, session, importFromPresetFilterSet, hasCurrentFilterSetChanged, isEditDisabled,
            originalPresetFilterSet, refreshOriginalPresetFilterSet, hasFilterSetChangedFromOriginalPreset, isOriginalPresetFilterSetLoading,
            isFetchingInitialFilterSetItem, lastSavedPresetFilterSet, hasFilterSetChangedFromLastSavedPreset, setLastSavedPresetFilterSet
        };


        // console.info("Current Case FilterSet:", filterSet);

        return (
            // TODO 1: Refactor/simplify AboveTableControlsBase to not need nor use `panelMap` (needless complexity / never had use for it)
            <div className="above-variantsample-table-ui">

                <div className="filterset-outer-container" data-is-open={bodyOpen}>
                    <FilterSetUIHeader {...headerProps} toggleOpen={this.toggleOpen} />
                    <div className={"flex-column flex-md-row d-" + (bodyOpen ? "flex" : "none")}>
                        <div className="filterset-preset-selection-outer-column">
                            <PresetFilterSetSelectionUI { ...presetSelectionUIProps } {...{ searchType }}/>
                        </div>
                        <div className="flex-grow-1">
                            { fsuiBlocksBody }
                        </div>
                    </div>
                </div>

                { aboveTableControls }

            </div>
        );
    }
}


const FilterSetUIHeader = React.memo(function FilterSetUIHeader(props){
    const {
        filterSet, caseItem,
        hasCurrentFilterSetChanged, isSavingFilterSet, saveFilterSet,
        toggleOpen, bodyOpen,
        isEditDisabled: propIsEditDisabled,
        haveCaseEditPermission,
        haveDuplicateQueries, haveDuplicateNames, allFilterBlockNameQueriesValid,
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

    const onHeaderClick = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        toggleOpen();
    }, [ toggleOpen ]);


    let titleBlock = null;
    if (isFetchingInitialFilterSetItem) {
        titleBlock = (
            <h4 className="text-300 my-0 d-inline-flex align-items-center h-100 text-white px-3">
                <i className="small icon icon-fw fas mr-1 icon-circle-notch icon-spin" />
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
            <button type="button" onClick={onHeaderClick}
                className="btn btn-link btn-lg text-decoration-none h-100 w-100 text-left">
                <h4 className="my-0 text-400 text-white">
                    <i className={"small icon icon-fw fas mr-1 icon-" + (bodyOpen ? "minus" : "plus")} />
                    { fsTitle || fsDisplayTitle || <em>No Title Set</em> }
                </h4>
                {/* bodyOpen ? <i className="icon icon-pencil-alt fas ml-1 clickable text-small" onClick={onClickEditTitle} /> : null */}
            </button>
        );
    }

    const isEditDisabled = propIsEditDisabled || !bodyOpen;

    const savePresetDropdownProps = {
        filterSet, caseItem, isEditDisabled, originalPresetFilterSet,
        hasFilterSetChangedFromOriginalPreset, hasFilterSetChangedFromLastSavedPreset,
        lastSavedPresetFilterSet, isOriginalPresetFilterSetLoading, setLastSavedPresetFilterSet,
    };

    let warnIcon = null;
    if (haveDuplicateQueries || haveDuplicateNames || !allFilterBlockNameQueriesValid) {
        const err = !allFilterBlockNameQueriesValid ? "Filter block with same name but different query value has been saved to Variant Sample selection list already. Please change Filter Block name below to proceed."
            : `Filter blocks with duplicate ${(haveDuplicateNames ? "names" : "") + (haveDuplicateNames && haveDuplicateQueries ? " and " : "") + (haveDuplicateQueries ? "queries" : "")} exist below.`;
        warnIcon = <i className="icon icon-exclamation-triangle fas align-middle mr-15 text-danger" data-tip={err} />;
    }

    // todo if edit permission(?): [ Save Button etc. ] [ Sum Active(?) Filters ]
    return (
        <div className="d-flex filter-set-ui-header align-items-center bg-primary-dark text-white pr-16">
            <div className="flex-grow-1 align-self-stretch">
                { titleBlock }
            </div>
            <div className="flex-shrink-0 flex-grow-0 pl-16 overflow-hidden">
                { warnIcon }
                <div role="group" className="dropdown btn-group">
                    <SaveFilterSetButton {...{ saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged, haveCaseEditPermission }}
                        className="btn btn-sm btn-outline-light align-items-center d-flex text-truncate" />
                    <SaveFilterSetPresetButton {...savePresetDropdownProps} />
                </div>
            </div>
        </div>
    );
});


/** Renders the Blocks */
const FilterSetUIBody = React.memo(function FilterSetUIBody(props){
    const {
        filterSet, filterBlocksLen, facetDict, schemas,
        singleSelectedFilterBlockIdx, selectedFilterBlockIndices, allFilterBlocksSelected, selectedFilterBlockIdxCount,
        selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
        cachedCounts, duplicateQueryIndices, duplicateNameIndices, savedToVSLFilterBlockQueries, allFilterBlockNameQueriesValid,
        isSettingFilterBlockIdx, isFetchingInitialFilterSetItem = false,
        // Contains: addNewFilterBlock, toggleIntersectFilterBlocks, intersectFilterBlocks, saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged, haveCaseEditPermission
        ...remainingProps
    } = props;

    const { filter_blocks = [] } = filterSet || {};
    const { query: currentSingleBlockQuery = null } = (singleSelectedFilterBlockIdx !== null && filter_blocks[singleSelectedFilterBlockIdx]) || {};

    const commonProps = {
        facetDict, filterBlocksLen, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx, isSettingFilterBlockIdx,
        duplicateQueryIndices, duplicateNameIndices, savedToVSLFilterBlockQueries, cachedCounts, schemas, allFilterBlockNameQueriesValid
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

            <FilterSetUIBlockBottomUI {...remainingProps} {...{ selectFilterBlockIdx, allFilterBlocksSelected,
                filterBlocksLen, singleSelectedFilterBlockIdx, currentSingleBlockQuery }} />

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
        saveFilterSet, isSavingFilterSet,
        isEditDisabled, hasCurrentFilterSetChanged, haveCaseEditPermission,
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
                    <button type="button" className="btn btn-primary-dark d-flex align-items-center fixed-height" onClick={onSelectAllClick} disabled={allFilterBlocksSelected}>
                        <i className={"icon icon-fw far mr-1 icon-" + (allFilterBlocksSelected ? "check-square" : "square")} />
                        Select All
                    </button>
                    <button type="button" className="btn btn-primary-dark d-flex align-items-center fixed-height" onClick={onToggleIntersectFilterBlocksBtnClick} disabled={filterBlocksLen < 2 || singleSelectedFilterBlockIdx !== null}
                        data-tip="Toggle whether to compute the union or intersection of filter blocks">
                        <i className={"icon icon-fw far mr-1 icon-" + (intersectFilterBlocks ? "check-square" : "square")} />
                        Intersect
                    </button>
                </div>
            </div>
            <div className="col-auto mb-12 flex-grow-1 d-flex justify-content-between flex-wrap">
                <div className="btn-group mr-08" role="group" aria-label="Creation Controls">
                    <button type="button" className="btn btn-primary-dark d-flex align-items-center fixed-height" onClick={onAddBtnClick} data-tip="Add new blank filter block">
                        <i className="icon icon-fw icon-plus fas mr-1" />
                        Add Filter Block
                    </button>
                    <button type="button" className="btn btn-primary-dark d-flex align-items-center fixed-height" onClick={onCopyBtnClick} disabled={!currentSingleBlockQuery}
                        data-tip="Copy currently-selected filter block">
                        <i className="icon icon-fw icon-clone far" />
                    </button>
                </div>
                <SaveFilterSetButton {...{ saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged, haveCaseEditPermission }}
                    className="btn btn-primary fixed-height d-inline-flex align-items-center" />
            </div>
        </div>
    );
}
