'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';
import Infinite from 'react-infinite';

import Collapse from "react-bootstrap/esm/Collapse";
import DropdownButton from "react-bootstrap/esm/DropdownButton";
import DropdownItem from "react-bootstrap/esm/DropdownItem";
import Modal from 'react-bootstrap/esm/Modal';

import { console, ajax, JWT, valueTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime, format as formatDateTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { getSchemaProperty } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';
import { FormattedToFromRangeValue } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/FacetList/RangeFacet';
import { CountIndicator } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/FacetList/FacetTermsList';

import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';

import { Schemas } from '../../util';


/**
 * @todo Convert this file into directory, since has grown to large-ish size.
 * @todo Maybe will be renamed if reusable
 * @todo
 * Maybe check if new caseItem.active_filterset then update state.lastSavedFilterSet via getDerivedStateFromProps or componentDidUpdate or something
 * Not relevant for long time until/unless maybe entire Case gets refreshed re: websockets or something...
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

    /**
     * IMPORTANT:
     * We remove any calculated or linkTo things from PATCH/POST payload.
     * linkTos must be transformed to UUIDs before POST as well.
     * Hardcoded here since UI is pretty specific to it.
     */
    static fieldsToKeepPrePatch = ["title", "filter_blocks", "search_type", "flags", "created_in_case_accession", "uuid", "status", "derived_from_preset_filterset"];

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

            // From FilteringTab (& higher, e.g. App/redux-store):
            caseItem, schemas, session,

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
            fsuiBlocksBody = <FilterSetUIBlocks {...bodyProps} />;
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
                                    <PresetFilterSetSelectionUI {...presetSelectionUIProps} />
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
                    <h4 className="text-400 col my-0">
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
                    { selectedVariantSamples instanceof Map ?
                        <div className="col-auto pr-06">
                            <AddToVariantSampleListButton {...{ selectedVariantSamples, onResetSelectedVariantSamples, caseItem, filterSet, selectedFilterBlockIndices,
                                variantSampleListItem, updateVariantSampleListID, fetchVariantSampleListItem, isLoadingVariantSampleListItem }} />
                        </div>
                        : null }
                </AboveTableControlsBase>
            </div>
        );
    }
}

/**
 * @todo Pass in props.importFromPresetFilterSet from FilterSetController (and create it)
 * @todo Consider using react-virtualized or react-window library for this later.
 * @todo (CSS) Match width of FacetList
 */
class PresetFilterSetSelectionUI extends React.PureComponent {

    /** Builds a compound search request for all FilterSets with relevant `preset_for_users`, `preset_for_projects`,  & `default_for_projects`  */
    static makeCompoundSearchRequest(caseItem){
        const { project: { uuid: projectUUID } } = caseItem || {};
        const { uuid: userUUID = null } = JWT.getUserDetails() || {};

        const compoundFS = {
            "search_type": "FilterSet",
            "filter_blocks": [],
            "intersect": false,
            "global_flags": "sort=default_for_projects&sort=-date_created&limit=250"
        };

        if (userUUID) {
            compoundFS.filter_blocks.push({ "query": "preset_for_users=" + encodeURIComponent(userUUID), "flags_applied": [] });
        }

        if (projectUUID) {
            compoundFS.filter_blocks.push({ "query": "preset_for_projects=" + encodeURIComponent(projectUUID), "flags_applied": [] });
            compoundFS.filter_blocks.push({ "query": "default_for_projects=" + encodeURIComponent(projectUUID), "flags_applied": [] });
        }

        return compoundFS;
    }

    constructor(props){
        super(props);
        this.setPatchingPresetResultUUID = this.setPatchingPresetResultUUID.bind(this);
        this.toggleDeletedPresetUUID = this.toggleDeletedPresetUUID.bind(this);
        this.loadInitialResults = _.debounce(this.loadInitialResults.bind(this), 3000);
        this.checkForChangedResultsAndRefresh = this.checkForChangedResultsAndRefresh.bind(this);
        this.state = {
            // Can be blank array (no results found), null (not yet loaded), or array of results.
            "presetResults": null,
            "isLoadingPresets": true,
            // Will contain { requestNumber: true }
            "checkingForNewFilterSetRequests": {},
            // Kept here rather than in PresetFilterSetResult state, to prevent actions on other presets while another is ongoing.
            // Could be removed in future potentially (or moved down) to allow simultaneous edits to multiple FSes.
            "patchingPresetResultUUID": null,
            // Will contain message/tooltip for e.g. if presets list hasn't refreshed within alloted request limit.
            "errorMessage": null,
            // Keep track of deleted-but-not-yet-removed-from-results presets to display them as "muted" temporarily in UI.
            "deletedPresetUUIDs": {}
        };
        this.checkingForNewFilterSetRequestsCounter = 0; // Used to generate unique IDs in `checkForChangedResultsAndRefresh`.

        this.currentInitialResultsRequest = null;
    }

    componentDidMount(){
        this.loadInitialResults();
    }

    // TODO: componentDidUpdate({ pastSession }) { if changed, then reset results & reload (?) }

    componentDidUpdate({ lastSavedPresetFilterSet: pastLastSavedPresetFilterSet }, { isLoadingPresets: lastIsLoadingPresets }){
        const { lastSavedPresetFilterSet } = this.props;
        const { isLoadingPresets } = this.state;

        // Rebuild tooltips after new results loaded.
        if (!isLoadingPresets && lastIsLoadingPresets) {
            ReactTooltip.rebuild();
        }

        // TODO: Wait for indexing to complete, maybe eventually via subscribing to pubsub messages
        // from backend or something. For now, doing this thingy:
        if (pastLastSavedPresetFilterSet !== lastSavedPresetFilterSet) {
            const { uuid: lastSavedPresetUUID } = lastSavedPresetFilterSet;
            this.checkForChangedResultsAndRefresh(`/search/?type=FilterSet&uuid=${lastSavedPresetUUID}&limit=0`);
        }
    }

    setPatchingPresetResultUUID(patchingPresetResultUUID) {
        this.setState({ patchingPresetResultUUID });
    }

    toggleDeletedPresetUUID(presetUUID){
        this.setState(function({ deletedPresetUUIDs: existingIDs }){
            const deletedPresetUUIDs = { ...existingIDs };
            if (deletedPresetUUIDs[presetUUID]) {
                delete deletedPresetUUIDs[presetUUID];
            } else {
                deletedPresetUUIDs[presetUUID] = true;
            }
            return { deletedPresetUUIDs };
        });
    }

    loadInitialResults(){
        const { caseItem } = this.props;

        if (this.currentInitialResultsRequest) {
            console.log('currentInitialResultsRequest superseded (a)');
        }

        const compoundRequest = PresetFilterSetSelectionUI.makeCompoundSearchRequest(caseItem);
        const scopedRequest = this.currentInitialResultsRequest = ajax.promise("/compound_search", "POST", {}, JSON.stringify(compoundRequest)).then((res) => {
            const {
                "@graph": presetResults,
                total: totalResultCount
            } = res;

            if (scopedRequest !== this.currentInitialResultsRequest) {
                // Request has been superseded; throw out response and preserve current state.
                console.log('currentInitialResultsRequest superseded (b)');
                return false;
            }

            this.currentInitialResultsRequest = null;

            this.setState({
                presetResults,
                totalResultCount,
                "isLoadingPresets": false
            });
        });
    }

    /**
     * @todo Change to depend on Redis PubSub server-sent events down the road, rather than polling.
     */
    checkForChangedResultsAndRefresh(
        requestHref,
        conditionCheckFunc = function({ total: totalCountForThisSearch }){ return totalCountForThisSearch > 0; },
        delay = 5000
    ){

        // Arbitrary limit to terminate after, after this we can assume we might've been logged out or something.
        // Not overly consistent/stable, since if there's indexing pile-up it might be an hour until this gets re-indexed..
        const requestLimit = 40;
        let requestCount = 0;
        const uniqueRequestID = this.checkingForNewFilterSetRequestsCounter++;

        const periodicRequestFunc = () => {

            const { checkingForNewFilterSetCount } = this.state;
            if (checkingForNewFilterSetCount === 0) {
                return;
            }

            requestCount++;

            ajax.promise(requestHref).then((res) => {
                if (conditionCheckFunc(res)) {
                    // Edited/added preset has been indexed. Stop checking & re-request our state.presetResults.
                    this.setState(
                        function({ checkingForNewFilterSetRequests: oldRequestsObj }){
                            const checkingForNewFilterSetRequests = { ...oldRequestsObj };
                            delete checkingForNewFilterSetRequests[uniqueRequestID];
                            return {
                                "isLoadingPresets": true,
                                checkingForNewFilterSetRequests
                            };
                        },
                        this.loadInitialResults
                    );
                } else if (requestCount < requestLimit) {
                    // Wait & retry.
                    setTimeout(periodicRequestFunc, delay);
                } else {
                    this.setState(function({ checkingForNewFilterSetRequests: oldRequestsObj }){
                        const checkingForNewFilterSetRequests = { ...oldRequestsObj };
                        delete checkingForNewFilterSetRequests[uniqueRequestID];
                        return {
                            "errorMessage": "Timed out waiting/checking for updated preset results. Please come back later to see your changes.",
                            checkingForNewFilterSetRequests
                        };
                    });
                    console.error("checkForChangedResultsAndRefresh exceeded request limit", requestCount);
                }
            });
        };

        this.setState(
            function({ checkingForNewFilterSetRequests }){
                return { "checkingForNewFilterSetRequests": { ...checkingForNewFilterSetRequests, [uniqueRequestID]: true } };
            },
            ()=>{
                setTimeout(periodicRequestFunc, delay);
            }
        );
    }

