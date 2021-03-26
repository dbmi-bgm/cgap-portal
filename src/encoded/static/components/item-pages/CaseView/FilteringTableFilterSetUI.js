'use strict';

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';

import Collapse from "react-bootstrap/esm/Collapse";

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { getSchemaProperty } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';
import { FormattedToFromRangeValue } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/FacetList/RangeFacet';

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

    static hasFilterSetChanged(savedFilterSet = null, currFilterSet = null) {

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

        // Eventually can add 'status' to this as well, if UI to edit it added.
        // In part we limit fields greatly because of differences between
        // @@embedded and other potential representations (i.e. @@object returned
        // on PATCH/POST).
        // Could be expanded/simplified if we get @@embedded back on PATCH/POST and
        // maybe AJAX in initial filter set (w all fields, not just those embedded
        // on Case Item.)
        const fieldsToCompare = ["filter_blocks", "title", "flags"];

        return !_.isEqual(
            // Skip over comparing fields that differ between frame=embed and frame=raw
            _.pick(savedFilterSet, ...fieldsToCompare),
            _.pick(currFilterSet, ...fieldsToCompare)
        );
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
        const { currFilterSet: filterSet, defaultOpen = true } = props;
        this.toggleOpen = _.throttle(this.toggleOpen.bind(this), 750);
        this.saveFilterSet = _.throttle(this.saveFilterSet.bind(this), 1500);

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
            hasFilterSetChanged: memoize(FilteringTableFilterSetUI.hasFilterSetChanged),
            findDuplicateBlocks: memoize(FilteringTableFilterSetUI.findDuplicateBlocks),
            deriveSelectedFilterBlockIdxInfo: memoize(FilteringTableFilterSetUI.deriveSelectedFilterBlockIdxInfo)
        };

        this.state = {
            "bodyOpen": defaultOpen,
            "bodyMounted": defaultOpen, // Is set to true for 750ms after closing to help keep contents visible until collapsed.
            // DEPRECATED: active_filterset is likely to lack some.. stuff..
            "lastSavedFilterSet": (filterSet && filterSet['@id']) ? filterSet : null, // active_filterset,
            "isSavingFilterSet": false
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
        const { bodyOpen } = this.props;

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

    saveFilterSet(){
        const { currFilterSet: filterSet, caseItem } = this.props;
        const { lastSavedFilterSet } = this.state;
        const {
            "@id": caseAtID,
            project: {
                "@id": caseProjectID
            } = {},
            institution: {
                "@id" : caseInstitutionID
            } = {}
        } = caseItem;

        const { "@id": existingFilterSetID } = lastSavedFilterSet || {};

        // No error handling (e.g. lastSavedFilterSet not having view permissions for) done here
        // as assumed `saveFilterSet` inaccessible if no permission, etc.

        /**
         * IMPORTANT:
         * We remove any calculated or linkTo things from PATCH/POST payload.
         * linkTos must be transformed to UUIDs before POST as well.
         * Hardcoded here since UI is pretty specific to it.
         */
        const fieldsToKeepPrePatch = ["title", "filter_blocks", "search_type", "flags", "created_in_case_accession", "uuid", "status"];


        const patchFilterSet = () => {
            ajax.load(existingFilterSetID, (res) => {
                const { "@graph" : [ existingFilterSetItem ] } = res;
                this.setState({
                    "lastSavedFilterSet": existingFilterSetItem,
                    "isSavingFilterSet": false
                });
                // callback(existingFilterSetItem);
            }, "PATCH", (err) => {
                console.error("Error PATCHing existing FilterSet", err);
                Alerts.queue({
                    "title" : "Error PATCHing existing FilterSet",
                    "message" : JSON.stringify(err),
                    "style" : "danger"
                });
                this.setState({ "isSavingFilterSet" : false });
            }, JSON.stringify(
                _.pick(filterSet, ...fieldsToKeepPrePatch)
            ));
        };

        const createFilterSet = () => {
            const payload = _.pick(filterSet, ...fieldsToKeepPrePatch);
            // `institution` & `project` are set only upon create.
            payload.institution = caseInstitutionID;
            payload.project = caseProjectID;
            ajax.load("/filter-sets/", (res) => {
                const { "@graph" : [ newFilterSetItemRes ] } = res;
                const { uuid: nextFilterSetUUID } = newFilterSetItemRes;

                // Next, patch caseItem.active_filterset
                console.info("Setting 'active_filterset'", newFilterSetItemRes);
                ajax.load(caseAtID, (casePatchResponse) => {
                    console.info("PATCHed Case Item", casePatchResponse);
                    this.setState({
                        "lastSavedFilterSet": newFilterSetItemRes,
                        "isSavingFilterSet": false
                    });
                }, "PATCH", (err) => {
                    console.error("Error PATCHing Case", err);
                    Alerts.queue({
                        "title" : "Error PATCHing Case",
                        "message" : JSON.stringify(err),
                        "style" : "danger"
                    });
                    this.setState({ "isSavingFilterSet" : false });
                }, JSON.stringify({ "active_filterset" : nextFilterSetUUID }));

            }, "POST", (err) => {
                console.error("Error POSTing new FilterSet", err);
                Alerts.queue({
                    "title" : "Error POSTing new FilterSet",
                    "message" : JSON.stringify(err),
                    "style" : "danger"
                });
                this.setState({ "isSavingFilterSet" : false });
            }, JSON.stringify(payload));
        };

        this.setState({ "isSavingFilterSet" : true }, function(){
            if (existingFilterSetID) {
                patchFilterSet();
            } else {
                createFilterSet();
            }
        });

    }

    render(){
        const {
            // From EmbeddedSearchView:
            context: searchContext, // Current Search Response (not that of this filterSet, necessarily)
            hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions,

            // From FilteringTab:
            caseItem, schemas,

            // From FilterSetController:
            currFilterSet: filterSet = null,
            excludeFacets,
            cachedCounts = {},
            addNewFilterBlock, selectedFilterBlockIndices, selectFilterBlockIdx, removeFilterBlockAtIdx,
            setNameOfFilterBlockAtIdx, setTitleOfFilterSet, isSettingFilterBlockIdx,

            // From ajax.FetchedItem
            isFetchingInitialFilterSetItem = false
        } = this.props;
        const { total: totalCount, facets = null } = searchContext || {};
        const { filter_blocks = [] } = filterSet || {};
        const { bodyOpen, bodyMounted, lastSavedFilterSet, isSavingFilterSet } = this.state;

        // Only updates if facets is not null since we don't care about aggregated counts from search response.
        const facetDict = this.memoized.buildFacetDictionary(facets, schemas, excludeFacets);
        const hasFilterSetChanged = this.memoized.hasFilterSetChanged(lastSavedFilterSet, filterSet);
        const { duplicateQueryIndices, duplicateNameIndices } = this.memoized.findDuplicateBlocks(filter_blocks);
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

        const headerProps = {
            filterSet, bodyOpen, caseItem, duplicateQueryIndices, duplicateNameIndices, hasFilterSetChanged, isSavingFilterSet,
            setTitleOfFilterSet, isFetchingInitialFilterSetItem
        };

        let body = null;
        if (bodyMounted) {
            const bodyProps = {
                filterSet, filterBlocksLen, facetDict, excludeFacets, searchContext, schemas, isFetchingInitialFilterSetItem,
                singleSelectedFilterBlockIdx, selectedFilterBlockIndices, allFilterBlocksSelected, selectedFilterBlockIdxCount,
                addNewFilterBlock, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
                cachedCounts, duplicateQueryIndices, duplicateNameIndices, isSettingFilterBlockIdx,
            };
            body = <FilterSetUIBlocks {...bodyProps} />;
        }

        return (
            // TODO Refactor/simplify AboveTableControlsBase to not need nor use `panelMap` (needless complexity / never had use for it)
            <div className="above-variantsample-table-ui">
                <div className="filterset-outer-container" data-all-selected={allFilterBlocksSelected} data-is-open={bodyOpen}>
                    <FilterSetUIHeader {...headerProps} toggleOpen={this.toggleOpen} saveFilterSet={this.saveFilterSet} />
                    <Collapse in={bodyOpen}>
                        <div className="filterset-blocks-container">
                            { body }
                        </div>
                    </Collapse>
                </div>
                <AboveTableControlsBase {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions }}
                    panelMap={AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(this.props)}>
                    <h4 className="text-400 col my-0">
                        <span className="text-600 mr-1">{ totalCount }</span>
                        <span>
                            Variant Matches for { currentFilterBlockName ?
                                <em>{ currentFilterBlockName }</em>
                                // TODO: Allow to toggle Union vs Intersection in FilterSetController
                                : `Union of ${selectedFilterBlockCount} Filter Blocks` }
                        </span>
                    </h4>
                </AboveTableControlsBase>
            </div>
        );
    }

}

