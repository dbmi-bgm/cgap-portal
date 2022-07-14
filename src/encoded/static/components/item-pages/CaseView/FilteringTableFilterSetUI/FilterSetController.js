'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';
import memoize from 'memoize-one';

import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


/**
 * Meant to be used to wrap a FilteringTableFilterSetUI.
 * Keeps the currently active FilterSet and selection of its filter blocks
 * in state and passes that state (+methods) down to view / other components.
 * Also runs `updateSelectedFilterBlockQueryFromSearchContextResponse` in response
 * to upstream updates from EmbeddedSearchView and will update currently-selected filterblock
 * query when User selects different value from FacetList, for example, and returns new
 * filters in search response.
 */
export class FilterSetController extends React.PureComponent {

    static propTypes = {
        "initialFilterSetItem" : PropTypes.shape({
            "@id" : PropTypes.string, // Is required if originally existed, else free to be null.
            "uuid" : PropTypes.string, // Is required if originally existed, else free to be null.
            "title" : PropTypes.string.isRequired,
            "search_type" : PropTypes.oneOf(["StructuralVariantSample", "VariantSample", "Variant", "Case"]),
            "filter_blocks" : PropTypes.arrayOf(PropTypes.shape({
                "query" : PropTypes.string,
                "name" : PropTypes.string.isRequired
            }))
        }),
        "children" : PropTypes.element.isRequired,
        "excludeFacets" : PropTypes.arrayOf(PropTypes.string),
        "context" : PropTypes.shape({
            "filters" : PropTypes.arrayOf(PropTypes.shape({
                "field" : PropTypes.string.isRequired,
                "term" : PropTypes.string.isRequired
            }))
        }),
        "searchHrefBase" : PropTypes.string.isRequired,
        "navigate" : PropTypes.func,
        "initialSelectedFilterBlockIndices" : PropTypes.arrayOf(PropTypes.number),
        "isFetchingInitialFilterSetItem" : PropTypes.bool,
        "onResetSelectedVariantSamples": PropTypes.func
    };

    static defaultProps = {
        "searchHrefBase" : "/search/?type=VariantSample&sort=-date_created",
        "excludeFacets" : ["type"],
        /** `searchHrefBase` [+ `initialFilterSetItem.filter_blocks[initialSelectedFilterBlockIdx]`] must match initial search table query. */
        // "initialSelectedFilterBlockIndices" : null
        // Might be needed for future for like 'create new' button, but likely to be defined elsewhere maybe (outside of this component)
        // "blankFilterSetItem" : {
        //     "title" : "New FilterSet",
        //     "search_type": "VariantSample",
        //     "filter_blocks" : [
        //         { "query" : "" }
        //     ]
        // }
    };