    render(){
        const {
            importFromPresetFilterSet,
            caseItem,
            isEditDisabled,
            hasCurrentFilterSetChanged,
            isFetchingInitialFilterSetItem,
            currentCaseFilterSet,
            hasFilterSetChangedFromOriginalPreset,
            isOriginalPresetFilterSetLoading,
            refreshOriginalPresetFilterSet
        } = this.props;
        const {
            isLoadingPresets,
            presetResults,
            totalResultCount,
            patchingPresetResultUUID,
            checkingForNewFilterSetRequests,
            errorMessage = null,
            deletedPresetUUIDs
        } = this.state;

        let body = null;
        if (!presetResults || presetResults.length === 0){
            if (isLoadingPresets) {
                // Only show loading indicator in body for lack of initial results.
                body = (
                    <div className="text-center text-large py-4 text-muted">
                        <i className="icon icon-spin icon-2x icon-circle-notch fas"/>
                    </div>
                );
            } else {
                body = (
                    <div className="py-4 px-3 bg-white border-bottom">
                        <h4 className="my-0 text-400">
                            No presets saved yet
                        </h4>
                        <p>
                            Create a FilterSet and then click <em>Save As...</em> to create a preset.
                        </p>
                    </div>
                );
            }
        } else if (presetResults) {

            // TODO wrap results in infinite scroll of some sort later on,
            // once figure out strategy for replacing or removing the
            // deprecated react-infinite library.

            const commonProps = {
                caseItem, importFromPresetFilterSet, patchingPresetResultUUID,
                isEditDisabled, hasCurrentFilterSetChanged,
                hasFilterSetChangedFromOriginalPreset, isOriginalPresetFilterSetLoading, refreshOriginalPresetFilterSet,
                "setPatchingPresetResultUUID": this.setPatchingPresetResultUUID,
                "toggleDeletedPresetUUID": this.toggleDeletedPresetUUID,
                "checkForChangedResultsAndRefresh": this.checkForChangedResultsAndRefresh
            };
            const { derived_from_preset_filterset: currentCaseDerivedFromPresetUUID = null } = currentCaseFilterSet || {};
            body = (
                <div className="results-container border-top">
                    { presetResults.map(function(presetFilterSet, idx){
                        const { uuid: thisPresetFSUUID } = presetFilterSet;
                        const isOriginOfCurrentCaseFilterSet = currentCaseDerivedFromPresetUUID === thisPresetFSUUID;
                        const isDeleted = deletedPresetUUIDs[thisPresetFSUUID];
                        return <PresetFilterSetResult {...commonProps} {...{ presetFilterSet, isOriginOfCurrentCaseFilterSet, isDeleted }} key={thisPresetFSUUID}  />;
                    }) }
                </div>
            );
        }

        const isCheckingForNewFilterSet = Object.keys(checkingForNewFilterSetRequests).length > 0;


        let nextToTitleIcon = null;
        if (errorMessage) {
            nextToTitleIcon = (
                <i className="icon icon-exclamation-triangle fas ml-05 text-small" data-tip={errorMessage} data-html />

            );
        } else if (isCheckingForNewFilterSet || isLoadingPresets) {
            nextToTitleIcon = (
                <i className="icon icon-circle-notch icon-spin fas ml-07 text-small text-muted" data-tip="Preset(s) below have been updated but this is not yet reflected." data-html />
            );
        }

        return (
            <div className="filterset-preset-selection-body h-100">
                <div className="results-heading my-0 py-2 px-2 bg-light">
                    <div className="row align-items-center">
                        <h5 className="col text-400 my-0">
                            <i className="icon icon-copy far mr-08"/>
                            <a href="/search/?type=FilterSet" className="text-body" target="_blank" data-delay-show={1000} data-tip="View all saved FilterSets">Presets</a>
                            { nextToTitleIcon }
                        </h5>
                        { !isCheckingForNewFilterSet && !isLoadingPresets ?
                            <div className="col-auto text-small">
                                { totalResultCount } total
                                { (totalResultCount || 0) >= 250 ?
                                    <i className="icon icon-exclamation-triangle fas ml-1" data-tip="Showing most recent 250 results only.<br/><small>(Eventually we'll show more)</small>" data-html />
                                    : null }
                            </div>
                            : null }
                    </div>
                </div>
                { body }
            </div>
        );
    }
}