function FilterSetUIHeader(props){
    const {
        filterSet, caseItem,
        toggleOpen, bodyOpen, hasFilterSetChanged, duplicateQueryIndices, duplicateNameIndices,
        saveFilterSet, isSavingFilterSet, setTitleOfFilterSet, isFetchingInitialFilterSetItem = false
    } = props;
    const { actions: ctxActions = [] } = caseItem || {};
    const {
        '@id': filterSetID,
        error: fsError = null,
        title: fsTitle = null,
        display_title: fsDisplayTitle = null
    } = filterSet || {};

    const haveEditPermission = useMemo(function(){
        return _.findWhere(ctxActions, { "name" : "edit" });
    }, [ ctxActions ]);

    const [ isEditingTitle, setIsEditingTitle ] = useState(false);

    function onEditClick(e){
        e.stopPropagation();
        e.preventDefault();
        setIsEditingTitle(true);
    }

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
    } else if (isEditingTitle) {
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
    } else {
        titleBlock = (
            <h4 className="text-400 clickable my-0 d-inline-block" onClick={toggleOpen}>
                <i className={"small icon icon-fw fas mr-07 icon-" + (bodyOpen ? "minus" : "plus")} />
                { fsTitle || fsDisplayTitle || <em>No Title Set</em> }
                { bodyOpen ? <i className="icon icon-pencil-alt fas ml-1 clickable text-small" onClick={onEditClick} /> : null }
            </h4>
        );
    }

    const haveDuplicateQueries = _.keys(duplicateQueryIndices).length > 0;
    const haveDuplicateNames = _.keys(duplicateNameIndices) > 0;

    const editBtnDisabled = !bodyOpen || !hasFilterSetChanged || !haveEditPermission || haveDuplicateQueries || haveDuplicateNames || isSavingFilterSet || !filterSet;

    function onSaveBtnClick(e){
        e.stopPropagation();
        if (editBtnDisabled) {
            // Report analytics maybe.
            return false;
        }
        saveFilterSet();
    }

    // todo if edit permission(?): [ Save Button etc. ] [ Sum Active(?) Filters ]
    return (
        <div className="row filter-set-ui-header align-items-center px-3 py-3">
            <div className="col pl-0">{ titleBlock }</div>
            <div className="col-auto pr-0">
                { haveDuplicateQueries || haveDuplicateNames ?
                    <i className="icon icon-exclamation-triangle fas align-middle mr-15 text-secondary"
                        data-tip={`Filter blocks with duplicate ${haveDuplicateQueries ? "queries" : "names"} exist below`} />
                    : null }
                <button type="button" className="btn btn-sm btn-outline-light" disabled={editBtnDisabled} onClick={onSaveBtnClick}>
                    { isSavingFilterSet ?
                        <i className="icon icon-spin icon-circle-notch fas" />
                        : (
                            <React.Fragment>
                                <i className="icon icon-save fas mr-07"/>
                                Save
                            </React.Fragment>
                        )}
                </button>
            </div>
        </div>
    );
}