    static updateSelectedFilterBlockQueryFromSearchContextResponse(selectedFilterBlockIdx, searchContext, currFilterSet, excludeFacets=["type"]){
        const { filter_blocks = [] } = currFilterSet;
        const { filters: ctxFilters = [], "@id": searchContextAtID } = searchContext;
        const currFilterBlock = filter_blocks[selectedFilterBlockIdx];
        const { query: filterStrQuery } = currFilterBlock;
        const filterBlockQuery = queryString.parse(filterStrQuery);

        const excludedFieldMap = {};
        if (Array.isArray(excludeFacets)) {
            excludeFacets.forEach(function(field){
                excludedFieldMap[field] = true;
            });
        }

        const searchFilters = ctxFilters.filter(function({ field, term }){
            let fieldName = field;
            if (field.slice(-1) === "!") fieldName = field.slice(0, -1);
            if (excludedFieldMap[fieldName]) return false;
            return true;
        });

        if (searchContextAtID) {
            const searchContextAtIDParts = url.parse(searchContextAtID, true);
            const { query: searchContextQuery } = searchContextAtIDParts;
            const { q: textSearchQuery = null } = searchContextQuery || {};
            // Treat "q" (text search param) as a context filter for purposes of FilterBlocks
            if (textSearchQuery) {
                // Generate link to remove 'q' as if were term per existing convention from FacetList
                // (not really used at time of writing, e.g. useful if 'x' btn next to each entry in filterblock)
                searchContextAtIDParts.search = "?" + queryString.stringify(_.omit(searchContextQuery, "q"));
                searchFilters.unshift({
                    "field": "q",
                    "term": textSearchQuery,
                    "remove": url.format(searchContextAtIDParts),
                    "title": "Text Search"
                });
            }
        }

        const searchFiltersLen = searchFilters.length;

        // Check if context.filters differs from filter_block.query (if so, then can cancel out early) --
        // Clean out `filterBlockQuery` by ctx filter until `filterBlockQuery` is empty object
        // preserve any remaining ctx filters into `extraCtxFilters`.
        let anyExtraCtxFilters = false;

        for (var ctxSearchFilterIndx = 0; ctxSearchFilterIndx < searchFiltersLen; ctxSearchFilterIndx++) {
            const ctxFilter = searchFilters[ctxSearchFilterIndx];
            const { field, term } = ctxFilter;
            if (!filterBlockQuery[field]) {
                anyExtraCtxFilters = true;
                break;
            }
            if (!Array.isArray(filterBlockQuery[field])) {
                if (filterBlockQuery[field] === term) {
                    delete filterBlockQuery[field];
                } else {
                    anyExtraCtxFilters = true;
                    break;
                }
            } else {
                var foundIdx = -1;
                for (var i = 0; i < filterBlockQuery[field].length; i++){
                    if (filterBlockQuery[field][i] === term){
                        foundIdx = i;
                        break;
                    }
                }
                if (foundIdx > -1) {
                    filterBlockQuery[field].splice(foundIdx, 1);
                    if (filterBlockQuery[field].length === 1) { // Convert to non-arr.
                        filterBlockQuery[field] = filterBlockQuery[field][0];
                    }
                } else {
                    anyExtraCtxFilters = true;
                    break;
                }
            }
        }

        if (!anyExtraCtxFilters && Object.keys(filterBlockQuery).length === 0) {
            // No changes to query, returing existing filterset.
            return currFilterSet;
        }

        // Generate new URL param query object out of ~ context.filters
        const searchFiltersQuery = {}; // = new URLSearchParams() - might be nice to use this but not 100% of browser/node/url-in-package-lock.json issues.
        searchFilters.forEach(function({ field, term }){
            if (Array.isArray(searchFiltersQuery[field])) {
                searchFiltersQuery[field].push(term);
            } else if (typeof searchFiltersQuery[field] !== "undefined") {
                searchFiltersQuery[field] = [ searchFiltersQuery[field], term ];
            } else {
                searchFiltersQuery[field] = term;
            }
        });
        const nextCurrFilterSet = { ...currFilterSet, "filter_blocks": filter_blocks.slice() };
        nextCurrFilterSet.filter_blocks[selectedFilterBlockIdx] = {
            ...nextCurrFilterSet.filter_blocks[selectedFilterBlockIdx],
            "query": queryString.stringify(searchFiltersQuery).replaceAll("%20", "+")
        };

        return nextCurrFilterSet;
    }

    /**
     * Generates POST body for /compound_search endpoint, given
     * some props and state available from `FilterSetController`.
     *
     * @param {Object.<string,boolean>} selectedFilterBlockIndices - From FiltersetController state.
     * @param {{ filter_blocks: Object[], search_type: string }} currFilterSet - From FiltersetController state.
     * @param {string} searchHrefBase - Root href, as passed in via props.
     * @returns {{ search_type: string, global_flags: string, intersect: boolean, flags: {}[]?, filter_blocks: { query: string, flags_applied: string[]? }[] }} Compound search request payload
     */
    static createCompoundSearchRequest(selectedFilterBlockIndices, currFilterSet, searchHrefBase, intersectFilterBlocks = false){
        const selectedIdxList = Object.keys(selectedFilterBlockIndices);
        const selectedIdxCount = selectedIdxList.length;

        if (!currFilterSet) {
            console.error("No current filterset to navigate to. Fine if expected (i.e. initial filterset item still being fetched).");
            return null;
        }

        const { filter_blocks, search_type: filterSetSearchType = "VariantSample" } = currFilterSet;

        const { query: globalFlagsQuery = {} } = url.parse(searchHrefBase, true);

        const searchType = globalFlagsQuery.type || filterSetSearchType;

        // Not particularly necessary, but helps make less redundant since we have the required `search_type` already.
        delete globalFlagsQuery.type;

        // Set "name" of each filter block to be its index.
        const filterBlockQueries = filter_blocks.map(function(fb, fbIdx){
            const { query } = fb;
            return {
                query,
                "name": fbIdx, // Will be using filter block indices as unique names here, rather than the real names.
                "flags_applied": [] // Needed? Currently unused.
            };
        });

        // Then filter out filter blocks which aren't applied in this request.
        const selectedFilterBlockQueries = selectedIdxCount === 0 ? filterBlockQueries : filterBlockQueries.filter(function(fb, fbIdx){
            return selectedFilterBlockIndices[fbIdx];
        });

        return {
            "search_type": searchType,
            "global_flags": queryString.stringify(globalFlagsQuery).replaceAll("%20", "+"),
            "intersect": intersectFilterBlocks,
            // We create our own names for flags & flags_applied here rather
            // than using filterSet.flags since filterSet.flags might potentially
            // be populated from other places; idk...
            // "flags": [
            //     {
            //         "name": "CurrentFilterSet",
            //         "query": global_flags
            //     }
            // ],
            "filter_blocks": selectedFilterBlockQueries
        };
    }