const PresetFilterSetResult = React.memo(function PresetFilterSetResult (props) {
    const {
        presetFilterSet,
        caseItem,
        importFromPresetFilterSet,
        isEditDisabled,
        hasCurrentFilterSetChanged,
        hasFilterSetChangedFromOriginalPreset,
        isOriginalPresetFilterSetLoading,
        refreshOriginalPresetFilterSet,
        isOriginOfCurrentCaseFilterSet,
        patchingPresetResultUUID, setPatchingPresetResultUUID,
        checkForChangedResultsAndRefresh,
        isDeleted, toggleDeletedPresetUUID
    } = props;
    const {
        "@id": presetFSID,
        uuid: presetFSUUID,
        "display_title": presetFSTitle,
        "submitted_by": presetFSAuthor,
        date_created,
        filter_blocks = [],
        actions = []
    } = presetFilterSet;

    const { display_title: presetFSAuthorTitle } = presetFSAuthor;
    const presetFBLen = filter_blocks.length;
    const isCurrentCaseFilterSetUnchanged = isOriginOfCurrentCaseFilterSet && (isOriginalPresetFilterSetLoading || !hasFilterSetChangedFromOriginalPreset);


    // We need to AJAX in the ItemView for this FS to determine if have permission to edit or not.
    const [ loadedItemView, setLoadedItemView ] = useState(null);
    const [ isLoadingItemView, setIsLoadingItemView ] = useState(false);

    const isPatchingPreset = patchingPresetResultUUID === presetFSUUID;

    // Separate from import (view) permission (which is implictly allowed for all presets here, else wouldnt have been returned from /search/?type=FilterSet request)
    const haveEditPermission = !!(loadedItemView && _.findWhere(loadedItemView.actions || [], { "name": "edit" }));


    // If in uneditable state (no save permissions, duplicate blocks, etc) then don't warn.
    // Don't warn if unchanged from saved Case FS or if from a preset but hasn't changed from preset.
    const warnBeforeImport = (!isEditDisabled && hasCurrentFilterSetChanged && !isOriginalPresetFilterSetLoading && hasFilterSetChangedFromOriginalPreset);

    const importBtnDisabled = isCurrentCaseFilterSetUnchanged || isDeleted; // || isOriginalPresetFilterSetLoading;




    const { userProjectUUID, isPresetForUser, isPresetForProject, isDefaultForProject } = useMemo(function(){
        //const { project: { uuid: projectUUID } } = caseItem || {};
        const {
            preset_for_users = [],
            preset_for_projects = [],
            default_for_projects = []
        } = presetFilterSet;
        // We keep this within useMemo b.c. we assume is invisible if logged out.
        // TODO: reconsider, or use props.session.
        const {
            uuid: userUUID = null,
            project: userProjectUUID
        } = JWT.getUserDetails() || {}; // ( internally calls JSON.parse(localStorage..) ) -- good to memoize
        return {
            userProjectUUID,
            "isPresetForUser": userUUID && preset_for_users.indexOf(userUUID) > -1,
            "isPresetForProject": userProjectUUID && preset_for_projects.indexOf(userProjectUUID) > -1,
            "isDefaultForProject":  userProjectUUID && default_for_projects.indexOf(userProjectUUID) > -1
        };
    }, [ presetFilterSet, caseItem ]);



    const onSelectPresetFilterSet = useCallback(function(e){
        e.preventDefault();
        e.stopPropagation();

        if (warnBeforeImport) {
            const confResult = window.confirm("You have unsaved changes in your Case FilterSet; copying over blocks from this preset will destroy and overwrite them, continue?");
            if (!confResult) {
                return false;
            }
        }

        importFromPresetFilterSet(presetFilterSet);

    }, [ presetFilterSet, importFromPresetFilterSet, warnBeforeImport ]);


    const onMenuClick = useCallback(function(e){
        // Should run only once to load in loadedItemView.
        if (isLoadingItemView) return false;
        if (loadedItemView !== null) return false;
        setIsLoadingItemView(true);
        ajax.promise(presetFSID).then((res)=>{
            setLoadedItemView(res);
        }).finally(()=>{
            setIsLoadingItemView(false);
        });
    }, [ presetFilterSet, loadedItemView, isLoadingItemView ]);


    const menuOptions = [];

    if (isLoadingItemView) {
        menuOptions.push(
            <div className="px-2 py-3 text-larger text-secondary text-center" key="loading">
                <i className="icon icon-circle-notch icon-spin fas"/>
            </div>
        );
    } else {
        menuOptions.push(
            <a key="view" href={presetFSID} target="_blank" rel="noopener noreferrer" className="dropdown-item">
                <i className="icon icon-fw icon-file-alt far mr-12" />
                View Details
            </a>
        );

        if (haveEditPermission) {

            // We use user's project UUID for this --
            // People may browse Core Project and want to make it preset for their own
            // projects instead, though.

            menuOptions.push(
                <a key="edit" href={presetFSID + "?currentAction=edit"} target="_blank" rel="noopener noreferrer" className="dropdown-item">
                    <i className="icon icon-fw icon-pencil-alt fas mr-12" />
                    Edit
                </a>
            );

            menuOptions.push(
                <DropdownItem key="delete" eventKey="delete">
                    <i className="icon icon-fw icon-times fas mr-12" />
                    Delete
                </DropdownItem>
            );

            if (userProjectUUID && !isPresetForProject) {
                // TODO make sure userProjectUUID not already in FS's `preset_for_projects` before showing or enabling
                menuOptions.push(
                    <DropdownItem key="set-project-preset" eventKey="set-project-preset">
                        <i className="icon icon-fw icon-user-friends fas mr-12" />
                        Set as preset for my project
                    </DropdownItem>
                );
            }
        }

    }


    const onMenuOptionSelect = useCallback(function(eventKey, e){

        e.preventDefault();
        e.stopPropagation();

        if (patchingPresetResultUUID !== null) {
            // Prevent multiple requests/actions from occuring at once.
            return false;
        }

        if (eventKey === "delete") {
            // PATCH status:deleted
            setPatchingPresetResultUUID(presetFSUUID);
            ajax.promise(presetFSID, "PATCH", {}, JSON.stringify({ "status" : "deleted" }))
                .then(function(resp){
                    console.info("PATCHed FilterSet", presetFSID);
                    toggleDeletedPresetUUID(presetFSUUID); // Temporarily (until ES results refreshed) show result as dimmed to indicate it's been deleted in Postgres.
                    if (isOriginOfCurrentCaseFilterSet) {
                        // Make sure we have the new status available in originalPresetFilterSet upstream so that 'Save as Preset' button becomes functional.
                        // Uses datastore=database so should be up-to-date by time this is called.
                        refreshOriginalPresetFilterSet();
                    }
                    checkForChangedResultsAndRefresh(
                        `/search/?type=FilterSet&status=deleted&uuid=${presetFSUUID}&limit=1`,
                        function(searchResponse){
                            const { "@graph": [ patchedFSFromSearch ] = [] } = searchResponse;
                            const { status: statusFromSearch } = patchedFSFromSearch || {};
                            return statusFromSearch === "deleted";
                        },
                        5000,
                        function(){
                            // Cleanup/remove presetFSUUID from higher-level state to free up memory.
                            toggleDeletedPresetUUID(presetFSUUID);
                        }
                    );
                })
                .finally(function(){
                    // TODO - error handling?
                    setPatchingPresetResultUUID(null);
                });
            return;
        }

        if (eventKey === "set-project-preset") {
            setPatchingPresetResultUUID(presetFSUUID);
            const { "preset_for_projects": listOfProjectsPresetFor = [] } = loadedItemView;
            // We assume this doesn't already have userProjectUUID, else option for 'set-project-preset' wouldn't be
            // rendered/available.
            ajax.promise(presetFSID, "PATCH", {}, JSON.stringify({ "preset_for_projects": listOfProjectsPresetFor.concat([userProjectUUID]) }))
                .then(function(resp){
                    console.info("PATCHed FilterSet", presetFSID);
                    checkForChangedResultsAndRefresh(
                        `/search/?type=FilterSet&uuid=${presetFSUUID}&limit=1`,
                        function(searchResponse){
                            const { "@graph": [ patchedFSFromSearch ] = [] } = searchResponse;
                            const { preset_for_projects: presetForProjectsFromSearch = [] } = patchedFSFromSearch || {};
                            return presetForProjectsFromSearch.indexOf(userProjectUUID) > -1;
                        }
                    );
                })
                .finally(function(){
                    // TODO - error handling?
                    setPatchingPresetResultUUID(null);
                });
            return;
        }

        return false;
    }, [ presetFilterSet, isOriginOfCurrentCaseFilterSet, loadedItemView, patchingPresetResultUUID === null ]);


    const presetIconsToShow = (
        <React.Fragment>
            { isPresetForProject ?
                <i className="mr-05 icon icon-fw icon-user-friends fas text-secondary" data-tip="Project preset" />
                : null }
            { isPresetForUser ?
                <i className="mr-05 icon icon-fw icon-user fas text-muted" data-tip="User preset" />
                : null }
            { isDefaultForProject ?
                <i className="mr-05 icon icon-fw icon-star fas text-secondary" data-tip="Project default" />
                : null }
        </React.Fragment>
    );

    return (
        // These should all have same exact height.
        // And then that height later on will be plugged
        // into (new replacement for) react-infinite rowHeight.
        <div className="preset-filterset-result" data-id={presetFSID}
            data-is-origin-of-current-case-filterset={isOriginOfCurrentCaseFilterSet}
            data-is-current-case-filterset-unchanged={isCurrentCaseFilterSetUnchanged}
            data-has-been-deleted={isDeleted}>
            <div className="title pl-12 pr-08">
                <h5 className="my-0 text-600 flex-grow-1 text-truncate" title={presetFSTitle}>
                    { presetFSTitle }
                </h5>
            </div>
            <div className="info pl-12 pr-08 text-small pb-04">

                <DropdownButton variant="default btn-dropdown-icon mr-05" size="xs" disabled={!!(patchingPresetResultUUID || isDeleted)}
                    onClick={onMenuClick} onSelect={onMenuOptionSelect}
                    title={
                        <i className={"icon text-secondary fas icon-fw icon-" + (isPatchingPreset ? "circle-notch icon-spin" : "ellipsis-v")} data-tip="View actions"/>
                    }>
                    { menuOptions }
                </DropdownButton>

                { presetIconsToShow }

                <span data-tip={"Created " + formatDateTime(date_created, "date-time-md") + " by " + presetFSAuthorTitle} data-delay-show={750}>
                    <LocalizedTime timestamp={date_created} formatType="date-md" />
                </span>

                <span className="flex-grow-1 count-indicator-wrapper ml-07 text-right">
                    <CountIndicator count={presetFBLen} data-tip={"Contains " + presetFBLen + " filter blocks"}
                        height={18} />
                </span>

                <div className="pl-08 flex-shrink-0 title-icon-container">
                    <button type="button" className="import-preset-btn btn btn-sm btn-outline-primary-dark"
                        onClick={importBtnDisabled ? null : onSelectPresetFilterSet} disabled={importBtnDisabled}
                        data-tip={
                            importBtnDisabled ? null // Button disabled, effectively
                                : isOriginOfCurrentCaseFilterSet ? "Reset current case FilterSet blocks to original ones from this preset"
                                    : "Copy filter blocks to current Case FilterSet"
                        }>
                        <i className="icon icon-file-export icon-fw fas" />
                    </button>

                </div>

            </div>
        </div>
    );
});