/** Renders the Blocks */

const FilterSetUIBlocks = React.memo(function FilterSetUIBlocks(props){
    const {
        filterSet, filterBlocksLen, facetDict,
        singleSelectedFilterBlockIdx, selectedFilterBlockIndices, allFilterBlocksSelected, selectedFilterBlockIdxCount,
        addNewFilterBlock, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
        cachedCounts, duplicateQueryIndices, duplicateNameIndices, isSettingFilterBlockIdx, isFetchingInitialFilterSetItem = false,
        schemas
    } = props;
    const { filter_blocks = [] } = filterSet || {};
    const { query: currentSingleBlockQuery = null } = (singleSelectedFilterBlockIdx !== null && filter_blocks[singleSelectedFilterBlockIdx]) || {};

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

    const commonProps = {
        facetDict, filterBlocksLen, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx, isSettingFilterBlockIdx,
        duplicateQueryIndices, duplicateNameIndices, cachedCounts, schemas
    };

    return (
        <div className="blocks-container px-3 pb-16 pt-12">
            <div className="row pb-06 small">
                <div className="col-12 pb-02 col-sm">
                    { filterBlocksLen === 1 ? null
                        : allFilterBlocksSelected ?
                            "Click on a filter block to only search its query and/or edit its filters"
                            : "Shift+Click to select an additional filter block"
                    }
                </div>
                <div className="col-12 pb-02 col-sm text-sm-right">
                    { (allFilterBlocksSelected ? "All" : selectedFilterBlockIdxCount + "/" + filterBlocksLen) + " filter blocks selected" }
                </div>
            </div>
            { filterBlocksLen > 0 ? filter_blocks.map(function(fb, index){
                const selected = allFilterBlocksSelected || selectedFilterBlockIndices[index];
                return <FilterBlock {...commonProps} filterBlock={fb} index={index} key={index} selected={selected} />;
            }) : isFetchingInitialFilterSetItem ? (
                <DummyLoadingFilterBlock/>
            ) : (
                <div className="py-3 px-3">
                    <h4 className="text-400 text-center text-danger my-0">No Blocks Defined</h4>
                </div>
            ) }
            <div className="row">
                <div className="col">
                    <button type="button" className="btn btn-primary-dark" onClick={onSelectAllClick} disabled={allFilterBlocksSelected}>
                        <i className={"icon icon-fw far mr-1 icon-" + (allFilterBlocksSelected ? "check-square" : "square")} />
                        Select All
                    </button>
                </div>
                <div className="col-auto">
                    <div className="btn-group" role="group" aria-label="Basic example">
                        <button type="button" className="btn btn-primary-dark" onClick={onAddBtnClick} data-tip="Add new blank filter block">
                            <i className="icon icon-fw icon-plus fas mr-1" />
                            Add Filter Block
                        </button>
                        { currentSingleBlockQuery ?
                            <button type="button" className="btn btn-primary-dark" onClick={onCopyBtnClick} data-tip="Copy currently-selected filter block">
                                <i className="icon icon-fw icon-clone far" />
                            </button>
                            : null }
                    </div>
                </div>
            </div>
        </div>
    );
});

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
        const deleteIconCls = (
            "icon fas mr-07 icon-"
            + ((selected && isSettingFilterBlockIdx) ? "circle-notch icon-spin" : "times-circle clickable")
            + (filterBlocksLen > 1 ? "" : " disabled")
        );
        const titleCls = "text-small" + (
            isDuplicateName ? " text-danger"
                : !filterName ? " text-secondary"
                    : ""
        );

        title = (
            <React.Fragment>
                <i className={deleteIconCls} onClick={filterBlocksLen > 1 ? onRemoveClick : null} data-tip={filterBlocksLen > 1 ? "Delete this filter block" : "Can't delete last filter block"} />
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
        "filterset-block mb-16" +
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
        "isFetchingInitialFilterSetItem" : PropTypes.bool
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
            "cachedCounts": nextCachedCounts
        };
    }

    static resetState(props){
        const { initialFilterSetItem, initialSelectedFilterBlockIndices = [] } = props;
        const selectedFilterBlockIndices = {};
        initialSelectedFilterBlockIndices.forEach(function(selectedIndx){
            // `selectedIndx` is cast to str when becomes key in `selectedFilterBlockIndices`.
            selectedFilterBlockIndices[selectedIndx] = true;
        });
        return {
            "currFilterSet": initialFilterSetItem ? { ...initialFilterSetItem } : null,
            // todo: maybe change to allow multiple in future?
            // "selectedFilterBlockIdx": null,
            selectedFilterBlockIndices,
            "isSettingFilterBlockIdx": true,
            "cachedCounts": {} // Using indices as keys here, but keeping as object (keys are strings)
        };
    }

    constructor(props) {
        super(props);
        this.navigateToCurrentBlock = this.navigateToCurrentBlock.bind(this);
        // Throttled since usually don't want to add that many so fast..
        this.addNewFilterBlock = _.throttle(this.addNewFilterBlock.bind(this), 750, { trailing: false });
        // Throttled, but func itself throttles/prevents-update if still loading last-selected search results.
        this.selectFilterBlockIdx = _.throttle(this.selectFilterBlockIdx.bind(this), 100, { trailing: false });
        // Throttled to prevent accidental double-clicks.
        this.removeFilterBlockAtIdx =  _.throttle(this.removeFilterBlockAtIdx.bind(this), 250, { trailing: false });
        this.setNameOfFilterBlockAtIdx = this.setNameOfFilterBlockAtIdx.bind(this);
        this.setTitleOfFilterSet = this.setTitleOfFilterSet.bind(this);

        this.state = FilterSetController.resetState(this.props);
    }

    componentDidMount(){
        this.navigateToCurrentBlock();
    }

    componentDidUpdate(pastProps, pastState){
        const { initialFilterSetItem } = this.props;
        const { initialFilterSetItem: pastInitialFilterSet } = pastProps;

        // Just some debugging for dev environments.
        if (console.isDebugging()){
            var key;
            for (key in this.props) {
                // eslint-disable-next-line react/destructuring-assignment
                if (this.props[key] !== pastProps[key]) {
                    // eslint-disable-next-line react/destructuring-assignment
                    console.log('FilterSetController changed props: %s', key, pastProps[key], this.props[key]);
                }
            }

            for (key in this.state) {
                // eslint-disable-next-line react/destructuring-assignment
                if (this.state[key] !== pastState[key]) {
                    // eslint-disable-next-line react/destructuring-assignment
                    console.log('FilterSetController changed state: %s', key, pastState[key], this.state[key]);
                }
            }
        }

        if (initialFilterSetItem !== pastInitialFilterSet) {
            this.setState(FilterSetController.resetState(this.props), this.navigateToCurrentBlock);
            return;
        }

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

    navigateToCurrentBlock(){
        const { navigate: virtualNavigate, searchHrefBase, context: searchContext } = this.props; // props.navigate passed down in from SPC EmbeddedSearchView VirtualHrefController
        const { selectedFilterBlockIndices, currFilterSet } = this.state;

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
                global_flags = global_flags.slice(1).replace("type=VariantSample&", ""); // .replace("&sort=date_created", "");
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
                "intersect" : false,
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
        const { currFilterSet, selectedFilterBlockIndices, cachedCounts, isSettingFilterBlockIdx } = this.state;
        const childProps = {
            ...passProps,
            currFilterSet,
            isSettingFilterBlockIdx,
            selectedFilterBlockIndices,
            cachedCounts,
            addNewFilterBlock: this.addNewFilterBlock,
            removeFilterBlockAtIdx: this.removeFilterBlockAtIdx,
            selectFilterBlockIdx: this.selectFilterBlockIdx,
            setNameOfFilterBlockAtIdx: this.setNameOfFilterBlockAtIdx,
            setTitleOfFilterSet: this.setTitleOfFilterSet
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