    /**
     * Update state.currFilterSet.filter_blocks[selectedFilterBlockIdx].query from search response if needed.
     * (unless amid some other update or amid initialization)
     *
     * @todo Maybe move to componentDidUpdate or something...
     */
    static getDerivedStateFromProps(props, state) {
        const { context: searchContext, excludeFacets } = props;
        const {
            currFilterSet,
            selectedFilterBlockIndices: currSelectedFilterBlockIndices,
            isSettingFilterBlockIdx,
            cachedCounts: lastCachedCounts
        } = state;

        let selectedFilterBlockIndices = null; // { ...currSelectedFilterBlockIndices };

        // Always have filter block selected if is the only one - helps reduce needless UI interaction(s)
        // and glitches
        const { filter_blocks = [] } = currFilterSet || {};
        const filterBlocksLen = filter_blocks.length;
        if (filterBlocksLen === 1) {
            selectedFilterBlockIndices = { '0': true };
        } else if (filterBlocksLen === 0) { // Rare/if-at-all-occuring
            // Clear
            selectedFilterBlockIndices = {};
        } else {
            // Do nothing (yet), preserve `selectedFilterBlockIndices`
            selectedFilterBlockIndices = currSelectedFilterBlockIndices;
        }

        let selectedFilterBlockIdxList = Object.keys(selectedFilterBlockIndices);
        let selectedFilterBlockIdxCount = Object.keys(selectedFilterBlockIdxList).length;

        // If no filter-blocks are currently selected, then select all, as is equivalent
        // state and simpler to handle only 1 case/'shape' of it.
        // Also handles req of always have 1 filter block selected if is the only one that exists
        // -- helps reduce needless UI interaction(s) and glitches
        // if (selectedFilterBlockIdxCount === 0 && filterBlocksLen > 0) {
        //     filter_blocks.forEach(function(fb, idx){
        //         selectedFilterBlockIndices[idx] = true;
        //         selectedFilterBlockIdxList.push(idx);
        //         selectedFilterBlockIdxCount++;
        //     });
        // }

        // If only 1 FB, keep selectedFilterBlockIndices populated to simplify grabbing the singly-selected filter-block.
        if (selectedFilterBlockIdxCount > 1 && selectedFilterBlockIdxCount === filterBlocksLen) {
            selectedFilterBlockIndices = {};
            selectedFilterBlockIdxCount = 0;
            selectedFilterBlockIdxList = [];
        }


        // Update state.currFilterSet with filters from response, unless amid some other update.

        if (!searchContext || isSettingFilterBlockIdx){
            // Don't update from blank. Or if still loading response for current selection.
            return { selectedFilterBlockIndices };
        }

        if (selectedFilterBlockIdxCount !== 1){
            // Cancel if compound filterset request.
            return { selectedFilterBlockIndices };
        }

        const selectedFilterBlockIdx = parseInt(selectedFilterBlockIdxList[0]);
        const { total: totalCount } = searchContext;

        // Get counts to show @ top left of selectable filter blocks
        let nextCachedCounts = lastCachedCounts;
        if (nextCachedCounts[selectedFilterBlockIdx] !== totalCount) { // Don't update object reference unless is changed/first-set
            nextCachedCounts = { ...nextCachedCounts, [selectedFilterBlockIdx]: totalCount };
        }

        // Returns existing `currFilterSet` if no changes in query detected to avoid downstream memoized component re-renders.
        const nextCurrFilterSet = FilterSetController.updateSelectedFilterBlockQueryFromSearchContextResponse(
            selectedFilterBlockIdx,
            searchContext,
            currFilterSet,
            excludeFacets
        );

        return {
            selectedFilterBlockIndices,
            "currFilterSet": nextCurrFilterSet,
            "cachedCounts": nextCachedCounts,
            "originalPresetFilterSetBody": null
        };
    }