function AddToVariantSampleListButton(props){
    const {
        selectedVariantSamples,
        onResetSelectedVariantSamples,
        variantSampleListItem = null,
        updateVariantSampleListID,
        caseItem = null,
        filterSet,
        selectedFilterBlockIndices = {},
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem = false
    } = props;

    const {
        "@id": caseAtID,
        project: { "@id": caseProjectID } = {},
        institution: { "@id" : caseInstitutionID } = {},
        accession: caseAccession = null
    } = caseItem;

    const [ isPatchingVSL, setIsPatchingVSL ] = useState(false);

    /** PATCH or create new VariantSampleList w. additions */

    if (isLoadingVariantSampleListItem) {
        return (
            <button type="button" className="btn btn-primary" disabled>
                <span className="d-flex align-items-center">
                    <i className="icon icon-circle-notch icon-spin fas mr-1"/>
                    Loading most recent selections...
                </span>
            </button>
        );
    } else if (isPatchingVSL) {
        return (
            <button type="button" className="btn btn-primary" disabled>
                <span className="d-flex align-items-center">
                    <i className="icon icon-circle-notch icon-spin fas mr-1"/>
                    Saving selections...
                </span>
            </button>
        );
    } else if (selectedVariantSamples.size === 0) {
        return (
            <button type="button" className="btn btn-primary" disabled>
                <span>
                    No Sample Variants selected
                </span>
            </button>
        );
    } else {

        const onButtonClick = function(){

            if (!filterSet) {
                throw new Error("Expected some filterSet to be present");
            }

            setIsPatchingVSL(true);

            /** Adds/transforms props.selectedVariantSamples to param `variantSampleSelectionsList` */
            function addToSelectionsList(variantSampleSelectionsList){

                let filterBlocksRequestData = _.pick(filterSet, "filter_blocks", "flags", "uuid");

                // Only keep filter_blocks which were used in this query --
                filterBlocksRequestData.filter_blocks = filterBlocksRequestData.filter_blocks.filter(function(fb, fbIdx){
                    return selectedFilterBlockIndices[fbIdx];
                });

                // Convert to string (avoid needing to add to schema for now)
                filterBlocksRequestData = JSON.stringify(filterBlocksRequestData);

                // selectedVariantSamples is type (literal) Map, so param signature is `value, key, map`.
                // These are sorted in order of insertion/selection.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach
                selectedVariantSamples.forEach(function(variantSampleItem, variantSampleAtID){
                    variantSampleSelectionsList.push({
                        "variant_sample_item": variantSampleAtID, // Will become linkTo (embedded),
                        "filter_blocks_request_at_time_of_selection": filterBlocksRequestData
                        // The below 2 fields are filled in on backend (configured via `serverDefaults` in Item schema for these fields)
                        // "selected_by",
                        // "date_selected"
                    });
                });
            }

            let requestPromiseChain;


            if (!variantSampleListItem) {
                // Create new Item, then PATCH its @id to `Case.variant_sample_list_id` field.
                const createVSLPayload = {
                    "variant_samples": [],
                    "institution": caseInstitutionID,
                    "project": caseProjectID
                };

                if (caseAccession) {
                    createVSLPayload.created_for_case = caseAccession;
                }

                addToSelectionsList(createVSLPayload.variant_samples);

                requestPromiseChain = ajax.promise("/variant-sample-lists/", "POST", {}, JSON.stringify(createVSLPayload))
                    .then(function(respVSL){
                        console.log('VSL POST response', respVSL);
                        const {
                            "@graph": [{
                                "@id": vslAtID
                            }],
                            error: vslError
                        } = respVSL;

                        if (vslError || !vslAtID) {
                            throw new Error("Didn't succeed in creating new VSL Item");
                        }

                        updateVariantSampleListID(vslAtID, function(){
                            // Wait to reset selected items until after loading updated VSL so that checkboxes still appear checked during VSL PATCH+GET request.
                            fetchVariantSampleListItem(onResetSelectedVariantSamples);
                        });

                        // PATCH Case w. variant_sample_list_id
                        return ajax.promise(caseAtID, "PATCH", {}, JSON.stringify({ "variant_sample_list_id": vslAtID }));
                    }).then(function(respCase){
                        console.log('Case PATCH response from after VSL POST', respCase);
                        const {
                            "@graph": [{
                                "@id": respCaseAtID
                            }],
                            error: caseError
                        } = respCase;
                        if (caseError || !respCaseAtID) {
                            throw new Error("Didn't succeed in PATCHing Case Item");
                        }
                        console.info("Updated Case.variant_sample_list_id", respCase);
                        // TODO Maybe local-patch in-redux-store Case with new last_modified + variant_sample_list_id stuff? Idk.
                    });

            } else {
                // patch existing
                const {
                    "@id": vslAtID,
                    variant_samples: existingVariantSampleSelections = []
                } = variantSampleListItem;

                // Need to convert embedded linkTos into just @ids before PATCHing -
                const variantSamplesPatchList = existingVariantSampleSelections.map(function(existingSelection){
                    const { variant_sample_item: { "@id": vsItemID } } = existingSelection;
                    if (!vsItemID) {
                        throw new Error("Expected all variant samples to have an ID -- likely a view permissions issue.");
                    }
                    return {
                        ...existingSelection,
                        "variant_sample_item": vsItemID
                    };
                });

                // Add in new selections
                addToSelectionsList(variantSamplesPatchList);

                requestPromiseChain = ajax.promise(vslAtID, "PATCH", {}, JSON.stringify({ "variant_samples": variantSamplesPatchList }) )
                    .then(function(respVSL){
                        console.log('VSL PATCH response', respVSL);
                        const {
                            "@graph": [{
                                "@id": vslAtID
                            }],
                            error: vslError
                        } = respVSL;

                        if (vslError || !vslAtID) {
                            throw new Error("Didn't succeed in patching VSL Item");
                        }

                        // Wait to reset selected items until after loading updated VSL so that checkboxes still appear checked during VSL PATCH+GET request.
                        fetchVariantSampleListItem(onResetSelectedVariantSamples);

                    });

                // We shouldn't have any duplicates since prev-selected VSes should appear as checked+disabled in table.
                // But maybe should still check to be safer (todo later)
            }


            // Show any errors using an alert and unset isPatchingVSL state on completion.
            requestPromiseChain.catch(function(error){
                // TODO: add analytics exception event for this
                console.error(error);
                Alerts.queue({
                    "title" : "Error PATCHing or POSTing VariantSampleList",
                    "message" : JSON.stringify(err),
                    "style" : "danger"
                });
            }).finally(function(){
                setIsPatchingVSL(false);
            });

        };

        return (
            <button type="button" className="btn btn-primary" onClick={onButtonClick}>
                <span>
                    Add <strong>{ selectedVariantSamples.size }</strong> selected Sample Variants to Interpretation
                </span>
            </button>
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

/**
 * Unlike SaveFilterSetPresetButton, this logic is split out from the SaveFilterSetButton,
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
                    _.pick(filterSet, ...FilteringTableFilterSetUI.fieldsToKeepPrePatch)
                ));

            } else {
                // POST

                const payload = _.pick(filterSet, ...FilteringTableFilterSetUI.fieldsToKeepPrePatch);
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



/**
 * Stores & loads originalPresetFilterSet, keeps track of lastSavedPresetFilterSet.
 * Useful for informing confirm dialogs (or lack of) & disabling things, outside of
 * the SaveFilterSetPresetButton.
 */
export class SaveFilterSetPresetButtonController extends React.Component {

    constructor(props){
        super(props);
        this.setLastSavedPresetFilterSet = this.setLastSavedPresetFilterSet.bind(this);
        this.getDerivedFromFilterSetIfPresent = this.getDerivedFromFilterSetIfPresent.bind(this);

        this.state = {
            "originalPresetFilterSet": null,
            "isOriginalPresetFilterSetLoading": false,
            // Stored after POSTing new FilterSet to allow to prevent immediate re-submits.
            "lastSavedPresetFilterSet": null
        };

        this.memoized = {
            hasFilterSetChangedFromOriginalPreset: memoize(function(arg1, arg2){
                return SaveFilterSetButtonController.hasFilterSetChanged(arg1, arg2, ["filter_blocks"]);
            }),
            hasFilterSetChangedFromLastSavedPreset: memoize(function(arg1, arg2){
                return SaveFilterSetButtonController.hasFilterSetChanged(arg1, arg2, ["filter_blocks"]);
            })
        };

        this.currentOriginalDerivedFromPresetFilterSetRequest = null;
    }

    /**
     * If `filterSet.derived_from_preset_filterset` exists,
     * grab & save it to compare against.
     */
    componentDidMount(){
        this.getDerivedFromFilterSetIfPresent();
    }

    componentDidUpdate({ currFilterSet: pastFilterSet }){
        const { currFilterSet: currentFilterSet } = this.props;
        const { derived_from_preset_filterset: pastDerivedFrom = null } = pastFilterSet || {};
        const { derived_from_preset_filterset: currentDerivedFrom = null } = currentFilterSet || {};

        if (currentDerivedFrom !== pastDerivedFrom) {
            // If initial filterSet is null (due to being loaded in still), then
            // check+fetch `filterSet.derived_from_preset_filterset` once filterSet
            // gets loaded & passed-in.
            // Also handles if `derived_from_preset_filterset` has changed due to
            // importing a new Preset FS blocks.
            this.getDerivedFromFilterSetIfPresent(true);
        }
    }

    /**
     * Random thought - we could theoretically avoid additional
     * request if selected new preset filterset from result list of presets (containing all necessary data).
     * Needs thought on how to "send" that filterset context to here from there in a clean way; if not clean then
     * probably not worth doing.
     */
    getDerivedFromFilterSetIfPresent(allowFromProp=false){
        const { currFilterSet, originalPresetFilterSetBody } = this.props;
        const { derived_from_preset_filterset = null } = currFilterSet || {};

        console.info("Called `getDerivedFromFilterSetIfPresent`");

        if (derived_from_preset_filterset){ // derived_from_preset_filterset has format 'uuid'

            // First check if props.originalPresetFilterSetBody matched our UUID, and if so, just use that
            // to avoid AJAX request.
            if (allowFromProp) {
                const { uuid: propPriginalPresetFilterSetUUID = null } = originalPresetFilterSetBody || {};
                if (propPriginalPresetFilterSetUUID && propPriginalPresetFilterSetUUID === derived_from_preset_filterset){
                    this.currentOriginalDerivedFromPresetFilterSetRequest = null; // Cancel any existing requests incase any started.
                    this.setState({
                        "originalPresetFilterSet": originalPresetFilterSetBody,
                        "isOriginalPresetFilterSetLoading": false
                    });
                    return;
                }
            }

            this.setState({ "isOriginalPresetFilterSetLoading": true }, () => {

                if (this.currentOriginalDerivedFromPresetFilterSetRequest) {
                    console.log("Aborting previous request", this.currentOriginalDerivedFromPresetFilterSetRequest);
                    this.currentOriginalDerivedFromPresetFilterSetRequest.aborted = true;
                    this.currentOriginalDerivedFromPresetFilterSetRequest.abort();
                }

                const currScopedRequest = this.currentOriginalDerivedFromPresetFilterSetRequest = ajax.load("/filter-sets/" + derived_from_preset_filterset + "/?datastore=database&frame=object", (res)=>{
                    const { "@id" : origPresetFSID } = res;

                    if (currScopedRequest !== this.currentOriginalDerivedFromPresetFilterSetRequest) {
                        // Latest curr request has changed since this currScopedRequest was launched.
                        // Throw out this response
                        console.warn("This request was superseded");
                        return;
                    }

                    this.currentOriginalDerivedFromPresetFilterSetRequest = null;

                    if (!origPresetFSID) {
                        // Some error likely.
                        console.error("Error (a) in getDerivedFromFilterSetIfPresent, likely no view permission", res);
                        this.setState({ "isOriginalPresetFilterSetLoading": false });
                        return;
                    }

                    this.setState({
                        "originalPresetFilterSet": res,
                        "isOriginalPresetFilterSetLoading": false
                    });
                }, "GET", (err)=>{

                    // Don't unset state.isOriginalPresetFilterSetLoading if request was aborted/superceded
                    if (currScopedRequest.aborted === true) {
                        return;
                    }

                    console.error("Error (b) in getDerivedFromFilterSetIfPresent, perhaps no view permission", err);
                    this.setState({ "isOriginalPresetFilterSetLoading": false });
                });
            });
        }
    }

    setLastSavedPresetFilterSet(lastSavedPresetFilterSet, callback = null){
        this.setState({ lastSavedPresetFilterSet }, callback);
    }

    render(){
        const { children, currFilterSet, ...passProps } = this.props;
        const { originalPresetFilterSet, isOriginalPresetFilterSetLoading, lastSavedPresetFilterSet } = this.state;

        const hasFilterSetChangedFromOriginalPreset = this.memoized.hasFilterSetChangedFromOriginalPreset(originalPresetFilterSet, currFilterSet);
        const hasFilterSetChangedFromLastSavedPreset = this.memoized.hasFilterSetChangedFromLastSavedPreset(lastSavedPresetFilterSet, currFilterSet);

        const childProps = {
            ...passProps,
            currFilterSet,
            hasFilterSetChangedFromOriginalPreset,
            hasFilterSetChangedFromLastSavedPreset,
            lastSavedPresetFilterSet,
            originalPresetFilterSet,
            isOriginalPresetFilterSetLoading,
            // Loading of it itself is done in SaveFilterSetPresetButton
            // still, until time comes for that logic to be moved up (if ever (unlikely)).
            setLastSavedPresetFilterSet: this.setLastSavedPresetFilterSet,
            // Passed down to allow PresetFilterSetResult to call it after if the originalPresetFilterSet has been edited.
            refreshOriginalPresetFilterSet: this.getDerivedFromFilterSetIfPresent
        };
        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }

}


function SaveFilterSetButton(props){
    const {
        isEditDisabled,
        saveFilterSet,
        isSavingFilterSet,
        hasCurrentFilterSetChanged,
        className = "btn btn-primary"
    } = props;
    const disabled = isEditDisabled || isSavingFilterSet || !hasCurrentFilterSetChanged;

    function onSaveBtnClick(e){
        e.stopPropagation();
        e.preventDefault();
        if (disabled) return false;
        saveFilterSet();
    }

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
 * @todo
 * Probably split out a SaveFilterSetPresetController..
 *
 * @todo or defer:
 * Making 'Save As...' btn disabled if unchanged from previous preset.
 * Hard to figure out in good definitive way if changed, esp. if then save new preset.
 */
class SaveFilterSetPresetButton extends React.Component {

    constructor(props){
        super(props);
        this.onSelectPresetOption = this.onSelectPresetOption.bind(this);
        this.onClickSavePresetButton = this.onClickSavePresetButton.bind(this);
        this.onHideModal = this.onHideModal.bind(this);
        this.onPresetTitleInputChange = this.onPresetTitleInputChange.bind(this);
        this.onPresetFormSubmit = this.onPresetFormSubmit.bind(this);

        this.state = {
            showingModalForEventKey: null,
            presetTitle: "",
            savingStatus: 0 // 0 = not loading; 1 = loading; 2 = load succeeded; -1 = load failed.
        };
    }

    /** @deprecated */
    onSelectPresetOption(eventKey, e) {
        e.stopPropagation();
        e.preventDefault();
        // Save info about clicked option to state (eventKey)
        this.setState({ "showingModalForEventKey": eventKey });
        return;
    }

    onClickSavePresetButton(e) {
        e.stopPropagation();
        e.preventDefault();
        this.setState({ "showingModalForEventKey": "user:preset" });
        return;
    }

    onHideModal(e){
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        const { savingStatus } = this.state;
        if (savingStatus === 1) {
            // Prevent if in middle of POST request.
            return false;
        }
        this.setState({ "showingModalForEventKey": null, "savingStatus": 0 });
        return false;
    }

    onPresetTitleInputChange(e) {
        this.setState({ "presetTitle": e.target.value });
    }

    /**
     * Copies the current FilterSet and creates new one, with
     * "preset_for_project", "preset_for_user", and/or
     * "default_for_project" fields set accordingly.
     */
    onPresetFormSubmit(e) {
        e.stopPropagation();
        e.preventDefault();

        const { caseItem, filterSet, setLastSavedPresetFilterSet, originalPresetFilterSet } = this.props;
        const { showingModalForEventKey = null, presetTitle } = this.state;
        const {
            project: {
                "@id": caseProjectID,
                uuid: caseProjectUUID
            } = {},
            institution: {
                "@id": caseInstitutionID
            }
        } = caseItem;

        const [ modalOptionItemType = null, modalOptionType = null ] = showingModalForEventKey ? showingModalForEventKey.split(":") : [];

        this.setState({ "savingStatus": 1 }, () => {

            const payload = {
                ..._.omit(
                    // Preserves `derived_from_preset_filterset` also for now.
                    _.pick(filterSet, ...FilteringTableFilterSetUI.fieldsToKeepPrePatch),
                    "uuid" // We'll POST this as new FilterSet; delete existing UUID if any.
                ),
                "title": presetTitle,
                "institution": caseInstitutionID,
                "project": caseProjectID
            };

            console.log("Submitted Preset Modal Form; modalOptionType, modalOptionItemType ==", modalOptionType, modalOptionItemType);

            // TODO (figure out performant approach for, ideally so can get this info in render/memoized.hasFilterSetChanged):
            // Check previous filtersets in the context (e.g. /search/?type=FilterSet&preset_for_projects=...)
            // and prevent saving if _any_ matches. Kind of difficult given the size of filtersets...

            if (modalOptionType === "preset" && modalOptionItemType === "user") {
                const { uuid: userUUID = null } = JWT.getUserDetails() || {};
                payload.preset_for_users = [ userUUID ];
            } else if (modalOptionType === "preset" && modalOptionItemType === "project") {
                payload.preset_for_projects = [ caseProjectUUID ];
            } else if (modalOptionType === "default" && modalOptionItemType === "project") {
                payload.default_for_projects = [ caseProjectUUID ];
            }

            console.log("Preset FilterSet Payload", payload);

            ajax.promise("/filter-sets/", "POST", {}, JSON.stringify(payload))
                .then((res) => {
                    console.info("Created new Preset FilterSet; response:", res);
                    const { "@graph": [ newPresetFilterSetItem ] } = res;
                    return new Promise((resolve, reject) => {
                        setLastSavedPresetFilterSet(newPresetFilterSetItem, ()=>{
                            this.setState({ "savingStatus": 2, "presetTitle": "" }, ()=>{
                                resolve(newPresetFilterSetItem);
                            });
                        });
                    });
                }).then((newPresetFilterSetItem) => {
                    // If no "derived_from_preset_filterset" on Case.active_filterset, set it.
                    const { uuid: newPresetFilterSetItemUUID } = newPresetFilterSetItem;
                    const { derived_from_preset_filterset = null, "@id": caseFSID } = filterSet || {};
                    const { status: originalPresetFSStatus } = originalPresetFilterSet || {};
                    if (derived_from_preset_filterset === null || originalPresetFSStatus === "deleted") {
                        return ajax.promise(caseFSID, "PATCH", {}, JSON.stringify({ "derived_from_preset_filterset": newPresetFilterSetItemUUID }));
                    } else {
                        return false;
                    }
                }).then((responseOrFalse) => {
                    if (responseOrFalse !== false) {
                        // Assume PATCH Case FilterSet response obtained ...
                        console.info("PATCHed Case.active_filterset", responseOrFalse);
                    }
                })
                .catch((err)=>{
                    // TODO: Add analytics.
                    console.error("Error POSTing new preset FilterSet", err);
                    this.setState({ "savingStatus" : -1 });
                });

        });

        return false;
    }

    render(){
        const {
            caseItem,
            filterSet,
            isEditDisabled,
            lastSavedPresetFilterSet,
            isOriginalPresetFilterSetLoading,
            hasFilterSetChangedFromOriginalPreset,
            hasFilterSetChangedFromLastSavedPreset,
        } = this.props;
        const {
            showingModalForEventKey,
            presetTitle,
            // originalPresetFilterSet,
            // lastSavedPresetFilterSet,
            savingStatus,
            // isOriginalPresetFilterSetLoading
        } = this.state;
        const {
            project: {
                "@id": caseProjectID,
                "display_title": caseProjectTitle
            }
        } = caseItem;

        const {
            title: filterSetTitle = null
        } = filterSet || {}; // May be null while loading initially in FilterSetController

        const disabled = (
            savingStatus !== 0
            || isOriginalPresetFilterSetLoading
            || showingModalForEventKey
            || isEditDisabled
            // TODO: consider disabling if not saved yet?
            // || hasCurrentFilterSetChanged
            || !hasFilterSetChangedFromOriginalPreset
            || !hasFilterSetChangedFromLastSavedPreset
        );

        const [ modalOptionItemType = null, modalOptionType = null ] = showingModalForEventKey ? showingModalForEventKey.split(":") : [];


        // TODO: Put into own component possibly, once split apart FilteringTableFilterSetUI into directory of files.
        let modal = null;
        if (modalOptionItemType) {
            let modalBody = null;
            if (savingStatus === 0) {
                // POST not started
                modalBody = (
                    <form onSubmit={this.onPresetFormSubmit} className="d-block">
                        <label htmlFor="new-preset-fs-id">Preset FilterSet Title</label>
                        <input id="new-preset-fs-id" type="text" placeholder={filterSetTitle + "..."} onChange={this.onPresetTitleInputChange} value={presetTitle} className="form-control mb-1" />
                        <button type="submit" className="btn btn-success" disabled={!presetTitle}>
                            Create
                        </button>
                    </form>
                );
            }
            else if (savingStatus === 1) {
                // Is POSTing
                modalBody = (
                    <div className="text-center py-4 text-larger">
                        <i className="icon icon-spin icon-circle-notch fas mt-1 mb-1" />
                    </div>
                );
            }
            else if (savingStatus === 2) {
                // POST succeeded
                const { title: lastSavedPresetTile, "@id": lastSavedPresetID } = lastSavedPresetFilterSet; // Is in @@object representation
                modalBody = (
                    <div>
                        <h5 className="text-400 my-0">
                            { valueTransforms.capitalize(modalOptionType) } FilterSet Created
                        </h5>
                        <a className="text-600 d-inline-block mb-16" href={lastSavedPresetID} target="_blank" rel="noopener noreferrer">{ lastSavedPresetTile }</a>
                        <p className="mb-16">
                            It may take some time before the preset is visible in list of presets and available for import.
                        </p>
                        <button type="button" className="btn btn-success btn-block"
                            onClick={this.onHideModal} autoFocus>
                            OK
                        </button>
                    </div>
                );
            }
            else if (savingStatus === -1) {
                // POST failed
                modalBody = (
                    <div>
                        <h4 className="text-400 mt-0 mb-16">
                            Failed to create preset FilterSet
                        </h4>
                        <p className="mb-16 mt-0">You may not have permission yet to create new FilterSets. Check back again later or report to developers.</p>
                        <button type="button" className="btn btn-warning btn-block" onClick={this.onHideModal}>
                            Close
                        </button>
                    </div>
                );
            }

            modal = (
                <Modal show onHide={this.onHideModal}>
                    <Modal.Header closeButton>
                        <Modal.Title className="text-400">
                            Creating { modalOptionType } FilterSet for { modalOptionItemType }
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>{ modalBody }</Modal.Body>
                </Modal>
            );
        }

        return (
            <React.Fragment>

                { modal }

                <button className="btn btn-outline-light btn-sm" type="button" onClick={disabled ? null : this.onClickSavePresetButton}
                    disabled={disabled} data-tip="Create copy of this current FilterSet and set it as a preset for yourself">
                    { savingStatus === 1 ? <i className="icon icon-circle-notch icon-spin fas"/> : "Save as Preset" }
                </button>

                {/*

                <DropdownButton title={savingStatus === 1 ? <i className="icon icon-circle-notch icon-spin fas"/> : "Save as..."}
                    variant="outline-light" size="sm" onSelect={this.onSelectPresetOption}
                    data-tip="Create copy of this current FilterSet and set it as a preset for..." disabled={disabled}>
                    <DropdownItem data-tip="Create a copy of this current FilterSet and set it as a preset for yourself" eventKey="user:preset">
                        A preset for <span className="text-600">yourself</span> only
                    </DropdownItem>
                    <DropdownItem data-tip="Create a copy of this current FilterSet and set it as a preset for this project" eventKey="project:preset">
                        A preset for project <span className="text-600">{ caseProjectTitle }</span>
                    </DropdownItem>
                    <DropdownItem data-tip="Create a copy of this current FilterSet and set it as the default FilterSet for this project, to be basis for FilterSets of new Cases going forward" eventKey="project:default">
                        Default FilterSet for project <span className="text-600">{ caseProjectTitle }</span>
                    </DropdownItem>
                </DropdownButton>

                */}

            </React.Fragment>
        );
    }

}



/** Renders the Blocks */
const FilterSetUIBlocks = React.memo(function FilterSetUIBlocks(props){
    const {
        filterSet, filterBlocksLen, facetDict, schemas,
        singleSelectedFilterBlockIdx, selectedFilterBlockIndices, allFilterBlocksSelected, selectedFilterBlockIdxCount,
        selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
        cachedCounts, duplicateQueryIndices, duplicateNameIndices, isSettingFilterBlockIdx, isFetchingInitialFilterSetItem = false,
        ...remainingProps // Contains: addNewFilterBlock, toggleIntersectFilterBlocks, intersectFilterBlocks, saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged,
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
                    <div className="col-12 pb-02 col-sm text-sm-right">
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

            <FilterSetUIBlockBottomUI {...remainingProps} {...{ selectFilterBlockIdx, allFilterBlocksSelected, filterBlocksLen, singleSelectedFilterBlockIdx, currentSingleBlockQuery }} />

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

    function onAddBtnClick(e){
        e.stopPropagation();
        addNewFilterBlock();
    }

    function onCopyBtnClick(e){
        e.stopPropagation();
        addNewFilterBlock({ "query" : currentSingleBlockQuery });
    }

    function onSelectAllClick(e){
        e.stopPropagation();
        e.preventDefault();
        selectFilterBlockIdx(null);
    }

    function onToggleIntersectFilterBlocksBtnClick(e){
        e.stopPropagation();
        e.preventDefault();
        toggleIntersectFilterBlocks();
    }

    return (
        <div className="row pb-16 pt-16 px-3">
            <div className="col-12 col-xl mb-12 mb-xl-0">
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
            <div className="col-12 col-xl-auto">
                <div className="btn-group" role="group" aria-label="Creation Controls">
                    <button type="button" className="btn btn-primary-dark" onClick={onAddBtnClick} data-tip="Add new blank filter block">
                        <i className="icon icon-fw icon-plus fas mr-1" />
                        Add Filter Block
                    </button>
                    <button type="button" className="btn btn-primary-dark" onClick={onCopyBtnClick} disabled={!currentSingleBlockQuery}
                        data-tip="Copy currently-selected filter block">
                        <i className="icon icon-fw icon-clone far" />
                    </button>
                </div>
                <SaveFilterSetButton {...{ saveFilterSet, isSavingFilterSet, isEditDisabled, hasCurrentFilterSetChanged }} className="btn btn-primary-dark ml-08"/>
            </div>
        </div>
    );
}

/** Shown temporarily while initial FilterSet is still loading */
const DummyLoadingFilterBlock = React.memo(function DummyLoadingFilterBlock(){
    // dummyObject & filterBlock, though are objects which wouldn't === each other in prop comparisons, are not emitted from a useMemo since entire component is memoized and doesn't receive any [changes in] props.
    const dummyObject = {};
    const filterBlock = { "query" : "", "name" : <em>Please wait...</em> };
    const passProps = {
        filterBlock,
        filterBlocksLen: 1,
        index: 0,
        selected: false,
        isSettingFilterBlockIdx: true,
        cachedCounts: dummyObject,
        duplicateQueryIndices: dummyObject,
        duplicateNameIndices: dummyObject
    };
    return <FilterBlock {...passProps} />;
});


const FilterBlock = React.memo(function FilterBlock(props){
    const {
        index,
        filterBlock,
        selected = false,
        // searchContext,
        removeFilterBlockAtIdx,
        setNameOfFilterBlockAtIdx,
        selectFilterBlockIdx,
        isSettingFilterBlockIdx,
        facetDict,
        duplicateQueryIndices,
        duplicateNameIndices,
        cachedCounts,
        filterBlocksLen,
        schemas
    } = props;

    const {
        query: filterStrQuery,
        name: filterName
    } = filterBlock;

    const cachedCount = cachedCounts[index];

    /**
     * The following 3 assignments are memoized since string comparisons are slower than object
     * reference and integer comparisons.
     * Also, `duplicateQueryIndices` etc. are objects (not arrays), but for insertion & lookup,
     * integer key (`index`) is auto-cast to string in both instances, so works fine. Just
     * keep in mind if do `Object.keys(duplicateQueryIndices)` or similar at any point, that
     * would get back list of strings (not ints) and need to compare `parseInt(key) === index`,
     * if ever necessary.
     */
    const isDuplicateQuery = useMemo(function(){ return typeof duplicateQueryIndices[index] === "number"; }, [ duplicateQueryIndices, index ]);
    const isDuplicateName = useMemo(function(){ return typeof duplicateNameIndices[index] === "number"; }, [ duplicateNameIndices, index ]);
    const countExists = useMemo(function(){ return typeof cachedCount === "number"; }, [ cachedCounts, index ]);

    const [ isEditingTitle, setIsEditingTitle ] = useState(false);

    function onEditClick(e){
        e.stopPropagation();
        e.preventDefault();
        setIsEditingTitle(true);
    }

    function onRemoveClick(e){
        e.stopPropagation();
        if (filterStrQuery && !isDuplicateQuery) {
            const confirmation = window.confirm("Are you sure you want to delete this filter block? It still has some values.");
            if (!confirmation) return false;
        }
        removeFilterBlockAtIdx(index);
    }

    function onSelectClick(e){
        e.stopPropagation();
        e.preventDefault();
        if (e.shiftKey) {
            // Workaround to prevent selection of text on shift+mousedown.
            window.document.getSelection().removeAllRanges();
        }
        selectFilterBlockIdx(index, !e.shiftKey);
    }


    if (isEditingTitle && isSettingFilterBlockIdx) {
        setIsEditingTitle(false);
    }

    let title = null;
    if (isEditingTitle && !isSettingFilterBlockIdx) {
        title = (
            <form className="w-100 d-flex align-items-center mb-0" action="#case-info.filtering" onSubmit={function(e){
                e.stopPropagation();
                e.preventDefault();
                setIsEditingTitle(false);
                const formElem = e.target;
                const [ inputElem ] = formElem.children;
                setNameOfFilterBlockAtIdx(index, inputElem.value);
            }}>
                <input type="text" name="filterName" className="form-control" defaultValue={filterName} />
                <button type="reset" className="btn btn-sm btn-outline-dark ml-08" onClick={function(e){
                    e.stopPropagation();
                    e.preventDefault();
                    setIsEditingTitle(false);
                }}>
                    <i className="icon icon-fw icon-times fas" />
                </button>
                <button type="submit" className="btn btn-sm btn-outline-success ml-08"><i className="icon icon-fw icon-check fas" /></button>
            </form>
        );
    } else {
        const isLoadingBlock = (selected && isSettingFilterBlockIdx);
        const deleteIconCls = (
            "icon fas mr-07 icon-"
            + (isLoadingBlock ? "circle-notch icon-spin" : "times-circle clickable")
            + (filterBlocksLen > 1 ? "" : " disabled")
        );
        const titleCls = "text-small" + (
            isDuplicateName ? " text-danger"
                : !filterName ? " text-secondary"
                    : ""
        );

        title = (
            <React.Fragment>
                <i className={deleteIconCls} onClick={!isLoadingBlock && filterBlocksLen > 1 ? onRemoveClick : null}
                    data-tip={!isLoadingBlock && filterBlocksLen > 1 ? "Delete this filter block" : "Can't delete last filter block"} />
                <span className={titleCls} data-tip={isDuplicateName ? "Duplicate title of filter block #" + (duplicateNameIndices[index] + 1) : null}>
                    { filterName || <em>No Name</em> }
                </span>
                { typeof filterName === "string" ?
                    // Prevent [attempts at] editing of JSX/non-string 'filterName' values. Should only occur for hardcoded-UI stuff like DummyLoadingFilterBlock
                    <i className="icon icon-pencil-alt fas ml-1 clickable text-smaller" onClick={onEditClick} />
                    : null }
            </React.Fragment>
        );
    }

    const cls = (
        "filterset-block" +
        (selected ? " selected" : "") +
        (!isEditingTitle && filterBlocksLen > 1 ? " clickable" : "")
    );

    return (
        <div className={cls} onClick={!isEditingTitle ? onSelectClick : null} data-duplicate-query={isDuplicateQuery}
            data-tip={isDuplicateQuery ? "Duplicate query of filter block #" + (duplicateQueryIndices[index] + 1) : null}>
            <div className="row px-2 pt-08 pb-04 title-controls-row">
                <div className="col d-flex align-items-center">
                    { title }
                </div>
                <div className="col-auto">
                    <div className="cached-counts-value" data-count-exists={countExists} data-tip={countExists ? cachedCount + " results found for this filter block." : null}>
                        { cachedCount }
                    </div>
                </div>
            </div>
            <FieldBlocks {...{ filterBlock, facetDict, schemas }} />
        </div>
    );
});

function FieldBlocks({ filterBlock, facetDict, schemas }) {
    const { query: filterStrQuery } = filterBlock;

    if (!filterStrQuery) {
        return (
            <div className="py-1 px-2">
                <em>No Filters Selected</em>
            </div>
        );
    }

    const { correctedQuery, sortedFields, fieldSchemas } = useMemo(function(){

        const origQs = queryString.parse(filterStrQuery);

        const termQs = {};
        // Will fill this with `{ field: { from, to } }` and create combined items for them afterwards.
        const rangeQs = {};

        Object.keys(origQs).forEach(function(k){

            // Remove .from or .to if needed, confirm aggregation_type === stats, and transform/merge values
            let field = k;
            let v = origQs[k];

            let removedRangeFacetAppendage = false;
            if (k.slice(-5) === ".from"){
                field = k.slice(0, -5);
                if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                    // We might remove check of aggregation_type here since might not be present if being gotten from schemas.
                    // Becomes slightly risky, if there's embedded linkto with field 'from' or 'to'.
                    field = k;
                    console.error("Attempted to remove 'from' from field but couldn't succeed", field, facetDict);
                } else {
                    removedRangeFacetAppendage = true;
                    rangeQs[field] = rangeQs[field] || {};
                    rangeQs[field].from = v;
                }

            } else if (k.slice(-3) === ".to") {
                field = k.slice(0, -3);
                if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                    // We might remove check of aggregation_type here since might not be present if being gotten from schemas.
                    // Becomes slightly risky, if there's embedded linkto with field 'from' or 'to'.
                    field = k;
                    console.error("Attempted to remove 'to' from field but couldn't succeed", field, facetDict);
                } else {
                    removedRangeFacetAppendage = true;
                    rangeQs[field] = rangeQs[field] || {};
                    rangeQs[field].to = v;
                }
            }

            if (removedRangeFacetAppendage) {
                return;
            }


            // Standardize term values of the parsed query object into arrays (including w. length=1).
            if (!Array.isArray(v)) {
                v = [v];
            }
            // If not range facet, transform vals to proper names.
            // (formatRangeVal will do same if necessary)
            v = v.map(function(termVal){
                return Schemas.Term.toName(field, termVal);
            });

            // Merge, e.g. if a from and a to
            if (typeof termQs[field] !== "undefined") {
                termQs[field] = termQs[field].concat(v);
            } else {
                termQs[field] = v;
            }

        });


        // TODO: Consider moving this up to where facetDict is created, but would be
        // bit more complexy to memoize well (and need to ensure removal of .from and .to for ranges).
        const allFieldSchemas = {};

        // Transform rangeQs numbers into values.
        Object.keys(rangeQs).forEach(function(field){
            const { from = null, to = null } = rangeQs[field];
            const fieldSchema = allFieldSchemas[field] = getSchemaProperty(field, schemas, "VariantSample");
            const facet = facetDict[field];
            const { title: facetTitle, abbreviation: facetAbbreviation = null } = facet;
            const { abbreviation: fieldAbbreviation = null } = fieldSchema || {};
            const title = facetAbbreviation || fieldAbbreviation || (facetTitle.length > 5 ? <em>N</em> : facetTitle);
            rangeQs[field] = [
                <FormattedToFromRangeValue {...{ from, to, facet, title }} termTransformFxn={Schemas.Term.toName} key={0} />
            ];
        });

        // Get rest of field schemas for term facets
        const termFields = Object.keys(termQs);
        termFields.forEach(function(field){
            allFieldSchemas[field] = getSchemaProperty(field, schemas, "VariantSample");
        });

        // Combine & sort all filtered-on fields by their schema.facet.order, if any.
        const sortedFields = termFields.concat(Object.keys(rangeQs)).sort(function(fA, fB){
            const fsA = facetDict[fA];
            const fsB = facetDict[fB];
            if (fsA && !fsB) return -1;
            if (!fsA && fsB) return 1;
            if (!fsA && !fsB) return 0;
            return (fsA.order || 10000) - (fsB.order || 10000);
        });

        return {
            sortedFields,
            "fieldSchemas": allFieldSchemas,
            "correctedQuery" : { ...termQs, ...rangeQs }
        };
    }, [ filterBlock, facetDict, schemas ]);

    return (
        <div className="d-flex flex-wrap filter-query-viz-blocks px-2">
            { sortedFields.map(function(field, index){
                return <FieldBlock {...{ field }} fieldFacet={facetDict[field]} fieldSchema={fieldSchemas[field]} terms={correctedQuery[field]} key={field} />;
            }) }
        </div>
    );
}

function FieldBlock({ field, terms, fieldFacet, fieldSchema }){
    const {
        title: facetTitle = null,
        // description: facetDescription = null,
        // aggregation_type = "terms"
    } = fieldFacet || {};

    const {
        // Used primarily as fallback, we expect/hope for fieldFacet to be present/used primarily instead.
        title: fieldTitle = null,
        // description: fieldDescription = null
    } = fieldSchema || {};

    const title = facetTitle || fieldTitle || field;

    const valueBlocks = terms.map(function(val, idx){
        return (
            <div className="value-block" key={idx}>
                { val }
            </div>
        );
    });

    return (
        <div className="field-block py-1">
            <div className="value-blocks d-flex flex-wrap">
                { valueBlocks }
            </div>
            <div className="field-name">
                <em>{ title }</em>
            </div>
        </div>
    );
}



/**
 * Meant to be used to wrap a FilteringTableFilterSetUI
 */
export class FilterSetController extends React.PureComponent {

    static propTypes = {
        "initialFilterSetItem" : PropTypes.shape({
            "@id" : PropTypes.string, // Is required if originally existed, else free to be null.
            "uuid" : PropTypes.string, // Is required if originally existed, else free to be null.
            "title" : PropTypes.string.isRequired,
            "search_type" : PropTypes.oneOf(["VariantSample", "Variant", "Case"]),
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
        "navigate" : PropTypes.func.isRequired,
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
        const { filters: ctxFilters = [] } = searchContext;
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

        if (selectedFilterBlockIdxCount === filterBlocksLen) {
            selectedFilterBlockIndices = {};
            selectedFilterBlockIdxCount = 0;
            selectedFilterBlockIdxList = [];
        }


        // Update state.currFilterSet with filters from response, unless amid some other update.

        if (!searchContext || isSettingFilterBlockIdx){
            // Don't update from blank. Or if still loading response for current selection.
            return { selectedFilterBlockIndices };
        }

        if (!(selectedFilterBlockIdxCount === 1 || (selectedFilterBlockIdxCount === 0 && filterBlocksLen === 1))){
            // Cancel if compound filterset request.
            return { selectedFilterBlockIndices };
        }

        const selectedFilterBlockIdx = parseInt(selectedFilterBlockIdxList[0] || 0);
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
        const { initialFilterSetItem, context: searchContext, onResetSelectedVariantSamples } = this.props;
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

        if (onResetSelectedVariantSamples && searchContext !== pastSearchContext) {
            console.info("Resetting selected VS items");
            onResetSelectedVariantSamples();
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
        const { navigate: virtualNavigate, searchHrefBase, context: searchContext } = this.props; // props.navigate passed down in from SPC EmbeddedSearchView VirtualHrefController
        const { selectedFilterBlockIndices, currFilterSet, intersectFilterBlocks } = this.state;

        const selectedIdxList = Object.keys(selectedFilterBlockIndices);
        const selectedIdxCount = selectedIdxList.length;


        console.info("navigate to current block", this.props, this.state);

        if (!currFilterSet) {
            console.error("No current filterset to navigate to. Fine if expected (i.e. initial filterset item still being fetched).");
            return null;
        }

        const { filter_blocks, search_type = "VariantSample" } = currFilterSet;

        if (selectedIdxCount > 1 || (selectedIdxCount === 0 && filter_blocks.length > 1)) {
            // Navigate using compound fs.
            // Having 0 filter_blocks selected is effectively same as having all filter_blocks selected.

            let global_flags = url.parse(searchHrefBase, false).search;
            if (global_flags) {
                // Not particularly necessary but helps make less redundant since we have `search_type` already.
                global_flags = global_flags.slice(1).replace("type=VariantSample&", "");
            }

            const selectedFilterBlocks = selectedIdxCount === 0 ? filter_blocks : filter_blocks.filter(function(fb, fbIdx){
                return selectedFilterBlockIndices[fbIdx];
            });

            // We create our own names for flags & flags_applied here rather
            // than using filterSet.flags since filterSet.flags might potentially
            // be populated from other places; idk...
            const virtualCompoundFilterSet = {
                search_type,
                global_flags,
                "intersect": intersectFilterBlocks,
                // "flags": [
                //     {
                //         "name": "CurrentFilterSet",
                //         "query": global_flags
                //     }
                // ],
                "filter_blocks": selectedFilterBlocks.map(function({ query }){
                    return {
                        query,
                        "flags_applied": [] // ["CurrentFilterSet"]
                    };
                })
            };

            console.log("WILL USE virtualCompoundFilterSet", global_flags, virtualCompoundFilterSet);

            virtualNavigate(virtualCompoundFilterSet, null, (res)=>{
                this.setState({ "isSettingFilterBlockIdx": false });
            });

            return;
        } else {
            // Navigate as if using single search URL href.
            const [ selectedFilterBlockIdx = 0 ] = selectedIdxList;
            // Parse to int, since object keys are always strings.
            const currFilterSetQuery = filter_blocks[parseInt(selectedFilterBlockIdx)].query;
            const { "@id": currSearchHref = null } = searchContext || {};
            const nextSearchHref = searchHrefBase + (currFilterSetQuery ? "&" + currFilterSetQuery : "");

            // Compares full hrefs, incl searchHrefBase params
            const haveSearchParamsChanged = !currSearchHref || !_.isEqual(
                url.parse(nextSearchHref, true).query,
                url.parse(currSearchHref, true).query
            );

            if (haveSearchParamsChanged) {
                virtualNavigate(nextSearchHref, null, (res)=>{
                    this.setState({ "isSettingFilterBlockIdx": false });
                });
            } else {
                this.setState({ "isSettingFilterBlockIdx": false });
            }

        }
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
