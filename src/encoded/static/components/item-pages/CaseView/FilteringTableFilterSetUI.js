'use strict';

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';

import Collapse from "react-bootstrap/esm/Collapse";

import { console, layout, navigate, ajax, itemUtil } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { getSchemaProperty } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';

import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { DisplayTitleColumnWrapper, DisplayTitleColumnDefault } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';
import { VirtualHrefController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/VirtualHrefController';

import { get as getSchemas } from './../../util/Schemas';
import { Schemas } from '../../util';


/**
 * @todo Maybe will be renamed if resuable
 * @todo
 *      Maybe check if new caseItem.active_filterset then update state.lastSavedFilterSet via getDerivedStateFromProps or componentDidUpdate or something
 *      Not relevant for long time until/unless maybe entire Case gets refreshed re: websockets or something...
 */
export class FilteringTableFilterSetUI extends React.PureComponent {

    /**
     * @todo Move into own func?
     * @param {{ field, ... }[]} facets List of objects containing facet info from which we extract just certain non-dynamic fields into a cached dictionary of facet/field info.
     * @param {string[]} excludeFacets - List of field names to be excluded from this UI.
     * @returns {Object.<string, { field: string, title: string, description: string, grouping: string, order: number, aggregation_type: string, field_type: string, EXCLUDED: boolean }>} Dictionary of facet/field-info from schemas+response.
     */
    static buildFacetDictionary(facets = null, excludeFacets = null){
        if (!Array.isArray(facets)) return {};
        const excluded = {};
        if (Array.isArray(excludeFacets)) {
            excludeFacets.forEach(function(fieldName){
                excluded[fieldName] = true;
            });
        }

        const dict = {};
        facets.forEach(function(facetFields){
            const {
                field,
                title, description,
                grouping, order,
                aggregation_type, field_type
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
        });
        return dict;
    }

    static hasFilterSetChanged(savedFilterSet = null, currFilterSet = null) {
        if (!savedFilterSet && currFilterSet) {
            return true;
        }

        // Eventually can add 'status' to this as well, if UI to edit it added.
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

    constructor(props){
        super(props);
        const { caseItem } = props;
        const { active_filterset = null } = caseItem;
        this.toggleOpen = _.throttle(this.toggleOpen.bind(this), 750);
        this.saveFilterSet = _.throttle(this.saveFilterSet.bind(this), 1500);

        this.memoized = {
            buildFacetDictionary: memoize(FilteringTableFilterSetUI.buildFacetDictionary, function(newArgs, lastArgs){
                const [ nextFacets ] = newArgs;
                const [ lastFacets ] = lastArgs;
                // In this component we only want the titles and aggregation_types of facets, not their aggregations,
                // so we recalculate only if we never calculated them before.
                if (!lastFacets && nextFacets) {
                    return false;
                }
                return true;
            }),
            hasFilterSetChanged: memoize(FilteringTableFilterSetUI.hasFilterSetChanged),
            findDuplicateBlocks: memoize(FilteringTableFilterSetUI.findDuplicateBlocks)
        };

        this.state = {
            "bodyOpen": false,
            "bodyMounted": false, // Is set to true for 750ms after closing to help keep contents visible until collapsed.
            "lastSavedFilterSet": active_filterset,
            "isSavingFilterSet": false
        };
    }

    componentDidUpdate(pastProps, pastState){
        const { currFilterSet: pastFilterSet, selectedFilterBlockIdx: pastSelectedIdx } = pastProps;
        const { bodyOpen: pastBodyOpen } = pastState;
        const { currFilterSet, selectedFilterBlockIdx } = this.props;
        const { bodyOpen } = this.props;
        if (pastFilterSet !== currFilterSet || selectedFilterBlockIdx !== pastSelectedIdx || (bodyOpen && !pastBodyOpen)) {
            setTimeout(ReactTooltip.rebuild, 0);
        }
    }

    toggleOpen(evt){
        this.setState(function({ bodyOpen: exstOpen }){
            const bodyOpen = !exstOpen;
            return { bodyOpen, bodyMounted: true };
        }, () => {
            const { bodyOpen } = this.state;
            if (!bodyOpen) {
                setTimeout(()=>{
                    this.setState({ bodyMounted: false });
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

        // No error handling (e.g. lastSavedFilterSet not having view permissions for) done here as assumed inaccessible.

        /**
         * Remove any calculated or linkTo things from PATCH/POST payload.
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
            caseItem,

            // From FilterSetController:
            currFilterSet: filterSet = null,
            excludeFacets,
            cachedCounts = {},
            addNewFilterBlock, selectedFilterBlockIdx, selectFilterBlockIdx, removeFilterBlockAtIdx,
            setNameOfFilterBlockAtIdx, setTitleOfFilterSet
        } = this.props;
        const { total: totalCount, facets = null } = searchContext || {};
        const {
            '@id': filterSetID,
            filter_blocks = [],
            error: fsError = null,
            title: fsTitle = null
        } = filterSet || {};
        const { bodyOpen, bodyMounted, lastSavedFilterSet, isSavingFilterSet } = this.state;

        // Only updates if facets is not null since we don't care about aggregated counts from search response.
        const facetDict = this.memoized.buildFacetDictionary(facets, excludeFacets);
        const hasFilterSetChanged = this.memoized.hasFilterSetChanged(lastSavedFilterSet, filterSet);
        const { duplicateQueryIndices, duplicateNameIndices } = this.memoized.findDuplicateBlocks(filter_blocks);

        // console.log(
        //     'FILTERSETUIPROPS',
        //     this.props,
        //     hasFilterSetChanged,
        //     cachedCounts
        // );

        let body = null;
        if (bodyMounted) {
            const bodyProps = {
                filterSet, facetDict, excludeFacets, searchContext,
                addNewFilterBlock, selectedFilterBlockIdx, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
                cachedCounts, duplicateQueryIndices, duplicateNameIndices
            };
            body =  <FilterSetUIBlocks {...bodyProps} />;
        }

        return (
            // TODO Refactor/simplify AboveTableControlsBase to not need nor use `panelMap` (needless complexity / never had use for it)
            <div className="above-variantsample-table-ui">
                <div className="filterset-outer-container">
                    <FilterSetUIHeader {...{ filterSet, bodyOpen, caseItem, duplicateQueryIndices, duplicateNameIndices, hasFilterSetChanged, isSavingFilterSet, setTitleOfFilterSet }}
                        toggleOpen={this.toggleOpen} saveFilterSet={this.saveFilterSet} />
                    <Collapse in={bodyOpen}>
                        <div className="filterset-blocks-container">
                            { body }
                        </div>
                    </Collapse>
                </div>
                <AboveTableControlsBase {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions }}
                    panelMap={AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(this.props)}>
                    <h4 className="text-400 col my-0">
                        <span className="text-600">{ totalCount }</span> Variant Matches
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
        saveFilterSet, isSavingFilterSet, setTitleOfFilterSet
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
    if (isEditingTitle) {
        titleBlock = (
            <form className="d-flex align-items-center mb-0" action="#case-info.filtering" onSubmit={function(e){
                e.stopPropagation();
                e.preventDefault();
                setIsEditingTitle(false);
                const formElem = e.target;
                const inputElem = formElem.children[0];
                setTitleOfFilterSet(inputElem.value);
            }}>
                <input type="text" name="filterName" className="form-control" defaultValue={fsTitle || fsDisplayTitle} />
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
        titleBlock = (
            <h4 className="text-400 clickable my-0 d-inline-block" onClick={toggleOpen}>
                <i className={"small icon icon-fw fas mr-07 icon-" + (bodyOpen ? "minus" : "plus")} />
                { fsTitle || fsDisplayTitle || <em>No Title Set</em> }
                { bodyOpen ? <i className="icon icon-pencil-alt fas ml-1 clickable small text-secondary" onClick={onEditClick} /> : null }
            </h4>
        );
    }

    const haveDuplicateQueries = _.keys(duplicateQueryIndices).length > 0;
    const haveDuplicateNames = _.keys(duplicateNameIndices) > 0;

    const editBtnDisabled = !bodyOpen || !hasFilterSetChanged || !haveEditPermission || haveDuplicateQueries || haveDuplicateNames || isSavingFilterSet;

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
        <div className="row align-items-center px-3 py-3">
            <div className="col">{ titleBlock }</div>
            <div className="col-auto">
                { haveDuplicateQueries || haveDuplicateNames ?
                    <i className="icon icon-exclamation-triangle fas align-middle mr-15 text-secondary"
                        data-tip={`Filter blocks with duplicate ${haveDuplicateQueries ? "queries" : "names"} exist below`} />
                    : null }
                <button type="button" className="btn btn-primary" disabled={editBtnDisabled} onClick={onSaveBtnClick}>
                    { isSavingFilterSet ?
                        <i className="icon icon-spin icon-circle-notch fas" />
                        : "Save Current Filter Set" }
                </button>
            </div>
        </div>
    );
}


/** Renders the Blocks */

const FilterSetUIBlocks = React.memo(function FilterSetUIBlocks(props){
    const {
        filterSet, facetDict,
        addNewFilterBlock, selectedFilterBlockIdx, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
        cachedCounts, duplicateQueryIndices, duplicateNameIndices } = props;
    const { filter_blocks = [], query = "" } = filterSet || {};
    const { query: currentBlockQuery = null } = (typeof selectedFilterBlockIdx === "number" && filter_blocks[selectedFilterBlockIdx]) || {};

    function onAddBtnClick(e){
        e.stopPropagation();
        addNewFilterBlock();
    }

    function onCopyBtnClick(e){
        e.stopPropagation();
        addNewFilterBlock({ "query" : currentBlockQuery });
    }

    const commonProps = { facetDict, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx, duplicateQueryIndices, duplicateNameIndices, cachedCounts };

    return (
        <div className="blocks-container px-3 pb-16">
            { filter_blocks.length > 0 ? filter_blocks.map(function(fb, index){
                const selected = selectedFilterBlockIdx !== null && selectedFilterBlockIdx === index;
                return <FilterBlock {...commonProps} filterBlock={fb} index={index} key={index} selected={selected} />;
            }) : (
                <div className="py-3 px-3">
                    <h4 className="text-400 text-center my-0">No Blocks Defined</h4>
                </div>
            ) }
            <div className="btn-group" role="group" aria-label="Basic example">
                <button type="button" className="btn btn-primary-dark" onClick={onAddBtnClick} data-tip="Add new blank filter block">
                    <i className="icon icon-fw icon-plus fas mr-1" />
                    Add New Filter Block
                </button>
                { currentBlockQuery ?
                    <button type="button" className="btn btn-primary-dark" onClick={onCopyBtnClick} data-tip="Copy currently-selected filter block">
                        <i className="icon icon-fw icon-clone far mr" />
                    </button>
                    : null }
            </div>
        </div>
    );
});


const FilterBlock = React.memo(function FilterBlock(props){
    const {
        index,
        filterBlock,
        filter_blocks,
        selected = false,
        // searchContext,
        removeFilterBlockAtIdx,
        setNameOfFilterBlockAtIdx,
        selectFilterBlockIdx,
        facetDict,
        duplicateQueryIndices,
        duplicateNameIndices,
        cachedCounts
    } = props;

    const {
        query: filterStrQuery,
        name: filterName
    } = filterBlock;

    const isDuplicateQuery = typeof duplicateQueryIndices[index] === "number";
    const isDuplicateName = typeof duplicateNameIndices[index] === "number";

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
        selectFilterBlockIdx(index);
    }


    let title = null;
    if (isEditingTitle) {
        title = (
            <form className="d-flex align-items-center mb-0" action="#case-info.filtering" onSubmit={function(e){
                e.stopPropagation();
                e.preventDefault();
                setIsEditingTitle(false);
                const formElem = e.target;
                const inputElem = formElem.children[0];
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
        const titleCls = isDuplicateName ? "text-danger"
            : !filterName ? "text-secondary"
                : "";

        title = (
            <React.Fragment>
                <i className="icon icon-times-circle fas mr-1 clickable" onClick={onRemoveClick} />
                <span className={titleCls} data-tip={isDuplicateName ? "Duplicate title of filter block #" + (duplicateNameIndices[index] + 1) : null}>
                    { filterName || <em>No Name</em> }
                </span>
                <i className="icon icon-pencil-alt fas ml-1 clickable" onClick={onEditClick} />
            </React.Fragment>
        );
    }

    return (
        <div className={"filterset-block clickable mb-16" + (selected ? " selected" : "") + (!isEditingTitle ? " clickable" : "")}
            onClick={!isEditingTitle ? onSelectClick : null} data-duplicate-query={isDuplicateQuery} data-tip={isDuplicateQuery ? "Duplicate query of filter block #" + (duplicateQueryIndices[index] + 1) : null}>
            <div className="row px-2 pt-08 pb-04 title-controls-row">
                <div className="col">
                    { title }
                </div>
                <div className="col-auto">
                    { cachedCounts[index] }
                </div>
            </div>
            <FieldBlocks {...{ filterBlock, facetDict }} />
        </div>
    );
});

const FieldBlocks = React.memo(function FieldBlocks({ filterBlock, facetDict }) {
    const { query: filterStrQuery } = filterBlock;

    if (!filterStrQuery) {
        return (
            <div className="py-1 px-2">
                <em>No Filters Selected</em>
            </div>
        );
    }

    // Taken from SPC/RangeFacet
    function formatRangeVal(field, rangeVal){
        const fieldFacet = facetDict[field];
        const { field_type } = fieldFacet;

        if (field_type === "date") {
            return <LocalizedTime timestamp={value} localize={false} />;
        }
        if (field_type === "number"){
            rangeVal = parseFloat(rangeVal);
        }

        let valToShow = Schemas.Term.toName(field, rangeVal, false);
        if (typeof valToShow === "number") {
            const absVal = Math.abs(valToShow);
            if (absVal.toString().length <= 7){
                // Else is too long and will go thru toPrecision or toExponential.
                if (absVal >= 1000) {
                    valToShow = decorateNumberWithCommas(valToShow);
                } else {
                    // keep valToShow
                }
            } else {
                valToShow = valToShow.toExponential(3);
            }
        } // else is assumed to be valid JSX already
        return valToShow;
    }

    const origQs = queryString.parse(filterStrQuery);
    const qs = {};
    Object.keys(origQs).forEach(function(k){

        // Standardize vals into arrays (w. len 1 if needed).
        let v = origQs[k];
        if (!Array.isArray(v)) {
            v = [v];
        }

        // Remove .from or .to if needed, confirm aggregation_type === stats, and transform/merge values
        let field = k;
        let removedRangeFacetAppendage = false;
        if (k.slice(-5) === ".from"){
            field = k.slice(0, -5);
            if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                field = k;
                console.error("Attempted to remove 'from' from field but couldn't succeed", field, facetDict);
            } else {
                removedRangeFacetAppendage = true;
                v = v.map(function(rangeVal, i){
                    return <span key={i}><i className="icon icon-fw icon-greater-than-equal small fas mr-08"/>{ formatRangeVal(field, rangeVal) }</span>;
                });
            }

        } else if (k.slice(-3) === ".to") {
            field = k.slice(0, -3);
            if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                field = k;
                console.error("Attempted to remove 'to' from field but couldn't succeed", field, facetDict);
            } else {
                removedRangeFacetAppendage = true;
                v = v.map(function(rangeVal, i){
                    return <span key={i}><i className="icon icon-fw icon-less-than-equal fas small mr-08"/>{ formatRangeVal(field, rangeVal) }</span>;
                });
            }
        }

        if (!removedRangeFacetAppendage) {
            // If not range facet, transform vals to proper names.
            v = v.map(function(termVal){
                return Schemas.Term.toName(field, termVal);
            });
        }

        // Merge, e.g. if a from and a to
        if (typeof qs[field] !== "undefined") {
            qs[field] = qs[field].concat(v);
        } else {
            qs[field] = v;
        }
    });

    const fields = Object.keys(qs);
    const blocks = fields.sort(function(fA, fB){
        // Sort keys by schema.facet.order, if any.
        const fsA = facetDict[fA];
        const fsB = facetDict[fB];
        if (fsA && !fsB) return -1;
        if (!fsA && fsB) return 1;
        if (!fsA && !fsB) return 0;
        return (fsA.order || 10000) - (fsB.order || 10000);
    }).map(function(field, index){
        return <FieldBlock terms={qs[field]} field={field} key={field} facetDict={facetDict} />;
    });

    return (
        <div className="d-flex flex-wrap filter-query-viz-blocks px-2">
            { blocks }
        </div>
    );
});

function FieldBlock({ field, terms, facetDict, index }){

    const fieldFacet = facetDict[field];
    const {
        title: facetTitle = null,
        description: facetDescription = null,
        aggregation_type = "terms"
    } = fieldFacet || {};


    // if (aggregation_type === "stats") {
    //     // TODO: Show single > or < or something.
    // }

    const fieldSchema = getSchemaProperty(field, Schemas.get(), "VariantSample");
    const {
        // Used primarily as fallback, we expect/hope for fieldFacet to be present/used primarily instead.
        title: fieldTitle = null,
        description: fieldDescription = null
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
 *
 * @todo
 * This will eventually replace some of logic in FilteringTab.js > FilteringTabSubtitle
 * While other stuff (calculation of if changed vs current search response filters etc)
 * will be in FilterSetUIBlocks or its children.
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
        "navigate" : PropTypes.func.isRequired
    };

    static defaultProps = {
        "searchHrefBase" : "/search/?type=VariantSample&sort=date_created",
        "excludeFacets" : ["type"]
        // Might be needed for future for like 'create new' button, but likely to be defined elsewhere maybe (outside of this component)
        // "blankFilterSetItem" : {
        //     "title" : "New FilterSet",
        //     "search_type": "VariantSample",
        //     "filter_blocks" : [
        //         { "query" : "" }
        //     ]
        // }
    };

    /**
     * Update state.currFilterSet.filter_blocks[selectedFilterBlockIdx].query from search response if needed.
     *
     * @todo Maybe move to componentDidUpdate or something...
     */
    static getDerivedStateFromProps(props, state) {
        const { context: searchContext, excludeFacets } = props;
        const { currFilterSet, selectedFilterBlockIdx, isSettingFilterBlockIdx, cachedCounts: lastCachedCounts } = state;
        if (!searchContext){
            // Don't update from blank.
            return null;
        }
        if (selectedFilterBlockIdx === null || isSettingFilterBlockIdx){
            return null;
        }

        const { filters: ctxFilters = [], total: totalCount } = searchContext || {};

        // Get counts to show (todo: maybe prefetch these later on)
        const nextCachedCounts = { ...lastCachedCounts };
        nextCachedCounts[selectedFilterBlockIdx] = totalCount;

        const currFilterBlock = currFilterSet.filter_blocks[selectedFilterBlockIdx];
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

        const extraCtxFilters = searchFilters.filter(function({ field, term }){
            if (filterBlockQuery[field]) {
                if (!Array.isArray(filterBlockQuery[field])) {
                    if (filterBlockQuery[field] === term) {
                        delete filterBlockQuery[field];
                        return false;
                    }
                } else {
                    for (var i = 0; i < filterBlockQuery[field].length; i++){
                        if (filterBlockQuery[field][i] === term){
                            filterBlockQuery[field].splice(i, 1);
                            if (filterBlockQuery[field].length === 1) {
                                filterBlockQuery[field] = filterBlockQuery[field][0];
                            }
                            return false;
                        }
                    }
                }
            }
            return true;
        });

        if (extraCtxFilters.length === 0 && Object.keys(filterBlockQuery).length === 0) {
            // No changes to query
            return { "cachedCounts": nextCachedCounts };
        }

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
        const nextQuery = queryString.stringify(searchFiltersQuery).replaceAll("%20", "+");
        const nextCurrFilterSet = { ...currFilterSet };
        nextCurrFilterSet.filter_blocks = nextCurrFilterSet.filter_blocks.slice();
        nextCurrFilterSet.filter_blocks[selectedFilterBlockIdx] = {
            ...nextCurrFilterSet.filter_blocks[selectedFilterBlockIdx],
            "query" : nextQuery
        };


        return { "currFilterSet": nextCurrFilterSet, "cachedCounts": nextCachedCounts };
    }

    constructor(props) {
        super(props);
        this.navigateToCurrentBlock = this.navigateToCurrentBlock.bind(this);
        // Throttled since usually don't want to add that many so fast..
        this.addNewFilterBlock = _.throttle(this.addNewFilterBlock.bind(this), 750, { trailing: false });
        // Throttled, but func itself throttles/prevents-update if still loading last-selected search results.
        this.selectFilterBlockIdx = _.throttle(this.selectFilterBlockIdx.bind(this), 250, { trailing: false });
        // Throttled to prevent accidental double-clicks.
        this.removeFilterBlockAtIdx =  _.throttle(this.removeFilterBlockAtIdx.bind(this), 250, { trailing: false });
        this.setNameOfFilterBlockAtIdx = this.setNameOfFilterBlockAtIdx.bind(this);
        this.setTitleOfFilterSet = this.setTitleOfFilterSet.bind(this);
        const { initialFilterSetItem } = this.props;
        const { "@id" : fsID } = initialFilterSetItem;

        this.state = {
            "currFilterSet" : { ...initialFilterSetItem },
            // todo: maybe change to allow multiple in future?
            "selectedFilterBlockIdx" : 0, // null,
            "isSettingFilterBlockIdx" : false,
            "cachedCounts" : {} // Using indices as keys here, but keeping as object (keys are strings)
            // "lastSavedFilterSet" : fsID ? initialFilterSetItem : null // might move elsewhere to like FilterSetUIBlocks
        };
    }

    // Maybe todo (depending on if can realistically occur): componentDidUpdate { if initialFilterSetItem changed, reset state }

    addNewFilterBlock(newFilterBlock = null){
        this.setState(function({ currFilterSet: pastFS }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            let { name, query } = newFilterBlock || {};
            if (!name) {
                // Generate new name
                const highestAutoCount = nextFB.reduce(function(m, { name = "" }){
                    const match = name.match(/^(New Filter Block )(\d+)/);
                    if (!match || !match[2]) return m;
                    return Math.max(m, parseInt(match[2]));
                }, 0);
                name = "New Filter Block " + (highestAutoCount + 1);
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
                "selectedFilterBlockIdx" : nextFB.length - 1,
                "isSettingFilterBlockIdx" : true
            };
        }, this.navigateToCurrentBlock);
    }

    removeFilterBlockAtIdx(idx, cb){
        this.setState(function({ currFilterSet: pastFS, selectedFilterBlockIdx }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            nextFB.splice(idx, 1);

            if (selectedFilterBlockIdx !== null) {
                // Unset or shift it down if needed
                if (selectedFilterBlockIdx === idx) {
                    selectedFilterBlockIdx = null;
                } else if (selectedFilterBlockIdx > idx) {
                    selectedFilterBlockIdx = selectedFilterBlockIdx - 1;
                }
            }
            return {
                "currFilterSet": {
                    ...pastFS,
                    "filter_blocks" : nextFB
                },
                selectedFilterBlockIdx
            };
        }, cb);
    }

    setNameOfFilterBlockAtIdx(idx, newName, cb){
        this.setState(function({ currFilterSet: pastFS }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            const nextBlock = { ...nextFB[idx] };
            nextBlock.name = newName;
            nextFB[idx] = nextBlock;
            return {
                "currFilterSet": {
                    ...pastFS,
                    "filter_blocks" : nextFB
                }
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

    /** Used as callback by `this.selectFilterBlockIdx` & `this.addNewFilterBlock` */
    navigateToCurrentBlock(){
        const { navigate: virtualNavigate, searchHrefBase, context: searchContext } = this.props; // props.navigate passed down in from SPC EmbeddedSearchView VirtualHrefController
        const { selectedFilterBlockIdx, currFilterSet } = this.state;


        if (selectedFilterBlockIdx === null) {
            // Didn't set an index - todo: use POST / combo search
            const {
                filter_blocks,
                search_type = "VariantSample"
            } = currFilterSet;

            let global_flags = url.parse(searchHrefBase, false).search;
            if (global_flags) {
                global_flags = global_flags.slice(1); // .replace("&sort=date_created", "");
            }

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
                "filter_blocks": filter_blocks.map(function({ query }){
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
            const { "@id": currHref = null } = searchContext || {};
            const currFilterSetQuery = currFilterSet.filter_blocks[selectedFilterBlockIdx].query;
            const nextSearchHref = searchHrefBase + (currFilterSetQuery ? "&" + currFilterSetQuery : "");

            // Compares full hrefs, incl searchHrefBase params
            const haveSearchParamsChanged = !currHref || !_.isEqual(url.parse(nextSearchHref, true).query, url.parse(currHref, true).query);

            if (haveSearchParamsChanged) {
                virtualNavigate(nextSearchHref, null, (res)=>{
                    this.setState({ "isSettingFilterBlockIdx": false });
                });
            } else {
                this.setState({ "isSettingFilterBlockIdx": false });
            }

        }
    }

    selectFilterBlockIdx(index = null){
        this.setState(function({ selectedFilterBlockIdx: pastIdx, isSettingFilterBlockIdx }){
            if (isSettingFilterBlockIdx) return; // Another update in progress already.
            if (index !== null && pastIdx === index) {
                // Clear it.
                return {
                    "selectedFilterBlockIdx" : null,
                    "isSettingFilterBlockIdx" : false
                };
            }
            return {
                "selectedFilterBlockIdx" : index,
                "isSettingFilterBlockIdx" : true
            };
        }, this.navigateToCurrentBlock);
    }

    render(){
        const { children, initialFilterSetItem, ...passProps } = this.props;
        const { currFilterSet, selectedFilterBlockIdx, cachedCounts, isSettingFilterBlockIdx } = this.state;
        const childProps = {
            ...passProps,
            currFilterSet,
            selectedFilterBlockIdx,
            isSettingFilterBlockIdx,
            cachedCounts,
            addNewFilterBlock: this.addNewFilterBlock,
            removeFilterBlockAtIdx: this.removeFilterBlockAtIdx,
            selectFilterBlockIdx: this.selectFilterBlockIdx,
            setNameOfFilterBlockAtIdx: this.setNameOfFilterBlockAtIdx,
            setTitleOfFilterSet: this.setTitleOfFilterSet
        };

        // console.log('FilterSetController Props', this.props);

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