    static resetState(props){
        const { initialFilterSetItem, initialSelectedFilterBlockIndices = [] } = props;

        // By default, all filter blocks are selected.
        // TODO: Consider saving selectedFilterBlockIndices into FilterSet property/field,
        // or, more likely, into localStorage.
        const selectedFilterBlockIndices = {};
        initialSelectedFilterBlockIndices.forEach(function(selectedIndx){
            // `selectedIndx` is cast to str when becomes key in `selectedFilterBlockIndices`.
            selectedFilterBlockIndices[selectedIndx] = true;
        });
        return {
            "currFilterSet": initialFilterSetItem ? { ...initialFilterSetItem } : null,
            selectedFilterBlockIndices,
            "isSettingFilterBlockIdx": true,
            "intersectFilterBlocks": false,
            "cachedCounts": {} // Using indices as keys here, but keeping as object (keys are strings)
        };
    }

    constructor(props) {
        super(props);
        this.navigateToCurrentBlock = this.navigateToCurrentBlock.bind(this);
        this.importFromPresetFilterSet = _.throttle(this.importFromPresetFilterSet.bind(this), 500);
        // Throttled since usually don't want to add that many so fast..
        this.addNewFilterBlock = _.throttle(this.addNewFilterBlock.bind(this), 750, { trailing: false });
        // Throttled, but func itself throttles/prevents-update if still loading last-selected search results.
        this.selectFilterBlockIdx = _.throttle(this.selectFilterBlockIdx.bind(this), 100, { trailing: false });
        // Throttled to prevent accidental double-clicks.
        this.removeFilterBlockAtIdx =  _.throttle(this.removeFilterBlockAtIdx.bind(this), 250, { trailing: false });
        this.setNameOfFilterBlockAtIdx = this.setNameOfFilterBlockAtIdx.bind(this);
        this.setTitleOfFilterSet = this.setTitleOfFilterSet.bind(this);
        this.toggleIntersectFilterBlocks = _.throttle(this.toggleIntersectFilterBlocks.bind(this), 250, { trailing: false });

        this.state = FilterSetController.resetState(this.props);
    }

    componentDidMount(){
        this.navigateToCurrentBlock();
    }

    componentDidUpdate(pastProps, pastState){
        const { initialFilterSetItem, context: searchContext, onResetSelectedVariantSamples, resetLastSavedTechnicalReview } = this.props;
        const { initialFilterSetItem: pastInitialFilterSet, context: pastSearchContext } = pastProps;

        // Just some debugging for dev environments.
        // if (console.isDebugging()){
        //     var key;
        //     for (key in this.props) {
        //         // eslint-disable-next-line react/destructuring-assignment
        //         if (this.props[key] !== pastProps[key]) {
        //             // eslint-disable-next-line react/destructuring-assignment
        //             console.log('FilterSetController changed props: %s', key, pastProps[key], this.props[key]);
        //         }
        //     }

        //     for (key in this.state) {
        //         // eslint-disable-next-line react/destructuring-assignment
        //         if (this.state[key] !== pastState[key]) {
        //             // eslint-disable-next-line react/destructuring-assignment
        //             console.log('FilterSetController changed state: %s', key, pastState[key], this.state[key]);
        //         }
        //     }
        // }

        if (searchContext !== pastSearchContext) {
            console.info("FilterSetController: Received new search context / response.");
            if (onResetSelectedVariantSamples) {
                console.info("Resetting selected Variant Sample items.");
                onResetSelectedVariantSamples();
            }
            // if (resetLastSavedTechnicalReview && searchContext !== pastSearchContext) {
            //     console.info("Resetting last saved technical review cache");
            //     resetLastSavedTechnicalReview();
            // }
        }

        // If a new FilterSet gets fetched in; should only occur for initial FS being loaded in (where pastInitialFilterSet is null).
        if (initialFilterSetItem !== pastInitialFilterSet) {
            this.setState(FilterSetController.resetState(this.props), this.navigateToCurrentBlock);
            return;
        }

    }

    /** Throttled to prevent tons of AJAX request from being queued up. */
    importFromPresetFilterSet(presetFilterSet){
        const { currFilterSet } = this.state;

        if (!currFilterSet) {
            throw new Error("Expected existing current FilterSet to be present; shouldn't be importable til then");
        }

        const { uuid: presetFSUUID, filter_blocks: presetFSBlocks } = presetFilterSet;

        const newFilterSet = {
            // Preserve existing FS title, UUID, search_type, flags, created_in_case_accession, etc. instead of copying from preset.
            ...currFilterSet,
            "derived_from_preset_filterset": presetFSUUID,
            "filter_blocks": presetFSBlocks // Assume we always have some present, as upstream UI should prevent saving of Presets with no blocks.
        };

        // `resetState` will reset selected indices, as well. And set isSettingFilterBlockIdx: true.
        const nextState = FilterSetController.resetState({ "initialFilterSetItem": newFilterSet });

        // Minor performance tweak -- pass in props.originalPresetFilterSetBody to
        // SaveFilterSetPresetButtonController for it to use instead of loading
        // it again via AJAX.
        nextState.originalPresetFilterSetBody = presetFilterSet;

        this.setState(nextState,
            this.navigateToCurrentBlock
        );
    }

    addNewFilterBlock(newFilterBlock = null){
        this.setState(function({ currFilterSet: pastFS }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            let { name, query } = newFilterBlock || {};
            if (!name) {
                // Generate new name
                const highestAutoCount = nextFB.reduce(function(m, { name = "" }){
                    const match = name.match(/^(Filter Block )(\d+)/);
                    if (!match || !match[2]) return m;
                    return Math.max(m, parseInt(match[2]));
                }, 0);
                name = "Filter Block " + (highestAutoCount + 1);
            }
            if (!query) {
                query = "";
            }
            nextFB.push({ name, query });
            return {
                "currFilterSet": {
                    ...pastFS,
                    "filter_blocks" : nextFB
                },
                // Unselect all except newly-created one.
                "selectedFilterBlockIndices": { [nextFB.length - 1]: true },
                "isSettingFilterBlockIdx" : true
            };
        }, this.navigateToCurrentBlock);
    }

    removeFilterBlockAtIdx(idx){
        let didSelectedIndicesChange = false;
        this.setState(function(pastState){
            const {
                currFilterSet: pastFS,
                selectedFilterBlockIndices: pastSelectedIndices,
                cachedCounts: pastCounts
            } = pastState;
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            nextFB.splice(idx, 1);
            const nextFBLen = nextFB.length;

            // Shift cachedCounts indices/keys
            const cachedCounts = {};
            Object.keys(pastCounts).forEach(function(countKey){
                const intKey = parseInt(countKey); // Obj keys are cast to type:string upon insertion, need to cast back to int for comparisons.
                if (intKey < idx) {
                    cachedCounts[countKey] = pastCounts[countKey];
                } else if (intKey > idx) {
                    cachedCounts[intKey - 1] = pastCounts[countKey];
                }
            });

            // Update selected filter block index according to what feels like decent UX -
            const selectedFilterBlockIndices = {};
            if (nextFBLen === 0) {
                // Error, shouldn't occur
                throw new Error("Must have at least one filter block, will not delete last one.");
            } else if (nextFBLen === 1) {
                // Set to the only fb, since otherwise would have no difference if is compound request, just lack of faceting (= extra UI click to get it back).
                // (this is now redundant -- done also in getDerivedStateFromProps)
                selectedFilterBlockIndices['0'] = true;
            } else {
                Object.keys(pastSelectedIndices).forEach(function(pastSelectedIndex){
                    if (pastSelectedIndex < idx) {
                        // Keep
                        selectedFilterBlockIndices[pastSelectedIndex] = true;
                    } else if (pastSelectedIndex === idx) {
                        // Skip - we deleted a previously-selected block, unset selection.
                    } else if (pastSelectedIndex > idx) {
                        // Shift index closer to start to keep previously-selected block selected.
                        selectedFilterBlockIndices[pastSelectedIndex - 1] = true;
                    }
                });

            }

            didSelectedIndicesChange = !_.isEqual(pastSelectedIndices, selectedFilterBlockIndices);

            return {
                cachedCounts,
                selectedFilterBlockIndices,
                "currFilterSet": { ...pastFS, "filter_blocks" : nextFB },
                "isSettingFilterBlockIdx": didSelectedIndicesChange
            };

        }, () => {
            if (didSelectedIndicesChange) {
                this.navigateToCurrentBlock();
            }
        });
    }

    setNameOfFilterBlockAtIdx(idx, newName, cb){
        this.setState(function({ currFilterSet: pastFS }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            const nextBlock = { ...nextFB[idx] };
            nextBlock.name = newName;
            nextFB[idx] = nextBlock;
            return {
                "currFilterSet": { ...pastFS, "filter_blocks" : nextFB }
            };
        }, cb);
    }

    setTitleOfFilterSet(newTitle) {
        this.setState(function({ currFilterSet }){
            const nextFilterSet = { ...currFilterSet };
            nextFilterSet.title = newTitle;
            return { "currFilterSet": nextFilterSet };
        });
    }

    toggleIntersectFilterBlocks(){
        this.setState(function({ intersectFilterBlocks }){
            return {
                "intersectFilterBlocks": !intersectFilterBlocks
            };
        }, this.navigateToCurrentBlock);
    }

    navigateToCurrentBlock(){
        const { navigate: virtualNavigate, searchHrefBase } = this.props; // props.navigate passed down in from SPC EmbeddedSearchView VirtualHrefController
        const { selectedFilterBlockIndices, currFilterSet, intersectFilterBlocks } = this.state;

        if (!currFilterSet) {
            console.error("No current filterset to navigate to. Fine if expected (i.e. initial filterset item still being fetched).");
            return null;
        }

        const virtualCompoundFilterSet = FilterSetController.createCompoundSearchRequest(selectedFilterBlockIndices, currFilterSet, searchHrefBase, intersectFilterBlocks);
        console.log("Navigating to virtualCompoundFilterSet", virtualCompoundFilterSet, this.props, this.state);

        virtualNavigate(virtualCompoundFilterSet, null, (res)=>{
            this.setState({ "isSettingFilterBlockIdx": false });
        });
    }

    selectFilterBlockIdx(index = null, deselectOthers = true){
        const { currFilterSet: { filter_blocks = [] } = {} } = this.state;
        if (filter_blocks.length < 2) {
            // Nothing to change/select.
            return false;
        }
        // const { isSettingFilterBlockIdx } = this.state;
        // if (isSettingFilterBlockIdx) {
        //     // Another update in progress already.
        //     return false;
        // }
        this.setState(function({ selectedFilterBlockIndices: pastSelectedIndices }){
            let selectedFilterBlockIndices;

            if (index === null) {
                // Used to select all for now.
                selectedFilterBlockIndices = {};
            } else if (pastSelectedIndices[index]) {
                // Clear it.
                selectedFilterBlockIndices = _.omit(pastSelectedIndices, index);
            } else {
                // Select it
                selectedFilterBlockIndices =  deselectOthers ? { [index]: true } : { ...pastSelectedIndices, [index]: true };
            }
            return {
                selectedFilterBlockIndices,
                "isSettingFilterBlockIdx": true
            };
        }, this.navigateToCurrentBlock);
    }

    render(){
        // eslint-disable-next-line no-unused-vars
        const { children, initialFilterSetItem, ...passProps } = this.props;
        const { currFilterSet, selectedFilterBlockIndices, cachedCounts, isSettingFilterBlockIdx, intersectFilterBlocks, originalPresetFilterSetBody } = this.state;
        const childProps = {
            ...passProps,
            currFilterSet,
            isSettingFilterBlockIdx,
            selectedFilterBlockIndices,
            cachedCounts,
            intersectFilterBlocks,
            "addNewFilterBlock": this.addNewFilterBlock,
            "removeFilterBlockAtIdx": this.removeFilterBlockAtIdx,
            "selectFilterBlockIdx": this.selectFilterBlockIdx,
            "setNameOfFilterBlockAtIdx": this.setNameOfFilterBlockAtIdx,
            "setTitleOfFilterSet": this.setTitleOfFilterSet,
            "toggleIntersectFilterBlocks": this.toggleIntersectFilterBlocks,
            "importFromPresetFilterSet": this.importFromPresetFilterSet,
            originalPresetFilterSetBody
        };

        return React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) { // String or something
                return child;
            }
            if (typeof child.type === "string") { // Normal element (a, div, etc)
                return child;
            }
            return React.cloneElement(child, childProps);
        });
    }

}
